import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, Clipboard, Clock, FileText, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import { usePrep } from '../context/PrepContext';
import './MockTestSetup.css';

const TOPICS = [
  'Data Structures', 'Algorithms', 'System Design',
  'Operating Systems', 'Databases', 'Networking',
  'Machine Learning', 'Web Development', 'Object-Oriented Design', 'Mathematics',
];

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const QUESTION_COUNTS = [5, 10, 15, 20];
const CUSTOM_COUNTS  = [12, 15, 20];

export default function MockTestSetup() {
  const navigate = useNavigate();
  const { resumeText, jdText, resumeName, jdName } = usePrep();

  const [mode, setMode]           = useState('standard'); // 'standard' | 'custom'
  const [topic, setTopic]         = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [count, setCount]         = useState(10);
  const [customCount, setCustomCount] = useState(15);
  const [customDiff,  setCustomDiff]  = useState('Medium');

  const hasResume = !!resumeText;
  const hasJd     = !!jdText;
  const docsReady = hasResume || hasJd;

  const canStartStandard = topic && difficulty && count;
  const canStartCustom   = docsReady;

  function handleStart() {
    if (mode === 'standard') {
      if (!canStartStandard) return;
      navigate('/dashboard/mock-test', { state: { topic, difficulty, count } });
    } else {
      if (!canStartCustom) return;
      navigate('/dashboard/mock-test', {
        state: {
          mode: 'custom',
          topic: 'Custom (Resume + JD)',
          difficulty: customDiff,
          count: customCount,
          resumeText,
          jdText,
        },
      });
    }
  }

  return (
    <div className="setup-root">
      <Navbar />
      <div className="setup-container">
        <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>

        <div className="setup-header">
          <div className="setup-icon"><Brain size={28} strokeWidth={1.75} /></div>
          <div>
            <h1 className="setup-title">AI Mock Test</h1>
            <p className="setup-sub">Configure your session and start when ready.</p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="mode-toggle-row">
          <button
            className={`mode-card ${mode === 'standard' ? 'mode-selected' : ''}`}
            onClick={() => setMode('standard')}
          >
            <Brain size={20} strokeWidth={1.75} />
            <span className="mode-card-title">Standard</span>
            <span className="mode-card-sub">Pick a topic &amp; difficulty</span>
          </button>
          <button
            className={`mode-card ${mode === 'custom' ? 'mode-selected mode-custom-selected' : ''}`}
            onClick={() => setMode('custom')}
          >
            <Sparkles size={20} strokeWidth={1.75} />
            <span className="mode-card-title">Custom <span className="mode-badge">AI Personalized</span></span>
            <span className="mode-card-sub">Based on your Resume &amp; JD</span>
          </button>
        </div>

        {/* ── STANDARD MODE ── */}
        {mode === 'standard' && (<>
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
                  <span className={`diff-dot diff-dot-${d.toLowerCase()}`} />
                  {d}
                </button>
              ))}
            </div>
          </div>

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

          {canStartStandard && (
            <div className="setup-summary">
              <span><Clipboard size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} /><strong>{count} {difficulty}</strong> questions on <strong>{topic}</strong></span>
              <span className="summary-time"><Clock size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />~{count * 1.5} min</span>
            </div>
          )}

          <button
            className={`start-btn ${canStartStandard ? 'active' : 'disabled'}`}
            onClick={handleStart}
            disabled={!canStartStandard}
          >
            Start Test →
          </button>
        </>)}

        {/* ── CUSTOM MODE ── */}
        {mode === 'custom' && (<>
          {/* Document status */}
          <div className="setup-block">
            <h2 className="setup-block-title">
              <span className="step-num">1</span> Uploaded Documents
            </h2>
            <div className="custom-docs-grid">
              <div className={`custom-doc-card ${hasResume ? 'doc-ready' : 'doc-missing'}`}>
                <div className="custom-doc-icon">
                  {hasResume
                    ? <CheckCircle2 size={18} strokeWidth={2} />
                    : <AlertCircle  size={18} strokeWidth={2} />}
                </div>
                <div className="custom-doc-info">
                  <span className="custom-doc-label">Resume</span>
                  <span className="custom-doc-name">{resumeName || 'Not uploaded'}</span>
                </div>
                <FileText size={16} strokeWidth={1.75} className="custom-doc-file-icon" />
              </div>
              <div className={`custom-doc-card ${hasJd ? 'doc-ready' : 'doc-missing'}`}>
                <div className="custom-doc-icon">
                  {hasJd
                    ? <CheckCircle2 size={18} strokeWidth={2} />
                    : <AlertCircle  size={18} strokeWidth={2} />}
                </div>
                <div className="custom-doc-info">
                  <span className="custom-doc-label">Job Description</span>
                  <span className="custom-doc-name">{jdName || 'Not uploaded'}</span>
                </div>
                <FileText size={16} strokeWidth={1.75} className="custom-doc-file-icon" />
              </div>
            </div>
            {!docsReady && (
              <p className="custom-docs-warn">
                Upload at least one document on the{' '}
                <Link to="/dashboard" className="custom-docs-link">Dashboard</Link>{' '}
                to use Custom mode.
              </p>
            )}
          </div>

          {/* Difficulty */}
          <div className="setup-block">
            <h2 className="setup-block-title">
              <span className="step-num">2</span> Select Difficulty
            </h2>
            <div className="difficulty-row">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  className={`diff-btn diff-${d.toLowerCase()} ${customDiff === d ? 'selected' : ''}`}
                  onClick={() => setCustomDiff(d)}
                >
                  <span className={`diff-dot diff-dot-${d.toLowerCase()}`} />
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="setup-block">
            <h2 className="setup-block-title">
              <span className="step-num">3</span> Number of Questions
            </h2>
            <div className="count-row">
              {CUSTOM_COUNTS.map((n) => (
                <button
                  key={n}
                  className={`count-btn ${customCount === n ? 'selected' : ''}`}
                  onClick={() => setCustomCount(n)}
                >
                  {n}
                  <span className="count-label">Qs</span>
                </button>
              ))}
            </div>
          </div>

          {docsReady && (
            <div className="setup-summary setup-summary-custom">
              <span><Sparkles size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} /><strong>{customCount} {customDiff}</strong> questions tailored to your documents</span>
              <span className="summary-time"><Clock size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />~{customCount * 1.5} min</span>
            </div>
          )}

          <button
            className={`start-btn ${canStartCustom ? 'active' : 'disabled'}`}
            onClick={handleStart}
            disabled={!canStartCustom}
          >
            Start Custom Test →
          </button>
        </>)}
      </div>
    </div>
  );
}
