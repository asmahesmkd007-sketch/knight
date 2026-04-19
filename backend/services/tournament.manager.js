const { supabase } = require('../config/supabase');
const { Chess } = require('chess.js');
const { processMatchResult } = require('../controllers/game.controller');

// State map: tournamentId -> tournamentState
const activeTourneys = new Map();
// Exported so socket.js can interact with active matches
const activeTournamentMatches = new Map(); 

class TournamentManager {
    static init(io, userToSocket) {
        this.io = io;
<<<<<<< HEAD
        this.userToSocket = userToSocket;
        // Check every second for advancing timers and states inside activeTourneys
=======
        // Check every second for advancing timers and states
>>>>>>> 726a883 (feat: upgrade paid tournament to 1-min knockout with automated lifecycle and prize distribution)
        setInterval(() => this.tick(), 1000);
        // Poll for tournaments transitioning states in DB
        setInterval(() => this.pollTournaments(), 5000);
    }

    static async pollTournaments() {
        try {
            // Pick up tournaments that are 'full' or 'live' but not in memory
            const { data: tourneys } = await supabase.from('tournaments')
                .select('*')
                .eq('type', 'paid')
<<<<<<< HEAD
                .in('status', ['full', 'live', 'starting', 'playing', 'rest']);
=======
                .in('phase', ['full', 'live', 'starting', 'round_1', 'round_2', 'round_3', 'final']);
>>>>>>> 726a883 (feat: upgrade paid tournament to 1-min knockout with automated lifecycle and prize distribution)
            
            if (!tourneys) return;

            for (const t of tourneys) {
                if (!activeTourneys.has(t.id)) {
                    // Load players
                    const { data: players } = await supabase.from('tournament_players')
                        .select('*, profiles(username, rank)')
                        .eq('tournament_id', t.id);
                    
                    const playersData = (players || []).map(p => ({
                         user_id: p.user_id,
                         username: p.profiles?.username || 'Unknown',
                         rank: p.profiles?.rank || 'Bronze',
                         socketId: null,
                         status: p.status // 'active' or 'eliminated'
                    }));

<<<<<<< HEAD
                    await this.startLiveTournament(t.id, playersData, t);
                    console.log(`🚀 TournamentManager picked up and RECOVERED Live TR: ${t.id} (${playersData.length} players)`);
=======
                    this.initializeActiveTournament(t.id, playersData, t);
                    console.log(`🚀 TournamentManager picked up TR: ${t.id} (${t.phase})`);
>>>>>>> 726a883 (feat: upgrade paid tournament to 1-min knockout with automated lifecycle and prize distribution)
                }
            }
        } catch(e) {
            console.error('pollTournaments err:', e);
        }
    }

<<<<<<< HEAD
    static async startLiveTournament(tournamentId, playersData, tData) {
        // format configuration
        const tState = {
            id: tournamentId,
            tr_id: tData.tr_id,
            status: tData.status.toLowerCase(),
            players: [...playersData], 
            round: tData.round || 1,
            matches: [], 
            timer: tData.timer_type || 1,
            max: tData.max_players || 16,
            countdown: 2 * 60,
            prize_first: tData.prize_first || 0,
            prize_second: tData.prize_second || 0,
            prize_third: tData.prize_third || 0
=======
    static initializeActiveTournament(tournamentId, playersData, tData) {
        const tState = {
            id: tournamentId,
            players: playersData.filter(p => p.status === 'active'),
            allPlayers: playersData,
            max: tData.max_players,
            timer: tData.timer_type,
            status: tData.phase, // 'full', 'live', 'starting', 'round_1', etc.
            countdown: 0,
            round: 0,
            matches: [],
            prize_pool: tData.prize_pool || 0
>>>>>>> 726a883 (feat: upgrade paid tournament to 1-min knockout with automated lifecycle and prize distribution)
        };

        // Initialize countdowns based on pickup phase
        if (tState.status === 'full') {
            tState.countdown = 2 * 60; // 2 min to LIVE
        } else if (tState.status === 'live') {
            tState.countdown = 5 * 60; // 5 min to STARTING
        }

        // If it's already playing, recover matches from DB
        if (['starting', 'playing', 'rest'].includes(tState.status)) {
            const { data: dbMatches } = await supabase.from('matches')
                .select('*')
                .eq('tournament_id', tournamentId)
                .eq('round', tState.round);
            
            if (dbMatches) {
                tState.matches = dbMatches.map(m => ({
                    id: m.id,
                    roomId: `tr_${m.id}`,
                    round: m.round,
                    player1: { userId: m.white_id, username: 'Player', time: tState.timer * 60 },
                    player2: { userId: m.black_id, username: 'Player', time: tState.timer * 60 },
                    status: m.status,
                    winnerId: m.winner_id,
                    fen: m.fen || 'start'
                }));
            }
        }

        activeTourneys.set(tournamentId, tState);
        this.broadcastState(tournamentId);
    }

    static tick() {
        activeTourneys.forEach((tState, tId) => {
<<<<<<< HEAD
            if (tState.status === 'FULL') {
                tState.countdown--;
                if (tState.countdown <= 0) {
                    tState.status = 'LIVE';
                    tState.countdown = 2 * 60; // 2 minutes countdown in LIVE state
                    // Update DB to live and set new start_time for the next transition
                    const nextStartTime = new Date(Date.now() + 2 * 60000).toISOString();
                    supabase.from('tournaments').update({ status: 'live', start_time: nextStartTime }).eq('id', tId).then();
                    this.io.to(`tournament_${tId}`).emit('tournament_msg', { message: 'Tournament LIVE – Get Ready!' });
                }
                this.broadcastState(tId);
            }
            else if (tState.status === 'LIVE') {
                tState.countdown--;
                if (tState.countdown <= 0) {
                    tState.status = 'STARTING';
                    // Update DB to starting
                    supabase.from('tournaments').update({ status: 'starting' }).eq('id', tId).then();
                    this.transitionInitialRound(tState);
                }
                this.broadcastState(tId);
            }
            else if (tState.status === 'STARTING') {
                // Short delay or transition to ROUND_1 immediately
                tState.status = 'playing';
                tState.round = 1;
                this.createRoundMatches(tState).catch(console.error);
            }
            else if (tState.status === 'playing') {
                const allDone = tState.matches.every(m => m.status === 'finished');
                if (allDone) {
                    tState.status = 'rest';
                    tState.countdown = 15; // 15 seconds rest between rounds
                    this.processKnockoutResults(tState);
                    this.broadcastState(tId);
                }
            }
            else if (tState.status === 'rest') {
=======
            // 1. Lifecycle Management
            if (tState.status === 'full') {
                tState.countdown--;
                if (tState.countdown <= 0) {
                    this.transitionToLive(tState);
                }
            } 
            else if (tState.status === 'live') {
>>>>>>> 726a883 (feat: upgrade paid tournament to 1-min knockout with automated lifecycle and prize distribution)
                tState.countdown--;
                if (tState.countdown <= 0) {
                    this.transitionToStarting(tState);
                }
            }
            else if (tState.status === 'starting') {
                // Wait for players to freeze and matches to generate
                this.transitionToRound(tState, 1);
            }
            else if (tState.status.startsWith('round_') || tState.status === 'final') {
                // Check if all matches in current round are finished
                const allDone = tState.matches.every(m => m.status === 'finished');
                if (allDone && tState.matches.length > 0) {
                    this.processRoundEnd(tState);
                }
            }
            else if (tState.status === 'rest') {
                tState.countdown--;
                if (tState.countdown <= 0) {
                    const nextRound = tState.round + 1;
                    if (tState.players.length <= 1) {
                        this.finishTournament(tId, tState);
                    } else {
<<<<<<< HEAD
                        tState.round++;
                        tState.status = 'playing';
                        this.createRoundMatches(tState).catch(console.error);
=======
                        this.transitionToRound(tState, nextRound);
>>>>>>> 726a883 (feat: upgrade paid tournament to 1-min knockout with automated lifecycle and prize distribution)
                    }
                }
            }

            // Broadcast every 5s or when close to transition
            if (tState.countdown % 5 === 0 || tState.countdown <= 10) {
                this.broadcastState(tId);
            }
        });

        // 2. Active Match Timers (Server-Authoritative)
        activeTournamentMatches.forEach((match, matchId) => {
            if (match.status !== 'playing') return;

            if (match.turn === 'w') match.player1.time--;
            else match.player2.time--;

            // Sync timers every 5s or when low
            if (match.player1.time % 5 === 0 || match.player1.time <= 10 || match.player2.time <= 10) {
                this.io.to(match.roomId).emit('timer_update', { 
                    white_time: Math.max(0, match.player1.time), 
                    black_time: Math.max(0, match.player2.time) 
                });
            }

            if (match.player1.time <= 0 || match.player2.time <= 0) {
                 const result = match.player1.time <= 0 ? 'player2_win' : 'player1_win';
                 const winnerId = match.player1.time <= 0 ? match.player2.userId : match.player1.userId;
                 this.resolveMatch(matchId, result, winnerId, 'timeout');
            }
        });
    }

    static async transitionToLive(tState) {
        tState.status = 'live';
        tState.countdown = 5 * 60; // 5 minutes to STARTING
        await supabase.from('tournaments').update({ status: 'live', phase: 'live' }).eq('id', tState.id);
        this.io.to(`tournament_${tState.id}`).emit('tournament_msg', { message: 'Tournament is now LIVE! Starting in 5 minutes.' });
        this.broadcastState(tState.id);
    }

    static async transitionToStarting(tState) {
        tState.status = 'starting';
        await supabase.from('tournaments').update({ phase: 'starting' }).eq('id', tState.id);
        this.broadcastState(tState.id);
    }

<<<<<<< HEAD
    static processKnockoutResults(tState) {
        // Everyone who lost the match is eliminated
        const advanced = [];
        const eliminated = [];
        tState.matches.forEach(m => {
            if (m.winnerId) {
                // Find winner and add to advanced
                const winner = tState.players.find(p => p.user_id === m.winnerId);
                if (winner) advanced.push(winner);
                
                const loserId = m.player1.userId === m.winnerId ? m.player2.userId : m.player1.userId;
                const loser = tState.players.find(p => p.user_id === loserId);
                if (loser) eliminated.push(loser);
            } else {
                // If draw or abandon in knockout, randomly pick a winner or tiebreak (Random tiebreak for now)
                const rmdPlayer = Math.random() > 0.5 ? m.player1.userId : m.player2.userId;
                const winner = tState.players.find(p => p.user_id === rmdPlayer);
                if (winner) advanced.push(winner);
                const loser = tState.players.find(p => p.user_id !== rmdPlayer && (p.user_id === m.player1.userId || p.user_id === m.player2.userId));
                if (loser) eliminated.push(loser);
            }
        });

        eliminated.forEach(p => { 
            p.status = 'eliminated'; 
            this.notifyEliminated(p, tState); 
        });

        // Increment score for winners to reflect their progress on the leaderboard
        advanced.forEach(p => {
            p.score = (p.score || 0) + 1;
            // Update score in DB too
            supabase.from('tournament_players')
                .update({ score: p.score })
                .eq('tournament_id', tState.id)
                .eq('user_id', p.user_id)
                .then()
                .catch(err => console.error('Failed to update score in DB:', err));
        });
        
        // Wait, what if someone had a bye (no opponent)?
        const advancedIds = new Set(advanced.map(p => p.user_id));
        tState.players.forEach(p => {
             const played = tState.matches.some(m => m.player1.userId === p.user_id || m.player2.userId === p.user_id);
             if (!played && !advancedIds.has(p.user_id)) {
                 advanced.push(p); // Byes advance automatically
                 advancedIds.add(p.user_id);
             }
        });

        tState.players = advanced;
    }

    static async createRoundMatches(tState) {
        tState.status = 'playing';
        tState.matches = [];
        
        // Update DB end_time when starting rounds (assuming 4 rounds * 2 mins each = 8 mins total wait + play)
        const endTime = new Date(Date.now() + 15 * 60000).toISOString();
        supabase.from('tournaments').update({ end_time: endTime }).eq('id', tState.id).then();

        // Random pairing
=======
    static async transitionToRound(tState, roundNum) {
        tState.round = roundNum;
        tState.status = roundNum === 4 ? 'final' : `round_${roundNum}`;
        tState.matches = [];
        
        await supabase.from('tournaments').update({ phase: tState.status }).eq('id', tState.id);

        // Fresh Shuffle Each Round
>>>>>>> 726a883 (feat: upgrade paid tournament to 1-min knockout with automated lifecycle and prize distribution)
        const pool = [...tState.players];
        pool.sort(() => 0.5 - Math.random());

        while (pool.length >= 2) {
            const p1 = pool.pop();
            const p2 = pool.pop();
            await this.setupMatch(p1, p2, tState);
        }

        // Handle bye
        if (pool.length === 1) {
            const pBye = pool.pop();
            this.io.to(`tournament_${tState.id}`).emit('tournament_msg', { message: `${pBye.username} gets a BYE this round!` });
        }
        
        this.broadcastState(tState.id);
    }

    static async setupMatch(p1, p2, tState) {
        const { data: dbMatch, error } = await supabase.from('matches').insert({
            player1_id: p1.user_id,
            player2_id: p2.user_id,
            match_type: 'tournament',
            timer_type: tState.timer,
            tournament_id: tState.id,
            round: tState.round,
            status: 'active',
            start_time: new Date().toISOString()
        }).select().single();

        if (error || !dbMatch) return;

        const matchId = `tr_${tState.id}_${p1.user_id.slice(0, 4)}_${p2.user_id.slice(0, 4)}`;
        const roomId = `match_${matchId}`;
        const sid1 = this.userToSocket.get(p1.user_id);
        const sid2 = this.userToSocket.get(p2.user_id);
        
        const match = {
            id: matchId,
            roomId,
            round: tState.round,
            chess: new Chess(),
            turn: 'w',
<<<<<<< HEAD
            player1: { userId: p1.user_id, username: p1.username, time: tState.timer * 60, socketId: sid1 },
            player2: { userId: p2.user_id, username: p2.username, time: tState.timer * 60, socketId: sid2 },
            status: 'playing',
=======
            player1: { userId: p1.user_id, time: tState.timer * 60, socketId: p1.socketId, username: p1.username },
            player2: { userId: p2.user_id, time: tState.timer * 60, socketId: p2.socketId, username: p2.username },
>>>>>>> 726a883 (feat: upgrade paid tournament to 1-min knockout with automated lifecycle and prize distribution)
            winnerId: null
        };

        tState.matches.push(match);
        activeTournamentMatches.set(matchId, match);

<<<<<<< HEAD
        // [LOG] MATCH STARTED
        console.log(`[DEBUG] MATCH STARTED: ${matchId} | ${p1.username} vs ${p2.username}`);

        if (sid1) {
            const s1 = this.io.sockets.sockets.get(sid1);
            if (s1) { 
                s1.join(roomId); 
                s1.join(`tournament_${tState.id}`);
                console.log(`[DEBUG] PLAYER JOINED ROOM: ${p1.username} -> ${roomId}`);
            }
        }
        if (sid2) {
            const s2 = this.io.sockets.sockets.get(sid2);
            if (s2) { 
                s2.join(roomId); 
                s2.join(`tournament_${tState.id}`);
                console.log(`[DEBUG] PLAYER JOINED ROOM: ${p2.username} -> ${roomId}`);
            }
        }

        // [LOG] ROOM USERS COUNT
        const room = this.io.sockets.adapter.rooms.get(roomId);
        console.log(`[DEBUG] ROOM USERS COUNT for ${roomId}: ${room ? room.size : 0}`);

        const eventData = { 
            matchId, 
            roomId, 
            duration: tState.timer * 60, 
            round: tState.round,
            player1: { userId: p1.user_id, username: p1.username },
            player2: { userId: p2.user_id, username: p2.username }
        };

        // Emit match_start as requested
        if (sid1) {
            this.io.to(sid1).emit('match_start', { ...eventData, color: 'white', opponent: p2 });
        }
        if (sid2) {
            this.io.to(sid2).emit('match_start', { ...eventData, color: 'black', opponent: p1 });
        }
=======
        // Notify players
        this.io.to(`user_${p1.user_id}`).emit('match_found_tr', { 
            matchId, roomId, color: 'white', opponent: p2, duration: tState.timer * 60, round: tState.round 
        });
        this.io.to(`user_${p2.user_id}`).emit('match_found_tr', { 
            matchId, roomId, color: 'black', opponent: p1, duration: tState.timer * 60, round: tState.round 
        });
    }

    static processRoundEnd(tState) {
        const advanced = [];
        const eliminated = [];

        tState.matches.forEach(m => {
            const winnerId = m.winnerId;
            const loserId = m.player1.userId === winnerId ? m.player2.userId : m.player1.userId;
            
            const winner = tState.players.find(p => p.user_id === winnerId);
            const loser = tState.players.find(p => p.user_id === loserId);

            if (winner) advanced.push(winner);
            if (loser) {
                loser.status = 'eliminated';
                eliminated.push(loser);
            }
        });

        // Add byes to advanced
        tState.players.forEach(p => {
            const played = tState.matches.some(m => m.player1.userId === p.user_id || m.player2.userId === p.user_id);
            if (!played && p.status === 'active') {
                advanced.push(p);
            }
        });

        // Update DB statuses
        eliminated.forEach(async p => {
            await supabase.from('tournament_players').update({ status: 'eliminated' }).eq('tournament_id', tState.id).eq('user_id', p.user_id);
            this.io.to(`user_${p.user_id}`).emit('tournament_eliminated', { message: 'Eliminated from tournament.' });
        });

        tState.players = advanced;
        tState.status = 'rest';
        tState.countdown = 15; // 15s Round Gap
        this.broadcastState(tState.id);
>>>>>>> 726a883 (feat: upgrade paid tournament to 1-min knockout with automated lifecycle and prize distribution)
    }

    static handleMove(userId, matchId, moveSan) {
        const match = activeTournamentMatches.get(matchId);
        if (!match || match.status !== 'playing') return false;

        const isP1 = match.player1.userId === userId;
        const reqTurn = isP1 ? 'w' : 'b';
        if (match.turn !== reqTurn) return false;

        try {
            const moveData = match.chess.move(moveSan);
            if (!moveData) return false;

            match.turn = match.chess.turn();
            this.io.to(match.roomId).emit('move_made', { 
                move: moveData, 
                fen: match.chess.fen(), 
                turn: match.turn,
                white_time: match.player1.time,
                black_time: match.player2.time
            });

            if (match.chess.isGameOver()) {
                let result = 'draw';
                let winnerId = null;
                if (match.chess.isCheckmate()) {
                    result = reqTurn === 'w' ? 'player1_win' : 'player2_win';
                    winnerId = userId;
                }
                this.resolveMatch(matchId, result, winnerId, 'board');
            }
            return true;
        } catch(e) { return false; }
    }

    static resolveMatch(matchId, result, winnerId, reason) {
        const match = activeTournamentMatches.get(matchId);
        if (!match || match.status === 'finished') return;

        match.status = 'finished';
        match.winnerId = winnerId;
        
        this.io.to(match.roomId).emit('game_over', { result, winnerId, reason, fen: match.chess.fen() });
        processMatchResult(matchId, result, winnerId, match.chess.fen()).catch(()=>{});
        activeTournamentMatches.delete(matchId);
    }

    static async finishTournament(tId, tState) {
        tState.status = 'completed';
        await supabase.from('tournaments').update({ status: 'completed', phase: 'completed' }).eq('id', tId);
        
        const winner = tState.players[0];
        if (winner) {
            console.log(`🏆 Tournament ${tId} Won by ${winner.user_id}!`);
            const { data: tData } = await supabase.from('tournaments').select('*').eq('id', tId).single();
            if (tData) {
                const { distributeTournamentPrizes } = require('../controllers/tournament.controller');
                await distributeTournamentPrizes(tData);

                // Save Leaderboard for historical tracking
                const { data: finalPlayers } = await supabase.from('tournament_players')
                    .select('user_id, score')
                    .eq('tournament_id', tId)
                    .order('score', { ascending: false })
                    .limit(3);
                
                if (finalPlayers) {
                    const prizes = [tData.prize_first, tData.prize_second, tData.prize_third];
                    for (let i = 0; i < finalPlayers.length; i++) {
                        await supabase.from('tournament_leaderboard').upsert({
                            tournament_id: tId,
                            user_id: finalPlayers[i].user_id,
                            rank: i + 1,
                            prize: prizes[i] || 0
                        });
                    }
                }
            }
        }
        this.broadcastState(tId);
        activeTourneys.delete(tId);
    }

    static broadcastState(tId) {
        const tState = activeTourneys.get(tId);
        if (!tState) return;
        
        const syncMatches = tState.matches.map(m => ({
            id: m.id,
            round: m.round,
            player1: { userId: m.player1.userId, username: m.player1.username },
            player2: { userId: m.player2.userId, username: m.player2.username },
            winnerId: m.winnerId,
            status: m.status
        }));

        this.io.to(`tournament_${tId}`).emit(`tournament_sync_${tId}`, {
             status: tState.status,
             countdown: Math.max(0, tState.countdown),
             round: tState.round,
             players_alive: tState.players.length,
             matches: syncMatches,
             players: tState.players.map(p => ({ user_id: p.user_id, username: p.username, score: p.score }))
        });
    }

<<<<<<< HEAD
    static notifyEliminated(player, tState) {
        // Use the userToSocket mapping passed during init
        const sid = this.userToSocket ? this.userToSocket.get(player.user_id) : null;
        if (!sid) return;
        
        try {
            this.io.to(sid).emit('tournament_eliminated', {
                message: 'You have been eliminated.'
            });
        } catch (e) {
            console.error('Failed to emit elimination:', e);
        }
    }

    static rejoinMatch(socket, matchId, userId) {
        const match = activeTournamentMatches.get(matchId);
        if (!match) return;

        const roomId = `match_${matchId}`;
        socket.join(roomId);

        // Send current state
        const isWhite = match.player1.userId === userId;
        socket.emit('match_sync', {
            matchId: match.id,
            fen: match.chess.fen(),
            color: isWhite ? 'white' : 'black',
            opponent: isWhite ? match.player2 : match.player1,
            white_time: match.player1.time,
            black_time: match.player2.time,
            status: match.status
=======
    static rejoinMatch(socket, matchId, userId) {
        const match = activeTournamentMatches.get(matchId);
        if (!match) return false;
        
        if (match.player1.userId === userId) { match.player1.socketId = socket.id; }
        else if (match.player2.userId === userId) { match.player2.socketId = socket.id; }
        else return false;

        socket.join(match.roomId);
        socket.emit('match_rejoined', { 
            roomId: match.roomId,
            fen: match.chess.fen(), 
            turn: match.turn,
            white_time: match.player1.time,
            black_time: match.player2.time,
            color: match.player1.userId === userId ? 'white' : 'black',
            opponent: match.player1.userId === userId ? { user_id: match.player2.userId, username: match.player2.username } : { user_id: match.player1.userId, username: match.player1.username }
>>>>>>> 726a883 (feat: upgrade paid tournament to 1-min knockout with automated lifecycle and prize distribution)
        });
        
        console.log(`[DEBUG] REJOINED: User ${userId} recovered match ${matchId}`);
    }
}

module.exports = TournamentManager;
