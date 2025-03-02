const crypto = require('crypto');

// Generate a random JWT secret key (64 bytes in hexadecimal)
const jwtSecret = crypto.randomBytes(64).toString('hex');

console.log(jwtSecret);
