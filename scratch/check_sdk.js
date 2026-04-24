const { Cashfree } = require('cashfree-pg');
console.log('Cashfree members:', Object.keys(Cashfree || {}));
if (Cashfree.Environment) console.log('Environment:', Object.keys(Cashfree.Environment));
if (Cashfree.CFEnvironment) console.log('CFEnvironment:', Object.keys(Cashfree.CFEnvironment));
