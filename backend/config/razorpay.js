const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create a new Razorpay Order
 */
const createOrder = async ({ amount, receipt }) => {
  try {
    const options = {
      amount: amount * 100, // Amount in paise
      currency: "INR",
      receipt: receipt || `order_rcpt_${Date.now()}`
    };
    return await razorpay.orders.create(options);
  } catch (error) {
    console.error('Razorpay Order Creation Error:', error);
    throw error;
  }
};

/**
 * Verify Razorpay Payment Signature
 */
const verifySignature = (orderId, paymentId, signature) => {
  const text = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(text)
    .digest("hex");
  return expectedSignature === signature;
};

/**
 * Fetch Payment Details
 */
const fetchPayment = async (paymentId) => {
  try {
    return await razorpay.payments.fetch(paymentId);
  } catch (error) {
    console.error('Razorpay Fetch Payment Error:', error);
    throw error;
  }
};

module.exports = { razorpay, createOrder, verifySignature, fetchPayment };
