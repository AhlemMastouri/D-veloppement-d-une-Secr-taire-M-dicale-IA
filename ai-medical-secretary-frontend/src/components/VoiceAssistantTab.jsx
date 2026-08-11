import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, Globe, MessageSquare, Phone, PhoneOff,
  Zap, Brain, Languages, RefreshCw, CheckCircle, AlertTriangle, X,
  User, Bot, ChevronDown
} from 'lucide-react';

// ─── Language config ───────────────────────────────────────────────────────
const LANGUAGES = {
  fr: {
    code: 'fr-FR',
    label: 'Français',
    flag: '🇫🇷',
    ttsVoice: 'fr-FR',
    greeting: 'Bonjour ! Je suis votre secrétaire médicale IA. Comment puis-je vous aider aujourd\'hui ?',
    placeholder: 'Parlez ou tapez votre message…',
    examples: [
      'Je voudrais prendre un rendez-vous',
      'Comment annuler mon rendez-vous ?',
      'Quels sont les horaires du cabinet ?',
      'C\'est une urgence, j\'ai très mal à la poitrine',
    ],
    keywords: {
      appointment: ['rendez-vous', 'rdv', 'réserver', 'prendre', 'consulter'],
      cancel: ['annuler', 'annulation', 'supprimer'],
      emergency: ['urgence', 'douleur', 'mal', 'grave', 'poitrine', 'évanouissement'],
      hours: ['horaires', 'heures', 'ouvert', 'fermeture', 'disponible'],
      info: ['parking', 'adresse', 'paiement', 'prix', 'tarif', 'mutuelle'],
    },
    responses: {
      appointment: 'Je peux vous aider à réserver un rendez-vous. Souhaitez-vous consulter un médecin généraliste ou un spécialiste ? Quelles dates vous conviendraient ?',
      cancel: 'Pour annuler votre rendez-vous, j\'ai besoin de votre nom et de la date du rendez-vous. Pouvez-vous me donner ces informations ?',
      emergency: '⚠️ Je détecte une situation d\'urgence. Veuillez immédiatement composer le 15 (SAMU) ou le 112. Je transfère également votre appel à notre équipe médicale de garde.',
      hours: 'Le cabinet est ouvert du lundi au vendredi de 8h à 19h, et le samedi de 9h à 13h. Nous sommes fermés les dimanches et jours fériés.',
      info: 'Le cabinet est situé au 12 rue de la Santé, Paris. Nous acceptons les cartes bancaires, espèces, chèques et carte Vitale. Le parking Indigo est à 5 minutes à pied.',
      default: 'Je comprends votre demande. Un membre de notre équipe va vous prendre en charge. Y a-t-il autre chose que je puisse faire pour vous ?',
    },
  },
  en: {
    code: 'en-US',
    label: 'English',
    flag: '🇬🇧',
    ttsVoice: 'en-US',
    greeting: 'Hello! I\'m your AI medical secretary. How can I help you today?',
    placeholder: 'Speak or type your message…',
    examples: [
      'I\'d like to book an appointment',
      'How do I cancel my appointment?',
      'What are the office hours?',
      'It\'s urgent, I have chest pain',
    ],
    keywords: {
      appointment: ['appointment', 'book', 'schedule', 'reserve', 'consultation'],
      cancel: ['cancel', 'cancellation', 'delete', 'remove'],
      emergency: ['emergency', 'pain', 'chest', 'urgent', 'serious', 'faint'],
      hours: ['hours', 'schedule', 'open', 'close', 'available', 'timing'],
      info: ['parking', 'address', 'payment', 'price', 'insurance'],
    },
    responses: {
      appointment: 'I can help you book an appointment. Would you like to see a general practitioner or a specialist? What dates would suit you?',
      cancel: 'To cancel your appointment, I\'ll need your name and appointment date. Could you provide those details?',
      emergency: '⚠️ I detect an emergency situation. Please call 911 immediately or the emergency services. I\'m also transferring your call to our on-call medical team.',
      hours: 'The clinic is open Monday to Friday from 8am to 7pm, and Saturday from 9am to 1pm. We\'re closed on Sundays and public holidays.',
      info: 'The clinic is located at 12 rue de la Santé, Paris. We accept credit cards, cash, checks, and insurance cards. The Indigo parking lot is a 5-minute walk away.',
      default: 'I understand your request. A member of our team will take care of you shortly. Is there anything else I can help you with?',
    },
  },
  ar: {
    code: 'ar-SA',
    label: 'العربية',
    flag: '🇸🇦',
    ttsVoice: 'ar-SA',
    greeting: 'مرحبًا! أنا سكرتيرتك الطبية الذكية. كيف يمكنني مساعدتك اليوم؟',
    placeholder: 'تحدث أو اكتب رسالتك…',
    examples: [
      'أريد حجز موعد',
      'كيف أُلغي موعدي؟',
      'ما هي أوقات العمل؟',
      'هذه حالة طوارئ، أشعر بألم شديد',
    ],
    keywords: {
      appointment: ['موعد', 'حجز', 'استشارة', 'أريد'],
      cancel: ['إلغاء', 'حذف', 'أُلغي'],
      emergency: ['طوارئ', 'ألم', 'صدر', 'خطير', 'إغماء'],
      hours: ['أوقات', 'ساعات', 'مفتوح', 'مغلق', 'متاح'],
      info: ['عنوان', 'موقف', 'دفع', 'سعر', 'تأمين'],
    },
    responses: {
      appointment: 'يسعدني مساعدتك في حجز موعد. هل تريد استشارة طبيب عام أم أخصائي؟ ما هي التواريخ المناسبة لك؟',
      cancel: 'لإلغاء موعدك، أحتاج إلى اسمك وتاريخ الموعد. هل يمكنك تزويدي بهذه المعلومات؟',
      emergency: '⚠️ أكتشف حالة طوارئ. يرجى الاتصال فوراً بالإسعاف (15) أو (112). أقوم أيضاً بتحويل مكالمتك إلى الفريق الطبي المناوب.',
      hours: 'العيادة مفتوحة من الإثنين إلى الجمعة من 8 صباحاً حتى 7 مساءً، والسبت من 9 صباحاً حتى 1 ظهراً. مغلقة الأحد والعطل الرسمية.',
      info: 'العيادة تقع في 12 شارع لا سانتي، باريس. نقبل البطاقات البنكية والنقد والشيكات وبطاقة التأمين الصحي.',
      default: 'أفهم طلبك. سيتولى أحد أفراد فريقنا الاعتناء بك قريباً. هل هناك أي شيء آخر يمكنني مساعدتك فيه؟',
    },
  },
  it: {
    code: 'it-IT',
    label: 'Italiano',
    flag: '🇮🇹',
    ttsVoice: 'it-IT',
    greeting: 'Salve! Sono la vostra segreteria medica IA. Come posso aiutarla oggi?',
    placeholder: 'Parli o scriva il suo messaggio…',
    examples: [
      'Vorrei prenotare una visita',
      'Come posso annullare l\'appuntamento?',
      'Quali sono gli orari dello studio?',
      'È urgente, ho un forte dolore al petto',
    ],
    keywords: {
      appointment: ['appuntamento', 'prenotare', 'visita', 'consulto', 'prenotazione'],
      cancel: ['annullare', 'cancellare', 'disdire', 'annullamento'],
      emergency: ['urgenza', 'dolore', 'petto', 'grave', 'svenimento', 'urgente'],
      hours: ['orari', 'ore', 'aperto', 'chiuso', 'disponibile'],
      info: ['parcheggio', 'indirizzo', 'pagamento', 'prezzo', 'tariffa', 'mutua'],
    },
    responses: {
      appointment: 'Posso aiutarla a prenotare una visita. Preferisce un medico generico o uno specialista? Quali date le sarebbero più comode?',
      cancel: 'Per annullare il suo appuntamento, ho bisogno del suo nome e della data. Potrebbe fornirmi queste informazioni?',
      emergency: '⚠️ Rilevo una situazione di emergenza. Chiami immediatamente il 118 o il 112. Sto anche trasferendo la sua chiamata al nostro team medico di guardia.',
      hours: 'Lo studio è aperto dal lunedì al venerdì dalle 8:00 alle 19:00, e il sabato dalle 9:00 alle 13:00. Chiuso domenica e festivi.',
      info: 'Lo studio si trova in Via della Salute 12, Parigi. Accettiamo carte di credito, contanti, assegni e tessera sanitaria. Il parcheggio Indigo è a 5 minuti a piedi.',
      default: 'Comprendo la sua richiesta. Un membro del nostro team la assisterà a breve. C\'è altro in cui posso aiutarla?',
    },
  },
};

// ─── AI response engine ────────────────────────────────────────────────────
function getAIResponse(text, lang) {
  const config = LANGUAGES[lang];
  const lower = text.toLowerCase();
  const { keywords, responses } = config;

  for (const [intent, kws] of Object.entries(keywords)) {
    if (kws.some(kw => lower.includes(kw))) {
      return { intent, text: responses[intent] };
    }
  }
  return { intent: 'default', text: responses.default };
}

// ─── Browser speech helpers ────────────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;

export default function VoiceAssistantTab({ token }) {
  const [lang, setLang]             = useState('fr');
  const [callActive, setCallActive] = useState(false);
  const [listening, setListening]   = useState(false);
  const [speaking, setSpeaking]     = useState(false);
  const [muted, setMuted]           = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [inputText, setInputText]   = useState('');
  const [typingAI, setTypingAI]     = useState(false);
  const [permError, setPermError]   = useState('');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [memory, setMemory]         = useState({}); // simple context memory

  const recognitionRef = useRef(null);
  const scrollRef      = useRef(null);
  const config         = LANGUAGES[lang];

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, typingAI]);

  // TTS
  const speak = useCallback((text, langCode) => {
    if (muted || !synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode || config.code;
    utterance.rate = 0.92;
    utterance.pitch = 1.05;

    // Try to find a matching voice
    const voices = synth.getVoices();
    const match = voices.find(v =>
      v.lang.startsWith(langCode ? langCode.slice(0, 2) : lang) && v.localService
    ) || voices.find(v => v.lang.startsWith(langCode ? langCode.slice(0, 2) : lang));
    if (match) utterance.voice = match;

    utterance.onstart  = () => setSpeaking(true);
    utterance.onend    = () => setSpeaking(false);
    utterance.onerror  = () => setSpeaking(false);
    synth.speak(utterance);
  }, [muted, config.code, lang]);

  // Add message to transcript
  const addMessage = useCallback((sender, text, intent = null) => {
    setTranscript(prev => [...prev, {
      id: Date.now() + Math.random(),
      sender,
      text,
      intent,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    }]);
  }, []);

  // AI process
  const processUserInput = useCallback(async (text) => {
    if (!text.trim()) return;
    addMessage('user', text);
    setTypingAI(true);

    await new Promise(r => setTimeout(r, 900 + Math.random() * 600));

    const { intent, text: aiText } = getAIResponse(text, lang);

    // Update memory
    setMemory(prev => ({ ...prev, lastIntent: intent, lastInput: text }));

    setTypingAI(false);
    addMessage('ai', aiText, intent);
    speak(aiText, config.code);
  }, [lang, addMessage, speak, config.code]);

  // STT
  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setPermError('Votre navigateur ne supporte pas la reconnaissance vocale. Utilisez Chrome ou Edge.');
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = config.code;
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onerror  = (e) => {
      setListening(false);
      if (e.error === 'not-allowed') setPermError('Microphone refusé. Autorisez l\'accès au microphone dans votre navigateur.');
    };
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      processUserInput(text);
    };

    recognitionRef.current = rec;
    rec.start();
    setPermError('');
  }, [config.code, processUserInput]);

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const toggleMic = () => {
    if (listening) stopListening();
    else startListening();
  };

  const toggleMute = () => {
    if (!muted) synth?.cancel();
    setMuted(v => !v);
    setSpeaking(false);
  };

  // Start / end call
  const startCall = () => {
    setCallActive(true);
    setTranscript([]);
    setMemory({});
    setPermError('');
    setTimeout(() => {
      addMessage('ai', config.greeting, 'greeting');
      speak(config.greeting, config.code);
    }, 500);
  };

  const endCall = () => {
    stopListening();
    synth?.cancel();
    setSpeaking(false);
    setListening(false);
    setCallActive(false);
    setTranscript([]);
  };

  const changeLanguage = (newLang) => {
    setLang(newLang);
    setShowLangMenu(false);
    if (callActive) {
      stopListening();
      synth?.cancel();
      const greeting = LANGUAGES[newLang].greeting;
      setTimeout(() => {
        addMessage('ai', greeting, 'greeting');
        speak(greeting, LANGUAGES[newLang].code);
      }, 300);
    }
  };

  const handleSendText = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    if (!callActive) startCall();
    setTimeout(() => processUserInput(text), callActive ? 0 : 600);
  };

  const intentColor = (intent) => ({
    emergency: 'var(--danger)',
    appointment: 'var(--primary)',
    cancel: 'var(--warning)',
    hours: 'var(--success)',
    info: 'var(--secondary)',
    greeting: 'var(--primary)',
  }[intent] || 'var(--text-secondary)');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-slide-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '2rem' }}>🎙️</span>
            Assistant Vocal IA
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Secrétaire médicale multilingue — Compréhension naturelle, voix humaine, mémoire de conversation
          </p>
        </div>

        {/* Language selector */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-outline"
            style={{ gap: '8px', minWidth: '160px', justifyContent: 'space-between' }}
            onClick={() => setShowLangMenu(v => !v)}
          >
            <span>{config.flag} {config.label}</span>
            <ChevronDown size={14} />
          </button>
          {showLangMenu && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: '6px',
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: '12px', overflow: 'hidden', zIndex: 200, minWidth: '180px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.35)'
            }}>
              {Object.entries(LANGUAGES).map(([key, l]) => (
                <button
                  key={key}
                  onClick={() => changeLanguage(key)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '12px 18px', fontSize: '0.88rem', cursor: 'pointer',
                    background: lang === key ? 'rgba(14,165,233,0.12)' : 'transparent',
                    border: 'none', color: lang === key ? 'var(--primary)' : 'var(--text-primary)',
                    transition: 'background 0.15s'
                  }}
                >
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feature badges */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {[
          { icon: <Brain size={13} />, label: 'Langage naturel' },
          { icon: <Languages size={13} />, label: '4 langues' },
          { icon: <Zap size={13} />, label: 'Détection urgence' },
          { icon: <MessageSquare size={13} />, label: 'Mémoire conversation' },
          { icon: <Volume2 size={13} />, label: 'Voix humaine TTS' },
          { icon: <RefreshCw size={13} />, label: 'Interruption naturelle' },
        ].map(f => (
          <span key={f.label} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)',
            borderRadius: '20px', padding: '4px 12px', fontSize: '0.75rem', color: 'var(--primary)'
          }}>
            {f.icon} {f.label}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: callActive ? '1fr 320px' : '1fr', gap: '24px', transition: 'all 0.3s' }}>

        {/* Main call panel */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '520px' }}>

          {/* Call header bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {callActive && (
                <span className="pulse-active" style={{ width: '10px', height: '10px', borderRadius: '50%', background: speaking ? 'var(--primary)' : listening ? 'var(--danger)' : 'var(--success)', display: 'inline-block' }} />
              )}
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                {callActive
                  ? listening ? `${config.flag} Écoute en cours…`
                  : speaking ? `${config.flag} IA en train de parler…`
                  : `${config.flag} Appel actif — ${config.label}`
                  : `${config.flag} ${config.label} — En attente`
                }
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {callActive && (
                <button
                  className="btn btn-outline"
                  style={{ padding: '8px', color: muted ? 'var(--danger)' : 'var(--text-secondary)' }}
                  onClick={toggleMute}
                  title={muted ? 'Réactiver le son' : 'Couper le son'}
                >
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              )}
              {callActive ? (
                <button className="btn btn-danger" style={{ gap: '6px' }} onClick={endCall}>
                  <PhoneOff size={16} /> Terminer
                </button>
              ) : (
                <button className="btn btn-primary" style={{ gap: '6px' }} onClick={startCall}>
                  <Phone size={16} /> Démarrer l'appel
                </button>
              )}
            </div>
          </div>

          {/* Transcript area */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              padding: '8px 4px',
              background: 'rgba(0,0,0,0.15)',
              borderRadius: '12px',
              marginBottom: '16px',
              minHeight: '280px',
            }}
          >
            {transcript.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '12px', padding: '40px' }}>
                <span style={{ fontSize: '3rem' }}>🎙️</span>
                <p style={{ textAlign: 'center', fontSize: '0.9rem' }}>
                  {callActive ? 'Parlez ou tapez votre message ci-dessous…' : 'Démarrez l\'appel pour commencer la conversation avec l\'IA médicale'}
                </p>
                {!callActive && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
                    {config.examples.map(ex => (
                      <button key={ex} className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                        onClick={() => { if (!callActive) startCall(); setTimeout(() => processUserInput(ex), callActive ? 0 : 700); }}>
                        {ex}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {transcript.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px',
                      flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row'
                    }}>
                      {msg.sender === 'ai' ? <Bot size={13} color="var(--primary)" /> : <User size={13} />}
                      <span>{msg.sender === 'ai' ? 'IA Médicale' : 'Vous'}</span>
                      <span>·</span>
                      <span>{msg.time}</span>
                      {msg.intent && msg.intent !== 'default' && msg.intent !== 'greeting' && (
                        <span style={{ color: intentColor(msg.intent), fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                          #{msg.intent}
                        </span>
                      )}
                    </div>
                    <div style={{
                      maxWidth: '78%',
                      padding: '12px 16px',
                      borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                      background: msg.sender === 'user'
                        ? 'rgba(14,165,233,0.18)'
                        : msg.intent === 'emergency'
                          ? 'rgba(239,68,68,0.15)'
                          : 'var(--bg-sidebar)',
                      border: `1px solid ${msg.intent === 'emergency' ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                      color: msg.intent === 'emergency' ? 'var(--danger)' : 'var(--text-primary)',
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {typingAI && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px' }}>
                    <Bot size={14} color="var(--primary)" />
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[0, 1, 2].map(i => (
                        <span key={i} style={{
                          width: '7px', height: '7px', borderRadius: '50%',
                          background: 'var(--primary)', opacity: 0.7,
                          animation: `pulse 1s ease-in-out ${i * 0.2}s infinite`
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>L'IA rédige une réponse…</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Input row */}
          <form onSubmit={handleSendText} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Mic button */}
            {callActive && SpeechRecognition && (
              <button
                type="button"
                onClick={toggleMic}
                style={{
                  padding: '12px',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  background: listening ? 'var(--danger)' : 'rgba(14,165,233,0.15)',
                  color: listening ? '#fff' : 'var(--primary)',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
                title={listening ? 'Arrêter l\'écoute' : 'Parler'}
              >
                {listening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}

            <input
              className="form-control"
              style={{ flex: 1 }}
              placeholder={callActive ? config.placeholder : `Entrez un message pour démarrer (${config.label})`}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '10px 18px' }}
              disabled={!inputText.trim()}
            >
              Envoyer
            </button>
          </form>

          {permError && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--warning)', fontSize: '0.8rem' }}>
              <AlertTriangle size={14} /> {permError}
            </div>
          )}
        </div>

        {/* Info panel (visible when call active) */}
        {callActive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Quick phrases */}
            <div className="glass-card" style={{ padding: '18px' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Exemples rapides
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {config.examples.map(ex => (
                  <button
                    key={ex}
                    className="btn btn-outline"
                    style={{ justifyContent: 'flex-start', fontSize: '0.82rem', textAlign: 'left', padding: '8px 12px', whiteSpace: 'normal' }}
                    onClick={() => processUserInput(ex)}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Language switch */}
            <div className="glass-card" style={{ padding: '18px' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Changer de langue
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(LANGUAGES).map(([key, l]) => (
                  <button
                    key={key}
                    className="btn btn-outline"
                    style={{
                      justifyContent: 'flex-start', fontSize: '0.82rem', gap: '8px',
                      background: lang === key ? 'rgba(14,165,233,0.1)' : 'transparent',
                      borderColor: lang === key ? 'var(--primary)' : 'var(--border-color)',
                      color: lang === key ? 'var(--primary)' : 'var(--text-secondary)',
                    }}
                    onClick={() => changeLanguage(key)}
                  >
                    {l.flag} {l.label}
                    {lang === key && <CheckCircle size={13} style={{ marginLeft: 'auto' }} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Context memory */}
            {Object.keys(memory).length > 0 && (
              <div className="glass-card" style={{ padding: '18px' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Mémoire conversation
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                  {memory.lastIntent && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Dernier sujet :</span>
                      <span style={{ color: intentColor(memory.lastIntent), fontWeight: 600 }}>{memory.lastIntent}</span>
                    </div>
                  )}
                  {memory.lastInput && (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.76rem', marginTop: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                      « {memory.lastInput} »
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
