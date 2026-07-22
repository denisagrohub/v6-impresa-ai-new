// src/components/call/DocumentWatermark.tsx
"use client";
import { useEffect, useState } from 'react';

interface DocumentWatermarkProps {
    clientName: string;
    consultantName: string;
    projectId: string;
    documentId: string;
}

export default function DocumentWatermark({
    clientName,
    consultantName,
    projectId,
    documentId
}: DocumentWatermarkProps) {
    const [timestamp, setTimestamp] = useState(new Date());

    // Aggiorna timestamp ogni 30 secondi
    useEffect(() => {
        const interval = setInterval(() => {
            setTimestamp(new Date());
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const watermarkText = `CONFIDENZIALE • ${clientName} • ${consultantName} • ${timestamp.toLocaleString('it-IT')} • ${projectId}`;

    return (
        <div
            className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
            style={{
                backgroundImage: `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 300px,
          rgba(255, 115, 22, 0.08) 300px,
          rgba(255, 115, 22, 0.08) 301px
        )`,
            }}
        >
            {/* Pattern di watermark ripetuto */}
            <div className="absolute inset-0 flex flex-wrap content-around justify-around gap-8 p-8">
                {Array.from({ length: 20 }).map((_, i) => (
                    <div
                        key={i}
                        className="text-orange-500/15 font-bold text-sm whitespace-nowrap transform -rotate-45 select-none"
                        style={{
                            textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                        }}
                    >
                        {watermarkText}
                    </div>
                ))}
            </div>
        </div>
    );
}
