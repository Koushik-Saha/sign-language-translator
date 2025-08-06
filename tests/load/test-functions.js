const crypto = require('crypto');

module.exports = {
    generateRandomString,
    generateTestUser,
    validateResponse,
    setupTestData,
    cleanupTestData
};

function generateRandomString(length = 8) {
    return crypto.randomBytes(length).toString('hex');
}

function generateTestUser(userContext, events, done) {
    const userId = `loadtest_${generateRandomString(6)}`;
    const email = `${userId}@loadtest.com`;
    
    userContext.vars.userId = userId;
    userContext.vars.email = email;
    userContext.vars.password = 'LoadTest123!';
    
    return done();
}

function validateResponse(requestParams, response, context, events, done) {
    const success = response.statusCode >= 200 && response.statusCode < 400;
    
    if (!success) {
        console.log(`Request failed: ${response.statusCode} - ${response.body}`);
        events.emit('counter', `http.response.${response.statusCode}`, 1);
    }
    
    // Track response times
    if (response.timings) {
        events.emit('histogram', 'response.time', response.timings.phases.total);
    }
    
    return done();
}

function setupTestData(userContext, events, done) {
    // Initialize test data for the user session
    userContext.vars.sessionId = crypto.randomUUID();
    userContext.vars.testStartTime = Date.now();
    
    return done();
}

function cleanupTestData(userContext, events, done) {
    // Clean up any test data if needed
    const sessionDuration = Date.now() - userContext.vars.testStartTime;
    events.emit('histogram', 'session.duration', sessionDuration);
    
    return done();
}