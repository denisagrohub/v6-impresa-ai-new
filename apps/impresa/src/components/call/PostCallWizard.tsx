"use client";
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';

interface PostCallWizardProps {
    callData: {
        callId: string;
        projectId: string;
        consultantId: string;
        patterns: any[];
        discProfile: string;
        kairosScore: number;
        kairosQuadrant: string;
        objections: any[];
    };
    onComplete: (feedback: any) => void;
}

export default function PostCallWizard({ callData, onComplete }: PostCallWizardProps) {
    const [step, setStep] = useState(0);
    const [feedback, setFeedback] = useState<any>({
        callId: callData.callId,
        projectId: callData.projectId,
        consultantId: callData.consultantId,
        timestamp: new Date().toISOString(),
        patterns: [],
        disc: null,
        kairos: null,
        objections: []
    });

    const totalSteps = 5;

    const handleNext = () => {
        if (step < totalSteps - 1) {
            setStep(step + 1);
        } else {
            // Calcola accuracy rate
            const totalEvaluations =
                feedback.patterns.length +
                (feedback.disc ? 1 : 0) +
                (feedback.kairos ? 1 : 0) +
                feedback.objections.length;

            const correctEvaluations =
                feedback.patterns.filter((p: any) => p.accuracy === 'correct').length +
                (feedback.disc?.accuracy === 'very_accurate' ? 1 : 0) +
                (feedback.kairos?.accuracy === 'very_accurate' ? 1 : 0) +
                feedback.objections.filter((o: any) => o.handledCorrectly === 'yes').length;

            const accuracyRate = totalEvaluations > 0
                ? Math.round((correctEvaluations / totalEvaluations) * 100)
                : 0;

            onComplete({
                ...feedback,
                overallAccuracy: accuracyRate
            });
        }
    };

    const handleBack = () => {
        if (step > 0) setStep(step - 1);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-[#1a2744]">
                            {step === 0 && "🎯 Valutazione Pattern Rilevati"}
                            {step === 1 && "🧠 Valutazione Profilo DISC"}
                            {step === 2 && "📊 Valutazione Kairós"}
                            {step === 3 && "⚠️ Valutazione Obiezioni"}
                            {step === 4 && "✅ Valutazione Completata"}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Step {step + 1} di {totalSteps}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-orange-500 transition-all"
                                style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Step 1: Pattern Evaluation */}
                    {step === 0 && (
                        <div className="space-y-4">
                            <p className="text-gray-600 mb-4">
                                Pattern rilevati durante la call:
                            </p>
                            {callData.patterns.map((pattern, i) => (
                                <div key={i} className="p-4 bg-gray-50 rounded-xl">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-[#1a2744]">
                                            {pattern.id}: {pattern.pattern}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const updated = [...feedback.patterns];
                                                updated[i] = {
                                                    patternId: pattern.id,
                                                    detected: true,
                                                    accuracy: 'correct'
                                                };
                                                setFeedback({ ...feedback, patterns: updated });
                                            }}
                                            className={`flex-1 px-4 py-2 rounded-lg font-medium ${feedback.patterns[i]?.accuracy === 'correct'
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-white border border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            ✓ Corretto
                                        </button>
                                        <button
                                            onClick={() => {
                                                const updated = [...feedback.patterns];
                                                updated[i] = {
                                                    patternId: pattern.id,
                                                    detected: true,
                                                    accuracy: 'partial'
                                                };
                                                setFeedback({ ...feedback, patterns: updated });
                                            }}
                                            className={`flex-1 px-4 py-2 rounded-lg font-medium ${feedback.patterns[i]?.accuracy === 'partial'
                                                    ? 'bg-orange-500 text-white'
                                                    : 'bg-white border border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            ⚠️ Parzialmente
                                        </button>
                                        <button
                                            onClick={() => {
                                                const updated = [...feedback.patterns];
                                                updated[i] = {
                                                    patternId: pattern.id,
                                                    detected: true,
                                                    accuracy: 'incorrect'
                                                };
                                                setFeedback({ ...feedback, patterns: updated });
                                            }}
                                            className={`flex-1 px-4 py-2 rounded-lg font-medium ${feedback.patterns[i]?.accuracy === 'incorrect'
                                                    ? 'bg-red-500 text-white'
                                                    : 'bg-white border border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            ✗ Errato
                                        </button>
                                    </div>
                                    {feedback.patterns[i]?.accuracy && (
                                        <textarea
                                            placeholder="Commento opzionale..."
                                            rows={2}
                                            className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
                                            onChange={(e) => {
                                                const updated = [...feedback.patterns];
                                                updated[i].comment = e.target.value;
                                                setFeedback({ ...feedback, patterns: updated });
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 2: DISC Evaluation */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-gray-600 mb-4">
                                AI ha identificato: <strong>{callData.discProfile}</strong>
                            </p>
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700">
                                    Quanto è accurato?
                                </label>
                                <div className="flex gap-2">
                                    {['very_accurate', 'somewhat', 'not_accurate'].map(acc => (
                                        <button
                                            key={acc}
                                            onClick={() => setFeedback({
                                                ...feedback,
                                                disc: {
                                                    aiProfile: callData.discProfile,
                                                    accuracy: acc
                                                }
                                            })}
                                            className={`flex-1 px-4 py-3 rounded-lg font-medium ${feedback.disc?.accuracy === acc
                                                    ? 'bg-orange-500 text-white'
                                                    : 'bg-white border border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            {acc === 'very_accurate' && '⚫ Molto accurato'}
                                            {acc === 'somewhat' && '⚪ Abbastanza'}
                                            {acc === 'not_accurate' && '⚪ Poco accurato'}
                                        </button>
                                    ))}
                                </div>
                                {feedback.disc?.accuracy === 'not_accurate' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Quale profilo era più corretto?
                                        </label>
                                        <div className="flex gap-2">
                                            {['D', 'I', 'S', 'C'].map(profile => (
                                                <button
                                                    key={profile}
                                                    onClick={() => setFeedback({
                                                        ...feedback,
                                                        disc: {
                                                            ...feedback.disc,
                                                            correctedProfile: profile
                                                        }
                                                    })}
                                                    className={`flex-1 px-4 py-2 rounded-lg font-bold ${feedback.disc?.correctedProfile === profile
                                                            ? 'bg-orange-500 text-white'
                                                            : 'bg-white border border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {profile}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <textarea
                                    placeholder="Commento opzionale..."
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
                                    onChange={(e) => setFeedback({
                                        ...feedback,
                                        disc: {
                                            ...feedback.disc,
                                            comment: e.target.value
                                        }
                                    })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Kairós Evaluation */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <p className="text-gray-600 mb-4">
                                AI ha calcolato: <strong>{callData.kairosScore}/15 ({callData.kairosQuadrant})</strong>
                            </p>
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700">
                                    Quanto è accurato?
                                </label>
                                <div className="flex gap-2">
                                    {['very_accurate', 'somewhat', 'not_accurate'].map(acc => (
                                        <button
                                            key={acc}
                                            onClick={() => setFeedback({
                                                ...feedback,
                                                kairos: {
                                                    aiScore: callData.kairosScore,
                                                    aiQuadrant: callData.kairosQuadrant,
                                                    accuracy: acc
                                                }
                                            })}
                                            className={`flex-1 px-4 py-3 rounded-lg font-medium ${feedback.kairos?.accuracy === acc
                                                    ? 'bg-orange-500 text-white'
                                                    : 'bg-white border border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            {acc === 'very_accurate' && '⚫ Molto accurato'}
                                            {acc === 'somewhat' && '⚪ Abbastanza'}
                                            {acc === 'not_accurate' && '⚪ Poco accurato'}
                                        </button>
                                    ))}
                                </div>
                                {feedback.kairos?.accuracy === 'not_accurate' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Quale quadrante era più corretto?
                                        </label>
                                        <div className="flex gap-2">
                                            {['PREPARA', 'KAIROS_AUTENTICO', 'QUICK_WIN', 'PARCHEGGIO'].map(q => (
                                                <button
                                                    key={q}
                                                    onClick={() => setFeedback({
                                                        ...feedback,
                                                        kairos: {
                                                            ...feedback.kairos,
                                                            correctedQuadrant: q
                                                        }
                                                    })}
                                                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold ${feedback.kairos?.correctedQuadrant === q
                                                            ? 'bg-orange-500 text-white'
                                                            : 'bg-white border border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {q.replace('_', ' ')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <textarea
                                    placeholder="Commento opzionale..."
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
                                    onChange={(e) => setFeedback({
                                        ...feedback,
                                        kairos: {
                                            ...feedback.kairos,
                                            comment: e.target.value
                                        }
                                    })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 4: Objections Evaluation */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <p className="text-gray-600 mb-4">
                                Obiezioni rilevate:
                            </p>
                            {callData.objections.map((obj, i) => (
                                <div key={i} className="p-4 bg-gray-50 rounded-xl">
                                    <div className="font-bold text-[#1a2744] mb-2">
                                        {obj.id}: "{obj.dichiarata}"
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const updated = [...feedback.objections];
                                                updated[i] = {
                                                    objectionId: obj.id,
                                                    detected: true,
                                                    handledCorrectly: 'yes'
                                                };
                                                setFeedback({ ...feedback, objections: updated });
                                            }}
                                            className={`flex-1 px-4 py-2 rounded-lg font-medium ${feedback.objections[i]?.handledCorrectly === 'yes'
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-white border border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            ✓ Gestita bene
                                        </button>
                                        <button
                                            onClick={() => {
                                                const updated = [...feedback.objections];
                                                updated[i] = {
                                                    objectionId: obj.id,
                                                    detected: true,
                                                    handledCorrectly: 'no'
                                                };
                                                setFeedback({ ...feedback, objections: updated });
                                            }}
                                            className={`flex-1 px-4 py-2 rounded-lg font-medium ${feedback.objections[i]?.handledCorrectly === 'no'
                                                    ? 'bg-red-500 text-white'
                                                    : 'bg-white border border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            ✗ Gestita male
                                        </button>
                                    </div>
                                    {feedback.objections[i]?.handledCorrectly === 'no' && (
                                        <textarea
                                            placeholder="Come l'hai gestita?"
                                            rows={2}
                                            className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
                                            onChange={(e) => {
                                                const updated = [...feedback.objections];
                                                updated[i].handlingTechnique = e.target.value;
                                                setFeedback({ ...feedback, objections: updated });
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 5: Summary */}
                    {step === 4 && (
                        <div className="text-center py-8">
                            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                                <Check size={48} className="text-green-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-[#1a2744] mb-2">
                                Valutazione Completata!
                            </h3>
                            <p className="text-gray-600 mb-6">
                                Grazie! Il tuo feedback aiuta a migliorare l'AI.
                            </p>
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-6">
                                <div className="text-4xl font-bold text-orange-600 mb-2">
                                    {(() => {
                                        const totalEvaluations =
                                            feedback.patterns.length +
                                            (feedback.disc ? 1 : 0) +
                                            (feedback.kairos ? 1 : 0) +
                                            feedback.objections.length;

                                        const correctEvaluations =
                                            feedback.patterns.filter((p: any) => p.accuracy === 'correct').length +
                                            (feedback.disc?.accuracy === 'very_accurate' ? 1 : 0) +
                                            (feedback.kairos?.accuracy === 'very_accurate' ? 1 : 0) +
                                            feedback.objections.filter((o: any) => o.handledCorrectly === 'yes').length;

                                        return totalEvaluations > 0
                                            ? Math.round((correctEvaluations / totalEvaluations) * 100)
                                            : 0;
                                    })()}%
                                </div>
                                <div className="text-sm text-gray-700">
                                    Il tuo accuracy rate
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        disabled={step === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium disabled:opacity-50"
                    >
                        <ChevronLeft size={18} /> Indietro
                    </button>
                    <button
                        onClick={handleNext}
                        className="flex items-center gap-2 px-6 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600"
                    >
                        {step === totalSteps - 1 ? 'Salva e Chiudi' : 'Avanti'}
                        {step < totalSteps - 1 && <ChevronRight size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
