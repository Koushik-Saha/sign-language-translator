const express = require('express');
const router = express.Router();

// Test route
router.get('/', (req, res) => {
    console.log('📍 API root route hit');
    res.json({ message: 'API is working!' });
});

// Translation routes
router.use('/translate', require('./translate'));

module.exports = router;
