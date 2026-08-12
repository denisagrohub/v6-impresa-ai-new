"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ArrowLeft, Eye } from "lucide-react";

export default function PreviewBanner() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            if (params.get("preview") === "true") {
                setShow(true);
            }
        }
    }, []);

    if (!show) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-white px-6 py-3 shadow-lg">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Eye size={20} />
                    <div>
                        <div className="font-bold text-sm">MODALITÀ ANTEPRIMA</div>
                        <div className="text-xs opacity-90">Stai visualizzando il sito come lo vedrà un visitatore</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/settings/brands"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-orange-600 font-semibold text-sm hover:bg-orange-50 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        Torna all'Admin
                    </Link>
                </div>
            </div>
        </div>
    );
}
