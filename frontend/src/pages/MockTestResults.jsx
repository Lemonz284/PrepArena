import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, RotateCcw, LayoutDashboard, ShieldCheck, ShieldAlert, ShieldOff, AlertTriangle } from 'lucide-react';
import Navbar from '../components/Navbar';
import MockReviewPanel from '../components/MockReviewPanel';
import { usePrep } from '../context/PrepContext';
import './MockTestResults.css';

export default function MockTestResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const { questions = [], answers = {}, score = 0, maxScore = questions.length || 0, questionScores = {}, topic = '', difficulty = '', timeTaken = 0, proctor = null, proctorReport = null } = location.state || {};
  const PROCTOR_REPORT_STORAGE_KEY = 'mockTestProctorReport';

  const [storedReport, setStoredReport] = useState(proctorReport);
  const [storedProctor, setStoredProctor] = useState(proctor);

  const total = maxScore || questions.length;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const mins = Math.floor(timeTaken / 60);
  const secs = timeTaken % 60;
  const passed = pct >= 60;

  const { addSession } = usePrep();
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current || !total) return;
    savedRef.current = true;
    const now = new Date();
    addSession({
      id: Date.now(),
      type: 'AI Mock Test',
      topic: topic || 'General',
      score: `${score.toFixed(1)}/${total}`,
      pct,
      date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      dayKey: now.toISOString().slice(0, 10),
      status: passed ? 'Passed' : 'Failed',
    });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const circleCirc = 2 * Math.PI * 54; // r=54
  const offset = circleCirc - (pct / 100) * circleCirc;

  const reviewPayload = {
    topic: topic || 'General',
    difficulty: difficulty || 'Medium',
    score,
    maxScore: total,
    pct,
    timeTaken,
    proctor: storedProctor,
    questions: questions.map((q, i) => {
      const userAns = answers[i];
      const qEval = questionScores[i] || { points: userAns === q.answer ? 1 : 0 };
      return {
        q: q.q,
        type: q.type,
        expected_answer: q.expected_answer || null,
        expected_keywords: Array.isArray(q.expected_keywords) ? q.expected_keywords : [],
        user_answer: userAns ?? null,
        correct_answer: q.type === 'mcq' && Array.isArray(q.options) ? q.options[q.answer] : null,
        points: Number(qEval.points || 0),
      };
    }),
  };

  const handleDownloadReport = () => {
    if (!storedReport) return;
    const blob = new Blob([JSON.stringify(storedReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `proctor-report-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const deriveProctorFromReport = (report) => {
    if (!report || !report.metrics) return null;
    const totalFrames = Number(report.metrics.total_frames || 0);
    const noFace = Number(report.metrics.no_face_frames || 0);
    const offCenter = Number(report.metrics.off_center_frames || 0);
    const multiFace = Number(report.metrics.multi_face_frames || 0);
    const faceNotPct = totalFrames > 0 ? Number(((noFace / totalFrames) * 100).toFixed(1)) : 0.0;
    const validFaceFrames = Math.max(0, totalFrames - noFace);
    const awayPct = validFaceFrames > 0 ? Number(((offCenter / validFaceFrames) * 100).toFixed(1)) : 0.0;
    const multiPct = totalFrames > 0 ? Number(((multiFace / totalFrames) * 100).toFixed(1)) : 0.0;

    return {
      cheating: Boolean(report.verdict?.cheating),
      camera_available: Boolean(report.camera_available),
      face_not_in_frame_pct: faceNotPct,
      not_looking_pct: awayPct,
      multi_face_pct: multiPct,
      total_frames: totalFrames,
      flags: Array.isArray(report.verdict?.flags) ? report.verdict.flags : [],
      cheating_probability: report.verdict?.cheating_probability ?? null,
      provider: report.provider || 'mediapipe',
    };
  };

  useEffect(() => {
    if (storedReport || storedProctor) return;
    try {
      const raw = localStorage.getItem(PROCTOR_REPORT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setStoredReport(parsed);
      setStoredProctor(deriveProctorFromReport(parsed));
    } catch (_) {
      // Ignore storage errors.
    }
  }, [storedReport, storedProctor]);

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
                  <span className="res-meta-pill"><Clock size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />{mins}m {secs}s</span>
                  <span className={`res-meta-pill ${passed ? 'pill-pass' : 'pill-fail'}`}>
                    {passed ? <CheckCircle2 size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} /> : <XCircle size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />}{passed ? 'Passed' : 'Failed'}
                  </span>
                  <span className="res-meta-pill">{total} Questions</span>
                </div>
              </div>
            </div>

            {/* Proctoring Verdict */}
            {storedProctor && (
              <div className={`proctor-card ${storedProctor.camera_available ? (storedProctor.cheating ? 'proctor-cheat' : 'proctor-clean') : 'proctor-unavail'}`}>
                <div className="proctor-card-header">
                  {!storedProctor.camera_available ? (
                    <><ShieldOff size={18} strokeWidth={1.75} /><span>Proctoring Unavailable</span></>
                  ) : storedProctor.cheating ? (
                    <><ShieldAlert size={18} strokeWidth={1.75} /><span>Suspicious Activity Detected</span></>
                  ) : (
                    <><ShieldCheck size={18} strokeWidth={1.75} /><span>Session Clean</span></>
                  )}
                  <span className="proctor-frames">{storedProctor.total_frames} frames analysed</span>
                </div>

                {storedProctor.camera_available && (
                  <div className="proctor-stats">
                    <div className="proctor-stat">
                      <span className="pstat-label">Face absent</span>
                      <span className={`pstat-value ${storedProctor.face_not_in_frame_pct > 15 ? 'pstat-bad' : 'pstat-ok'}`}>
                        {storedProctor.face_not_in_frame_pct}%
                      </span>
                    </div>
                    <div className="proctor-stat">
                      <span className="pstat-label">Not at screen</span>
                      <span className={`pstat-value ${storedProctor.not_looking_pct > 20 ? 'pstat-bad' : 'pstat-ok'}`}>
                        {storedProctor.not_looking_pct}%
                      </span>
                    </div>
                    <div className="proctor-stat">
                      <span className="pstat-label">Multiple faces</span>
                      <span className={`pstat-value ${storedProctor.multi_face_pct > 5 ? 'pstat-bad' : 'pstat-ok'}`}>
                        {storedProctor.multi_face_pct}%
                      </span>
                    </div>
                  </div>
                )}

                {storedProctor.flags && storedProctor.flags.length > 0 && (
                  <ul className="proctor-flags">
                    {storedProctor.flags.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                )}
                {storedReport && (
                  <button className="res-btn res-btn-retake" onClick={handleDownloadReport}>
                    Download Proctor Report
                  </button>
                )}
                </div>
            )}

            {/* Per-question breakdown */}
            <h2 className="res-section-title">Answer Breakdown</h2>
            <div className="res-breakdown">
              {questions.map((q, i) => {
                const userAns = answers[i];
                const qEval = questionScores[i] || { points: userAns === q.answer ? 1 : 0 };
                const points = qEval.points || 0;
                const correct = points >= 1;
                const partial = points > 0 && points < 1;
                return (
                  <div key={i} className={`res-row ${correct ? 'row-correct' : partial ? 'row-partial' : 'row-wrong'}`}>
                    <div className={`res-row-num ${correct ? 'num-correct' : partial ? 'num-partial' : 'num-wrong'}`}>
                    {correct ? <CheckCircle2 size={15} strokeWidth={2} /> : partial ? <AlertTriangle size={15} strokeWidth={2} /> : <XCircle size={15} strokeWidth={2} />}
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
              <button
                className="res-btn res-btn-retake"
                onClick={() => navigate('/dashboard/mock-test-setup')}
              >
                <RotateCcw size={14} strokeWidth={2} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />New Test
              </button>
              <Link to="/dashboard" className="res-btn res-btn-dash">
                <LayoutDashboard size={14} strokeWidth={2} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />Dashboard
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
