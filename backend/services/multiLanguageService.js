const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class MultiLanguageSignService {
    constructor() {
        this.supportedLanguages = {
            asl: {
                name: 'American Sign Language',
                code: 'asl',
                region: 'US',
                gestureSet: 'standard',
                handshapes: 45,
                movements: 32,
                facialExpressions: true,
                twoHanded: true
            },
            bsl: {
                name: 'British Sign Language',
                code: 'bsl',
                region: 'UK',
                gestureSet: 'british',
                handshapes: 40,
                movements: 28,
                facialExpressions: true,
                twoHanded: true,
                fingerSpelling: 'two-handed'
            },
            lsf: {
                name: 'French Sign Language (Langue des Signes Française)',
                code: 'lsf',
                region: 'FR',
                gestureSet: 'french',
                handshapes: 38,
                movements: 30,
                facialExpressions: true,
                twoHanded: true,
                spatialGrammar: true
            },
            dgs: {
                name: 'German Sign Language (Deutsche Gebärdensprache)',
                code: 'dgs',
                region: 'DE',
                gestureSet: 'german',
                handshapes: 42,
                movements: 29,
                facialExpressions: true,
                twoHanded: true
            },
            jsl: {
                name: 'Japanese Sign Language',
                code: 'jsl',
                region: 'JP',
                gestureSet: 'japanese',
                handshapes: 46,
                movements: 35,
                facialExpressions: true,
                twoHanded: false,
                fingerSpelling: 'syllabic'
            }
        };
        
        this.gestureLibraries = new Map();
        this.translationModels = new Map();
        this.loadLanguageData();
    }

    async loadLanguageData() {
        try {
            for (const [langCode, langInfo] of Object.entries(this.supportedLanguages)) {
                await this.loadGestureLibrary(langCode);
                await this.loadTranslationModel(langCode);
            }
            logger.info('Multi-language support initialized', {
                supportedLanguages: Object.keys(this.supportedLanguages)
            });
        } catch (error) {
            logger.error('Failed to load language data', { error: error.message });
        }
    }

    async loadGestureLibrary(languageCode) {
        try {
            const gestureLibraryPath = path.join(__dirname, `../data/gestures/${languageCode}.json`);
            
            // Create default gesture library if it doesn't exist
            const defaultGestures = this.createDefaultGestureLibrary(languageCode);
            
            try {
                const gestureData = await fs.readFile(gestureLibraryPath, 'utf8');
                this.gestureLibraries.set(languageCode, JSON.parse(gestureData));
            } catch (fileError) {
                // Create directory and file if they don't exist
                const dir = path.dirname(gestureLibraryPath);
                await fs.mkdir(dir, { recursive: true });
                await fs.writeFile(gestureLibraryPath, JSON.stringify(defaultGestures, null, 2));
                this.gestureLibraries.set(languageCode, defaultGestures);
                logger.info(`Created default gesture library for ${languageCode}`);
            }
        } catch (error) {
            logger.error(`Failed to load gesture library for ${languageCode}`, { error: error.message });
            // Use default gestures as fallback
            this.gestureLibraries.set(languageCode, this.createDefaultGestureLibrary(languageCode));
        }
    }

    createDefaultGestureLibrary(languageCode) {
        const baseGestures = {
            hello: { handshapes: ['open_hand'], movement: 'wave', location: 'neutral_space' },
            thank_you: { handshapes: ['flat_hand'], movement: 'forward', location: 'chin' },
            please: { handshapes: ['flat_hand'], movement: 'circular', location: 'chest' },
            sorry: { handshapes: ['fist'], movement: 'circular', location: 'chest' },
            yes: { handshapes: ['fist'], movement: 'nod', location: 'neutral_space' },
            no: { handshapes: ['index'], movement: 'shake', location: 'neutral_space' },
            good: { handshapes: ['thumbs_up'], movement: 'up', location: 'neutral_space' },
            bad: { handshapes: ['thumbs_down'], movement: 'down', location: 'neutral_space' },
            help: { handshapes: ['flat_hand', 'fist'], movement: 'support', location: 'neutral_space' },
            water: { handshapes: ['w_hand'], movement: 'to_mouth', location: 'mouth' }
        };

        // Customize based on language-specific features
        const langInfo = this.supportedLanguages[languageCode];
        const gestures = { ...baseGestures };

        if (langInfo.fingerSpelling === 'two-handed' && languageCode === 'bsl') {
            // BSL uses two-handed fingerspelling
            gestures.fingerspelling_type = 'two_handed';
        } else if (langInfo.fingerSpelling === 'syllabic' && languageCode === 'jsl') {
            // JSL uses syllabic fingerspelling
            gestures.fingerspelling_type = 'syllabic';
        }

        if (langInfo.spatialGrammar && languageCode === 'lsf') {
            // LSF has strong spatial grammar
            gestures.spatial_grammar = true;
        }

        return {
            language: languageCode,
            version: '1.0.0',
            gestures,
            metadata: langInfo
        };
    }

    async loadTranslationModel(languageCode) {
        try {
            // In a real implementation, you would load ML models here
            // For now, we'll create a simple translation mapping
            const translationModel = {
                language: languageCode,
                textToSign: this.createTextToSignMapping(languageCode),
                signToText: this.createSignToTextMapping(languageCode),
                commonPhrases: this.createCommonPhrases(languageCode)
            };
            
            this.translationModels.set(languageCode, translationModel);
            logger.info(`Translation model loaded for ${languageCode}`);
        } catch (error) {
            logger.error(`Failed to load translation model for ${languageCode}`, { error: error.message });
        }
    }

    createTextToSignMapping(languageCode) {
        const baseMapping = {
            'hello': 'hello',
            'hi': 'hello',
            'thank you': 'thank_you',
            'thanks': 'thank_you',
            'please': 'please',
            'sorry': 'sorry',
            'yes': 'yes',
            'no': 'no',
            'good': 'good',
            'bad': 'bad',
            'help': 'help',
            'water': 'water'
        };

        // Language-specific customizations
        if (languageCode === 'bsl') {
            baseMapping['brilliant'] = 'good';
            baseMapping['rubbish'] = 'bad';
        } else if (languageCode === 'lsf') {
            baseMapping['merci'] = 'thank_you';
            baseMapping['bonjour'] = 'hello';
            baseMapping['oui'] = 'yes';
            baseMapping['non'] = 'no';
        } else if (languageCode === 'dgs') {
            baseMapping['danke'] = 'thank_you';
            baseMapping['hallo'] = 'hello';
            baseMapping['ja'] = 'yes';
            baseMapping['nein'] = 'no';
        } else if (languageCode === 'jsl') {
            baseMapping['arigatou'] = 'thank_you';
            baseMapping['konnichiwa'] = 'hello';
            baseMapping['hai'] = 'yes';
            baseMapping['iie'] = 'no';
        }

        return baseMapping;
    }

    createSignToTextMapping(languageCode) {
        const textToSign = this.createTextToSignMapping(languageCode);
        const signToText = {};
        
        // Reverse the mapping
        for (const [text, sign] of Object.entries(textToSign)) {
            if (!signToText[sign]) {
                signToText[sign] = [];
            }
            signToText[sign].push(text);
        }
        
        return signToText;
    }

    createCommonPhrases(languageCode) {
        const basePhrases = [
            { text: 'How are you?', signs: ['how', 'you'] },
            { text: 'Nice to meet you', signs: ['nice', 'meet', 'you'] },
            { text: 'What is your name?', signs: ['what', 'your', 'name'] },
            { text: 'Where are you from?', signs: ['where', 'you', 'from'] },
            { text: 'I am learning sign language', signs: ['i', 'learn', 'sign', 'language'] }
        ];

        // Language-specific phrases
        if (languageCode === 'bsl') {
            basePhrases.push(
                { text: 'How do you do?', signs: ['how', 'you', 'do'] },
                { text: 'Lovely to see you', signs: ['lovely', 'see', 'you'] }
            );
        } else if (languageCode === 'lsf') {
            basePhrases.push(
                { text: 'Comment allez-vous?', signs: ['comment', 'allez', 'vous'] },
                { text: 'Enchanté', signs: ['enchante'] }
            );
        }

        return basePhrases;
    }

    getSupportedLanguages() {
        return Object.keys(this.supportedLanguages);
    }

    getLanguageInfo(languageCode) {
        return this.supportedLanguages[languageCode];
    }

    isLanguageSupported(languageCode) {
        return this.supportedLanguages.hasOwnProperty(languageCode);
    }

    async translateTextToSign(text, sourceLanguage = 'en', targetLanguage = 'asl') {
        try {
            if (!this.isLanguageSupported(targetLanguage)) {
                throw new Error(`Language ${targetLanguage} is not supported`);
            }

            const translationModel = this.translationModels.get(targetLanguage);
            const gestureLibrary = this.gestureLibraries.get(targetLanguage);

            if (!translationModel || !gestureLibrary) {
                throw new Error(`Translation model or gesture library not loaded for ${targetLanguage}`);
            }

            const words = text.toLowerCase().split(' ');
            const signs = [];
            const animations = [];

            for (const word of words) {
                const signKey = translationModel.textToSign[word] || word;
                const gesture = gestureLibrary.gestures[signKey];

                if (gesture) {
                    signs.push({
                        word,
                        sign: signKey,
                        gesture,
                        confidence: 0.9
                    });
                    
                    animations.push({
                        type: 'gesture',
                        name: signKey,
                        duration: this.calculateGestureDuration(gesture),
                        handshapes: gesture.handshapes,
                        movement: gesture.movement,
                        location: gesture.location
                    });
                } else {
                    // Use fingerspelling for unknown words
                    signs.push({
                        word,
                        sign: 'fingerspelling',
                        gesture: { type: 'fingerspelling', letters: word.split('') },
                        confidence: 0.7
                    });

                    animations.push({
                        type: 'fingerspelling',
                        letters: word.split(''),
                        duration: word.length * 500,
                        style: gestureLibrary.metadata.fingerSpelling || 'one_handed'
                    });
                }
            }

            return {
                success: true,
                sourceText: text,
                sourceLanguage,
                targetLanguage,
                languageInfo: this.supportedLanguages[targetLanguage],
                translation: {
                    signs,
                    animations,
                    totalDuration: animations.reduce((sum, anim) => sum + anim.duration, 0)
                }
            };

        } catch (error) {
            logger.error('Translation failed', {
                text,
                sourceLanguage,
                targetLanguage,
                error: error.message
            });
            
            throw error;
        }
    }

    async translateSignToText(gestures, sourceLanguage = 'asl', targetLanguage = 'en') {
        try {
            if (!this.isLanguageSupported(sourceLanguage)) {
                throw new Error(`Language ${sourceLanguage} is not supported`);
            }

            const translationModel = this.translationModels.get(sourceLanguage);
            const gestureLibrary = this.gestureLibraries.get(sourceLanguage);

            if (!translationModel || !gestureLibrary) {
                throw new Error(`Translation model or gesture library not loaded for ${sourceLanguage}`);
            }

            const recognizedSigns = [];
            const words = [];

            for (const gesture of gestures) {
                const bestMatch = this.matchGesture(gesture, gestureLibrary);
                if (bestMatch) {
                    recognizedSigns.push(bestMatch);
                    const possibleTexts = translationModel.signToText[bestMatch.sign];
                    if (possibleTexts && possibleTexts.length > 0) {
                        words.push(possibleTexts[0]); // Use first/most common translation
                    }
                }
            }

            const translatedText = words.join(' ');

            return {
                success: true,
                sourceLanguage,
                targetLanguage,
                languageInfo: this.supportedLanguages[sourceLanguage],
                gestures: recognizedSigns,
                translatedText,
                confidence: recognizedSigns.reduce((sum, sign) => sum + sign.confidence, 0) / recognizedSigns.length
            };

        } catch (error) {
            logger.error('Sign to text translation failed', {
                sourceLanguage,
                targetLanguage,
                error: error.message
            });
            
            throw error;
        }
    }

    matchGesture(inputGesture, gestureLibrary) {
        // Simple gesture matching - in a real implementation, this would use ML
        let bestMatch = null;
        let bestScore = 0;

        for (const [signKey, libraryGesture] of Object.entries(gestureLibrary.gestures)) {
            const score = this.calculateGestureScore(inputGesture, libraryGesture);
            if (score > bestScore && score > 0.6) { // Minimum confidence threshold
                bestScore = score;
                bestMatch = {
                    sign: signKey,
                    gesture: libraryGesture,
                    confidence: score
                };
            }
        }

        return bestMatch;
    }

    calculateGestureScore(gesture1, gesture2) {
        // Simplified scoring based on handshape and movement similarity
        let score = 0;
        let factors = 0;

        if (gesture1.handshapes && gesture2.handshapes) {
            const commonHandshapes = gesture1.handshapes.filter(h => 
                gesture2.handshapes.includes(h)
            ).length;
            score += (commonHandshapes / Math.max(gesture1.handshapes.length, gesture2.handshapes.length)) * 0.4;
            factors += 0.4;
        }

        if (gesture1.movement === gesture2.movement) {
            score += 0.3;
            factors += 0.3;
        }

        if (gesture1.location === gesture2.location) {
            score += 0.3;
            factors += 0.3;
        }

        return factors > 0 ? score / factors : 0;
    }

    calculateGestureDuration(gesture) {
        // Base duration in milliseconds
        let duration = 1000;

        // Adjust based on complexity
        if (gesture.handshapes && gesture.handshapes.length > 1) {
            duration += 300 * gesture.handshapes.length;
        }

        if (gesture.movement === 'circular') {
            duration += 500;
        } else if (gesture.movement === 'complex') {
            duration += 800;
        }

        return duration;
    }

    async getLanguageStatistics() {
        const stats = {};
        
        for (const [langCode, langInfo] of Object.entries(this.supportedLanguages)) {
            const gestureLibrary = this.gestureLibraries.get(langCode);
            const translationModel = this.translationModels.get(langCode);
            
            stats[langCode] = {
                name: langInfo.name,
                region: langInfo.region,
                gestureCount: gestureLibrary ? Object.keys(gestureLibrary.gestures).length : 0,
                vocabularySize: translationModel ? Object.keys(translationModel.textToSign).length : 0,
                commonPhrases: translationModel ? translationModel.commonPhrases.length : 0,
                features: {
                    facialExpressions: langInfo.facialExpressions,
                    twoHanded: langInfo.twoHanded,
                    fingerSpelling: langInfo.fingerSpelling || 'one-handed',
                    spatialGrammar: langInfo.spatialGrammar || false
                }
            };
        }
        
        return stats;
    }
}

module.exports = new MultiLanguageSignService();