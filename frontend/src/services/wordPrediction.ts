// Word prediction and auto-completion service
export class WordPredictor {
    private commonWords = [
        'HELLO', 'HI', 'BYE', 'GOODBYE', 'YES', 'NO', 'PLEASE', 'THANK', 'THANKS', 'SORRY',
        'HELP', 'LOVE', 'GOOD', 'BAD', 'DAY', 'NIGHT', 'WATER', 'FOOD', 'HOME', 'WORK',
        'FAMILY', 'FRIEND', 'TIME', 'MONEY', 'HAPPY', 'SAD', 'HOW', 'WHAT', 'WHERE', 'WHEN',
        'WHY', 'WHO', 'CAN', 'WILL', 'WOULD', 'COULD', 'SHOULD', 'HAVE', 'HAS', 'HAD',
        'WANT', 'NEED', 'LIKE', 'LOVE', 'HATE', 'KNOW', 'THINK', 'FEEL', 'SEE', 'HEAR',
        'SPEAK', 'TALK', 'LISTEN', 'UNDERSTAND', 'LEARN', 'TEACH', 'READ', 'WRITE',
        'EAT', 'DRINK', 'SLEEP', 'WAKE', 'COME', 'GO', 'STAY', 'LEAVE', 'ARRIVE',
        'MORNING', 'AFTERNOON', 'EVENING', 'TODAY', 'TOMORROW', 'YESTERDAY', 'WEEK',
        'MONTH', 'YEAR', 'BIRTHDAY', 'HOLIDAY', 'SCHOOL', 'HOSPITAL', 'STORE', 'RESTAURANT'
    ];

    private readonly maxSuggestions = 5;

    // Get word predictions based on current input
    getPredictions(currentWord: string): string[] {
        if (!currentWord || currentWord.length < 1) {
            return this.commonWords.slice(0, this.maxSuggestions);
        }

        const upperWord = currentWord.toUpperCase();

        // Find words that start with the current input
        const startsWith = this.commonWords.filter(word =>
            word.startsWith(upperWord) && word !== upperWord
        );

        // Find words that contain the current input
        const contains = this.commonWords.filter(word =>
            word.includes(upperWord) && !word.startsWith(upperWord)
        );

        // Combine and limit results
        return [...startsWith, ...contains].slice(0, this.maxSuggestions);
    }

    // Check if a word is likely complete
    isLikelyComplete(currentWord: string): boolean {
        if (!currentWord || currentWord.length < 2) return false;

        const upperWord = currentWord.toUpperCase();
        return this.commonWords.includes(upperWord);
    }

    // Get completion confidence
    getCompletionConfidence(currentWord: string): number {
        if (!currentWord) return 0;

        const upperWord = currentWord.toUpperCase();
        const predictions = this.getPredictions(currentWord);

        // High confidence if it's a known word
        if (this.commonWords.includes(upperWord)) {
            return 1.0;
        }

        // Medium confidence if it has good predictions
        if (predictions.length > 0 && predictions[0].startsWith(upperWord)) {
            return 0.7;
        }

        // Low confidence for unknown patterns
        return 0.3;
    }

    // Suggest next likely letters
    getNextLetterSuggestions(currentWord: string): string[] {
        if (!currentWord) return ['A', 'H', 'I', 'T', 'W']; // Common starting letters

        const upperWord = currentWord.toUpperCase();
        const predictions = this.getPredictions(currentWord);

        if (predictions.length === 0) return [];

        // Get the next letters from top predictions
        const nextLetters = new Set<string>();
        predictions.forEach(word => {
            if (word.length > upperWord.length) {
                nextLetters.add(word[upperWord.length]);
            }
        });

        return Array.from(nextLetters).slice(0, 5);
    }
}
