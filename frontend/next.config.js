/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    experimental: {

    },
    compiler: {
        removeConsole: false,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true, // Also ignore TypeScript errors if needed
    },
}

module.exports = nextConfig
