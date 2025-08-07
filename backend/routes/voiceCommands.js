const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { auth, optionalAuth } = require('../middleware/auth');
const inputValidation = require('../middleware/inputValidation');
const voiceCommandService = require('../services/voiceCommandService');
const logger = require('../services/logger');

const router = express.Router();

// Process voice command from speech input
router.post('/process', [
  optionalAuth,
  body('speechText').notEmpty().isLength({ min: 1, max: 1000 }).withMessage('Speech text is required (1-1000 characters)'),
  body('sessionId').optional().isString(),
  body('context').optional().isObject(),
  body('context.currentLanguage').optional().isIn(['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']),
  body('context.playbackSpeed').optional().isFloat({ min: 0.25, max: 2.0 }),
  body('context.overlayEnabled').optional().isBoolean(),
  body('context.theme').optional().isIn(['light', 'dark', 'auto']),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const {
      speechText,
      sessionId = `session_${Date.now()}`,
      context = {}
    } = req.body;

    const userId = req.user?._id || 'anonymous';

    logger.info('Processing voice command', {
      userId,
      sessionId,
      textLength: speechText.length,
      hasContext: Object.keys(context).length > 0
    });

    const result = await voiceCommandService.processVoiceCommand(
      speechText,
      userId,
      sessionId,
      context
    );

    // Add session information to response
    result.sessionId = sessionId;
    result.timestamp = new Date().toISOString();

    res.json({
      success: result.success,
      data: result,
      message: result.message || (result.success ? 'Command processed successfully' : 'Command processing failed')
    });

  } catch (error) {
    logger.error('Voice command processing error', {
      error: error.message,
      userId: req.user?._id,
      speechText: req.body.speechText?.substring(0, 100),
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Voice command processing failed'
    });
  }
});

// Get available voice commands
router.get('/commands', optionalAuth, async (req, res) => {
  try {
    const { category } = req.query;

    const commands = voiceCommandService.getCommandsByCategory(category);
    
    if (category && commands.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No commands found for category: ${category}`,
        availableCategories: ['navigation', 'translation', 'recording', 'accessibility', 'avatar', 'help', 'system']
      });
    }

    const commandDetails = {};
    const allCommands = voiceCommandService.commands;

    for (const commandId of commands) {
      if (allCommands[commandId]) {
        commandDetails[commandId] = {
          description: allCommands[commandId].description,
          category: allCommands[commandId].category,
          patterns: allCommands[commandId].patterns.map(p => 
            p.source.replace(/^\^/, '').replace(/\$$/, '').replace(/\(\?\:/g, '(')
          ),
          action: allCommands[commandId].action
        };
      }
    }

    res.json({
      success: true,
      data: {
        commands: commandDetails,
        total: commands.length,
        category: category || 'all'
      }
    });

  } catch (error) {
    logger.error('Error fetching voice commands', {
      error: error.message,
      userId: req.user?._id,
      category: req.query.category
    });

    res.status(500).json({
      success: false,
      message: 'Error fetching voice commands'
    });
  }
});

// Get voice command help
router.get('/help', optionalAuth, async (req, res) => {
  try {
    const helpData = voiceCommandService.handleShowHelpCommand();

    res.json({
      success: true,
      data: helpData.data,
      message: 'Voice command help retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching voice command help', {
      error: error.message,
      userId: req.user?._id
    });

    res.status(500).json({
      success: false,
      message: 'Error fetching help information'
    });
  }
});

// Get voice command tutorial
router.get('/tutorial', optionalAuth, async (req, res) => {
  try {
    const tutorialData = voiceCommandService.handleShowTutorialCommand();

    res.json({
      success: true,
      data: tutorialData.data,
      message: 'Voice command tutorial retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching voice command tutorial', {
      error: error.message,
      userId: req.user?._id
    });

    res.status(500).json({
      success: false,
      message: 'Error fetching tutorial information'
    });
  }
});

// Get service statistics (admin only)
router.get('/stats', [auth], async (req, res) => {
  try {
    // Check if user has admin privileges
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    const stats = voiceCommandService.getServiceStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error fetching voice command statistics', {
      error: error.message,
      userId: req.user._id
    });

    res.status(500).json({
      success: false,
      message: 'Error fetching statistics'
    });
  }
});

// Set command context for multi-step interactions
router.post('/context', [
  auth,
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('context').isObject().withMessage('Context object is required'),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { sessionId, context } = req.body;
    const userId = req.user._id;

    voiceCommandService.setCommandContext(userId, sessionId, context);

    logger.info('Voice command context set', {
      userId,
      sessionId,
      contextKeys: Object.keys(context)
    });

    res.json({
      success: true,
      message: 'Command context updated successfully',
      data: {
        sessionId,
        contextSet: Object.keys(context)
      }
    });

  } catch (error) {
    logger.error('Error setting voice command context', {
      error: error.message,
      userId: req.user._id,
      sessionId: req.body.sessionId
    });

    res.status(500).json({
      success: false,
      message: 'Error setting command context'
    });
  }
});

// Get command context
router.get('/context/:sessionId', [auth], async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const context = voiceCommandService.getCommandContext(userId, sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        context,
        hasContext: Object.keys(context).length > 0
      }
    });

  } catch (error) {
    logger.error('Error getting voice command context', {
      error: error.message,
      userId: req.user._id,
      sessionId: req.params.sessionId
    });

    res.status(500).json({
      success: false,
      message: 'Error retrieving command context'
    });
  }
});

// Test voice command matching (development/debugging)
router.post('/test-match', [
  optionalAuth,
  body('input').notEmpty().withMessage('Input text is required'),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { input } = req.body;
    
    // This is a simplified version of the matching logic for testing
    const allCommands = voiceCommandService.commands;
    const matches = [];

    for (const [commandId, command] of Object.entries(allCommands)) {
      for (const [index, pattern] of command.patterns.entries()) {
        const match = input.match(pattern);
        if (match) {
          matches.push({
            commandId,
            patternIndex: index,
            pattern: pattern.source,
            match: match[0],
            groups: match.slice(1),
            description: command.description,
            category: command.category,
            action: command.action
          });
        }
      }
    }

    // Also test fuzzy matching
    const fuzzyMatch = voiceCommandService.fuzzyMatchCommand(input);

    res.json({
      success: true,
      data: {
        input,
        exactMatches: matches,
        fuzzyMatch,
        totalMatches: matches.length,
        suggestions: matches.length === 0 ? voiceCommandService.getSuggestions(input) : null
      },
      message: `Found ${matches.length} exact matches${fuzzyMatch ? ' and 1 fuzzy match' : ''}`
    });

  } catch (error) {
    logger.error('Error testing voice command match', {
      error: error.message,
      input: req.body.input?.substring(0, 100)
    });

    res.status(500).json({
      success: false,
      message: 'Error testing command match'
    });
  }
});

// Batch process multiple voice commands
router.post('/batch-process', [
  auth,
  body('commands').isArray({ min: 1, max: 10 }).withMessage('Commands array required (max 10)'),
  body('commands.*.speechText').notEmpty().withMessage('Speech text required for each command'),
  body('commands.*.sessionId').optional().isString(),
  body('commands.*.context').optional().isObject(),
  body('processSequentially').optional().isBoolean(),
  inputValidation.validateRequest()
], async (req, res) => {
  try {
    const { commands, processSequentially = false } = req.body;
    const userId = req.user._id;

    logger.info('Batch processing voice commands', {
      userId,
      commandCount: commands.length,
      processSequentially
    });

    const results = [];
    const errors = [];

    if (processSequentially) {
      // Process commands one by one (for dependent commands)
      for (const [index, command] of commands.entries()) {
        try {
          const sessionId = command.sessionId || `batch_${Date.now()}_${index}`;
          const result = await voiceCommandService.processVoiceCommand(
            command.speechText,
            userId,
            sessionId,
            command.context || {}
          );

          results.push({
            index,
            sessionId,
            speechText: command.speechText,
            result
          });

        } catch (error) {
          errors.push({
            index,
            speechText: command.speechText,
            error: error.message
          });
        }
      }
    } else {
      // Process commands in parallel (for independent commands)
      const promises = commands.map(async (command, index) => {
        try {
          const sessionId = command.sessionId || `batch_${Date.now()}_${index}`;
          const result = await voiceCommandService.processVoiceCommand(
            command.speechText,
            userId,
            sessionId,
            command.context || {}
          );

          return {
            index,
            sessionId,
            speechText: command.speechText,
            result,
            success: true
          };

        } catch (error) {
          return {
            index,
            speechText: command.speechText,
            error: error.message,
            success: false
          };
        }
      });

      const allResults = await Promise.all(promises);
      
      for (const item of allResults) {
        if (item.success) {
          results.push(item);
        } else {
          errors.push(item);
        }
      }
    }

    const summary = {
      total: commands.length,
      successful: results.length,
      failed: errors.length,
      processedSequentially: processSequentially
    };

    res.json({
      success: true,
      data: {
        results,
        errors,
        summary
      },
      message: `Batch processing completed: ${summary.successful}/${summary.total} successful`
    });

  } catch (error) {
    logger.error('Batch voice command processing error', {
      error: error.message,
      userId: req.user._id,
      commandCount: req.body.commands?.length
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Batch processing failed'
    });
  }
});

// Cleanup expired contexts (maintenance endpoint)
router.post('/cleanup', [auth], async (req, res) => {
  try {
    // Check if user has admin privileges
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    voiceCommandService.cleanupExpiredContexts();

    logger.info('Voice command contexts cleaned up', {
      userId: req.user._id
    });

    res.json({
      success: true,
      message: 'Expired command contexts cleaned up successfully'
    });

  } catch (error) {
    logger.error('Error cleaning up voice command contexts', {
      error: error.message,
      userId: req.user._id
    });

    res.status(500).json({
      success: false,
      message: 'Error cleaning up contexts'
    });
  }
});

module.exports = router;