import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { usePrep } from '../context/PrepContext';
import { extractTextFromFile } from '../utils/extractText';
import { extractKeywords } from '../utils/extractKeywords';
import './Dashboard.css';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

function pad(n) { return String(n).padStart(2, '0'); }
function dateKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

function computeStreak(sessions) {
  if (!sessions.length) return 0;
  const days = [...new Set(sessions.map(s => s.dayKey).filter(Boolean))].sort().reverse();
  if (!days.length) return 0;
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const yestKey  = new Date(now - 86400000).toISOString().slice(0, 10);
  if (days[0] !== todayKey && days[0] !== yestKey) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i - 1]) - new Date(days[i])) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

export default function Dashboard() {
  const {
    resumeText, setResumeText, resumeName, setResumeName,
    jdText,     setJdText,     jdName,     setJdName,
    keywords,   setKeywords,   clearContext,
    sessions,
  } = usePrep();

  // Compute live stats
  const scoredSessions = sessions.filter(s => s.pct !== null);
  const avgScore  = scoredSessions.length ? Math.round(scoredSessions.reduce((a, s) => a + s.pct, 0) / scoredSessions.length) : null;
  const bestScore = scoredSessions.length ? Math.max(...scoredSessions.map(s => s.pct)) : null;
  const streak    = computeStreak(sessions);
  const STATS = [
    { label: 'Sessions Done', value: String(sessions.length),             icon: '🎯' },
    { label: 'Avg Score',     value: avgScore  !== null ? `${avgScore}%`  : '—', icon: '📊' },
    { label: 'Day Streak',    value: String(streak),                       icon: '🔥' },
    { label: 'Best Score',    value: bestScore !== null ? `${bestScore}%` : '—', icon: '🏆' },
  ];

  const [resumeLoading, setResumeLoading] = useState(false);
  const [jdLoading,     setJdLoading]     = useState(false);
  const [resumeDrag,    setResumeDrag]    = useState(false);
  const [jdDrag,        setJdDrag]        = useState(false);
  const resumeRef = useRef();
  const jdRef     = useRef();

  // Calendar state — default to current month (March 2026)
  const today = new Date(2026, 2, 3); // March 3 2026
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  // Real schedule: array of { id, date: 'YYYY-MM-DD', type: 'mock'|'interview', topic }
  const [schedule, setSchedule] = useState([]);

  // Scheduling form state
  const minDate = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const [formDate,  setFormDate]  = useState('');
  const [formType,  setFormType]  = useState('mock');
  const [formTopic, setFormTopic] = useState('');
  const [formError, setFormError] = useState('');

  // Build calendar map from real schedule entries
  const scheduleMap = schedule.reduce((acc, s) => {
    if (acc[s.date]) {
      acc[s.date] = acc[s.date] === s.type ? acc[s.date] : 'both';
    } else {
      acc[s.date] = s.type;
    }
    return acc;
  }, {});

  function addSchedule(e) {
    e.preventDefault();
    if (!formDate) { setFormError('Please pick a date.'); return; }
    setFormError('');
    setSchedule(prev => [
      ...prev,
      { id: Date.now(), date: formDate, type: formType, topic: formTopic.trim() }
    ]);
    setFormDate('');
    setFormTopic('');
    // Navigate calendar to the scheduled month
    const [y, m] = formDate.split('-').map(Number);
    setCalYear(y);
    setCalMonth(m - 1);
  }

  function removeSchedule(id) {
    setSchedule(prev => prev.filter(s => s.id !== id));
  }

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

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }

  /* Build calendar grid (Mon-first weeks) */
  const firstDay  = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1); // shift so Mon=0
  const totalCells  = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const day = i - startOffset + 1;
    return (day >= 1 && day <= daysInMonth) ? day : null;
  });

  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  // Count scheduled sessions in the viewed month
  const monthScheduled = schedule.filter(s => {
    const [y, m] = s.date.split('-').map(Number);
    return y === calYear && m === calMonth + 1;
  });

  // Upcoming sessions sorted
  const upcomingSessions = [...schedule]
    .filter(s => s.date >= minDate)
    .sort((a, b) => a.date.localeCompare(b.date));

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

        {/* ── TOP GRID: Upload Context + Calendar ── */}
        <div className="db-top-grid">

          {/* ── Left column: context upload + scheduler ── */}
          <div className="db-top-left">

            {/* Upload Context (compact) */}
            <div className="ctx-section">
              <div className="ctx-section-header">
                <div className="ctx-title-block">
                  <span className="ctx-title-icon">📂</span>
                  <div>
                    <h2 className="ctx-title">Your Prep Context</h2>
                    <p className="ctx-subtitle">
                      Upload your CV/Resume and Job Description to personalise your sessions.
                    </p>
                  </div>
                </div>
                {contextReady && (
                  <button className="ctx-clear-btn" onClick={clearContext}>✕ Clear</button>
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
                    <span className="ctx-kw-sub">Shaping your Mock Test &amp; AI Interview</span>
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

            {/* ── Schedule a Session ── */}
            <div className="sched-section">
              <div className="sched-header">
                <span className="sched-header-icon">📅</span>
                <div>
                  <h2 className="sched-title">Schedule a Session</h2>
                  <p className="sched-subtitle">Plan ahead — scheduled sessions appear on the calendar.</p>
                </div>
              </div>

              <form className="sched-form" onSubmit={addSchedule}>
                <div className="sched-form-row">
                  {/* Date */}
                  <div className="sched-field">
                    <label className="sched-label">Date</label>
                    <input
                      type="date"
                      className="sched-input"
                      min={minDate}
                      value={formDate}
                      onChange={e => { setFormDate(e.target.value); setFormError(''); }}
                    />
                  </div>
                  {/* Type */}
                  <div className="sched-field">
                    <label className="sched-label">Session Type</label>
                    <div className="sched-type-btns">
                      <button
                        type="button"
                        className={`sched-type-btn ${formType === 'mock' ? 'active-mock' : ''}`}
                        onClick={() => setFormType('mock')}
                      >🧠 Mock Test</button>
                      <button
                        type="button"
                        className={`sched-type-btn ${formType === 'interview' ? 'active-interview' : ''}`}
                        onClick={() => setFormType('interview')}
                      >🎤 Interview</button>
                    </div>
                  </div>
                </div>
                {/* Topic */}
                <div className="sched-field">
                  <label className="sched-label">Topic <span className="sched-label-opt">(optional)</span></label>
                  <input
                    type="text"
                    className="sched-input"
                    placeholder={formType === 'mock' ? 'e.g. Data Structures, System Design…' : 'e.g. Google SWE L4, Meta ML Engineer…'}
                    value={formTopic}
                    onChange={e => setFormTopic(e.target.value)}
                    maxLength={60}
                  />
                </div>
                {formError && <p className="sched-error">{formError}</p>}
                <button type="submit" className="sched-add-btn">＋ Add to Schedule</button>
              </form>
            </div>

          </div>{/* end db-top-left */}

          {/* ── Right column: Calendar + Upcoming ── */}
          <div className="db-top-right">

            {/* Calendar */}
            <div className="cal-card">
              <div className="cal-header">
                <div className="cal-month-label">
                  {MONTH_NAMES[calMonth]}, {calYear}
                </div>
                <div className="cal-nav">
                  <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
                  <button className="cal-today-btn" onClick={() => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); }}>Today</button>
                  <button className="cal-nav-btn" onClick={nextMonth}>›</button>
                </div>
              </div>

              <div className="cal-day-labels">
                {DAY_NAMES.map(d => <span key={d}>{d}</span>)}
              </div>

              <div className="cal-grid">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} className="cal-cell cal-cell--empty" />;
                  const key   = dateKey(calYear, calMonth, day);
                  const sched = scheduleMap[key];
                  const isToday = key === todayKey;
                  return (
                    <div key={i} className={`cal-cell ${isToday ? 'cal-cell--today' : ''} ${sched ? 'cal-cell--has-event' : ''}`}>
                      <span className="cal-day-num">{day}</span>
                      {sched === 'mock'      && <span className="cal-event-dot cal-dot-mock" />}
                      {sched === 'interview' && <span className="cal-event-dot cal-dot-interview" />}
                      {sched === 'both'      && <span className="cal-event-dot cal-dot-both" />}
                    </div>
                  );
                })}
              </div>

              <div className="cal-footer">
                <div className="cal-legend">
                  <span className="cal-leg-dot cal-leg-mock" /><span>Mock Test</span>
                  <span className="cal-leg-dot cal-leg-interview" /><span>Interview</span>
                </div>
                <div className="cal-count">
                  {monthScheduled.length} session{monthScheduled.length !== 1 ? 's' : ''} this month
                </div>
              </div>
            </div>

            {/* Upcoming Sessions card */}
            <div className="upcoming-card">
              <div className="upcoming-card-title">📋 Upcoming Sessions</div>
              {upcomingSessions.length === 0 ? (
                <p className="upcoming-empty">No sessions scheduled yet. Use the form to plan ahead.</p>
              ) : (
                <div className="upcoming-list">
                  {upcomingSessions.map(s => {
                    const [y, mo, d] = s.date.split('-');
                    const displayDate = new Date(+y, +mo - 1, +d).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                    });
                    return (
                      <div key={s.id} className={`upcoming-item ${s.type === 'mock' ? 'upcoming-mock' : 'upcoming-interview'}`}>
                        <span className="upcoming-icon">{s.type === 'mock' ? '🧠' : '🎤'}</span>
                        <div className="upcoming-body">
                          <span className="upcoming-name">
                            {s.type === 'mock' ? 'Mock Test' : 'AI Interview'}
                            {s.topic && <span className="upcoming-topic"> · {s.topic}</span>}
                          </span>
                          <span className="upcoming-date">{displayDate}</span>
                        </div>
                        <button className="upcoming-remove" onClick={() => removeSchedule(s.id)} title="Remove">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>{/* end db-top-right */}

        </div>{/* end db-top-grid */}

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
          {sessions.length === 0 ? (
            <div className="sessions-empty">
              <span className="sessions-empty-icon">📭</span>
              <p>No sessions yet — complete a <strong>Mock Test</strong> or <strong>AI Interview</strong> and it will appear here automatically.</p>
            </div>
          ) : (
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>Type</th><th>Topic</th><th>Score</th>
                  <th>Date</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
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
                    <td>
                      <Link
                        to={s.type === 'AI Mock Test' ? '/dashboard/mock-test-setup' : '/dashboard/interview-setup'}
                        className="retake-btn"
                      >Retake</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
            <span className="ctx-drop-text">Drag & Drop</span>
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
