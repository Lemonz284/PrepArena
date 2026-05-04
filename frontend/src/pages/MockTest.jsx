import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Clock, ShieldCheck, ShieldAlert, Camera, CameraOff } from 'lucide-react';
import Navbar from '../components/Navbar';
import './MockTest.css';
import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenizeForMatch(s) {
  return normalizeText(s)
    .replace(/[^a-z0-9_#@.+*\-\/=<>:(){}\[\],]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function unique(arr) {
  return [...new Set(arr)];
}

function tokenOverlapRatio(a, b) {
  const sa = new Set(unique(tokenizeForMatch(a)));
  const sb = new Set(unique(tokenizeForMatch(b)));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  sa.forEach((t) => {
    if (sb.has(t)) inter += 1;
  });
  return inter / Math.max(sa.size, sb.size);
}

function scoreTextAnswer(question, userText) {
  const user = normalizeText(userText);
  if (!user) {
    return { points: 0, keywordRatio: 0, overlapRatio: 0 };
  }

  const expected = normalizeText(question.expected_answer);
  const keywords = Array.isArray(question.expected_keywords)
    ? question.expected_keywords.map((k) => normalizeText(k)).filter(Boolean)
    : [];

  const keywordHits = keywords.filter((k) => user.includes(k)).length;
  const keywordRatio = keywords.length > 0 ? keywordHits / keywords.length : 0;
  const overlapRatio = tokenOverlapRatio(expected, user);

  // Full credit if answer is effectively correct.
  if (expected && (user === expected || user.includes(expected) || expected.includes(user) && user.length >= 12)) {
    return { points: 1, keywordRatio, overlapRatio };
  }
  if (keywordRatio >= 0.8 || (keywordRatio >= 0.7 && overlapRatio >= 0.6)) {
    return { points: 1, keywordRatio, overlapRatio };
  }

  // Partial credit if user demonstrates 50-60%+ matching code/keywords.
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

const FACE_MISSING_THRESHOLD = 15.0;
const LOOK_AWAY_THRESHOLD = 25.0;
const MULTI_FACE_THRESHOLD = 5.0;
const PROCTOR_REPORT_STORAGE_KEY = 'mockTestProctorReport';

function buildUnavailableProctorResult(totalFrames = 0) {
  return {
    cheating: false,
    camera_available: false,
    face_not_in_frame_pct: 0.0,
    not_looking_pct: 0.0,
    multi_face_pct: 0.0,
    total_frames: totalFrames,
    flags: [],
    cheating_probability: null,
    provider: 'mediapipe',
  };
}

function buildProctorResultFromMetrics(metrics) {
  const totalFrames = Number(metrics?.totalFrames || 0);
  if (!metrics?.cameraAvailable || totalFrames === 0) {
    return buildUnavailableProctorResult(totalFrames);
  }

  const noFaceFrames = Number(metrics?.noFaceFrames || 0);
  const offCenterFrames = Number(metrics?.offCenterFrames || 0);
  const multiFaceFrames = Number(metrics?.multiFaceFrames || 0);

  const faceNotPct = Number(((noFaceFrames / totalFrames) * 100).toFixed(1));
  const validFaceFrames = Math.max(0, totalFrames - noFaceFrames);
  const awayPct = Number(((validFaceFrames > 0 ? offCenterFrames / validFaceFrames : 0) * 100).toFixed(1));
  const multiPct = Number(((multiFaceFrames / totalFrames) * 100).toFixed(1));

  const flags = [];
  if (faceNotPct > FACE_MISSING_THRESHOLD) {
    flags.push(`Face absent ${faceNotPct}% of the time`);
  }
  if (awayPct > LOOK_AWAY_THRESHOLD) {
    flags.push(`Not looking at screen ${awayPct}% of the time`);
  }
  if (multiPct > MULTI_FACE_THRESHOLD) {
    flags.push(`Multiple people detected in ${multiPct}% of samples`);
  }

  const cheatingProbability = Number(
    Math.min(
      1,
      Math.max(
        0,
        (faceNotPct / 100) * 0.5 +
          (awayPct / 100) * 0.35 +
          (multiPct / 100) * 0.15
      )
    ).toFixed(3)
  );

  return {
    cheating: flags.length > 0,
    camera_available: true,
    face_not_in_frame_pct: faceNotPct,
    not_looking_pct: awayPct,
    multi_face_pct: multiPct,
    total_frames: totalFrames,
    flags,
    cheating_probability: cheatingProbability,
    provider: 'mediapipe',
  };
}

function buildProctorReport(metrics, result, meta) {
  const now = new Date();
  return {
    created_at: now.toISOString(),
    provider: result?.provider || 'mediapipe',
    camera_available: Boolean(metrics?.cameraAvailable),
    thresholds: {
      face_missing_pct: FACE_MISSING_THRESHOLD,
      look_away_pct: LOOK_AWAY_THRESHOLD,
      multi_face_pct: MULTI_FACE_THRESHOLD,
    },
    metrics: {
      total_frames: Number(metrics?.totalFrames || 0),
      no_face_frames: Number(metrics?.noFaceFrames || 0),
      off_center_frames: Number(metrics?.offCenterFrames || 0),
      multi_face_frames: Number(metrics?.multiFaceFrames || 0),
    },
    verdict: {
      cheating: Boolean(result?.cheating),
      cheating_probability: result?.cheating_probability ?? null,
      flags: Array.isArray(result?.flags) ? result.flags : [],
    },
    session: {
      topic: meta?.topic || null,
      difficulty: meta?.difficulty || null,
      question_count: Number(meta?.count || 0),
    },
  };
}

/* ── Loading screen ── */
function LoadingScreen({ topic, difficulty }) {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length < 3 ? d + '.' : '')), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="test-root">
      <Navbar />
      <div className="test-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: '1.5rem' }}>
        <Loader2 size={40} strokeWidth={1.5} style={{ color: '#4e7fff', animation: 'spin 1s linear infinite' }} />
        <h2 style={{ color: '#a78bfa', margin: 0 }}>Generating your test{dots}</h2>
        <p style={{ color: '#94a3b8', margin: 0 }}>AI is crafting <strong style={{ color: '#e2e8f0' }}>{topic}</strong> questions at <strong style={{ color: '#e2e8f0' }}>{difficulty}</strong> difficulty</p>
        <div className="ai-spinner" />
      </div>
    </div>
  );
}

/* ── Error screen ── */
function ErrorScreen({ message, onRetry }) {
  return (
    <div className="test-root">
      <Navbar />
      <div className="test-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: '1.5rem' }}>
        <AlertCircle size={40} strokeWidth={1.5} style={{ color: '#f87171' }} />
        <h2 style={{ color: '#f87171', margin: 0 }}>Failed to Generate Test</h2>
        <p style={{ color: '#94a3b8', margin: 0, maxWidth: '400px', textAlign: 'center' }}>{message}</p>
        <button className="nav-btn submit-btn" onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}

/* ── Camera check screen ── */
function CameraCheckScreen({ topic, difficulty, count, checkVideoRef, camState, camError, onStart }) {
  return (
    <div className="test-root">
      <Navbar />
      <div className="cam-check-shell">
        <div className="cam-check-card">

          {/* Header */}
          <div className="cam-check-header">
            <ShieldCheck size={22} strokeWidth={2} className="cam-check-icon" />
            <h2 className="cam-check-title">Camera Check</h2>
            <p className="cam-check-subtitle">
              This test is <strong>proctored</strong>. Camera access is required to start.
            </p>
          </div>

          {/* Preview */}
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
                    <CameraOff size={28} strokeWidth={1.5} style={{ color: '#f87171' }} />
                    <span style={{ color: '#f87171' }}>Camera blocked</span>
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

          {/* Status row */}
          <div className={`cam-status-row ${camState === 'granted' ? 'cam-ok' : camState === 'denied' ? 'cam-err' : 'cam-wait'}`}>
            {camState === 'granted' && <><Camera size={14} strokeWidth={2} /> Camera ready — face visible in frame before starting</>}
            {camState === 'requesting' && <><Loader2 size={14} strokeWidth={2} className="cam-spin" /> Requesting camera access…</>}
            {camState === 'denied'    && <><CameraOff size={14} strokeWidth={2} /> Camera blocked — enable access to continue</>}
          </div>

          {/* Test info */}
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

          {/* Actions */}
          <div className="cam-check-actions">
            <button
              className="nav-btn submit-btn cam-start-btn"
              onClick={onStart}
              disabled={camState !== 'granted'}
            >
              {camState === 'granted' ? '🚀 Begin Test' : 'Waiting…'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function MockTest() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    topic = 'Data Structures',
    difficulty = 'Medium',
    count = 15,
    mode = 'standard',
    resumeText = '',
    jdText = '',
  } = location.state || {};

  // 'cam-check' → 'test' (questions loading + active)
  const [phase, setPhase]         = useState('cam-check');
  const [camState, setCamState]   = useState('requesting'); // 'requesting' | 'granted' | 'denied'
  const [camError, setCamError]   = useState(null);

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [current, setCurrent]     = useState(0);
  const [answers, setAnswers]     = useState({});
  const [timeLeft, setTimeLeft]   = useState(count * 90);
  const [finished, setFinished]   = useState(false);

  const videoRef      = useRef(null);   // in-test floating camera <video>
  const checkVideoRef = useRef(null);   // pre-test camera check <video>
  const streamRef     = useRef(null);   // MediaStream handle (shared)
  const detectorRef   = useRef(null);
  const detectorReadyRef = useRef(false);
  const proctorLoopRef = useRef(null);
  const localMetricsRef = useRef({
    cameraAvailable: false,
    totalFrames: 0,
    noFaceFrames: 0,
    offCenterFrames: 0,
    multiFaceFrames: 0,
  });

  // ── Request camera access immediately on mount ──────────────────────────
  useEffect(() => {
    let localStream = null;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(s => {
        localStream = s;
        streamRef.current = s;
        setCamState('granted');
        if (checkVideoRef.current) checkVideoRef.current.srcObject = s;
      })
      .catch(err => {
        setCamState('denied');
        setCamError(err.message);
      });
    // Cleanup: stop this effect's stream (handles normal unmount + React StrictMode double-mount)
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        if (streamRef.current === localStream) streamRef.current = null;
      }
    };
  }, []);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-mock-test/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, difficulty, count, mode, resume_text: resumeText, jd_text: jdText }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Unknown server error');
      }
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No questions returned from AI');
      }
      setQuestions(data.questions);
      setTimeLeft(data.questions.length * 90);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [topic, difficulty, count]);

  // ── Fetch questions only after user clicks "Begin Test" ─────────────────
  useEffect(() => {
    if (phase === 'test') fetchQuestions();
  }, [phase, fetchQuestions]);

  // ── Start prebuilt browser-side proctoring once questions are ready ───────
  useEffect(() => {
    if (questions.length === 0 || detectorReadyRef.current) return;
    detectorReadyRef.current = true;

    let cancelled = false;
    localMetricsRef.current = {
      cameraAvailable: false,
      totalFrames: 0,
      noFaceFrames: 0,
      offCenterFrames: 0,
      multiFaceFrames: 0,
    };

    // Attach stream to floating video first so user sees live status.
    const stream = streamRef.current;
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    if (!stream) {
      return () => {};
    }

    localMetricsRef.current.cameraAvailable = true;

    const startDetector = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'
        );
        if (cancelled) return;

        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.45,
        });
        if (cancelled) {
          detector.close();
          return;
        }

        detectorRef.current = detector;

        const INTERVAL = 700;
        const runLoop = () => {
          if (cancelled) return;

          const video = videoRef.current;
          const activeDetector = detectorRef.current;
          if (!video || !activeDetector || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
            proctorLoopRef.current = setTimeout(runLoop, INTERVAL);
            return;
          }

          try {
            const out = activeDetector.detectForVideo(video, performance.now());
            const detections = Array.isArray(out?.detections) ? out.detections : [];
            const metrics = localMetricsRef.current;
            metrics.totalFrames += 1;

            if (detections.length === 0) {
              metrics.noFaceFrames += 1;
            } else {
              if (detections.length > 1) {
                metrics.multiFaceFrames += 1;
              }

              const box = detections[0]?.boundingBox;
              if (box) {
                const centerX = (box.originX + box.width / 2) / video.videoWidth;
                const centerY = (box.originY + box.height / 2) / video.videoHeight;
                if (centerX < 0.28 || centerX > 0.72 || centerY < 0.2 || centerY > 0.8) {
                  metrics.offCenterFrames += 1;
                }
              }
            }
          } catch (_) {
            // Ignore transient detector errors and keep sampling.
          }

          proctorLoopRef.current = setTimeout(runLoop, INTERVAL);
        };

        runLoop();
      } catch (_) {
        // Detector load failed; keep test flow running without blocking.
        localMetricsRef.current.cameraAvailable = false;
      }
    };

    startDetector();

    return () => {
      cancelled = true;
      clearTimeout(proctorLoopRef.current);
      if (detectorRef.current) {
        detectorRef.current.close();
        detectorRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [questions.length]);

  const handleFinish = useCallback(async () => {
    if (finished) return;
    setFinished(true);

    const questionScores = {};
    let finalScore = 0;
    questions.forEach((q, i) => {
      if (q.type === 'text') {
        const evalResult = scoreTextAnswer(q, answers[i]);
        questionScores[i] = evalResult;
        finalScore += evalResult.points;
      } else {
        const correct = answers[i] === q.answer;
        questionScores[i] = {
          points: correct ? 1 : 0,
          keywordRatio: null,
          overlapRatio: null,
        };
        finalScore += correct ? 1 : 0;
      }
    });

    clearTimeout(proctorLoopRef.current);
    if (detectorRef.current) {
      detectorRef.current.close();
      detectorRef.current = null;
    }

    const procResult = buildProctorResultFromMetrics(localMetricsRef.current);
    const proctorReport = buildProctorReport(localMetricsRef.current, procResult, {
      topic,
      difficulty,
      count,
    });

    try {
      localStorage.setItem(PROCTOR_REPORT_STORAGE_KEY, JSON.stringify(proctorReport));
    } catch (_) {
      // Ignore storage failures (private mode, quota, etc.).
    }

    try {
      await fetch('/api/proctoring/report/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proctorReport),
      });
    } catch (_) {
      // Ignore report upload failures for local-only runs.
    }

    // Stop browser camera preview
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    navigate('/dashboard/mock-results', {
      state: {
        questions,
        answers,
        score: Number(finalScore.toFixed(2)),
        maxScore: questions.length,
        questionScores,
        topic,
        difficulty,
        timeTaken: questions.length * 90 - timeLeft,
        proctor: procResult,
        proctorReport,
      },
    });
  }, [finished, questions, answers, navigate, topic, difficulty, timeLeft]);

  useEffect(() => {
    if (loading || error || questions.length === 0) return;
    if (timeLeft <= 0) { handleFinish(); return; }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, handleFinish, loading, error, questions]);

  // ── Camera check phase ────────────────────────────────────────────────────
  if (phase === 'cam-check') {
    return (
      <CameraCheckScreen
        topic={topic}
        difficulty={difficulty}
        count={count}
        checkVideoRef={checkVideoRef}
        camState={camState}
        camError={camError}
        onStart={() => {
          if (camState !== 'granted') return;
          setPhase('test');
        }}
      />
    );
  }

  if (loading) return <LoadingScreen topic={topic} difficulty={difficulty} />;
  if (error) return <ErrorScreen message={error} onRetry={fetchQuestions} />;

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const urgent = timeLeft < 60;

  function selectAnswer(idx) {
    setAnswers((prev) => ({ ...prev, [current]: idx }));
  }

  function setTextAnswer(value) {
    setAnswers((prev) => ({ ...prev, [current]: value }));
  }

  const answered = questions.reduce((acc, q, i) => acc + (isAnswered(q, answers[i]) ? 1 : 0), 0);
  const progress = ((current + 1) / questions.length) * 100;

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
            <Clock size={13} strokeWidth={2} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />{mins}:{secs}
          </div>
          <div className="test-topbar-right">
            <span className="proctor-pill">
              <ShieldCheck size={12} strokeWidth={2} />
              Proctored
            </span>
            <div className="test-progress-text">{answered}/{questions.length} answered</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="test-progress-bar">
          <div className="test-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Question */}
        <div className="test-card">
          <div className="test-q-counter">Question {current + 1} of {questions.length}</div>
          <h2 className="test-q-text">{questions[current]?.q}</h2>

          {questions[current]?.type === 'text' ? (
            <div className="test-text-wrap">
              <div className="test-text-label">Write your answer (syntax/code/plain text):</div>
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
      <div className="proctor-cam-wrap">
        <video ref={videoRef} autoPlay muted playsInline className="proctor-cam-video" />
        <div className="proctor-cam-bar">
          <ShieldCheck size={10} strokeWidth={2.5} />
          <span>Proctored · Live</span>
        </div>
      </div>

    </div>
  );
}


