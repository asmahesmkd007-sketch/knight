const { Cashfree, CFEnvironment } = require('cashfree-pg');
const dotenv = require('dotenv');
dotenv.config();

const mode = (process.env.CASHFREE_MODE === 'production') ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
const appId = (process.env.CASHFREE_APP_ID || '').trim();
const secretKey = (process.env.CASHFREE_SECRET_KEY || '').trim();

const cashfree = new Cashfree(mode, appId, secretKey);

console.log('Testing PGOrderFetch WITHOUT version string...');
cashfree.PGOrderFetch('test_1777065077943') // Use the ID from previous success
  .then(res => {
    console.log('SUCCESS:', res.data);
  })
  .catch(err => {
    console.log('FAILED:', err.response?.data || err.message);
  });
