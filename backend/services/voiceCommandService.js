const logger = require('./logger');
const gestureLibraryService = require('./gestureLibraryService');
const facialExpressionService = require('./facialExpressionService');
const callRecordingService = require('./callRecordingService');

class VoiceCommandService {
  constructor() {
    // Supported voice commands with their patterns and actions
    this.commands = {
      // Navigation commands
      'NAVIGATE_HOME': {
        patterns: [
          /^(go to|navigate to|open|show me) (home|homepage|main page)$/i,
          /^home$/i,
          /^take me home$/i
        ],
        action: 'navigate',
        target: 'home',
        description: 'Navigate to home page',
        category: 'navigation'
      },

      'NAVIGATE_TRANSLATE': {
        patterns: [
          /^(go to|navigate to|open|show me) (translate|translation|translator)( page)?$/i,
          /^(start|begin) translation$/i,
          /^translate$/i
        ],
        action: 'navigate',
        target: 'translate',
        description: 'Open translation interface',
        category: 'navigation'
      },

      'NAVIGATE_LEARNING': {
        patterns: [
          /^(go to|navigate to|open|show me) (learning|lessons|practice)( page)?$/i,
          /^(start|begin) learning$/i,
          /^learning$/i,
          /^practice$/i
        ],
        action: 'navigate',
        target: 'learning',
        description: 'Open learning modules',
        category: 'navigation'
      },

      'NAVIGATE_SETTINGS': {
        patterns: [
          /^(go to|navigate to|open|show me) settings$/i,
          /^settings$/i,
          /^preferences$/i,
          /^configuration$/i
        ],
        action: 'navigate',
        target: 'settings',
        description: 'Open settings page',
        category: 'navigation'
      },

      // Translation commands
      'TRANSLATE_TEXT': {
        patterns: [
          /^translate (.*?)$/i,
          /^sign (.*?)$/i,
          /^how do I sign (.*?)$/i,
          /^show me the sign for (.*?)$/i
        ],
        action: 'translate',
        description: 'Translate text to sign language',
        category: 'translation',
        extractText: true
      },

      'CHANGE_SIGN_LANGUAGE': {
        patterns: [
          /^(change|switch|set) (sign )?language to (ASL|BSL|LSF|ISL|AUSLAN)$/i,
          /^use (ASL|BSL|LSF|ISL|AUSLAN)$/i,
          /^(ASL|BSL|LSF|ISL|AUSLAN) mode$/i
        ],
        action: 'setLanguage',
        description: 'Change sign language',
        category: 'translation',
        extractLanguage: true
      },

      'REPEAT_TRANSLATION': {
        patterns: [
          /^repeat$/i,
          /^repeat that$/i,
          /^show again$/i,
          /^repeat translation$/i
        ],
        action: 'repeat',
        description: 'Repeat last translation',
        category: 'translation'
      },

      'SLOW_DOWN': {
        patterns: [
          /^(slow down|slower|go slower)$/i,
          /^(make it|play) slower$/i,
          /^decrease speed$/i
        ],
        action: 'adjustSpeed',
        value: 'slower',
        description: 'Slow down translation speed',
        category: 'playback'
      },

      'SPEED_UP': {
        patterns: [
          /^(speed up|faster|go faster)$/i,
          /^(make it|play) faster$/i,
          /^increase speed$/i
        ],
        action: 'adjustSpeed',
        value: 'faster',
        description: 'Speed up translation speed',
        category: 'playback'
      },

      // Recording commands
      'START_RECORDING': {
        patterns: [
          /^(start|begin) recording$/i,
          /^record$/i,
          /^start call recording$/i
        ],
        action: 'startRecording',
        description: 'Start call recording',
        category: 'recording'
      },

      'STOP_RECORDING': {
        patterns: [
          /^(stop|end) recording$/i,
          /^stop$/i,
          /^finish recording$/i
        ],
        action: 'stopRecording',
        description: 'Stop call recording',
        category: 'recording'
      },

      'TOGGLE_OVERLAY': {
        patterns: [
          /^(show|hide|toggle) overlay$/i,
          /^(enable|disable) overlay$/i,
          /^overlay (on|off)$/i
        ],
        action: 'toggleOverlay',
        description: 'Toggle translation overlay',
        category: 'recording'
      },

      // Accessibility commands
      'INCREASE_SIZE': {
        patterns: [
          /^(make|increase|bigger) (font|text|size)( bigger)?$/i,
          /^zoom in$/i,
          /^larger$/i
        ],
        action: 'adjustSize',
        value: 'increase',
        description: 'Increase interface size',
        category: 'accessibility'
      },

      'DECREASE_SIZE': {
        patterns: [
          /^(make|decrease|smaller) (font|text|size)( smaller)?$/i,
          /^zoom out$/i,
          /^smaller$/i
        ],
        action: 'adjustSize',
        value: 'decrease',
        description: 'Decrease interface size',
        category: 'accessibility'
      },

      'TOGGLE_DARK_MODE': {
        patterns: [
          /^(enable|disable|toggle) dark mode$/i,
          /^dark mode (on|off)$/i,
          /^(switch to )?(dark|light) theme$/i
        ],
        action: 'toggleTheme',
        description: 'Toggle dark/light theme',
        category: 'accessibility'
      },

      'TOGGLE_HIGH_CONTRAST': {
        patterns: [
          /^(enable|disable|toggle) high contrast$/i,
          /^high contrast (on|off)$/i,
          /^contrast mode$/i
        ],
        action: 'toggleContrast',
        description: 'Toggle high contrast mode',
        category: 'accessibility'
      },

      // Avatar commands
      'SHOW_EMOTIONS': {
        patterns: [
          /^(show|enable|turn on) emotions$/i,
          /^emotions on$/i,
          /^enable facial expressions$/i
        ],
        action: 'toggleEmotions',
        value: true,
        description: 'Enable avatar emotions',
        category: 'avatar'
      },

      'HIDE_EMOTIONS': {
        patterns: [
          /^(hide|disable|turn off) emotions$/i,
          /^emotions off$/i,
          /^disable facial expressions$/i
        ],
        action: 'toggleEmotions',
        value: false,
        description: 'Disable avatar emotions',
        category: 'avatar'
      },

      'CHANGE_AVATAR_SIZE': {
        patterns: [
          /^(make|set) avatar (small|medium|large)$/i,
          /^avatar size (small|medium|large)$/i
        ],
        action: 'setAvatarSize',
        description: 'Change avatar size',
        category: 'avatar',
        extractSize: true
      },

      // Help commands
      'SHOW_HELP': {
        patterns: [
          /^help$/i,
          /^what can I say$/i,
          /^voice commands$/i,
          /^show commands$/i,
          /^how do I use this$/i
        ],
        action: 'showHelp',
        description: 'Show available voice commands',
        category: 'help'
      },

      'SHOW_TUTORIAL': {
        patterns: [
          /^tutorial$/i,
          /^show tutorial$/i,
          /^how to use$/i,
          /^getting started$/i
        ],
        action: 'showTutorial',
        description: 'Show application tutorial',
        category: 'help'
      },

      // System commands
      'CANCEL': {
        patterns: [
          /^cancel$/i,
          /^never mind$/i,
          /^stop listening$/i,
          /^abort$/i
        ],
        action: 'cancel',
        description: 'Cancel current operation',
        category: 'system'
      },

      'CONFIRM': {
        patterns: [
          /^(yes|confirm|ok|okay|sure|absolutely)$/i,
          /^do it$/i,
          /^go ahead$/i
        ],
        action: 'confirm',
        description: 'Confirm action',
        category: 'system'
      },

      'DENY': {
        patterns: [
          /^(no|nope|cancel|don't|stop)$/i,
          /^don't do it$/i,
          /^never mind$/i
        ],
        action: 'deny',
        description: 'Deny/cancel action',
        category: 'system'
      }
    };

    // Command context for handling multi-step interactions
    this.commandContext = new Map();

    // Statistics tracking
    this.stats = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      mostUsedCommands: new Map(),
      categoryUsage: new Map()
    };

    // Initialize categories
    this.initializeCategories();

    logger.info('Voice Command Service initialized', {
      commandCount: Object.keys(this.commands).length,
      categories: Array.from(this.stats.categoryUsage.keys())
    });
  }

  /**
   * Initialize command categories
   */
  initializeCategories() {
    for (const [commandId, command] of Object.entries(this.commands)) {
      if (!this.stats.categoryUsage.has(command.category)) {
        this.stats.categoryUsage.set(command.category, 0);
      }
    }
  }

  /**
   * Process voice command from speech input
   */
  async processVoiceCommand(speechText, userId, sessionId, context = {}) {
    try {
      const normalizedInput = speechText.trim();
      this.stats.totalCommands++;

      logger.info('Processing voice command', {
        userId,
        sessionId,
        input: normalizedInput.substring(0, 100),
        inputLength: normalizedInput.length
      });

      // Match command against patterns
      const matchResult = this.matchCommand(normalizedInput);
      
      if (!matchResult) {
        // Try fuzzy matching for common variations
        const fuzzyMatch = this.fuzzyMatchCommand(normalizedInput);
        if (fuzzyMatch) {
          return await this.executeCommand(fuzzyMatch, userId, sessionId, context);
        }

        this.stats.failedCommands++;
        return {
          success: false,
          error: 'Command not recognized',
          suggestions: this.getSuggestions(normalizedInput),
          input: normalizedInput
        };
      }

      // Execute the matched command
      const result = await this.executeCommand(matchResult, userId, sessionId, context);
      
      if (result.success) {
        this.stats.successfulCommands++;
        this.updateCommandStats(matchResult.commandId, matchResult.command.category);
      } else {
        this.stats.failedCommands++;
      }

      return result;

    } catch (error) {
      logger.error('Error processing voice command', {
        error: error.message,
        userId,
        sessionId,
        input: speechText?.substring(0, 100)
      });

      this.stats.failedCommands++;
      return {
        success: false,
        error: error.message || 'Command processing failed',
        input: speechText
      };
    }
  }

  /**
   * Match input against command patterns
   */
  matchCommand(input) {
    for (const [commandId, command] of Object.entries(this.commands)) {
      for (const pattern of command.patterns) {
        const match = input.match(pattern);
        if (match) {
          const result = {
            commandId,
            command,
            match,
            input,
            extractedData: {}
          };

          // Extract data based on command configuration
          if (command.extractText && match[1]) {
            result.extractedData.text = match[1].trim();
          }
          
          if (command.extractLanguage && match[3]) {
            result.extractedData.language = match[3].toUpperCase();
          }
          
          if (command.extractSize && match[2]) {
            result.extractedData.size = match[2].toLowerCase();
          }

          return result;
        }
      }
    }
    
    return null;
  }

  /**
   * Fuzzy match for similar commands
   */
  fuzzyMatchCommand(input) {
    const inputLower = input.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const [commandId, command] of Object.entries(this.commands)) {
      // Check description similarity
      const descWords = command.description.toLowerCase().split(' ');
      const inputWords = inputLower.split(' ');
      
      let matchScore = 0;
      for (const word of inputWords) {
        if (descWords.some(descWord => descWord.includes(word) || word.includes(descWord))) {
          matchScore += 1;
        }
      }
      
      const normalizedScore = matchScore / Math.max(inputWords.length, descWords.length);
      
      if (normalizedScore > 0.3 && normalizedScore > bestScore) {
        bestScore = normalizedScore;
        bestMatch = {
          commandId,
          command,
          input,
          confidence: normalizedScore,
          extractedData: {}
        };
      }
    }

    return bestScore > 0.5 ? bestMatch : null;
  }

  /**
   * Execute a matched command
   */
  async executeCommand(matchResult, userId, sessionId, context) {
    const { commandId, command, extractedData } = matchResult;

    try {
      logger.info('Executing voice command', {
        commandId,
        action: command.action,
        category: command.category,
        userId,
        sessionId
      });

      // Handle different command actions
      switch (command.action) {
        case 'navigate':
          return this.handleNavigateCommand(command.target, context);

        case 'translate':
          if (!extractedData.text) {
            return {
              success: false,
              error: 'No text provided for translation',
              requiresInput: 'text'
            };
          }
          return await this.handleTranslateCommand(extractedData.text, context);

        case 'setLanguage':
          if (!extractedData.language) {
            return {
              success: false,
              error: 'No language specified',
              availableLanguages: ['ASL', 'BSL', 'LSF', 'ISL', 'AUSLAN']
            };
          }
          return this.handleLanguageCommand(extractedData.language, context);

        case 'repeat':
          return this.handleRepeatCommand(context);

        case 'adjustSpeed':
          return this.handleSpeedCommand(command.value, context);

        case 'startRecording':
          return await this.handleStartRecordingCommand(userId, sessionId, context);

        case 'stopRecording':
          return await this.handleStopRecordingCommand(context);

        case 'toggleOverlay':
          return this.handleToggleOverlayCommand(context);

        case 'adjustSize':
          return this.handleAdjustSizeCommand(command.value, context);

        case 'toggleTheme':
          return this.handleToggleThemeCommand(context);

        case 'toggleContrast':
          return this.handleToggleContrastCommand(context);

        case 'toggleEmotions':
          return this.handleToggleEmotionsCommand(command.value, context);

        case 'setAvatarSize':
          if (!extractedData.size) {
            return {
              success: false,
              error: 'No size specified',
              availableSizes: ['small', 'medium', 'large']
            };
          }
          return this.handleSetAvatarSizeCommand(extractedData.size, context);

        case 'showHelp':
          return this.handleShowHelpCommand();

        case 'showTutorial':
          return this.handleShowTutorialCommand();

        case 'cancel':
          return this.handleCancelCommand(userId, sessionId);

        case 'confirm':
          return this.handleConfirmCommand(userId, sessionId, context);

        case 'deny':
          return this.handleDenyCommand(userId, sessionId);

        default:
          return {
            success: false,
            error: `Unknown command action: ${command.action}`,
            commandId
          };
      }

    } catch (error) {
      logger.error('Error executing voice command', {
        error: error.message,
        commandId,
        action: command.action,
        userId,
        sessionId
      });

      return {
        success: false,
        error: error.message || 'Command execution failed',
        commandId
      };
    }
  }

  /**
   * Handle navigation commands
   */
  handleNavigateCommand(target, context) {
    return {
      success: true,
      action: 'navigate',
      target,
      message: `Navigating to ${target}`,
      data: { route: `/${target}` }
    };
  }

  /**
   * Handle text translation commands
   */
  async handleTranslateCommand(text, context) {
    try {
      const signLanguage = context.currentLanguage || 'BSL';
      const translation = gestureLibraryService.translateToSignSequence(text, signLanguage);
      
      // Generate emotion analysis for the text
      const emotionAnalysis = facialExpressionService.analyzeTextEmotion(text, context.translationContext || 'general');

      return {
        success: true,
        action: 'translate',
        data: {
          originalText: text,
          translation: translation.sequence,
          signLanguage,
          emotion: emotionAnalysis,
          metadata: translation.metadata
        },
        message: `Translated "${text}" to ${signLanguage}`,
        instructions: 'Translation ready. Say "repeat" to see it again.'
      };

    } catch (error) {
      return {
        success: false,
        error: `Translation failed: ${error.message}`,
        text
      };
    }
  }

  /**
   * Handle language change commands
   */
  handleLanguageCommand(language, context) {
    return {
      success: true,
      action: 'setLanguage',
      data: { language },
      message: `Changed sign language to ${language}`,
      instructions: `Now using ${language}. Try saying "translate hello" to test.`
    };
  }

  /**
   * Handle repeat commands
   */
  handleRepeatCommand(context) {
    if (!context.lastTranslation) {
      return {
        success: false,
        error: 'No previous translation to repeat',
        suggestion: 'Try translating some text first'
      };
    }

    return {
      success: true,
      action: 'repeat',
      data: context.lastTranslation,
      message: 'Repeating last translation'
    };
  }

  /**
   * Handle speed adjustment commands
   */
  handleSpeedCommand(adjustment, context) {
    const currentSpeed = context.playbackSpeed || 1.0;
    let newSpeed;

    if (adjustment === 'slower') {
      newSpeed = Math.max(0.25, currentSpeed - 0.25);
    } else if (adjustment === 'faster') {
      newSpeed = Math.min(2.0, currentSpeed + 0.25);
    }

    return {
      success: true,
      action: 'adjustSpeed',
      data: { speed: newSpeed },
      message: `Playback speed set to ${newSpeed}x`,
      instructions: newSpeed === 0.25 ? 'This is the slowest speed' : newSpeed === 2.0 ? 'This is the fastest speed' : `Say "slower" or "faster" to adjust further`
    };
  }

  /**
   * Handle start recording commands
   */
  async handleStartRecordingCommand(userId, sessionId, context) {
    try {
      const recording = await callRecordingService.startRecording(userId, sessionId, {
        overlaySettings: context.overlaySettings || {},
        tags: ['voice_command_initiated']
      });

      return {
        success: true,
        action: 'startRecording',
        data: recording,
        message: 'Call recording started',
        instructions: 'Say "stop recording" when finished'
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to start recording: ${error.message}`,
        suggestion: 'Check microphone permissions'
      };
    }
  }

  /**
   * Handle stop recording commands
   */
  async handleStopRecordingCommand(context) {
    if (!context.currentRecordingId) {
      return {
        success: false,
        error: 'No active recording to stop',
        suggestion: 'Start recording first with "start recording"'
      };
    }

    try {
      const result = await callRecordingService.stopRecording(context.currentRecordingId);

      return {
        success: true,
        action: 'stopRecording',
        data: result,
        message: 'Recording stopped and processing started',
        instructions: 'Processing will complete automatically'
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to stop recording: ${error.message}`
      };
    }
  }

  /**
   * Handle overlay toggle commands
   */
  handleToggleOverlayCommand(context) {
    const newState = !context.overlayEnabled;
    
    return {
      success: true,
      action: 'toggleOverlay',
      data: { enabled: newState },
      message: `Translation overlay ${newState ? 'enabled' : 'disabled'}`,
      instructions: newState ? 'Overlay will show during recording' : 'Overlay is now hidden'
    };
  }

  /**
   * Handle size adjustment commands
   */
  handleAdjustSizeCommand(adjustment, context) {
    const sizes = ['small', 'medium', 'large', 'extra-large'];
    const currentSize = context.interfaceSize || 'medium';
    const currentIndex = sizes.indexOf(currentSize);
    
    let newIndex;
    if (adjustment === 'increase') {
      newIndex = Math.min(sizes.length - 1, currentIndex + 1);
    } else {
      newIndex = Math.max(0, currentIndex - 1);
    }
    
    const newSize = sizes[newIndex];

    return {
      success: true,
      action: 'adjustSize',
      data: { size: newSize },
      message: `Interface size set to ${newSize}`,
      instructions: newIndex === 0 ? 'This is the smallest size' : newIndex === sizes.length - 1 ? 'This is the largest size' : 'Say "bigger" or "smaller" to adjust further'
    };
  }

  /**
   * Handle theme toggle commands
   */
  handleToggleThemeCommand(context) {
    const currentTheme = context.theme || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    return {
      success: true,
      action: 'toggleTheme',
      data: { theme: newTheme },
      message: `Switched to ${newTheme} theme`,
      instructions: 'Interface appearance updated'
    };
  }

  /**
   * Handle high contrast toggle commands
   */
  handleToggleContrastCommand(context) {
    const newState = !context.highContrast;

    return {
      success: true,
      action: 'toggleContrast',
      data: { highContrast: newState },
      message: `High contrast mode ${newState ? 'enabled' : 'disabled'}`,
      instructions: newState ? 'Interface now uses high contrast colors' : 'Normal contrast restored'
    };
  }

  /**
   * Handle emotion toggle commands
   */
  handleToggleEmotionsCommand(enabled, context) {
    return {
      success: true,
      action: 'toggleEmotions',
      data: { enabled },
      message: `Avatar emotions ${enabled ? 'enabled' : 'disabled'}`,
      instructions: enabled ? 'Avatar will now show facial expressions' : 'Avatar expressions are now hidden'
    };
  }

  /**
   * Handle avatar size commands
   */
  handleSetAvatarSizeCommand(size, context) {
    return {
      success: true,
      action: 'setAvatarSize',
      data: { size },
      message: `Avatar size set to ${size}`,
      instructions: 'Avatar display updated'
    };
  }

  /**
   * Handle help commands
   */
  handleShowHelpCommand() {
    const categories = {};
    
    for (const [commandId, command] of Object.entries(this.commands)) {
      if (!categories[command.category]) {
        categories[command.category] = [];
      }
      categories[command.category].push({
        patterns: command.patterns.map(p => p.source.replace(/\^\(\?\:/, '').replace(/\)\$/, '')),
        description: command.description
      });
    }

    return {
      success: true,
      action: 'showHelp',
      data: {
        categories,
        totalCommands: Object.keys(this.commands).length,
        examples: [
          'Say "translate hello" to translate text',
          'Say "start recording" to begin call recording',
          'Say "dark mode" to toggle theme',
          'Say "help" to see all commands'
        ]
      },
      message: 'Here are the available voice commands',
      instructions: 'Try any of these commands by speaking clearly'
    };
  }

  /**
   * Handle tutorial commands
   */
  handleShowTutorialCommand() {
    return {
      success: true,
      action: 'showTutorial',
      data: {
        steps: [
          'Welcome to voice-controlled sign language translation',
          'You can navigate by saying "go to translate" or "go to learning"',
          'Translate text by saying "translate [your text]"',
          'Change languages by saying "use BSL" or "use ASL"',
          'Start recording by saying "start recording"',
          'Get help anytime by saying "help"'
        ]
      },
      message: 'Starting interactive tutorial',
      instructions: 'Follow the tutorial steps to learn voice commands'
    };
  }

  /**
   * Handle cancel commands
   */
  handleCancelCommand(userId, sessionId) {
    // Clear any pending context
    this.commandContext.delete(`${userId}:${sessionId}`);

    return {
      success: true,
      action: 'cancel',
      message: 'Operation cancelled',
      instructions: 'Ready for new commands'
    };
  }

  /**
   * Handle confirm commands
   */
  handleConfirmCommand(userId, sessionId, context) {
    const contextKey = `${userId}:${sessionId}`;
    const pendingAction = this.commandContext.get(contextKey);

    if (!pendingAction) {
      return {
        success: false,
        error: 'Nothing to confirm',
        suggestion: 'Try a different command first'
      };
    }

    // Clear the pending action
    this.commandContext.delete(contextKey);

    return {
      success: true,
      action: 'confirm',
      data: pendingAction,
      message: 'Action confirmed and executed',
      instructions: 'Ready for new commands'
    };
  }

  /**
   * Handle deny commands
   */
  handleDenyCommand(userId, sessionId) {
    const contextKey = `${userId}:${sessionId}`;
    this.commandContext.delete(contextKey);

    return {
      success: true,
      action: 'deny',
      message: 'Action cancelled',
      instructions: 'Ready for new commands'
    };
  }

  /**
   * Get command suggestions for unrecognized input
   */
  getSuggestions(input) {
    const inputLower = input.toLowerCase();
    const suggestions = [];

    // Look for partial matches in command patterns
    for (const [commandId, command] of Object.entries(this.commands)) {
      const words = command.description.toLowerCase().split(' ');
      if (words.some(word => inputLower.includes(word) || word.includes(inputLower))) {
        suggestions.push({
          command: command.description,
          example: command.patterns[0].source.replace(/\^\(\?\:/, '').replace(/\|\)\$/, '').replace(/\$.*/, ''),
          category: command.category
        });
      }
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Update command usage statistics
   */
  updateCommandStats(commandId, category) {
    // Update most used commands
    const currentCount = this.stats.mostUsedCommands.get(commandId) || 0;
    this.stats.mostUsedCommands.set(commandId, currentCount + 1);

    // Update category usage
    const currentCategoryCount = this.stats.categoryUsage.get(category) || 0;
    this.stats.categoryUsage.set(category, currentCategoryCount + 1);
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalCommands > 0 ? 
        Math.round((this.stats.successfulCommands / this.stats.totalCommands) * 100) : 0,
      mostUsedCommands: Array.from(this.stats.mostUsedCommands.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
      categoryUsage: Object.fromEntries(this.stats.categoryUsage)
    };
  }

  /**
   * Get available commands by category
   */
  getCommandsByCategory(category) {
    if (!category) {
      return Object.keys(this.commands);
    }

    return Object.entries(this.commands)
      .filter(([, command]) => command.category === category)
      .map(([commandId]) => commandId);
  }

  /**
   * Set command context for multi-step interactions
   */
  setCommandContext(userId, sessionId, context) {
    const contextKey = `${userId}:${sessionId}`;
    this.commandContext.set(contextKey, {
      ...context,
      timestamp: Date.now()
    });
  }

  /**
   * Get command context
   */
  getCommandContext(userId, sessionId) {
    const contextKey = `${userId}:${sessionId}`;
    return this.commandContext.get(contextKey) || {};
  }

  /**
   * Clear expired contexts (cleanup)
   */
  cleanupExpiredContexts() {
    const now = Date.now();
    const expireTime = 5 * 60 * 1000; // 5 minutes

    for (const [key, context] of this.commandContext.entries()) {
      if (now - context.timestamp > expireTime) {
        this.commandContext.delete(key);
      }
    }
  }
}

module.exports = new VoiceCommandService();