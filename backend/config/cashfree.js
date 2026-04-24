const { Cashfree, CFEnvironment } = require('cashfree-pg');

const cashfree = new Cashfree(
  (process.env.CASHFREE_MODE === 'production') ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
  process.env.CASHFREE_APP_ID || 'TEST_APP_ID',
  process.env.CASHFREE_SECRET_KEY || 'TEST_SECRET_KEY'
);

const createOrder = async ({ amount, userId, phone, email, orderId }) => {
  try {
    const request = {
      order_id: orderId || `order_${Date.now()}_${userId.substring(0, 5)}`,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: userId,
        customer_phone: phone || '9999999999',
        customer_email: email || 'user@example.com',
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pages/wallet.html?order_id={order_id}`,
      }
    };

    // V5 use PGCreateOrder
    const response = await cashfree.PGCreateOrder("2023-08-01", request);
    return response.data;
  } catch (error) {
    console.error('Cashfree Order Creation Error:', error.response?.data || error.message);
    throw error;
  }
};

const verifyWebhookSignature = (signature, rawBody, timestamp) => {
  try {
    // V5 use instance method
    return cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return false;
  }
};

module.exports = { cashfree, createOrder, verifyWebhookSignature };
