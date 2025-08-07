const MLModel = require('../models/MLModel');
const User = require('../models/User');
const logger = require('./logger');

class ABTestingService {
  constructor() {
    this.activeTests = new Map(); // Cache for active A/B tests
    this.userAssignments = new Map(); // Cache for user assignments
    this.loadActiveTests();
  }

  /**
   * Load active A/B tests from database
   */
  async loadActiveTests() {
    try {
      const activeTests = await MLModel.find({
        'abTesting.isInTest': true,
        'abTesting.testEndDate': { $gt: new Date() }
      });

      activeTests.forEach(model => {
        this.activeTests.set(model._id.toString(), {
          modelId: model._id,
          testGroup: model.abTesting.testGroup,
          trafficPercentage: model.abTesting.trafficPercentage,
          modelType: model.type,
          testEndDate: model.abTesting.testEndDate
        });
      });

      logger.info(`Loaded ${activeTests.length} active A/B tests`);
    } catch (error) {
      logger.error('Error loading active A/B tests:', error);
    }
  }

  /**
   * Assign user to A/B test group
   */
  async assignUserToTest(userId, modelType) {
    try {
      // Check if user already has an assignment for this model type
      const assignmentKey = `${userId}-${modelType}`;
      if (this.userAssignments.has(assignmentKey)) {
        return this.userAssignments.get(assignmentKey);
      }

      // Get active models for this type that are in A/B testing
      const testModels = await MLModel.find({
        type: modelType,
        'abTesting.isInTest': true,
        'abTesting.testEndDate': { $gt: new Date() }
      });

      if (testModels.length === 0) {
        // No A/B test running, use active model
        const activeModel = await MLModel.getActiveModel(modelType);
        if (activeModel) {
          const assignment = {
            modelId: activeModel._id,
            testGroup: 'control',
            isTestParticipant: false
          };
          this.userAssignments.set(assignmentKey, assignment);
          return assignment;
        }
        return null;
      }

      // Determine user assignment based on user ID hash
      const userHash = this.hashUserId(userId);
      let assignment = null;

      // Calculate cumulative traffic percentages
      let cumulativePercentage = 0;
      for (const model of testModels) {
        cumulativePercentage += model.abTesting.trafficPercentage;
        
        if (userHash < cumulativePercentage) {
          assignment = {
            modelId: model._id,
            testGroup: model.abTesting.testGroup,
            isTestParticipant: true,
            testStartDate: model.abTesting.testStartDate
          };
          break;
        }
      }

      // If not assigned to any test model, use control (active model)
      if (!assignment) {
        const activeModel = await MLModel.getActiveModel(modelType);
        assignment = {
          modelId: activeModel ? activeModel._id : testModels[0]._id,
          testGroup: 'control',
          isTestParticipant: false
        };
      }

      // Cache the assignment
      this.userAssignments.set(assignmentKey, assignment);

      // Log assignment for analytics
      logger.info(`User ${userId} assigned to ${assignment.testGroup} for ${modelType} model`);

      return assignment;

    } catch (error) {
      logger.error('Error assigning user to A/B test:', error);
      return null;
    }
  }

  /**
   * Hash user ID for consistent assignment
   */
  hashUserId(userId) {
    let hash = 0;
    const str = userId.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100; // Return percentage 0-99
  }

  /**
   * Get model for user (considering A/B test assignment)
   */
  async getModelForUser(userId, modelType) {
    try {
      const assignment = await this.assignUserToTest(userId, modelType);
      if (!assignment) {
        logger.warn(`No model assignment found for user ${userId}, type ${modelType}`);
        return null;
      }

      const model = await MLModel.findById(assignment.modelId);
      if (!model) {
        logger.error(`Model not found: ${assignment.modelId}`);
        return null;
      }

      return {
        model,
        testGroup: assignment.testGroup,
        isTestParticipant: assignment.isTestParticipant
      };

    } catch (error) {
      logger.error('Error getting model for user:', error);
      return null;
    }
  }

  /**
   * Record user feedback for A/B test
   */
  async recordFeedback(userId, modelType, feedbackData) {
    try {
      const { accuracy, userRating, errorType, completionTime, taskCompleted } = feedbackData;

      const assignment = await this.assignUserToTest(userId, modelType);
      if (!assignment || !assignment.isTestParticipant) {
        return; // Not participating in test
      }

      // Find the model being tested
      const model = await MLModel.findById(assignment.modelId);
      if (!model || !model.abTesting.isInTest) {
        return;
      }

      // Initialize test results if not exists
      if (!model.abTesting.testResults) {
        model.abTesting.testResults = {
          userFeedbackScore: 0,
          errorRate: 0,
          userEngagement: 0,
          completionRate: 0,
          totalFeedback: 0,
          feedbackSum: 0,
          totalTasks: 0,
          completedTasks: 0,
          totalErrors: 0
        };
      }

      // Update test results
      const results = model.abTesting.testResults;
      results.totalFeedback = (results.totalFeedback || 0) + 1;
      results.feedbackSum = (results.feedbackSum || 0) + (userRating || 0);
      results.totalTasks = (results.totalTasks || 0) + 1;
      results.totalErrors = (results.totalErrors || 0) + (errorType ? 1 : 0);

      if (taskCompleted) {
        results.completedTasks = (results.completedTasks || 0) + 1;
      }

      // Calculate aggregated metrics
      results.userFeedbackScore = results.feedbackSum / results.totalFeedback;
      results.errorRate = results.totalErrors / results.totalTasks;
      results.completionRate = (results.completedTasks / results.totalTasks) * 100;

      // Update engagement based on completion time (lower is better for engagement)
      if (completionTime) {
        const engagementScore = Math.max(0, 100 - (completionTime / 1000)); // Simple engagement metric
        results.userEngagement = ((results.userEngagement || 0) + engagementScore) / 2;
      }

      await model.save();

      logger.info(`Feedback recorded for A/B test: ${assignment.testGroup}, model: ${assignment.modelId}`);

    } catch (error) {
      logger.error('Error recording A/B test feedback:', error);
    }
  }

  /**
   * Start new A/B test
   */
  async startABTest(testConfig) {
    try {
      const {
        modelType,
        candidateModelId,
        trafficPercentage = 50,
        testDuration = 7, // days
        testName
      } = testConfig;

      // Get current active model (will be control group)
      const controlModel = await MLModel.getActiveModel(modelType);
      if (!controlModel) {
        throw new Error(`No active model found for type: ${modelType}`);
      }

      // Get candidate model
      const candidateModel = await MLModel.findById(candidateModelId);
      if (!candidateModel) {
        throw new Error('Candidate model not found');
      }

      if (candidateModel.type !== modelType) {
        throw new Error('Candidate model type does not match');
      }

      // Check if there's already an active test for this model type
      const existingTest = await MLModel.findOne({
        type: modelType,
        'abTesting.isInTest': true,
        'abTesting.testEndDate': { $gt: new Date() }
      });

      if (existingTest) {
        throw new Error(`Active A/B test already exists for ${modelType}`);
      }

      // Calculate test end date
      const testEndDate = new Date();
      testEndDate.setDate(testEndDate.getDate() + testDuration);

      // Setup A/B test for candidate model
      await candidateModel.startABTest({
        testGroup: 'B',
        trafficPercentage,
        testEndDate,
        testName: testName || `${modelType}_ab_test_${Date.now()}`
      });

      // Setup control group (keep current active model active)
      controlModel.abTesting = {
        ...controlModel.abTesting,
        isInTest: true,
        testGroup: 'A',
        trafficPercentage: 100 - trafficPercentage,
        testStartDate: new Date(),
        testEndDate,
        testName: testName || `${modelType}_ab_test_${Date.now()}`
      };
      await controlModel.save();

      // Reload active tests cache
      await this.loadActiveTests();

      logger.info(`A/B test started for ${modelType}: A(${controlModel._id}) vs B(${candidateModel._id})`);

      return {
        testId: candidateModel.abTesting.testName,
        controlModel: controlModel._id,
        candidateModel: candidateModel._id,
        trafficSplit: {
          A: 100 - trafficPercentage,
          B: trafficPercentage
        },
        testEndDate
      };

    } catch (error) {
      logger.error('Error starting A/B test:', error);
      throw error;
    }
  }

  /**
   * End A/B test and determine winner
   */
  async endABTest(modelType, winnerGroup = null) {
    try {
      // Get all models participating in the test
      const testModels = await MLModel.find({
        type: modelType,
        'abTesting.isInTest': true
      });

      if (testModels.length === 0) {
        throw new Error(`No active A/B test found for ${modelType}`);
      }

      // Calculate test results for each model
      const results = testModels.map(model => ({
        modelId: model._id,
        testGroup: model.abTesting.testGroup,
        results: model.abTesting.testResults || {},
        performance: model.performance || {}
      }));

      // Determine winner if not specified
      let winner = winnerGroup;
      if (!winner) {
        winner = this.determineWinner(results);
      }

      // Find winning model
      const winningModel = testModels.find(model => model.abTesting.testGroup === winner);
      if (!winningModel) {
        throw new Error(`Winner model not found: ${winner}`);
      }

      // End test for all participating models
      for (const model of testModels) {
        const finalResults = {
          winner: model.abTesting.testGroup === winner,
          ...model.abTesting.testResults
        };

        await model.endABTest(finalResults);

        // Deactivate non-winning models
        if (model.abTesting.testGroup !== winner) {
          await model.deactivate();
        }
      }

      // Activate winning model
      await winningModel.activate();

      // Clear cache
      this.activeTests.clear();
      this.userAssignments.clear();

      logger.info(`A/B test ended for ${modelType}. Winner: ${winner} (${winningModel._id})`);

      return {
        winner,
        winningModel: winningModel._id,
        results
      };

    } catch (error) {
      logger.error('Error ending A/B test:', error);
      throw error;
    }
  }

  /**
   * Determine winner based on test results
   */
  determineWinner(results) {
    // Simple winner determination based on multiple metrics
    const scores = results.map(result => {
      const r = result.results;
      const score = (
        (r.userFeedbackScore || 0) * 0.3 +
        ((100 - (r.errorRate || 0) * 100) / 100) * 0.3 +
        ((r.completionRate || 0) / 100) * 0.2 +
        ((r.userEngagement || 0) / 100) * 0.2
      );

      return {
        testGroup: result.testGroup,
        score: score
      };
    });

    // Return test group with highest score
    const winner = scores.reduce((prev, current) => 
      current.score > prev.score ? current : prev
    );

    return winner.testGroup;
  }

  /**
   * Get A/B test statistics
   */
  async getABTestStatistics(modelType = null) {
    try {
      const filter = { 'abTesting.isInTest': true };
      if (modelType) {
        filter.type = modelType;
      }

      const activeTests = await MLModel.find(filter);

      const stats = activeTests.map(model => ({
        modelId: model._id,
        modelName: model.name,
        modelType: model.type,
        testGroup: model.abTesting.testGroup,
        trafficPercentage: model.abTesting.trafficPercentage,
        testStartDate: model.abTesting.testStartDate,
        testEndDate: model.abTesting.testEndDate,
        daysRemaining: Math.ceil((model.abTesting.testEndDate - new Date()) / (1000 * 60 * 60 * 24)),
        results: model.abTesting.testResults || {},
        performance: {
          accuracy: model.performance?.accuracy || 0,
          precision: model.performance?.precision || 0,
          recall: model.performance?.recall || 0
        }
      }));

      return {
        activeTests: stats.length,
        tests: stats,
        summary: this.generateTestSummary(stats)
      };

    } catch (error) {
      logger.error('Error getting A/B test statistics:', error);
      throw error;
    }
  }

  /**
   * Generate test summary
   */
  generateTestSummary(stats) {
    if (stats.length === 0) return null;

    const byType = stats.reduce((acc, test) => {
      if (!acc[test.modelType]) {
        acc[test.modelType] = [];
      }
      acc[test.modelType].push(test);
      return acc;
    }, {});

    return {
      totalTests: stats.length,
      byType,
      averageTestDuration: stats.reduce((sum, test) => {
        const duration = (test.testEndDate - test.testStartDate) / (1000 * 60 * 60 * 24);
        return sum + duration;
      }, 0) / stats.length
    };
  }

  /**
   * Get user's current test assignments
   */
  async getUserTestAssignments(userId) {
    try {
      const assignments = {};
      const modelTypes = ['gesture_recognition', 'alphabet_classification', 'word_detection', 'fingerspelling'];

      for (const modelType of modelTypes) {
        const assignment = await this.assignUserToTest(userId, modelType);
        if (assignment) {
          assignments[modelType] = assignment;
        }
      }

      return assignments;

    } catch (error) {
      logger.error('Error getting user test assignments:', error);
      return {};
    }
  }
}

module.exports = new ABTestingService();