import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Bot, User, Mic, MicOff, FileText, Volume2, ShieldCheck,
  Loader2, Code2, Layers, Brain, MessageSquare, ChevronDown
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { usePrep } from '../context/PrepContext';
import './AIInterview.css';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const TOTAL_QUESTIONS = 6;
const API_BASE        = 'http://127.0.0.1:8000';
const PROCTOR_FRAME_INTERVAL  = 900;
const PROCTOR_FRAME_MAX_WIDTH = 320;

// Known FAANG/top-tier companies for special badge
const TECH_GIANTS = ['google', 'meta', 'microsoft', 'amazon', 'apple', 'netflix', 'uber', 'stripe', 'airbnb'];

const OPENING_QUESTION = (ctx) =>
  `Hi! I'm your AI interviewer today. I've reviewed the ${ctx.role || 'role'} position${ctx.company ? ` at ${ctx.company}` : ''}. Let's get started — can you briefly walk me through your background and what excites you about this opportunity?`;

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function isSpeechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate  = 0.9;
  utt.pitch = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('google'))
    || voices.find(v => v.lang === 'en-US')
    || voices[0];
  if (preferred) utt.voice = preferred;
  window.speechSynthesis.speak(utt);
}

function isTechGiant(company) {
  if (!company) return false;
  return TECH_GIANTS.some(g => company.toLowerCase().includes(g));
}

// Detect question type from text for the label badge
function detectQuestionType(text) {
  const t = text.toLowerCase();
  
  // Behavioral (STAR, past experience, tell me about a time)
  if (/tell me about|describe a time|give an example|walk me through|biggest|strength|weakness|challenge|conflict|leadership|team|motivation|why do you want|why this company|career goal/.test(t))
    return 'behavioral';
  
  // Technical Concepts (explain, how does X work, architecture)
  if (/explain|how does|how would|what is|describe how|architecture|system|distributed|database|api|microservice|cdn|cache|load balanc|scalability|performance|security/.test(t))
    return 'technical-concept';
  
  // Situational / Hypothetical (how would you handle, what would you do, trade-offs)
  if (/how would you|what would you|if you were|imagine you|suppose|scenario|situation|prioritize|trade-off|decision|choose between/.test(t))
    return 'situational';
  
  // Aptitude / Critical Thinking (estimate, puzzle, logic, problem-solving)
  if (/estimate|how many|puzzle|logic|brain teaser|calculate|figure out|problem-solving|think through/.test(t))
    return 'aptitude';
  
  // Past Experience (project deep-dive, specific work)
  if (/project|experience|worked on|built|developed|implemented|designed|your role|your contribution|challenge you faced/.test(t))
    return 'past-experience';
  
  return 'technical-concept'; // default
}

const Q_TYPE_META = {
  'behavioral':        { label: 'Behavioral',        icon: MessageSquare, color: '#34d399' },
  'technical-concept': { label: 'Technical Concept', icon: Brain,         color: '#a78bfa' },
  'situational':       { label: 'Situational',       icon: Layers,        color: '#38bdf8' },
  'aptitude':          { label: 'Aptitude',          icon: Code2,         color: '#fb923c' },
  'past-experience':   { label: 'Past Experience',   icon: FileText,      color: '#f472b6' },
};

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function AIInterview() {
  const location  = useLocation();
  const navigate  = useNavigate();  // eslint-disable-line no-unused-vars
  const { resumeName = '', jdName = '', company = '', role = '' } = location.state || {};

  const { addSession, resumeText = '', jdText = '' } = usePrep();
  const savedRef       = useRef(false);
  const hasDocContext  = !!(resumeText || jdText);
  const sessionLabel   = jdName || [company, role].filter(Boolean).join(' – ') || 'AI Interview';

  /* Chat / flow state */
  const [messages,       setMessages]       = useState([]);
  const [input,          setInput]          = useState('');
  const [qIndex,         setQIndex]         = useState(0);
  const [loading,        setLoading]        = useState(false);
  const [ended,          setEnded]          = useState(false);
  const [phase,          setPhase]          = useState('idle');
  const [currentQType,   setCurrentQType]   = useState('behavioral');
  const [companyStyle,   setCompanyStyle]   = useState(null);

  /* Voice state */
  const [isListening,    setIsListening]    = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micAvailable,   setMicAvailable]   = useState(isSpeechSupported());

  /* Thinking phrase */
  const [thinkingPhrase, setThinkingPhrase] = useState('');

  /* Rolling context */
  const historyRef    = useRef([]);
  const currentQRef   = useRef('');
  const recognitionRef = useRef(null);
  const bottomRef      = useRef();

  /* ── Proctoring state ─────────────────────────────────────────────────── */
  const [cameraActive,  setCameraActive]  = useState(false);
  const videoRef        = useRef(null);
  const streamRef       = useRef(null);
  const canvasRef       = useRef(null);
  const proctorSidRef   = useRef(null);
  const proctorLoopRef  = useRef(null);
  const proctorInFlight = useRef(false);
  const interviewStartedRef = useRef(false);

  /* ── Save session when done ──────────────────────────────────────────── */
  useEffect(() => {
    if (!ended || savedRef.current) return;
    savedRef.current = true;
    const now   = new Date();
    addSession({
      id:     Date.now(),
      type:   'AI Interview',
      topic: sessionLabel,
      score:  '—',
      pct:    null,
      date:   now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      dayKey: now.toISOString().slice(0, 10),
      status: 'Reviewed',
    });
  }, [ended, addSession, sessionLabel]);

  /* ── Request camera on mount ──────────────────────────────────────────── */
  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        setCameraActive(true);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [cameraActive]);

  /* ── Start proctoring frame loop ─────────────────────────────────────── */
  useEffect(() => {
    if (!cameraActive || !streamRef.current || interviewStartedRef.current) return;
    interviewStartedRef.current = true;

    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;
    let cancelled = false;

    async function startSession() {
      try {
        const res  = await fetch(`${API_BASE}/api/proctoring/start/`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'proctoring start failed');
        proctorSidRef.current = data.session_id;
      } catch (err) {
        console.warn('Proctoring session failed to start:', err.message);
        return;
      }
      scheduleFrame();
    }

    function scheduleFrame() {
      if (cancelled) return;
      proctorLoopRef.current = setTimeout(pushFrame, PROCTOR_FRAME_INTERVAL);
    }

    async function pushFrame() {
      if (cancelled || proctorInFlight.current || !proctorSidRef.current) {
        scheduleFrame(); return;
      }
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) {
        scheduleFrame(); return;
      }
      const scale = Math.min(1, PROCTOR_FRAME_MAX_WIDTH / video.videoWidth);
      canvas.width  = Math.round(video.videoWidth  * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      proctorInFlight.current = true;
      try {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
        if (blob && !cancelled && proctorSidRef.current) {
          const form = new FormData();
          form.append('session_id', proctorSidRef.current);
          form.append('frame', blob, 'frame.jpg');
          await fetch(`${API_BASE}/api/proctoring/frame/`, { method: 'POST', body: form });
        }
      } catch (_) {}
      finally { proctorInFlight.current = false; }
      scheduleFrame();
    }

    startSession();
    return () => { cancelled = true; clearTimeout(proctorLoopRef.current); };
  }, [cameraActive]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── First question on mount ─────────────────────────────────────────── */
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      const openingText = hasDocContext
        ? `Hi! I'm your AI interviewer today. I've reviewed your ${jdText ? 'job description' : 'prep context'}${resumeText ? ' along with your resume' : ''}. Let's get started — can you briefly walk me through your background and why you're a strong fit for this opportunity?`
        : OPENING_QUESTION({ company, role });
      currentQRef.current = openingText;
      setCurrentQType('behavioral');
      setMessages([{ role: 'ai', text: openingText, qType: 'behavioral' }]);
      setLoading(false);
      setTimeout(() => speak(openingText), 300);
    }, 1200);
  }, [company, role, hasDocContext, jdText, resumeText]);

  /* ── Auto-scroll ─────────────────────────────────────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, thinkingPhrase]);

  /* ── Set up SpeechRecognition ────────────────────────────────────────── */
  useEffect(() => {
    if (!isSpeechSupported()) { setMicAvailable(false); return; }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = 'en-US';

    rec.onresult = (e) => {
      let interim = '';
      let final   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      setLiveTranscript((prev) => prev + final || interim);
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') console.warn('SpeechRecognition error:', e.error);
      setIsListening(false);
    };

    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
  }, []);

  /* ── Toggle mic ──────────────────────────────────────────────────────── */
  const toggleMic = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInput((prev) => (prev + ' ' + liveTranscript).trim());
      setLiveTranscript('');
    } else {
      setLiveTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (_) {}
    }
  }, [isListening, liveTranscript]);

  /* ── Submit answer ───────────────────────────────────────────────────── */
  async function handleSend() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const answer = (input + ' ' + liveTranscript).trim();
    if (!answer || loading || ended) return;

    setInput('');
    setLiveTranscript('');

    const userMsg = { role: 'user', text: answer };
    setMessages((prev) => [...prev, userMsg]);

    historyRef.current.push({ q: currentQRef.current, a: answer });

    const nextQNum = qIndex + 1;

    if (nextQNum >= TOTAL_QUESTIONS) {
      clearTimeout(proctorLoopRef.current);
      if (proctorSidRef.current) {
        try {
          await fetch(`${API_BASE}/api/proctoring/stop/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: proctorSidRef.current }),
          });
        } catch (_) {}
        proctorSidRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setCameraActive(false);

      setLoading(true);
      setTimeout(() => {
        const closing = "Thank you for your time! That wraps up our session. You handled that well — your report will be on your dashboard shortly. Good luck!";
        setMessages((prev) => [...prev, { role: 'ai', text: closing, qType: 'behavioral' }]);
        speak(closing);
        setLoading(false);
        setEnded(true);
        setPhase('done');
      }, 1000);
      return;
    }

    setPhase('processing');
    setLoading(true);

    try {
      const res  = await fetch(`${API_BASE}/api/interview/next/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          role,
          company,
          resume_text: resumeText,
          jd_text: jdText,
          jd_name: jdName,
          last_answer:      answer,
          question_number:  nextQNum,
          total_questions:  TOTAL_QUESTIONS,
          history:          historyRef.current.slice(-4),
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error || 'API error');

      const { reaction, next_turn, thinking_phrase, company_style } = data;

      if (company_style) setCompanyStyle(company_style);

      setLoading(false);
      setThinkingPhrase(thinking_phrase || 'Hmm…');
      setPhase('thinking');

      const thinkDelay = 2000 + Math.random() * 1500;

      setTimeout(() => {
        setThinkingPhrase('');

        if (reaction) {
          setMessages((prev) => [...prev, { role: 'ai', text: reaction, isReaction: true }]);
          speak(reaction);
        }

        setTimeout(() => {
          setPhase('idle');
          currentQRef.current = next_turn;
          setQIndex(nextQNum);
          const qType = detectQuestionType(next_turn);
          setCurrentQType(qType);
          setMessages((prev) => [...prev, { role: 'ai', text: next_turn, qType }]);
          setTimeout(() => speak(next_turn), reaction ? 800 : 0);
        }, reaction ? 1200 : 0);

      }, thinkDelay);

    } catch (err) {
      console.error('interview_next error:', err);
      setLoading(false);
      setThinkingPhrase('');
      setPhase('idle');
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: "Sorry, I had a connection issue. Please type your answer and try again." },
      ]);
    }
  }

  const isInputBlocked = loading || ended || phase === 'thinking';
  const progress       = Math.round((qIndex / (TOTAL_QUESTIONS - 1)) * 100);
  const canSend        = !isInputBlocked && (input.trim().length > 0 || liveTranscript.trim().length > 0);
  const isFAANG        = isTechGiant(company);
  const qTypeMeta      = Q_TYPE_META[currentQType] || Q_TYPE_META['technical'];
  const QTypeIcon      = qTypeMeta.icon;

  /* ──────────────────────────────────────────────────────────────────────── */
  return (
    <div className="iv-root">
      <Navbar />
      <div className="iv-container">

        {/* ── Header ── */}
        <div className="iv-header">
          <div className="iv-header-left">
            <Link to="/dashboard" className="back-link">← Exit</Link>
            <div className="iv-session-info">
              <span className="iv-badge">
                <Mic size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                AI Interview
              </span>
              {isFAANG && (
                <span className="iv-faang-badge">
                  {companyStyle || company}
                </span>
              )}
              {jdName && (
                <span className="iv-company">{jdName}</span>
              )}
              {!jdName && company && !isFAANG && <span className="iv-company">{company} · {role}</span>}
              {!jdName && company && isFAANG && role && <span className="iv-company">{role}</span>}
              {resumeName && (
                <span className="iv-resume">
                  <FileText size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                  {resumeName}
                </span>
              )}
            </div>
          </div>

          <div className="iv-header-right">
            <span className="iv-tts-badge">
              <Volume2 size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
              Voice On
            </span>
            <div className="iv-progress-wrap">
              <span className="iv-progress-label">Q{qIndex + 1} / {TOTAL_QUESTIONS}</span>
              <div className="iv-progress-bar">
                <div className="iv-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Question type indicator ── */}
        {!ended && (
          <div className="iv-qtype-bar">
            <span className="iv-qtype-pill" style={{ '--qtype-color': qTypeMeta.color }}>
              <QTypeIcon size={12} strokeWidth={2} />
              {qTypeMeta.label}
            </span>
            {isFAANG && (
              <span className="iv-qtype-hint">
                Oral interview — behavioral, technical concepts, past experience, situational, aptitude
              </span>
            )}
          </div>
        )}

        {/* ── Chat ── */}
        <div className="iv-chat">
          {messages.map((m, i) => (
            <div key={i} className={`iv-msg iv-msg-${m.role}`}>
              <div className={`iv-avatar ${m.role === 'ai' ? 'avatar-ai' : 'avatar-user'}`}>
                {m.role === 'ai' ? <Bot size={16} strokeWidth={1.75} /> : <User size={16} strokeWidth={1.75} />}
              </div>
              <div className="iv-msg-body">
                {m.role === 'ai' && m.qType && !m.isReaction && (
                  <span className="iv-msg-qtype" style={{ '--qtype-color': (Q_TYPE_META[m.qType] || Q_TYPE_META['technical']).color }}>
                    {(Q_TYPE_META[m.qType] || Q_TYPE_META['technical']).label}
                  </span>
                )}
                <div className={`iv-bubble${m.isReaction ? ' iv-bubble--reaction' : ''}`}>{m.text}</div>
              </div>
            </div>
          ))}

          {thinkingPhrase && (
            <div className="iv-msg iv-msg-ai">
              <div className="iv-avatar avatar-ai"><Bot size={16} strokeWidth={1.75} /></div>
              <div className="iv-msg-body">
                <div className="iv-bubble iv-thinking-phrase">{thinkingPhrase}</div>
              </div>
            </div>
          )}

          {loading && (
            <div className="iv-msg iv-msg-ai">
              <div className="iv-avatar avatar-ai"><Bot size={16} strokeWidth={1.75} /></div>
              <div className="iv-msg-body">
                <div className="iv-bubble iv-typing"><span /><span /><span /></div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input area ── */}
        {!ended ? (
          <div className="iv-input-area">

            {(isListening || liveTranscript) && (
              <div className="iv-live-transcript">
                <span className="iv-live-dot" />
                <span>{liveTranscript || 'Listening…'}</span>
              </div>
            )}

            <div className="iv-input-row">
              {micAvailable && (
                <button
                  id="iv-mic-btn"
                  className={`iv-mic-btn ${isListening ? 'recording' : ''}`}
                  onClick={toggleMic}
                  disabled={isInputBlocked}
                  title={isListening ? 'Stop recording' : 'Start voice answer'}
                >
                  {isListening ? <MicOff size={20} strokeWidth={2} /> : <Mic size={20} strokeWidth={2} />}
                </button>
              )}

              <textarea
                id="iv-answer-textarea"
                className="iv-textarea"
                rows={3}
                placeholder={
                  micAvailable
                    ? 'Speak using the mic, or type your answer here… (Enter to send)'
                    : 'Type your answer here… (Enter to send, Shift+Enter for new line)'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                disabled={isInputBlocked}
              />

              <button
                id="iv-send-btn"
                className="iv-send-btn"
                onClick={handleSend}
                disabled={!canSend}
              >
                Send →
              </button>
            </div>

            {phase === 'thinking' && (
              <p className="iv-status-hint">Interviewer is typing…</p>
            )}
          </div>
        ) : (
          <div className="iv-ended-bar">
            <span>Interview complete. Your report is ready on the dashboard.</span>
            <Link to="/dashboard" className="iv-dash-btn">Go to Dashboard →</Link>
          </div>
        )}

      </div>

      {/* Floating camera preview */}
      {cameraActive && (
        <div className="iv-proctor-cam-wrap">
          <video ref={videoRef} autoPlay muted playsInline className="iv-proctor-cam-video" />
          <div className="iv-proctor-cam-bar">
            <ShieldCheck size={10} strokeWidth={2.5} />
            <span>Proctored · Live</span>
          </div>
        </div>
      )}

    </div>
  );
}
