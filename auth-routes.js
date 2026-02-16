const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('./auth-config');
const { findUserByUsername, findUserById } = require('./database');
const { authenticateToken } = require('./auth-middleware');

const router = express.Router();

// Rate limiter for login to prevent brute force
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login requests per windowMs
    message: { error: 'Too many login attempts, please try again after 15 minutes' }
});

// LOGIN Endpoint
router.post('/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = findUserByUsername(username);
    if (!user) {
        // Use generic error message for security
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT
    const token = jwt.sign(
        { id: user.id, username: user.username },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            name: user.name
        }
    });
});

// LOGOUT Endpoint (Client simply discards token, but this endpoint can be used for logging or cookie clearing if we move to cookies)
router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// ME Endpoint (Protected)
router.get('/me', authenticateToken, (req, res) => {
    const user = findUserById(req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
});

module.exports = router;
