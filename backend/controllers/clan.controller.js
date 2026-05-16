const { supabase } = require('../config/supabase');

// ─── CLAN WAR SCORING CONSTANTS ──────────────────────────────
const CW_POINTS = {
  WIN: 40,
  DRAW_VALID: 10,
  DRAW_INVALID: 0,
  LOSS: 0,
  FORFEIT_WINNER: 40,
  FORFEIT_LOSER: -20,
  NO_SHOW_WINNER: 40,
  NO_SHOW_LOSER: -20,
};
const DRAW_MIN_MOVES = 12;

// ─── CREATE CLAN ─────────────────────────────────────────────
const createClan = async (req, res) => {
  let createdClanId = null; // track for rollback
  try {
    const { name, tag, description } = req.body;

    // ── Input validation ──────────────────────────────────────
    if (!name || !tag) {
      return res.status(400).json({ success: false, message: 'Clan name and tag are required.' });
    }
    const trimmedName = name.trim();
    const trimmedTag  = tag.toUpperCase().trim();

    if (trimmedName.length < 3 || trimmedName.length > 32) {
      return res.status(400).json({ success: false, message: 'Clan name must be 3–32 characters.' });
    }
    if (trimmedTag.length < 2 || trimmedTag.length > 5) {
      return res.status(400).json({ success: false, message: 'Tag must be 2–5 characters.' });
    }
    if (!/^[A-Z0-9]+$/.test(trimmedTag)) {
      return res.status(400).json({ success: false, message: 'Tag can only contain letters and numbers.' });
    }

    // ── Auth check ────────────────────────────────────────────
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // ── Already in a clan? ────────────────────────────────────
    const { data: existing, error: existErr } = await supabase
      .from('clan_members').select('id').eq('user_id', req.user.id).maybeSingle();
    if (existErr) {
      console.error('createClan membership check error:', existErr);
      return res.status(500).json({ success: false, message: 'Server error checking membership.' });
    }
    if (existing) {
      return res.status(400).json({ success: false, message: 'You are already in a clan.' });
    }

    // ── Uniqueness checks ─────────────────────────────────────
    const { data: nameTaken, error: nameErr } = await supabase
      .from('clans').select('id').ilike('name', trimmedName).maybeSingle();
    if (nameErr) {
      console.error('createClan name check error:', nameErr);
      return res.status(500).json({ success: false, message: 'Server error checking clan name.' });
    }
    if (nameTaken) {
      return res.status(400).json({ success: false, message: 'Clan name already taken.' });
    }

    const { data: tagTaken, error: tagErr } = await supabase
      .from('clans').select('id').ilike('tag', trimmedTag).maybeSingle();
    if (tagErr) {
      console.error('createClan tag check error:', tagErr);
      return res.status(500).json({ success: false, message: 'Server error checking clan tag.' });
    }
    if (tagTaken) {
      return res.status(400).json({ success: false, message: 'Clan tag already taken.' });
    }

    // ── Create clan record ────────────────────────────────────
    const { data: clan, error: clanErr } = await supabase.from('clans').insert({
      name: trimmedName,
      tag: trimmedTag,
      description: (description || '').trim().slice(0, 120),
      leader_id: req.user.id,
      total_members: 1,
    }).select().single();

    if (clanErr || !clan) {
      console.error('createClan insert error:', clanErr);
      // Surface the actual DB error message in development
      const msg = clanErr?.code === '23505'
        ? 'Clan name or tag already taken.'
        : 'Failed to create clan. Please try again.';
      return res.status(500).json({ success: false, message: msg });
    }

    createdClanId = clan.id;

    // ── Add creator as leader (critical — rollback clan if this fails) ──
    const { error: memberErr } = await supabase.from('clan_members').insert({
      clan_id: clan.id,
      user_id: req.user.id,
      role: 'leader',
    });

    if (memberErr) {
      console.error('createClan member insert error:', memberErr);
      // Rollback: delete the clan we just created so DB stays consistent
      await supabase.from('clans').delete().eq('id', clan.id);
      createdClanId = null;
      return res.status(500).json({ success: false, message: 'Failed to assign clan leadership. Please try again.' });
    }

    console.log(`✅ Clan created: [${trimmedTag}] ${trimmedName} by user ${req.user.id}`);
    res.json({ success: true, message: 'Clan created!', clan });

  } catch (err) {
    console.error('createClan unexpected error:', err);
    // Attempt rollback if clan was created but something else failed
    if (createdClanId) {
      try { await supabase.from('clans').delete().eq('id', createdClanId); } catch {}
    }
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ─── GET MY CLAN ─────────────────────────────────────────────
const getMyClan = async (req, res) => {
  try {
    const { data: membership } = await supabase.from('clan_members').select('clan_id, role').eq('user_id', req.user.id).maybeSingle();
    if (!membership) return res.json({ success: true, clan: null });

    const { data: clan } = await supabase.from('clans').select('*').eq('id', membership.clan_id).single();
    if (!clan) return res.json({ success: true, clan: null });

    const { data: members } = await supabase
      .from('clan_members')
      .select('*, profiles(id, username, profile_image, iq_level, rank, is_online)')
      .eq('clan_id', clan.id)
      .order('role', { ascending: true });

    // Get active war if any
    const { data: activeWar } = await supabase
      .from('clan_wars')
      .select('*')
      .or(`clan_a_id.eq.${clan.id},clan_b_id.eq.${clan.id}`)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    res.json({ success: true, clan: { ...clan, members: members || [], my_role: membership.role, active_war: activeWar || null } });
  } catch (err) {
    console.error('getMyClan error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET CLAN BY ID ──────────────────────────────────────────
const getClanById = async (req, res) => {
  try {
    const { data: clan } = await supabase.from('clans').select('*').eq('id', req.params.id).single();
    if (!clan) return res.status(404).json({ success: false, message: 'Clan not found.' });

    const { data: members } = await supabase
      .from('clan_members')
      .select('*, profiles(id, username, profile_image, iq_level, rank, is_online)')
      .eq('clan_id', clan.id)
      .order('role', { ascending: true });

    res.json({ success: true, clan: { ...clan, members: members || [] } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── SEARCH CLANS ────────────────────────────────────────────
const searchClans = async (req, res) => {
  try {
    const { q = '' } = req.query;
    let query = supabase.from('clans').select('id, name, tag, description, total_members, total_wars, war_wins, created_at').order('war_wins', { ascending: false }).limit(20);
    if (q) query = query.or(`name.ilike.%${q}%,tag.ilike.%${q}%`);
    const { data } = await query;
    res.json({ success: true, clans: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── JOIN CLAN ───────────────────────────────────────────────
// ─── JOIN CLAN (Request to Join) ──────────────────────────────
const joinClan = async (req, res) => {
  try {
    // 1. Already in a clan?
    const { data: existing } = await supabase.from('clan_members').select('id').eq('user_id', req.user.id).maybeSingle();
    if (existing) return res.status(400).json({ success: false, message: 'You are already in a clan.' });

    // 2. Check if clan exists
    const { data: clan } = await supabase.from('clans').select('id, total_members, leader_id').eq('id', req.params.id).single();
    if (!clan) return res.status(404).json({ success: false, message: 'Clan not found.' });

    // 3. Max members check
    const { count: liveCount } = await supabase.from('clan_members').select('*', { count: 'exact', head: true }).eq('clan_id', clan.id);
    if ((liveCount || 0) >= 20) return res.status(400).json({ success: false, message: 'Clan is full.' });

    // 4. Check for existing pending request
    const { data: existingReq } = await supabase.from('clan_join_requests')
      .select('id').eq('clan_id', clan.id).eq('user_id', req.user.id).eq('status', 'pending').maybeSingle();
    if (existingReq) return res.status(400).json({ success: false, message: 'Join request already pending.' });

    // 5. Create request
    const { error: reqErr } = await supabase.from('clan_join_requests').insert({
      clan_id: clan.id,
      user_id: req.user.id,
      status: 'pending',
      sender_type: 'user'
    });
    if (reqErr) return res.status(500).json({ success: false, message: 'Failed to send request.' });

    // 6. Notify leader
    try {
      const { sendNotification } = require('../services/notification.service');
      await sendNotification({
        user_id: clan.leader_id,
        type: 'clan_request',
        title: 'New Clan Join Request',
        message: `${req.user.username} wants to join your clan.`,
      });
    } catch (notifErr) { console.error('Join request notification failed:', notifErr); }

    res.json({ success: true, message: 'Request sent! Waiting for approval.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET JOIN REQUESTS (For Leaders/Co-leaders) ───────────────
const getJoinRequests = async (req, res) => {
  try {
    const { data: membership } = await supabase.from('clan_members').select('clan_id, role').eq('user_id', req.user.id).maybeSingle();
    if (!membership || !['leader', 'co_leader'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const { data: requests } = await supabase
      .from('clan_join_requests')
      .select('*, profiles(id, username, iq_level, rank)')
      .eq('clan_id', membership.clan_id)
      .eq('status', 'pending')
      .eq('sender_type', 'user')
      .order('created_at', { ascending: false });

    res.json({ success: true, requests: requests || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── RESPOND TO JOIN REQUEST ─────────────────────────────────
const respondJoinRequest = async (req, res) => {
  try {
    const { requestId, action } = req.body; // action: 'accept' or 'reject'
    if (!['accept', 'reject'].includes(action)) return res.status(400).json({ success: false, message: 'Invalid action.' });

    const { data: myMembership } = await supabase.from('clan_members').select('clan_id, role').eq('user_id', req.user.id).maybeSingle();
    if (!myMembership || !['leader', 'co_leader'].includes(myMembership.role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const { data: joinReq } = await supabase.from('clan_join_requests').select('*').eq('id', requestId).eq('clan_id', myMembership.clan_id).eq('sender_type', 'user').single();
    if (!joinReq || joinReq.status !== 'pending') return res.status(404).json({ success: false, message: 'Request not found.' });

    if (action === 'accept') {
      // 1. Check if user is already in another clan
      const { data: otherClan } = await supabase.from('clan_members').select('id').eq('user_id', joinReq.user_id).maybeSingle();
      if (otherClan) {
        await supabase.from('clan_join_requests').update({ status: 'rejected' }).eq('id', requestId);
        return res.status(400).json({ success: false, message: 'User is already in another clan.' });
      }

      // 2. Check clan capacity
      const { count: liveCount } = await supabase.from('clan_members').select('*', { count: 'exact', head: true }).eq('clan_id', myMembership.clan_id);
      if ((liveCount || 0) >= 20) return res.status(400).json({ success: false, message: 'Clan is full.' });

      // 3. Add member
      const { error: insertErr } = await supabase.from('clan_members').insert({
        clan_id: myMembership.clan_id,
        user_id: joinReq.user_id,
        role: 'member'
      });
      if (insertErr) return res.status(500).json({ success: false, message: 'Failed to add member.' });

      // 4. Update clan member count ATOMICALLY
      await supabase.rpc('update_clan_member_count', { p_clan_id: myMembership.clan_id, p_delta: 1 });

      // 5. Mark request as accepted
      await supabase.from('clan_join_requests').update({ status: 'accepted' }).eq('id', requestId);

      // 6. Notify user
      try {
        const { sendNotification } = require('../services/notification.service');
        await sendNotification({
          user_id: joinReq.user_id,
          type: 'clan_accept',
          title: 'Clan Invitation Accepted!',
          message: `You have been accepted into the clan. Welcome!`,
        });
      } catch {}

    } else {
      // Reject
      await supabase.from('clan_join_requests').update({ status: 'rejected' }).eq('id', requestId);
    }

    res.json({ success: true, message: `Request ${action}ed.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── LEAVE CLAN ──────────────────────────────────────────────
const leaveClan = async (req, res) => {
  try {
    const { data: membership } = await supabase.from('clan_members').select('clan_id, role').eq('user_id', req.user.id).maybeSingle();
    if (!membership) return res.status(400).json({ success: false, message: 'You are not in a clan.' });
    if (membership.role === 'leader') return res.status(400).json({ success: false, message: 'Leader cannot leave. Transfer leadership first.' });

    await supabase.from('clan_members').delete().eq('user_id', req.user.id);
    await supabase.rpc('update_clan_member_count', { p_clan_id: membership.clan_id, p_delta: -1 });

    res.json({ success: true, message: 'Left clan.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── UPDATE MEMBER ROLE ──────────────────────────────────────
const updateMemberRole = async (req, res) => {
  try {
    const { targetUserId, role } = req.body;
    if (!['co_leader', 'member'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role.' });

    const { data: myMembership } = await supabase.from('clan_members').select('clan_id, role').eq('user_id', req.user.id).maybeSingle();
    if (!myMembership || myMembership.role !== 'leader') return res.status(403).json({ success: false, message: 'Only the leader can change roles.' });

    // Count co-leaders
    if (role === 'co_leader') {
      const { count } = await supabase.from('clan_members').select('*', { count: 'exact', head: true }).eq('clan_id', myMembership.clan_id).eq('role', 'co_leader');
      if (count >= 7) return res.status(400).json({ success: false, message: 'Maximum 7 co-leaders allowed.' });
    }

    await supabase.from('clan_members').update({ role }).eq('user_id', targetUserId).eq('clan_id', myMembership.clan_id);
    res.json({ success: true, message: 'Role updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── KICK MEMBER ─────────────────────────────────────────────
const kickMember = async (req, res) => {
  try {
    const { data: myMembership } = await supabase.from('clan_members').select('clan_id, role').eq('user_id', req.user.id).maybeSingle();
    if (!myMembership || !['leader', 'co_leader'].includes(myMembership.role)) return res.status(403).json({ success: false, message: 'Insufficient permissions.' });

    const { data: target } = await supabase.from('clan_members').select('role').eq('user_id', req.params.userId).eq('clan_id', myMembership.clan_id).maybeSingle();
    if (!target) return res.status(404).json({ success: false, message: 'Member not found.' });
    if (target.role === 'leader') return res.status(403).json({ success: false, message: 'Cannot kick the leader.' });
    if (myMembership.role === 'co_leader' && target.role === 'co_leader') return res.status(403).json({ success: false, message: 'Co-leaders cannot kick other co-leaders.' });

    await supabase.from('clan_members').delete().eq('user_id', req.params.userId).eq('clan_id', myMembership.clan_id);
    await supabase.rpc('update_clan_member_count', { p_clan_id: myMembership.clan_id, p_delta: -1 });

    res.json({ success: true, message: 'Member kicked.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── DECLARE WAR ─────────────────────────────────────────────
const declareWar = async (req, res) => {
  try {
    const { targetClanId } = req.body;

    const { data: myMembership } = await supabase.from('clan_members').select('clan_id, role').eq('user_id', req.user.id).maybeSingle();
    if (!myMembership || !['leader', 'co_leader'].includes(myMembership.role)) return res.status(403).json({ success: false, message: 'Only leaders/co-leaders can declare war.' });
    if (myMembership.clan_id === targetClanId) return res.status(400).json({ success: false, message: 'Cannot war your own clan.' });

    // Check no active war
    const { data: existingWar } = await supabase.from('clan_wars')
      .select('id')
      .or(`clan_a_id.eq.${myMembership.clan_id},clan_b_id.eq.${myMembership.clan_id}`)
      .in('status', ['pending', 'active'])
      .maybeSingle();
    if (existingWar) return res.status(400).json({ success: false, message: 'Your clan is already in a war.' });

    const { data: targetClan } = await supabase.from('clans').select('id, name').eq('id', targetClanId).single();
    if (!targetClan) return res.status(404).json({ success: false, message: 'Target clan not found.' });

    // Check target clan is not already in a war
    const { data: targetExistingWar } = await supabase.from('clan_wars')
      .select('id')
      .or(`clan_a_id.eq.${targetClanId},clan_b_id.eq.${targetClanId}`)
      .in('status', ['pending', 'active'])
      .maybeSingle();
    if (targetExistingWar) return res.status(400).json({ success: false, message: 'Target clan is already in a war.' });

    // 48-hour war window
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 48 * 60 * 60 * 1000);

    const { data: war, error } = await supabase.from('clan_wars').insert({
      clan_a_id: myMembership.clan_id,
      clan_b_id: targetClanId,
      status: 'pending',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
    }).select().single();

    if (error) return res.status(500).json({ success: false, message: 'Failed to declare war.' });

    res.json({ success: true, message: 'War declared!', war });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── ACCEPT WAR ──────────────────────────────────────────────
const acceptWar = async (req, res) => {
  try {
    const { data: myMembership } = await supabase.from('clan_members').select('clan_id, role').eq('user_id', req.user.id).maybeSingle();
    if (!myMembership || !['leader', 'co_leader'].includes(myMembership.role)) return res.status(403).json({ success: false, message: 'Only leaders/co-leaders can accept wars.' });

    const { data: war } = await supabase.from('clan_wars').select('*').eq('id', req.params.warId).single();
    if (!war) return res.status(404).json({ success: false, message: 'War not found.' });
    if (war.clan_b_id !== myMembership.clan_id) return res.status(403).json({ success: false, message: 'Not your war to accept.' });
    if (war.status !== 'pending') return res.status(400).json({ success: false, message: 'War is not pending.' });

    await supabase.from('clan_wars').update({ status: 'active' }).eq('id', war.id);
    res.json({ success: true, message: 'War accepted! Battle begins.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── SELECT WAR LINEUP ───────────────────────────────────────
const selectWarLineup = async (req, res) => {
  try {
    const { warId, playerIds } = req.body;
    if (!Array.isArray(playerIds) || playerIds.length > 16) return res.status(400).json({ success: false, message: 'Max 16 players per war.' });

    const { data: myMembership } = await supabase.from('clan_members').select('clan_id, role').eq('user_id', req.user.id).maybeSingle();
    if (!myMembership || !['leader', 'co_leader'].includes(myMembership.role)) return res.status(403).json({ success: false, message: 'Only leaders/co-leaders can set lineup.' });

    const { data: war } = await supabase.from('clan_wars').select('*').eq('id', warId).single();
    if (!war) return res.status(404).json({ success: false, message: 'War not found.' });
    if (war.status !== 'pending') return res.status(400).json({ success: false, message: 'Lineup can only be set before war starts.' });

    const isA = war.clan_a_id === myMembership.clan_id;
    const isB = war.clan_b_id === myMembership.clan_id;
    if (!isA && !isB) return res.status(403).json({ success: false, message: 'Not your war.' });

    // Verify all players are clan members
    const { data: clanMembers } = await supabase.from('clan_members').select('user_id').eq('clan_id', myMembership.clan_id);
    const memberIds = new Set(clanMembers.map(m => m.user_id));
    const invalid = playerIds.filter(id => !memberIds.has(id));
    if (invalid.length > 0) return res.status(400).json({ success: false, message: 'Some players are not clan members.' });

    const lineupField = isA ? 'lineup_a' : 'lineup_b';
    await supabase.from('clan_wars').update({ [lineupField]: playerIds }).eq('id', warId);

    res.json({ success: true, message: 'Lineup set!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET WAR DETAILS ─────────────────────────────────────────
const getWarDetails = async (req, res) => {
  try {
    const { data: war } = await supabase.from('clan_wars').select('*').eq('id', req.params.warId).single();
    if (!war) return res.status(404).json({ success: false, message: 'War not found.' });

    const [{ data: clanA }, { data: clanB }] = await Promise.all([
      supabase.from('clans').select('id, name, tag, total_members').eq('id', war.clan_a_id).single(),
      supabase.from('clans').select('id, name, tag, total_members').eq('id', war.clan_b_id).single(),
    ]);

    const { data: warMatches } = await supabase
      .from('clan_war_matches')
      .select('*, p1:player1_id(id, username, profile_image, iq_level), p2:player2_id(id, username, profile_image, iq_level)')
      .eq('war_id', war.id)
      .order('created_at', { ascending: true });

    res.json({ success: true, war: { ...war, clan_a: clanA, clan_b: clanB, matches: warMatches || [] } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET MY WAR ──────────────────────────────────────────────
const getMyWar = async (req, res) => {
  try {
    const { data: membership } = await supabase.from('clan_members').select('clan_id').eq('user_id', req.user.id).maybeSingle();
    if (!membership) return res.json({ success: true, war: null });

    const { data: war } = await supabase
      .from('clan_wars')
      .select('*')
      .or(`clan_a_id.eq.${membership.clan_id},clan_b_id.eq.${membership.clan_id}`)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!war) return res.json({ success: true, war: null });

    const [{ data: clanA }, { data: clanB }] = await Promise.all([
      supabase.from('clans').select('id, name, tag').eq('id', war.clan_a_id).single(),
      supabase.from('clans').select('id, name, tag').eq('id', war.clan_b_id).single(),
    ]);

    const { data: warMatches } = await supabase
      .from('clan_war_matches')
      .select('*, p1:player1_id(id, username, profile_image, iq_level), p2:player2_id(id, username, profile_image, iq_level)')
      .eq('war_id', war.id)
      .order('created_at', { ascending: true });

    res.json({ success: true, war: { ...war, clan_a: clanA, clan_b: clanB, matches: warMatches || [] } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET WAR HISTORY ─────────────────────────────────────────
const getWarHistory = async (req, res) => {
  try {
    const { data: membership } = await supabase.from('clan_members').select('clan_id').eq('user_id', req.user.id).maybeSingle();
    if (!membership) return res.json({ success: true, wars: [] });

    const { data: wars } = await supabase
      .from('clan_wars')
      .select('*, clan_a:clan_a_id(id, name, tag), clan_b:clan_b_id(id, name, tag)')
      .or(`clan_a_id.eq.${membership.clan_id},clan_b_id.eq.${membership.clan_id}`)
      .eq('status', 'completed')
      .order('end_time', { ascending: false })
      .limit(20);

    res.json({ success: true, wars: wars || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── PROCESS WAR MATCH RESULT ────────────────────────────────
// Called from socket.js after a clan war match ends
const processWarMatchResult = async (warMatchId, result, moveCount, reason) => {
  try {
    const { data: warMatch } = await supabase.from('clan_war_matches').select('*').eq('id', warMatchId).single();
    if (!warMatch || warMatch.status === 'finished') return;

    let p1Points = 0, p2Points = 0;

    if (result === 'player1_win') {
      p1Points = CW_POINTS.WIN;
      p2Points = CW_POINTS.LOSS;
    } else if (result === 'player2_win') {
      p1Points = CW_POINTS.LOSS;
      p2Points = CW_POINTS.WIN;
    } else if (result === 'draw') {
      const isValid = (moveCount || 0) >= DRAW_MIN_MOVES;
      p1Points = isValid ? CW_POINTS.DRAW_VALID : CW_POINTS.DRAW_INVALID;
      p2Points = isValid ? CW_POINTS.DRAW_VALID : CW_POINTS.DRAW_INVALID;
    } else if (result === 'forfeit_p1') {
      p1Points = CW_POINTS.FORFEIT_LOSER;
      p2Points = CW_POINTS.FORFEIT_WINNER;
    } else if (result === 'forfeit_p2') {
      p1Points = CW_POINTS.FORFEIT_WINNER;
      p2Points = CW_POINTS.FORFEIT_LOSER;
    } else if (result === 'no_show_p1') {
      p1Points = CW_POINTS.NO_SHOW_LOSER;
      p2Points = CW_POINTS.NO_SHOW_WINNER;
    } else if (result === 'no_show_p2') {
      p1Points = CW_POINTS.NO_SHOW_WINNER;
      p2Points = CW_POINTS.NO_SHOW_LOSER;
    }

    // Update war match
    await supabase.from('clan_war_matches').update({
      status: 'finished',
      result,
      p1_points: p1Points,
      p2_points: p2Points,
      move_count: moveCount || 0,
      end_time: new Date().toISOString(),
    }).eq('id', warMatchId);

    // Update war scores
    // clan_a_id on the war_match tells us which clan player1 belongs to
    const { data: war } = await supabase.from('clan_wars').select('*').eq('id', warMatch.war_id).single();
    if (!war) return;

    const p1IsClanA = warMatch.clan_a_id === war.clan_a_id;
    const scoreADelta = p1IsClanA ? p1Points : p2Points;
    const scoreBDelta = p1IsClanA ? p2Points : p1Points;

    await supabase.rpc('update_clan_war_scores', {
      p_war_id: war.id,
      p_score_a_delta: scoreADelta,
      p_score_b_delta: scoreBDelta
    });

    // Check if all matches done → finalize war
    const { count: remaining } = await supabase
      .from('clan_war_matches')
      .select('*', { count: 'exact', head: true })
      .eq('war_id', war.id)
      .neq('status', 'finished');

    if (remaining === 0) await finalizeWar(war.id);
  } catch (err) {
    console.error('processWarMatchResult error:', err);
  }
};

// ─── FINALIZE WAR ────────────────────────────────────────────
const finalizeWar = async (warId) => {
  try {
    const { data: war } = await supabase.from('clan_wars').select('*').eq('id', warId).single();
    if (!war || war.status === 'completed') return;

    let winnerId = null;
    if (war.score_a > war.score_b) winnerId = war.clan_a_id;
    else if (war.score_b > war.score_a) winnerId = war.clan_b_id;
    // null = draw

    await supabase.from('clan_wars').update({
      status: 'completed',
      winner_clan_id: winnerId,
      end_time: new Date().toISOString(),
    }).eq('id', warId);

    // Update clan stats via RPC (handles total_wars + war_wins atomically)
    if (winnerId) {
      const loserId = winnerId === war.clan_a_id ? war.clan_b_id : war.clan_a_id;
      await supabase.rpc('increment_clan_wars', { p_clan_id: winnerId, p_won: true });
      await supabase.rpc('increment_clan_wars', { p_clan_id: loserId, p_won: false });
    } else {
      // Draw — both clans get total_wars incremented, no win
      await supabase.rpc('increment_clan_wars', { p_clan_id: war.clan_a_id, p_won: false });
      await supabase.rpc('increment_clan_wars', { p_clan_id: war.clan_b_id, p_won: false });
    }

    console.log(`⚔️ War ${warId} finalized. Winner: ${winnerId || 'Draw'}`);
  } catch (err) {
    console.error('finalizeWar error:', err);
  }
};

// ─── GET CLAN LEADERBOARD ────────────────────────────────────
const getClanLeaderboard = async (req, res) => {
  try {
    const { data } = await supabase
      .from('clans')
      .select('id, name, tag, total_members, total_wars, war_wins, war_points, created_at')
      .order('war_wins', { ascending: false })
      .order('war_points', { ascending: false })
      .limit(50);
    res.json({ success: true, clans: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET PENDING WARS (for clan) ─────────────────────────────
const getPendingWars = async (req, res) => {
  try {
    const { data: membership } = await supabase.from('clan_members').select('clan_id').eq('user_id', req.user.id).maybeSingle();
    if (!membership) return res.json({ success: true, wars: [] });

    const { data: wars } = await supabase
      .from('clan_wars')
      .select('*, clan_a:clan_a_id(id, name, tag), clan_b:clan_b_id(id, name, tag)')
      .eq('clan_b_id', membership.clan_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    res.json({ success: true, wars: wars || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── DELETE CLAN ─────────────────────────────────────────────
const deleteClan = async (req, res) => {
  try {
    const { data: membership } = await supabase.from('clan_members').select('clan_id, role').eq('user_id', req.user.id).maybeSingle();
    if (!membership || membership.role !== 'leader') {
      return res.status(403).json({ success: false, message: 'Only the leader can delete the clan.' });
    }

    // Check member count — must be only the leader
    const { count } = await supabase.from('clan_members').select('*', { count: 'exact', head: true }).eq('clan_id', membership.clan_id);
    if (count > 1) {
      return res.status(400).json({ success: false, message: 'You must kick all members before deleting the clan.' });
    }

    // Delete the clan (cascades to members, join requests, etc. in DB)
    const { error } = await supabase.from('clans').delete().eq('id', membership.clan_id);
    if (error) throw error;

    res.json({ success: true, message: 'Clan deleted successfully.' });
  } catch (err) {
    console.error('deleteClan error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting clan.' });
  }
};

// ─── TRANSFER LEADERSHIP ─────────────────────────────────────
const transferLeadership = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, message: 'Target user ID is required.' });

    const { data: myMembership } = await supabase.from('clan_members').select('clan_id, role').eq('user_id', req.user.id).maybeSingle();
    if (!myMembership || myMembership.role !== 'leader') {
      return res.status(403).json({ success: false, message: 'Only the leader can transfer leadership.' });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You are already the leader.' });
    }

    // Verify target user is in the same clan
    const { data: targetMembership } = await supabase.from('clan_members').select('role').eq('user_id', targetUserId).eq('clan_id', myMembership.clan_id).maybeSingle();
    if (!targetMembership) {
      return res.status(400).json({ success: false, message: 'Target user is not in your clan.' });
    }

    // Perform transfer
    // 1. Update clan leader_id
    const { error: clanErr } = await supabase.from('clans').update({ leader_id: targetUserId }).eq('id', myMembership.clan_id);
    if (clanErr) throw clanErr;

    // 2. Update roles (Old leader becomes co_leader, new leader becomes leader)
    await supabase.from('clan_members').update({ role: 'co_leader' }).eq('user_id', req.user.id).eq('clan_id', myMembership.clan_id);
    await supabase.from('clan_members').update({ role: 'leader' }).eq('user_id', targetUserId).eq('clan_id', myMembership.clan_id);

    res.json({ success: true, message: 'Leadership transferred successfully.' });
  } catch (err) {
    console.error('transferLeadership error:', err);
    res.status(500).json({ success: false, message: 'Server error transferring leadership.' });
  }
};

// ─── INVITE MEMBER ───────────────────────────────────────────
const inviteMember = async (req, res) => {
  try {
    const { targetUsername } = req.body;
    if (!targetUsername) return res.status(400).json({ success: false, message: 'Username is required.' });

    const { data: membership } = await supabase.from('clan_members').select('clan_id, role').eq('user_id', req.user.id).maybeSingle();
    if (!membership || !['leader', 'co_leader'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: 'Only leaders can invite members.' });
    }

    const cleanUsername = targetUsername.startsWith('@') ? targetUsername : `@${targetUsername}`;
    const { data: targetUser } = await supabase.from('profiles').select('id, username').eq('username', cleanUsername).maybeSingle();
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    const { data: inClan } = await supabase.from('clan_members').select('id').eq('user_id', targetUser.id).maybeSingle();
    if (inClan) return res.status(400).json({ success: false, message: 'User is already in a clan.' });

    const { data: existing } = await supabase.from('clan_join_requests')
      .select('id, status')
      .eq('clan_id', membership.clan_id)
      .eq('user_id', targetUser.id)
      .eq('status', 'pending')
      .maybeSingle();
    
    if (existing) return res.status(400).json({ success: false, message: 'A request/invite is already pending.' });

    const { error: inviteErr } = await supabase.from('clan_join_requests').upsert({
      clan_id: membership.clan_id,
      user_id: targetUser.id,
      status: 'pending',
      sender_type: 'clan'
    });

    if (inviteErr) throw inviteErr;

    try {
      const { sendNotification } = require('../services/notification.service');
      const { data: clan } = await supabase.from('clans').select('name').eq('id', membership.clan_id).single();
      await sendNotification({
        user_id: targetUser.id,
        type: 'clan_invite',
        title: 'Clan Invitation',
        message: `You have been invited to join clan "${clan.name}". Check your Friends page.`,
      });
    } catch {}

    res.json({ success: true, message: 'Invitation sent!' });
  } catch (err) {
    console.error('inviteMember error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET MY INVITATIONS (For Users) ───────────────────────────
const getMyInvitations = async (req, res) => {
  try {
    const { data: invites } = await supabase
      .from('clan_join_requests')
      .select('*, clans(id, name, tag, description)')
      .eq('user_id', req.user.id)
      .eq('status', 'pending')
      .eq('sender_type', 'clan')
      .order('created_at', { ascending: false });

    res.json({ success: true, invitations: invites || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── RESPOND TO INVITATION ────────────────────────────────────
const respondInvitation = async (req, res) => {
  try {
    const { inviteId, action } = req.body;
    if (!['accept', 'reject'].includes(action)) return res.status(400).json({ success: false, message: 'Invalid action.' });

    const { data: invite } = await supabase.from('clan_join_requests').select('*').eq('id', inviteId).eq('user_id', req.user.id).eq('sender_type', 'clan').single();
    if (!invite || invite.status !== 'pending') return res.status(404).json({ success: false, message: 'Invitation not found.' });

    if (action === 'accept') {
      const { data: existing } = await supabase.from('clan_members').select('id').eq('user_id', req.user.id).maybeSingle();
      if (existing) return res.status(400).json({ success: false, message: 'You are already in a clan.' });

      const { error: insertErr } = await supabase.from('clan_members').insert({
        clan_id: invite.clan_id,
        user_id: req.user.id,
        role: 'member'
      });
      if (insertErr) throw insertErr;

      await supabase.rpc('update_clan_member_count', { p_clan_id: invite.clan_id, p_delta: 1 });
      await supabase.from('clan_join_requests').update({ status: 'accepted' }).eq('id', inviteId);
    } else {
      await supabase.from('clan_join_requests').update({ status: 'rejected' }).eq('id', inviteId);
    }

    res.json({ success: true, message: `Invitation ${action}ed.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  createClan, getMyClan, getClanById, searchClans,
  joinClan, leaveClan, updateMemberRole, kickMember,
  deleteClan, transferLeadership,
  inviteMember, getMyInvitations, respondInvitation,
  declareWar, acceptWar, selectWarLineup,
  getWarDetails, getMyWar, getWarHistory, getPendingWars,
  processWarMatchResult, finalizeWar,
  getClanLeaderboard, CW_POINTS, DRAW_MIN_MOVES,
  getJoinRequests, respondJoinRequest,
};


