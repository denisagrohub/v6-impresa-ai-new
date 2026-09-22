"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

interface Partner { id: number; name: string; email: string | false; phone?: string | false; is_company?: boolean; }
interface Props { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const splitValues = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

export default function EmailRecipientInput({ value, onChange, placeholder, className }: Props) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Partner[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (query.trim().length < 2) { setResults([]); setOpen(false); return; }
        setLoading(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/admin/partners/search?q=${encodeURIComponent(query.trim())}`);
                const d = await res.json();
                const list: Partner[] = (d.partners || []).filter((p: Partner) => !!p.email);
                setResults(list);
                setOpen(list.length > 0);
                setHighlight(0);
            } catch { setResults([]); setOpen(false); }
            finally { setLoading(false); }
        }, 250);
        return () => { clearTimeout(t); setLoading(false); };
    }, [query]);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    const addRecipient = (email: string) => {
        const e = email.trim();
        if (!e) return;
        const list = splitValues(value);
        if (!list.some((x) => x.toLowerCase() === e.toLowerCase())) list.push(e);
        onChange(list.join(", "));
        setQuery(""); setResults([]); setOpen(false);
    };

    const removeRecipient = (email: string) => {
        const list = splitValues(value).filter((e) => e.toLowerCase() !== email.toLowerCase());
        onChange(list.join(", "));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const q = query.trim();
        if ((e.key === "Enter" || e.key === "," || e.key === " " || e.key === "Tab") && q && !open) {
            if (EMAIL_RE.test(q) || e.key === "Tab" || e.key === "Enter") {
                e.preventDefault();
                addRecipient(q);
                return;
            }
        }
        if (e.key === "," && q) { e.preventDefault(); addRecipient(q); return; }
        if (open) {
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); const r = results[highlight]; if (r && r.email) addRecipient(r.email as string); }
            else if (e.key === "Escape") { setOpen(false); }
        }
    };

    const handleBlur = () => {
        const q = query.trim();
        if (q && EMAIL_RE.test(q)) addRecipient(q);
    };

    const chips = splitValues(value);

    return (
        <div ref={wrapRef} className="relative">
            {chips.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                    {chips.map((c) => (
                        <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                            {c}
                            <button type="button" onClick={() => removeRecipient(c)} className="text-blue-500 hover:text-blue-800" title="Rimuovi"><X size={11} /></button>
                        </span>
                    ))}
                </div>
            )}
            <div className="relative">
                <input
                    type="text" value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    onFocus={() => { if (results.length > 0) setOpen(true); }}
                    placeholder={placeholder || "Cerca nome o scrivi email + Invio…"}
                    className={className || "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"}
                />
                {loading && <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
            </div>
            {open && results.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {results.map((r, i) => (
                        <button key={r.id} type="button"
                            onMouseDown={(e) => { e.preventDefault(); addRecipient(r.email as string); }}
                            onMouseEnter={() => setHighlight(i)}
                            className={`w-full text-left px-3 py-2 text-sm flex flex-col ${i === highlight ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                            <span className="font-medium text-[#1a2744] truncate">{r.name}</span>
                            <span className="text-xs text-gray-500 truncate">{r.email}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
