const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use((req, res, next) => {
  console.log(`📍 ${req.method} ${req.path} - Body:`, req.body);
  next();
});
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Sign Language Translation API is running!' });
});

app.post('/api/translate', (req, res) => {
  const { word, type } = req.body;
  const translations = { 'HELLO': 'Hello', 'HI': 'Hi' };
  const translation = translations[word.toUpperCase()] || `"${word}" (unknown)`;
  res.json({ original: word, translation, confidence: 0.9 });
});

app.listen(PORT, () => console.log(`🚀 Server running on port 3001`));
