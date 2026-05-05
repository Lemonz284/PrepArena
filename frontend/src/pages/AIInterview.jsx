import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Bot, User, Mic, MicOff, FileText, Volume2, ShieldCheck,
  Loader2, Code2, Layers, Brain, MessageSquare, ChevronDown, Camera, CameraOff, Download, AlertTriangle
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

function CameraCheckScreen({ topic, difficulty, count, checkVideoRef, camState, camError, onStart }) {
  return (
    <div className="iv-root">
      <Navbar />
      <div className="cam-check-shell">
        <div className="cam-check-card">
          <div className="cam-check-header">
            <ShieldCheck size={22} strokeWidth={2} className="cam-check-icon" />
            <h2 className="cam-check-title">Camera Check</h2>
            <p className="cam-check-subtitle">
              This interview is <strong>proctored</strong>. Camera access is required to start.
            </p>
          </div>

          <div className="cam-check-preview-wrap">
            <video
              ref={checkVideoRef}
              autoPlay
              muted
              playsInline
              className={`cam-check-feed ${camState === 'granted' ? 'cam-active' : ''}`}
            />
            {camState !== 'granted' && (
              <div className="cam-check-overlay">
                {camState === 'requesting' && (
                  <>
                    <Loader2 size={28} strokeWidth={1.5} className="cam-spin" />
                    <span>Waiting for camera permission…</span>
                  </>
                )}
                {camState === 'denied' && (
                  <>
                    <CameraOff size={28} strokeWidth={1.5} style={{ color:'#f87171' }} />
                    <span style={{ color:'#f87171' }}>Camera blocked</span>
                    <span className="cam-check-err-detail">{camError || 'Permission was denied'}</span>
                  </>
                )}
              </div>
            )}
            {camState === 'granted' && (
              <div className="cam-check-live-badge">
                <span className="cam-live-dot" />
                Live Preview
              </div>
            )}
          </div>

          <div className={`cam-status-row ${camState === 'granted' ? 'cam-ok' : camState === 'denied' ? 'cam-err' : 'cam-wait'}`}>
            {camState === 'granted'    && <><Camera    size={14} strokeWidth={2} /> Camera ready — face visible in frame before starting</>}
            {camState === 'requesting' && <><Loader2   size={14} strokeWidth={2} className="cam-spin" /> Requesting camera access…</>}
            {camState === 'denied'     && <><CameraOff size={14} strokeWidth={2} /> Camera blocked — enable access to continue</>}
          </div>

          <div className="cam-check-meta">
            <div className="cam-meta-item">
              <span className="cam-meta-label">Topic</span>
              <span className="cam-meta-val">{topic}</span>
            </div>
            <div className="cam-meta-divider" />
            <div className="cam-meta-item">
              <span className="cam-meta-label">Difficulty</span>
              <span className="cam-meta-val">{difficulty}</span>
            </div>
            <div className="cam-meta-divider" />
            <div className="cam-meta-item">
              <span className="cam-meta-label">Questions</span>
              <span className="cam-meta-val">{count}</span>
            </div>
          </div>

          <div className="cam-check-actions">
            <button
              className="nav-btn submit-btn cam-start-btn"
              onClick={onStart}
              disabled={camState !== 'granted'}
            >
              {camState === 'granted' ? '🚀 Begin Interview' : 'Waiting for camera…'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [phase,          setPhase]          = useState('cam-check');
  const [camState,       setCamState]       = useState('requesting');
  const [camError,       setCamError]       = useState(null);
  const [currentQType,   setCurrentQType]   = useState('behavioral');
  const [companyStyle,   setCompanyStyle]   = useState(null);
  const [reviewData,     setReviewData]     = useState(null);
  const [proctorResult,  setProctorResult]  = useState(null);

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
  const checkVideoRef  = useRef(null);

  /* ── Proctoring state ─────────────────────────────────────────────────── */
  const [cameraActive,  setCameraActive]  = useState(false);
  const videoRef        = useRef(null);
  const streamRef       = useRef(null);
  const canvasRef       = useRef(null);
  const proctorSidRef   = useRef(null);
  const proctorLoopRef  = useRef(null);
  const proctorInFlight = useRef(false);
  const interviewStartedRef = useRef(false);
  
  /* ── Window Switch state ──────────────────────────────────────────────── */
  const [windowSwitchCount, setWindowSwitchCount] = useState(0);
  const [showSwitchWarning, setShowSwitchWarning] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);

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

  /* ── Request camera on mount & Load html2pdf ───────────────────────────── */
  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        setCamState('granted');
        if (checkVideoRef.current) checkVideoRef.current.srcObject = stream;
      })
      .catch((err) => {
        if (!mounted) return;
        setCamState('denied');
        setCamError(err.message);
      });

    // Dynamically load html2pdf.js
    if (!document.getElementById('html2pdf-script')) {
      const script = document.createElement('script');
      script.id = 'html2pdf-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.async = true;
      document.body.appendChild(script);
    }

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
    if (phase !== 'starting') return;
    setLoading(true);
    setTimeout(() => {
      const openingText = hasDocContext
        ? `Hi! I'm your AI interviewer today. I've reviewed your ${jdText ? 'job description' : 'prep context'}${resumeText ? ' along with your resume' : ''}. Let's get started — can you briefly walk me through your background and why you're a strong fit for this opportunity?`
        : OPENING_QUESTION({ company, role });
      currentQRef.current = openingText;
      setCurrentQType('behavioral');
      setMessages([{ role: 'ai', text: openingText, qType: 'behavioral' }]);
      setLoading(false);
      setPhase('idle');
      setTimeout(() => speak(openingText), 300);
    }, 1200);
  }, [phase, company, role, hasDocContext, jdText, resumeText]);

  /* ── Window Switch Detection ──────────────────────────────────────────── */
  useEffect(() => {
    if (ended || phase === 'cam-check' || phase === 'reviewing' || phase === 'done') return;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWindowSwitchCount(prev => {
          const next = prev + 1;
          if (next > 3) {
             setIsTerminated(true);
          } else {
             setShowSwitchWarning(true);
          }
          return next;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [ended, phase]);

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

  /* ── PDF Download Handler ────────────────────────────────────────────── */
  const handleDownloadPDF = () => {
    const element = document.getElementById('iv-report-content');
    if (!element || !window.html2pdf) return;
    const opt = {
      margin:       [0.5, 0.5, 0.5, 0.5],
      filename:     `Interview_Report_${company || 'AI'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    window.html2pdf().set(opt).from(element).save();
  };

  /* ── End Interview Sequence ──────────────────────────────────────────── */
  const endInterviewSequence = async (isForced = false) => {
    setIsTerminated(false); // hide termination overlay if it was open
    clearTimeout(proctorLoopRef.current);
    let pResult = null;
    if (proctorSidRef.current) {
      try {
        const res = await fetch(`${API_BASE}/api/proctoring/stop/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: proctorSidRef.current }),
        });
        pResult = await res.json();
        setProctorResult(pResult);
      } catch (_) {}
      proctorSidRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);

    setLoading(true);
    const closing = isForced
      ? "This interview has been forcefully terminated due to a proctoring violation. Please wait while your partial report is compiled."
      : "Thank you for your time! That wraps up our session. Please wait while I generate your comprehensive review.";
    setMessages((prev) => [...prev, { role: 'ai', text: closing, qType: 'behavioral' }]);
    speak(closing);
    
    setPhase('reviewing');

    try {
      const revRes = await fetch(`${API_BASE}/api/interview/review/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyRef.current,
          role,
          company,
          proctor: pResult ? { ...pResult, window_switches: windowSwitchCount } : { window_switches: windowSwitchCount }
        })
      });
      const revData = await revRes.json();
      if (!revRes.ok) throw new Error(revData.error || 'Failed to generate review');
      setReviewData(revData);
    } catch (err) {
      console.error('Review generation failed:', err);
    }

    setLoading(false);
    setEnded(true);
    setPhase('done');
  };

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
      await endInterviewSequence(false);
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

        // Calculate delay based on reaction length (roughly 70ms per character) to prevent speech cutoff
        const reactionDelay = reaction ? Math.min(Math.max(1500, reaction.length * 70 + 500), 8000) : 0;

        setTimeout(() => {
          setPhase('idle');
          currentQRef.current = next_turn;
          setQIndex(nextQNum);
          const qType = detectQuestionType(next_turn);
          setCurrentQType(qType);
          setMessages((prev) => [...prev, { role: 'ai', text: next_turn, qType }]);
          setTimeout(() => speak(next_turn), reaction ? 600 : 0);
        }, reactionDelay);

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

  if (phase === 'cam-check') {
    return (
      <CameraCheckScreen
        topic={sessionLabel}
        difficulty="N/A"
        count={TOTAL_QUESTIONS}
        checkVideoRef={checkVideoRef}
        camState={camState}
        camError={camError}
        onStart={() => {
          if (camState === 'granted') {
            setCameraActive(true);
            setPhase('starting');
          }
        }}
      />
    );
  }

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
        ) : phase === 'reviewing' ? (
          <div className="iv-ended-bar" style={{ justifyContent: 'center' }}>
            <Loader2 size={20} className="cam-spin" style={{ marginRight: '0.5rem' }} />
            <span>Analyzing your interview and generating feedback...</span>
          </div>
        ) : (
          <div className="iv-report-container" id="iv-report-content">
            <div className="iv-report-header">
              <h2 className="iv-report-title">Interview Feedback Report</h2>
              <div className="iv-report-actions">
                <button className="download-btn" onClick={handleDownloadPDF} disabled={!window.html2pdf}>
                  <Download size={18} /> Download PDF
                </button>
              </div>
            </div>

            {reviewData ? (
              <>
                <div className="iv-report-section">
                  <h3>Proctoring & Integrity</h3>
                  <ul className="iv-report-list">
                    <li><strong>Tab Switches Detected:</strong> {windowSwitchCount} {windowSwitchCount === 1 ? 'time' : 'times'}</li>
                    {proctorResult && (
                      <li><strong>Face Visibility:</strong> {(100 - proctorResult.face_not_in_frame_pct).toFixed(1)}% of the interview</li>
                    )}
                  </ul>
                </div>
                <div className="iv-report-section">
                  <h3>Overview</h3>
                  <p>{reviewData.overview}</p>
                </div>
                <div className="iv-report-section">
                  <h3>Strengths</h3>
                  <ul className="iv-report-list">
                    {reviewData.strengths?.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div className="iv-report-section">
                  <h3>Areas for Improvement</h3>
                  <ul className="iv-report-list">
                    {reviewData.gaps?.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </div>
                <div className="iv-report-section">
                  <h3>Recommendations</h3>
                  <ul className="iv-report-list">
                    {reviewData.recommendations?.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              </>
            ) : (
              <div className="iv-report-section">
                <p>Failed to load comprehensive review. Here is your transcript below.</p>
              </div>
            )}

            <div className="iv-report-section" style={{ marginTop: '3rem' }}>
              <h3>Interview Transcript</h3>
              {historyRef.current.map((item, i) => (
                <div key={i} className="iv-transcript-item">
                  <div className="iv-t-q">Q{i + 1}: {item.q}</div>
                  <div className="iv-t-a">You: {item.a}</div>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <Link to="/dashboard" className="iv-dash-btn">Return to Dashboard</Link>
            </div>
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

      {/* Termination Overlay */}
      {isTerminated && (
        <div className="window-warning-overlay">
          <div className="window-warning-card" style={{ borderColor: '#991b1b' }}>
            <AlertTriangle size={64} style={{ color: '#991b1b', margin: '0 auto 1.5rem', display: 'block' }} />
            <h2 className="window-warning-title">Interview Terminated</h2>
            <p className="window-warning-text">
              You have exceeded the maximum allowed number of window switches (3). 
              Your interview has been forcefully terminated to maintain integrity.
            </p>
            <button 
              className="window-warning-btn" style={{ background: '#991b1b' }}
              onClick={() => endInterviewSequence(true)}
            >
              Submit Partial Report
            </button>
          </div>
        </div>
      )}

      {/* Window Switch Warning Overlay */}
      {!isTerminated && showSwitchWarning && (
        <div className="window-warning-overlay">
          <div className="window-warning-card">
            <AlertTriangle size={64} className="window-warning-icon" />
            <h2 className="window-warning-title">Window Switch Detected</h2>
            <p className="window-warning-text">
              Navigating away from the interview tab is not allowed and has been recorded. 
              Continuing to switch windows may negatively impact your integrity score.
            </p>
            <button 
              className="window-warning-btn"
              onClick={() => setShowSwitchWarning(false)}
            >
              I Understand
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
