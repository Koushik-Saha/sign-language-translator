import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const translationTime = new Trend('translation_time');
const socketConnections = new Counter('socket_connections');

// Test configuration
export const options = {
    stages: [
        { duration: '1m', target: 20 },   // Ramp up
        { duration: '3m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 200 },  // Spike to 200 users
        { duration: '1m', target: 200 },  // Stay at spike
        { duration: '2m', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1000'],
        http_req_failed: ['rate<0.01'], // Error rate should be less than 1%
        error_rate: ['rate<0.05'],
        translation_time: ['p(95)<2000'], // 95% of translations under 2s
    },
};

const BASE_URL = 'http://localhost:5000';
let authToken = '';

export function setup() {
    // Setup test data
    console.log('Setting up load test...');
    
    // Create test user
    const registerResponse = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
        username: 'loadtestuser',
        email: 'loadtest@example.com',
        password: 'LoadTest123!'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
    
    if (registerResponse.status === 201 || registerResponse.status === 409) {
        // User created or already exists
        const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
            email: 'loadtest@example.com',
            password: 'LoadTest123!'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (loginResponse.status === 200) {
            const loginData = JSON.parse(loginResponse.body);
            return { authToken: loginData.token };
        }
    }
    
    console.error('Failed to setup test user');
    return {};
}

export default function (data) {
    const testScenario = Math.floor(Math.random() * 4);
    
    switch (testScenario) {
        case 0:
            testAuthentication();
            break;
        case 1:
            testTranslationAPI(data.authToken);
            break;
        case 2:
            testSocketCommunication();
            break;
        case 3:
            testFileUpload(data.authToken);
            break;
    }
    
    sleep(1);
}

function testAuthentication() {
    const userId = Math.floor(Math.random() * 10000);
    
    // Register new user
    const registerStart = Date.now();
    const registerResponse = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
        username: `testuser${userId}`,
        email: `testuser${userId}@example.com`,
        password: 'TestPass123!'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
    
    const registerSuccess = check(registerResponse, {
        'registration status is 201 or 409': (r) => r.status === 201 || r.status === 409,
        'registration response time < 2000ms': (r) => Date.now() - registerStart < 2000,
    });
    
    errorRate.add(!registerSuccess);
    responseTime.add(Date.now() - registerStart);
    
    // Login
    const loginStart = Date.now();
    const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        email: `testuser${userId}@example.com`,
        password: 'TestPass123!'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
    
    const loginSuccess = check(loginResponse, {
        'login status is 200': (r) => r.status === 200,
        'login has token': (r) => JSON.parse(r.body).token !== undefined,
        'login response time < 1000ms': (r) => Date.now() - loginStart < 1000,
    });
    
    errorRate.add(!loginSuccess);
    responseTime.add(Date.now() - loginStart);
}

function testTranslationAPI(authToken) {
    if (!authToken) {
        console.log('No auth token available for translation test');
        return;
    }
    
    const testPhrases = [
        'Hello world',
        'How are you?',
        'Thank you very much',
        'Good morning',
        'See you later'
    ];
    
    const phrase = testPhrases[Math.floor(Math.random() * testPhrases.length)];
    
    // Text to sign translation
    const translationStart = Date.now();
    const translationResponse = http.post(`${BASE_URL}/api/ml/text-to-sign`, JSON.stringify({
        text: phrase,
        language: 'asl'
    }), {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        }
    });
    
    const translationDuration = Date.now() - translationStart;
    
    const translationSuccess = check(translationResponse, {
        'translation status is 200': (r) => r.status === 200,
        'translation has result': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.success === true || body.animation !== undefined;
            } catch {
                return false;
            }
        },
        'translation response time < 3000ms': (r) => translationDuration < 3000,
    });
    
    errorRate.add(!translationSuccess);
    translationTime.add(translationDuration);
    responseTime.add(translationDuration);
}

function testSocketCommunication() {
    const url = 'ws://localhost:5000/socket.io/?EIO=4&transport=websocket';
    
    const res = ws.connect(url, {}, function (socket) {
        socketConnections.add(1);
        
        socket.on('open', function () {
            console.log('WebSocket connection opened');
            
            // Join a test room
            socket.send(JSON.stringify({
                type: 'join-room',
                data: {
                    roomId: `test-room-${Math.floor(Math.random() * 10)}`,
                    userId: `load-test-user-${Math.floor(Math.random() * 1000)}`
                }
            }));
        });
        
        socket.on('message', function (data) {
            console.log('Received message:', data);
        });
        
        socket.on('error', function (e) {
            console.log('WebSocket error:', e);
            errorRate.add(1);
        });
        
        // Send some test messages
        for (let i = 0; i < 5; i++) {
            sleep(0.5);
            socket.send(JSON.stringify({
                type: 'send-message',
                data: {
                    message: `Test message ${i}`,
                    roomId: `test-room-${Math.floor(Math.random() * 10)}`
                }
            }));
        }
        
        sleep(2);
        socket.close();
    });
    
    check(res, {
        'WebSocket connection successful': (r) => r && r.status === 101,
    });
}

function testFileUpload(authToken) {
    if (!authToken) {
        console.log('No auth token available for file upload test');
        return;
    }
    
    // Create a small test file data
    const testFileData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAA...'; // Minimal JPEG
    
    const uploadStart = Date.now();
    const uploadResponse = http.post(`${BASE_URL}/api/profile/avatar`, {
        avatar: http.file(Buffer.from(testFileData, 'base64'), 'test.jpg', 'image/jpeg')
    }, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
    
    const uploadSuccess = check(uploadResponse, {
        'upload status is 200': (r) => r.status === 200,
        'upload response time < 5000ms': (r) => Date.now() - uploadStart < 5000,
    });
    
    errorRate.add(!uploadSuccess);
    responseTime.add(Date.now() - uploadStart);
}

export function teardown(data) {
    console.log('Tearing down load test...');
    // Cleanup test data if needed
}