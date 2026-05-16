const { supabase } = require('../config/supabase');

const getMatchHistory = async (req, res) => {
  try {
    const { filter, category = 'all', page = 1, limit = 20 } = req.query;
    
    let tournamentIds = null;
    if (category === 'free_tr' || category === 'paid_tr') {
      const type = category === 'free_tr' ? 'free' : 'paid';
      const { data: tData } = await supabase.from('tournaments').select('id').eq('type', type);
      tournamentIds = (tData || []).map(t => t.id);
      if (tournamentIds.length === 0) return res.json({ success: true, matches: [], total: 0, pages: 0 });
    }

    let query = supabase
      .from('matches')
      .select('*, p1:player1_id(id, username, full_name, profile_image, iq_level, rank), p2:player2_id(id, username, full_name, profile_image, iq_level, rank)', { count: 'exact' })
      .or(`player1_id.eq.${req.user.id},player2_id.eq.${req.user.id}`)
      .eq('status', 'finished');

    // Category Filtering
    if (category === 'free_tr' || category === 'paid_tr') {
        query = query.eq('match_type', 'tournament').in('tournament_id', tournamentIds);
    } else if (category === 'random_rooms') {
        query = query.in('match_type', ['random', 'room']);
    }

    // Result Filtering
    if (filter === 'wins') query = query.eq('winner_id', req.user.id);
    else if (filter === 'draws') query = query.eq('result', 'draw');
    else if (filter === 'losses') query = query.neq('result', 'draw').neq('winner_id', req.user.id).not('winner_id', 'is', null).or(`player1_id.eq.${req.user.id},player2_id.eq.${req.user.id}`);

    query = query.order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    const { data, count } = await query;

    // Fetch tournament details for tournament matches
    const matches = data || [];
    const tIds = [...new Set(matches.filter(m => m.tournament_id).map(m => m.tournament_id))];
    let tournamentDetails = {};
    if (tIds.length > 0) {
      const { data: tData } = await supabase.from('tournaments').select('id, type, display_id').in('id', tIds);
      (tData || []).forEach(t => tournamentDetails[t.id] = t);
    }

    const finalMatches = matches.map(m => ({
      ...m,
      player1_id: m.p1,
      player2_id: m.p2,
      tournament: m.tournament_id ? tournamentDetails[m.tournament_id] : null,
      p1: undefined, p2: undefined,
    }));

    res.json({ success: true, matches: finalMatches, total: count, pages: Math.ceil((count || 0) / limit) });
  } catch (err) {
    console.error('getMatchHistory error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getLeaderboard = async (req, res) => {
  try {
    const { page = 1, limit = 50, sort = 'iq' } = req.query;
    
    let query = supabase
      .from('profiles')
      .select('id, username, full_name, profile_image, iq_level, rank, total_matches, wins, win_rate, player_id, trophy_gold, trophy_silver, trophy_bronze', { count: 'exact' })
      .eq('status', 'active');

    if (sort === 'trophies') {
        // Since we can't easily sum columns in a sort in basic Supabase query, 
        // we'll sort by gold first, then silver, then bronze.
        query = query.order('trophy_gold', { ascending: false })
                     .order('trophy_silver', { ascending: false })
                     .order('trophy_bronze', { ascending: false });
    } else {
        query = query.order('iq_level', { ascending: false })
                     .order('wins', { ascending: false });
    }

    const { data, count } = await query.range((page - 1) * limit, page * limit - 1);

    const leaderboard = (data || []).map((u, i) => ({
      rank: (page - 1) * limit + i + 1,
      user_id: u.id,
      username: u.username,
      full_name: u.full_name,
      profile_image: u.profile_image,
      iq_level: u.iq_level,
      rank_badge: u.rank,
      wins: u.wins,
      total_matches: u.total_matches,
      win_rate: u.win_rate,
      player_id: u.player_id,
      trophies: {
        gold: u.trophy_gold || 0,
        silver: u.trophy_silver || 0,
        bronze: u.trophy_bronze || 0,
        total: (u.trophy_gold || 0) + (u.trophy_silver || 0) + (u.trophy_bronze || 0)
      }
    }));

    res.json({ success: true, leaderboard, total: count, pages: Math.ceil((count || 0) / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getMatchById = async (req, res) => {
  try {
    const { data: match } = await supabase
      .from('matches')
      .select('*, p1:player1_id(id, username, full_name, profile_image, iq_level, rank), p2:player2_id(id, username, full_name, profile_image, iq_level, rank)')
      .eq('id', req.params.id)
      .single();
    if (!match) return res.status(404).json({ success: false, message: 'Match not found.' });
    res.json({ success: true, match });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// Called by socket after game ends
const processMatchResult = async (matchId, result, winnerId, finalFen = null) => {
  try {
    const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (!match || match.status === 'finished') return;

    const IQ_WIN = 9, IQ_LOSS = -5, IQ_DRAW = 3;
    const p1Win = result === 'player1_win';
    const p2Win = result === 'player2_win';
    const isDraw = result === 'draw';
    const iq1 = p1Win ? IQ_WIN : isDraw ? IQ_DRAW : IQ_LOSS;
    const iq2 = p2Win ? IQ_WIN : isDraw ? IQ_DRAW : IQ_LOSS;

    // Update match
    const { error: matchErr } = await supabase.from('matches').update({
      result, winner_id: winnerId || null, status: 'finished',
      iq_change_p1: iq1, iq_change_p2: iq2, end_time: new Date().toISOString(),
      fen: finalFen
    }).eq('id', matchId);
    
    if (matchErr) console.error('Match Update Error:', matchErr);

    // Update player stats ATOMICALLY using RPC
    const updatePlayer = async (userId, won, lost, drew, iqChange) => {
      const { error } = await supabase.rpc('process_match_result_atomic', {
        p_user_id: userId,
        p_iq_change: iqChange,
        p_won: won,
        p_lost: lost,
        p_drew: drew
      });
      if (error) console.error(`❌ Stats RPC Error for ${userId}:`, error);
    };

    if (match.match_type === 'bot') {
        console.log(`🤖 Bot match finished: ${matchId}. Skipping stats update.`);
        return match;
    }

    if (match.player1_id) await updatePlayer(match.player1_id, p1Win, p2Win, isDraw, iq1);
    if (match.player2_id) await updatePlayer(match.player2_id, p2Win, p1Win, isDraw, iq2);

    // Update tournament player scores if tournament match
    if (match.tournament_id) {
       const { data: tData } = await supabase.from('tournaments').select('*').eq('id', match.tournament_id).single();
       const isFree = tData?.type === 'free';
       
       if (isFree) {
           // FREE TR SPECIFIC RULES
           // 1. Point System: Pawn=1, Knight/Bishop=3, Rook=5, Queen=9
           const calculatePoints = (fen, side) => {
               if (!fen) return 0;
               const values = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0 };
               const target = side === 'w' ? 'PNBRQ' : 'pnbrq';
               let pts = 0;
               const board = fen.split(' ')[0];
               for (const char of board) {
                   if (target.includes(char)) pts += values[char.toLowerCase()] || 0;
               }
               return pts;
           };

           const p1Pts = calculatePoints(finalFen, 'w');
           const p2Pts = calculatePoints(finalFen, 'b');

           // 2. Win Logic: Checkmate > Points
           let winnerId = null;
           let result = 'draw';
           
           if (finalFen) {
               const chess = new Chess(finalFen);
               if (chess.in_checkmate()) {
                   // Checkmate wins
                   winnerId = chess.turn() === 'w' ? match.player2_id : match.player1_id;
                   result = winnerId === match.player1_id ? 'player1_win' : 'player2_win';
               } else if (chess.in_draw() || chess.in_stalemate() || chess.in_threefold_repetition() || chess.insufficient_material()) {
                   result = 'draw';
               } else {
                   // Point based win
                   if (p1Pts > p2Pts) { result = 'player1_win'; winnerId = match.player1_id; }
                   else if (p2Pts > p1Pts) { result = 'player2_win'; winnerId = match.player2_id; }
                   else result = 'draw';
               }
           }

           // 3. Update Match Result with NO IQ CHANGE
           await supabase.from('matches').update({
               result, winner_id: winnerId, status: 'finished',
               iq_change_p1: 0, iq_change_p2: 0, 
               end_time: new Date().toISOString(),
               fen: finalFen
           }).eq('id', matchId);

           // 4. Update Tournament Score
           const scoreChange1 = result === 'player1_win' ? 20 : (result === 'draw' ? 10 : 5);
           const scoreChange2 = result === 'player2_win' ? 20 : (result === 'draw' ? 10 : 5);

           const updateTourneyPlayer = async (uid, change, won, drew) => {
             await supabase.rpc('increment_tournament_score', {
               p_tournament_id: match.tournament_id,
               p_user_id: uid,
               p_score: Number(change),
               p_won: Number(won),
               p_drew: Number(drew),
               p_round: 1
             });
           };

           if (match.player1_id) await updateTourneyPlayer(match.player1_id, scoreChange1, result === 'player1_win' ? 1 : 0, result === 'draw' ? 1 : 0);
           if (match.player2_id) await updateTourneyPlayer(match.player2_id, scoreChange2, result === 'player2_win' ? 1 : 0, result === 'draw' ? 1 : 0);

           return { match, p1_score_change: scoreChange1, p2_score_change: scoreChange2, p1_pts: p1Pts, p2_pts: p2Pts };
       }

       // --- PAID TR OR OTHER (Standard Rules) ---
       let scoreChange1 = p1Win ? 15 : isDraw ? 10 : -5;
       let scoreChange2 = p2Win ? 15 : isDraw ? 10 : -5;
       
       const isHybrid = match.timer_type === 5;
       const isBattle = tData && (tData.format === 'quick' || tData.format === 'battle');

       if ((isHybrid || isBattle) && finalFen) {
           const calculatePoints = (fen, side) => {
               const values = { 'p': 1, 'r': 2, 'n': 2, 'b': 2, 'q': 5, 'k': 0 };
               const target = side === 'w' ? 'PRNBQ' : 'prnbq';
               let pts = 0;
               const board = fen.split(' ')[0];
               for (const char of board) {
                   if (target.includes(char)) pts += values[char.toLowerCase()] || 0;
               }
               return pts;
           };
           const p1Pieces = calculatePoints(finalFen, 'w');
           const p2Pieces = calculatePoints(finalFen, 'b');
           scoreChange1 = (p1Win ? 10 : isDraw ? 5 : 0) + p1Pieces;
           scoreChange2 = (p2Win ? 10 : isDraw ? 5 : 0) + p2Pieces;
       }

       const updateTourneyPlayer = async (uid, change, won, drew) => {
         await supabase.rpc('increment_tournament_score', {
           p_tournament_id: match.tournament_id,
           p_user_id: uid,
           p_score: Number(change),
           p_won: Number(won),
           p_drew: Number(drew),
           p_round: Number(match.round || 1)
         });
       };

      if (match.player1_id) await updateTourneyPlayer(match.player1_id, scoreChange1, p1Win ? 1 : 0, isDraw ? 1 : 0);
      if (match.player2_id) await updateTourneyPlayer(match.player2_id, scoreChange2, p2Win ? 1 : 0, isDraw ? 1 : 0);
      
      return { match, p1_score_change: scoreChange1, p2_score_change: scoreChange2 };
    }

    return {
      match,
      p1_score_change: scoreChange1 || 0,
      p2_score_change: scoreChange2 || 0
    };
  } catch (err) {
    console.error('processMatchResult error:', err);
  }
};

const saveBotMatch = async (req, res) => {
  try {
    const { result, fen } = req.body;
    const matchData = {
      player1_id: req.user.id,
      player2_id: null, // No opponent
      match_type: 'bot',
      timer_type: 5, // bot matches use 5-min timer slot to satisfy DB constraint
      status: 'active',
      start_time: new Date().toISOString(),
    };
    const { data: match, error } = await supabase.from('matches').insert(matchData).select().single();
    if (error || !match) return res.status(500).json({ success: false, message: 'DB Error' });
    
    await processMatchResult(match.id, result, result === 'player1_win' ? req.user.id : null, fen);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getMatchHistory, getLeaderboard, getMatchById, processMatchResult, saveBotMatch };

