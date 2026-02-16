const path = require('path');

module.exports = {
    // In production, this should be an environment variable.
    // For this local desktop app, a fixed key or auto-generated one is acceptable.
    JWT_SECRET: process.env.JWT_SECRET || 'scriptflow-local-secret-key-change-this-in-prod',
    JWT_EXPIRES_IN: '24h',
    BCRYPT_ROUNDS: 10,
    DB_PATH: path.join(__dirname, 'scriptflow.db')
};
