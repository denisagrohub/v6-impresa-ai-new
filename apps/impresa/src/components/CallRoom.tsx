"use client";
import { useEffect, useState, useRef } from 'react';
import Daily, { DailyCall } from '@daily-co/daily-js';
import PostCallWizard from './call/PostCallWizard';
import BPViewer from './call/BPViewer';
import {
    PhoneOff, Mic, MicOff, Video, VideoOff, Monitor,
    FileText, Award, Play, Lock, CheckCircle2, Clock,
    TrendingUp, X, Loader2, Brain, Settings
} from 'lucide-react';

interface CallRoomProps {
    projectId?: string; // Ora opzionale per call generiche
    projectName?: string;
    clientName: string;
    settore?: string;
    livello?: string;
    brand?: string;
    onClose: () => void;
    onStartPresentation?: () => void;
}

// ... (mantieni le interfacce Document, CaseStudy come sono)

export default function CallRoom({
    projectId = 'GENERIC', // Default per call senza progetto
    projectName = 'Call Conoscitiva',
    clientName, settore, livello, brand,
    onClose, onStartPresentation
}: CallRoomProps) {
    const callObject = useRef<DailyCall | null>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const [isJoined, setIsJoined] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [documents, setDocuments] = useState<any[]>([]);
    const [caseStudy, setCaseStudy] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<string[]>([]);
    const [newNote, setNewNote] = useState('');
    const [activeTab, setActiveTab] = useState<'docs' | 'case' | 'notes'>('docs');
    const [showPostCallWizard, setShowPostCallWizard] = useState(false);
    const [showBPViewer, setShowBPViewer] = useState(false);

    useEffect(() => {
        if (!isJoined) return;
        const interval = setInterval(() => setCallDuration(prev => prev + 1), 1000);
        return () => clearInterval(interval);
    }, [isJoined]);

    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            // ✅ FIX: Pulizia aggressiva per evitare "Duplicate Iframe"
            if (callObject.current) {
                try { await callObject.current.destroy(); } catch (e) { console.warn(e); }
                callObject.current = null;
            }
            if (videoContainerRef.current) {
                videoContainerRef.current.innerHTML = '';
            }

            if (isMounted) {
                await initDailyCall();
                await loadData();
            }
        };
        init();
        return () => {
            isMounted = false;
            if (callObject.current) {
                callObject.current.destroy().catch(console.warn);
                callObject.current = null;
            }
        };
    }, []);

    const loadData = async () => {
        try {
            // ✅ FIX: URL API corretto (rimosso /documents)
            const permRes = await fetch(`/api/consultant/call?projectId=${projectId}`);
            if (permRes.ok) {
                const permData = await permRes.json();
                setDocuments(permData.documents || []);
            }

            if (projectId !== 'GENERIC') {
                const csRes = await fetch('/api/consultant/call/case-study', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId, settore, livello, brand })
                });
                if (csRes.ok) {
                    const csData = await csRes.json();
                    setCaseStudy(csData.caseStudy);
                }
            }
        } catch (error) {
            console.error('Errore caricamento dati call:', error);
        }
    };

    const initDailyCall = async () => {
        try {
            setLoading(true);
            const roomRes = await fetch('/api/call/room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, consultantId: 'PART-004', duration: 60 })
            });
            const roomData = await roomRes.json();
            if (!roomData.success) throw new Error(roomData.error || 'Errore creazione room');

            const call = Daily.createCallObject({ startAudioOff: false, startVideoOff: false });
            callObject.current = call;

            call.on('joined-meeting', () => {
                setIsJoined(true);
                setLoading(false);
            });
            call.on('left-meeting', () => handleCallEnd());
            call.on('error', (err: any) => {
                setError(`Errore video call: ${err.errorMsg || err.message || 'Sconosciuto'}`);
                setLoading(false);
            });

            await call.join({ url: roomData.room.url, token: roomData.room.token });

            if (videoContainerRef.current) {
                const localParticipant = call.participants().local;
                if (localParticipant && localParticipant.tracks?.video?.track) {
                    const stream = new MediaStream([localParticipant.tracks.video.track]);
                    const videoElement = document.createElement('video');
                    videoElement.autoplay = true;
                    videoElement.muted = true;
                    videoElement.playsInline = true;
                    videoElement.style.width = '100%';
                    videoElement.style.height = '100%';
                    videoElement.style.objectFit = 'cover';
                    videoElement.style.borderRadius = '1rem';
                    videoElement.srcObject = stream;

                    videoContainerRef.current.innerHTML = '';
                    videoContainerRef.current.appendChild(videoElement);
                }
            }
        } catch (error: any) {
            console.error('Errore init Daily:', error);
            setError(error.message);
            setLoading(false);
        }
    };

    const handleCallEnd = () => {
        if (callObject.current) {
            callObject.current.leave();
            callObject.current.destroy().catch(console.warn);
            callObject.current = null;
        }
        setShowPostCallWizard(true);
    };

    // ... (mantieni toggleMute, toggleVideo, addNote, formatDuration come sono)

    if (loading) return (/* ... mantieni il tuo loading UI ... */ null);
    if (error) return (/* ... mantieni il tuo error UI ... */ null);

    return (
        <div className="fixed inset-0 bg-[#0a1628] z-50 flex flex-col">
            {/* HEADER */}
            <div className="bg-[#0f1f3d] border-b border-white/10 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-red-400 text-xs font-bold uppercase tracking-wider">In Call</span>
                    </div>
                    <div className="h-4 w-px bg-white/20" />
                    <div>
                        <div className="text-white font-bold text-sm">{projectName}</div>
                        <div className="text-gray-400 text-xs">Con {clientName} {settore && `• ${settore}`}</div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white" title="Chiudi">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col p-4">
                    <div ref={videoContainerRef} className="flex-1 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl relative overflow-hidden flex items-center justify-center" />
                    {/* Controlli (mantieni i tuoi bottoni mute/video/end) */}
                    <div className="flex items-center justify-center gap-3 mt-4">
                        <button onClick={() => { if (callObject.current) { const m = !isMuted; callObject.current.setLocalAudio(!m); setIsMuted(m); } }} className={`p-4 rounded-full ${isMuted ? 'bg-red-600' : 'bg-white/10'}`}>
                            {isMuted ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
                        </button>
                        <button onClick={handleCallEnd} className="px-6 py-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-2">
                            <PhoneOff size={20} /> Termina
                        </button>
                    </div>
                </div>
            </div>

            {showPostCallWizard && <PostCallWizard callData={{ callId: `call-${Date.now()}`, projectId, consultantId: 'PART-004', patterns: [], discProfile: '', kairosScore: 11, kairosQuadrant: 'KAIROS_AUTENTICO', objections: [] }} onComplete={() => { setShowPostCallWizard(false); onClose(); }} />}
        </div>
    );
}
