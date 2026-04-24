const { Configuration } = require('cashfree-pg');
console.log('Configuration keys:', Object.keys(Configuration || {}));
if (Configuration) console.log('Configuration properties:', Object.getOwnPropertyNames(Configuration));
