const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Sign Language Translation API is running!' });
});

app.post('/api/translate', (req, res) => {
  console.log('Translation request:', req.body);

  const { word, type } = req.body;

  // Complete dictionary with common words
  const translations = {
    // Single letters
    'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F', 'G': 'G', 'H': 'H', 'I': 'I', 'J': 'J',
    'K': 'K', 'L': 'L', 'M': 'M', 'N': 'N', 'O': 'O', 'P': 'P', 'Q': 'Q', 'R': 'R', 'S': 'S', 'T': 'T',
    'U': 'U', 'V': 'V', 'W': 'W', 'X': 'X', 'Y': 'Y', 'Z': 'Z',

    // Common words
    'HELLO': 'Hello',
    'HI': 'Hi',
    'BYE': 'Goodbye',
    'YES': 'Yes',
    'NO': 'No',
    'PLEASE': 'Please',
    'THANK': 'Thank you',
    'THANKS': 'Thanks',
    'SORRY': 'Sorry',
    'HELP': 'Help',
    'LOVE': 'Love',
    'GOOD': 'Good',
    'BAD': 'Bad',
    'DAY': 'Day',
    'NIGHT': 'Night',
    'WATER': 'Water',
    'FOOD': 'Food',
    'HOME': 'Home',
    'WORK': 'Work',
    'FAMILY': 'Family',
    'FRIEND': 'Friend',
    'TIME': 'Time',
    'MONEY': 'Money',
    'HAPPY': 'Happy',
    'SAD': 'Sad'
  };

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
    res.status(400).json({ error: 'Unsupported type' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
