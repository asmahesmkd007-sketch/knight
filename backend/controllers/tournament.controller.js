const { supabase } = require('../config/supabase');

// ─── GET TOURNAMENTS ────────────────────────────────────────
const getTournaments = async (req, res) => {
  try {
    const { type, status } = req.query;
    let query = supabase.from('tournaments')
      .select('*')
      .order('entry_fee', { ascending: true })
      .limit(100);
    
    if (type) query = query.eq('type', type);
    
    if (status) {
        // BUG: Status whitelist to prevent DB probing
        const validStatuses = ['all', 'upcoming', 'filling', 'live', 'completed', 'cancelled', 'full', 'starting', 'locked'];
        if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status filter.' });

        if (status === 'all') {
            query = query.in('status', ['upcoming', 'full', 'starting', 'live', 'locked']);
        }
        else if (status === 'upcoming') {
            query = query.in('status', ['upcoming', 'full', 'starting', 'locked']);
            if (type === 'free') {
                query = query.gt('start_time', new Date().toISOString());
            }
        }
        else if (status === 'live') query = query.eq('status', 'live');
        else query = query.eq('status', status);
    } else {
        query = query.in('status', ['upcoming', 'full', 'starting', 'live', 'locked']);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ success: false, message: error.message });
    
    // Check if user is joined in each tournament
    const { data: userJoins } = await supabase.from('tournament_players').select('tournament_id').eq('user_id', req.user.id);
    const joinedIds = new Set(userJoins?.map(j => j.tournament_id) || []);

    const tournaments = (data || []).map(t => ({
        ...t,
        is_joined: joinedIds.has(t.id)
    }));

    res.json({ success: true, tournaments });
  } catch (err) {
    console.error('getTournaments error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET TOURNAMENT BY ID ───────────────────────────────────
const getTournamentById = async (req, res) => {
  try {
    const { data: tournament } = await supabase.from('tournaments').select('*').eq('id', req.params.id).single();
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found.' });

    const { data: players } = await supabase
      .from('tournament_players')
      .select('*, profiles(username, profile_image, iq_level, rank)')
      .eq('tournament_id', req.params.id)
      .order('score', { ascending: false });

    const { data: matches } = await supabase
      .from('matches')
      .select('*, p1:player1_id(username), p2:player2_id(username), win:winner_id(username)')
      .eq('tournament_id', req.params.id)
      .order('created_at', { ascending: true });

    let leaderboard = [];
    if (tournament.status === 'completed') {
      const { data: lb, error: lbError } = await supabase.from('leaderboard').select('*, profiles:user_id(username)').eq('tournament_id', req.params.id).order('rank', { ascending: true });
      if (lbError) console.error('Leaderboard fetch error:', lbError);
      leaderboard = lb || [];
    }

    res.json({ success: true, tournament: { ...tournament, players: players || [], matches: matches || [], leaderboard } });
  } catch (err) {
    console.error('getTournamentById error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── JOIN TOURNAMENT (COIN LOCK SYSTEM) ─────────────────────
const joinTournament = async (req, res) => {
  try {
    const { data: tournament } = await supabase.from('tournaments').select('*').eq('id', req.params.id).single();
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found.' });
    
    // Join Logic: Free TR allows joining during 'live'. Paid TR only during 'upcoming'.
    if (tournament.type === 'free') {
        if (!['upcoming', 'live'].includes(tournament.status)) {
            console.log(`🚫 Join rejected: Free TR ${tournament.id} status is ${tournament.status}`);
            return res.status(400).json({ success: false, message: 'Tournament is closed.' });
        }
    } else {
        if (tournament.status !== 'upcoming') {
            console.log(`🚫 Join rejected: Paid TR ${tournament.id} status is ${tournament.status}`);
            return res.status(400).json({ success: false, message: 'Paid tournaments lock once live. Registration closed.' });
        }
    }

    // BUG-09: Removed JS pre-check for current_players.
    // The atomic RPC internally handles the max_players check while holding a lock.
    // This prevents race conditions where multiple users pass the JS check but only one should join.

    // BUG-06: Removed JS pre-check for duplicate join. 
    // Atomic RPC internally handles this check while holding a lock.
    
    // PAID TOURNAMENT: Atomic Coin Lock & Join
    if (tournament.type === 'paid') {
      if (req.user.kyc_status !== 'verified') return res.status(403).json({ success: false, message: 'KYC verification required for paid tournaments.' });
      
      const { data: resJoin, error: rpcErr } = await supabase.rpc('join_paid_tournament_atomic', {
        p_tournament_id: req.params.id,
        p_user_id: req.user.id,
        p_fee: Number(tournament.entry_fee)
      });

      if (rpcErr || !resJoin?.success) {
        const errMsg = rpcErr ? (rpcErr.message || rpcErr.details || 'Database error') : (resJoin?.message || 'Join failed. Insufficient balance or tournament full.');
        console.error('❌ Tournament Join Error:', rpcErr || resJoin?.message);
        return res.status(400).json({ 
          success: false, 
          message: errMsg
        });
      }

      // Record transaction
      await supabase.from('transactions').insert({ 
        user_id: req.user.id, type: 'tournament_entry', amount: tournament.entry_fee, 
        status: 'success', reference_id: tournament.id, balance_after: resJoin.new_balance,
        description: `Entry locked for TR-${tournament.tr_id || 'NEW'}`
      });

      const finalCount = resJoin.current_players;
      if (finalCount >= tournament.max_players) {
        // HIGHBUG-H1: Wrap in try/catch to prevent stuck tournaments
        try {
          // HIGH: Make status update idempotent with status check guard
          const { data: updatedTR } = await supabase.from('tournaments').update({ 
            status: 'locked',
            // BUG-M3: start_time is just a registration deadline for paid TRs
            start_time: new Date(Date.now() + (tournament.timer_type === 3 ? 120 : 60) * 1000).toISOString()
          })
          .eq('id', req.params.id)
          .eq('status', 'upcoming') // IDEMPOTENCY GUARD: Only update if still upcoming
          .select();
          
          if (updatedTR && updatedTR.length > 0) {
            const TournamentManager = require('../services/tournament.manager');
            await TournamentManager.pickupTournament(req.params.id);
          }
        } catch (err) {
          console.error(`❌ CRITICAL: Tournament pickup failed for ${req.params.id}:`, err.message);
          // Self-healing: the TournamentManager poller will pick it up eventually
        }
      }

      return res.json({ success: true, message: 'Joined successfully!' });
    }

    // FREE TOURNAMENT LOGIC
    const { data: resJoin, error: freeErr } = await supabase.rpc('join_free_tournament_atomic', {
      p_tournament_id: req.params.id,
      p_user_id: req.user.id
    });

    if (freeErr || !resJoin?.success) {
      return res.status(400).json({ 
        success: false, 
        message: freeErr ? 'Server error, please retry.' : (resJoin?.message || 'Join failed.')
      });
    }

    if (resJoin.current_players >= tournament.max_players) {
        await supabase.from('tournaments').update({ 
            status: 'locked',
            start_time: new Date(Date.now() + 60 * 1000).toISOString()
        }).eq('id', req.params.id);
        
        const TournamentManager = require('../services/tournament.manager');
        TournamentManager.pickupTournament(req.params.id).catch(err => {
          console.error(`❌ Free Tournament pickup failed for ${req.params.id}:`, err);
        });
    }

    res.json({ success: true, message: 'Joined successfully!' });
  } catch (err) {
    console.error('joinTournament error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── AUTO CREATE PAID TOURNAMENTS ──────────────────────────
const autoCreatePaidTournaments = async () => {
  try {
    const entries = [5, 10, 15, 20, 30, 50, 80, 100, 200, 500];
    const types = [
      { timer: 1, max: 16, suffix: '1 Min Knockout TR' },
      { timer: 3, max: 32, suffix: '3 Min Paid TR' },
      { timer: 5, max: 32, suffix: '5 Min Paid TR' }
    ];
    
    for (const tType of types) {
        // Query existing tr_ids for this timer type once to establish starting sequence index
        const { data: list } = await supabase.from('tournaments')
          .select('tr_id')
          .eq('timer_type', tType.timer)
          .not('tr_id', 'is', null);
        
        let maxNum = -1;
        if (list && list.length > 0) {
          for (const t of list) {
            const parts = t.tr_id.split('-');
            if (parts.length === 3) {
              const num = parseInt(parts[2], 10);
              if (!isNaN(num) && num > maxNum) {
                maxNum = num;
              }
            }
          }
        }
        
        let nextIndex = maxNum + 1;
        
        for (const entry of entries) {
            console.log(`Checking ${tType.timer}min ${entry}c...`);
            
            const { data: existing } = await supabase.from('tournaments')
              .select('id')
              .eq('type', 'paid')
              .eq('timer_type', tType.timer)
              .eq('entry_fee', entry)
              .eq('status', 'upcoming')
              .limit(1);
            
            if (existing && existing.length > 0) {
                console.log(`Skipping ${tType.timer}min ${entry}c (Already exists)`);
                continue;
            }

            const pool = entry * tType.max;
            
            // CRITICALBUG-C3: Implement 15.1% Platform Commission
            const commissionRate = 0.151;
            const distributablePool = Math.floor(pool * (1 - commissionRate));
            
            // BUG-03: Calculate floor prizes from the distributable pool
            const isKnockout = tType.timer === 1;
            const p2 = Math.floor(distributablePool * 0.25);
            const p3 = Math.floor(distributablePool * 0.15);
            const p4 = Math.floor(distributablePool * 0.033);
            const p5 = isKnockout ? 0 : Math.floor(distributablePool * 0.033);
            const p6 = isKnockout ? 0 : Math.floor(distributablePool * 0.033);

            // Remainder goes to Rank 1, but total must stay within distributablePool
            const currentTotalPrizes = p2 + p3 + p4 + p5 + p6;
            const p1 = Math.max(0, distributablePool - currentTotalPrizes); 

            // Generate next sequential TR ID
            const trIdStr = `TR-${tType.timer}-${String(nextIndex).padStart(2, '0')}`;

            const { error: insErr } = await supabase.from('tournaments').insert({
              tr_id: trIdStr,
              name: `${entry} Coin - ${tType.suffix}`,
              type: 'paid',
              timer_type: tType.timer,
              format: 'standard',
              entry_fee: entry,
              max_players: tType.max,
              status: 'upcoming',
              prize_pool: distributablePool, // Actual prize pool shown to users
              prize_first: p1,
              prize_second: p2,
              prize_third: p3,
              // BUG-M3: registration_deadline / expiry set to 2 hours
              start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              phase: 'upcoming'
            });

            if (insErr) console.error('Failed to create tournament:', insErr);
            else {
                console.log(`🏆 Created new ${entry} Coin - ${tType.suffix} with ID ${trIdStr}`);
                nextIndex++;
            }
        }
    }
  } catch(e) { console.error('Auto-create paid error:', e); }
};

// ─── DISTRIBUTE TOURNAMENT PRIZES ───────────────────────────
const distributeTournamentPrizes = async (tournament) => {
  try {
    const { data: matches } = await supabase.from('matches')
      .select('player1_id, player2_id, winner_id, round')
      .eq('tournament_id', tournament.id)
      .eq('status', 'finished')
      .order('round', { ascending: false });

    if (!matches || matches.length === 0) return;

    // Top 16 Prize logic for 5min TR
    let prizes = [];
    if (tournament.timer_type === 5) {
      const pool = tournament.prize_pool || 0;
      // BUG-H3: Fair sorting - Sort by max_round DESC, then score DESC, then status (active before eliminated)
      const { data: allPlayers } = await supabase.from('tournament_players')
          .select('user_id, score, status, max_round, profiles(username)')
          .eq('tournament_id', tournament.id)
          .order('max_round', { ascending: false })
          .order('score', { ascending: false })
          .order('status', { ascending: true }); // 'active' (A) before 'eliminated' (E)
      
      // Winner list: Top 6
      const winnersList = allPlayers?.slice(0, 6) || [];
      
      const prizeAmounts = [
        tournament.prize_first ?? Math.floor(pool * 0.35), 
        tournament.prize_second ?? Math.floor(pool * 0.25), 
        tournament.prize_third ?? Math.floor(pool * 0.15),
        tournament.prize_fourth ?? Math.floor(pool * 0.033),
        tournament.prize_fifth ?? Math.floor(pool * 0.033),
        tournament.prize_sixth ?? Math.floor(pool * 0.033)
      ];

      for (let i = 0; i < winnersList.length; i++) {
        // CRITICAL: Robust payout loop - don't skip entire TR on one failure
        try {
            await processPrize(winnersList[i].user_id, i + 1, prizeAmounts[i], tournament);
        } catch (prizeErr) {
            console.error(`❌ PRIZE FAILURE: User ${winnersList[i].user_id} Rank ${i+1}:`, prizeErr.message);
        }
      }
      return;
    }

    const maxRound = matches[0].round;
    const finalMatch = matches.find(m => m.round === maxRound);
    if (!finalMatch || !finalMatch.winner_id) return;

    // Ranks 1 & 2
    const top1 = finalMatch.winner_id;
    const top2 = (finalMatch.winner_id === finalMatch.player1_id) ? finalMatch.player2_id : finalMatch.player1_id;

    // Rank 3 (Highest score among Semifinal losers)
    const semiMatches = matches.filter(m => m.round === maxRound - 1);
    let losers = [];
    semiMatches.forEach(m => {
        losers.push(m.winner_id === m.player1_id ? m.player2_id : m.player1_id);
    });

    const { data: loserProfiles } = await supabase.from('tournament_players')
        .select('user_id, score')
        .eq('tournament_id', tournament.id)
        .in('user_id', losers)
        .order('score', { ascending: false });
    
    const top3 = loserProfiles?.[0]?.user_id || null;
    const top4 = loserProfiles?.[1]?.user_id || null;

    // Ranks 5 & 6 (For 3min TR)
    let top5 = null, top6 = null;
    if (tournament.timer_type === 3) {
      const qfMatches = matches.filter(m => m.round === maxRound - 2);
      let qfLosers = [];
      qfMatches.forEach(m => {
        qfLosers.push(m.winner_id === m.player1_id ? m.player2_id : m.player1_id);
      });
      const { data: qfLoserProfiles } = await supabase.from('tournament_players')
        .select('user_id, score')
        .eq('tournament_id', tournament.id)
        .in('user_id', qfLosers)
        .order('score', { ascending: false });
      
      top5 = qfLoserProfiles?.[0]?.user_id || null;
      top6 = qfLoserProfiles?.[1]?.user_id || null;
    }

    const pool = tournament.prize_pool || 0;
    // Fair Ranking: Explicitly map ranks to prizes to avoid shifting if an ID is null
    const winners = [
        { id: top1, rank: 1, amount: tournament.prize_first },
        { id: top2, rank: 2, amount: tournament.prize_second },
        { id: top3, rank: 3, amount: tournament.prize_third },
        { id: top4, rank: 4, amount: tournament.prize_fourth ?? Math.floor(pool * 0.033) },
        { id: top5, rank: 5, amount: tournament.prize_fifth  ?? Math.floor(pool * 0.033) },
        { id: top6, rank: 6, amount: tournament.prize_sixth  ?? Math.floor(pool * 0.033) }
    ];
 
    for (const winner of winners) {
        if (!winner.id) continue;
        try {
            await processPrize(winner.id, winner.rank, winner.amount, tournament);
        } catch (prizeErr) {
            console.error(`❌ PRIZE FAILURE: User ${winner.id} Rank ${winner.rank}:`, prizeErr.message);
        }
    }
  } catch (err) { console.error('Prize distribution error:', err); }
};

const processPrize = async (userId, rank, amount, tournament) => {
    if (amount <= 0) return;
    try {
        const { error } = await supabase.rpc('distribute_prize_atomic', {
            p_tournament_id: tournament.id,
            p_user_id: userId,
            p_rank: rank,
            p_amount: Number(amount),
            p_description: `Prize: Rank ${rank} in TR-${tournament.tr_id}`
        });
        if (error) {
            console.error(`❌ Prize RPC Error for user ${userId}:`, error.message);
            // Audit Trail: Log to prize_failures table
            await supabase.from('prize_failures').insert({
                tournament_id: tournament.id,
                user_id: userId,
                rank: rank,
                amount: Number(amount),
                error_message: error.message
            });
        }
    } catch (err) {
        console.error(`❌ Prize Process Exception for user ${userId}:`, err.message);
        // Audit Trail: Log exception
        await supabase.from('prize_failures').insert({
            tournament_id: tournament.id,
            user_id: userId,
            rank: rank,
            amount: Number(amount),
            error_message: `EXCEPTION: ${err.message}`
        });
    }
};

// ─── HELPER: Next half-hour ─────────────────────────────────
const getNextHalfHour = (baseDate) => {
  const d = baseDate ? new Date(baseDate) : new Date();
  const m = d.getMinutes();
  if (m < 30) { d.setMinutes(30, 0, 0); }
  else { d.setHours(d.getHours() + 1); d.setMinutes(0, 0, 0); }
  return d.toISOString();
};

// ─── AUTO CREATE FREE TOURNAMENTS ───────────────────────────
const autoCreateFreeTournaments = async (customStartTime, customEndTime) => {
  try {
    const timers = [1, 3, 5, 10];
    const startTime = customStartTime || getNextHalfHour();
    const endTime = customEndTime || new Date(new Date(startTime).getTime() + 30 * 60 * 1000).toISOString();
    
    for (const t of timers) {
        const { data: existing } = await supabase.from('tournaments')
          .select('id')
          .eq('type', 'free')
          .eq('timer_type', t)
          .eq('status', 'upcoming')
          .limit(1);
        
        if (existing && existing.length > 0) continue;

        // Query max tr_id index for this timer type
        const { data: list } = await supabase.from('tournaments')
          .select('tr_id')
          .eq('timer_type', t)
          .not('tr_id', 'is', null);
        
        let maxNum = -1;
        if (list && list.length > 0) {
          for (const item of list) {
            const parts = item.tr_id.split('-');
            if (parts.length === 3) {
              const num = parseInt(parts[2], 10);
              if (!isNaN(num) && num > maxNum) {
                maxNum = num;
              }
            }
          }
        }
        
        const trIdStr = `TR-${t}-${String(maxNum + 1).padStart(2, '0')}`;

        await supabase.from('tournaments').insert({
          tr_id: trIdStr,
          name: `Free ${t}min Tournament`, 
          type: 'free', 
          format: 'standard', 
          timer_type: t,
          max_players: 500, 
          start_time: startTime, 
          end_time: endTime, 
          duration_minutes: 30,
        });
    }
  } catch (err) { console.error('Auto-create free error:', err); }
};

const backfillTournamentTrIds = async () => {
  try {
    console.log('🔄 Backfilling NULL tr_ids for existing tournaments...');
    const timers = [1, 3, 5, 10];
    for (const t of timers) {
      // Fetch all tournaments for this timer type order by created_at ascending
      const { data: tournaments, error } = await supabase.from('tournaments')
        .select('id, tr_id')
        .eq('timer_type', t)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error(`Error fetching tournaments for backfill timer ${t}:`, error);
        continue;
      }

      if (!tournaments || tournaments.length === 0) continue;

      let nextIndex = 0;
      for (const tr of tournaments) {
        if (!tr.tr_id) {
          const trIdStr = `TR-${t}-${String(nextIndex).padStart(2, '0')}`;
          const { error: updErr } = await supabase.from('tournaments')
            .update({ tr_id: trIdStr })
            .eq('id', tr.id);
          
          if (updErr) {
            console.error(`Error updating backfill for tournament ${tr.id}:`, updErr);
          } else {
            console.log(`✅ Backfilled tournament ${tr.id} with ID ${trIdStr}`);
          }
          nextIndex++;
        } else {
          // If it already has a tr_id, parse its index to make sure our sequence remains continuous
          const parts = tr.tr_id.split('-');
          if (parts.length === 3) {
            const num = parseInt(parts[2], 10);
            if (!isNaN(num) && num >= nextIndex) {
              nextIndex = num + 1;
            }
          }
        }
      }
    }
    console.log('✅ Backfill complete!');
  } catch (err) {
    console.error('backfillTournamentTrIds error:', err);
  }
};

// ─── UPDATE FREE TOURNAMENT STATUSES ────────────────────────
const updateTournamentStatuses = async () => {
    try {
        const now = new Date().toISOString();
        
        // 1. Move upcoming to live
        await supabase.from('tournaments').update({ status: 'live' }).eq('status', 'upcoming').eq('type', 'free').lte('start_time', now);
        
        // 2. Find tournaments that just ended but are still marked 'live'
        const { data: ending } = await supabase.from('tournaments')
            .select('id, name')
            .eq('status', 'live')
            .eq('type', 'free')
            .lte('end_time', now);

        if (ending && ending.length > 0) {
            for (const t of ending) {
                console.log(`🏆 Distributing trophies for ${t.name} (${t.id})...`);
                
                // Get top 3 players
                const { data: topPlayers } = await supabase.from('tournament_players')
                    .select('user_id')
                    .eq('tournament_id', t.id)
                    .order('score', { ascending: false })
                    .limit(3);

                if (topPlayers && topPlayers.length > 0) {
                    const trophyCols = ['trophy_gold', 'trophy_silver', 'trophy_bronze'];
                    for (let i = 0; i < topPlayers.length; i++) {
                        const col = trophyCols[i];
                        const uid = topPlayers[i].user_id;
                        
                        await supabase.rpc('increment_profile_trophy', {
                            p_user_id: uid,
                            p_trophy_type: col
                        });
                    }
                }

                // Mark as completed
                await supabase.from('tournaments').update({ status: 'completed' }).eq('id', t.id);
            }
        }

        // Cleanup abandoned paid tournaments
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: abandoned } = await supabase.from('tournaments').select('id').eq('type', 'paid').eq('status', 'upcoming').lt('created_at', oneDayAgo);
        if (abandoned?.length > 0) {
          const SYSTEM_AUTO_CLEANUP_ID = '00000000-0000-0000-0000-000000000000';
          for (const t of abandoned) {
            await supabase.rpc('cancel_tournament_atomic', { p_tournament_id: t.id, p_admin_id: SYSTEM_AUTO_CLEANUP_ID });
          }
        }
    } catch(e) { console.error('Tournament status update error:', e); }
};

// ─── LEADERBOARD ────────────────────────────────────────────
const getLeaderboard = async (req, res) => {
  try {
    const { data } = await supabase
      .from('tournament_players')
      .select('*, profiles(username, profile_image, iq_level)')
      .eq('tournament_id', req.params.id)
      .order('score', { ascending: false });
    res.json({ success: true, leaderboard: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { 
  getTournaments, getTournamentById, joinTournament, getLeaderboard, 
  autoCreateFreeTournaments, autoCreatePaidTournaments, updateTournamentStatuses, 
  distributeTournamentPrizes, backfillTournamentTrIds
};
