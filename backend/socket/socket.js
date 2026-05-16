const { supabase } = require('../config/supabase');
const { processMatchResult } = require('../controllers/game.controller');
const { processWarMatchResult, DRAW_MIN_MOVES } = require('../controllers/clan.controller');
const TournamentManager = require('../services/tournament.manager');

// chess.js compatibility helper
let Chess;
const chessLib = require('chess.js');
if (typeof chessLib.Chess === 'function') {
  Chess = chessLib.Chess;
} else {
  Chess = chessLib;
}

// ─── CLAN WAR STATE ──────────────────────────────────────────
// Active clan war games: warMatchId → { chess, player1, player2, interval, disconnectCounts, ... }
const activeClanWarGames = new Map();
// No-show timers: warMatchId → timeout
const noShowTimers = new Map();

// Matchmaking queues per timer: { 1: [], 3: [], 5: [], 10: [] }
const queues = { 1: [], 3: [], 5: [], 10: [] };

// Tournament matchmaking queues: { [tournamentId]: [] }
const tournamentQueues = {};

// Active games: matchId → { chess, player1, player2, interval, timer_type }
const activeGames = new Map();

// Socket ↔ User maps
const socketToUser = new Map(); // socketId → { userId, username }
const userToSocket = new Map(); // userId  → socketId
const userSockets = new Map();  // userId  → Set(socketId)

const banLocks = new Set(); // Prevents anti-cheat double-confiscation race condition

let onlineCount = 0;

module.exports = (io) => {
  // Initialize Tournament Manager
  TournamentManager.init(io);

  io.on('connection', (socket) => {
    broadcastLiveInfo(io);

    // ─── TOURNAMENT SYNC ──────────────────────────────────
    socket.on('join_tournament', ({ tournamentId }) => {
        const tIdStr = String(tournamentId);
        socket.join(`tournament_${tIdStr}`);
        console.log(`[Socket] User ${socket.id} joined tournament room: ${tIdStr}`);
        
        // Broadcast to everyone in the tournament that a new player is here/active
        io.to(`tournament_${tIdStr}`).emit('tournament_update');
        
        TournamentManager.broadcastState(tIdStr);
        // Direct sync for joining socket to avoid race conditions with room map
        const tState = TournamentManager.activeTourneys?.get(tIdStr);
        if (tState) {
            const baseState = {
                id: tState.id, tr_id: tState.tr_id, status: tState.status, phase: tState.phase,
                countdown: tState.countdown, round: tState.round,
                players: tState.players.map(p => ({ user_id: p.user_id, username: p.username, rank: p.rank, score: p.score, status: p.status, slot: p.slot })),
                matches: []
            };
            socket.emit(`tournament_sync_${tIdStr}`, baseState);
        }
    });

    // ─── AUTHENTICATE ───────────────────────────────────────
    socket.on('authenticate', async ({ userId, username }) => {
      // Single-Device Enforcement
      if (userSockets.has(userId) && userSockets.get(userId).size > 0) {
          // Allow multiple instances or tabs silently instead of aggressively kicking.
          // By not dropping them, they can browse Dashboard and Play simultaneously.
      }

      let matchFound = false;

      let fullName = username;
      try {
        const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
        if (prof?.full_name) fullName = prof.full_name;
      } catch (e) {
        console.error('[Socket] Profile fetch error:', e.message);
      }
      
      socketToUser.set(socket.id, { userId, username, full_name: fullName });
      socket.userId = userId; 
      userToSocket.set(userId, socket.id);
      socket.join(userId); // Join private room for targeted updates (wallet, etc)
      if (!userSockets.has(userId)) userSockets.set(userId, new Set());
      userSockets.get(userId).add(socket.id);
      
      // Force live info sync to client directly once authenticated successfully
      broadcastLiveInfo(io);
      socket.emit('live_info', { online_users: userSockets.size, active_matches: activeGames.size });

      
      // Attempt to rejoin active generic match
      for (const [matchId, game] of activeGames.entries()) {
        const isP1 = game.player1.userId === userId;
        const isP2 = game.player2.userId === userId;

        if (isP1 || isP2) {
          matchFound = true;
          if (isP1) game.player1.socketId = socket.id;
          else game.player2.socketId = socket.id;

          if (game.disconnectTimeout) { 
            clearTimeout(game.disconnectTimeout); 
            game.disconnectTimeout = null; 
          }

          // Notify client of active match for rejoining
          socket.emit('active_match_found', {
            matchId,
            match_type: game.match_type || 'random',
            timer: game.timer_type,
            white_time: game.player1.time,
            black_time: game.player2.time,
            turn: game.chess.turn(),
            myColor: isP1 ? 'white' : 'black',
            opponent: isP1 ? 
              { username: game.player2.username, full_name: game.player2.full_name, userId: game.player2.userId, rank: game.player2.rank, profile_image: game.player2.profile_image } : 
              { username: game.player1.username, full_name: game.player1.full_name, userId: game.player1.userId, rank: game.player1.rank, profile_image: game.player1.profile_image }
          });
        }
      }

      // Attempt to rejoin active clan war match
      for (const [warMatchId, cwGame] of activeClanWarGames.entries()) {
        const isP1 = cwGame.player1.userId === userId;
        const isP2 = cwGame.player2.userId === userId;

        if (isP1 || isP2) {
          matchFound = true;
          if (isP1) cwGame.player1.socketId = socket.id;
          else cwGame.player2.socketId = socket.id;

          // Cancel pending forfeit timeout since player reconnected
          if (cwGame.disconnectTimeout) {
            clearTimeout(cwGame.disconnectTimeout);
            cwGame.disconnectTimeout = null;
          }

          // Notify opponent of reconnect
          const oppSocket = isP1 ? cwGame.player2.socketId : cwGame.player1.socketId;
          if (oppSocket) io.to(oppSocket).emit('cw_opponent_reconnected');

          // Sync board state back to reconnecting player
          socket.emit('cw_match_sync', {
            warMatchId,
            matchId: cwGame.matchId,
            fen: cwGame.chess.fen(),
            pgn: cwGame.chess.pgn(),
            white_time: cwGame.player1.time,
            black_time: cwGame.player2.time,
            moveCount: cwGame.moveCount || 0,
            myColor: isP1 ? 'white' : 'black',
          });

          // Notify client for dashboard rejoin
          socket.emit('active_match_found', {
            matchId: cwGame.matchId,
            warMatchId,
            match_type: 'clan_war',
            timer: 5,
            white_time: cwGame.player1.time,
            black_time: cwGame.player2.time,
            turn: cwGame.chess.turn(),
            myColor: isP1 ? 'white' : 'black',
            opponent: isP1 ? 
              { userId: cwGame.player2.userId } : 
              { userId: cwGame.player1.userId }
          });
        }
      }

      try {
        const { data: profile } = await supabase.from('profiles').select('settings').eq('id', userId).single();
        const settings = profile?.settings || {};
        const showOnline = settings.privacy?.online_status !== false;

        await supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', userId);
        
        // FIX: Rejoin any active tournament rooms + matches on reconnect
        if (TournamentManager.onPlayerConnected(userId, socket)) {
            matchFound = true;
        }
        
        // If no match found across any category, tell client to clear stale data
        if (!matchFound) {
            socket.emit('clear_active_match');
        }

        // Notify friends that this user is now online (only if privacy allows)
        if (showOnline) {
            const { data: friends } = await supabase.from('friends').select('user_id, friend_id').or(`user_id.eq.${userId},friend_id.eq.${userId}`).eq('status', 'accepted');
            if (friends) {
               friends.forEach(f => {
                  const friendId = f.user_id === userId ? f.friend_id : f.user_id;
                  const friendSocket = userToSocket.get(friendId);
                  if (friendSocket) io.to(friendSocket).emit('friend_status_update', { userId, is_online: true });
               });
            }
        }
      } catch {}
      socket.emit('authenticated', { success: true });
    });

    // ─── TOURNAMENT MGR EVENTS ──────────────────────────────
    socket.on('rejoin_tr_match', ({ matchId }) => {
        const userId = socket.userId;
        if (!userId) return;
        TournamentManager.rejoinMatch(socket, matchId, userId);
    });

    socket.on('make_tr_move', ({ matchId, moveSan }) => {
        const userId = socket.userId;
        if (!userId) return;
        
        // Try TournamentManager (Paid TR / Knockout)
        TournamentManager.handleMove(userId, matchId, moveSan);
    });

    // ─── RANDOM MATCHMAKING ──────────────────────────────────
    socket.on('find_match', ({ timer, username }) => {
      const userId = socket.userId;
      if (!userId) return;

      const queue = queues[timer];
      if (!queue) return;

      // Remove duplicates from queue
      const idx = queue.findIndex(p => p.userId === userId);
      if (idx !== -1) queue.splice(idx, 1);

      if (queue.length > 0) {
        const opponent = queue.shift();
        const me = socketToUser.get(socket.id) || { userId, username, full_name: username };
        createMatch(io, socket, { ...me, timer, socketId: socket.id }, opponent, 'random', timer);
      } else {
        const me = socketToUser.get(socket.id) || { userId, username, full_name: username };
        queue.push({ socketId: socket.id, userId, username, full_name: me.full_name || username });
        socket.emit('searching', { timer });
      }
    });

    socket.on('cancel_search', ({ timer }) => {
      const userId = socket.userId;
      if (!userId) return;

      if (queues[timer]) {
        const i = queues[timer].findIndex(p => p.userId === userId);
        if (i !== -1) queues[timer].splice(i, 1);
      }
      socket.emit('search_cancelled');
    });

    socket.on('join_match', ({ matchId }) => {
        const userId = socket.userId;
        if (!userId) {
            console.warn(`[Socket] join_match rejected: Socket ${socket.id} not authenticated yet.`);
            return;
        }

        const game = activeGames.get(matchId);
        if (game) {
            const isP1 = game.player1.userId === userId;
            const isP2 = game.player2.userId === userId;
            if (isP1 || isP2) {
                if (isP1) game.player1.socketId = socket.id;
                else game.player2.socketId = socket.id;
                
                socket.join(matchId);
                socket.emit('match_sync', {
                    matchId,
                    fen: game.chess.fen(),
                    white_time: game.player1.time,
                    black_time: game.player2.time,
                    myColor: isP1 ? 'white' : 'black',
                    opponent: isP1 ? 
                        { username: game.player2.username, full_name: game.player2.full_name, userId: game.player2.userId, iq_level: game.player2.iq_level, rank: game.player2.rank, profile_image: game.player2.profile_image } : 
                        { username: game.player1.username, full_name: game.player1.full_name, userId: game.player1.userId, iq_level: game.player1.iq_level, rank: game.player1.rank, profile_image: game.player1.profile_image },
                    timer: game.timer_type,
                    pgn: game.chess.pgn()
                });
                
                if (game.disconnectTimeout) {
                    clearTimeout(game.disconnectTimeout);
                    game.disconnectTimeout = null;
                }
                return;
            }
        }

        // Check Clan War Matches
        const cwGame = activeClanWarGames.get(matchId);
        if (cwGame) {
            const isP1 = cwGame.player1.userId === userId;
            const isP2 = cwGame.player2.userId === userId;
            if (isP1 || isP2) {
                if (isP1) cwGame.player1.socketId = socket.id;
                else cwGame.player2.socketId = socket.id;
                
                socket.join(matchId);
                socket.emit('cw_match_sync', {
                    warMatchId: matchId, // assuming matchId is warMatchId here
                    matchId: cwGame.matchId,
                    fen: cwGame.chess.fen(),
                    pgn: cwGame.chess.pgn(),
                    white_time: cwGame.player1.time,
                    black_time: cwGame.player2.time,
                    moveCount: cwGame.moveCount || 0,
                    myColor: isP1 ? 'white' : 'black'
                });
                
                if (cwGame.disconnectTimeout) {
                    clearTimeout(cwGame.disconnectTimeout);
                    cwGame.disconnectTimeout = null;
                }
                return;
            }
        }
    });


    socket.on('cancel_tournament_search', ({ tournamentId }) => {
      const userId = socket.userId;
      if (!userId) return;
      const tIdStr = String(tournamentId);
      if (tournamentQueues[tIdStr]) {
        tournamentQueues[tIdStr] = tournamentQueues[tIdStr].filter(p => p.userId !== userId);
      }
      socket.emit('search_cancelled');
    });

    // ─── PUBLIC ROOM LOBBY (ENTERPRISE) ──────────────────────
    socket.on('join_public_room', async ({ roomCode, deviceId }) => {
      const userId = socket.userId;
      if (!userId) {
        console.warn(`[Lobby] join_public_room REJECTED: Socket ${socket.id} not authenticated yet.`);
        return socket.emit('room_error', { message: 'Authentication pending. Please wait a moment.' });
      }
      const RoomManager = require('../services/room.manager');
      
      const { data: roomData } = await supabase.from('public_rooms').select('id, status').eq('room_code', roomCode).single();
      if (!roomData) return socket.emit('room_error', { message: 'Room not found.' });
      
      const res = await RoomManager.joinRoom(roomData.id, userId, socket, deviceId);
      if (res.success) {
        socket.emit('public_room_joined', { roomId: roomData.id });
      } else {
        socket.emit('room_error', { message: res.message });
      }
    });

    socket.on('public_room_heartbeat', () => {
      const userId = socket.userId;
      if (userId) require('../services/room.manager').handleHeartbeat(userId);
    });

    socket.on('public_room_request_accept', async ({ roomId, targetUserId }) => {
      const hostId = socket.userId;
      if (!hostId) return;
      const RoomManager = require('../services/room.manager');
      const room = await RoomManager.getOrLoadRoom(roomId);
      if (!room || room.hostId !== hostId) return;

      const targetSocketId = userToSocket.get(targetUserId);
      if (!targetSocketId) return socket.emit('room_error', { message: 'Player is offline.' });

      const host = { socketId: socket.id, userId: hostId, username: socketToUser.get(socket.id)?.username || 'Host' };
      const guest = { socketId: targetSocketId, userId: targetUserId, username: socketToUser.get(targetSocketId)?.username || 'Player' };
      
      // Match Locking Logic
      await supabase.from('public_room_players').update({ status: 'playing' }).eq('room_id', roomId).eq('user_id', targetUserId);
      await supabase.from('public_rooms').update({ status: 'MATCH_RUNNING' }).eq('id', roomId);
      
      createMatch(io, socket, { ...guest, roomId, roomCode: room.code }, host, 'room', room.timerType || 5);
      await RoomManager.broadcastRoomUpdate(roomId);
    });

    socket.on('public_room_status_update', async ({ roomId, status }) => {
        const userId = socket.userId;
        if (!userId) return;
        const RoomManager = require('../services/room.manager');
        const room = await RoomManager.getOrLoadRoom(roomId);
        if (room && room.hostId === userId) {
            await RoomManager.updateRoomStatus(roomId, status);
        }
    });

    socket.on('leave_public_room', async ({ roomId }) => {
      const userId = socket.userId;
      if (!userId) return;
      const RoomManager = require('../services/room.manager');
      await supabase.rpc('leave_public_room_atomic', { p_room_id: roomId, p_user_id: userId });
      socket.leave(`room_${roomId}`);
      await RoomManager.broadcastRoomUpdate(roomId);
    });


    // ─── FRIEND INVITE ───────────────────────────────────────
    socket.on('invite_friend', async ({ targetUserId, fromUsername, timer }) => {
      const fromUserId = socket.userId;
      if (!fromUserId || fromUserId === targetUserId) return;
      
      const isPlaying = Array.from(activeGames.values()).some(g => g.player1.userId === targetUserId || g.player2.userId === targetUserId);
      try {
        // 0. Privacy Checks
        const { data: targetProfile } = await supabase.from('profiles').select('settings').eq('id', targetUserId).single();
        const tSettings = targetProfile?.settings || {};

        if (tSettings.privacy?.friend_requests === 'friends') {
          const { data: friendship } = await supabase.from('friends')
            .select('id')
            .or(`and(user1_id.eq.${fromUserId},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${fromUserId})`)
            .maybeSingle();

          if (!friendship) {
            return socket.emit('invite_info', { message: 'This player only accepts challenges from friends.' });
          }
        }

        // 1. Persist challenge in DB
        const { data: existing, error: findError } = await supabase.from('game_challenges')
          .select('id').eq('from_user_id', fromUserId).eq('to_user_id', targetUserId).eq('status', 'pending').maybeSingle();
        
        if (findError) console.error('[Socket] Error finding existing challenge:', findError);

        if (!existing) {
          const { error: insertError } = await supabase.from('game_challenges').insert({
            from_user_id: fromUserId,
            to_user_id: targetUserId,
            timer: parseInt(timer) || 10,
            status: 'pending'
          });

          if (insertError) {
              console.error('[Socket] Error persisting challenge:', insertError);
              return socket.emit('match_error', { message: `Failed to send challenge: ${insertError.message || 'Database error'}` });
          }
        }

        // 2. Always save a persistent site notification
        const { sendNotification } = require('../services/notification.service');
        await sendNotification({
          user_id: targetUserId,
          type: 'challenge',
          title: 'New Chess Challenge! ♟️',
          message: `${fromUsername} has challenged you to a ${timer}-minute match.`,
        });

        // 3. Handle Real-time delivery
        const sockets = userSockets.get(targetUserId);
        const authenticatedUser = socketToUser.get(socket.id);
        const senderUsername = authenticatedUser?.username || 'Unknown';

        if (sockets && sockets.size > 0) {
          if (isPlaying) {
             sockets.forEach(sid => io.to(sid).emit('silent_notification'));
          } else {
             sockets.forEach(sid => {
                io.to(sid).emit('friend_invite', { fromUserId, fromUsername: senderUsername, timer });
             });
          }
        } else {
           socket.emit('invite_info', { message: 'Player is offline.' });
        }
      } catch (e) {
        console.error('Challenge invite error:', e);
      }
    });

    socket.on('accept_invite', async ({ fromUserId, timer }) => {
      const toUserId = socket.userId;
      const toUser = socketToUser.get(socket.id);
      if (!toUserId || !toUser) {
          console.error('[Socket] Accept invite failed: Receiver not authenticated');
          return;
      }
      
      console.log(`[Socket] Challenge accepted by ${toUser.username} from ${fromUserId}`);

      const fromSocketId = userToSocket.get(fromUserId);
      const fromUser = socketToUser.get(fromSocketId);
      
      const host = { socketId: fromSocketId, userId: fromUserId, username: fromUser?.username || 'Opponent' };
      const guest = { socketId: socket.id, userId: toUserId, username: toUser.username };
      
      // Randomize White/Black colors for fair Friend Match initiation
      const isHostWhite = Math.random() < 0.5;
      const p1 = isHostWhite ? host : guest;
      const p2 = isHostWhite ? guest : host;
      
      createMatch(io, socket, p2, p1, 'friend', timer);
    });

    socket.on('reject_invite', ({ fromUserId }) => {
      const s = userToSocket.get(fromUserId);
      if (s) io.to(s).emit('invite_rejected');
    });

    // ─── ROOM MATCH ──────────────────────────────────────────
    socket.on('create_room', ({ roomId }) => {
      const userId = socket.userId;
      if (!userId) return;
      socket.join(roomId);
      socket.emit('room_created', { roomId });
    });

    socket.on('join_room', ({ roomId, timer }) => {
      const cleanRoomId = typeof roomId === 'string' ? roomId.trim() : roomId;
      const userId = socket.userId;
      const username = socketToUser.get(socket.id)?.username;
      if (!userId || !username) return;

      const room = io.sockets.adapter.rooms.get(cleanRoomId);
      if (!room) return socket.emit('room_error', { message: 'Room not found.' });
      if (room.size >= 2) return socket.emit('room_error', { message: 'Room is full.' });

      socket.join(cleanRoomId);
      const opponentSocketId = [...room][0];
      const opponentData = socketToUser.get(opponentSocketId);
      if (!opponentData || !opponentData.userId) {
        return socket.emit('room_error', { message: 'Opponent not found or not authenticated.' });
      }
      const p1 = { socketId: opponentSocketId, userId: opponentData.userId, username: opponentData.username };
      const p2 = { socketId: socket.id, userId, username };
      createMatch(io, socket, p2, p1, 'room', timer || 5);
    });

    // ─── CHESS MOVE ──────────────────────────────────────────
    socket.on('make_move', async ({ matchId, move }) => {
        const caller = socketToUser.get(socket.id);
        if (!caller) return;
        processMove(matchId, move, caller.userId, socket);
    });

    async function processMove(matchId, move, userId, socket) {
      const game = activeGames.get(matchId);
      if (!game) return socket.emit('move_error', { message: 'Game not found.' });

      const isP1 = game.player1.userId === userId;
      const myColor = isP1 ? 'w' : 'b';
      if (game.chess.turn() !== myColor) return socket.emit('move_error', { message: 'Not your turn.' });

      let result;
      try { result = game.chess.move(move); }
      catch { return socket.emit('move_error', { message: 'Illegal move.' }); }
      if (!result) return socket.emit('move_error', { message: 'Illegal move.' });

      const moveData = {
        move: result,
        fen: game.chess.fen(),
        turn: game.chess.turn(),
        pgn: game.chess.pgn(),
        fromUserId: userId,
      };


      moveData.white_time = game.player1.time;
      moveData.black_time = game.player2.time;

      io.to(game.player1.socketId).emit('move_made', moveData);
      io.to(game.player2.socketId).emit('move_made', moveData);

      // Dashboard sync
      const dashboardUpdate = {
        matchId,
        white_time: game.player1.time,
        black_time: game.player2.time,
        turn: game.chess.turn()
      };
      if (game.player1.socketId) io.to(game.player1.socketId).emit('active_match_update', dashboardUpdate);
      if (game.player2.socketId) io.to(game.player2.socketId).emit('active_match_update', dashboardUpdate);

      game.moveCount = (game.moveCount || 0) + 1;

      // Timer is already started in createMatch or on first move.
      // We keep it here as a backup for safety, but removing the moveCount === 1 check
      // to ensure it starts if it hasn't already.
      if (!game.interval) {
        startTimer(io, matchId, game);
      }

      // Persist move to Supabase
      try {
        const { data: m } = await supabase.from('matches').select('moves').eq('id', matchId).single();
        const moves = Array.isArray(m?.moves) ? m.moves : [];
        moves.push({ move: result.san, timestamp: new Date().toISOString(), player: userId });
        await supabase.from('matches').update({ moves }).eq('id', matchId);
      } catch {}

      if (game.chess.isGameOver()) await endGame(io, matchId, game);
    }

    // ─── CHAT MSG ────────────────────────────────────────────
    socket.on('chat_msg', ({ matchId, username, message }) => {
      const game = activeGames.get(matchId);
      if (!game) return;
      
      const isP1 = game.player1.socketId === socket.id;
      const targetSocketId = isP1 ? game.player2.socketId : game.player1.socketId;
      
      if (targetSocketId) {
        io.to(targetSocketId).emit('chat_msg', { username, message });
      }
    });

    // ─── RESIGN ──────────────────────────────────────────────
    socket.on('resign', async ({ matchId }) => {
      const caller = socketToUser.get(socket.id);
      if (!caller) return;
      const userId = caller.userId;

      const game = activeGames.get(matchId);
      if (!game) return;
      const isP1 = game.player1.userId === userId;
      const result = isP1 ? 'player2_win' : 'player1_win';
      const winnerId = isP1 ? game.player2.userId : game.player1.userId;
      await endGame(io, matchId, game, result, winnerId, 'resign');
    });

    // ─── DRAW OFFER ──────────────────────────────────────────
    socket.on('offer_draw', ({ matchId }) => {
      const caller = socketToUser.get(socket.id);
      if (!caller) return;
      const userId = caller.userId;

      const game = activeGames.get(matchId);
      if (!game) return;
      const opponentSocket = game.player1.userId === userId ? game.player2.socketId : game.player1.socketId;
      io.to(opponentSocket).emit('draw_offered');
    });

    socket.on('accept_draw', async ({ matchId }) => {
      const game = activeGames.get(matchId);
      if (!game) return;
      await endGame(io, matchId, game, 'draw', null, 'agreement');
    });

    // ─── ANTI-CHEAT ──────────────────────────────────────────
    // cheat_detected listener removed to prevent client-trusted security hole.
    // Server-side analysis will be implemented in future via cron or match logs.

    // ─── CLAN WAR EVENTS ─────────────────────────────────────

    // Join clan war room for live updates
    socket.on('join_clan_war', ({ warId }) => {
      socket.join(`clanwar_${warId}`);
    });

    // Leader/co-leader starts a war match for a specific war match slot
    socket.on('start_clan_war_match', async ({ warMatchId, userId }) => {
      try {
        const { data: warMatch } = await supabase
          .from('clan_war_matches')
          .select('*, war:war_id(*)')
          .eq('id', warMatchId)
          .single();

        if (!warMatch || warMatch.status !== 'pending') return;
        if (warMatch.player1_id !== userId && warMatch.player2_id !== userId) return;

        // Mark as active
        await supabase.from('clan_war_matches').update({ status: 'active', start_time: new Date().toISOString() }).eq('id', warMatchId);

        // Create chess match record — use 'room' type so it doesn't pollute random match history
        const { data: match } = await supabase.from('matches').insert({
          player1_id: warMatch.player1_id,
          player2_id: warMatch.player2_id,
          match_type: 'room',
          timer_type: 5,
          status: 'active',
          start_time: new Date().toISOString(),
        }).select().single();

        if (!match) return;

        await supabase.from('clan_war_matches').update({ match_id: match.id }).eq('id', warMatchId);

        const chess = new Chess();
        const gameState = {
          chess,
          matchId: match.id,
          warMatchId,
          warId: warMatch.war_id,
          player1: { userId: warMatch.player1_id, socketId: userToSocket.get(warMatch.player1_id), time: 5 * 60, disconnects: 0 },
          player2: { userId: warMatch.player2_id, socketId: userToSocket.get(warMatch.player2_id), time: 5 * 60, disconnects: 0 },
          timer_type: 5,
          interval: null,
          moveCount: 0,
          disconnectTimeout: null,
        };
        activeClanWarGames.set(warMatchId, gameState);

        const p1Socket = userToSocket.get(warMatch.player1_id);
        const p2Socket = userToSocket.get(warMatch.player2_id);

        if (p1Socket) io.to(p1Socket).emit('cw_match_found', { warMatchId, matchId: match.id, color: 'white', timer: 5, opponent: { userId: warMatch.player2_id } });
        if (p2Socket) io.to(p2Socket).emit('cw_match_found', { warMatchId, matchId: match.id, color: 'black', timer: 5, opponent: { userId: warMatch.player1_id } });

        // No-show timer: 2 minutes for both to join
        const nsTimer = setTimeout(async () => {
          const game = activeClanWarGames.get(warMatchId);
          if (!game) return;
          const p1Online = userSockets.has(warMatch.player1_id) && userSockets.get(warMatch.player1_id).size > 0;
          const p2Online = userSockets.has(warMatch.player2_id) && userSockets.get(warMatch.player2_id).size > 0;
          if (!p1Online && p2Online) {
            await endClanWarGame(io, warMatchId, game, 'no_show_p1');
          } else if (p1Online && !p2Online) {
            await endClanWarGame(io, warMatchId, game, 'no_show_p2');
          }
          noShowTimers.delete(warMatchId);
        }, 120000);
        noShowTimers.set(warMatchId, nsTimer);

        io.to(`clanwar_${warMatch.war_id}`).emit('cw_match_started', { warMatchId });
      } catch (err) {
        console.error('start_clan_war_match error:', err);
      }
    });

    // Make a move in a clan war game
    socket.on('cw_make_move', async ({ warMatchId, move }) => {
      const caller = socketToUser.get(socket.id);
      if (!caller) return;

      const game = activeClanWarGames.get(warMatchId);
      if (!game) return socket.emit('move_error', { message: 'Game not found.' });

      const isP1 = game.player1.userId === caller.userId;
      const myColor = isP1 ? 'w' : 'b';
      if (game.chess.turn() !== myColor) return socket.emit('move_error', { message: 'Not your turn.' });

      let result;
      try { result = game.chess.move(move); }
      catch { return socket.emit('move_error', { message: 'Illegal move.' }); }
      if (!result) return socket.emit('move_error', { message: 'Illegal move.' });

      const moveData = { move: result, fen: game.chess.fen(), turn: game.chess.turn(), pgn: game.chess.pgn(), fromUserId: caller.userId };
      const p1s = game.player1.socketId;
      const p2s = game.player2.socketId;
      if (p1s) io.to(p1s).emit('cw_move_made', moveData);
      if (p2s) io.to(p2s).emit('cw_move_made', moveData);

      game.moveCount = (game.moveCount || 0) + 1;

      // Clear no-show timer on first move
      if (game.moveCount === 1) {
        const ns = noShowTimers.get(warMatchId);
        if (ns) { clearTimeout(ns); noShowTimers.delete(warMatchId); }
        startClanWarTimer(io, warMatchId, game);
      }

      if (game.chess.isGameOver()) {
        let res = 'draw';
        if (game.chess.isCheckmate()) res = game.chess.turn() === 'w' ? 'player2_win' : 'player1_win';
        await endClanWarGame(io, warMatchId, game, res);
      }
    });

    // Resign from a clan war game
    socket.on('cw_resign', async ({ warMatchId }) => {
      const caller = socketToUser.get(socket.id);
      if (!caller) return;
      const game = activeClanWarGames.get(warMatchId);
      if (!game) return;
      const isP1 = game.player1.userId === caller.userId;
      await endClanWarGame(io, warMatchId, game, isP1 ? 'forfeit_p1' : 'forfeit_p2');
    });

    // Offer draw in clan war game
    socket.on('cw_offer_draw', ({ warMatchId }) => {
      const caller = socketToUser.get(socket.id);
      if (!caller) return;
      const game = activeClanWarGames.get(warMatchId);
      if (!game) return;
      const isP1 = game.player1.userId === caller.userId;
      const oppSocket = isP1 ? game.player2.socketId : game.player1.socketId;
      if (oppSocket) io.to(oppSocket).emit('cw_draw_offered');
    });

    socket.on('cw_accept_draw', async ({ warMatchId }) => {
      const game = activeClanWarGames.get(warMatchId);
      if (!game) return;
      await endClanWarGame(io, warMatchId, game, 'draw');
    });

    // ─── ANTI-CHEAT ──────────────────────────────────────────
    // cheat_detected listener removed to prevent client-trusted security hole.
    // Server-side analysis will be implemented in future via cron or match logs.

    // ─── DISCONNECT ──────────────────────────────────────────
    socket.on('disconnect', async () => {
      onlineCount = Math.max(0, onlineCount - 1);
      const userData = socketToUser.get(socket.id);

      if (userData) {
        const sockets = userSockets.get(userData.userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userData.userId);
            try { await supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', userData.userId); } catch {}
          }
        }

        // Remove from queues
        for (const t of [1, 3, 5, 10]) {
          const i = queues[t].findIndex(p => p.socketId === socket.id);
          if (i !== -1) queues[t].splice(i, 1);
        }
        
        // Remove from tournament queues
        for (const tId in tournamentQueues) {
          const i = tournamentQueues[tId].findIndex(p => p.socketId === socket.id);
          if (i !== -1) tournamentQueues[tId].splice(i, 1);
        }

        // Handle active game disconnect (with a 30-second grace period for page navigation)
        for (const [matchId, game] of activeGames.entries()) {
          if (game.player1.socketId === socket.id || game.player2.socketId === socket.id) {
            const disconnectedIsP1 = game.player1.socketId === socket.id;
            
            // Clear any existing timeout
            if (game.disconnectTimeout) clearTimeout(game.disconnectTimeout);
            
            game.disconnectTimeout = setTimeout(async () => {
              if (!activeGames.has(matchId)) return;
              const result = disconnectedIsP1 ? 'player2_win' : 'player1_win';
              const winnerId = disconnectedIsP1 ? game.player2.userId : game.player1.userId;
              await endGame(io, matchId, game, result, winnerId, 'disconnect');
            }, 120000); // Increased to 2 minutes

            break;
          }
        }

        // Handle clan war game disconnect
        for (const [warMatchId, game] of activeClanWarGames.entries()) {
          if (game.player1.socketId === socket.id || game.player2.socketId === socket.id) {
            const disconnectedIsP1 = game.player1.socketId === socket.id;
            const disconnectedPlayer = disconnectedIsP1 ? game.player1 : game.player2;
            disconnectedPlayer.disconnects = (disconnectedPlayer.disconnects || 0) + 1;

            const oppSocket = disconnectedIsP1 ? game.player2.socketId : game.player1.socketId;
            if (oppSocket) io.to(oppSocket).emit('cw_opponent_disconnected', { reconnectWindow: 120, disconnects: disconnectedPlayer.disconnects });

            // 3rd disconnect = immediate forfeit
            if (disconnectedPlayer.disconnects >= 3) {
              await endClanWarGame(io, warMatchId, game, disconnectedIsP1 ? 'forfeit_p1' : 'forfeit_p2');
              break;
            }

            // 2-minute grace window
            if (game.disconnectTimeout) clearTimeout(game.disconnectTimeout);
            game.disconnectTimeout = setTimeout(async () => {
              if (!activeClanWarGames.has(warMatchId)) return;
              await endClanWarGame(io, warMatchId, game, disconnectedIsP1 ? 'forfeit_p1' : 'forfeit_p2');
            }, 120000);
            break;
          }
        }

        // Handle public room host disconnect
        const RoomManager = require('../services/room.manager');
        for (const [roomId, room] of RoomManager.activeRooms.entries()) {
          if (room.hostId === userData.userId) {
            // Close room after 15s grace period if they don't reconnect
            setTimeout(async () => {
              if (userToSocket.get(userData.userId)) return; // Reconnected
              await RoomManager.closeRoom(roomId, 'HOST_OFFLINE');
            }, 15000);
          }
        }

        socketToUser.delete(socket.id);
        if (!userSockets.has(userData.userId) || userSockets.get(userData.userId).size === 0) {
           userToSocket.delete(userData.userId);
           
           // Notify friends that this user is now offline (only if privacy allows)
           try {
              const { data: profile } = await supabase.from('profiles').select('settings').eq('id', userData.userId).single();
              const settings = profile?.settings || {};
              const showOnline = settings.privacy?.online_status !== false;

              if (showOnline) {
                  const { data: friends } = await supabase.from('friends').select('user_id, friend_id').or(`user_id.eq.${userData.userId},friend_id.eq.${userData.userId}`).eq('status', 'accepted');
                  if (friends) {
                     friends.forEach(f => {
                        const friendId = f.user_id === userData.userId ? f.friend_id : f.user_id;
                        const friendSocket = userToSocket.get(friendId);
                        if (friendSocket) io.to(friendSocket).emit('friend_status_update', { userId: userData.userId, is_online: false });
                     });
                  }
              }
           } catch {}
        }
      }

      // Recalculate unique online users on any disconnection
      // Cleanup from all queues
      for (const tId in tournamentQueues) {
          const idx = tournamentQueues[tId].findIndex(p => p.socketId === socket.id);
          if (idx !== -1) tournamentQueues[tId].splice(idx, 1);
      }

      onlineCount = userSockets.size;
      broadcastLiveInfo(io);
    });
  });

  // ─── CREATE MATCH ─────────────────────────────────────────
  async function createMatch(io, socket, p1_raw, p2_raw, matchType, timer) {
    // Deterministic ID for tournaments to sync across nodes
    let matchId = `match_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    if (matchType === 'tournament' || matchType === 'arena') {
      const sortedIds = [p1_raw.userId, p2_raw.userId].sort();
      matchId = `tr_${p2_raw.tournamentId || p1_raw.tournamentId}_${sortedIds[0]}_${sortedIds[1]}`;
    }
    
    // Randomize who is p1 (white) and p2 (black)
    let p1, p2;
    if (Math.random() > 0.5) {
      p1 = p1_raw; p2 = p2_raw;
    } else {
      p1 = p2_raw; p2 = p1_raw;
    }

    const t = timer || p2.timer || p1.timer || 5;
    console.log(`[Socket] Creating ${matchType} match: ${p1.username} vs ${p2.username} (${t}m)`);
    
    try {
      // Fetch IQs, Ranks, and Avatars for both players
      const { data: profiles } = await supabase.from('profiles').select('id, iq_level, rank, profile_image').in('id', [p1.userId, p2.userId]);
      const profileMap = {};
      if (profiles) profiles.forEach(p => profileMap[p.id] = p);

      const matchData = {
        player1_id: p1.userId,
        player2_id: p2.userId,
        match_type: matchType,
        timer_type: t,
        status: 'active',
        start_time: new Date().toISOString(),
      };
      
      if (matchType === 'tournament' && p2.tournamentId) {
        matchData.tournament_id = p2.tournamentId;
      }
      if (matchType === 'room') {
        matchData.room_id = p1.roomId || p2.roomId;
      }

      // Deterministic ID for Cross-Server Sync
      let match;
      if (matchType === 'tournament' || matchType === 'arena') {
          const sortedIds = [p1.userId, p2.userId].sort();
          const deterministicId = `tr_${p2.tournamentId || p1.tournamentId}_${sortedIds[0]}_${sortedIds[1]}`;
          
          // Check if this match already exists (created by another node)
          const { data: existingMatch } = await supabase.from('matches')
            .select('*')
            .eq('player1_id', p1.userId)
            .eq('player2_id', p2.userId)
            .eq('tournament_id', p2.tournamentId || p1.tournamentId)
            .eq('status', 'active')
            .limit(1)
            .single();

          if (existingMatch) {
              match = existingMatch;
              console.log(`[Socket] 🔗 Re-using existing cross-server match: ${match.id}`);
          } else {
              const { data: newMatch, error } = await supabase.from('matches').insert(matchData).select().single();
              if (error) {
                  // If insert failed because of race condition, try to fetch again
                  const { data: retryMatch } = await supabase.from('matches')
                    .select('*')
                    .eq('player1_id', p1.userId)
                    .eq('player2_id', p2.userId)
                    .eq('tournament_id', p2.tournamentId || p1.tournamentId)
                    .eq('status', 'active')
                    .limit(1)
                    .single();
                  match = retryMatch;
              } else {
                  match = newMatch;
              }
          }
      } else {
          const { data: newMatch } = await supabase.from('matches').insert(matchData).select().single();
          match = newMatch;
      }

      if (!match) { 
        console.error(`❌ Match create error in DB for ${p1.username} vs ${p2.username}`);
        return; 
      }

      console.log(`[Socket] Match synchronized: ${match.id}`);

      let chess;
      try {
        chess = new Chess();
      } catch (chessErr) {
        console.error('Chess constructor error:', chessErr);
        io.to(p1.socketId).emit('match_error', { message: 'Game engine initialization failed' });
        io.to(p2.socketId || socket.id).emit('match_error', { message: 'Game engine initialization failed' });
        return;
      }

      const gameState = {
        chess,
        matchId: match.id,
        match_type: matchType,
        tournamentId: p2.tournamentId || p1.tournamentId || null,
        player1: { 
          userId: p1.userId, username: p1.username, full_name: p1.full_name || p1.username, socketId: p1.socketId, time: t * 60, 
          iq_level: profileMap[p1.userId]?.iq_level || 100, 
          rank: profileMap[p1.userId]?.rank || 'Bronze',
          profile_image: profileMap[p1.userId]?.profile_image
        },
        player2: { 
          userId: p2.userId, username: p2.username, full_name: p2.full_name || p2.username, socketId: p2.socketId || socket.id, time: t * 60, 
          iq_level: profileMap[p2.userId]?.iq_level || 100,
          rank: profileMap[p2.userId]?.rank || 'Bronze',
          profile_image: profileMap[p2.userId]?.profile_image
        },
        timer_type: t,
        interval: null,
        moveCount: 0,
        abortTimeout: null,
        roomId: p1.roomId || p2.roomId || null,
        roomCode: p1.roomCode || p2.roomCode || null,
      };
      activeGames.set(match.id, gameState);

      const eventName = matchType === 'tournament' ? 'match_found_tr' : 'match_found';
      const baseEventData = {
          matchId: match.id,
          timer: t,
          tournamentId: p2.tournamentId || p1.tournamentId,
          roomId: p2.roomId || p1.roomId || null,
          roomCode: p2.roomCode || p1.roomCode || null
      };

      io.to(p1.socketId).emit(eventName, { 
          ...baseEventData,
          color: 'white', 
          opponent: { 
            username: p2.username, 
            full_name: gameState.player2.full_name, 
            userId: p2.userId, 
            iq_level: gameState.player2.iq_level,
            rank: gameState.player2.rank,
            profile_image: gameState.player2.profile_image
          },
          white_time: gameState.player1.time,
          black_time: gameState.player2.time
      });
      io.to(p2.socketId || socket.id).emit(eventName, { 
          ...baseEventData,
          color: 'black', 
          opponent: { 
            username: p1.username, 
            full_name: gameState.player1.full_name, 
            userId: p1.userId, 
            iq_level: gameState.player1.iq_level,
            rank: gameState.player1.rank,
            profile_image: gameState.player1.profile_image
          },
          white_time: gameState.player1.time,
          black_time: gameState.player2.time
      });

      broadcastLiveInfo(io);

      // Start timer immediately for all matches
      // Give players 5 seconds to load the page before clock starts ticking
      // Start match timer after a 10-second grace period to allow UI loading
      setTimeout(() => {
        const g = activeGames.get(match.id);
        if (g && !g.interval) {
          console.log(`[Socket] ⏲️ Starting timer for match ${match.id} after grace period.`);
          startTimer(io, match.id, g);
        }
      }, 10000);
    } catch (err) {
      console.error('createMatch critical error:', err);
      // Fail-safe notification
      io.to(p1.socketId).emit('match_error', { message: 'Critical server error during match creation' });
      io.to(p2.socketId || socket.id).emit('match_error', { message: 'Critical server error during match creation' });
    }
  }

  // ─── TIMER ────────────────────────────────────────────────
  function startTimer(io, matchId, game) {
    game.interval = setInterval(async () => {
      if (!activeGames.has(matchId)) { clearInterval(game.interval); return; }
      const turn = game.chess.turn();
      if (turn === 'w') game.player1.time--;
      else game.player2.time--;

      io.to(game.player1.socketId).emit('timer_update', { white_time: game.player1.time, black_time: game.player2.time });
      io.to(game.player2.socketId).emit('timer_update', { white_time: game.player1.time, black_time: game.player2.time });

      if (game.player1.time <= 0 || game.player2.time <= 0) {
        const result = game.player1.time <= 0 ? 'player2_win' : 'player1_win';
        const winnerId = game.player1.time <= 0 ? game.player2.userId : game.player1.userId;
        await endGame(io, matchId, game, result, winnerId, 'timeout');
      }
    }, 1000);
  }

  // ─── END GAME ─────────────────────────────────────────────
  async function endGame(io, matchId, game, forceResult, forceWinnerId, reason = 'normal') {
    if (!activeGames.has(matchId)) return;
    if (game.interval) clearInterval(game.interval);
    if (game.disconnectTimeout) clearTimeout(game.disconnectTimeout);
    if (game.abortTimeout) clearTimeout(game.abortTimeout);
    
    console.log(`[Socket] 🏁 Ending Match ${matchId} (${game.match_type}). Reason: ${reason}, Forced Winner: ${forceWinnerId}`);
    activeGames.delete(matchId);

    let result = forceResult;
    let winnerId = forceWinnerId;

    if (!result) {
      if (game.chess.isCheckmate()) {
        result = game.chess.turn() === 'w' ? 'player2_win' : 'player1_win';
        winnerId = game.chess.turn() === 'w' ? game.player2.userId : game.player1.userId;
      } else {
        result = 'draw';
        winnerId = null;
      }
    }

    // Process result in DB first to get scores
    const scores = await processMatchResult(matchId, result, winnerId, game.chess.fen());
    
    const endData = { 
      result, 
      winnerId, 
      reason, 
      fen: game.chess.fen(),
      p1_score: scores?.p1_score_change || 0,
      p2_score: scores?.p2_score_change || 0,
      p1_pts: scores?.p1_pts || 0,
      p2_pts: scores?.p2_pts || 0
    };

    if (game.player1.socketId) io.to(game.player1.socketId).emit('game_over', endData);
    if (game.player2.socketId) io.to(game.player2.socketId).emit('game_over', endData);
    
    // --- Tournament Leaderboard Sync ---
    if (game.tournamentId) {
      console.log(`[Socket] Broadcasting tournament_update for TR-${game.tournamentId}`);
      io.to(`tournament_${game.tournamentId}`).emit('tournament_update');
    }

    // --- Public Room Match Cleanup ---
    if (game.match_type === 'room') {
       console.log(`[Socket] Room match ${matchId} ended. RoomID from game state: ${game.roomId}`);
       const rId = game.roomId;
       if (rId) {
          console.log(`[Socket] Triggering cleanup for room ${rId}, guest ${game.player1.userId}`);
          const RoomManager = require('../services/room.manager');
          RoomManager.handleMatchEnd(rId, game.player1.userId);
       } else {
          // Fallback to DB fetch if state is somehow missing it
          const { data: mData } = await supabase.from('matches').select('room_id').eq('id', matchId).single();
          if (mData?.room_id) {
             const RoomManager = require('../services/room.manager');
             RoomManager.handleMatchEnd(mData.room_id, game.player1.userId);
          } else {
             console.warn('[Socket] Critical: No room_id found for cleanup in state OR DB');
          }
       }
    }

    broadcastLiveInfo(io);
  }

  function broadcastLiveInfo(io) {
    io.emit('live_info', { online_users: userSockets.size, active_matches: activeGames.size });
  }

  // ─── CLAN WAR TIMER ──────────────────────────────────────
  function startClanWarTimer(io, warMatchId, game) {
    game.interval = setInterval(async () => {
      if (!activeClanWarGames.has(warMatchId)) { clearInterval(game.interval); return; }
      const turn = game.chess.turn();
      if (turn === 'w') game.player1.time--;
      else game.player2.time--;

      const p1s = game.player1.socketId;
      const p2s = game.player2.socketId;
      if (p1s) io.to(p1s).emit('cw_timer_update', { white_time: game.player1.time, black_time: game.player2.time });
      if (p2s) io.to(p2s).emit('cw_timer_update', { white_time: game.player1.time, black_time: game.player2.time });

      if (game.player1.time <= 0 || game.player2.time <= 0) {
        const result = game.player1.time <= 0 ? 'forfeit_p1' : 'forfeit_p2';
        await endClanWarGame(io, warMatchId, game, result);
      }
    }, 1000);
  }

  // ─── END CLAN WAR GAME ───────────────────────────────────
  async function endClanWarGame(io, warMatchId, game, result) {
    if (!activeClanWarGames.has(warMatchId)) return;
    if (game.interval) clearInterval(game.interval);
    if (game.disconnectTimeout) clearTimeout(game.disconnectTimeout);
    const ns = noShowTimers.get(warMatchId);
    if (ns) { clearTimeout(ns); noShowTimers.delete(warMatchId); }
    activeClanWarGames.delete(warMatchId);

    const endData = { result, moveCount: game.moveCount, fen: game.chess.fen() };
    const p1s = game.player1.socketId;
    const p2s = game.player2.socketId;
    if (p1s) io.to(p1s).emit('cw_game_over', endData);
    if (p2s) io.to(p2s).emit('cw_game_over', endData);

    // Broadcast updated war state to war room
    io.to(`clanwar_${game.warId}`).emit('cw_match_finished', { warMatchId, result });

    // Process result in DB
    await processWarMatchResult(warMatchId, result, game.moveCount, 'normal');
    broadcastLiveInfo(io);
  }
};

module.exports.userToSocket = userToSocket;
module.exports.socketToUser = socketToUser;
module.exports.activeGames = activeGames;
module.exports.userSockets = userSockets;
