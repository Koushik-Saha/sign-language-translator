const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const validator = require('validator');
const logger = require('./logger');

class SecurityAuditor {
    constructor() {
        this.auditResults = [];
        this.vulnerabilities = [];
        this.securityChecks = [
            'checkPasswordPolicies',
            'checkInputValidation',
            'checkSQLInjectionVulnerabilities',
            'checkXSSVulnerabilities',
            'checkCSRFProtection',
            'checkFileUploadSecurity',
            'checkAuthenticationSecurity',
            'checkSessionManagement',
            'checkHTTPSConfiguration',
            'checkSecurityHeaders',
            'checkRateLimiting',
            'checkLogging',
            'checkDependencyVulnerabilities',
            'checkEnvironmentConfiguration',
            'checkFilePermissions'
        ];
    }

    async runFullSecurityAudit() {
        const auditId = crypto.randomUUID();
        const startTime = Date.now();

        logger.info('Starting comprehensive security audit', { auditId });

        try {
            this.auditResults = [];
            this.vulnerabilities = [];

            // Run all security checks
            for (const checkName of this.securityChecks) {
                try {
                    logger.info(`Running security check: ${checkName}`);
                    await this[checkName]();
                } catch (error) {
                    logger.error(`Security check failed: ${checkName}`, {
                        error: error.message
                    });
                    this.addVulnerability('check_failure', `Security check ${checkName} failed: ${error.message}`, 'HIGH');
                }
            }

            const auditSummary = this.generateAuditSummary(auditId, startTime);
            
            // Save audit report
            await this.saveAuditReport(auditSummary);
            
            logger.info('Security audit completed', {
                auditId,
                duration: Date.now() - startTime,
                totalChecks: this.securityChecks.length,
                vulnerabilitiesFound: this.vulnerabilities.length
            });

            return auditSummary;

        } catch (error) {
            logger.error('Security audit failed', {
                auditId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async checkPasswordPolicies() {
        const results = {
            checkName: 'Password Policies',
            status: 'PASS',
            issues: []
        };

        // Check if password validation middleware exists
        try {
            const authFiles = await this.findFilesContaining(['password', 'auth']);
            let hasPasswordValidation = false;
            let hasMinLength = false;
            let hasComplexity = false;

            for (const file of authFiles) {
                const content = await fs.readFile(file, 'utf8');
                
                if (content.includes('password') && content.includes('length')) {
                    hasMinLength = true;
                }
                
                if (content.includes('password') && (
                    content.includes('uppercase') || 
                    content.includes('lowercase') || 
                    content.includes('number') || 
                    content.includes('special')
                )) {
                    hasComplexity = true;
                }

                if (content.includes('validatePassword') || content.includes('passwordStrength')) {
                    hasPasswordValidation = true;
                }
            }

            if (!hasPasswordValidation) {
                results.issues.push('No password validation function found');
                this.addVulnerability('weak_password', 'Missing password validation', 'MEDIUM');
            }

            if (!hasMinLength) {
                results.issues.push('No minimum password length enforcement detected');
                this.addVulnerability('weak_password', 'No minimum password length', 'MEDIUM');
            }

            if (!hasComplexity) {
                results.issues.push('No password complexity requirements detected');
                this.addVulnerability('weak_password', 'No password complexity requirements', 'LOW');
            }

            if (results.issues.length > 0) {
                results.status = 'FAIL';
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkInputValidation() {
        const results = {
            checkName: 'Input Validation',
            status: 'PASS',
            issues: []
        };

        try {
            const routeFiles = await this.findFilesContaining(['router', 'app.post', 'app.get']);
            let hasValidation = false;
            let hasSanitization = false;

            for (const file of routeFiles) {
                const content = await fs.readFile(file, 'utf8');
                
                if (content.includes('express-validator') || content.includes('joi') || content.includes('yup')) {
                    hasValidation = true;
                }

                if (content.includes('sanitize') || content.includes('xss') || content.includes('mongo-sanitize')) {
                    hasSanitization = true;
                }

                // Check for dangerous patterns
                if (content.includes('req.body') && !content.includes('validate')) {
                    results.issues.push(`Unvalidated input in ${path.basename(file)}`);
                }
            }

            if (!hasValidation) {
                results.issues.push('No input validation library detected');
                this.addVulnerability('input_validation', 'Missing input validation', 'HIGH');
                results.status = 'FAIL';
            }

            if (!hasSanitization) {
                results.issues.push('No input sanitization detected');
                this.addVulnerability('input_validation', 'Missing input sanitization', 'HIGH');
                results.status = 'FAIL';
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkSQLInjectionVulnerabilities() {
        const results = {
            checkName: 'SQL Injection Protection',
            status: 'PASS',
            issues: []
        };

        try {
            const dbFiles = await this.findFilesContaining(['query', 'sql', 'database']);
            let hasParameterizedQueries = false;
            let hasUnsafeQueries = false;

            for (const file of dbFiles) {
                const content = await fs.readFile(file, 'utf8');
                
                // Check for parameterized queries
                if (content.includes('$1') || content.includes('?') || content.includes('prepared')) {
                    hasParameterizedQueries = true;
                }

                // Check for unsafe query patterns
                const unsafePatterns = [
                    /\$\{.*\}/g, // String interpolation
                    /\+.*req\./g, // String concatenation with request
                    /`.*\$\{.*\}`/g // Template literals with variables
                ];

                for (const pattern of unsafePatterns) {
                    if (pattern.test(content)) {
                        hasUnsafeQueries = true;
                        results.issues.push(`Potentially unsafe query pattern in ${path.basename(file)}`);
                    }
                }
            }

            if (hasUnsafeQueries) {
                this.addVulnerability('sql_injection', 'Potentially unsafe database queries detected', 'HIGH');
                results.status = 'FAIL';
            }

            if (!hasParameterizedQueries && dbFiles.length > 0) {
                results.issues.push('No parameterized queries detected');
                this.addVulnerability('sql_injection', 'No parameterized queries', 'MEDIUM');
                results.status = 'WARN';
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkXSSVulnerabilities() {
        const results = {
            checkName: 'XSS Protection',
            status: 'PASS',
            issues: []
        };

        try {
            const files = await this.findFilesContaining(['res.send', 'res.render', 'innerHTML']);
            let hasXSSProtection = false;
            let hasUnsafeOutput = false;

            for (const file of files) {
                const content = await fs.readFile(file, 'utf8');
                
                if (content.includes('xss') || content.includes('sanitize') || content.includes('escape')) {
                    hasXSSProtection = true;
                }

                // Check for unsafe output patterns
                if (content.includes('innerHTML') && !content.includes('sanitize')) {
                    hasUnsafeOutput = true;
                    results.issues.push(`Unsafe innerHTML usage in ${path.basename(file)}`);
                }

                if (content.includes('res.send(') && content.includes('req.')) {
                    const lines = content.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes('res.send(') && lines[i].includes('req.') && !lines[i].includes('sanitize')) {
                            results.issues.push(`Potentially unsafe output in ${path.basename(file)}:${i + 1}`);
                            hasUnsafeOutput = true;
                        }
                    }
                }
            }

            if (hasUnsafeOutput) {
                this.addVulnerability('xss', 'Potentially unsafe output detected', 'HIGH');
                results.status = 'FAIL';
            }

            if (!hasXSSProtection && files.length > 0) {
                results.issues.push('No XSS protection middleware detected');
                this.addVulnerability('xss', 'Missing XSS protection', 'HIGH');
                results.status = 'FAIL';
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkCSRFProtection() {
        const results = {
            checkName: 'CSRF Protection',
            status: 'PASS',
            issues: []
        };

        try {
            const files = await this.findFilesContaining(['post', 'put', 'delete']);
            let hasCSRFProtection = false;

            for (const file of files) {
                const content = await fs.readFile(file, 'utf8');
                
                if (content.includes('csrf') || content.includes('_csrf') || content.includes('x-csrf-token')) {
                    hasCSRFProtection = true;
                }
            }

            if (!hasCSRFProtection) {
                results.issues.push('No CSRF protection detected');
                this.addVulnerability('csrf', 'Missing CSRF protection', 'MEDIUM');
                results.status = 'FAIL';
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkFileUploadSecurity() {
        const results = {
            checkName: 'File Upload Security',
            status: 'PASS',
            issues: []
        };

        try {
            const files = await this.findFilesContaining(['multer', 'upload', 'file']);
            let hasFileTypeValidation = false;
            let hasFileSizeLimit = false;

            for (const file of files) {
                const content = await fs.readFile(file, 'utf8');
                
                if (content.includes('mimetype') || content.includes('fileFilter')) {
                    hasFileTypeValidation = true;
                }

                if (content.includes('limits') || content.includes('fileSize')) {
                    hasFileSizeLimit = true;
                }
            }

            if (files.length > 0) {
                if (!hasFileTypeValidation) {
                    results.issues.push('No file type validation detected');
                    this.addVulnerability('file_upload', 'Missing file type validation', 'HIGH');
                    results.status = 'FAIL';
                }

                if (!hasFileSizeLimit) {
                    results.issues.push('No file size limits detected');
                    this.addVulnerability('file_upload', 'Missing file size limits', 'MEDIUM');
                    if (results.status === 'PASS') results.status = 'WARN';
                }
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkAuthenticationSecurity() {
        const results = {
            checkName: 'Authentication Security',
            status: 'PASS',
            issues: []
        };

        try {
            const authFiles = await this.findFilesContaining(['jwt', 'auth', 'login']);
            let hasJWTSecurity = false;
            let hasPasswordHashing = false;

            for (const file of authFiles) {
                const content = await fs.readFile(file, 'utf8');
                
                if (content.includes('jwt') && (content.includes('secret') || content.includes('private'))) {
                    hasJWTSecurity = true;
                }

                if (content.includes('bcrypt') || content.includes('argon') || content.includes('hash')) {
                    hasPasswordHashing = true;
                }

                // Check for hardcoded secrets
                if (content.includes('secret') && content.includes('=') && content.includes('"')) {
                    const lines = content.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes('secret') && lines[i].includes('=') && lines[i].includes('"')) {
                            results.issues.push(`Potential hardcoded secret in ${path.basename(file)}:${i + 1}`);
                        }
                    }
                }
            }

            if (!hasJWTSecurity && authFiles.length > 0) {
                results.issues.push('JWT security configuration not detected');
                this.addVulnerability('auth', 'Weak JWT configuration', 'MEDIUM');
                results.status = 'WARN';
            }

            if (!hasPasswordHashing && authFiles.length > 0) {
                results.issues.push('Password hashing not detected');
                this.addVulnerability('auth', 'Missing password hashing', 'HIGH');
                results.status = 'FAIL';
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkSessionManagement() {
        const results = {
            checkName: 'Session Management',
            status: 'PASS',
            issues: []
        };

        try {
            const files = await this.findFilesContaining(['session', 'cookie']);
            let hasSecureCookies = false;
            let hasSessionTimeout = false;

            for (const file of files) {
                const content = await fs.readFile(file, 'utf8');
                
                if (content.includes('secure: true') || content.includes('httpOnly: true')) {
                    hasSecureCookies = true;
                }

                if (content.includes('maxAge') || content.includes('expires')) {
                    hasSessionTimeout = true;
                }
            }

            if (files.length > 0) {
                if (!hasSecureCookies) {
                    results.issues.push('Secure cookie configuration not detected');
                    this.addVulnerability('session', 'Insecure cookie configuration', 'MEDIUM');
                    results.status = 'WARN';
                }

                if (!hasSessionTimeout) {
                    results.issues.push('Session timeout not configured');
                    this.addVulnerability('session', 'No session timeout', 'LOW');
                    if (results.status === 'PASS') results.status = 'WARN';
                }
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkHTTPSConfiguration() {
        const results = {
            checkName: 'HTTPS Configuration',
            status: 'PASS',
            issues: []
        };

        try {
            const serverFiles = await this.findFilesContaining(['server', 'app.listen', 'https']);
            let hasHTTPS = false;

            for (const file of serverFiles) {
                const content = await fs.readFile(file, 'utf8');
                
                if (content.includes('https') || content.includes('ssl') || content.includes('tls')) {
                    hasHTTPS = true;
                }
            }

            // Check environment variables
            if (process.env.NODE_ENV === 'production' && !hasHTTPS) {
                results.issues.push('HTTPS not configured for production');
                this.addVulnerability('https', 'Missing HTTPS in production', 'HIGH');
                results.status = 'FAIL';
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkSecurityHeaders() {
        const results = {
            checkName: 'Security Headers',
            status: 'PASS',
            issues: []
        };

        try {
            const files = await this.findFilesContaining(['helmet', 'header']);
            let hasHelmet = false;

            for (const file of files) {
                const content = await fs.readFile(file, 'utf8');
                
                if (content.includes('helmet') || (
                    content.includes('X-Frame-Options') &&
                    content.includes('X-Content-Type-Options') &&
                    content.includes('X-XSS-Protection')
                )) {
                    hasHelmet = true;
                }
            }

            if (!hasHelmet) {
                results.issues.push('Security headers middleware not detected');
                this.addVulnerability('headers', 'Missing security headers', 'MEDIUM');
                results.status = 'FAIL';
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkRateLimiting() {
        const results = {
            checkName: 'Rate Limiting',
            status: 'PASS',
            issues: []
        };

        try {
            const files = await this.findFilesContaining(['rate', 'limit']);
            let hasRateLimit = false;

            for (const file of files) {
                const content = await fs.readFile(file, 'utf8');
                
                if (content.includes('express-rate-limit') || content.includes('rateLimit')) {
                    hasRateLimit = true;
                }
            }

            if (!hasRateLimit) {
                results.issues.push('Rate limiting not detected');
                this.addVulnerability('rate_limit', 'Missing rate limiting', 'MEDIUM');
                results.status = 'FAIL';
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkLogging() {
        const results = {
            checkName: 'Security Logging',
            status: 'PASS',
            issues: []
        };

        try {
            const files = await this.findFilesContaining(['log', 'winston']);
            let hasLogging = false;
            let hasSecurityLogging = false;

            for (const file of files) {
                const content = await fs.readFile(file, 'utf8');
                
                if (content.includes('winston') || content.includes('log')) {
                    hasLogging = true;
                }

                if (content.includes('security') && content.includes('log')) {
                    hasSecurityLogging = true;
                }
            }

            if (!hasLogging) {
                results.issues.push('Logging framework not detected');
                this.addVulnerability('logging', 'Missing logging', 'LOW');
                results.status = 'WARN';
            }

            if (!hasSecurityLogging) {
                results.issues.push('Security-specific logging not detected');
                this.addVulnerability('logging', 'Missing security logging', 'LOW');
                if (results.status === 'PASS') results.status = 'WARN';
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkDependencyVulnerabilities() {
        const results = {
            checkName: 'Dependency Vulnerabilities',
            status: 'PASS',
            issues: []
        };

        try {
            const packageJsonPath = path.join(__dirname, '../../package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            
            // Check for known vulnerable packages (simplified check)
            const knownVulnerable = [
                'lodash',
                'moment',
                'request',
                'jquery',
                'handlebars'
            ];

            const dependencies = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies
            };

            for (const [pkg, version] of Object.entries(dependencies)) {
                if (knownVulnerable.includes(pkg)) {
                    results.issues.push(`Potentially vulnerable dependency: ${pkg}@${version}`);
                    this.addVulnerability('dependency', `Vulnerable dependency: ${pkg}`, 'MEDIUM');
                    results.status = 'WARN';
                }
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkEnvironmentConfiguration() {
        const results = {
            checkName: 'Environment Configuration',
            status: 'PASS',
            issues: []
        };

        try {
            // Check for sensitive data in environment
            const sensitiveVars = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN'];
            const envVars = Object.keys(process.env);
            
            for (const varName of envVars) {
                if (sensitiveVars.some(sensitive => varName.includes(sensitive))) {
                    const value = process.env[varName];
                    if (value && value.length < 20) {
                        results.issues.push(`Weak ${varName} detected`);
                        this.addVulnerability('env', `Weak environment variable: ${varName}`, 'MEDIUM');
                        results.status = 'WARN';
                    }
                }
            }

            // Check NODE_ENV
            if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'development') {
                results.issues.push('NODE_ENV not properly set');
                this.addVulnerability('env', 'NODE_ENV not configured', 'LOW');
                if (results.status === 'PASS') results.status = 'WARN';
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async checkFilePermissions() {
        const results = {
            checkName: 'File Permissions',
            status: 'PASS',
            issues: []
        };

        try {
            const sensitiveFiles = [
                '.env',
                'package.json',
                'server.js'
            ];

            for (const fileName of sensitiveFiles) {
                try {
                    const filePath = path.join(__dirname, '..', fileName);
                    const stats = await fs.stat(filePath);
                    const mode = (stats.mode & parseInt('777', 8)).toString(8);
                    
                    if (mode === '777' || mode === '666') {
                        results.issues.push(`Overly permissive file permissions on ${fileName}: ${mode}`);
                        this.addVulnerability('permissions', `Insecure file permissions: ${fileName}`, 'MEDIUM');
                        results.status = 'WARN';
                    }
                } catch (error) {
                    // File doesn't exist or can't be accessed
                }
            }

        } catch (error) {
            results.status = 'ERROR';
            results.error = error.message;
        }

        this.auditResults.push(results);
    }

    async findFilesContaining(patterns) {
        const files = [];
        const projectRoot = path.join(__dirname, '..');
        
        async function searchDirectory(dir) {
            try {
                const items = await fs.readdir(dir, { withFileTypes: true });
                
                for (const item of items) {
                    if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
                        await searchDirectory(path.join(dir, item.name));
                    } else if (item.isFile() && item.name.endsWith('.js')) {
                        const filePath = path.join(dir, item.name);
                        try {
                            const content = await fs.readFile(filePath, 'utf8');
                            if (patterns.some(pattern => content.includes(pattern))) {
                                files.push(filePath);
                            }
                        } catch (error) {
                            // Skip files that can't be read
                        }
                    }
                }
            } catch (error) {
                // Skip directories that can't be read
            }
        }
        
        await searchDirectory(projectRoot);
        return files;
    }

    addVulnerability(type, description, severity) {
        this.vulnerabilities.push({
            type,
            description,
            severity,
            timestamp: new Date().toISOString()
        });
    }

    generateAuditSummary(auditId, startTime) {
        const duration = Date.now() - startTime;
        const summary = {
            auditId,
            timestamp: new Date().toISOString(),
            duration,
            totalChecks: this.auditResults.length,
            results: {
                passed: this.auditResults.filter(r => r.status === 'PASS').length,
                warnings: this.auditResults.filter(r => r.status === 'WARN').length,
                failed: this.auditResults.filter(r => r.status === 'FAIL').length,
                errors: this.auditResults.filter(r => r.status === 'ERROR').length
            },
            vulnerabilities: {
                total: this.vulnerabilities.length,
                high: this.vulnerabilities.filter(v => v.severity === 'HIGH').length,
                medium: this.vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
                low: this.vulnerabilities.filter(v => v.severity === 'LOW').length
            },
            checkResults: this.auditResults,
            vulnerabilityDetails: this.vulnerabilities,
            recommendations: this.generateRecommendations()
        };

        return summary;
    }

    generateRecommendations() {
        const recommendations = [];

        if (this.vulnerabilities.some(v => v.type === 'input_validation')) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Input Validation',
                action: 'Implement comprehensive input validation using express-validator or similar library',
                description: 'All user inputs should be validated and sanitized to prevent injection attacks'
            });
        }

        if (this.vulnerabilities.some(v => v.type === 'xss')) {
            recommendations.push({
                priority: 'HIGH',
                category: 'XSS Protection',
                action: 'Implement XSS protection middleware and sanitize all output',
                description: 'Use libraries like xss to sanitize user content before rendering'
            });
        }

        if (this.vulnerabilities.some(v => v.type === 'csrf')) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'CSRF Protection',
                action: 'Implement CSRF tokens for all state-changing operations',
                description: 'Add CSRF protection middleware to prevent cross-site request forgery attacks'
            });
        }

        if (this.vulnerabilities.some(v => v.type === 'https')) {
            recommendations.push({
                priority: 'HIGH',
                category: 'HTTPS',
                action: 'Configure HTTPS for production environment',
                description: 'Ensure all production traffic uses HTTPS to protect data in transit'
            });
        }

        if (this.vulnerabilities.some(v => v.type === 'rate_limit')) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'Rate Limiting',
                action: 'Implement rate limiting middleware',
                description: 'Add rate limiting to prevent abuse and DoS attacks'
            });
        }

        return recommendations;
    }

    async saveAuditReport(auditSummary) {
        try {
            const reportsDir = path.join(__dirname, '../reports');
            await fs.mkdir(reportsDir, { recursive: true });
            
            const reportPath = path.join(reportsDir, `security-audit-${auditSummary.auditId}.json`);
            await fs.writeFile(reportPath, JSON.stringify(auditSummary, null, 2));
            
            logger.info('Security audit report saved', {
                reportPath,
                auditId: auditSummary.auditId
            });
        } catch (error) {
            logger.error('Failed to save audit report', {
                error: error.message,
                auditId: auditSummary.auditId
            });
        }
    }
}

module.exports = new SecurityAuditor();