import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Bot, User, Mic, MicOff, FileText, Volume2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import { usePrep } from '../context/PrepContext';
import './AIInterview.css';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const TOTAL_QUESTIONS = 6;
const API_BASE        = 'http://127.0.0.1:8000';

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
  // Pick a natural-sounding voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('google'))
    || voices.find(v => v.lang === 'en-US')
    || voices[0];
  if (preferred) utt.voice = preferred;
  window.speechSynthesis.speak(utt);
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function AIInterview() {
  const location  = useLocation();
  const navigate  = useNavigate();  // eslint-disable-line no-unused-vars
  const { resumeName = '', company = '', role = '' } = location.state || {};

  const { addSession } = usePrep();
  const savedRef       = useRef(false);

  /* Chat / flow state */
  const [messages,       setMessages]       = useState([]);
  const [input,          setInput]          = useState('');
  const [qIndex,         setQIndex]         = useState(0);   // # questions asked so far
  const [loading,        setLoading]        = useState(false);
  const [ended,          setEnded]          = useState(false);
  const [phase,          setPhase]          = useState('idle'); // idle | listening | processing | thinking | done

  /* Voice state */
  const [isListening,    setIsListening]    = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micAvailable,   setMicAvailable]   = useState(isSpeechSupported());

  /* Thinking phrase (shown while AI "processes") */
  const [thinkingPhrase, setThinkingPhrase] = useState('');

  /* Rolling context: array of { q, a } pairs (last 4 used) */
  const historyRef = useRef([]);

  /* Current question text (for building history) */
  const currentQRef = useRef('');

  const recognitionRef = useRef(null);
  const bottomRef      = useRef();

  /* ── Save session when done ──────────────────────────────────────────── */
  useEffect(() => {
    if (!ended || savedRef.current) return;
    savedRef.current = true;
    const now   = new Date();
    const topic = [company, role].filter(Boolean).join(' – ') || 'AI Interview';
    addSession({
      id:     Date.now(),
      type:   'AI Interview',
      topic,
      score:  '—',
      pct:    null,
      date:   now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      dayKey: now.toISOString().slice(0, 10),
      status: 'Reviewed',
    });
  }, [ended]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── First question on mount ─────────────────────────────────────────── */
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      const openingText = OPENING_QUESTION({ company, role });
      currentQRef.current = openingText;
      setMessages([{ role: 'ai', text: openingText }]);
      setLoading(false);
      // Small delay so browser voices are loaded before speaking
      setTimeout(() => speak(openingText), 300);
    }, 1200);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Move live transcript into the text box for review/edit
      setInput((prev) => (prev + ' ' + liveTranscript).trim());
      setLiveTranscript('');
    } else {
      setLiveTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (_) { /* already started */ }
    }
  }, [isListening, liveTranscript]);

  /* ── Submit answer ───────────────────────────────────────────────────── */
  async function handleSend() {
    // Stop mic if still recording
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

    // Push to rolling history
    historyRef.current.push({ q: currentQRef.current, a: answer });

    const nextQNum = qIndex + 1; // question number we just answered

    if (nextQNum >= TOTAL_QUESTIONS) {
      // Interview is over
      setLoading(true);
      setTimeout(() => {
        const closing = "Thank you for your time! That wraps up our session. You handled that well — your report will be on your dashboard shortly. Good luck!";
        setMessages((prev) => [...prev, { role: 'ai', text: closing }]);
        speak(closing);
        setLoading(false);
        setEnded(true);
        setPhase('done');
      }, 1000);
      return;
    }

    // ── Fetch next question from Groq ──────────────────────────────────
    setPhase('processing');
    setLoading(true);

    try {
      const res  = await fetch(`${API_BASE}/api/interview/next/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          role,
          company,
          last_answer:      answer,
          question_number:  nextQNum,
          total_questions:  TOTAL_QUESTIONS,
          history:          historyRef.current.slice(-4),
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error || 'API error');

      const { reaction, next_turn, thinking_phrase } = data;

      // ── Step 1: show thinking indicator (2–3 sec) ──────────────────
      setLoading(false);
      setThinkingPhrase(thinking_phrase || 'Hmm…');
      setPhase('thinking');

      const thinkDelay = 2000 + Math.random() * 1500;

      setTimeout(() => {
        setThinkingPhrase('');

        // ── Step 2: show REACTION bubble (feedback on their answer) ──
        if (reaction) {
          setMessages((prev) => [...prev, { role: 'ai', text: reaction, isReaction: true }]);
          speak(reaction);
        }

        // ── Step 3: after ~1.2s, show NEXT bubble (question/followup) ─
        setTimeout(() => {
          setPhase('idle');
          currentQRef.current = next_turn;
          setQIndex(nextQNum);
          setMessages((prev) => [...prev, { role: 'ai', text: next_turn }]);
          // Small gap so TTS doesn't overlap if reaction is still playing
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
              {company && <span className="iv-company">{company} · {role}</span>}
              {resumeName && (
                <span className="iv-resume">
                  <FileText size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                  {resumeName}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* TTS always-on indicator */}
            <span className="iv-tts-badge">
              <Volume2 size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
              Voice On
            </span>

            {/* Progress */}
            <div className="iv-progress-wrap">
              <span className="iv-progress-label">Q{qIndex + 1} / {TOTAL_QUESTIONS}</span>
              <div className="iv-progress-bar">
                <div className="iv-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Chat ── */}
        <div className="iv-chat">
          {messages.map((m, i) => (
            <div key={i} className={`iv-msg iv-msg-${m.role}`}>
              <div className={`iv-avatar ${m.role === 'ai' ? 'avatar-ai' : 'avatar-user'}`}>
                {m.role === 'ai' ? <Bot size={16} strokeWidth={1.75} /> : <User size={16} strokeWidth={1.75} />}
              </div>
              <div className={`iv-bubble${m.isReaction ? ' iv-bubble--reaction' : ''}`}>{m.text}</div>
            </div>
          ))}

          {/* Thinking phrase (interviewer reacting) */}
          {thinkingPhrase && (
            <div className="iv-msg iv-msg-ai">
              <div className="iv-avatar avatar-ai"><Bot size={16} strokeWidth={1.75} /></div>
              <div className="iv-bubble iv-thinking-phrase">{thinkingPhrase}</div>
            </div>
          )}

          {/* Typing indicator */}
          {loading && (
            <div className="iv-msg iv-msg-ai">
              <div className="iv-avatar avatar-ai"><Bot size={16} strokeWidth={1.75} /></div>
              <div className="iv-bubble iv-typing"><span /><span /><span /></div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input area ── */}
        {!ended ? (
          <div className="iv-input-area">

            {/* Live transcript preview */}
            {(isListening || liveTranscript) && (
              <div className="iv-live-transcript">
                <span className="iv-live-dot" />
                <span>{liveTranscript || 'Listening…'}</span>
              </div>
            )}

            <div className="iv-input-row">
              {/* Mic button */}
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
    </div>
  );
}
