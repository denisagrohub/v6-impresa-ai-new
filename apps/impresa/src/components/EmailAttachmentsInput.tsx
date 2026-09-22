"use client";
import { useEffect, useState } from "react";
import { UploadCloud, Loader2, X, FileText } from "lucide-react";

export interface AttachedFile {
    id?: string | number;
    name: string;
    url?: string;
    fileRaw?: File;
    source: "local" | "library";
}

interface Props {
    value: AttachedFile[];
    onChange: (v: AttachedFile[]) => void;
    relationId?: number | null;
    userToken?: string | null;
}

interface LibDoc { id: number; name: string; file_size?: number; }

export default function EmailAttachmentsInput({ value, onChange, relationId, userToken }: Props) {
    const [isSourceOpen, setIsSourceOpen] = useState(false);
    const [isLibOpen, setIsLibOpen] = useState(false);
    const [libDocs, setLibDocs] = useState<LibDoc[]>([]);
    const [loadingLib, setLoadingLib] = useState(false);

    const openLibrary = async () => {
        if (!relationId) return;
        setIsLibOpen(true); setLoadingLib(true);
        try {
            const res = await fetch(`/api/admin/partner-projects/${relationId}/documents`);
            const d = await res.json();
            setLibDocs((d.documents || d || []).map((x: any) => ({ id: x.id, name: x.name, file_size: x.file_size })));
        } catch { setLibDocs([]); }
        finally { setLoadingLib(false); }
    };

    return (
        <>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Allegati</label>
            {value.length > 0 && (
                <div className="space-y-1 mb-2">
                    {value.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded px-2 py-1">
                            <span className="truncate">{f.source === "library" ? "📚 " : "📎 "}{f.name}</span>
                            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600 ml-2">
                                <X size={11} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200 text-xs cursor-pointer hover:bg-gray-50">
                    <UploadCloud size={12} /> Da PC
                    <input type="file" className="hidden" multiple
                        onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length) onChange([...value, ...files.map((f) => ({ name: f.name, fileRaw: f, source: "local" as const }))]);
                            e.target.value = "";
                        }} />
                </label>
                {relationId && (
                    <button type="button" onClick={openLibrary}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200 text-xs cursor-pointer hover:bg-gray-50">
                        📚 Da Libreria Progetto
                    </button>
                )}
            </div>

            {isLibOpen && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setIsLibOpen(false)}>
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-[#0f172a]">Libreria Progetto</h3>
                            <button onClick={() => setIsLibOpen(false)} className="text-gray-400 hover:text-gray-800"><X size={16} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-1">
                            {loadingLib ? (
                                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
                            ) : libDocs.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Nessun documento in libreria.</p>
                            ) : (
                                libDocs.map((doc) => (
                                    <button key={doc.id}
                                        onClick={() => { onChange([...value, { id: doc.id, name: doc.name, source: "library" as const }]); setIsLibOpen(false); }}
                                        className="w-full flex items-center justify-between text-left px-3 py-2 rounded border border-gray-100 hover:bg-gray-50 text-xs">
                                        <span className="flex items-center gap-2 truncate">
                                            <FileText size={12} className="text-gray-400 shrink-0" />
                                            <span className="truncate font-medium text-[#0f172a]">{doc.name}</span>
                                        </span>
                                        <span className="text-gray-400 ml-2">＋</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
