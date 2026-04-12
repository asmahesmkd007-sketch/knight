const { supabase, supabaseAnon } = require('../config/supabase');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }
    const token = authHeader.substring(7);

    // Verify token with Supabase using Anon client
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) {
      console.log('JWT Error:', error?.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }

    // Fetch profile from DB
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ success: false, message: 'Profile not found.' });
    }
    if (profile.status === 'blocked' || profile.status === 'banned') {
      return res.status(403).json({ success: false, message: 'Account is blocked.' });
    }

    profile.email = user.email; // Inject email from auth.users
    req.user = profile;
    req.supabase_token = token;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ success: false, message: 'Authentication failed.' });
  }
};

module.exports = authMiddleware;
