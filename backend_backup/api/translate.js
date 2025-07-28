const express = require('express');
const router = express.Router();

// Simple word translations
const translations = {
    'HELLO': 'Hello',
    'HI': 'Hi',
    'BYE': 'Goodbye',
    'YES': 'Yes',
    'NO': 'No',
    'PLEASE': 'Please',
    'THANK': 'Thank you',
    'SORRY': 'Sorry',
    'HELP': 'Help',
    'LOVE': 'Love'
};

// POST /api/translate - Translate sign language to text
router.post('/', (req, res) => {
    console.log('📍 Translate route hit with:', req.body);

    try {
        const { word, type } = req.body;

        if (!word || !type) {
            return res.status(400).json({
                error: 'Missing required fields: word and type'
            });
        }

        if (type === 'sign_to_text') {
            const upperWord = word.toString().toUpperCase();
            const translation = translations[upperWord] || `"${word}" (unknown word)`;

            res.json({
                original: word,
                translation: translation,
                type: 'sign_to_text',
                confidence: translations[upperWord] ? 0.9 : 0.3,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(400).json({
                error: 'Unsupported translation type. Use: sign_to_text'
            });
        }
    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

module.exports = router;
