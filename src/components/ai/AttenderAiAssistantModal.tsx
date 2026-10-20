import React, { useState, useEffect, useRef } from 'react';
import { Patient, UserRole } from '../../types';
import { HospitalMapView } from '../navigation/HospitalMapView';
import { careAiService, processCareAiQuery, CareAiResponse } from '../../services/careAiService';
import { useCareAiLanguage, getSpeechLocale } from '../../i18n';
import {
  Bot,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  MapPin,
  X,
  ArrowRight,
  Footprints,
  Clock,
  Heart,
  Pill,
  Compass,
  AlertTriangle,
  Radio,
  Square,
  ShieldCheck,
  CheckCircle2,
  ShieldAlert,
  PhoneCall,
  User,
} from 'lucide-react';

export { processCareAiQuery };

interface AttenderAiAssistantModalProps {
  patient?: Patient;
  isOpen: boolean;
  onClose: () => void;
  role?: UserRole;
  doctorId?: string;
  onCallNurse?: () => void;
  onOpenMeds?: () => void;
  onOpenDoctor?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  responsePayload?: CareAiResponse;
}

export const AttenderAiAssistantModal: React.FC<AttenderAiAssistantModalProps> = ({
  patient,
  isOpen,
  onClose,
  role = 'attender',
  doctorId,
  onCallNurse,
  onOpenMeds,
  onOpenDoctor,
}) => {
  const { careAiLanguage, setCareAiLanguage, supportedLanguages, t } = useCareAiLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: t('careAi.welcomeMessage'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [voiceStatus, setVoiceStatus] = useState<'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING'>('IDLE');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [showMapView, setShowMapView] = useState(false);
  const [mapOriginId, setMapOriginId] = useState('ROOM_ICU_204');
  const [mapDestId, setMapDestId] = useState('ROOM_11002');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Initialize and update context with active patient
  useEffect(() => {
    if (patient) {
      careAiService.setContext({ patient });
    }
  }, [patient]);

  // Keep chat scrolled smoothly to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, voiceStatus]);

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Initialize Web Speech Recognition with language awareness
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.lang = getSpeechLocale(careAiLanguage);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recognition.onresult = (event: any) => {
            const transcript = event.results?.[0]?.[0]?.transcript;
            if (transcript) {
              handleSendMessage(transcript);
            }
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recognition.onerror = (e: any) => {
            setVoiceStatus('IDLE');
            if (e.error === 'not-allowed') {
              setErrorMessage(t('careAi.permissionDenied'));
            }
          };

          recognition.onend = () => {
            setVoiceStatus((prev) => (prev === 'LISTENING' ? 'IDLE' : prev));
          };

          recognitionRef.current = recognition;
        } catch {
          // Speech recognition init failed gracefully
        }
      }
    }
  }, [careAiLanguage, t]);

  // Voice output using locale matching algorithm
  const speakText = (text: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      // Clean speech text of markdown formatting, code blocks, links, and symbols
      const cleanText = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`.*?`/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[•*#_~|>[\]]/g, ' ')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const exactSpeechLocale = getSpeechLocale(careAiLanguage);
      utterance.lang = exactSpeechLocale;
      const targetLocale = exactSpeechLocale.toLowerCase();

      // Locale-matching algorithm: match exact locale -> match language prefix -> regional English -> default
      const voices = window.speechSynthesis.getVoices();
      const matchedVoice =
        voices.find((v) => v.lang.toLowerCase() === targetLocale) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(targetLocale.split('-')[0])) ||
        voices.find((v) => v.lang.toLowerCase().includes('in')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en'));

      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onstart = () => setVoiceStatus('SPEAKING');
      utterance.onend = () => setVoiceStatus('IDLE');
      utterance.onerror = () => setVoiceStatus('IDLE');
      window.speechSynthesis.speak(utterance);
    } catch {
      setVoiceStatus('IDLE');
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setVoiceStatus('IDLE');
  };

  const toggleVoiceListening = () => {
    setErrorMessage(null);
    if (!recognitionRef.current) {
      setErrorMessage(t('careAi.unsupportedVoice'));
      return;
    }

    if (voiceStatus === 'LISTENING') {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setVoiceStatus('IDLE');
      stopSpeaking();
    } else {
      stopSpeaking();
      try {
        recognitionRef.current.lang = getSpeechLocale(careAiLanguage);
        recognitionRef.current.start();
        setVoiceStatus('LISTENING');
      } catch {
        setVoiceStatus('IDLE');
      }
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputQuery).trim();
    if (!text) return;

    setErrorMessage(null);
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setVoiceStatus('PROCESSING');

    setTimeout(() => {
      const response = careAiService.processQuery(text, patient, careAiLanguage, role, doctorId);
      const assistantMsg: ChatMessage = {
        id: 'reply-' + Date.now(),
        sender: 'assistant',
        text: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        responsePayload: response,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      speakText(response.reply);
    }, 300);
  };

  const handleOpenMap = (origin?: string, dest?: string) => {
    if (origin) setMapOriginId(origin);
    if (dest) setMapDestId(dest);
    setShowMapView(true);
  };

  const handleActionClick = (actionType: string) => {
    switch (actionType) {
      case 'CALL_NURSE':
        if (onCallNurse) {
          onClose();
          onCallNurse();
        } else {
          handleSendMessage('Please call the duty nurse immediately');
        }
        break;
      case 'VIEW_MEDS':
        if (onOpenMeds) {
          onClose();
          onOpenMeds();
        } else {
          handleSendMessage('What medications are scheduled?');
        }
        break;
      case 'VIEW_DOCTOR':
        if (onOpenDoctor) {
          onClose();
          onOpenDoctor();
        } else {
          handleSendMessage('Who is the attending doctor?');
        }
        break;
      case 'VIEW_SUMMARY':
        handleSendMessage('Generate patient summary');
        break;
      case 'VIEW_MAP':
        handleOpenMap();
        break;
    }
  };

  const quickActions =
    role === 'doctor'
      ? [
          { label: '📋 ' + (t('doctor.patientSummary') || 'Patient Summary'), query: 'Generate patient summary' },
          { label: '❤️ ' + t('careAi.quickVitals'), query: 'What are the latest vitals?' },
          { label: '📈 Vital Trends', query: 'Interpret vital trends' },
          { label: '💊 ' + t('careAi.quickMeds'), query: 'What medications are scheduled?' },
          { label: '🕒 Recent Timeline', query: 'Synthesize recent clinical timeline' },
        ]
      : [
          { label: t('careAi.quickWhereAmI'), query: 'Where am I?' },
          { label: t('careAi.quickVitals'), query: 'What are the latest vitals?' },
          { label: t('careAi.quickMeds'), query: 'What medications are scheduled?' },
          { label: `👨‍⚕️ ${t('common.doctor')}`, query: 'Who is the attending doctor?' },
          { label: t('careAi.quickCardiology'), query: 'Where is Cardiology Room 11002?' },
          { label: t('careAi.quickPharmacy'), query: 'Where is the pharmacy?' },
        ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/65 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="clinical-modal-enter flex h-[min(92dvh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:h-[86vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="careai-modal-title"
      >
        
        {/* ================================================================ */}
        {/* FIXED HEADER: Identity, Patient Context, Voice State & Controls  */}
        {/* ================================================================ */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-3 text-white sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-400/15 text-blue-200">
                <Bot className="h-5 w-5" />
              </div>
              {voiceStatus === 'LISTENING' && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 id="careai-modal-title" className="text-base font-semibold leading-none tracking-tight text-white sm:text-lg">
                  CareAI
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-300/25 bg-blue-300/10 px-2 py-0.5 text-xs font-medium text-blue-100">
                  <Sparkles className="h-3 w-3" /> Voice & text
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-slate-300">
                {role === 'doctor'
                  ? 'Clinical documentation assistance'
                  : 'Hospital assistance'}
                {patient && ` • ${patient.name} (${patient.room})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Decoupled CareAI Independent Language Selector */}
            <select
              value={careAiLanguage}
              onChange={(e) => setCareAiLanguage(e.target.value)}
              aria-label="CareAI conversation language"
              className="hidden sm:inline-block bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-2.5 py-2 font-medium focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {supportedLanguages.map((l) => (
                <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                  {l.nativeName} ({l.name})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setTtsEnabled(!ttsEnabled)}
              title={ttsEnabled ? 'Mute AI Voice' : 'Enable AI Voice'}
              aria-label={ttsEnabled ? 'Mute AI voice output' : 'Enable AI voice output'}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg border transition-colors ${
                ttsEnabled
                  ? 'bg-white/20 text-white border-white/30 hover:bg-white/30'
                  : 'bg-white/10 text-blue-300 border-transparent hover:bg-white/20'
              }`}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-transparent text-white transition-colors hover:border-white/20 hover:bg-white/10"
              aria-label="Close CareAI assistant modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================================================================ */}
        {/* QUICK CONTEXT CHIPS (Part 1 & Part 25)                           */}
        {/* ================================================================ */}
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-950/70 sm:px-6">
          <span className="hidden shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400 sm:inline">
            Suggested questions
          </span>
          {quickActions.map((qa, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(qa.query)}
              className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
            >
              {qa.label}
            </button>
          ))}
        </div>

        {/* ================================================================ */}
        {/* SCROLLABLE CHAT MESSAGES BODY                                    */}
        {/* ================================================================ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            const payload = m.responsePayload;

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
              >
                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 shadow-xs ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 rounded-bl-xs'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-line">{m.text}</p>
                </div>

                {/* -------------------------------------------------------- */}
                {/* DEDICATED RESPONSE CARD: ROUTE (Part 1 & 3)             */}
                {/* -------------------------------------------------------- */}
                {!isUser && payload?.cardType === 'ROUTE' && payload.routeData && (
                  <div className="mt-2.5 max-w-[92%] sm:max-w-[82%] bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800/60 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700/80 pb-2.5 mb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          <Compass className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                            {payload.routeData.destName}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Floor {payload.routeData.floor} • {payload.routeData.wing}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                          <Footprints className="w-3.5 h-3.5" />
                          ~{payload.routeData.distanceMeters} m ({payload.routeData.estimatedMinutes} min)
                        </span>
                      </div>
                    </div>

                    {/* Step-by-Step Instructions */}
                    {payload.routeData.instructions.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          {t('careAi.steps')}:
                        </p>
                        <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-decimal list-inside pl-1">
                          {payload.routeData.instructions.map((step, idx) => (
                            <li key={idx} className="leading-snug">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Map CTA Button */}
                    <button
                      onClick={() => handleOpenMap(payload.originId, payload.destId)}
                      className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <MapPin className="w-4 h-4" />
                      {t('careAi.openMap')}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* DEDICATED RESPONSE CARD: VITALS (Part 1 & 3)             */}
                {/* -------------------------------------------------------- */}
                {!isUser && payload?.cardType === 'VITALS' && payload.vitalData && (
                  <div className="mt-2.5 max-w-[92%] sm:max-w-[82%] bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-900/60 p-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {payload.vitalData.patientName} — Clinical Telemetry
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {payload.vitalData.recordedAt}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700">
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Blood Pressure</span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{payload.vitalData.bp}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700">
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Pulse Rate</span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{payload.vitalData.pulse} bpm</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700">
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">SpO2 Saturation</span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{payload.vitalData.spO2}%</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700">
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Temperature</span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{payload.vitalData.tempF}</span>
                      </div>
                    </div>

                    <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 italic">
                      {t('common.disclaimer')}
                    </p>
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* DEDICATED RESPONSE CARD: MEDICATIONS (Part 1 & 3)        */}
                {/* -------------------------------------------------------- */}
                {!isUser && payload?.cardType === 'MEDICATIONS' && payload.medicationData && (
                  <div className="mt-2.5 max-w-[92%] sm:max-w-[82%] bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-900/60 p-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/80 pb-2 mb-2.5">
                      <Pill className="w-4 h-4 text-emerald-600" />
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                          Prescribed Medication Schedule
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          Attending: Dr. {payload.medicationData.doctorName}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {payload.medicationData.items.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 dark:bg-slate-900/40 border border-emerald-100 dark:border-emerald-900/30 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{m.name}</span>{' '}
                            <span className="text-slate-500 dark:text-slate-400">({m.dosage})</span>
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                              {m.frequency} • Scheduled: {m.scheduledTime}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 uppercase">
                            {m.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* DEDICATED RESPONSE CARD: PRESCRIPTION RESTRICTION (Sec 6) */}
                {/* -------------------------------------------------------- */}
                {!isUser && payload?.cardType === 'PRESCRIPTION_RESTRICTED' && (
                  <div className="mt-2.5 max-w-[92%] sm:max-w-[82%] bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-800/70 p-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-amber-200 dark:border-amber-800/60 pb-2 mb-2.5">
                      <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
                          Clinical Safety & Prescribing Boundary
                        </span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-300">
                          Attenders cannot alter medications • Physician authorization required
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-amber-900/90 dark:text-amber-200 leading-relaxed mb-3">
                      CareAI can explain currently prescribed drugs, but will never prescribe or recommend new medicines or dosage adjustments.
                    </p>

                    {payload.actions && payload.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-800/60">
                        {payload.actions.map((act, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleActionClick(act.actionType)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-2xs cursor-pointer"
                          >
                            {act.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* DEDICATED RESPONSE CARD: SAFETY & DIAGNOSIS WARNING      */}
                {/* -------------------------------------------------------- */}
                {!isUser && payload?.cardType === 'SAFETY_WARNING' && (
                  <div className="mt-2.5 max-w-[92%] sm:max-w-[82%] bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-300 dark:border-rose-800/70 p-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-rose-200 dark:border-rose-800/60 pb-2 mb-2.5">
                      <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-rose-900 dark:text-rose-200 block">
                          Scope & Clinical Safety Notice
                        </span>
                        <span className="text-[10px] text-rose-700 dark:text-rose-300">
                          Non-diagnostic bedside guidance • Role-based authorization
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-rose-900/90 dark:text-rose-200 leading-relaxed mb-3">
                      CareAI provides supportive bedside information and cannot diagnose medical diseases or clinical pathology. Always consult the clinical team.
                    </p>

                    {payload.actions && payload.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-rose-200/60 dark:border-rose-800/60">
                        {payload.actions.map((act, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleActionClick(act.actionType)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition-colors cursor-pointer"
                          >
                            {act.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* DEDICATED RESPONSE CARD: DOCTOR CLINICAL SUMMARY (Sec 10) */}
                {/* -------------------------------------------------------- */}
                {!isUser && payload?.cardType === 'CLINICAL_SUMMARY' && payload.clinicalSummaryData && (
                  <div className="mt-2.5 max-w-[95%] sm:max-w-[88%] bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800/70 p-4 shadow-md space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          AI Clinical Documentation Draft
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {payload.clinicalSummaryData.latestVitalsSummary.recordedAt}
                      </span>
                    </div>

                    {/* Patient Overview */}
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg text-xs text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-200/60 dark:border-slate-800">
                      <strong className="text-slate-900 dark:text-white block mb-0.5">PATIENT OVERVIEW:</strong>
                      {payload.clinicalSummaryData.patientOverview}
                    </div>

                    {/* Current Status */}
                    <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-lg text-xs text-blue-900 dark:text-blue-200 leading-relaxed border border-blue-200 dark:border-blue-900/60">
                      <strong className="block mb-0.5">CURRENT STATUS:</strong>
                      {payload.clinicalSummaryData.currentStatus}
                    </div>

                    {/* Vital Trends */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">VITAL TRENDS:</span>
                      <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5 list-disc list-inside">
                        {payload.clinicalSummaryData.vitalTrends.map((trend, i) => (
                          <li key={i}>{trend}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Medications */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">MEDICATIONS OVERVIEW:</span>
                      <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5 list-disc list-inside">
                        {payload.clinicalSummaryData.medicationsOverview.map((med, i) => (
                          <li key={i}>{med}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Items for Review */}
                    {payload.clinicalSummaryData.potentialItemsForReview.length > 0 && (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200">
                        <strong className="block mb-0.5">ITEMS REQUIRING CLINICAL REVIEW:</strong>
                        <ul className="space-y-0.5 list-disc list-inside">
                          {payload.clinicalSummaryData.potentialItemsForReview.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action buttons if available */}
                    {payload.actions && payload.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                        {payload.actions.map((act, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleActionClick(act.actionType)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            {act.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Disclaimer Banner */}
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic pt-1 border-t border-slate-100 dark:border-slate-800">
                      {payload.clinicalSummaryData.disclaimer}
                    </p>
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* FALLBACK DIRECTORY ACTIONS (Part 18)                     */}
                {/* -------------------------------------------------------- */}
                {!isUser && payload?.cardType === 'UNKNOWN' && (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-w-[92%] sm:max-w-[82%]">
                    <button
                      onClick={() => handleSendMessage('Where is Cardiology Room 11002?')}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs hover:bg-blue-100 font-medium"
                    >
                      🗺 Cardiology 11002
                    </button>
                    <button
                      onClick={() => handleSendMessage('Where is the pharmacy?')}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs hover:bg-blue-100 font-medium"
                    >
                      🏥 Pharmacy
                    </button>
                    <button
                      onClick={() => handleSendMessage('What are the latest vitals?')}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs hover:bg-blue-100 font-medium"
                    >
                      ❤️ Vitals (°F)
                    </button>
                    <button
                      onClick={() => handleSendMessage('What medications are scheduled?')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs hover:bg-emerald-100 font-medium"
                    >
                      💊 Medications
                    </button>
                  </div>
                )}

                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-1">
                  {m.timestamp}
                </span>
              </div>
            );
          })}

          <div ref={chatBottomRef} />
        </div>

        {/* ================================================================ */}
        {/* VOICE / STATUS BANNER                                            */}
        {/* ================================================================ */}
        {voiceStatus === 'SPEAKING' && (
          <div className="px-4 py-2 bg-blue-100 dark:bg-blue-950/60 border-t border-blue-200 dark:border-blue-800/60 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
            <span className="flex items-center gap-2 font-medium">
              <Volume2 className="w-4 h-4 text-blue-600 animate-pulse" />
              {t('careAi.speaking')}
            </span>
            <button
              onClick={stopSpeaking}
              className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1 shadow-2xs"
            >
              <Square className="w-3 h-3 fill-white" />
              {t('careAi.stopSpeaking')}
            </button>
          </div>
        )}

        {voiceStatus === 'LISTENING' && (
          <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/60 border-t border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
            <span className="flex items-center gap-2 font-medium animate-pulse">
              <Radio className="w-4 h-4 text-rose-600" />
              {t('careAi.listening')}
            </span>
            <button
              onClick={toggleVoiceListening}
              className="px-2.5 py-0.5 rounded bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 text-[11px] font-medium"
            >
              Cancel
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/60 border-t border-amber-200 dark:border-amber-900/60 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-amber-600 hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* ================================================================ */}
        {/* FIXED COMPOSER (Input, Voice button, Send button)                */}
        {/* ================================================================ */}
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Microphone Button with animated state */}
            <button
              type="button"
              onClick={toggleVoiceListening}
              className={`p-3 rounded-xl transition-all shrink-0 flex items-center justify-center ${
                voiceStatus === 'LISTENING'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30 scale-105 animate-pulse'
                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800'
              }`}
              title={voiceStatus === 'LISTENING' ? 'Stop Listening' : 'Speak to CareAI'}
              aria-label="Voice input"
            >
              {voiceStatus === 'LISTENING' ? (
                <MicOff className="w-5 h-5 text-white" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {/* Query Input */}
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={t('careAi.inputPlaceholder')}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputQuery.trim() || voiceStatus === 'PROCESSING'}
              className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white disabled:text-slate-500 dark:disabled:text-slate-600 transition-colors shadow-xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

      </div>

      {/* Embedded Hospital Map Modal when requested */}
      {showMapView && (
        <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-5xl my-auto">
            <HospitalMapView
              initialOriginId={mapOriginId}
              initialDestinationId={mapDestId}
              onClose={() => setShowMapView(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
