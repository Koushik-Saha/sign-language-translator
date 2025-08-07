require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const http = require('http');
const path = require('path');

// Import middleware
const inputValidation = require('./middleware/inputValidation');
const advancedRateLimiting = require('./middleware/advancedRateLimiting');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sign-language-translator', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Security middleware (order matters)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(morgan('combined'));

// Rate limiting (before other middleware)
app.use(advancedRateLimiting.dosProtection);
app.use(advancedRateLimiting.connectionLimit);
app.use(advancedRateLimiting.slowDown);
app.use(advancedRateLimiting);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing with limits
app.use(express.json({ 
  limit: '10mb',
  type: 'application/json',
  verify: (req, res, buf) => {
    // Store raw body for verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Input validation and sanitization middleware
app.use(inputValidation.sanitizeRequest());
app.use(inputValidation.detectMaliciousInput());

// Import routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const learningRoutes = require('./routes/learning');
const mlRoutes = require('./routes/ml');
const communicationRoutes = require('./routes/communication');
const gdprRoutes = require('./routes/gdpr');
const metricsRoutes = require('./routes/metrics');
const gestureLibraryRoutes = require('./routes/gestureLibrary');
const publicApiRoutes = require('./routes/publicApi');
const apiKeysRoutes = require('./routes/apiKeys');

// Initialize Socket.IO
const SocketManager = require('./socket/index');
const socketManager = new SocketManager(server);

app.get('/', (req, res) => {
  res.json({ message: 'Sign Language Translation API is running!' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/gestures', gestureLibraryRoutes);
app.use('/api/public', publicApiRoutes);
app.use('/api/api-keys', apiKeysRoutes);

// Static file serving for uploaded content
app.use('/api/training-data/video', express.static(path.join(__dirname, 'uploads/training-data')));

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

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server initialized`);
  console.log(`🤖 ML Pipeline ready`);
  console.log(`💬 Real-time communication enabled`);
});
