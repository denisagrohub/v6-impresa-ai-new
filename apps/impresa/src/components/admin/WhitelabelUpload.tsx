"use client";
import { useState, useRef } from "react";
import { Upload, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface WhitelabelUploadProps {
    brandSlug: string;
    currentLogo?: string;
    currentFavicon?: string;
    onUploadComplete: (type: string, url: string) => void;
}

export default function WhitelabelUpload({
    brandSlug,
    currentLogo,
    currentFavicon,
    onUploadComplete
}: WhitelabelUploadProps) {
    const [uploading, setUploading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (file: File, type: 'logo' | 'favicon') => {
        setUploading(type);
        setError(null);
        setSuccess(null);

        const formData = new FormData();
        formData.append('logo', file);
        formData.append('type', type);

        try {
            const response = await fetch(`/api/brands/${brandSlug}/upload`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(`${type === 'logo' ? 'Logo' : 'Favicon'} caricato con successo!`);
                onUploadComplete(type, data.url);
            } else {
                setError(data.error || 'Errore durante il caricamento');
            }
        } catch (err) {
            setError('Errore di connessione');
        } finally {
            setUploading(null);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
        const file = e.target.files?.[0];
        if (file) {
            handleUpload(file, type);
        }
    };

    return (
        <div className="space-y-6">
            {/* Status Messages */}
            {success && (
                <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle2 size={20} className="text-green-600" />
                    <span className="text-sm text-green-800">{success}</span>
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle size={20} className="text-red-600" />
                    <span className="text-sm text-red-800">{error}</span>
                </div>
            )}

            {/* Logo Upload */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                    <ImageIcon size={20} className="text-orange-500" />
                    Logo del Brand
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    Formato consigliato: PNG o SVG con sfondo trasparente. Dimensione minima: 200x50px
                </p>

                <div className="flex items-start gap-6">
                    {/* Preview */}
                    <div className="w-48 h-24 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50">
                        {currentLogo ? (
                            <img src={currentLogo} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                        ) : (
                            <span className="text-xs text-gray-400 text-center px-2">Nessun logo caricato</span>
                        )}
                    </div>

                    {/* Upload Button */}
                    <div className="flex-1">
                        <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            onChange={(e) => handleFileChange(e, 'logo')}
                            className="hidden"
                        />
                        <button
                            onClick={() => logoInputRef.current?.click()}
                            disabled={uploading === 'logo'}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1a2744] text-white hover:bg-[#0f3460] font-medium disabled:opacity-50 transition-all"
                        >
                            {uploading === 'logo' ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Caricamento...
                                </>
                            ) : (
                                <>
                                    <Upload size={18} />
                                    Carica Logo
                                </>
                            )}
                        </button>
                        <p className="text-xs text-gray-500 mt-2">
                            Max 5MB • PNG, JPG, SVG, WebP
                        </p>
                    </div>
                </div>
            </div>

            {/* Favicon Upload */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="font-bold text-[#1a2744] mb-4 flex items-center gap-2">
                    <ImageIcon size={20} className="text-blue-500" />
                    Favicon
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    Icona del browser. Formato consigliato: PNG quadrato 32x32px o 64x64px
                </p>

                <div className="flex items-start gap-6">
                    {/* Preview */}
                    <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                        {currentFavicon ? (
                            <img src={currentFavicon} alt="Favicon preview" className="max-w-full max-h-full object-contain" />
                        ) : (
                            <span className="text-xs text-gray-400">No</span>
                        )}
                    </div>

                    {/* Upload Button */}
                    <div className="flex-1">
                        <input
                            ref={faviconInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            onChange={(e) => handleFileChange(e, 'favicon')}
                            className="hidden"
                        />
                        <button
                            onClick={() => faviconInputRef.current?.click()}
                            disabled={uploading === 'favicon'}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1a2744] text-white hover:bg-[#0f3460] font-medium disabled:opacity-50 transition-all"
                        >
                            {uploading === 'favicon' ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Caricamento...
                                </>
                            ) : (
                                <>
                                    <Upload size={18} />
                                    Carica Favicon
                                </>
                            )}
                        </button>
                        <p className="text-xs text-gray-500 mt-2">
                            Max 5MB • PNG, JPG, SVG, WebP
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
