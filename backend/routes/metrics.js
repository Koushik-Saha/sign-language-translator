const express = require('express');
const metricsCollector = require('../services/metricsCollector');
const { AnalyticsService } = require('../services/analyticsService');
const router = express.Router();

router.get('/metrics', (req, res) => {
    res.set('Content-Type', metricsCollector.getRegistry().contentType);
    res.send(metricsCollector.getMetrics());
});

router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        activeUsers: AnalyticsService.getActiveUserCount()
    });
});

router.get('/analytics/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate } = req.query;
        
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        
        const analytics = await AnalyticsService.getUserAnalytics(userId, start, end);
        res.json(analytics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/analytics/system', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        
        const analytics = await AnalyticsService.getSystemAnalytics(start, end);
        res.json(analytics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/analytics/track', async (req, res) => {
    try {
        const { sessionId, action, details } = req.body;
        
        AnalyticsService.trackUserAction(sessionId, action, details);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;