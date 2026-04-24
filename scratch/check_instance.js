const { Cashfree } = require('cashfree-pg');
const cf = new Cashfree();
console.log('Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(cf)));
