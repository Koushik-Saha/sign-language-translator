const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: { user: req.user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
});

// Update profile
router.put('/', auth, [
  body('profile.firstName').optional().trim().isLength({ max: 50 }),
  body('profile.lastName').optional().trim().isLength({ max: 50 }),
  body('profile.dateOfBirth').optional().isISO8601(),
  body('profile.preferredLanguage').optional().isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']),
  body('profile.skillLevel').optional().isIn(['beginner', 'intermediate', 'advanced']),
  body('profile.learningGoals').optional().isArray(),
  body('profile.learningGoals.*').optional().isString().trim().isLength({ max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { profile } = req.body;
    const user = await User.findById(req.user._id);

    if (profile) {
      Object.keys(profile).forEach(key => {
        if (profile[key] !== undefined) {
          user.profile[key] = profile[key];
        }
      });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

// Update preferences
router.put('/preferences', auth, [
  body('theme').optional().isIn(['light', 'dark', 'auto']),
  body('fontSize').optional().isIn(['small', 'medium', 'large']),
  body('highContrast').optional().isBoolean(),
  body('notifications.email').optional().isBoolean(),
  body('notifications.push').optional().isBoolean(),
  body('notifications.achievements').optional().isBoolean(),
  body('notifications.reminders').optional().isBoolean(),
  body('camera.mirrorMode').optional().isBoolean(),
  body('camera.resolution').optional().isIn(['480p', '720p', '1080p']),
  body('camera.frameRate').optional().isInt({ min: 15, max: 60 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user._id);
    const updates = req.body;

    Object.keys(updates).forEach(key => {
      if (typeof updates[key] === 'object' && updates[key] !== null) {
        Object.keys(updates[key]).forEach(subKey => {
          if (updates[key][subKey] !== undefined) {
            user.preferences[key][subKey] = updates[key][subKey];
          }
        });
      } else if (updates[key] !== undefined) {
        user.preferences[key] = updates[key];
      }
    });

    await user.save();

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences: user.preferences }
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating preferences'
    });
  }
});

// Add learning session
router.post('/learning-session', auth, [
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('endTime').optional().isISO8601(),
  body('duration').optional().isInt({ min: 0 }),
  body('gesturesAttempted').optional().isInt({ min: 0 }),
  body('gesturesCorrect').optional().isInt({ min: 0 }),
  body('lesson').optional().isString(),
  body('difficulty').optional().isIn(['easy', 'medium', 'hard']),
  body('improvements').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user._id);
    const sessionData = req.body;

    if (sessionData.gesturesAttempted > 0) {
      sessionData.accuracy = (sessionData.gesturesCorrect / sessionData.gesturesAttempted) * 100;
    }

    user.updateLearningHistory(sessionData);
    await user.save();

    res.json({
      success: true,
      message: 'Learning session recorded successfully',
      data: { 
        session: sessionData,
        statistics: user.statistics 
      }
    });

  } catch (error) {
    console.error('Add learning session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording learning session'
    });
  }
});

// Get learning history
router.get('/learning-history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    const user = await User.findById(req.user._id);

    let history = user.learningHistory;

    if (startDate || endDate) {
      history = history.filter(session => {
        const sessionDate = new Date(session.startTime);
        if (startDate && sessionDate < new Date(startDate)) return false;
        if (endDate && sessionDate > new Date(endDate)) return false;
        return true;
      });
    }

    history.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedHistory = history.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        history: paginatedHistory,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: history.length,
          pages: Math.ceil(history.length / limit)
        },
        statistics: user.statistics
      }
    });

  } catch (error) {
    console.error('Get learning history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching learning history'
    });
  }
});

// Add personal vocabulary
router.post('/vocabulary', auth, [
  body('gesture').notEmpty().withMessage('Gesture name is required'),
  body('meaning').notEmpty().withMessage('Gesture meaning is required'),
  body('category').optional().isString(),
  body('difficulty').optional().isIn(['easy', 'medium', 'hard']),
  body('videoUrl').optional().isURL(),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user._id);
    const vocabularyItem = req.body;

    const existingItem = user.personalVocabulary.find(
      item => item.gesture.toLowerCase() === vocabularyItem.gesture.toLowerCase()
    );

    if (existingItem) {
      return res.status(409).json({
        success: false,
        message: 'Gesture already exists in personal vocabulary'
      });
    }

    user.personalVocabulary.push(vocabularyItem);
    await user.save();

    res.json({
      success: true,
      message: 'Vocabulary item added successfully',
      data: { vocabularyItem }
    });

  } catch (error) {
    console.error('Add vocabulary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding vocabulary item'
    });
  }
});

// Get personal vocabulary
router.get('/vocabulary', auth, async (req, res) => {
  try {
    const { category, difficulty, search, page = 1, limit = 50 } = req.query;
    const user = await User.findById(req.user._id);

    let vocabulary = user.personalVocabulary;

    if (category) {
      vocabulary = vocabulary.filter(item => item.category === category);
    }

    if (difficulty) {
      vocabulary = vocabulary.filter(item => item.difficulty === difficulty);
    }

    if (search) {
      const searchTerm = search.toLowerCase();
      vocabulary = vocabulary.filter(item =>
        item.gesture.toLowerCase().includes(searchTerm) ||
        item.meaning.toLowerCase().includes(searchTerm) ||
        (item.notes && item.notes.toLowerCase().includes(searchTerm))
      );
    }

    vocabulary.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedVocabulary = vocabulary.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        vocabulary: paginatedVocabulary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: vocabulary.length,
          pages: Math.ceil(vocabulary.length / limit)
        },
        categories: [...new Set(user.personalVocabulary.map(item => item.category).filter(Boolean))]
      }
    });

  } catch (error) {
    console.error('Get vocabulary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vocabulary'
    });
  }
});

// Update vocabulary item
router.put('/vocabulary/:itemId', auth, [
  body('meaning').optional().notEmpty(),
  body('category').optional().isString(),
  body('difficulty').optional().isIn(['easy', 'medium', 'hard']),
  body('videoUrl').optional().isURL(),
  body('notes').optional().isString(),
  body('masteryLevel').optional().isInt({ min: 0, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user._id);
    const vocabularyItem = user.personalVocabulary.id(req.params.itemId);

    if (!vocabularyItem) {
      return res.status(404).json({
        success: false,
        message: 'Vocabulary item not found'
      });
    }

    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        vocabularyItem[key] = req.body[key];
      }
    });

    await user.save();

    res.json({
      success: true,
      message: 'Vocabulary item updated successfully',
      data: { vocabularyItem }
    });

  } catch (error) {
    console.error('Update vocabulary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating vocabulary item'
    });
  }
});

// Delete vocabulary item
router.delete('/vocabulary/:itemId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const vocabularyItem = user.personalVocabulary.id(req.params.itemId);

    if (!vocabularyItem) {
      return res.status(404).json({
        success: false,
        message: 'Vocabulary item not found'
      });
    }

    vocabularyItem.deleteOne();
    await user.save();

    res.json({
      success: true,
      message: 'Vocabulary item deleted successfully'
    });

  } catch (error) {
    console.error('Delete vocabulary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting vocabulary item'
    });
  }
});

// Add achievement
router.post('/achievements', auth, [
  body('id').notEmpty().withMessage('Achievement ID is required'),
  body('name').notEmpty().withMessage('Achievement name is required'),
  body('description').optional().isString(),
  body('category').optional().isString(),
  body('points').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user._id);
    const achievement = req.body;

    user.addAchievement(achievement);
    await user.save();

    res.json({
      success: true,
      message: 'Achievement added successfully',
      data: { 
        achievement,
        newLevel: user.statistics.level,
        totalPoints: user.statistics.totalPoints
      }
    });

  } catch (error) {
    console.error('Add achievement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding achievement'
    });
  }
});

// Get achievements
router.get('/achievements', auth, async (req, res) => {
  try {
    const { category } = req.query;
    const user = await User.findById(req.user._id);

    let achievements = user.achievements;

    if (category) {
      achievements = achievements.filter(achievement => achievement.category === category);
    }

    achievements.sort((a, b) => new Date(b.dateEarned) - new Date(a.dateEarned));

    res.json({
      success: true,
      data: {
        achievements,
        statistics: user.statistics,
        categories: [...new Set(user.achievements.map(a => a.category).filter(Boolean))]
      }
    });

  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching achievements'
    });
  }
});

// Get user statistics
router.get('/statistics', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    const recentSessions = user.learningHistory
      .slice(-10)
      .map(session => ({
        date: session.startTime,
        accuracy: session.accuracy,
        duration: session.duration,
        gesturesLearned: session.gesturesCorrect
      }));

    const weeklyProgress = {};
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    user.learningHistory
      .filter(session => new Date(session.startTime) >= thirtyDaysAgo)
      .forEach(session => {
        const week = Math.floor((Date.now() - new Date(session.startTime)) / (7 * 24 * 60 * 60 * 1000));
        if (!weeklyProgress[week]) {
          weeklyProgress[week] = { sessions: 0, totalTime: 0, totalAccuracy: 0 };
        }
        weeklyProgress[week].sessions++;
        weeklyProgress[week].totalTime += session.duration || 0;
        weeklyProgress[week].totalAccuracy += session.accuracy || 0;
      });

    Object.keys(weeklyProgress).forEach(week => {
      weeklyProgress[week].averageAccuracy = 
        weeklyProgress[week].totalAccuracy / weeklyProgress[week].sessions;
    });

    res.json({
      success: true,
      data: {
        statistics: user.statistics,
        recentSessions,
        weeklyProgress,
        vocabularyCount: user.personalVocabulary.length,
        achievementCount: user.achievements.length
      }
    });

  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics'
    });
  }
});

module.exports = router;