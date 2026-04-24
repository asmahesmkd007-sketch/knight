const { Cashfree } = require('cashfree-pg');
console.log('Cashfree methods:', Object.getOwnPropertyNames(Cashfree).filter(p => typeof Cashfree[p] === 'function'));
console.log('Static methods list:', Object.keys(Cashfree));
