const { supabase } = require('../config/supabase');
const { sendAdminEmail } = require('../services/email.service');

const submitFeedback = async (req, res) => {
  try {
    const { rating, message, name, email } = req.body;

    if (!rating || !message) {
      return res.status(400).json({ success: false, message: 'Rating and message are required.' });
    }

    // Insert into Supabase
    const { data: feedbackData, error: dbError } = await supabase
      .from('feedbacks')
      .insert({
        user_id: req.user.id,
        rating: parseInt(rating),
        message
      })
      .select()
      .single();

    if (dbError) {
      // Allow graceful degradation if table doesn't exist yet but email is configured
      console.error('Feedback DB Insert Warning:', dbError.message);
    }

    // Construct Email Content
    const subject = `[FEEDBACK] ${rating} Stars from ${name || req.user.username}`;
    const html = `
      <div style="font-family:sans-serif; max-width:600px; margin:auto; border:1px solid #ddd; padding:20px; border-radius:10px;">
        <h2 style="color:#ff6b35;">New Feedback Received!</h2>
        <p><strong>From:</strong> ${name || 'User'} (@${req.user.username})</p>
        <p><strong>Email:</strong> ${email || 'Not provided'}</p>
        <p><strong>Rating:</strong> <span style="color:#fbbf24; font-size:18px;">${'★'.repeat(parseInt(rating))}${'☆'.repeat(5 - parseInt(rating))}</span></p>
        <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
        <p style="white-space: pre-wrap; font-size:14px; background:#f9f9f9; padding:15px; border-radius:5px;">${message}</p>
      </div>
    `;

    // Fire & Forget the email
    sendAdminEmail({ subject, html });

    res.json({ success: true, message: 'Feedback submitted successfully.' });

  } catch (err) {
    console.error('submitFeedback error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getFeedbacks = async (req, res) => {
  try {
    // Requires ADMIN only, handled by middleware usually
    const { data, error } = await supabase
      .from('feedbacks')
      .select('*, user:user_id(username, email)')
      .order('created_at', { ascending: false });

    if (error) {
       return res.status(400).json({ success: false, message: error.message });
    }

    res.json({ success: true, feedbacks: data });
  } catch (err) {
    console.error('getFeedbacks error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { submitFeedback, getFeedbacks };
