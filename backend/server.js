const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Sign Language Translation API is running!' });
});

// Text-to-Sign Translation endpoint
app.post('/api/text-to-sign', (req, res) => {
  console.log('Text-to-Sign request:', req.body);

  const { text, options = {} } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required and must be a string' });
  }

  // Parse and analyze the text
  const words = text.replace(/[^\w\s]/g, '').trim().toUpperCase().split(/\s+/).filter(w => w.length > 0);
  
  const knownSigns = ['HELLO', 'HI', 'BYE', 'YES', 'NO', 'PLEASE', 'THANK', 'THANKS', 'SORRY', 'HELP', 'LOVE', 'GOOD', 'BAD', 'DAY', 'NIGHT', 'WATER', 'FOOD', 'HOME', 'WORK', 'FAMILY', 'FRIEND', 'TIME', 'MONEY', 'HAPPY', 'SAD'];
  
  const analysis = {
    totalWords: words.length,
    knownSigns: 0,
    fingerspelledWords: 0,
    requiresFingerspelling: []
  };

  const sequences = words.map(word => {
    if (knownSigns.includes(word)) {
      analysis.knownSigns++;
      return {
        type: 'sign',
        word: word,
        method: 'gesture',
        duration: 1500
      };
    } else {
      analysis.fingerspelledWords++;
      analysis.requiresFingerspelling.push(word);
      return {
        type: 'fingerspelling',
        word: word,
        method: 'letters',
        duration: word.length * 800 + (word.length - 1) * 200
      };
    }
  });

  const totalDuration = sequences.reduce((sum, seq) => sum + seq.duration, 0) + (words.length - 1) * 300;
  const complexityScore = analysis.fingerspelledWords / analysis.totalWords;

  res.json({
    original: text,
    words: words,
    sequences: sequences,
    analysis: {
      ...analysis,
      complexityScore: complexityScore,
      estimatedDuration: totalDuration,
      difficulty: complexityScore < 0.3 ? 'easy' : complexityScore < 0.7 ? 'medium' : 'hard'
    },
    timestamp: new Date().toISOString()
  });
});

// Original sign-to-text endpoint (keep for backward compatibility)
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
