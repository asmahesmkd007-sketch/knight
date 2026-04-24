const { Cashfree, CFEnvironment } = require('cashfree-pg');
const dotenv = require('dotenv');
dotenv.config();

const mode = (process.env.CASHFREE_MODE === 'production') ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
const appId = (process.env.CASHFREE_APP_ID || '').trim();
const secretKey = (process.env.CASHFREE_SECRET_KEY || '').trim();

const cashfree = new Cashfree(mode, appId, secretKey);

const request = {
  order_amount: 1,
  order_currency: 'INR',
  order_id: `test_${Date.now()}`,
  customer_details: {
    customer_id: 'test_user',
    customer_phone: '9999999999',
  }
};

console.log('Testing WITHOUT version string...');
cashfree.PGCreateOrder(request)
  .then(res => {
    console.log('SUCCESS:', res.data);
  })
  .catch(err => {
    console.log('FAILED:', err.response?.data || err.message);
  });
