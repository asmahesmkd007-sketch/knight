const { Cashfree } = require('cashfree-pg');
const cf = new Cashfree();
console.log('PGVerifyWebhookSignature string:', cf.PGVerifyWebhookSignature.toString());
