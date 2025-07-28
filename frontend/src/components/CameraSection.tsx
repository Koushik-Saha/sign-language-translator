'use client';

import dynamic from 'next/dynamic';

const CameraCapture = dynamic(() => import('./CameraCapture'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-96">
            <div className="text-gray-500">Loading camera...</div>
        </div>
    )
});

export default function CameraSection() {
    return <CameraCapture />;
}
