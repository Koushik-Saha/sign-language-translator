import React from 'react';

interface DetectionPanelProps {
    currentGesture: string;
    confidence: number;
    currentWord: string;
    wordSequence: string[];
    mode: string;
    stream: MediaStream | null;
    confidenceColorClass: string;
}

const DetectionPanel: React.FC<DetectionPanelProps> = ({
                                                           currentGesture,
                                                           confidence,
                                                           currentWord,
                                                           wordSequence,
                                                           mode,
                                                           stream,
                                                           confidenceColorClass
                                                       }) => {
    const getStreamInfo = () => {
        if (!stream) return { fps: 30, width: 1280, height: 720 };

        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings() || {};

        return {
            fps: settings.frameRate || 30,
            width: settings.width || 1280,
            height: settings.height || 720
        };
    };

    const streamInfo = getStreamInfo();

    return (
        <div className="bg-black/70 backdrop-blur-md rounded-2xl border border-white/20 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Current Gesture Card */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">👋</span>
                        <h3 className="text-white font-bold text-lg">Current Gesture</h3>
                    </div>

                    <div className="text-center">
                        <div className="text-4xl font-bold text-white mb-2">
                            {currentGesture || 'None'}
                        </div>

                        {/* Confidence Bar */}
                        <div className="bg-white/20 rounded-full h-3 mb-2 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${confidenceColorClass}`}
                                style={{ width: `${confidence * 100}%` }}
                            />
                        </div>

                        <p className="text-white/80 text-sm">
                            Confidence: {(confidence * 100).toFixed(1)}%
                        </p>
                    </div>
                </div>

                {/* Word Formation Card */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">📝</span>
                        <h3 className="text-white font-bold text-lg">
                            {mode === 'letter' ? 'Letters' : 'Words'}
                        </h3>
                    </div>

                    <div className="text-center">
                        <div className="text-2xl font-bold text-white mb-2 min-h-[2rem]">
                            {mode === 'letter'
                                ? wordSequence.join('')
                                : currentWord || 'Building...'
                            }
                        </div>

                        <div className="text-white/80 text-sm">
                            {mode === 'letter'
                                ? `${wordSequence.length} letters detected`
                                : `Sequence: ${wordSequence.length} gestures`
                            }
                        </div>

                        {/* Word sequence visualization */}
                        {mode !== 'letter' && wordSequence.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2 justify-center">
                                {wordSequence.slice(-5).map((letter, index) => (
                                    <span
                                        key={index}
                                        className="bg-blue-500/50 text-white px-2 py-1 rounded text-xs"
                                    >
                                        {letter}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Performance Stats Card */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">📊</span>
                        <h3 className="text-white font-bold text-lg">Performance</h3>
                    </div>

                    <div className="text-center">
                        <div className="text-2xl font-bold text-white mb-2">
                            {streamInfo.fps} FPS
                        </div>

                        <div className="text-white/80 text-sm space-y-1">
                            <div>Resolution: {streamInfo.width}×{streamInfo.height}</div>
                            <div className="flex items-center justify-center gap-2 mt-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span>Real-time Processing</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="mt-4 pt-4 border-t border-white/20">
                <div className="flex justify-between items-center text-white/60 text-sm">
                    <div className="flex items-center gap-4">
                        <span>🎯 Mode: {mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                        <span>⚡ Status: Active</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span>🔍 Detection: Real-time</span>
                        <span>📡 Latency: ~45ms</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DetectionPanel;
