const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const puppeteer = require('puppeteer');
const { jsPDF } = require('jspdf');
const htmlPdf = require('html-pdf-node');
const PDFDocument = require('pdfkit');
const { createCanvas, loadImage } = require('canvas');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const gestureLibraryService = require('./gestureLibraryService');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

class ExportService {
    constructor() {
        this.exportDir = path.join(__dirname, '../exports');
        this.tempDir = path.join(__dirname, '../temp');
        this.assetsDir = path.join(__dirname, '../assets');
        this.ensureDirectories();
        
        // Enhanced video settings
        this.videoSettings = {
            fps: 30,
            duration: 2500, // ms per gesture (increased for better visibility)
            width: 1920,
            height: 1080,
            backgroundColor: '#ffffff',
            gestureSize: { width: 400, height: 400 },
            subtitleStyle: {
                fontSize: 32,
                fontColor: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.7)',
                position: 'bottom'
            }
        };

        // Enhanced PDF settings
        this.pdfSettings = {
            pageSize: 'A4',
            margin: 60,
            fontSize: {
                title: 28,
                subtitle: 20,
                body: 14,
                caption: 11,
                small: 9
            },
            colors: {
                primary: '#2563eb',
                secondary: '#64748b',
                text: '#1e293b',
                accent: '#10b981',
                light: '#f8fafc'
            },
            spacing: {
                line: 1.4,
                paragraph: 16,
                section: 24
            }
        };
    }

    async ensureDirectories() {
        try {
            await fs.mkdir(this.exportDir, { recursive: true });
            await fs.mkdir(this.tempDir, { recursive: true });
            await fs.mkdir(this.assetsDir, { recursive: true });
            
            // Create subdirectories for different export types
            await fs.mkdir(path.join(this.exportDir, 'videos'), { recursive: true });
            await fs.mkdir(path.join(this.exportDir, 'pdfs'), { recursive: true });
            await fs.mkdir(path.join(this.exportDir, 'images'), { recursive: true });
            await fs.mkdir(path.join(this.exportDir, 'packages'), { recursive: true });
            await fs.mkdir(path.join(this.exportDir, 'json'), { recursive: true });
            
            logger.info('Export service directories initialized');
        } catch (error) {
            logger.error('Failed to create export directories', { error: error.message });
        }
    }

    async exportTranslationToVideo(translationData, options = {}) {
        const exportId = uuidv4();
        const startTime = Date.now();
        
        try {
            const {
                format = 'mp4',
                quality = 'medium',
                fps = 30,
                duration = 'auto',
                background = '#ffffff',
                avatarStyle = 'default',
                includeSubtitles = true,
                resolution = '720p'
            } = options;

            logger.info('Starting video export', {
                exportId,
                translationId: translationData.id,
                format,
                quality
            });

            // Generate video frames from sign language animation
            const frames = await this.generateAnimationFrames(translationData, {
                avatarStyle,
                background,
                resolution
            });

            // Create video from frames
            const videoPath = await this.createVideoFromFrames(frames, {
                exportId,
                format,
                quality,
                fps,
                resolution
            });

            // Add subtitles if requested
            if (includeSubtitles && translationData.originalText) {
                const subtitledVideoPath = await this.addSubtitlesToVideo(videoPath, translationData, exportId);
                
                // Clean up original video
                await fs.unlink(videoPath);
                videoPath = subtitledVideoPath;
            }

            const exportInfo = {
                exportId,
                type: 'video',
                format,
                filePath: videoPath,
                fileSize: (await fs.stat(videoPath)).size,
                duration: Date.now() - startTime,
                metadata: {
                    translationId: translationData.id,
                    originalText: translationData.originalText,
                    targetLanguage: translationData.targetLanguage,
                    frameCount: frames.length,
                    resolution,
                    fps,
                    quality
                }
            };

            logger.info('Video export completed', exportInfo);
            return exportInfo;

        } catch (error) {
            logger.error('Video export failed', {
                exportId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async exportTranslationToPDF(translationData, options = {}) {
        const exportId = uuidv4();
        const startTime = Date.now();

        try {
            const {
                includeImages = true,
                includeSteps = true,
                includeTimings = false,
                theme = 'default',
                language = 'en'
            } = options;

            logger.info('Starting PDF export', {
                exportId,
                translationId: translationData.id,
                theme
            });

            // Generate HTML content
            const htmlContent = await this.generateTranslationHTML(translationData, {
                includeImages,
                includeSteps,
                includeTimings,
                theme,
                language
            });

            // Convert HTML to PDF
            const pdfOptions = {
                format: 'A4',
                margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;">Sign Language Translation Export</div>',
                footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
            };

            const pdfBuffer = await htmlPdf.generatePdf({ content: htmlContent }, pdfOptions);
            
            const pdfPath = path.join(this.exportDir, `translation_${exportId}.pdf`);
            await fs.writeFile(pdfPath, pdfBuffer);

            const exportInfo = {
                exportId,
                type: 'pdf',
                format: 'pdf',
                filePath: pdfPath,
                fileSize: pdfBuffer.length,
                duration: Date.now() - startTime,
                metadata: {
                    translationId: translationData.id,
                    originalText: translationData.originalText,
                    targetLanguage: translationData.targetLanguage,
                    pageCount: await this.getPDFPageCount(pdfPath),
                    theme
                }
            };

            logger.info('PDF export completed', exportInfo);
            return exportInfo;

        } catch (error) {
            logger.error('PDF export failed', {
                exportId,
                error: error.message
            });
            throw error;
        }
    }

    async exportTranslationToJSON(translationData, options = {}) {
        const exportId = uuidv4();
        const startTime = Date.now();

        try {
            const {
                includeAnimations = true,
                includeTimings = true,
                includeMetadata = true,
                format = 'pretty'
            } = options;

            const exportData = {
                exportId,
                exportedAt: new Date().toISOString(),
                translation: {
                    id: translationData.id,
                    originalText: translationData.originalText,
                    sourceLanguage: translationData.sourceLanguage,
                    targetLanguage: translationData.targetLanguage,
                    signs: translationData.signs
                }
            };

            if (includeAnimations && translationData.animations) {
                exportData.translation.animations = translationData.animations;
            }

            if (includeTimings && translationData.timings) {
                exportData.translation.timings = translationData.timings;
            }

            if (includeMetadata && translationData.metadata) {
                exportData.metadata = translationData.metadata;
            }

            const jsonString = format === 'pretty' ? 
                JSON.stringify(exportData, null, 2) : 
                JSON.stringify(exportData);

            const jsonPath = path.join(this.exportDir, `translation_${exportId}.json`);
            await fs.writeFile(jsonPath, jsonString, 'utf8');

            const exportInfo = {
                exportId,
                type: 'json',
                format: 'json',
                filePath: jsonPath,
                fileSize: Buffer.byteLength(jsonString, 'utf8'),
                duration: Date.now() - startTime,
                metadata: {
                    translationId: translationData.id,
                    includeAnimations,
                    includeTimings,
                    includeMetadata
                }
            };

            logger.info('JSON export completed', exportInfo);
            return exportInfo;

        } catch (error) {
            logger.error('JSON export failed', {
                exportId,
                error: error.message
            });
            throw error;
        }
    }

    async exportMultipleFormats(translationData, formats, options = {}) {
        const batchExportId = uuidv4();
        const startTime = Date.now();

        try {
            logger.info('Starting batch export', {
                batchExportId,
                formats,
                translationId: translationData.id
            });

            const exports = [];
            const errors = [];

            // Process each format
            for (const format of formats) {
                try {
                    let exportResult;
                    const formatOptions = options[format] || {};

                    switch (format) {
                        case 'video':
                        case 'mp4':
                            exportResult = await this.exportTranslationToVideo(translationData, formatOptions);
                            break;
                        case 'pdf':
                            exportResult = await this.exportTranslationToPDF(translationData, formatOptions);
                            break;
                        case 'json':
                            exportResult = await this.exportTranslationToJSON(translationData, formatOptions);
                            break;
                        default:
                            throw new Error(`Unsupported export format: ${format}`);
                    }

                    exports.push(exportResult);
                } catch (error) {
                    errors.push({
                        format,
                        error: error.message
                    });
                }
            }

            // Create archive if multiple formats were exported successfully
            let archivePath = null;
            if (exports.length > 1) {
                archivePath = await this.createArchive(exports, batchExportId);
            }

            const batchResult = {
                batchExportId,
                exports,
                errors,
                archivePath,
                duration: Date.now() - startTime,
                summary: {
                    requested: formats.length,
                    successful: exports.length,
                    failed: errors.length
                }
            };

            logger.info('Batch export completed', batchResult);
            return batchResult;

        } catch (error) {
            logger.error('Batch export failed', {
                batchExportId,
                error: error.message
            });
            throw error;
        }
    }

    async generateAnimationFrames(translationData, options) {
        const {
            avatarStyle = 'default',
            background = '#ffffff',
            resolution = '720p'
        } = options;

        const frames = [];
        const frameCount = this.calculateFrameCount(translationData);

        // Create browser instance for rendering
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            
            // Set viewport based on resolution
            const dimensions = this.getResolutionDimensions(resolution);
            await page.setViewport(dimensions);

            // Load sign language avatar renderer
            const htmlContent = this.generateAvatarHTML(translationData, {
                avatarStyle,
                background,
                dimensions
            });

            await page.setContent(htmlContent);

            // Generate frames by stepping through animation
            for (let i = 0; i < frameCount; i++) {
                const progress = i / frameCount;
                
                // Update animation progress
                await page.evaluate((progress) => {
                    window.updateAnimationProgress(progress);
                }, progress);

                // Wait for animation to render
                await page.waitForTimeout(50);

                // Capture frame
                const frameBuffer = await page.screenshot({
                    type: 'png',
                    fullPage: false
                });

                const framePath = path.join(this.tempDir, `frame_${i.toString().padStart(6, '0')}.png`);
                await fs.writeFile(framePath, frameBuffer);
                frames.push(framePath);
            }

        } finally {
            await browser.close();
        }

        return frames;
    }

    async createVideoFromFrames(frames, options) {
        const {
            exportId,
            format = 'mp4',
            quality = 'medium',
            fps = 30,
            resolution = '720p'
        } = options;

        const outputPath = path.join(this.exportDir, `translation_${exportId}.${format}`);

        return new Promise((resolve, reject) => {
            const qualitySettings = this.getQualitySettings(quality);
            const dimensions = this.getResolutionDimensions(resolution);

            const command = ffmpeg()
                .input(path.join(this.tempDir, 'frame_%06d.png'))
                .inputFPS(fps)
                .videoCodec('libx264')
                .size(`${dimensions.width}x${dimensions.height}`)
                .fps(fps)
                .addOptions(qualitySettings)
                .format(format)
                .output(outputPath)
                .on('end', () => {
                    // Clean up frame files
                    this.cleanupFrames(frames);
                    resolve(outputPath);
                })
                .on('error', (error) => {
                    this.cleanupFrames(frames);
                    reject(error);
                });

            command.run();
        });
    }

    async addSubtitlesToVideo(videoPath, translationData, exportId) {
        const subtitlesPath = await this.generateSubtitles(translationData, exportId);
        const outputPath = path.join(this.exportDir, `translation_${exportId}_subtitled.mp4`);

        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .videoFilter(`subtitles=${subtitlesPath}:force_style='FontSize=24,PrimaryColour=&Hffffff&,BackColour=&H80000000&'`)
                .output(outputPath)
                .on('end', () => {
                    // Clean up subtitle file
                    fs.unlink(subtitlesPath).catch(() => {});
                    resolve(outputPath);
                })
                .on('error', reject)
                .run();
        });
    }

    async generateSubtitles(translationData, exportId) {
        const subtitlesPath = path.join(this.tempDir, `subtitles_${exportId}.srt`);
        let srtContent = '';

        if (translationData.timings && translationData.originalText) {
            const words = translationData.originalText.split(' ');
            const timings = translationData.timings;

            for (let i = 0; i < words.length; i++) {
                const startTime = this.formatSRTTime(timings[i]?.start || i * 1000);
                const endTime = this.formatSRTTime(timings[i]?.end || (i + 1) * 1000);

                srtContent += `${i + 1}\n`;
                srtContent += `${startTime} --> ${endTime}\n`;
                srtContent += `${words[i]}\n\n`;
            }
        } else {
            // Default subtitle showing full text
            srtContent = `1\n00:00:00,000 --> 00:00:05,000\n${translationData.originalText}\n\n`;
        }

        await fs.writeFile(subtitlesPath, srtContent, 'utf8');
        return subtitlesPath;
    }

    async generateTranslationHTML(translationData, options) {
        const {
            includeImages = true,
            includeSteps = true,
            includeTimings = false,
            theme = 'default',
            language = 'en'
        } = options;

        const themeCSS = this.getThemeCSS(theme);
        
        let htmlContent = `
        <!DOCTYPE html>
        <html lang="${language}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Sign Language Translation Export</title>
            <style>
                ${themeCSS}
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .translation-info { margin-bottom: 20px; }
                .original-text { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                .signs-section { margin: 20px 0; }
                .sign-item { margin: 10px 0; padding: 10px; border-left: 3px solid #007bff; }
                .step-number { font-weight: bold; color: #007bff; }
                .timing { color: #666; font-size: 0.9em; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 0.8em; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Sign Language Translation</h1>
                <p>Exported on ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="translation-info">
                <h2>Translation Details</h2>
                <p><strong>Original Text:</strong> ${translationData.originalText}</p>
                <p><strong>Source Language:</strong> ${translationData.sourceLanguage}</p>
                <p><strong>Target Language:</strong> ${translationData.targetLanguage}</p>
            </div>
            
            <div class="original-text">
                <h3>Original Text</h3>
                <p>${translationData.originalText}</p>
            </div>`;

        if (includeSteps && translationData.signs) {
            htmlContent += `
            <div class="signs-section">
                <h3>Sign Sequence</h3>`;
            
            translationData.signs.forEach((sign, index) => {
                htmlContent += `
                <div class="sign-item">
                    <span class="step-number">Step ${index + 1}:</span>
                    <strong>${sign.word}</strong> → <em>${sign.sign}</em>
                    <br>
                    <small>Confidence: ${(sign.confidence * 100).toFixed(1)}%</small>`;
                
                if (includeTimings && sign.timing) {
                    htmlContent += `
                    <div class="timing">Duration: ${sign.timing.duration}ms</div>`;
                }
                
                htmlContent += `</div>`;
            });
            
            htmlContent += `</div>`;
        }

        htmlContent += `
            <div class="footer">
                <p>Generated by Sign Language Translator</p>
                <p>Export ID: ${uuidv4()}</p>
            </div>
        </body>
        </html>`;

        return htmlContent;
    }

    async createArchive(exports, batchExportId) {
        const archivePath = path.join(this.exportDir, `translation_batch_${batchExportId}.zip`);
        const archive = archiver('zip', { zlib: { level: 9 } });
        const stream = require('fs').createWriteStream(archivePath);

        return new Promise((resolve, reject) => {
            archive.on('error', reject);
            archive.on('end', () => resolve(archivePath));

            archive.pipe(stream);

            // Add each export file to archive
            exports.forEach(exportInfo => {
                const fileName = path.basename(exportInfo.filePath);
                archive.file(exportInfo.filePath, { name: fileName });
            });

            // Add manifest file
            const manifest = {
                batchExportId,
                createdAt: new Date().toISOString(),
                exports: exports.map(e => ({
                    exportId: e.exportId,
                    type: e.type,
                    format: e.format,
                    fileName: path.basename(e.filePath),
                    fileSize: e.fileSize
                }))
            };

            archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
            archive.finalize();
        });
    }

    // Helper methods
    calculateFrameCount(translationData) {
        if (translationData.animations) {
            return translationData.animations.reduce((total, anim) => 
                total + Math.ceil(anim.duration / 33.33), 0); // 30fps
        }
        return Math.max(90, translationData.signs?.length * 30 || 90); // Default 3 seconds
    }

    getResolutionDimensions(resolution) {
        const resolutions = {
            '480p': { width: 854, height: 480 },
            '720p': { width: 1280, height: 720 },
            '1080p': { width: 1920, height: 1080 }
        };
        return resolutions[resolution] || resolutions['720p'];
    }

    getQualitySettings(quality) {
        const settings = {
            low: ['-crf', '28', '-preset', 'fast'],
            medium: ['-crf', '23', '-preset', 'medium'],
            high: ['-crf', '18', '-preset', 'slow']
        };
        return settings[quality] || settings.medium;
    }

    getThemeCSS(theme) {
        const themes = {
            default: `
                body { background: #fff; color: #333; }
                .header { border-bottom: 2px solid #007bff; }
            `,
            dark: `
                body { background: #2d2d2d; color: #fff; }
                .header { border-bottom: 2px solid #17a2b8; }
                .original-text { background: #404040; }
            `,
            minimal: `
                body { background: #fff; color: #333; font-family: 'Times New Roman', serif; }
                .header { border-bottom: 1px solid #ddd; }
            `
        };
        return themes[theme] || themes.default;
    }

    generateAvatarHTML(translationData, options) {
        // Simplified avatar HTML - in production, this would be more complex
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { 
                    margin: 0; 
                    padding: 0; 
                    background: ${options.background}; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    height: ${options.dimensions.height}px; 
                    width: ${options.dimensions.width}px;
                }
                .avatar { 
                    font-size: 48px; 
                    text-align: center; 
                }
            </style>
        </head>
        <body>
            <div class="avatar" id="avatar">🤟</div>
            <script>
                window.updateAnimationProgress = function(progress) {
                    const avatar = document.getElementById('avatar');
                    // Simplified animation - rotate based on progress
                    avatar.style.transform = 'rotate(' + (progress * 360) + 'deg)';
                };
            </script>
        </body>
        </html>`;
    }

    formatSRTTime(milliseconds) {
        const date = new Date(milliseconds);
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        const seconds = date.getUTCSeconds().toString().padStart(2, '0');
        const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
        return `${hours}:${minutes}:${seconds},${ms}`;
    }

    async cleanupFrames(framePaths) {
        for (const framePath of framePaths) {
            try {
                await fs.unlink(framePath);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    }

    async getPDFPageCount(pdfPath) {
        // Simplified implementation - in production, use a proper PDF library
        return 1;
    }

    async cleanupOldExports() {
        try {
            const files = await fs.readdir(this.exportDir);
            const now = Date.now();
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

            for (const file of files) {
                const filePath = path.join(this.exportDir, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    await fs.unlink(filePath);
                    logger.info('Cleaned up old export file', { file });
                }
            }
        } catch (error) {
            logger.error('Failed to cleanup old exports', { error: error.message });
        }
    }

    // Enhanced export methods for new functionality

    /**
     * Export translation as enhanced video with gesture visualization
     */
    async exportEnhancedVideo(translationData, options = {}) {
        try {
            const {
                userId,
                format = 'mp4',
                quality = 'high',
                includeSubtitles = true,
                includeInstructions = false,
                showTimestamps = false,
                backgroundColor = '#ffffff',
                avatarStyle = 'realistic',
                gestureSpeed = 'normal'
            } = options;

            const exportId = uuidv4();
            const filename = `enhanced_translation_${exportId}.${format}`;
            const outputPath = path.join(this.exportDir, 'videos', filename);
            const tempFramesDir = path.join(this.tempDir, `frames_${exportId}`);

            logger.info('Starting enhanced video export', {
                exportId,
                userId,
                sequenceLength: translationData.sequence?.length || 0,
                format,
                quality
            });

            // Create temporary frames directory
            await fs.mkdir(tempFramesDir, { recursive: true });

            // Generate enhanced frames with gesture visualization
            const frames = await this.generateEnhancedVideoFrames(translationData, tempFramesDir, {
                backgroundColor,
                includeSubtitles,
                includeInstructions,
                showTimestamps,
                avatarStyle,
                gestureSpeed
            });

            // Create video from frames with enhanced settings
            await this.createEnhancedVideoFromFrames(frames, outputPath, {
                format,
                quality,
                fps: this.videoSettings.fps,
                includeSubtitles
            });

            // Generate additional assets
            let subtitlePath = null;
            let instructionPath = null;

            if (includeSubtitles) {
                subtitlePath = await this.generateEnhancedSubtitles(translationData, exportId);
            }

            if (includeInstructions) {
                instructionPath = await this.generateVideoInstructions(translationData, exportId);
            }

            // Clean up temporary frames
            await this.cleanupDirectory(tempFramesDir);

            const stats = await fs.stat(outputPath);
            const duration = translationData.sequence ? 
                translationData.sequence.length * this.videoSettings.duration : 5000;

            logger.info('Enhanced video export completed', {
                exportId,
                userId,
                fileSize: stats.size,
                outputPath
            });

            return {
                exportId,
                type: 'enhanced_video',
                filename,
                filePath: outputPath,
                subtitlePath,
                instructionPath,
                fileSize: stats.size,
                duration,
                metadata: {
                    originalText: translationData.originalText,
                    targetLibrary: translationData.targetLibrary,
                    gestureCount: translationData.sequence?.length || 0,
                    format,
                    quality,
                    avatarStyle,
                    createdAt: new Date().toISOString()
                }
            };

        } catch (error) {
            logger.error('Enhanced video export failed', {
                error: error.message,
                stack: error.stack,
                userId: options.userId
            });
            throw error;
        }
    }

    /**
     * Export translation as comprehensive PDF guide
     */
    async exportComprehensivePDF(translationData, options = {}) {
        try {
            const {
                userId,
                includeImages = true,
                includeStepByStep = true,
                includeMetadata = true,
                includeGlossary = true,
                includePracticeSection = true,
                customBranding = null,
                language = 'en',
                theme = 'professional'
            } = options;

            const exportId = uuidv4();
            const filename = `comprehensive_guide_${exportId}.pdf`;
            const outputPath = path.join(this.exportDir, 'pdfs', filename);

            logger.info('Starting comprehensive PDF export', {
                exportId,
                userId,
                sequenceLength: translationData.sequence?.length || 0,
                includeImages,
                theme
            });

            // Create PDF document with enhanced settings
            const doc = new PDFDocument({
                size: this.pdfSettings.pageSize,
                margin: this.pdfSettings.margin,
                bufferPages: true,
                info: {
                    Title: `Comprehensive Sign Language Guide - ${translationData.originalText}`,
                    Author: 'Sign Language Translator',
                    Subject: `${translationData.targetLibrary} Sign Language Translation Guide`,
                    Creator: 'Sign Language Translator API v2.0',
                    Producer: 'Enhanced Export Service',
                    CreationDate: new Date(),
                    Keywords: `sign language, ${translationData.targetLibrary}, translation, guide, tutorial`
                }
            });

            // Create write stream
            const stream = doc.pipe(require('fs').createWriteStream(outputPath));

            // Add comprehensive content sections
            await this.addPDFCoverPage(doc, translationData, customBranding);
            await this.addPDFTableOfContents(doc, translationData);
            await this.addPDFExecutiveSummary(doc, translationData, includeMetadata);
            await this.addPDFDetailedInstructions(doc, translationData, { includeImages, includeStepByStep });
            
            if (includeGlossary) {
                await this.addPDFGlossary(doc, translationData);
            }
            
            if (includePracticeSection) {
                await this.addPDFPracticeSection(doc, translationData);
            }

            await this.addPDFResourcesAndReferences(doc, translationData);
            await this.addPDFFooter(doc, exportId);

            // Finalize PDF
            doc.end();

            // Wait for PDF to be written
            await new Promise((resolve, reject) => {
                stream.on('finish', resolve);
                stream.on('error', reject);
            });

            const stats = await fs.stat(outputPath);

            logger.info('Comprehensive PDF export completed', {
                exportId,
                userId,
                fileSize: stats.size,
                pageCount: doc.bufferedPageRange().count
            });

            return {
                exportId,
                type: 'comprehensive_pdf',
                filename,
                filePath: outputPath,
                fileSize: stats.size,
                pageCount: doc.bufferedPageRange().count,
                metadata: {
                    originalText: translationData.originalText,
                    targetLibrary: translationData.targetLibrary,
                    gestureCount: translationData.sequence?.length || 0,
                    includeImages,
                    includeStepByStep,
                    includeGlossary,
                    includePracticeSection,
                    theme,
                    createdAt: new Date().toISOString()
                }
            };

        } catch (error) {
            logger.error('Comprehensive PDF export failed', {
                error: error.message,
                stack: error.stack,
                userId: options.userId
            });
            throw error;
        }
    }

    /**
     * Export complete learning package with multiple formats
     */
    async exportLearningPackage(translationData, options = {}) {
        try {
            const {
                userId,
                includeVideo = true,
                includePDF = true,
                includeImages = true,
                includeAudio = false,
                includeJSON = true,
                includeQuiz = false,
                packageFormat = 'zip',
                quality = 'high'
            } = options;

            const exportId = uuidv4();
            const packageName = `learning_package_${exportId}`;
            const packageDir = path.join(this.tempDir, packageName);
            const outputPath = path.join(this.exportDir, 'packages', `${packageName}.${packageFormat}`);

            logger.info('Starting learning package export', {
                exportId,
                userId,
                includeVideo,
                includePDF,
                includeImages,
                includeAudio
            });

            // Create package directory
            await fs.mkdir(packageDir, { recursive: true });

            const packageContents = [];

            // Export enhanced video if requested
            if (includeVideo) {
                const videoExport = await this.exportEnhancedVideo(translationData, { 
                    userId, 
                    quality,
                    includeSubtitles: true,
                    includeInstructions: true 
                });
                const videoDestPath = path.join(packageDir, videoExport.filename);
                await fs.copyFile(videoExport.filePath, videoDestPath);
                packageContents.push({
                    type: 'video',
                    filename: videoExport.filename,
                    size: videoExport.fileSize,
                    description: 'Enhanced video with gesture visualization'
                });

                // Include subtitle and instruction files
                if (videoExport.subtitlePath) {
                    const subtitleDestPath = path.join(packageDir, `${path.parse(videoExport.filename).name}.srt`);
                    await fs.copyFile(videoExport.subtitlePath, subtitleDestPath);
                }

                if (videoExport.instructionPath) {
                    const instructionDestPath = path.join(packageDir, `${path.parse(videoExport.filename).name}_instructions.txt`);
                    await fs.copyFile(videoExport.instructionPath, instructionDestPath);
                }
            }

            // Export comprehensive PDF if requested
            if (includePDF) {
                const pdfExport = await this.exportComprehensivePDF(translationData, { 
                    userId,
                    includeImages,
                    includeGlossary: true,
                    includePracticeSection: true
                });
                const pdfDestPath = path.join(packageDir, pdfExport.filename);
                await fs.copyFile(pdfExport.filePath, pdfDestPath);
                packageContents.push({
                    type: 'pdf',
                    filename: pdfExport.filename,
                    size: pdfExport.fileSize,
                    pageCount: pdfExport.pageCount,
                    description: 'Comprehensive learning guide with detailed instructions'
                });
            }

            // Generate individual gesture images if requested
            if (includeImages && translationData.sequence) {
                const imagesDir = path.join(packageDir, 'gesture_images');
                await fs.mkdir(imagesDir, { recursive: true });
                
                for (const [index, item] of translationData.sequence.entries()) {
                    const imagePath = await this.generateDetailedGestureImage(item, {
                        outputDir: imagesDir,
                        filename: `${String(index + 1).padStart(3, '0')}_${item.word}.png`,
                        includeDescription: true,
                        highQuality: true
                    });
                    
                    if (imagePath) {
                        packageContents.push({
                            type: 'image',
                            filename: path.basename(imagePath),
                            word: item.word,
                            description: `Detailed gesture visualization for "${item.word}"`
                        });
                    }
                }
            }

            // Generate quiz/practice materials if requested
            if (includeQuiz && translationData.sequence) {
                const quizPath = await this.generatePracticeQuiz(translationData, packageDir, exportId);
                if (quizPath) {
                    packageContents.push({
                        type: 'quiz',
                        filename: path.basename(quizPath),
                        description: 'Interactive practice quiz for gesture recognition'
                    });
                }
            }

            // Export enhanced JSON data if requested
            if (includeJSON) {
                const jsonPath = path.join(packageDir, 'translation_data.json');
                await fs.writeFile(jsonPath, JSON.stringify({
                    ...translationData,
                    exportMetadata: {
                        exportId,
                        exportedAt: new Date().toISOString(),
                        exportOptions: options,
                        packageContents: packageContents.map(item => ({
                            type: item.type,
                            filename: item.filename,
                            description: item.description
                        }))
                    }
                }, null, 2));
                
                packageContents.push({
                    type: 'json',
                    filename: 'translation_data.json',
                    description: 'Complete translation data with metadata'
                });
            }

            // Create comprehensive README
            await this.createLearningPackageReadme(packageDir, translationData, packageContents);

            // Create package archive
            await this.createEnhancedArchive(packageDir, outputPath, packageFormat);

            // Clean up temporary directory
            await this.cleanupDirectory(packageDir);

            const stats = await fs.stat(outputPath);

            logger.info('Learning package export completed', {
                exportId,
                userId,
                packageSize: stats.size,
                contentCount: packageContents.length
            });

            return {
                exportId,
                type: 'learning_package',
                filename: path.basename(outputPath),
                filePath: outputPath,
                fileSize: stats.size,
                contents: packageContents,
                metadata: {
                    originalText: translationData.originalText,
                    targetLibrary: translationData.targetLibrary,
                    packageFormat,
                    quality,
                    createdAt: new Date().toISOString()
                }
            };

        } catch (error) {
            logger.error('Learning package export failed', {
                error: error.message,
                stack: error.stack,
                userId: options.userId
            });
            throw error;
        }
    }

    /**
     * Generate enhanced video frames with detailed gesture visualization
     */
    async generateEnhancedVideoFrames(translationData, outputDir, options = {}) {
        const frames = [];
        
        if (!translationData.sequence || translationData.sequence.length === 0) {
            // Generate placeholder frames for empty sequence
            const frameCount = Math.floor(3000 * this.videoSettings.fps / 1000); // 3 seconds
            for (let frame = 0; frame < frameCount; frame++) {
                const framePath = path.join(outputDir, `frame_${String(frame).padStart(6, '0')}.png`);
                await this.generatePlaceholderFrame(framePath, 'No gestures to display');
                frames.push(framePath);
            }
            return frames;
        }
        
        for (const [index, item] of translationData.sequence.entries()) {
            const frameCount = Math.floor(this.videoSettings.duration * this.videoSettings.fps / 1000);
            
            for (let frame = 0; frame < frameCount; frame++) {
                const framePath = path.join(outputDir, `frame_${String(index).padStart(3, '0')}_${String(frame).padStart(3, '0')}.png`);
                
                await this.generateEnhancedGestureFrame(item, framePath, {
                    frameNumber: frame,
                    totalFrames: frameCount,
                    sequenceIndex: index,
                    totalSequences: translationData.sequence.length,
                    ...options
                });
                
                frames.push(framePath);
            }
        }
        
        return frames;
    }

    /**
     * Generate enhanced gesture frame with detailed visualization
     */
    async generateEnhancedGestureFrame(gestureItem, outputPath, options = {}) {
        const {
            frameNumber = 0,
            totalFrames = 30,
            sequenceIndex = 0,
            totalSequences = 1,
            backgroundColor = '#ffffff',
            includeSubtitles = true,
            includeInstructions = false,
            showTimestamps = false,
            avatarStyle = 'realistic'
        } = options;

        const canvas = createCanvas(this.videoSettings.width, this.videoSettings.height);
        const ctx = canvas.getContext('2d');

        // Fill background with gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, backgroundColor);
        gradient.addColorStop(1, this.lightenColor(backgroundColor, -10));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw enhanced gesture visualization
        await this.drawEnhancedGestureVisualization(ctx, gestureItem, {
            x: canvas.width / 2,
            y: canvas.height / 2 - 50,
            size: this.videoSettings.gestureSize,
            animationProgress: frameNumber / totalFrames,
            style: avatarStyle
        });

        // Add progress indicator
        this.drawProgressIndicator(ctx, {
            current: sequenceIndex + frameNumber / totalFrames,
            total: totalSequences,
            x: 100,
            y: 50,
            width: canvas.width - 200,
            height: 8
        });

        // Add enhanced subtitles
        if (includeSubtitles) {
            this.drawEnhancedSubtitle(ctx, gestureItem.word, {
                x: canvas.width / 2,
                y: canvas.height - 120,
                style: this.videoSettings.subtitleStyle
            });
        }

        // Add instruction panel
        if (includeInstructions && gestureItem.gesture) {
            this.drawInstructionPanel(ctx, gestureItem.gesture, {
                x: 50,
                y: canvas.height / 2 + 200,
                width: canvas.width - 100,
                height: 150
            });
        }

        // Add timestamp if requested
        if (showTimestamps) {
            const currentTime = (sequenceIndex * this.videoSettings.duration + 
                frameNumber * (this.videoSettings.duration / totalFrames)) / 1000;
            this.drawTimestamp(ctx, currentTime, {
                x: canvas.width - 150,
                y: 50
            });
        }

        // Save frame
        const buffer = canvas.toBuffer('image/png');
        await fs.writeFile(outputPath, buffer);
    }

    /**
     * Generate placeholder frame for empty content
     */
    async generatePlaceholderFrame(outputPath, message = 'No content available') {
        const canvas = createCanvas(this.videoSettings.width, this.videoSettings.height);
        const ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw message
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(message, canvas.width / 2, canvas.height / 2);

        // Save frame
        const buffer = canvas.toBuffer('image/png');
        await fs.writeFile(outputPath, buffer);
    }

    /**
     * Clean up directory recursively
     */
    async cleanupDirectory(dirPath) {
        try {
            const files = await fs.readdir(dirPath);
            
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stat = await fs.stat(filePath);
                
                if (stat.isDirectory()) {
                    await this.cleanupDirectory(filePath);
                } else {
                    await fs.unlink(filePath);
                }
            }
            
            await fs.rmdir(dirPath);
        } catch (error) {
            logger.warn('Cleanup failed', { dirPath, error: error.message });
        }
    }

    /**
     * Utility function to lighten/darken colors
     */
    lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const B = (num >> 8 & 0x00FF) + amt;
        const G = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + 
            (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 + 
            (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1);
    }
}

module.exports = new ExportService();