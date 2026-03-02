import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './MockTestSetup.css';

const TOPICS = [
  'Data Structures', 'Algorithms', 'System Design',
  'Operating Systems', 'Databases', 'Networking',
  'Machine Learning', 'Web Development', 'Object-Oriented Design', 'Mathematics',
];

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const QUESTION_COUNTS = [5, 10, 15, 20];

export default function MockTestSetup() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [count, setCount] = useState(10);

  const canStart = topic && difficulty && count;

  function handleStart() {
    if (!canStart) return;
    navigate('/dashboard/mock-test', { state: { topic, difficulty, count } });
  }

  return (
    <div className="setup-root">
      <Navbar />
      <div className="setup-container">
        <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>

        <div className="setup-header">
          <div className="setup-icon">🧠</div>
          <div>
            <h1 className="setup-title">AI Mock Test</h1>
            <p className="setup-sub">Configure your session and start when ready.</p>
          </div>
        </div>

        {/* Step 1 – Topic */}
        <div className="setup-block">
          <h2 className="setup-block-title">
            <span className="step-num">1</span> Choose a Topic
          </h2>
          <div className="topic-grid">
            {TOPICS.map((t) => (
              <button
                key={t}
                className={`topic-chip ${topic === t ? 'selected' : ''}`}
                onClick={() => setTopic(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2 – Difficulty */}
        <div className="setup-block">
          <h2 className="setup-block-title">
            <span className="step-num">2</span> Select Difficulty
          </h2>
          <div className="difficulty-row">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                className={`diff-btn diff-${d.toLowerCase()} ${difficulty === d ? 'selected' : ''}`}
                onClick={() => setDifficulty(d)}
              >
                <span className="diff-icon">
                  {d === 'Easy' ? '🟢' : d === 'Medium' ? '🟡' : '🔴'}
                </span>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3 – Count */}
        <div className="setup-block">
          <h2 className="setup-block-title">
            <span className="step-num">3</span> Number of Questions
          </h2>
          <div className="count-row">
            {QUESTION_COUNTS.map((n) => (
              <button
                key={n}
                className={`count-btn ${count === n ? 'selected' : ''}`}
                onClick={() => setCount(n)}
              >
                {n}
                <span className="count-label">Qs</span>
              </button>
            ))}
          </div>
        </div>

        {/* Summary + Start */}
        {canStart && (
          <div className="setup-summary">
            <span>📋 <strong>{count} {difficulty}</strong> questions on <strong>{topic}</strong></span>
            <span className="summary-time">⏱ ~{count * 1.5} min</span>
          </div>
        )}

        <button
          className={`start-btn ${canStart ? 'active' : 'disabled'}`}
          onClick={handleStart}
          disabled={!canStart}
        >
          Start Test →
        </button>
      </div>
    </div>
  );
}
