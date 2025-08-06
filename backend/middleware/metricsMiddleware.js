const metricsCollector = require('../services/metricsCollector');

const metricsMiddleware = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route ? req.route.path : req.path;
        
        metricsCollector.recordHttpRequest(
            req.method,
            route,
            res.statusCode,
            duration
        );
    });
    
    next();
};

module.exports = metricsMiddleware;