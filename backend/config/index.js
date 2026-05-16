const { supabase } = require('./supabase');
const razorpay = require('./razorpay');

module.exports = {
  supabase,
  ...razorpay
};
