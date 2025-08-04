const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Learning content data
const learningContent = {
  alphabet: {
    id: 'alphabet',
    title: 'ASL Alphabet',
    description: 'Learn the American Sign Language alphabet',
    difficulty: 'beginner',
    lessons: [
      { id: 'letters-a-m', title: 'Letters A-M', letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'] },
      { id: 'letters-n-z', title: 'Letters N-Z', letters: ['N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'] }
    ]
  },
  basicWords: {
    id: 'basic-words',
    title: 'Basic Words',
    description: 'Common words and phrases in ASL',
    difficulty: 'beginner',
    lessons: [
      { 
        id: 'greetings', 
        title: 'Greetings & Polite Words',
        words: ['HELLO', 'HI', 'BYE', 'PLEASE', 'THANK', 'SORRY', 'EXCUSE'] 
      },
      { 
        id: 'family', 
        title: 'Family & People',
        words: ['FAMILY', 'MOTHER', 'FATHER', 'SISTER', 'BROTHER', 'FRIEND', 'BABY'] 
      },
      { 
        id: 'emotions', 
        title: 'Emotions & Feelings',
        words: ['HAPPY', 'SAD', 'ANGRY', 'EXCITED', 'TIRED', 'LOVE', 'HATE'] 
      }
    ]
  },
  intermediate: {
    id: 'intermediate',
    title: 'Intermediate Signs',
    description: 'More complex signs and phrases',
    difficulty: 'intermediate',
    lessons: [
      { 
        id: 'activities', 
        title: 'Daily Activities',
        words: ['WORK', 'SCHOOL', 'EAT', 'DRINK', 'SLEEP', 'PLAY', 'STUDY', 'READ', 'WRITE'] 
      },
      { 
        id: 'time-weather', 
        title: 'Time & Weather',
        words: ['TIME', 'DAY', 'NIGHT', 'MORNING', 'AFTERNOON', 'SUNNY', 'RAIN', 'COLD', 'HOT'] 
      }
    ]
  },
  advanced: {
    id: 'advanced',
    title: 'Advanced Signs',
    description: 'Complex phrases and conversational signs',
    difficulty: 'advanced',
    lessons: [
      { 
        id: 'conversation', 
        title: 'Conversational Phrases',
        words: ['UNDERSTAND', 'CONFUSED', 'EXPLAIN', 'QUESTION', 'ANSWER', 'OPINION', 'AGREE', 'DISAGREE'] 
      }
    ]
  }
};

const achievements = {
  first_lesson: { id: 'first_lesson', name: 'First Steps', description: 'Complete your first lesson', points: 50 },
  alphabet_master: { id: 'alphabet_master', name: 'Alphabet Master', description: 'Complete all alphabet lessons', points: 200 },
  perfect_score: { id: 'perfect_score', name: 'Perfect Score', description: 'Get 100% accuracy in a lesson', points: 100 },
  week_streak: { id: 'week_streak', name: 'Week Warrior', description: 'Practice for 7 days in a row', points: 300 },
  vocabulary_builder: { id: 'vocabulary_builder', name: 'Vocabulary Builder', description: 'Add 10 custom gestures', points: 150 }
};

// Get all learning modules
router.get('/modules', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    const modules = Object.values(learningContent).map(module => ({
      ...module,
      completed: user.learningHistory.some(h => h.lesson === module.id && h.accuracy >= 80),
      totalLessons: module.lessons.length,
      completedLessons: module.lessons.filter(lesson => 
        user.learningHistory.some(h => h.lesson === lesson.id && h.accuracy >= 80)
      ).length
    }));

    res.json({
      success: true,
      data: { modules }
    });

  } catch (error) {
    console.error('Get modules error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching learning modules'
    });
  }
});

// Get specific module with lessons
router.get('/modules/:moduleId', auth, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const module = learningContent[moduleId];

    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Learning module not found'
      });
    }

    const user = await User.findById(req.user._id);
    
    const moduleWithProgress = {
      ...module,
      lessons: module.lessons.map(lesson => {
        const history = user.learningHistory.filter(h => h.lesson === lesson.id);
        const bestScore = history.length > 0 ? Math.max(...history.map(h => h.accuracy)) : 0;
        const attempts = history.length;
        const completed = bestScore >= 80;

        return {
          ...lesson,
          bestScore,
          attempts,
          completed,
          stars: bestScore >= 95 ? 3 : bestScore >= 85 ? 2 : bestScore >= 80 ? 1 : 0
        };
      })
    };

    res.json({
      success: true,
      data: { module: moduleWithProgress }
    });

  } catch (error) {
    console.error('Get module error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching learning module'
    });
  }
});

// Start a lesson
router.post('/lessons/:lessonId/start', auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    
    let lesson = null;
    let module = null;
    
    for (const mod of Object.values(learningContent)) {
      const foundLesson = mod.lessons.find(l => l.id === lessonId);
      if (foundLesson) {
        lesson = foundLesson;
        module = mod;
        break;
      }
    }

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const practiceItems = lesson.letters || lesson.words || [];
    const shuffledItems = practiceItems.sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      data: {
        sessionId,
        lesson: {
          ...lesson,
          module: module.title,
          difficulty: module.difficulty
        },
        practiceItems: shuffledItems,
        totalItems: shuffledItems.length
      }
    });

  } catch (error) {
    console.error('Start lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting lesson'
    });
  }
});

// Submit lesson results
router.post('/lessons/:lessonId/complete', auth, [
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('results').isArray().withMessage('Results must be an array'),
  body('results.*.item').notEmpty().withMessage('Each result must have an item'),
  body('results.*.correct').isBoolean().withMessage('Each result must indicate if correct'),
  body('results.*.timeSpent').isInt({ min: 0 }).withMessage('Time spent must be a positive integer'),
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('endTime').isISO8601().withMessage('Valid end time is required')
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

    const { lessonId } = req.params;
    const { sessionId, results, startTime, endTime, improvements = [] } = req.body;

    const user = await User.findById(req.user._id);
    
    let lesson = null;
    let module = null;
    
    for (const mod of Object.values(learningContent)) {
      const foundLesson = mod.lessons.find(l => l.id === lessonId);
      if (foundLesson) {
        lesson = foundLesson;
        module = mod;
        break;
      }
    }

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    const correctAnswers = results.filter(r => r.correct).length;
    const totalAnswers = results.length;
    const accuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;
    const duration = new Date(endTime) - new Date(startTime);

    const sessionData = {
      sessionId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      duration,
      gesturesAttempted: totalAnswers,
      gesturesCorrect: correctAnswers,
      accuracy,
      lesson: lessonId,
      difficulty: module.difficulty,
      improvements
    };

    user.updateLearningHistory(sessionData);

    const newAchievements = [];
    
    if (user.learningHistory.length === 1) {
      user.addAchievement({...achievements.first_lesson, dateEarned: new Date()});
      newAchievements.push(achievements.first_lesson);
    }

    if (accuracy === 100) {
      user.addAchievement({...achievements.perfect_score, dateEarned: new Date()});
      newAchievements.push(achievements.perfect_score);
    }

    const alphabetLessons = learningContent.alphabet.lessons;
    const completedAlphabetLessons = alphabetLessons.filter(l => 
      user.learningHistory.some(h => h.lesson === l.id && h.accuracy >= 80)
    );
    
    if (completedAlphabetLessons.length === alphabetLessons.length) {
      const hasAchievement = user.achievements.some(a => a.id === 'alphabet_master');
      if (!hasAchievement) {
        user.addAchievement({...achievements.alphabet_master, dateEarned: new Date()});
        newAchievements.push(achievements.alphabet_master);
      }
    }

    await user.save();

    const stars = accuracy >= 95 ? 3 : accuracy >= 85 ? 2 : accuracy >= 80 ? 1 : 0;
    const passed = accuracy >= 80;

    res.json({
      success: true,
      data: {
        results: {
          accuracy,
          correctAnswers,
          totalAnswers,
          duration,
          stars,
          passed,
          improvements
        },
        newAchievements,
        statistics: user.statistics
      }
    });

  } catch (error) {
    console.error('Complete lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing lesson'
    });
  }
});

// Get practice mode content
router.get('/practice/:type', auth, async (req, res) => {
  try {
    const { type } = req.params;
    const { difficulty = 'beginner', count = 10 } = req.query;

    let practiceItems = [];

    switch (type) {
      case 'alphabet':
        practiceItems = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        break;
      case 'words':
        const modules = Object.values(learningContent).filter(m => 
          !difficulty || m.difficulty === difficulty
        );
        practiceItems = modules.flatMap(m => 
          m.lessons.flatMap(l => l.words || [])
        );
        break;
      case 'mixed':
        const allModules = Object.values(learningContent);
        practiceItems = allModules.flatMap(m => 
          m.lessons.flatMap(l => [...(l.letters || []), ...(l.words || [])])
        );
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid practice type'
        });
    }

    const shuffledItems = practiceItems
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(parseInt(count), practiceItems.length));

    const sessionId = `practice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.json({
      success: true,
      data: {
        sessionId,
        type,
        difficulty,
        items: shuffledItems,
        totalItems: shuffledItems.length
      }
    });

  } catch (error) {
    console.error('Get practice error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching practice content'
    });
  }
});

// Get learning recommendations
router.get('/recommendations', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    const recommendations = [];
    
    if (user.learningHistory.length === 0) {
      recommendations.push({
        type: 'start_learning',
        title: 'Start Your Journey',
        description: 'Begin with the ASL alphabet to build your foundation',
        action: 'Start Alphabet Lessons',
        moduleId: 'alphabet',
        priority: 'high'
      });
    } else {
      const recentAccuracy = user.statistics.averageAccuracy;
      const lastSessionDate = user.statistics.lastActiveDate;
      const daysSinceLastSession = lastSessionDate ? 
        Math.floor((new Date() - lastSessionDate) / (1000 * 60 * 60 * 24)) : 0;

      if (daysSinceLastSession > 3) {
        recommendations.push({
          type: 'comeback',
          title: 'Welcome Back!',
          description: 'Practice some basics to refresh your memory',
          action: 'Quick Practice',
          moduleId: 'practice',
          priority: 'medium'
        });
      }

      if (recentAccuracy < 70) {
        recommendations.push({
          type: 'improvement',
          title: 'Focus on Accuracy',
          description: 'Practice previous lessons to improve your scores',
          action: 'Review Lessons',
          priority: 'high'
        });
      }

      const alphabetCompleted = learningContent.alphabet.lessons.every(lesson =>
        user.learningHistory.some(h => h.lesson === lesson.id && h.accuracy >= 80)
      );

      if (alphabetCompleted && recentAccuracy >= 80) {
        recommendations.push({
          type: 'progress',
          title: 'Ready for Basic Words',
          description: 'You\'ve mastered the alphabet! Try basic words now',
          action: 'Start Basic Words',
          moduleId: 'basicWords',
          priority: 'high'
        });
      }

      if (user.personalVocabulary.length < 5) {
        recommendations.push({
          type: 'vocabulary',
          title: 'Build Your Vocabulary',
          description: 'Add personal gestures to customize your learning',
          action: 'Add Custom Gestures',
          priority: 'low'
        });
      }
    }

    res.json({
      success: true,
      data: { recommendations }
    });

  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recommendations'
    });
  }
});

module.exports = router;