import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './MockTest.css';

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
        <div style={{ fontSize: '3rem' }}>🤖</div>
        <h2 style={{ color: '#a78bfa', margin: 0 }}>Generating your test{dots}</h2>
        <p style={{ color: '#94a3b8', margin: 0 }}>AI is crafting 15 <strong style={{ color: '#e2e8f0' }}>{topic}</strong> questions at <strong style={{ color: '#e2e8f0' }}>{difficulty}</strong> difficulty</p>
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
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <h2 style={{ color: '#f87171', margin: 0 }}>Failed to Generate Test</h2>
        <p style={{ color: '#94a3b8', margin: 0, maxWidth: '400px', textAlign: 'center' }}>{message}</p>
        <button className="nav-btn submit-btn" onClick={onRetry}>🔄 Retry</button>
      </div>
    </div>
  );
}

export default function MockTest() {
  const location = useLocation();
  const navigate = useNavigate();
  const { topic = 'Data Structures', difficulty = 'Medium', count = 15 } = location.state || {};

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(count * 90);
  const [finished, setFinished] = useState(false);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-mock-test/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, difficulty, count }),
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

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleFinish = useCallback(() => {
    if (finished) return;
    setFinished(true);
    const finalScore = questions.filter((q, i) => answers[i] === q.answer).length;
    navigate('/dashboard/mock-results', {
      state: { questions, answers, score: finalScore, topic, difficulty, timeTaken: questions.length * 90 - timeLeft },
    });
  }, [finished, questions, answers, navigate, topic, difficulty, timeLeft]);

  useEffect(() => {
    if (loading || error || questions.length === 0) return;
    if (timeLeft <= 0) { handleFinish(); return; }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, handleFinish, loading, error, questions]);

  if (loading) return <LoadingScreen topic={topic} difficulty={difficulty} />;
  if (error) return <ErrorScreen message={error} onRetry={fetchQuestions} />;

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const urgent = timeLeft < 60;

  function selectAnswer(idx) {
    setAnswers((prev) => ({ ...prev, [current]: idx }));
  }

  const answered = Object.keys(answers).length;
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
            ⏱ {mins}:{secs}
          </div>
          <div className="test-progress-text">{answered}/{questions.length} answered</div>
        </div>

        {/* Progress bar */}
        <div className="test-progress-bar">
          <div className="test-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Question */}
        <div className="test-card">
          <div className="test-q-counter">Question {current + 1} of {questions.length}</div>
          <h2 className="test-q-text">{questions[current]?.q}</h2>

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
                className={`dot-btn ${i === current ? 'dot-current' : ''} ${answers[i] !== undefined ? 'dot-answered' : ''}`}
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
    </div>
  );
}


