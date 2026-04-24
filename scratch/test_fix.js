const { Cashfree, CFEnvironment } = require('cashfree-pg');
console.log('CFEnvironment.SANDBOX:', CFEnvironment.SANDBOX);
try {
    Cashfree.XEnvironment = CFEnvironment.SANDBOX;
    console.log('Successfully set Cashfree.XEnvironment');
} catch (e) {
    console.log('Failed to set Cashfree.XEnvironment:', e.message);
}
