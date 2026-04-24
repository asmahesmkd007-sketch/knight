const { Cashfree, CFEnvironment } = require('cashfree-pg');
try {
    const cashfree = new Cashfree(CFEnvironment.SANDBOX, "TEST_ID", "TEST_SECRET");
    console.log('Successfully initialized Cashfree instance');
    console.log('PGCreateOrder type:', typeof cashfree.PGCreateOrder);
} catch (e) {
    console.log('Failed to initialize:', e.message);
}
