const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Sign Language Translation API is running!' });
});

// API routes
app.use('/api', require('./api'));

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
