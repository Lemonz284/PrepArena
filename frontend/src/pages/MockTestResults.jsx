import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, RotateCcw, LayoutDashboard, ShieldCheck, ShieldAlert, ShieldOff, AlertTriangle } from 'lucide-react';
import Navbar from '../components/Navbar';
import MockReviewPanel from '../components/MockReviewPanel';
import { usePrep } from '../context/PrepContext';
import './MockTestResults.css';

const PROCTOR_REPORT_STORAGE_KEY = 'mockTestProctorReport';

// FIX #7: instead of re-deriving percentages from raw counts (which used a
// slightly different formula than buildProctorResultFromMetrics in MockTest),
// we read the fully-computed result that was baked into the report at save time.
function extractProctorFromReport(report) {
  if (!report) return null;

  // If the report carries a fully-computed result object, use it directly.
  if (report.result) return report.result;

  const totalFrames     = Number(report.metrics?.total_frames      || 0);
  const noFaceFrames    = Number(report.metrics?.no_face_frames    || 0);
  const offCenterFrames = Number(report.metrics?.off_center_frames || 0);
  const multiFaceFrames = Number(report.metrics?.multi_face_frames || 0);

  const cameraAvailable = Boolean(report.camera_available);

  // When camera was not available at all, return a clean unavailable result.
  if (!cameraAvailable) {
    return {
      cheating: false, camera_available: false,
      face_not_in_frame_pct: 0.0, not_looking_pct: 0.0, multi_face_pct: 0.0,
      total_frames: totalFrames, flags: [], cheating_probability: null,
      provider: 'mediapipe', no_frames: true,
    };
  }

  // Camera WAS available but detector never ran (e.g. MediaPipe CDN slow,
  // very short test, or detector failed to initialise).
  if (totalFrames === 0) {
    return {
      cheating: false, camera_available: true,
      face_not_in_frame_pct: 0.0, not_looking_pct: 0.0, multi_face_pct: 0.0,
      total_frames: 0, flags: [], cheating_probability: null,
      provider: 'mediapipe', no_frames: true,
    };
  }

  const FACE_MISSING_THRESHOLD = report.thresholds?.face_missing_pct ?? 15.0;
  const LOOK_AWAY_THRESHOLD    = report.thresholds?.look_away_pct    ?? 25.0;
  const MULTI_FACE_THRESHOLD   = report.thresholds?.multi_face_pct   ??  5.0;

  const faceNotPct      = Number(((noFaceFrames / totalFrames) * 100).toFixed(1));
  const validFaceFrames = Math.max(0, totalFrames - noFaceFrames);
  const awayPct         = Number(((validFaceFrames > 0 ? offCenterFrames / validFaceFrames : 0) * 100).toFixed(1));
  const multiPct        = Number(((multiFaceFrames / totalFrames) * 100).toFixed(1));

  const flags = [];
  if (faceNotPct > FACE_MISSING_THRESHOLD) flags.push(`Face absent ${faceNotPct}% of the time`);
  if (awayPct    > LOOK_AWAY_THRESHOLD)    flags.push(`Not looking at screen ${awayPct}% of the time`);
  if (multiPct   > MULTI_FACE_THRESHOLD)   flags.push(`Multiple people detected in ${multiPct}% of frames`);

  const cheatingProbability = Number(
    Math.min(1, Math.max(0,
      (faceNotPct / 100) * 0.5 +
      (awayPct    / 100) * 0.35 +
      (multiPct   / 100) * 0.15
    )).toFixed(3)
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
    provider: report.provider || 'mediapipe',
    no_frames: false,
  };
}

export default function MockTestResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    questions      = [],
    answers        = {},
    score          = 0,
    maxScore       = questions.length || 0,
    questionScores = {},
    topic          = '',
    difficulty     = '',
    timeTaken      = 0,
    proctor        = null,
    proctorReport  = null,
  } = location.state || {};

  const [storedReport,  setStoredReport]  = useState(proctorReport);
  const [storedProctor, setStoredProctor] = useState(proctor);

  const total  = maxScore || questions.length;
  const pct    = total > 0 ? Math.round((score / total) * 100) : 0;
  const mins   = Math.floor(timeTaken / 60);
  const secs   = timeTaken % 60;
  const passed = pct >= 60;

  const { addSession } = usePrep();
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current || !total) return;
    savedRef.current = true;
    const now = new Date();
    addSession({
      id:     Date.now(),
      type:   'AI Mock Test',
      topic:  topic || 'General',
      score:  `${score.toFixed(1)}/${total}`,
      pct,
      date:   now.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
      dayKey: now.toISOString().slice(0, 10),
      status: passed ? 'Passed' : 'Failed',
    });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure we always have a derived proctor summary when a report exists.
  useEffect(() => {
    if (storedProctor || !storedReport) return;
    setStoredProctor(extractProctorFromReport(storedReport));
  }, [storedReport, storedProctor]);

  // Fallback: if results were navigated from history (no state), load from localStorage
  useEffect(() => {
    if (storedReport || storedProctor) return;
    try {
      const raw = localStorage.getItem(PROCTOR_REPORT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setStoredReport(parsed);
      setStoredProctor(extractProctorFromReport(parsed));
    } catch (_) { /* ignore */ }
  }, [storedReport, storedProctor]);

  const circleCirc = 2 * Math.PI * 54;
  const offset     = circleCirc - (pct / 100) * circleCirc;

  const reviewPayload = {
    topic:      topic || 'General',
    difficulty: difficulty || 'Medium',
    score,
    maxScore: total,
    pct,
    timeTaken,
    proctor: storedProctor,
    questions: questions.map((q, i) => {
      const userAns = answers[i];
      const qEval   = questionScores[i] || { points: userAns === q.answer ? 1 : 0 };
      return {
        q:                  q.q,
        type:               q.type,
        expected_answer:    q.expected_answer    || null,
        expected_keywords:  Array.isArray(q.expected_keywords) ? q.expected_keywords : [],
        user_answer:        userAns ?? null,
        correct_answer:     q.type === 'mcq' && Array.isArray(q.options) ? q.options[q.answer] : null,
        points:             Number(qEval.points || 0),
      };
    }),
  };

  function handleDownloadReport() {
    if (!storedReport) return;
    const blob = new Blob([JSON.stringify(storedReport, null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `proctor-report-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="res-root">
      <Navbar />
      <div className="res-container">
        <div className="res-layout">
          <div className="res-main">

            {/* Hero score */}
            <div className="res-hero">
              <div className="res-circle-wrap">
                <svg className="res-circle-svg" viewBox="0 0 120 120">
                  <circle className="circle-bg" cx="60" cy="60" r="54" />
                  <circle
                    className={`circle-fill ${passed ? 'fill-pass' : 'fill-fail'}`}
                    cx="60" cy="60" r="54"
                    strokeDasharray={circleCirc}
                    strokeDashoffset={offset}
                  />
                </svg>
                <div className="res-circle-text">
                  <span className="circle-pct">{pct}%</span>
                  <span className="circle-label">{passed ? 'Pass' : 'Fail'}</span>
                </div>
              </div>

              <div className="res-hero-info">
                <h1 className="res-title">{passed ? 'Nice work!' : 'Keep practising.'}</h1>
                <p className="res-sub">
                  You scored <strong>{score.toFixed(1)}/{total}</strong> on <strong>{topic}</strong> ({difficulty})
                </p>
                <div className="res-meta-row">
                  <span className="res-meta-pill">
                    <Clock size={12} strokeWidth={2} style={{ verticalAlign:'middle', marginRight:'0.25rem' }} />
                    {mins}m {secs}s
                  </span>
                  <span className={`res-meta-pill ${passed ? 'pill-pass' : 'pill-fail'}`}>
                    {passed
                      ? <CheckCircle2 size={12} strokeWidth={2} style={{ verticalAlign:'middle', marginRight:'0.25rem' }} />
                      : <XCircle      size={12} strokeWidth={2} style={{ verticalAlign:'middle', marginRight:'0.25rem' }} />}
                    {passed ? 'Passed' : 'Failed'}
                  </span>
                  <span className="res-meta-pill">{total} Questions</span>
                </div>
              </div>
            </div>

            {/* Proctoring card — always show if we have any proctor data */}
            {(storedProctor || storedReport) && (() => {
              const p = storedProctor;
              const noCamera  = !p || !p.camera_available;
              const noFrames  = p?.no_frames === true || (p?.camera_available && p?.total_frames === 0);
              const isCheating = p?.cheating && !noFrames;
              const cardClass = noCamera
                ? 'proctor-unavail'
                : isCheating
                ? 'proctor-cheat'
                : 'proctor-clean';

              return (
                <div className={`proctor-card ${cardClass}`}>
                  <div className="proctor-card-header">
                    {noCamera ? (
                      <><ShieldOff   size={18} strokeWidth={1.75} /><span>Camera Not Available</span></>
                    ) : isCheating ? (
                      <><ShieldAlert size={18} strokeWidth={1.75} /><span>Suspicious Activity Detected</span></>
                    ) : (
                      <><ShieldCheck size={18} strokeWidth={1.75} /><span>Session Clean</span></>
                    )}
                    {p && (
                      <span className="proctor-frames">
                        {p.total_frames} frame{p.total_frames !== 1 ? 's' : ''} analysed
                      </span>
                    )}
                  </div>

                  {noFrames && p?.camera_available && (
                    <div className="proctor-noframes-note">
                      ⚠ Camera was active but the face detector didn't process any frames
                      (the test may have been too short, or the face detector was still loading).
                      No integrity score is available for this session.
                    </div>
                  )}

                  {/* Stats grid — show when camera was available */}
                  {p && p.camera_available && !noFrames && (
                    <div className="proctor-stats">
                      <div className="proctor-stat">
                        <span className="pstat-label">Face absent</span>
                        <span className={`pstat-value ${p.face_not_in_frame_pct > 15 ? 'pstat-bad' : 'pstat-ok'}`}>
                          {p.face_not_in_frame_pct}%
                        </span>
                      </div>
                      <div className="proctor-stat">
                        <span className="pstat-label">Off-center</span>
                        <span className={`pstat-value ${p.not_looking_pct > 25 ? 'pstat-bad' : 'pstat-ok'}`}>
                          {p.not_looking_pct}%
                        </span>
                      </div>
                      <div className="proctor-stat">
                        <span className="pstat-label">Multi-face</span>
                        <span className={`pstat-value ${p.multi_face_pct > 5 ? 'pstat-bad' : 'pstat-ok'}`}>
                          {p.multi_face_pct}%
                        </span>
                      </div>
                      {p.window_switches !== undefined && (
                        <div className="proctor-stat" title="Number of times you navigated away from the test tab">
                          <span className="pstat-label">Tab Switches</span>
                          <span className={`pstat-value ${p.window_switches > 0 ? 'pstat-bad' : 'pstat-ok'}`}>
                            {p.window_switches}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {p?.flags?.length > 0 && (
                    <ul className="proctor-flags">
                      {p.flags.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  )}

                  {storedReport && (
                    <button
                      className="res-btn res-btn-retake"
                      style={{ marginTop:'0.75rem' }}
                      onClick={handleDownloadReport}
                    >
                      ⬇ Download Proctor Report
                    </button>
                  )}
                </div>
              );
            })()}



            {/* Per-question breakdown */}
            <h2 className="res-section-title">Answer Breakdown</h2>
            <div className="res-breakdown">
              {questions.map((q, i) => {
                const userAns = answers[i];
                const qEval   = questionScores[i] || { points: userAns === q.answer ? 1 : 0 };
                const points  = qEval.points || 0;
                const correct = points >= 1;
                const partial = points > 0 && points < 1;
                return (
                  <div key={i} className={`res-row ${correct ? 'row-correct' : partial ? 'row-partial' : 'row-wrong'}`}>
                    <div className={`res-row-num ${correct ? 'num-correct' : partial ? 'num-partial' : 'num-wrong'}`}>
                      {correct
                        ? <CheckCircle2  size={15} strokeWidth={2} />
                        : partial
                          ? <AlertTriangle size={15} strokeWidth={2} />
                          : <XCircle       size={15} strokeWidth={2} />}
                    </div>
                    <div className="res-row-body">
                      <p className="res-q-text">Q{i + 1}. {q.q}</p>
                      <div className="res-ans-row">
                        <span className={`ans-pill ${correct ? 'ans-correct' : partial ? 'ans-partial' : 'ans-wrong'}`}>
                          Score: {points.toFixed(1)} / 1.0
                        </span>
                        {q.type === 'text' ? (
                          <>
                            <span className={`ans-pill ${String(userAns || '').trim() ? 'ans-partial' : 'ans-wrong'}`}>
                              Your answer: {String(userAns || '').trim() || 'Not answered'}
                            </span>
                            <span className="ans-pill ans-correct">
                              Expected: {q.expected_answer || 'N/A'}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className={`ans-pill ${correct ? 'ans-correct' : 'ans-wrong'}`}>
                              Your answer: {userAns !== undefined ? q.options[userAns] : 'Not answered'}
                            </span>
                            {!correct && (
                              <span className="ans-pill ans-correct">
                                Correct: {q.options[q.answer]}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="res-actions">
              <button className="res-btn res-btn-retake" onClick={() => navigate('/dashboard/mock-test-setup')}>
                <RotateCcw size={14} strokeWidth={2} style={{ marginRight:'0.4rem', verticalAlign:'middle' }} />New Test
              </button>
              <Link to="/dashboard" className="res-btn res-btn-dash">
                <LayoutDashboard size={14} strokeWidth={2} style={{ marginRight:'0.4rem', verticalAlign:'middle' }} />Dashboard
              </Link>
            </div>
          </div>

          <aside className="res-side">
            <MockReviewPanel reviewPayload={reviewPayload} />
          </aside>
        </div>
      </div>
    </div>
  );
}
