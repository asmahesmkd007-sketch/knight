const { supabase } = require('./supabase');
const cashfree = require('./cashfree');

module.exports = {
  supabase,
  ...cashfree
};
