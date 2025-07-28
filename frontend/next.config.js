/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    experimental: {
        suppressHydrationWarning: true,
    },
    compiler: {
        removeConsole: false,
    }
}

module.exports = nextConfig
