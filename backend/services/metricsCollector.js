const promClient = require('prom-client');
const osUtils = require('node-os-utils');

class MetricsCollector {
    constructor() {
        promClient.collectDefaultMetrics({
            timeout: 5000,
            prefix: 'signlang_'
        });

        this.httpRequestDuration = new promClient.Histogram({
            name: 'signlang_http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.1, 0.5, 1, 2, 5]
        });

        this.httpRequestsTotal = new promClient.Counter({
            name: 'signlang_http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status_code']
        });

        this.translationLatency = new promClient.Histogram({
            name: 'signlang_translation_duration_seconds',
            help: 'Duration of sign language translations in seconds',
            labelNames: ['type', 'language'],
            buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10]
        });

        this.translationAccuracy = new promClient.Histogram({
            name: 'signlang_translation_accuracy',
            help: 'Accuracy score of translations (0-1)',
            labelNames: ['type', 'language'],
            buckets: [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0]
        });

        this.activeUsers = new promClient.Gauge({
            name: 'signlang_active_users',
            help: 'Number of currently active users'
        });

        this.socketConnections = new promClient.Gauge({
            name: 'signlang_socket_connections',
            help: 'Number of active socket connections'
        });

        this.errorRate = new promClient.Counter({
            name: 'signlang_errors_total',
            help: 'Total number of errors',
            labelNames: ['type', 'route', 'error_code']
        });

        this.modelInferenceTime = new promClient.Histogram({
            name: 'signlang_model_inference_duration_seconds',
            help: 'Duration of ML model inference in seconds',
            labelNames: ['model_type'],
            buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2]
        });

        this.systemMetrics = {
            cpu: new promClient.Gauge({
                name: 'signlang_cpu_usage_percent',
                help: 'CPU usage percentage'
            }),
            memory: new promClient.Gauge({
                name: 'signlang_memory_usage_bytes',
                help: 'Memory usage in bytes'
            }),
            disk: new promClient.Gauge({
                name: 'signlang_disk_usage_percent',
                help: 'Disk usage percentage'
            })
        };

        this.collectSystemMetrics();
    }

    recordHttpRequest(method, route, statusCode, duration) {
        this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
        this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    }

    recordTranslation(type, language, duration, accuracy = null) {
        this.translationLatency.observe({ type, language }, duration);
        if (accuracy !== null) {
            this.translationAccuracy.observe({ type, language }, accuracy);
        }
    }

    recordError(type, route, errorCode) {
        this.errorRate.inc({ type, route, error_code: errorCode });
    }

    recordModelInference(modelType, duration) {
        this.modelInferenceTime.observe({ model_type: modelType }, duration);
    }

    setActiveUsers(count) {
        this.activeUsers.set(count);
    }

    setSocketConnections(count) {
        this.socketConnections.set(count);
    }

    async collectSystemMetrics() {
        setInterval(async () => {
            try {
                const cpuUsage = await osUtils.cpu.usage();
                const memoryInfo = await osUtils.mem.info();
                const driveInfo = await osUtils.drive.info();

                this.systemMetrics.cpu.set(cpuUsage);
                this.systemMetrics.memory.set(memoryInfo.usedMemMb * 1024 * 1024);
                this.systemMetrics.disk.set(driveInfo.usedPercentage);
            } catch (error) {
                console.error('Error collecting system metrics:', error);
            }
        }, 15000);
    }

    getMetrics() {
        return promClient.register.metrics();
    }

    getRegistry() {
        return promClient.register;
    }
}

module.exports = new MetricsCollector();