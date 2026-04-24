const CF = require('cashfree-pg');
console.log('CF keys:', Object.keys(CF));
for (const key of Object.keys(CF)) {
    console.log(`Type of ${key}:`, typeof CF[key]);
}
