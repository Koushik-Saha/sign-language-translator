const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { auth, optionalAuth } = require('../middleware/auth');
const inputValidation = require('../middleware/inputValidation');
const gestureLibraryService = require('../services/gestureLibraryService');
const logger = require('../services/logger');

const router = express.Router();

// Get available sign language libraries
router.get('/libraries', optionalAuth, async (req, res) => {
  try {
    const libraries = gestureLibraryService.getAvailableLibraries();
    const libraryDetails = libraries.map(code => {
      const library = gestureLibraryService.getLibrary(code);
      return {
        code,
        name: library.name,
        region: library.region,
        alphabetSize: Object.keys(library.alphabet || {}).length,
        wordCount: Object.keys(library.commonWords || {}).length,
        phraseCount: Object.keys(library.phrases || {}).length
      };
    });

    res.json({
      success: true,
      data: {
        availableLibraries: libraryDetails,
        totalLibraries: libraries.length
      }
    });

  } catch (error) {
    logger.error('Get libraries error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching gesture libraries'
    });
  }
});

// Get specific library details
router.get('/libraries/:code', optionalAuth, [
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { code } = req.params;
    const library = gestureLibraryService.getLibrary(code);

    if (!library) {
      return res.status(404).json({
        success: false,
        message: `Library ${code} not found`
      });
    }

    res.json({
      success: true,
      data: { library }
    });

  } catch (error) {
    logger.error('Get library details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching library details'
    });
  }
});

// Search for gestures across libraries
router.get('/search', optionalAuth, [
  query('word').notEmpty().withMessage('Search word is required'),
  query('libraries').optional().isString(),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { word, libraries } = req.query;
    const searchLibraries = libraries ? libraries.split(',') : ['ASL', 'BSL', 'LSF'];

    const results = gestureLibraryService.searchGesture(word, searchLibraries);

    res.json({
      success: true,
      data: {
        searchTerm: word,
        searchedLibraries: searchLibraries,
        results,
        totalResults: results.length
      }
    });

  } catch (error) {
    logger.error('Gesture search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching gestures'
    });
  }
});

// Translate text to sign language sequence
router.post('/translate', optionalAuth, [
  body('text').notEmpty().withMessage('Text is required'),
  body('targetLibrary').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { text, targetLibrary = 'BSL' } = req.body;

    const translation = gestureLibraryService.translateToSignSequence(text, targetLibrary);

    res.json({
      success: true,
      data: translation
    });

  } catch (error) {
    logger.error('Translation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error translating text to sign language'
    });
  }
});

// Get gesture categories for a library
router.get('/libraries/:code/categories', optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const categories = gestureLibraryService.getGestureCategories(code);

    res.json({
      success: true,
      data: {
        library: code,
        categories,
        totalCategories: categories.length
      }
    });

  } catch (error) {
    logger.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching gesture categories'
    });
  }
});

// Get gestures by category
router.get('/libraries/:code/categories/:category', optionalAuth, async (req, res) => {
  try {
    const { code, category } = req.params;
    const gestures = gestureLibraryService.getGesturesByCategory(code, category);

    res.json({
      success: true,
      data: {
        library: code,
        category,
        gestures,
        totalGestures: gestures.length
      }
    });

  } catch (error) {
    logger.error('Get gestures by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching gestures by category'
    });
  }
});

// Compare gesture across libraries
router.get('/compare/:word', optionalAuth, async (req, res) => {
  try {
    const { word } = req.params;
    const comparison = gestureLibraryService.compareGesturesAcrossLibraries(word);

    if (Object.keys(comparison).length === 0) {
      return res.status(404).json({
        success: false,
        message: `No gestures found for "${word}" in any library`
      });
    }

    res.json({
      success: true,
      data: {
        word,
        comparison,
        availableIn: Object.keys(comparison)
      }
    });

  } catch (error) {
    logger.error('Compare gestures error:', error);
    res.status(500).json({
      success: false,
      message: 'Error comparing gestures'
    });
  }
});

// Generate learning sequence
router.post('/learning-sequence', optionalAuth, [
  body('words').isArray({ min: 1 }).withMessage('Words array is required'),
  body('targetLibrary').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { words, targetLibrary = 'BSL' } = req.body;

    const sequence = gestureLibraryService.generateLearningSequence(words, targetLibrary);

    res.json({
      success: true,
      data: sequence
    });

  } catch (error) {
    logger.error('Generate learning sequence error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error generating learning sequence'
    });
  }
});

// Get alphabet for a library
router.get('/libraries/:code/alphabet', optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const library = gestureLibraryService.getLibrary(code);

    if (!library) {
      return res.status(404).json({
        success: false,
        message: `Library ${code} not found`
      });
    }

    res.json({
      success: true,
      data: {
        library: code,
        alphabet: library.alphabet || {},
        totalLetters: Object.keys(library.alphabet || {}).length
      }
    });

  } catch (error) {
    logger.error('Get alphabet error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching alphabet'
    });
  }
});

// Get numbers for a library
router.get('/libraries/:code/numbers', optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const library = gestureLibraryService.getLibrary(code);

    if (!library) {
      return res.status(404).json({
        success: false,
        message: `Library ${code} not found`
      });
    }

    res.json({
      success: true,
      data: {
        library: code,
        numbers: library.numbers || {},
        totalNumbers: Object.keys(library.numbers || {}).length
      }
    });

  } catch (error) {
    logger.error('Get numbers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching numbers'
    });
  }
});

// Get common words for a library
router.get('/libraries/:code/words', optionalAuth, [
  query('category').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const { code } = req.params;
    const { category, limit = 100, offset = 0 } = req.query;
    
    const library = gestureLibraryService.getLibrary(code);

    if (!library) {
      return res.status(404).json({
        success: false,
        message: `Library ${code} not found`
      });
    }

    let words = library.commonWords || {};

    // Filter by category if specified
    if (category) {
      words = Object.fromEntries(
        Object.entries(words).filter(([word, gesture]) => gesture.category === category)
      );
    }

    // Apply pagination
    const wordEntries = Object.entries(words);
    const paginatedEntries = wordEntries.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    const paginatedWords = Object.fromEntries(paginatedEntries);

    res.json({
      success: true,
      data: {
        library: code,
        category: category || 'all',
        words: paginatedWords,
        pagination: {
          offset: parseInt(offset),
          limit: parseInt(limit),
          total: wordEntries.length,
          returned: paginatedEntries.length
        }
      }
    });

  } catch (error) {
    logger.error('Get words error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching words'
    });
  }
});

// Get phrases for a library
router.get('/libraries/:code/phrases', optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const library = gestureLibraryService.getLibrary(code);

    if (!library) {
      return res.status(404).json({
        success: false,
        message: `Library ${code} not found`
      });
    }

    res.json({
      success: true,
      data: {
        library: code,
        phrases: library.phrases || {},
        totalPhrases: Object.keys(library.phrases || {}).length
      }
    });

  } catch (error) {
    logger.error('Get phrases error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching phrases'
    });
  }
});

// Get grammar rules for a library
router.get('/libraries/:code/grammar', optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const library = gestureLibraryService.getLibrary(code);

    if (!library) {
      return res.status(404).json({
        success: false,
        message: `Library ${code} not found`
      });
    }

    res.json({
      success: true,
      data: {
        library: code,
        grammar: library.grammar || {},
        name: library.name
      }
    });

  } catch (error) {
    logger.error('Get grammar error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching grammar rules'
    });
  }
});

// Get handshapes for a library
router.get('/libraries/:code/handshapes', optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const library = gestureLibraryService.getLibrary(code);

    if (!library) {
      return res.status(404).json({
        success: false,
        message: `Library ${code} not found`
      });
    }

    res.json({
      success: true,
      data: {
        library: code,
        handshapes: library.handshapes || {},
        totalHandshapes: Object.keys(library.handshapes || {}).length
      }
    });

  } catch (error) {
    logger.error('Get handshapes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching handshapes'
    });
  }
});

// Get movements for a library
router.get('/libraries/:code/movements', optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const library = gestureLibraryService.getLibrary(code);

    if (!library) {
      return res.status(404).json({
        success: false,
        message: `Library ${code} not found`
      });
    }

    res.json({
      success: true,
      data: {
        library: code,
        movements: library.movements || {},
        totalMovements: Object.keys(library.movements || {}).length
      }
    });

  } catch (error) {
    logger.error('Get movements error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching movements'
    });
  }
});

// Get facial expressions for a library
router.get('/libraries/:code/expressions', optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const library = gestureLibraryService.getLibrary(code);

    if (!library) {
      return res.status(404).json({
        success: false,
        message: `Library ${code} not found`
      });
    }

    res.json({
      success: true,
      data: {
        library: code,
        expressions: library.expressions || {},
        totalExpressions: Object.keys(library.expressions || {}).length
      }
    });

  } catch (error) {
    logger.error('Get expressions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expressions'
    });
  }
});

// Advanced search with filters
router.post('/search/advanced', optionalAuth, [
  body('query').optional().isString(),
  body('libraries').optional().isArray(),
  body('categories').optional().isArray(),
  body('handshapes').optional().isArray(),
  body('movements').optional().isArray(),
  body('both_hands').optional().isBoolean(),
  body('complexity').optional().isObject(),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const {
      query = '',
      libraries = ['ASL', 'BSL', 'LSF'],
      categories = [],
      handshapes = [],
      movements = [],
      both_hands,
      complexity = {}
    } = req.body;

    let results = [];

    // Search across specified libraries
    for (const libCode of libraries) {
      const library = gestureLibraryService.getLibrary(libCode);
      if (!library || !library.commonWords) continue;

      for (const [word, gesture] of Object.entries(library.commonWords)) {
        // Text query filter
        if (query && !word.toLowerCase().includes(query.toLowerCase())) {
          continue;
        }

        // Category filter
        if (categories.length > 0 && !categories.includes(gesture.category)) {
          continue;
        }

        // Handshape filter
        if (handshapes.length > 0 && !handshapes.includes(gesture.handshape)) {
          continue;
        }

        // Movement filter
        if (movements.length > 0 && !movements.includes(gesture.movement)) {
          continue;
        }

        // Both hands filter
        if (both_hands !== undefined && gesture.both_hands !== both_hands) {
          continue;
        }

        // Complexity filter
        const gestureComplexity = gestureLibraryService.getGestureComplexity(gesture);
        if (complexity.min && gestureComplexity < complexity.min) {
          continue;
        }
        if (complexity.max && gestureComplexity > complexity.max) {
          continue;
        }

        results.push({
          library: libCode,
          word,
          gesture,
          complexity: gestureComplexity
        });
      }
    }

    // Sort results by relevance (exact matches first, then by complexity)
    results.sort((a, b) => {
      if (query) {
        const aExact = a.word.toLowerCase() === query.toLowerCase();
        const bExact = b.word.toLowerCase() === query.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
      }
      return a.complexity - b.complexity;
    });

    res.json({
      success: true,
      data: {
        query: req.body,
        results,
        totalResults: results.length,
        searchedLibraries: libraries
      }
    });

  } catch (error) {
    logger.error('Advanced search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing advanced search'
    });
  }
});

module.exports = router;