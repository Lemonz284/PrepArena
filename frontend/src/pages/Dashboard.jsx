import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { usePrep } from '../context/PrepContext';
import { extractTextFromFile } from '../utils/extractText';
import { extractKeywords } from '../utils/extractKeywords';
import './Dashboard.css';

const STATS = [
  { label: 'Sessions Done', value: '12', icon: '🎯' },
  { label: 'Avg Score',     value: '74%', icon: '📊' },
  { label: 'Day Streak',    value: '5',   icon: '🔥' },
  { label: 'Best Score',    value: '96%', icon: '🏆' },
];

const RECENT_SESSIONS = [
  { id: 1, type: 'AI Mock Test', topic: 'Data Structures', score: '8/10', date: 'Feb 28, 2026', status: 'Passed' },
  { id: 2, type: 'AI Interview', topic: 'Google – SWE L4', score: '82%', date: 'Feb 26, 2026', status: 'Reviewed' },
  { id: 3, type: 'AI Mock Test', topic: 'System Design', score: '6/10', date: 'Feb 24, 2026', status: 'Passed' },
  { id: 4, type: 'AI Mock Test', topic: 'Algorithms', score: '4/10', date: 'Feb 22, 2026', status: 'Failed' },
  { id: 5, type: 'AI Interview', topic: 'Meta – ML Engineer', score: '71%', date: 'Feb 20, 2026', status: 'Reviewed' },
];

export default function Dashboard() {
  const {
    resumeText, setResumeText, resumeName, setResumeName,
    jdText,     setJdText,     jdName,     setJdName,
    keywords,   setKeywords,   clearContext,
  } = usePrep();

  const [resumeLoading, setResumeLoading] = useState(false);
  const [jdLoading,     setJdLoading]     = useState(false);
  const [resumeDrag,    setResumeDrag]    = useState(false);
  const [jdDrag,        setJdDrag]        = useState(false);
  const resumeRef = useRef();
  const jdRef     = useRef();

  const contextReady = !!(resumeText || jdText);

  function recomputeKeywords(resume, jd) {
    setKeywords(extractKeywords(resume || '', jd || ''));
  }

  async function handleResumeFile(file) {
    setResumeLoading(true);
    try {
      const text = await extractTextFromFile(file);
      setResumeText(text); setResumeName(file.name);
      recomputeKeywords(text, jdText);
    } finally { setResumeLoading(false); }
  }

  async function handleJdFile(file) {
    setJdLoading(true);
    try {
      const text = await extractTextFromFile(file);
      setJdText(text); setJdName(file.name);
      recomputeKeywords(resumeText, text);
    } finally { setJdLoading(false); }
  }

  return (
    <div className="db-root">
      <Navbar />
      <div className="db-container">

        {/* Welcome */}
        <div className="db-welcome">
          <div>
            <h1 className="db-welcome-title">Welcome back 👋</h1>
            <p className="db-welcome-sub">Upload your resume and job description to personalise your prep.</p>
          </div>
          <div className="db-date">March 1, 2026</div>
        </div>

        {/* ── UPLOAD CONTEXT SECTION ── */}
        <div className="ctx-section">
          <div className="ctx-section-header">
            <div className="ctx-title-block">
              <span className="ctx-title-icon">📂</span>
              <div>
                <h2 className="ctx-title">Your Prep Context</h2>
                <p className="ctx-subtitle">
                  Upload your CV/Resume and Job Description. Keywords are extracted automatically
                  and used to personalise <strong>both</strong> your Mock Test and AI Interview.
                </p>
              </div>
            </div>
            {contextReady && (
              <button className="ctx-clear-btn" onClick={clearContext}>✕ Clear All</button>
            )}
          </div>

          <div className="ctx-upload-grid">
            <DropCard
              label="Your CV / Resume"
              hint="PDF, DOC or TXT · Max 5 MB"
              icon="📄" activeIcon="✅"
              accept=".pdf,.doc,.docx,.txt"
              fileName={resumeName} loading={resumeLoading}
              drag={resumeDrag} setDrag={setResumeDrag}
              inputRef={resumeRef} onFile={handleResumeFile}
              onRemove={() => { setResumeText(''); setResumeName(''); recomputeKeywords('', jdText); }}
            />
            <DropCard
              label="Job Description"
              hint="PDF, DOC or TXT · Max 5 MB"
              icon="📋" activeIcon="✅"
              accept=".pdf,.doc,.docx,.txt"
              fileName={jdName} loading={jdLoading}
              drag={jdDrag} setDrag={setJdDrag}
              inputRef={jdRef} onFile={handleJdFile}
              onRemove={() => { setJdText(''); setJdName(''); recomputeKeywords(resumeText, ''); }}
            />
          </div>

          {keywords.length > 0 && (
            <div className="ctx-keywords">
              <div className="ctx-kw-header">
                <span className="ctx-kw-title">
                  🔑 Extracted Keywords
                  <span className="ctx-kw-count">{keywords.length}</span>
                </span>
                <span className="ctx-kw-sub">These shape your Mock Test topics and AI Interview questions</span>
              </div>
              <div className="ctx-kw-chips">
                {keywords.map((kw) => (
                  <span key={kw} className="ctx-kw-chip">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {!contextReady && (
            <p className="ctx-empty-note">
              ℹ️ You can still use all modes without uploading — questions will use default topics.
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="db-stats">
          {STATS.map((s) => (
            <div className="stat-card" key={s.label}>
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Mode Cards */}
        <h2 className="db-section-title">Choose your mode</h2>
        <div className="db-modes">

          <Link to="/dashboard/mock-test-setup" className="mode-card mode-mock">
            <div className="mode-card-icon">🧠</div>
            <div className="mode-card-body">
              <h3>AI Mock Test</h3>
              <p>{contextReady
                ? 'Questions will be tailored to your uploaded resume and job description.'
                : 'Answer MCQs by topic and difficulty. Timer runs. Results saved automatically.'}
              </p>
              <ul className="mode-card-bullets">
                <li>✓ {contextReady ? `${keywords.length} keywords extracted` : 'Choose topic & difficulty'}</li>
                <li>✓ Timed quiz experience</li>
                <li>✓ Instant score &amp; analytics</li>
              </ul>
            </div>
            {contextReady && <span className="mode-ctx-badge mode-ctx-yellow">Context Ready ✓</span>}
            <span className="mode-card-arrow">→</span>
          </Link>

          <Link to="/dashboard/interview-setup" className="mode-card mode-interview">
            <div className="mode-card-icon">🎤</div>
            <div className="mode-card-body">
              <h3>AI Interview</h3>
              <p>{contextReady
                ? 'Context loaded — your resume and JD are ready. Start your interview directly.'
                : 'Upload your resume and job description. Our AI conducts a contextual interview round.'}
              </p>
              <ul className="mode-card-bullets">
                <li>✓ {contextReady ? 'Context pre-loaded ✓' : 'Resume + JD aware questions'}</li>
                <li>✓ Speech or text answers</li>
                <li>✓ Performance report generated</li>
              </ul>
            </div>
            {contextReady && <span className="mode-ctx-badge mode-ctx-purple">Context Ready ✓</span>}
            <span className="mode-card-arrow">→</span>
          </Link>

          <div className="mode-card mode-resume" style={{ cursor: 'pointer' }}
            onClick={() => document.getElementById('recent-sessions').scrollIntoView({ behavior: 'smooth' })}>
            <div className="mode-card-icon">📂</div>
            <div className="mode-card-body">
              <h3>Resume Previous Session</h3>
              <p>Pick up where you left off. Review past sessions, read AI feedback, or retake any test.</p>
              <ul className="mode-card-bullets">
                <li>✓ Full session history</li>
                <li>✓ Re-read AI feedback</li>
                <li>✓ Retake any session</li>
              </ul>
            </div>
            <span className="mode-card-arrow">↓</span>
          </div>

        </div>

        {/* Recent Sessions */}
        <h2 className="db-section-title" id="recent-sessions">Recent Sessions</h2>
        <div className="sessions-table-wrap">
          <table className="sessions-table">
            <thead>
              <tr>
                <th>Type</th><th>Topic</th><th>Score</th>
                <th>Date</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_SESSIONS.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className={`type-badge ${s.type === 'AI Mock Test' ? 'badge-mock' : 'badge-interview'}`}>
                      {s.type === 'AI Mock Test' ? '🧠' : '🎤'} {s.type}
                    </span>
                  </td>
                  <td>{s.topic}</td>
                  <td><strong>{s.score}</strong></td>
                  <td className="date-cell">{s.date}</td>
                  <td><span className={`status-badge status-${s.status.toLowerCase()}`}>{s.status}</span></td>
                  <td><button className="retake-btn">Retake</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

/* ── Reusable drop card ── */
function DropCard({ label, hint, icon, activeIcon, accept, fileName, loading, drag, setDrag, inputRef, onFile, onRemove }) {
  return (
    <div className="ctx-drop-card">
      <div className="ctx-drop-label">{label}</div>
      <div
        className={`ctx-drop-zone ${drag ? 'dragging' : ''} ${fileName ? 'has-file' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
        onClick={() => !fileName && inputRef.current.click()}
      >
        {loading ? (
          <div className="ctx-spinner-wrap"><div className="ctx-spinner" /></div>
        ) : fileName ? (
          <div className="ctx-file-info">
            <span className="ctx-file-icon">{activeIcon}</span>
            <span className="ctx-file-name">{fileName}</span>
            <button className="ctx-file-remove" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
              ✕ Remove
            </button>
          </div>
        ) : (
          <>
            <span className="ctx-drop-icon">{icon}</span>
            <span className="ctx-drop-text">Drag & drop or <u>browse</u></span>
            <span className="ctx-drop-hint">{hint}</span>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} hidden
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ''; }}
      />
    </div>
  );
}
