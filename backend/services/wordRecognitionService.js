const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-cpu');
const natural = require('natural');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const gestureLibraryService = require('./gestureLibraryService');

class WordRecognitionService {
  constructor() {
    this.model = null;
    this.vocabulary = new Map();
    this.reverseLookup = new Map();
    this.maxSequenceLength = 50;
    this.embeddingDim = 128;
    this.hiddenDim = 256;
    
    // Pre-trained word embeddings cache
    this.wordEmbeddings = new Map();
    
    // Model paths
    this.modelPath = path.join(__dirname, '../models/word_recognition');
    this.vocabularyPath = path.join(__dirname, '../models/vocabulary.json');
    this.embeddingsPath = path.join(__dirname, '../models/embeddings.json');
    
    this.initialize();
  }

  async initialize() {
    try {
      await this.ensureDirectories();
      await this.loadOrCreateVocabulary();
      await this.loadOrCreateModel();
      
      logger.info('Word Recognition Service initialized', {
        vocabularySize: this.vocabulary.size,
        modelLoaded: !!this.model
      });
    } catch (error) {
      logger.error('Word Recognition Service initialization failed', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  async ensureDirectories() {
    const dirs = [
      path.dirname(this.modelPath),
      path.dirname(this.vocabularyPath),
      path.dirname(this.embeddingsPath)
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Load existing vocabulary or create new one from gesture libraries
   */
  async loadOrCreateVocabulary() {
    try {
      // Try to load existing vocabulary
      const vocabData = await fs.readFile(this.vocabularyPath, 'utf8');
      const vocab = JSON.parse(vocabData);
      
      vocab.words.forEach((word, index) => {
        this.vocabulary.set(word, index);
        this.reverseLookup.set(index, word);
      });
      
      logger.info('Loaded existing vocabulary', { size: this.vocabulary.size });
      
    } catch (error) {
      // Create new vocabulary from gesture libraries
      await this.createVocabularyFromGestures();
      await this.saveVocabulary();
      
      logger.info('Created new vocabulary', { size: this.vocabulary.size });
    }
  }

  /**
   * Create vocabulary from available gesture libraries
   */
  async createVocabularyFromGestures() {
    const specialTokens = ['<PAD>', '<START>', '<END>', '<UNK>'];
    const words = new Set(specialTokens);
    
    // Add words from all gesture libraries
    const libraries = gestureLibraryService.getAvailableLibraries();
    
    for (const libCode of libraries) {
      const library = gestureLibraryService.getLibrary(libCode);
      
      if (library.commonWords) {
        Object.keys(library.commonWords).forEach(word => words.add(word));
      }
      
      if (library.alphabet) {
        Object.keys(library.alphabet).forEach(letter => words.add(letter));
      }
      
      if (library.phrases) {
        Object.keys(library.phrases).forEach(phrase => {
          // Split phrase into individual words
          phrase.split('_').forEach(word => words.add(word));
        });
      }
    }
    
    // Add common English words for better coverage
    const commonWords = [
      'THE', 'BE', 'TO', 'OF', 'AND', 'A', 'IN', 'THAT', 'HAVE', 'I',
      'IT', 'FOR', 'NOT', 'ON', 'WITH', 'HE', 'AS', 'YOU', 'DO', 'AT',
      'THIS', 'BUT', 'HIS', 'BY', 'FROM', 'THEY', 'WE', 'SAY', 'HER', 'SHE',
      'OR', 'AN', 'WILL', 'MY', 'ONE', 'ALL', 'WOULD', 'THERE', 'THEIR'
    ];
    
    commonWords.forEach(word => words.add(word));
    
    // Convert to ordered vocabulary
    const sortedWords = Array.from(words).sort();
    sortedWords.forEach((word, index) => {
      this.vocabulary.set(word, index);
      this.reverseLookup.set(index, word);
    });
  }

  /**
   * Save vocabulary to file
   */
  async saveVocabulary() {
    const vocabData = {
      words: Array.from(this.vocabulary.keys()),
      size: this.vocabulary.size,
      createdAt: new Date().toISOString()
    };
    
    await fs.writeFile(this.vocabularyPath, JSON.stringify(vocabData, null, 2));
  }

  /**
   * Load existing model or create new one
   */
  async loadOrCreateModel() {
    try {
      // Try to load existing model
      this.model = await tf.loadLayersModel(`file://${this.modelPath}/model.json`);
      logger.info('Loaded existing LSTM model');
      
    } catch (error) {
      // Create new model
      this.model = this.createLSTMModel();
      await this.saveModel();
      
      logger.info('Created new LSTM model', {
        vocabularySize: this.vocabulary.size,
        embeddingDim: this.embeddingDim,
        hiddenDim: this.hiddenDim
      });
    }
  }

  /**
   * Create LSTM model architecture
   */
  createLSTMModel() {
    const model = tf.sequential();
    
    // Embedding layer
    model.add(tf.layers.embedding({
      inputDim: this.vocabulary.size,
      outputDim: this.embeddingDim,
      maskZero: true,
      inputLength: this.maxSequenceLength
    }));
    
    // Bidirectional LSTM layers
    model.add(tf.layers.bidirectional({
      layer: tf.layers.lstm({
        units: this.hiddenDim,
        returnSequences: true,
        dropoutRate: 0.3,
        recurrentDropoutRate: 0.3
      })
    }));
    
    model.add(tf.layers.bidirectional({
      layer: tf.layers.lstm({
        units: this.hiddenDim,
        returnSequences: false,
        dropoutRate: 0.3,
        recurrentDropoutRate: 0.3
      })
    }));
    
    // Dense layers for classification
    model.add(tf.layers.dense({
      units: 512,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dropout({ rate: 0.5 }));
    
    model.add(tf.layers.dense({
      units: 256,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dropout({ rate: 0.3 }));
    
    // Output layer for word classification
    model.add(tf.layers.dense({
      units: this.vocabulary.size,
      activation: 'softmax'
    }));
    
    // Compile model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    return model;
  }

  /**
   * Save model to disk
   */
  async saveModel() {
    if (this.model) {
      await this.model.save(`file://${this.modelPath}`);
      logger.info('Model saved successfully');
    }
  }

  /**
   * Preprocess text for model input
   */
  preprocessText(text) {
    // Normalize text
    const normalizedText = text.toUpperCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Tokenize
    const tokens = normalizedText.split(' ').filter(token => token.length > 0);
    
    // Convert to indices
    const indices = tokens.map(token => {
      return this.vocabulary.get(token) || this.vocabulary.get('<UNK>');
    });
    
    // Pad or truncate to fixed length
    const paddedIndices = new Array(this.maxSequenceLength).fill(this.vocabulary.get('<PAD>'));
    for (let i = 0; i < Math.min(indices.length, this.maxSequenceLength); i++) {
      paddedIndices[i] = indices[i];
    }
    
    return paddedIndices;
  }

  /**
   * Enhanced word recognition with LSTM model
   */
  async recognizeWords(text, options = {}) {
    try {
      const {
        confidence_threshold = 0.7,
        max_suggestions = 5,
        use_context = true,
        target_library = 'BSL'
      } = options;

      if (!this.model) {
        throw new Error('Model not initialized');
      }

      const preprocessed = this.preprocessText(text);
      const inputTensor = tf.tensor2d([preprocessed]);
      
      // Get predictions from LSTM model
      const predictions = await this.model.predict(inputTensor);
      const probabilities = await predictions.data();
      
      // Get top predictions
      const topPredictions = this.getTopPredictions(
        Array.from(probabilities), 
        max_suggestions
      );
      
      // Filter by confidence threshold
      const confidentPredictions = topPredictions.filter(
        pred => pred.confidence >= confidence_threshold
      );
      
      // Enhance with context if enabled
      const enhancedPredictions = use_context ? 
        await this.enhanceWithContext(confidentPredictions, text, target_library) :
        confidentPredictions;
      
      // Clean up tensors
      inputTensor.dispose();
      predictions.dispose();
      
      const result = {
        originalText: text,
        preprocessedTokens: preprocessed.map(idx => this.reverseLookup.get(idx)),
        predictions: enhancedPredictions,
        modelConfidence: enhancedPredictions[0]?.confidence || 0,
        processingTime: Date.now(),
        metadata: {
          modelType: 'LSTM',
          vocabularySize: this.vocabulary.size,
          sequenceLength: this.maxSequenceLength,
          targetLibrary: target_library
        }
      };

      logger.info('Word recognition completed', {
        textLength: text.length,
        predictionsCount: enhancedPredictions.length,
        topConfidence: result.modelConfidence
      });

      return result;

    } catch (error) {
      logger.error('Word recognition failed', {
        error: error.message,
        text: text.substring(0, 100),
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get top N predictions from model output
   */
  getTopPredictions(probabilities, maxSuggestions = 5) {
    const predictions = probabilities
      .map((prob, index) => ({
        word: this.reverseLookup.get(index),
        confidence: prob,
        index
      }))
      .filter(pred => pred.word && !['<PAD>', '<START>', '<END>'].includes(pred.word))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions);

    return predictions;
  }

  /**
   * Enhance predictions with contextual information
   */
  async enhanceWithContext(predictions, originalText, targetLibrary) {
    const enhancedPredictions = [];
    
    for (const prediction of predictions) {
      const enhancement = await this.getContextualEnhancement(
        prediction, 
        originalText, 
        targetLibrary
      );
      
      enhancedPredictions.push({
        ...prediction,
        ...enhancement
      });
    }
    
    // Re-sort by enhanced confidence
    return enhancedPredictions.sort((a, b) => b.enhancedConfidence - a.enhancedConfidence);
  }

  /**
   * Get contextual enhancement for a prediction
   */
  async getContextualEnhancement(prediction, originalText, targetLibrary) {
    let enhancedConfidence = prediction.confidence;
    const contextualFactors = [];
    
    // Check if word exists in target gesture library
    const library = gestureLibraryService.getLibrary(targetLibrary);
    if (library) {
      if (library.commonWords && library.commonWords[prediction.word]) {
        enhancedConfidence *= 1.2; // Boost confidence for known gestures
        contextualFactors.push('known_gesture');
      }
      
      if (library.alphabet && library.alphabet[prediction.word]) {
        enhancedConfidence *= 1.1; // Boost for alphabet letters
        contextualFactors.push('alphabet_letter');
      }
    }
    
    // Check semantic similarity using natural language processing
    const semanticBoost = this.calculateSemanticSimilarity(prediction.word, originalText);
    enhancedConfidence *= (1 + semanticBoost * 0.1);
    
    if (semanticBoost > 0.5) {
      contextualFactors.push('semantic_match');
    }
    
    // Check for common word patterns
    if (this.isCommonWord(prediction.word)) {
      enhancedConfidence *= 1.05;
      contextualFactors.push('common_word');
    }
    
    return {
      enhancedConfidence: Math.min(enhancedConfidence, 1.0),
      contextualFactors,
      gestureAvailable: !!(library?.commonWords?.[prediction.word]),
      alphabetAvailable: !!(library?.alphabet?.[prediction.word])
    };
  }

  /**
   * Calculate semantic similarity between words
   */
  calculateSemanticSimilarity(word1, text) {
    const tokens = text.toUpperCase().split(/\s+/);
    let maxSimilarity = 0;
    
    for (const token of tokens) {
      const similarity = natural.JaroWinklerDistance(word1, token);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
    
    return maxSimilarity;
  }

  /**
   * Check if word is commonly used
   */
  isCommonWord(word) {
    const commonWords = new Set([
      'THE', 'BE', 'TO', 'OF', 'AND', 'A', 'IN', 'THAT', 'HAVE', 'I',
      'IT', 'FOR', 'NOT', 'ON', 'WITH', 'HE', 'AS', 'YOU', 'DO', 'AT',
      'HELLO', 'THANK', 'PLEASE', 'YES', 'NO', 'HELP', 'WATER', 'FOOD'
    ]);
    
    return commonWords.has(word);
  }

  /**
   * Train model with new data
   */
  async trainModel(trainingData, options = {}) {
    try {
      const {
        epochs = 10,
        batchSize = 32,
        validationSplit = 0.2,
        learningRate = 0.001
      } = options;

      if (!trainingData || trainingData.length === 0) {
        throw new Error('No training data provided');
      }

      logger.info('Starting model training', {
        dataSize: trainingData.length,
        epochs,
        batchSize
      });

      // Prepare training data
      const { inputs, labels } = this.prepareTrainingData(trainingData);
      
      // Create tensors
      const inputTensor = tf.tensor2d(inputs);
      const labelTensor = tf.tensor2d(labels);
      
      // Update optimizer learning rate
      this.model.optimizer = tf.train.adam(learningRate);
      
      // Train model
      const history = await this.model.fit(inputTensor, labelTensor, {
        epochs,
        batchSize,
        validationSplit,
        verbose: 1,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            logger.info(`Epoch ${epoch + 1} completed`, {
              loss: logs.loss.toFixed(4),
              accuracy: logs.acc.toFixed(4),
              valLoss: logs.val_loss?.toFixed(4),
              valAccuracy: logs.val_acc?.toFixed(4)
            });
          }
        }
      });
      
      // Save updated model
      await this.saveModel();
      
      // Clean up tensors
      inputTensor.dispose();
      labelTensor.dispose();
      
      const finalAccuracy = history.history.acc[history.history.acc.length - 1];
      const finalLoss = history.history.loss[history.history.loss.length - 1];
      
      logger.info('Model training completed', {
        finalAccuracy: finalAccuracy.toFixed(4),
        finalLoss: finalLoss.toFixed(4),
        epochs
      });
      
      return {
        success: true,
        finalAccuracy,
        finalLoss,
        epochsCompleted: epochs,
        trainingDataSize: trainingData.length
      };

    } catch (error) {
      logger.error('Model training failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Prepare training data for model
   */
  prepareTrainingData(trainingData) {
    const inputs = [];
    const labels = [];
    
    for (const item of trainingData) {
      const input = this.preprocessText(item.text);
      const label = this.createOneHotLabel(item.expectedWord);
      
      inputs.push(input);
      labels.push(label);
    }
    
    return { inputs, labels };
  }

  /**
   * Create one-hot encoded label
   */
  createOneHotLabel(word) {
    const label = new Array(this.vocabulary.size).fill(0);
    const index = this.vocabulary.get(word.toUpperCase());
    
    if (index !== undefined) {
      label[index] = 1;
    } else {
      // Use UNK token for unknown words
      const unkIndex = this.vocabulary.get('<UNK>');
      if (unkIndex !== undefined) {
        label[unkIndex] = 1;
      }
    }
    
    return label;
  }

  /**
   * Evaluate model performance
   */
  async evaluateModel(testData) {
    try {
      if (!testData || testData.length === 0) {
        throw new Error('No test data provided');
      }

      const { inputs, labels } = this.prepareTrainingData(testData);
      
      const inputTensor = tf.tensor2d(inputs);
      const labelTensor = tf.tensor2d(labels);
      
      const evaluation = await this.model.evaluate(inputTensor, labelTensor);
      const loss = await evaluation[0].data();
      const accuracy = await evaluation[1].data();
      
      // Clean up tensors
      inputTensor.dispose();
      labelTensor.dispose();
      evaluation.forEach(tensor => tensor.dispose());
      
      const results = {
        testDataSize: testData.length,
        loss: loss[0],
        accuracy: accuracy[0],
        evaluatedAt: new Date().toISOString()
      };
      
      logger.info('Model evaluation completed', results);
      
      return results;

    } catch (error) {
      logger.error('Model evaluation failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get model statistics and information
   */
  getModelInfo() {
    return {
      vocabularySize: this.vocabulary.size,
      maxSequenceLength: this.maxSequenceLength,
      embeddingDim: this.embeddingDim,
      hiddenDim: this.hiddenDim,
      modelLoaded: !!this.model,
      totalParameters: this.model ? this.model.countParams() : 0,
      architecture: this.model ? {
        layers: this.model.layers.length,
        layerTypes: this.model.layers.map(layer => layer.getClassName())
      } : null
    };
  }

  /**
   * Add new words to vocabulary
   */
  async addToVocabulary(words) {
    let addedCount = 0;
    
    for (const word of words) {
      const upperWord = word.toUpperCase();
      if (!this.vocabulary.has(upperWord)) {
        const newIndex = this.vocabulary.size;
        this.vocabulary.set(upperWord, newIndex);
        this.reverseLookup.set(newIndex, upperWord);
        addedCount++;
      }
    }
    
    if (addedCount > 0) {
      await this.saveVocabulary();
      logger.info('Added new words to vocabulary', { addedCount, totalSize: this.vocabulary.size });
      
      // Model will need retraining with expanded vocabulary
      return {
        addedCount,
        newVocabularySize: this.vocabulary.size,
        requiresRetraining: true
      };
    }
    
    return {
      addedCount: 0,
      vocabularySize: this.vocabulary.size,
      requiresRetraining: false
    };
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    
    logger.info('Word Recognition Service disposed');
  }
}

module.exports = new WordRecognitionService();