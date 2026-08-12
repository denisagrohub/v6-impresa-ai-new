"use client";
import { useEffect, useState } from "react";
import { FlaskConical, X } from "lucide-react";

export default function DemoBanner() {
    const [show, setShow] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        fetch('/api/admin/demo-mode')
            .then(res => res.json())
            .then(data => {
                if (data.demoMode && !sessionStorage.getItem('demo_banner_dismissed')) {
                    setShow(true);
                }
            })
            .catch(() => { });
    }, []);

    const handleDismiss = () => {
        setDismissed(true);
        sessionStorage.setItem('demo_banner_dismissed', 'true');
    };

    if (!show || dismissed) return null;

    return (
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 shadow-lg">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FlaskConical size={16} />
                    <div className="flex items-center gap-2 text-sm">
                        <span className="font-bold">MODALITÀ DEMO</span>
                        <span className="opacity-90 hidden sm:inline">
                            • I pagamenti sono simulati
                        </span>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    aria-label="Chiudi banner"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
