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
        if (status === 'upcoming') query = query.in('status', ['upcoming', 'full', 'starting']);
        else if (status === 'live') query = query.in('status', ['full', 'starting', 'live']);
        else query = query.eq('status', status);
    } else {
        query = query.in('status', ['upcoming', 'full', 'starting', 'live']);
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
    
    // Only allow joining in UPCOMING status
    if (tournament.status !== 'upcoming') return res.status(400).json({ success: false, message: 'Tournament is no longer accepting joins.' });
    if (tournament.current_players >= tournament.max_players) return res.status(400).json({ success: false, message: 'Tournament is full.' });

    // Prevent duplicate join
    const { data: already } = await supabase.from('tournament_players').select('id').eq('tournament_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (already) return res.status(400).json({ success: false, message: 'Already joined.' });

    // FRESH COUNT CHECK (to prevent race conditions)
    const { count: currentCount } = await supabase.from('tournament_players').select('*', { count: 'exact', head: true }).eq('tournament_id', req.params.id);
    if (currentCount >= (tournament.max_players || 16)) {
        // Auto-lock if it somehow stayed 'upcoming'
        await supabase.from('tournaments').update({ status: 'full' }).eq('id', req.params.id);
        return res.status(400).json({ success: false, message: 'Tournament is full.' });
    }

    // PAID TOURNAMENT: Coin LOCK system
    if (tournament.type === 'paid') {
      // KYC check
      if (req.user.kyc_status !== 'verified') return res.status(403).json({ success: false, message: 'KYC verification required for paid tournaments.' });
      
      // Balance check
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', req.user.id).single();
      if (!wallet || Number(wallet.balance) < tournament.entry_fee) return res.status(400).json({ success: false, message: 'Insufficient balance.' });

      // LOCK coins (deduct from wallet, record as locked transaction)
      const newBalance = Number(wallet.balance) - tournament.entry_fee;
      await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', req.user.id);
      await supabase.from('transactions').insert({ 
        user_id: req.user.id, type: 'tournament_entry', amount: tournament.entry_fee, 
        status: 'success', reference_id: tournament.id, balance_after: newBalance,
        description: `Entry locked for TR-${tournament.tr_id || 'NEW'}`
      });
    }

    // Add player to tournament
    const { error: insErr } = await supabase.from('tournament_players').insert({ tournament_id: req.params.id, user_id: req.user.id });
    if (insErr) {
        console.error('Join insert error:', insErr);
        return res.status(500).json({ success: false, message: 'Failed to join.' });
    }
    
    // FETCH ACCURATE COUNT from tournament_players to avoid race conditions
    const { count: actualCount, error: countErr } = await supabase.from('tournament_players')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', req.params.id);
    
    if (countErr) console.error('Count error:', countErr);
    
    const finalCount = (actualCount !== null && actualCount !== undefined) ? actualCount : (tournament.current_players + 1);
    let updateData = { current_players: finalCount };
    
    // CHECK IF FULL (32/32 for 3min, 16/16 for 1min) → Trigger LOCKED
    if (finalCount >= tournament.max_players) {
        updateData.status = 'locked';
        const lockDuration = tournament.timer_type === 3 ? 120 : 60; // 2 min for 3min, 1 min for 1min
        updateData.start_time = new Date(Date.now() + lockDuration * 1000).toISOString();
        console.log(`🔒 TR-${tournament.tr_id} is FULL (${finalCount}/${tournament.max_players}). Status: LOCKED for ${lockDuration}s.`);
    }

    await supabase.from('tournaments').update(updateData).eq('id', req.params.id);

    // Wake up TournamentManager to pickup the LOCKED tournament
    if (finalCount >= tournament.max_players) {
      const TournamentManager = require('../services/tournament.manager');
      TournamentManager.pickupTournament(req.params.id).catch(()=>{});
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
      { timer: 5, max: 100, suffix: '5 Min Hybrid TR' }
    ];
    
    for (const tType of types) {
        // Fetch current max TR ID for this type once
        const { data: allTRs } = await supabase.from('tournaments')
          .select('tr_id')
          .eq('type', 'paid')
          .eq('timer_type', tType.timer)
          .not('tr_id', 'is', null);
        
        let nextNum = 1;
        if (allTRs && allTRs.length > 0) {
          const nums = allTRs.map(t => {
            const m = t.tr_id.match(/TR-\d+-(\d+)/) || t.tr_id.match(/TR-(\d+)/);
            return m ? parseInt(m[1]) : 0;
          });
          nextNum = Math.max(...nums) + 1;
        }

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

            const trId = `TR-${tType.timer}-${nextNum}`;
            const pool = entry * tType.max;
            let prizes = {};
            
            if (tType.timer === 1) {
              prizes.first = Math.floor(pool * 0.35);
              prizes.second = Math.floor(pool * 0.30);
              prizes.third = Math.floor(pool * 0.20);
            } else if (tType.timer === 3) {
              prizes.first = Math.floor(pool * 0.35);
              prizes.second = Math.floor(pool * 0.25);
              prizes.third = Math.floor(pool * 0.15);
              prizes.fourth = Math.floor(pool * 0.033);
              prizes.fifth = Math.floor(pool * 0.033);
              prizes.sixth = Math.floor(pool * 0.033);
            } else {
              // 5 Min Hybrid (Top 16)
              prizes.first = Math.floor(pool * 0.30);
              prizes.second = Math.floor(pool * 0.25);
              prizes.third = Math.floor(pool * 0.15);
              // 4th-16th get 1% each
              prizes.top16_others = Math.floor(pool * 0.01);
            }

            const { error: insErr } = await supabase.from('tournaments').insert({
              name: `${entry} Coin - ${tType.suffix}`,
              type: 'paid',
              timer_type: tType.timer,
              format: 'standard',
              entry_fee: entry,
              max_players: tType.max,
              status: 'upcoming',
              prize_pool: pool,
              prize_first: prizes.first,
              prize_second: prizes.second,
              prize_third: prizes.third,
              tr_id: trId,
              start_time: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              phase: 'upcoming'
            });

            if (insErr) console.error(`Failed to create ${trId}:`, insErr);
            else {
                console.log(`🏆 Created ${trId}: ${entry} Coin - ${tType.suffix}`);
                nextNum++; // Increment local counter
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
      // Get all tournament players sorted by score
      const { data: allPlayers } = await supabase.from('tournament_players')
          .select('user_id, score, status')
          .eq('tournament_id', tournament.id)
          .order('score', { ascending: false });
      
      // Winner list: Top 16
      const winnersList = allPlayers?.slice(0, 16) || [];
      const winnerIds = winnersList.map(p => p.user_id);
      
      const prizeAmounts = [
        Math.floor(pool * 0.30),
        Math.floor(pool * 0.25),
        Math.floor(pool * 0.15)
      ];
      // 4th-16th: 1% each
      for (let i = 3; i < 16; i++) prizeAmounts.push(Math.floor(pool * 0.01));

      for (let i = 0; i < winnersList.length; i++) {
        await processPrize(winnersList[i].user_id, i + 1, prizeAmounts[i], tournament);
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

    const winners = [top1, top2, top3, top4, top5, top6].filter(id => id !== null);
    const pool = tournament.prize_pool || 0;
    const prizesList = [
      tournament.prize_first, 
      tournament.prize_second, 
      tournament.prize_third,
      Math.floor(pool * 0.033), // 4th
      Math.floor(pool * 0.033), // 5th
      Math.floor(pool * 0.033)  // 6th
    ];

    for (let i = 0; i < winners.length; i++) {
        await processPrize(winners[i], i + 1, prizesList[i], tournament);
    }
  } catch (err) { console.error('Prize distribution error:', err); }
};

// ─── HELPER: Process Prize ──────────────────────────────────
const processPrize = async (userId, rank, amount, tournament) => {
    if (amount <= 0) return;
    await supabase.from('leaderboard').insert({
        tournament_id: tournament.id, user_id: userId, rank: rank, prize: amount
    });
    const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', userId).single();
    if (wallet) {
        const newBalance = Number(wallet.balance) + amount;
        await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', userId);
        await supabase.from('transactions').insert({ 
            user_id: userId, type: 'tournament_prize', amount, 
            status: 'success', reference_id: tournament.id, balance_after: newBalance,
            description: `Prize: Rank ${rank} in TR-${tournament.tr_id}`
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
    const { data: existing } = await supabase.from('tournaments').select('id').eq('type', 'free').eq('status', 'upcoming');
    if (existing && existing.length > 0) return;
    const rows = timers.map(t => ({
      name: `Free ${t}min Tournament`, type: 'free', format: 'standard', timer_type: t,
      max_players: 500, start_time: startTime, end_time: endTime, duration_minutes: 30,
    }));
    await supabase.from('tournaments').insert(rows);
  } catch (err) { console.error('Auto-create free error:', err); }
};

// ─── UPDATE FREE TOURNAMENT STATUSES ────────────────────────
const updateTournamentStatuses = async () => {
    // Basic status update for Free tournaments (Paid is handled by Manager)
    try {
        const now = new Date().toISOString();
        await supabase.from('tournaments').update({ status: 'live' }).eq('status', 'upcoming').eq('type', 'free').lte('start_time', now);
        await supabase.from('tournaments').update({ status: 'completed' }).eq('status', 'live').eq('type', 'free').lte('end_time', now);
    } catch(e) {}
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
  distributeTournamentPrizes 
};
