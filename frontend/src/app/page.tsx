'use client';

import NoSSR from '@/components/NoSSR';
import CameraSection from '@/components/CameraSection';

export default function Home() {
    return (
        <main className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Real-Time Sign Language Translator
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Use your camera to translate sign language in real-time
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Camera Section - Completely prevent SSR */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <NoSSR
                            fallback={
                                <div className="flex items-center justify-center h-96">
                                    <div className="text-gray-500">Loading camera system...</div>
                                </div>
                            }
                        >
                            <CameraSection />
                        </NoSSR>
                    </div>

                    {/* Translation Output Section */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">
                            Translation Output
                        </h3>
                        <div className="bg-gray-100 rounded-lg p-4 min-h-[400px] flex items-center justify-center">
                            <p className="text-gray-500 text-center">
                                Translation results will appear here
                                <br />
                                <span className="text-sm">Start your camera to begin</span>
                            </p>
                        </div>
                    </div>

                </div>

                {/* Status Section */}
                <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">System Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-gray-600">Frontend Connected</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-gray-600">Backend API Ready</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm text-gray-600">ML Model Loading...</span>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
