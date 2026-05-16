const { supabase } = require('../config/supabase');

const getDashboard = async (req, res) => {
  try {
    const fetchCount = async (table, filter = null) => {
        let q = supabase.from(table).select('id', { count: 'exact', head: true });
        if (filter) q = q.eq(filter.col, filter.val);
        const { count, error } = await q;
        if (error) console.error(`[Dashboard] Error fetching count for ${table}:`, error);
        return count || 0;
    };

    const [totalUsers, activeUsers, pendingKYC, pendingWithdraw, activeMatches, walletRes] = await Promise.all([
      fetchCount('profiles'),
      fetchCount('profiles', { col: 'is_online', val: true }),
      fetchCount('kyc_requests', { col: 'status', val: 'pending' }),
      fetchCount('withdraw_requests', { col: 'status', val: 'pending' }),
      fetchCount('matches', { col: 'status', val: 'active' }),
      supabase.from('wallets').select('balance').then(r => r).catch(e => ({ data: [], error: e }))
    ]);

    const walletData = walletRes.data || [];
    const totalCoins = walletData.reduce((acc, w) => acc + Number(w.balance || 0), 0);

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers,
        activeUsers: activeUsers,
        pendingKYC: pendingKYC,
        pendingWithdraw: pendingWithdraw,
        totalMatches: activeMatches,
        wallet: { total: totalCoins }
      }
    });
  } catch (err) {
    console.error('[Dashboard] Global Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getUsers = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    let query = supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (status) query = query.eq('status', status);
    if (search) {
      // Normalize search: ensure @username format for username searches
      let searchTerm = search.trim();
      if (!searchTerm.startsWith('@') && !searchTerm.startsWith('PX-')) {
        searchTerm = '@' + searchTerm;
      }
      const safeTerm = searchTerm.replace(/[%_\\]/g, '\\$&');
      const safeSearch = search.trim().replace(/[%_\\]/g, '\\$&');
      query = query.or(`username.ilike.%${safeTerm}%,player_id.ilike.%${safeSearch}%`);
    }
    const { data, count } = await query;
    res.json({ success: true, users: data || [], total: count, pages: Math.ceil((count || 0) / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'blocked', 'banned'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status provided.' });
    }
    const { data, error } = await supabase.from('profiles').update({ status }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, message: error.message });
    await supabase.from('notifications').insert({ user_id: req.params.id, type: 'account', title: `Account ${status}`, message: `Your account has been ${status} by system.` });
    
    // Real-time emit
    const io = req.app.get('io');
    if (io) {
      const { userToSocket } = require('../socket/socket.js');
      const targetSocket = userToSocket.get(req.params.id);
      if (targetSocket) io.to(targetSocket).emit('silent_notification');
    }

    res.json({ success: true, message: `User ${status}.`, user: data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getPendingKYC = async (req, res) => {
  try {
    const { data: kycs, error } = await supabase
      .from('kyc_requests')
      .select('*, profiles!user_id(username, email, player_id)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ success: true, kycs: kycs || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
const reviewKYC = async (req, res) => {
  try {
    const { action, rejection_reason } = req.body;
    const { data: result, error } = await supabase.rpc('review_kyc_atomic', {
      p_request_id: req.params.id,
      p_admin_id: req.user.id,
      p_action: action,
      p_rejection_reason: rejection_reason || ''
    });

    if (error) return res.status(400).json({ success: false, message: error.message });
    if (!result.success) return res.status(400).json({ success: false, message: result.message });

    res.json({ success: true, message: `KYC ${action}d successfully.` });
  } catch (err) {
    console.error('reviewKYC error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getWithdrawRequests = async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('withdraw_requests')
      .select('*, profiles!user_id(username, player_id)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
        console.error('[RecordsController] getWithdrawRequests Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }

    console.log('[RecordsController] Found pending requests:', requests?.length);
    res.json({ success: true, requests: requests || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const processWithdraw = async (req, res) => {
  try {
    const { action, admin_note } = req.body; // action: 'approve' or 'reject'
    const { data: result, error: rpcErr } = await supabase.rpc('process_withdraw_atomic', {
      p_request_id: req.params.id,
      p_admin_id: req.user.id,
      p_action: action,
      p_admin_note: admin_note || ''
    });

    if (rpcErr) throw rpcErr;
    if (!result.success) return res.status(400).json({ success: false, message: result.message });

    // Emit notification to user
    const io = req.app.get('io');
    if (io && result.user_id) {
        io.to(result.user_id).emit('wallet_update', { balance: result.new_balance, type: 'withdraw_finalize' });
        io.to(result.user_id).emit('notification', { 
            title: action === 'approve' ? 'Withdrawal Successful ✅' : 'Withdrawal Rejected ❌',
            message: action === 'approve' ? `Your withdrawal of ₹${result.amount} has been processed.` : `Your withdrawal request was rejected. ${admin_note || ''}`
        });
    }

    res.json({ success: true, message: `Withdrawal ${action}d.` });
  } catch (err) {
    console.error('processWithdraw error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getAllTransactions = async (req, res) => {
  try {
    const { type, page = 1, limit = 50 } = req.query;
    let query = supabase.from('transactions').select('*, profiles(username, player_id)', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (type && type !== 'all') query = query.eq('type', type);
    const { data, count } = await query;
    res.json({ success: true, transactions: data || [], total: count, pages: Math.ceil((count || 0) / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createTournament = async (req, res) => {
  try {
    const { name, type, format, entry_fee, timer_type, max_players, prize_distribution, start_time, duration_minutes } = req.body;
    const fee = entry_fee || 0;
    const maxP = max_players || 500;
    const { data, error } = await supabase.from('tournaments').insert({
      name, type, format: format || 'standard', entry_fee: fee, timer_type,
      max_players: maxP, prize_pool: fee * maxP,
      prize_first: prize_distribution?.first || 0,
      prize_second: prize_distribution?.second || 0,
      prize_third: prize_distribution?.third || 0,
      start_time: new Date(start_time).toISOString(),
      end_time: new Date(new Date(start_time).getTime() + (duration_minutes || 30) * 60000).toISOString(),
      duration_minutes: duration_minutes || 30,
      created_by: req.user.id,
    }).select().single();
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, message: 'Tournament created!', tournament: data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getLiveMatches = async (req, res) => {
  try {
    const { data } = await supabase.from('matches').select('*, p1:player1_id(username, iq_level), p2:player2_id(username, iq_level)').eq('status', 'active').order('created_at', { ascending: false }).limit(50);
    res.json({ success: true, matches: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


const getAllTournaments = async (req, res) => {
  try {
    // RUN CLEANUP: Limit Free TR to last 100
    // Fetch IDs of Free TRs to keep (Top 100)
    const { data: toKeep } = await supabase
      .from('tournaments')
      .select('id')
      .eq('type', 'free')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (toKeep && toKeep.length === 100) {
      const keepIds = toKeep.map(t => t.id);
      // Delete older free TRs (those NOT in keepIds)
      await supabase
        .from('tournaments')
        .delete()
        .eq('type', 'free')
        .not('id', 'in', keepIds);
    }

    const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
    res.json({ success: true, tournaments: data || [] });
  } catch (err) {
    console.error('getAllTournaments error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const cancelTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: result, error } = await supabase.rpc('cancel_tournament_atomic', {
      p_tournament_id: id,
      p_admin_id: req.user.id
    });

    if (error) return res.status(400).json({ success: false, message: error.message });
    if (!result.success) return res.status(400).json({ success: false, message: result.message });

    const io = req.app.get('io');
    if (io) {
        io.to(`tournament_${id}`).emit('tournament_msg', { message: 'This tournament was cancelled by system.' });
        io.to(`tournament_${id}`).emit('tournament_sync_' + id, { status: 'cancelled' });
    }
    
    res.json({ success: true, message: 'Tournament cancelled and refunds processed.', refunds: result.refunds_processed });
  } catch (err) {
    console.error('cancelTournament error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getTournamentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 0. Get Tournament Info (Prizes)
    const { data: tr } = await supabase
      .from('tournaments')
      .select('prize_first, prize_second, prize_third')
      .eq('id', id)
      .single();

    // 1. Get Winners
    const { data: winners } = await supabase
      .from('tournament_players')
      .select('rank, profiles(username)')
      .eq('tournament_id', id)
      .in('rank', [1, 2, 3])
      .order('rank', { ascending: true });

    // 2. Get Matches History
    const { data: matches } = await supabase
      .from('matches')
      .select('round, result, winner_id, player1_id, player2_id, p1:player1_id(username), p2:player2_id(username)')
      .eq('tournament_id', id)
      .order('round', { ascending: true })
      .order('created_at', { ascending: true });

    res.json({ 
      success: true, 
      winners: winners || [], 
      matches: matches || [],
      prizes: {
        first: tr?.prize_first || 0,
        second: tr?.prize_second || 0,
        third: tr?.prize_third || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { 
  getDashboard, 
  getUsers, 
  updateUserStatus, 
  getPendingKYC, 
  reviewKYC, 
  getWithdrawRequests, 
  processWithdraw, 
  createTournament, 
  getLiveMatches, 
  getAllTransactions, 
  getAllTournaments, 
  cancelTournament,
  getTournamentDetails
};

