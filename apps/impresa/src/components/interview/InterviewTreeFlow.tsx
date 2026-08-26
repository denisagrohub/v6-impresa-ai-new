'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Badge, Input } from '@erpv6/ui';
import { Loader2, CheckCircle2, ArrowRight, Sparkles, AlertTriangle, Lightbulb } from 'lucide-react';
import {
    fetchInterviewProducts,
    startInterview,
    answerInterview,
    type InterviewProduct,
    type InterviewQuestionPayload,
    type InterviewScore,
} from '@/lib/interview/tree-client';

// Motore dell'intervista ad albero (erpv6.interview.session lato Odoo, vedi
// odoo-modules/erpv6_production/models/interview_engine.py), estratto da
// /intervista/guidata/page.tsx il 25/08/2026 (compito "dashboard
// consulente") per poter essere riusato TALE E QUALE anche da un consulente
// loggato che avvia la stessa intervista dalla propria dashboard per un
// cliente seguito di persona - Denis ha escluso esplicitamente un form
// nuovo/wizard di prodotto per questo caso, deve essere la stessa
// intervista. /intervista/guidata resta l'unico chiamante pubblico
// (variant="public", nessun authToken); /consultant/nuovo-lead e' il nuovo
// chiamante autenticato (variant="consultant", authToken=JWT sessione).
//
// Nessuna domanda, opzione o punteggio e' inventato qui - se Odoo non
// risponde o la sessione non produce una prossima domanda, lo stato si
// ferma su un messaggio esplicito, mai su un dato fabbricato (disciplina
// anti-allucinazione, vedi CLAUDE.md).

type Step = 'intro' | 'question' | 'completed' | 'error';

export interface InterviewTreeFlowProps {
    variant?: 'public' | 'consultant';
    // Riprende una sessione/lead gia' noto (es. /intervista?lead_id=..., o
    // in futuro una ripresa dalla dashboard) invece di crearne uno nuovo.
    incomingLeadId?: number | null;
    initialName?: string;
    initialEmail?: string;
    // JWT della sessione (pi_session.token) - SOLO variant="consultant":
    // propagato a startInterview cosi' interview_api.py attribuisce subito
    // il lead al consulente/admin che lo sta creando (ruolo sourcing, vedi
    // crm_lead.py/_set_sourcing_consulente). Assente per variant="public".
    authToken?: string;
    onCompleted?: (leadId: number | null) => void;
}

export function InterviewTreeFlow({
    variant = 'public',
    incomingLeadId = null,
    initialName = '',
    initialEmail = '',
    authToken,
    onCompleted,
}: InterviewTreeFlowProps) {
    const [step, setStep] = useState<Step>('intro');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [products, setProducts] = useState<InterviewProduct[]>([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [name, setName] = useState(initialName);
    const [email, setEmail] = useState(initialEmail);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
    const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

    const [leadId, setLeadId] = useState<number | null>(incomingLeadId);
    const [question, setQuestion] = useState<InterviewQuestionPayload | null>(null);
    const [score, setScore] = useState<InterviewScore | null>(null);
    const [answeredCount, setAnsweredCount] = useState(0);
    const [freeTextValue, setFreeTextValue] = useState('');

    useEffect(() => {
        fetchInterviewProducts()
            .then(setProducts)
            .catch((err) => {
                console.error('Prodotti intervista non disponibili:', err);
            })
            .finally(() => setProductsLoading(false));
    }, []);

    const selectedProduct = products.find((p) => p.id === selectedProductId) || null;

    async function handleStart() {
        if (!incomingLeadId && (!name.trim() || !email.trim())) {
            setErrorMessage('Nome ed email sono obbligatori per iniziare.');
            return;
        }
        setErrorMessage(null);
        setLoading(true);
        try {
            const verticaleId = selectedVariantId ?? selectedProductId ?? undefined;
            const result = incomingLeadId
                ? await startInterview({ lead_id: incomingLeadId, verticale_id: verticaleId ?? undefined }, authToken)
                : await startInterview(
                      { name: name.trim(), email: email.trim(), verticale_id: verticaleId ?? undefined },
                      authToken
                  );
            setLeadId(result.lead_id);
            if (result.question) {
                setQuestion(result.question);
                setFreeTextValue('');
                setStep('question');
            } else {
                setStep('completed');
                onCompleted?.(result.lead_id ?? null);
            }
        } catch (err: any) {
            setErrorMessage(err.message || "Impossibile avviare l'intervista.");
            setStep('error');
        } finally {
            setLoading(false);
        }
    }

    async function submitAnswer(params: { option_id?: number; value_text?: string; is_altro?: boolean }) {
        if (!question) return;
        setLoading(true);
        setErrorMessage(null);
        try {
            const result = await answerInterview({ session_id: question.session_id, ...params });
            setAnsweredCount((c) => c + 1);
            setFreeTextValue('');
            if (result.completed || !result.question) {
                setQuestion(null);
                setScore(result.score);
                setStep('completed');
                onCompleted?.(leadId);
            } else {
                setQuestion(result.question);
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Impossibile inviare la risposta.');
        } finally {
            setLoading(false);
        }
    }

    function handleOptionClick(optionId: number) {
        submitAnswer({ option_id: optionId });
    }

    function handleFreeTextSubmit(isAltro: boolean) {
        const value = freeTextValue.trim();
        if (!value) return;
        submitAnswer({ value_text: value, is_altro: isAltro });
    }

    const isConsultant = variant === 'consultant';

    return (
        <div className="w-full max-w-2xl mx-auto">
            {step === 'intro' && (
                <Card className="p-8">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={18} className="text-orange-500" />
                        <Badge variant="primary" className="bg-orange-500 text-white">Intervista guidata</Badge>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        {incomingLeadId
                            ? 'Continuiamo da dove hai lasciato'
                            : isConsultant
                            ? 'Nuovo cliente: avvia l\'intervista'
                            : 'Raccontaci il tuo progetto'}
                    </h1>
                    <p className="text-gray-600 mb-6">
                        {incomingLeadId
                            ? `Bentornato${name ? `, ${name}` : ''}: qualche domanda in più, su misura per quello che ci hai già raccontato.`
                            : isConsultant
                            ? 'Stessa intervista che usa un visitatore del sito: rispondi con i dati del cliente che stai seguendo di persona. Il lead risultante si attribuirà automaticamente a te.'
                            : 'Poche domande, una alla volta: il percorso si adatta a quello che scegli e a quello che scrivi.'}
                    </p>

                    {incomingLeadId ? (
                        <div className="mb-6 p-3 bg-orange-50 border border-orange-100 rounded-xl text-sm text-orange-800">
                            Stiamo continuando la richiesta {name || email ? `(${[name, email].filter(Boolean).join(' · ')})` : ''} — riferimento #{incomingLeadId}.
                        </div>
                    ) : (
                        <div className="space-y-4 mb-6">
                            <Input
                                label={isConsultant ? 'Nome del cliente' : 'Il tuo nome'}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Mario Rossi"
                                required
                            />
                            <Input
                                label={isConsultant ? 'Email del cliente' : 'La tua email'}
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="mario@esempio.it"
                                required
                            />
                        </div>
                    )}

                    <div className="mb-6">
                        <p className="text-sm font-medium text-gray-700 mb-3">Che tipo di prodotto ti interessa? (opzionale)</p>
                        {productsLoading ? (
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <Loader2 size={16} className="animate-spin" /> Carico i prodotti da Odoo...
                            </div>
                        ) : products.length === 0 ? (
                            <p className="text-sm text-gray-500">
                                Catalogo prodotti non disponibile al momento: puoi comunque proseguire, l'intervista parte dal ramo generico.
                            </p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {products.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedProductId(p.id === selectedProductId ? null : p.id);
                                            setSelectedVariantId(null);
                                        }}
                                        className={`p-3 text-sm text-left border-2 rounded-xl transition-all ${
                                            selectedProductId === p.id
                                                ? 'border-orange-500 bg-orange-50 text-orange-700 font-medium'
                                                : 'border-gray-200 hover:border-orange-300'
                                        }`}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        )}
                        {selectedProduct && selectedProduct.variants.length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs text-gray-500 mb-2">Variante specifica (opzionale)</p>
                                <div className="flex flex-wrap gap-2">
                                    {selectedProduct.variants.map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => setSelectedVariantId(v.id === selectedVariantId ? null : v.id)}
                                            className={`px-3 py-1.5 text-xs rounded-full border-2 transition-all ${
                                                selectedVariantId === v.id
                                                    ? 'border-orange-500 bg-orange-500 text-white'
                                                    : 'border-gray-200 text-gray-600 hover:border-orange-300'
                                            }`}
                                        >
                                            {v.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {errorMessage && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {errorMessage}
                        </div>
                    )}

                    <Button onClick={handleStart} disabled={loading} fullWidth size="lg">
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <>Inizia <ArrowRight size={18} /></>}
                    </Button>
                </Card>
            )}

            {step === 'question' && question && (
                <Card className="p-8">
                    <div className="flex items-center justify-between mb-4">
                        <Badge variant="primary" className="bg-orange-500 text-white">
                            Domanda {answeredCount + 1}
                        </Badge>
                        {loading && <Loader2 size={16} className="animate-spin text-orange-500" />}
                    </div>

                    {question.contextual_message && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex items-start gap-2">
                            <Lightbulb size={16} className="mt-0.5 shrink-0" /> {question.contextual_message}
                        </div>
                    )}

                    <h2 className="text-2xl font-bold text-gray-900 mb-6">{question.question_text}</h2>

                    {question.answer_type === 'select' && question.options.length > 0 && (
                        <div className="space-y-3 mb-4">
                            {question.options.map((opt) => (
                                <button
                                    key={opt.id}
                                    disabled={loading}
                                    onClick={() => handleOptionClick(opt.id)}
                                    className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-all disabled:opacity-50"
                                >
                                    <span className="text-gray-700">{opt.value}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {question.answer_type !== 'select' && (
                        <div className="mb-4">
                            {question.answer_type === 'textarea' ? (
                                <textarea
                                    value={freeTextValue}
                                    onChange={(e) => setFreeTextValue(e.target.value)}
                                    rows={4}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 resize-none"
                                    placeholder="Scrivi qui..."
                                />
                            ) : (
                                <input
                                    type={question.answer_type === 'number' ? 'number' : 'text'}
                                    value={freeTextValue}
                                    onChange={(e) => setFreeTextValue(e.target.value)}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20"
                                    placeholder="Scrivi qui..."
                                />
                            )}
                            <div className="flex justify-end mt-4">
                                <Button onClick={() => handleFreeTextSubmit(false)} disabled={loading || !freeTextValue.trim()}>
                                    Avanti <ArrowRight size={18} />
                                </Button>
                            </div>
                        </div>
                    )}

                    {question.answer_type === 'select' && question.always_show_altro && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-2">Nessuna di queste? Scrivi la risposta:</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={freeTextValue}
                                    onChange={(e) => setFreeTextValue(e.target.value)}
                                    className="flex-1 p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20"
                                    placeholder="Altro..."
                                />
                                <Button
                                    variant="secondary"
                                    onClick={() => handleFreeTextSubmit(true)}
                                    disabled={loading || !freeTextValue.trim()}
                                >
                                    Invia
                                </Button>
                            </div>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {errorMessage}
                        </div>
                    )}
                </Card>
            )}

            {step === 'completed' && (
                <Card className="p-8 text-center">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={40} className="text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Intervista completata</h2>
                    <p className="text-gray-600 mb-6">
                        {isConsultant ? 'Le risposte sono state registrate' : `Grazie${name ? `, ${name}` : ''}. Le tue risposte sono state registrate`}
                        {leadId ? ` (riferimento #${leadId})` : ''}.
                    </p>
                    {score && (
                        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-6 text-left">
                            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 mb-2">
                                Prima analisi
                            </p>
                            <p className="text-lg font-bold text-gray-900 mb-3">
                                {score.quadrante_label || score.quadrante}
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-gray-500">Impatto potenziale</span>
                                    <p className="font-semibold text-gray-900 capitalize">{score.impatto_level}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">Prontezza a partire</span>
                                    <p className="font-semibold text-gray-900 capitalize">{score.prontezza_level}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {isConsultant ? (
                        <Link href="/consultant/dashboard">
                            <Button size="lg" fullWidth>Torna ai miei progetti</Button>
                        </Link>
                    ) : (
                        <>
                            <p className="text-gray-600 mb-6">Un consulente riceve le tue risposte e ti ricontatta.</p>
                            <Link href="/contatti">
                                <Button size="lg" fullWidth>Contattaci</Button>
                            </Link>
                        </>
                    )}
                </Card>
            )}

            {step === 'error' && (
                <Card className="p-8 text-center">
                    <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={40} className="text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Non siamo riusciti ad avviare l'intervista</h2>
                    <p className="text-gray-600 mb-6">{errorMessage}</p>
                    <Button size="lg" fullWidth onClick={() => { setStep('intro'); setErrorMessage(null); }}>
                        Riprova
                    </Button>
                </Card>
            )}
        </div>
    );
}
