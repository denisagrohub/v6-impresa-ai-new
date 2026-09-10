"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send, MessageCircleMore } from "lucide-react";

interface ChatMessage {
    direction: 'in' | 'out';
    text: string;
    date: string | false;
}

// 10/09/2026 (Denis: "un assistente dentro i progetti che abbia il
// contesto specifico del progetto e con il quale noi possiamo scrivere
// e analizzare il progetto") - chat con Susanna grounded sui dati reali
// di QUESTO progetto (lavagna, intervista/Kairós o email a seconda del
// modello), non il quadro d'insieme generico del sistema. Storico vero
// (erpv6.agent.chat.log), non perso alla chiusura della pagina.
export default function AssistantChat({
    resModel,
    resId,
    agentCode = 'susanna',
    agentName = 'Susanna',
}: {
    resModel: string;
    resId: number;
    agentCode?: string;
    agentName?: string;
}) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const load = async () => {
        try {
            const res = await fetch(`/api/admin/assistant/history?resModel=${encodeURIComponent(resModel)}&resId=${resId}&agentCode=${agentCode}`);
            const data = await res.json();
            if (data.success) setMessages(data.history || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [resModel, resId, agentCode]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || sending) return;
        const question = input.trim();
        setInput("");
        setError(null);
        setMessages((prev) => [...prev, { direction: 'in', text: question, date: new Date().toISOString() }]);
        setSending(true);
        try {
            const res = await fetch('/api/admin/assistant/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resModel, resId, message: question, agentCode }),
            });
            const data = await res.json();
            if (data.success) {
                setMessages((prev) => [...prev, { direction: 'out', text: data.answer, date: new Date().toISOString() }]);
            } else {
                setError(data.error || 'Invio fallito');
            }
        } catch (err: any) {
            setError(err.message || 'Errore di rete');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
            >
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                    <MessageCircleMore size={14} /> Chiedi a {agentName}
                </span>
                {!loading && messages.length > 0 && !open && (
                    <span className="text-xs text-gray-400">{messages.length} messaggi</span>
                )}
            </button>

            {open && (
                <div className="border-t border-gray-100 flex flex-col">
                    <div className="max-h-72 overflow-y-auto p-3 space-y-2 bg-[#f8fafc]">
                        {loading ? (
                            <Loader2 size={16} className="animate-spin text-gray-400" />
                        ) : messages.length === 0 ? (
                            <p className="text-xs text-gray-400">Scrivi qui per parlare di questo progetto: {agentName} ha già il contesto reale (lavagna, dati del progetto).</p>
                        ) : (
                            messages.map((m, i) => (
                                <div key={i} className={`flex ${m.direction === 'in' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${m.direction === 'in' ? 'bg-[#1a2744] text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
                                        {m.text}
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={bottomRef} />
                    </div>
                    {error && <p className="text-xs text-red-600 px-3 pt-1">{error}</p>}
                    <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-gray-100">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Scrivi un messaggio..."
                            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-gray-200 text-xs"
                        />
                        <button
                            type="submit"
                            disabled={sending || !input.trim()}
                            className="p-2 rounded-lg bg-[#1a2744] text-white disabled:opacity-40 flex-shrink-0"
                        >
                            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
