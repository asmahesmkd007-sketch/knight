const { supabase } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const { sendAdminEmail } = require('../services/email.service');

const submitReport = async (req, res) => {
  try {
    const { type, reported_user, issue_type, priority, reason, description, image_base64 } = req.body;
    let screenshot_url = null;

    if (!description) {
      return res.status(400).json({ success: false, message: 'Description is required.' });
    }

    if (image_base64) {
      try {
        // Upload base64 image to Supabase Storage
        const fileExt = image_base64.substring("data:image/".length, image_base64.indexOf(";base64"));
        const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `${uuidv4()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('screenshots')
          .upload(filename, buffer, {
            contentType: `image/${fileExt}`,
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('screenshots')
          .getPublicUrl(filename);
          
        screenshot_url = publicUrlData.publicUrl;
      } catch (err) {
        console.error('Image upload failed:', err);
        // We can continue without image or throw an error. Throwing error to be safe.
        return res.status(400).json({ success: false, message: 'Failed to upload screenshot.' });
      }
    }

    // Insert into reports table
    const { data: reportData, error: dbError } = await supabase
      .from('reports')
      .insert({
        reporter_id: req.user.id,
        type: type || 'issue',
        reported_user: reported_user || null,
        issue_type: issue_type || null,
        priority: priority || 'Low',
        reason: reason || null,
        description,
        screenshot_url
      })
      .select()
      .single();

    if (dbError) {
      return res.status(400).json({ success: false, message: dbError.message });
    }

    // Construct Email
    const isPlayer = type === 'player';
    const emailSubject = isPlayer 
        ? `[REPORT-PLAYER] ${reported_user} - ${reason}` 
        : `[REPORT-${(priority||'Low').toUpperCase()}] ${issue_type} Issue from @${req.user.username}`;
        
    const html = `
      <div style="font-family:sans-serif; max-width:600px; margin:auto; border:1px solid #ddd; padding:20px; border-radius:10px;">
        <h2 style="color:#ef4444;">🚨 New Report Filed</h2>
        <p><strong>Reporter:</strong> @${req.user.username} (ID: ${req.user.id})</p>
        <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
        ${isPlayer ? `
          <p><strong>Target Player:</strong> <span style="color:#f59e0b;font-weight:bold;">${reported_user}</span></p>
          <p><strong>Reason:</strong> ${reason}</p>
        ` : `
          <p><strong>Issue Type:</strong> ${issue_type}</p>
          <p><strong>Priority:</strong> ${priority === 'High' ? `<span style="color:red;font-weight:bold;">HIGH</span>` : priority}</p>
        `}
        <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
        <p><strong>Detailed Description:</strong></p>
        <p style="white-space: pre-wrap; font-size:14px; background:#f9f9f9; padding:15px; border-radius:5px;">${description}</p>
        ${screenshot_url ? `<p style="margin-top:20px;"><a href="${screenshot_url}" style="background:#00d4b4;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;">View Attached Proof</a></p>` : ''}
      </div>
    `;

    // Fire Email
    sendAdminEmail({ subject: emailSubject, html });

    res.json({ success: true, message: 'Report submitted successfully.', report: reportData, screenshot_url });
  } catch (err) {
    console.error('submitReport error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getAllReports = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*, reporter:reporter_id(username, email)')
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, message: error.message });
    
    res.json({ success: true, reports: data });
  } catch (err) {
    console.error('getAllReports error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { data, error } = await supabase.from('reports').update({ status }).eq('id', id).select().single();
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, message: `Report marked as ${status}.`, report: data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { submitReport, getAllReports, updateReportStatus };
