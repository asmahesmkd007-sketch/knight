const { supabase } = require('../config/supabase');

// Helper: normalize username to strict @username format
const normalizeUsername = (raw) => {
  if (!raw) return '';
  let u = raw.trim().replace(/\s+/g, '');
  u = u.replace(/^@+/, '');
  u = '@' + u;
  return u.toLowerCase();
};

// Helper: validate @username format
const isValidUsername = (username) => {
  return /^@[a-z0-9_]{4,20}$/.test(username);
};

const getProfile = async (req, res) => {
  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', req.user.id).single();
    
    // Get provider info from auth
    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(req.user.id);
    const provider = authUser?.app_metadata?.provider || 'email';
    // Check identities OR our custom app_metadata flag
    const hasPassword = !!(authUser?.app_metadata?.has_password || authUser?.identities?.find(id => id.provider === 'email'));

    res.json({ success: true, user: { ...profile, provider, hasPassword } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { username: rawUsername, full_name, phone, profile_image } = req.body;
    const updates = {};

    if (rawUsername) {
      const username = normalizeUsername(rawUsername);
      if (!isValidUsername(username)) {
        return res.status(400).json({ success: false, message: 'Username must be @username format: 4-20 characters (a-z, 0-9, underscore), no spaces.' });
      }
      if (username !== req.user.username) {
        const { data: exists } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
        if (exists) return res.status(400).json({ success: false, message: 'Username already taken.' });
      }
      updates.username = username;
    }

    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (profile_image !== undefined) updates.profile_image = profile_image;
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', req.user.id).select().single();
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, message: 'Profile updated.', user: data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const file = req.file;
    const userId = req.user.id;
    const fileName = `${userId}/${Date.now()}_avatar.png`;

    let { data, error } = await supabase.storage.from('avatars').upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

    if (error && error.message.includes('not found')) {
      await supabase.storage.createBucket('avatars', { public: true });
      const retry = await supabase.storage.from('avatars').upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });
      if (retry.error) throw retry.error;
    } else if (error) {
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('Avatar Upload Error:', err);
    res.status(500).json({ success: false, message: 'Upload failed.' });
  }
};

const submitKYC = async (req, res) => {
  try {
    const { type, name, id_number } = req.body;
    if (!type || !name || !id_number) return res.status(400).json({ success: false, message: 'All fields required.' });
    if (type === 'aadhaar' && !/^\d{12}$/.test(id_number)) return res.status(400).json({ success: false, message: 'Invalid Aadhaar number (12 digits).' });
    if (type === 'pan' && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(id_number)) return res.status(400).json({ success: false, message: 'Invalid PAN format (ABCDE1234F).' });
    if (req.user.kyc_status === 'verified') return res.status(400).json({ success: false, message: 'KYC already verified.' });

    // Upsert KYC record
    const { error: kycError } = await supabase.from('kyc').upsert({
      user_id: req.user.id, type, name, id_number, status: 'pending', rejection_reason: '',
    }, { onConflict: 'user_id' });
    if (kycError) return res.status(400).json({ success: false, message: kycError.message });

    // Update profile kyc_status
    await supabase.from('profiles').update({ kyc_status: 'pending' }).eq('id', req.user.id);

    // Notification
    await supabase.from('notifications').insert({
      user_id: req.user.id, type: 'kyc',
      title: 'KYC Submitted',
      message: 'Your KYC is under review. Usually takes up to 24 hours.',
    });

    res.json({ success: true, message: 'KYC submitted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    if (!new_password || new_password.length < 6 || new_password.length > 12) {
        return res.status(400).json({ success: false, message: 'Password must be between 6 and 12 characters.' });
    }
    
    // Fetch email to use in signInWithPassword via Admin API since user might not be in req session exactly
    const { data: { user: adminUser }, error: userErr } = await supabase.auth.admin.getUserById(req.user.id);
    if (userErr || !adminUser) return res.status(400).json({ success: false, message: 'Auth session invalid.' });

    // Only verify old password if the user has an email identity (meaning they have a password)
    const hasPassword = !!(adminUser.identities?.find(id => id.provider === 'email'));
    
    if (hasPassword) {
      if (!old_password) return res.status(400).json({ success: false, message: 'Current password is required.' });
      const { createClient } = require('@supabase/supabase-js');
      const tempClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error: signInError } = await tempClient.auth.signInWithPassword({ email: adminUser.email, password: old_password });
      if (signInError) return res.status(401).json({ success: false, message: 'Incorrect current password.' });
    }

    const { error } = await supabase.auth.admin.updateUserById(req.user.id, { 
      password: new_password,
      app_metadata: { ...adminUser.app_metadata, has_password: true }
    });
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, message: hasPassword ? 'Password changed successfully.' : 'Password set successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ success: false, message: 'Invalid settings format.' });

    const sanitized = {
      theme: settings.theme === 'light' ? 'light' : 'dark',
      highlight_moves: !!settings.highlight_moves,
      legal_moves: !!settings.legal_moves,
      premoves: !!settings.premoves,
      result_animation: !!settings.result_animation,
      chat_enabled: !!settings.chat_enabled,
      language: typeof settings.language === 'string' ? settings.language.substring(0, 5) : 'en',
      challenge_mode: typeof settings.challenge_mode === 'string' ? settings.challenge_mode.substring(0, 20) : 'auto_accept'
    };

    if (settings.notifications && typeof settings.notifications === 'object') {
       sanitized.notifications = {
         match_found: !!settings.notifications.match_found,
         tournament: !!settings.notifications.tournament,
         friend_request: !!settings.notifications.friend_request
       };
    }
    
    if (settings.privacy && typeof settings.privacy === 'object') {
       sanitized.privacy = {
         online_status: !!settings.privacy.online_status,
         visibility: typeof settings.privacy.visibility === 'string' ? settings.privacy.visibility.substring(0, 10) : 'public',
         friend_requests: typeof settings.privacy.friend_requests === 'string' ? settings.privacy.friend_requests.substring(0, 20) : 'everyone'
       };
    }

    const { error } = await supabase.from('profiles').update({ settings: sanitized }).eq('id', req.user.id);
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, message: 'Settings saved.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getNotifications = async (req, res) => {
  try {
    const { data: allNotifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (allNotifs && allNotifs.length > 5) {
      const idsToDelete = allNotifs.slice(5).map(n => n.id);
      await supabase.from('notifications').delete().in('id', idsToDelete);
      return res.json({ success: true, notifications: allNotifs.slice(0, 5) });
    }

    res.json({ success: true, notifications: allNotifs || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const markNotificationsRead = async (req, res) => {
  try {
    await supabase.from('notifications').update({ read: true }).eq('user_id', req.user.id).eq('read', false);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getStats = async (req, res) => {
  try {
    const { data } = await supabase.from('profiles').select('iq_level, rank, total_matches, wins, losses, draws, win_rate, current_streak, best_streak').eq('id', req.user.id).single();
    res.json({ success: true, stats: { total_matches: data.total_matches, wins: data.wins, losses: data.losses, draws: data.draws, win_rate: data.win_rate, current_streak: data.current_streak, best_streak: data.best_streak }, iq_level: data.iq_level, rank: data.rank });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updatePayoutDetails = async (req, res) => {
  try {
    const { app, upi } = req.body;
    if (!app || !upi) return res.status(400).json({ success: false, message: 'App and UPI ID required.' });
    const { error } = await supabase.from('profiles').update({ payout_details: { app, upi } }).eq('id', req.user.id);
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, message: 'Payout details updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getProfile, updateProfile, uploadAvatar, submitKYC, changePassword, updateSettings, getNotifications, markNotificationsRead, getStats, updatePayoutDetails };
