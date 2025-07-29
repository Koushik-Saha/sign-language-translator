module.exports = {
    // ... existing config
    theme: {
        extend: {
            colors: {
                // High contrast accessible colors
                'accessible-blue': '#0066CC',
                'accessible-orange': '#FF6600',
                'accessible-green': '#00AA00',
                'accessible-red': '#CC0000',
            },
            spacing: {
                // Minimum touch targets
                '12': '3rem', // 48px minimum
                '14': '3.5rem', // 56px recommended
            }
        }
    },
    // ... rest of config
}
