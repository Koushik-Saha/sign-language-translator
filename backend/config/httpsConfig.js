const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../services/logger');

class HTTPSConfigManager {
    constructor() {
        this.sslOptions = null;
        this.isProductionReady = false;
        this.certificatePaths = {
            dev: {
                cert: path.join(__dirname, '../ssl/dev/server.crt'),
                key: path.join(__dirname, '../ssl/dev/server.key'),
                ca: path.join(__dirname, '../ssl/dev/ca.crt')
            },
            prod: {
                cert: process.env.SSL_CERT_PATH || '/etc/ssl/certs/server.crt',
                key: process.env.SSL_KEY_PATH || '/etc/ssl/private/server.key',
                ca: process.env.SSL_CA_PATH || '/etc/ssl/certs/ca.crt'
            }
        };
    }

    async initializeSSL() {
        try {
            const environment = process.env.NODE_ENV || 'development';
            
            if (environment === 'production') {
                await this.setupProductionSSL();
            } else {
                await this.setupDevelopmentSSL();
            }

            logger.info('SSL/HTTPS configuration initialized', {
                environment,
                isProductionReady: this.isProductionReady
            });

        } catch (error) {
            logger.error('Failed to initialize SSL/HTTPS configuration', {
                error: error.message
            });
            
            if (process.env.NODE_ENV === 'production') {
                throw error; // SSL is critical in production
            }
        }
    }

    async setupProductionSSL() {
        try {
            const certPaths = this.certificatePaths.prod;
            
            // Check if SSL certificates exist
            const certExists = fs.existsSync(certPaths.cert);
            const keyExists = fs.existsSync(certPaths.key);
            
            if (!certExists || !keyExists) {
                throw new Error('SSL certificates not found in production environment');
            }

            // Load SSL certificates
            const cert = fs.readFileSync(certPaths.cert, 'utf8');
            const key = fs.readFileSync(certPaths.key, 'utf8');
            let ca = null;
            
            if (fs.existsSync(certPaths.ca)) {
                ca = fs.readFileSync(certPaths.ca, 'utf8');
            }

            // Validate certificates
            await this.validateCertificates(cert, key);

            this.sslOptions = {
                cert,
                key,
                ca,
                // Security configurations
                ciphers: this.getSecureCiphers(),
                honorCipherOrder: true,
                secureProtocol: 'TLSv1_2_method',
                // HSTS and security headers
                secureOptions: crypto.constants.SSL_OP_NO_SSLv2 | 
                              crypto.constants.SSL_OP_NO_SSLv3 |
                              crypto.constants.SSL_OP_NO_TLSv1 |
                              crypto.constants.SSL_OP_NO_TLSv1_1
            };

            this.isProductionReady = true;
            logger.info('Production SSL certificates loaded successfully');

        } catch (error) {
            logger.error('Failed to setup production SSL', {
                error: error.message
            });
            throw error;
        }
    }

    async setupDevelopmentSSL() {
        try {
            const certDir = path.dirname(this.certificatePaths.dev.cert);
            
            // Create SSL directory if it doesn't exist
            if (!fs.existsSync(certDir)) {
                fs.mkdirSync(certDir, { recursive: true });
            }

            const certPaths = this.certificatePaths.dev;
            
            // Check if development certificates exist
            const certExists = fs.existsSync(certPaths.cert);
            const keyExists = fs.existsSync(certPaths.key);
            
            if (!certExists || !keyExists) {
                logger.info('Development SSL certificates not found, generating self-signed certificates');
                await this.generateSelfSignedCertificates();
            }

            // Load certificates
            const cert = fs.readFileSync(certPaths.cert, 'utf8');
            const key = fs.readFileSync(certPaths.key, 'utf8');

            this.sslOptions = {
                cert,
                key,
                // Less strict for development
                rejectUnauthorized: false
            };

            logger.info('Development SSL certificates loaded');

        } catch (error) {
            logger.warn('Failed to setup development SSL, will use HTTP', {
                error: error.message
            });
            // Don't throw in development - fallback to HTTP
        }
    }

    async generateSelfSignedCertificates() {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            const certDir = path.dirname(this.certificatePaths.dev.cert);
            const keyPath = this.certificatePaths.dev.key;
            const certPath = this.certificatePaths.dev.cert;

            // Generate private key
            await execAsync(`openssl genrsa -out "${keyPath}" 2048`);

            // Generate certificate
            const opensslCommand = `openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`;
            await execAsync(opensslCommand);

            logger.info('Self-signed SSL certificates generated for development');

        } catch (error) {
            logger.error('Failed to generate self-signed certificates', {
                error: error.message
            });

            // Fallback: Create minimal certificates using Node.js crypto
            await this.createMinimalCertificates();
        }
    }

    async createMinimalCertificates() {
        try {
            const forge = require('node-forge');
            const pki = forge.pki;

            // Generate key pair
            const keys = pki.rsa.generateKeyPair(2048);

            // Create certificate
            const cert = pki.createCertificate();
            cert.publicKey = keys.publicKey;
            cert.serialNumber = '01';
            cert.validity.notBefore = new Date();
            cert.validity.notAfter = new Date();
            cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

            const attrs = [{
                name: 'commonName',
                value: 'localhost'
            }, {
                name: 'countryName',
                value: 'US'
            }, {
                shortName: 'ST',
                value: 'State'
            }, {
                name: 'localityName',
                value: 'City'
            }, {
                name: 'organizationName',
                value: 'Development'
            }];

            cert.setSubject(attrs);
            cert.setIssuer(attrs);
            cert.sign(keys.privateKey);

            // Save certificates
            const keyPath = this.certificatePaths.dev.key;
            const certPath = this.certificatePaths.dev.cert;

            fs.writeFileSync(keyPath, pki.privateKeyToPem(keys.privateKey));
            fs.writeFileSync(certPath, pki.certificateToPem(cert));

            logger.info('Minimal SSL certificates created for development');

        } catch (error) {
            // If node-forge is not available, install it first
            logger.warn('Creating basic certificate files', {
                error: error.message
            });
            
            // Create placeholder files (not secure, but allows server to start)
            fs.writeFileSync(this.certificatePaths.dev.key, '');
            fs.writeFileSync(this.certificatePaths.dev.cert, '');
        }
    }

    createServer(app) {
        if (this.sslOptions && (this.isProductionReady || process.env.NODE_ENV !== 'production')) {
            // Create HTTPS server
            const httpsServer = https.createServer(this.sslOptions, app);
            
            // Also create HTTP server that redirects to HTTPS
            if (process.env.NODE_ENV === 'production') {
                const httpApp = this.createHttpsRedirectApp();
                const httpServer = http.createServer(httpApp);
                
                return {
                    httpsServer,
                    httpServer,
                    protocol: 'https',
                    redirectEnabled: true
                };
            }
            
            return {
                httpsServer,
                protocol: 'https',
                redirectEnabled: false
            };
        } else {
            // Fallback to HTTP server
            logger.warn('Running HTTP server - SSL not available');
            const httpServer = http.createServer(app);
            
            return {
                httpServer,
                protocol: 'http',
                redirectEnabled: false
            };
        }
    }

    createHttpsRedirectApp() {
        const express = require('express');
        const redirectApp = express();
        
        redirectApp.use((req, res) => {
            const httpsUrl = `https://${req.headers.host}${req.url}`;
            logger.info('HTTP to HTTPS redirect', {
                originalUrl: req.url,
                redirectUrl: httpsUrl,
                ip: req.ip
            });
            
            res.redirect(301, httpsUrl);
        });
        
        return redirectApp;
    }

    async validateCertificates(cert, key) {
        try {
            // Basic validation - check if certificate and key match
            const forge = require('node-forge');
            const pki = forge.pki;
            
            const certificate = pki.certificateFromPem(cert);
            const privateKey = pki.privateKeyFromPem(key);
            
            // Check if the certificate's public key matches the private key
            const publicKeyPem = pki.publicKeyToPem(certificate.publicKey);
            const derivedPublicKeyPem = pki.publicKeyToPem(pki.rsa.setPublicKey(privateKey.n, privateKey.e));
            
            if (publicKeyPem !== derivedPublicKeyPem) {
                throw new Error('SSL certificate and private key do not match');
            }
            
            // Check certificate expiration
            const now = new Date();
            if (certificate.validity.notAfter < now) {
                logger.warn('SSL certificate has expired', {
                    expiry: certificate.validity.notAfter
                });
            }
            
            // Check if certificate expires soon (within 30 days)
            const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            if (certificate.validity.notAfter < thirtyDaysFromNow) {
                logger.warn('SSL certificate expires soon', {
                    expiry: certificate.validity.notAfter
                });
            }
            
            logger.info('SSL certificate validation passed', {
                subject: certificate.subject.getField('CN')?.value,
                issuer: certificate.issuer.getField('CN')?.value,
                notBefore: certificate.validity.notBefore,
                notAfter: certificate.validity.notAfter
            });
            
        } catch (error) {
            logger.error('SSL certificate validation failed', {
                error: error.message
            });
            throw error;
        }
    }

    getSecureCiphers() {
        // Modern, secure cipher suites
        return [
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES128-SHA256',
            'ECDHE-RSA-AES256-SHA384',
            'ECDHE-RSA-AES256-SHA256',
            'ECDHE-RSA-AES128-SHA',
            'ECDHE-RSA-AES256-SHA',
            'AES128-GCM-SHA256',
            'AES256-GCM-SHA384',
            'AES128-SHA256',
            'AES256-SHA256',
            'AES128-SHA',
            'AES256-SHA'
        ].join(':');
    }

    getSecurityHeaders() {
        return {
            // HSTS - HTTP Strict Transport Security
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
            
            // Content Security Policy
            'Content-Security-Policy': `
                default-src 'self';
                script-src 'self' 'unsafe-eval' 'unsafe-inline';
                style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
                img-src 'self' data: https:;
                font-src 'self' https://fonts.gstatic.com;
                connect-src 'self' wss: https:;
                media-src 'self';
                object-src 'none';
                frame-src 'none';
                base-uri 'self';
                form-action 'self';
            `.replace(/\s+/g, ' ').trim(),
            
            // Other security headers
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
        };
    }

    applySecurityMiddleware(app) {
        // Apply security headers middleware
        app.use((req, res, next) => {
            const securityHeaders = this.getSecurityHeaders();
            
            // Only apply HTTPS-related headers if using HTTPS
            if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
                Object.keys(securityHeaders).forEach(header => {
                    res.setHeader(header, securityHeaders[header]);
                });
            } else {
                // Skip HSTS for HTTP
                const httpHeaders = { ...securityHeaders };
                delete httpHeaders['Strict-Transport-Security'];
                
                Object.keys(httpHeaders).forEach(header => {
                    res.setHeader(header, httpHeaders[header]);
                });
            }
            
            next();
        });

        // Force HTTPS in production
        if (process.env.NODE_ENV === 'production') {
            app.use((req, res, next) => {
                if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
                    const httpsUrl = `https://${req.get('host')}${req.url}`;
                    return res.redirect(301, httpsUrl);
                }
                next();
            });
        }
    }

    getSSLStatus() {
        return {
            sslEnabled: !!this.sslOptions,
            isProductionReady: this.isProductionReady,
            environment: process.env.NODE_ENV || 'development',
            certificatePaths: process.env.NODE_ENV === 'production' ? 
                this.certificatePaths.prod : 
                this.certificatePaths.dev
        };
    }

    async renewCertificates() {
        if (process.env.NODE_ENV === 'production') {
            logger.info('Certificate renewal should be handled by your certificate authority (Let\'s Encrypt, etc.)');
            return false;
        } else {
            // Regenerate development certificates
            try {
                await this.generateSelfSignedCertificates();
                await this.setupDevelopmentSSL();
                logger.info('Development certificates renewed');
                return true;
            } catch (error) {
                logger.error('Failed to renew development certificates', {
                    error: error.message
                });
                return false;
            }
        }
    }
}

module.exports = new HTTPSConfigManager();