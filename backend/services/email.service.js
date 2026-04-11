const nodemailer = require('nodemailer');

const sendAdminEmail = async ({ subject, html }) => {
  try {
    // Determine configured credentials or use dummy / trap
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      console.warn('⚠️ EMAIL_USER or EMAIL_PASS not set in .env. Skipping email dispatch.');
      return false; // Skip if no config
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });

    const mailOptions = {
      from: `"PHOENIX X Admin System" <${user}>`,
      to: 'phoenixbrothersofficial@gmail.com', // Always route to admin
      subject: subject,
      html: html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Admin Notification Sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return false;
  }
};

module.exports = { sendAdminEmail };
