import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Clock, ShieldCheck, ShieldOff, Camera, CameraOff } from 'lucide-react';
import Navbar from '../components/Navbar';
import './MockTest.css';

// ─── Text scoring helpers ──────────────────────────────────────────────────

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenizeForMatch(s) {
  return normalizeText(s)
    .replace(/[^a-z0-9_#@.+*\-\/=<>:(){}\[\],]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function unique(arr) { return [...new Set(arr)]; }

function tokenOverlapRatio(a, b) {
  const sa = new Set(unique(tokenizeForMatch(a)));
  const sb = new Set(unique(tokenizeForMatch(b)));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  sa.forEach((t) => { if (sb.has(t)) inter += 1; });
  return inter / Math.max(sa.size, sb.size);
}

function scoreTextAnswer(question, userText) {
  const user = normalizeText(userText);
  if (!user) return { points: 0, keywordRatio: 0, overlapRatio: 0 };

  const expected = normalizeText(question.expected_answer);
  const keywords = Array.isArray(question.expected_keywords)
    ? question.expected_keywords.map((k) => normalizeText(k)).filter(Boolean)
    : [];

  const keywordHits = keywords.filter((k) => user.includes(k)).length;
  const keywordRatio = keywords.length > 0 ? keywordHits / keywords.length : 0;
  const overlapRatio = tokenOverlapRatio(expected, user);

  if (expected && (user === expected || (user.includes(expected) || expected.includes(user)) && user.length >= 12)) {
    return { points: 1, keywordRatio, overlapRatio };
  }
  if (keywordRatio >= 0.8 || (keywordRatio >= 0.7 && overlapRatio >= 0.6)) {
    return { points: 1, keywordRatio, overlapRatio };
  }
  if (keywordRatio >= 0.55 || overlapRatio >= 0.6) {
    return { points: 0.5, keywordRatio, overlapRatio };
  }
  return { points: 0, keywordRatio, overlapRatio };
}

function isAnswered(question, answerValue) {
  if (!question) return false;
  if (question.type === 'text') return String(answerValue || '').trim().length > 0;
  return answerValue !== undefined;
}

// ─── Proctoring helpers ────────────────────────────────────────────────────

const PROCTOR_REPORT_STORAGE_KEY = 'mockTestProctorReport';
const PROCTOR_FRAME_INTERVAL     = 900;   // ms between frame pushes
const PROCTOR_FRAME_MAX_WIDTH    = 320;   // cap frame width sent to backend

function buildFallbackProctorResult(cameraAvailable = false) {
  return {
    cheating: false,
    camera_available: cameraAvailable,
    face_not_in_frame_pct: 0.0,
    not_looking_pct: 0.0,
    multi_face_pct: 0.0,
    total_frames: 0,
    flags: [],
    cheating_probability: null,
    provider: 'opencv',
  };
}

function buildProctorReportFromBackend(result, meta) {
  return {
    created_at: new Date().toISOString(),
    provider: result?.provider || 'opencv',
    result: result || buildFallbackProctorResult(false),
    session: {
      topic:          meta?.topic      || null,
      difficulty:     meta?.difficulty || null,
      question_count: Number(meta?.count || 0),
    },
  };
}

// ─── Sub-screens ───────────────────────────────────────────────────────────

function LoadingScreen({ topic, difficulty }) {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length < 3 ? d + '.' : '')), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="test-root">
      <Navbar />
      <div className="test-container" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'70vh', gap:'1.5rem' }}>
        <Loader2 size={40} strokeWidth={1.5} style={{ color:'#4e7fff', animation:'spin 1s linear infinite' }} />
        <h2 style={{ color:'#a78bfa', margin:0 }}>Generating your test{dots}</h2>
        <p style={{ color:'#94a3b8', margin:0 }}>
          AI is crafting <strong style={{ color:'#e2e8f0' }}>{topic}</strong> questions at <strong style={{ color:'#e2e8f0' }}>{difficulty}</strong> difficulty
        </p>
        <div className="ai-spinner" />
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }) {
  return (
    <div className="test-root">
      <Navbar />
      <div className="test-container" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'70vh', gap:'1.5rem' }}>
        <AlertCircle size={40} strokeWidth={1.5} style={{ color:'#f87171' }} />
        <h2 style={{ color:'#f87171', margin:0 }}>Failed to Generate Test</h2>
        <p style={{ color:'#94a3b8', margin:0, maxWidth:'400px', textAlign:'center' }}>{message}</p>
        <button className="nav-btn submit-btn" onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}

function CameraCheckScreen({ topic, difficulty, count, checkVideoRef, camState, camError, onStart }) {
  return (
    <div className="test-root">
      <Navbar />
      <div className="cam-check-shell">
        <div className="cam-check-card">
          <div className="cam-check-header">
            <ShieldCheck size={22} strokeWidth={2} className="cam-check-icon" />
            <h2 className="cam-check-title">Camera Check</h2>
            <p className="cam-check-subtitle">
              This test is <strong>proctored</strong>. Camera access is required to start.
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
            <div className="cam-meta-divider" />
            <div className="cam-meta-item">
              <span className="cam-meta-label">Time Limit</span>
              <span className="cam-meta-val">{Math.floor((count * 90) / 60)} min</span>
            </div>
          </div>

          <div className="cam-check-actions">
            <button
              className="nav-btn submit-btn cam-start-btn"
              onClick={onStart}
              disabled={camState !== 'granted'}
            >
              {camState === 'granted' ? '🚀 Begin Test' : 'Waiting for camera…'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function MockTest() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    topic      = 'Data Structures',
    difficulty = 'Medium',
    count      = 15,
    mode       = 'standard',
    resumeText = '',
    jdText     = '',
  } = location.state || {};

  const [phase,    setPhase]    = useState('cam-check');
  const [camState, setCamState] = useState('requesting');
  const [camError, setCamError] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [current,   setCurrent]   = useState(0);
  const [answers,   setAnswers]   = useState({});
  const [timeLeft,  setTimeLeft]  = useState(count * 90);
  const [finished,  setFinished]  = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef         = useRef(null);   // floating preview during test
  const checkVideoRef    = useRef(null);   // preview on cam-check screen
  const streamRef        = useRef(null);   // MediaStream handle
  const canvasRef        = useRef(null);   // off-screen canvas for frame capture
  const proctorSidRef    = useRef(null);   // OpenCV session ID from backend
  const proctorLoopRef   = useRef(null);   // setTimeout handle
  const proctorInFlight  = useRef(false);  // prevent overlapping POSTs

  // ── Request camera on mount ──────────────────────────────────────────────
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
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stop camera on true unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Attach stream to floating video after cameraActive=true ─────────────
  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [cameraActive]);

  // ── Fetch questions when test phase begins ───────────────────────────────
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/generate-mock-test/', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ topic, difficulty, count, mode, resume_text: resumeText, jd_text: jdText }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Unknown server error');
      if (!data.questions?.length) throw new Error('No questions returned from AI');
      setQuestions(data.questions);
      setTimeLeft(data.questions.length * 90);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [topic, difficulty, count, mode, resumeText, jdText]);

  useEffect(() => {
    if (phase === 'test') fetchQuestions();
  }, [phase, fetchQuestions]);

  // ── Start OpenCV proctoring once questions are loaded ────────────────────
  useEffect(() => {
    if (questions.length === 0) return;

    const stream = streamRef.current;
    if (!stream) return; // no camera — skip proctoring, test runs normally

    // Mount floating camera widget (triggers the cameraActive effect above)
    setCameraActive(true);
    if (checkVideoRef.current) checkVideoRef.current.srcObject = null;

    // Create an off-screen canvas for frame capture
    const canvas  = document.createElement('canvas');
    canvasRef.current = canvas;

    let cancelled = false;

    // Start the backend proctoring session
    async function startSession() {
      try {
        const res  = await fetch('/api/proctoring/start/', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not start proctoring session');
        proctorSidRef.current = data.session_id;
      } catch (err) {
        console.warn('Proctoring session failed to start:', err.message);
        return; // no session — frame loop won't run
      }

      // Begin frame push loop
      scheduleFrame();
    }

    function scheduleFrame() {
      if (cancelled) return;
      proctorLoopRef.current = setTimeout(pushFrame, PROCTOR_FRAME_INTERVAL);
    }

    async function pushFrame() {
      if (cancelled || proctorInFlight.current || !proctorSidRef.current) {
        scheduleFrame();
        return;
      }

      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) {
        scheduleFrame();
        return;
      }

      // Resize to cap bandwidth
      const scale  = Math.min(1, PROCTOR_FRAME_MAX_WIDTH / video.videoWidth);
      canvas.width  = Math.round(video.videoWidth  * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      proctorInFlight.current = true;
      try {
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.7)
        );
        if (blob && !cancelled && proctorSidRef.current) {
          const form = new FormData();
          form.append('session_id', proctorSidRef.current);
          form.append('frame', blob, 'frame.jpg');
          await fetch('/api/proctoring/frame/', { method: 'POST', body: form });
        }
      } catch (_) {
        // Swallow individual frame errors — network blip, keep going
      } finally {
        proctorInFlight.current = false;
      }

      scheduleFrame();
    }

    startSession();

    return () => {
      cancelled = true;
      clearTimeout(proctorLoopRef.current);
      // Do NOT stop the stream here — owned by the unmount effect above.
    };
  }, [questions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Score + finish ───────────────────────────────────────────────────────
  const handleFinish = useCallback(async () => {
    if (finished) return;
    setFinished(true);

    // Score answers
    const questionScores = {};
    let finalScore = 0;
    questions.forEach((q, i) => {
      if (q.type === 'text') {
        const evalResult = scoreTextAnswer(q, answers[i]);
        questionScores[i] = evalResult;
        finalScore += evalResult.points;
      } else {
        const correct = answers[i] === q.answer;
        questionScores[i] = { points: correct ? 1 : 0, keywordRatio: null, overlapRatio: null };
        finalScore += correct ? 1 : 0;
      }
    });

    // Stop frame loop
    clearTimeout(proctorLoopRef.current);

    // Stop the backend proctoring session and get the verdict
    let procResult = buildFallbackProctorResult(Boolean(proctorSidRef.current));
    if (proctorSidRef.current) {
      try {
        const res  = await fetch('/api/proctoring/stop/', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ session_id: proctorSidRef.current }),
        });
        const data = await res.json();
        if (res.ok && data) {
          // Backend returns the verdict directly — normalise to our shape
          procResult = {
            cheating:               Boolean(data.cheating),
            camera_available:       true,
            face_not_in_frame_pct:  Number((data.face_not_in_frame_pct ?? 0).toFixed(1)),
            not_looking_pct:        Number((data.not_looking_pct       ?? 0).toFixed(1)),
            multi_face_pct:         Number((data.multi_face_pct        ?? 0).toFixed(1)),
            total_frames:           Number(data.total_frames           ?? 0),
            flags:                  Array.isArray(data.flags) ? data.flags : [],
            cheating_probability:   data.cheating_probability ?? null,
            provider:               data.provider || 'opencv',
          };
        }
      } catch (err) {
        console.warn('Could not stop proctoring session:', err.message);
      }
      proctorSidRef.current = null;
    }

    const proctorReport = buildProctorReportFromBackend(procResult, { topic, difficulty, count });

    // Persist report
    try {
      localStorage.setItem(PROCTOR_REPORT_STORAGE_KEY, JSON.stringify(proctorReport));
    } catch (_) { /* quota / private mode */ }

    // Also upload to backend for server-side storage
    try {
      await fetch('/api/proctoring/report/', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(proctorReport),
      });
    } catch (_) { /* optional */ }

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    navigate('/dashboard/mock-results', {
      state: {
        questions,
        answers,
        score:        Number(finalScore.toFixed(2)),
        maxScore:     questions.length,
        questionScores,
        topic,
        difficulty,
        timeTaken:    questions.length * 90 - timeLeft,
        proctor:      procResult,
        proctorReport,
      },
    });
  }, [finished, questions, answers, navigate, topic, difficulty, count, timeLeft]);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || error || questions.length === 0) return;
    if (timeLeft <= 0) { handleFinish(); return; }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, handleFinish, loading, error, questions]);

  // ── Camera check phase ───────────────────────────────────────────────────
  if (phase === 'cam-check') {
    return (
      <CameraCheckScreen
        topic={topic}
        difficulty={difficulty}
        count={count}
        checkVideoRef={checkVideoRef}
        camState={camState}
        camError={camError}
        onStart={() => { if (camState === 'granted') setPhase('test'); }}
      />
    );
  }

  if (loading) return <LoadingScreen topic={topic} difficulty={difficulty} />;
  if (error)   return <ErrorScreen   message={error} onRetry={fetchQuestions} />;

  const mins   = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs   = String(timeLeft % 60).padStart(2, '0');
  const urgent = timeLeft < 60;

  function selectAnswer(idx) { setAnswers((prev) => ({ ...prev, [current]: idx })); }
  function setTextAnswer(v)  { setAnswers((prev) => ({ ...prev, [current]: v })); }

  const answered = questions.reduce((acc, q, i) => acc + (isAnswered(q, answers[i]) ? 1 : 0), 0);
  const progress  = ((current + 1) / questions.length) * 100;

  return (
    <div className="test-root">
      <Navbar />
      <div className="test-container">

        {/* Top bar */}
        <div className="test-topbar">
          <div className="test-meta">
            <span className="test-topic-tag">{topic}</span>
            <span className="test-diff-tag">{difficulty}</span>
          </div>
          <div className={`test-timer ${urgent ? 'urgent' : ''}`}>
            <Clock size={13} strokeWidth={2} style={{ marginRight:'0.3rem', verticalAlign:'middle' }} />{mins}:{secs}
          </div>
          <div className="test-topbar-right">
            <span className="proctor-pill">
              <ShieldCheck size={12} strokeWidth={2} />
              {cameraActive ? 'Proctored' : 'Unproctored'}
            </span>
            <div className="test-progress-text">{answered}/{questions.length} answered</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="test-progress-bar">
          <div className="test-progress-fill" style={{ width:`${progress}%` }} />
        </div>

        {/* Question */}
        <div className="test-card">
          <div className="test-q-counter">Question {current + 1} of {questions.length}</div>
          <h2 className="test-q-text">{questions[current]?.q}</h2>

          {questions[current]?.type === 'text' ? (
            <div className="test-text-wrap">
              <div className="test-text-label">Write your answer (syntax / code / plain text):</div>
              <textarea
                className="test-textarea"
                rows={8}
                value={answers[current] || ''}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="Type your answer here..."
              />
            </div>
          ) : (
            <div className="test-options">
              {questions[current]?.options.map((opt, idx) => (
                <button
                  key={idx}
                  className={`test-option ${answers[current] === idx ? 'selected' : ''}`}
                  onClick={() => selectAnswer(idx)}
                >
                  <span className="opt-letter">{String.fromCharCode(65 + idx)}</span>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="test-nav">
          <button
            className="nav-btn"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
          >
            ← Previous
          </button>

          <div className="test-dot-nav">
            {questions.map((_, i) => (
              <button
                key={i}
                className={`dot-btn ${i === current ? 'dot-current' : ''} ${isAnswered(questions[i], answers[i]) ? 'dot-answered' : ''}`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>

          {current < questions.length - 1 ? (
            <button
              className="nav-btn nav-next"
              onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            >
              Next →
            </button>
          ) : (
            <button className="nav-btn submit-btn" onClick={handleFinish}>
              Submit ✓
            </button>
          )}
        </div>

      </div>

      {/* Floating camera preview */}
      {cameraActive && (
        <div className="proctor-cam-wrap">
          <video ref={videoRef} autoPlay muted playsInline className="proctor-cam-video" />
          <div className="proctor-cam-bar">
            <ShieldCheck size={10} strokeWidth={2.5} />
            <span>Proctored · Live</span>
          </div>
        </div>
      )}

    </div>
  );
}
