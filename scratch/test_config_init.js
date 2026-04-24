const { Cashfree, Configuration, CFEnvironment } = require('cashfree-pg');
try {
    const config = new Configuration({
        clientId: "TEST_ID",
        clientSecret: "TEST_SECRET",
        environment: CFEnvironment.SANDBOX
    });
    console.log('Successfully created Configuration');
    // Check if Cashfree constructor takes config
    const cashfree = new Cashfree(config);
    console.log('Successfully created Cashfree with config');
} catch (e) {
    console.log('Failed:', e.message);
}
