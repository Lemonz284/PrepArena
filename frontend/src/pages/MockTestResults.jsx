import { useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './MockTestResults.css';

export default function MockTestResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const { questions = [], answers = {}, score = 0, topic = '', difficulty = '', timeTaken = 0 } = location.state || {};

  const total = questions.length;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const mins = Math.floor(timeTaken / 60);
  const secs = timeTaken % 60;
  const passed = pct >= 60;

  const circleCirc = 2 * Math.PI * 54; // r=54
  const offset = circleCirc - (pct / 100) * circleCirc;

  return (
    <div className="res-root">
      <Navbar />
      <div className="res-container">

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
              <span className="circle-label">{passed ? '✓ Pass' : '✗ Fail'}</span>
            </div>
          </div>

          <div className="res-hero-info">
            <h1 className="res-title">{passed ? '🎉 Nice work!' : '📚 Keep practising!'}</h1>
            <p className="res-sub">
              You scored <strong>{score}/{total}</strong> on <strong>{topic}</strong> ({difficulty})
            </p>
            <div className="res-meta-row">
              <span className="res-meta-pill">⏱ {mins}m {secs}s</span>
              <span className={`res-meta-pill ${passed ? 'pill-pass' : 'pill-fail'}`}>
                {passed ? '✓ Passed' : '✗ Failed'}
              </span>
              <span className="res-meta-pill">📋 {total} Questions</span>
            </div>
          </div>
        </div>

        {/* Per-question breakdown */}
        <h2 className="res-section-title">Answer Breakdown</h2>
        <div className="res-breakdown">
          {questions.map((q, i) => {
            const userAns = answers[i];
            const correct = userAns === q.answer;
            return (
              <div key={i} className={`res-row ${correct ? 'row-correct' : 'row-wrong'}`}>
                <div className="res-row-num">{correct ? '✓' : '✗'}</div>
                <div className="res-row-body">
                  <p className="res-q-text">Q{i + 1}. {q.q}</p>
                  <div className="res-ans-row">
                    <span className={`ans-pill ${correct ? 'ans-correct' : 'ans-wrong'}`}>
                      Your answer: {userAns !== undefined ? q.options[userAns] : 'Not answered'}
                    </span>
                    {!correct && (
                      <span className="ans-pill ans-correct">
                        Correct: {q.options[q.answer]}
                      </span>
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
            🔁 New Test
          </button>
          <Link to="/dashboard" className="res-btn res-btn-dash">
            🏠 Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}
