import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, MapPin, Building2, Search, ExternalLink,
  Check, Loader2, RefreshCw, ChevronDown, ChevronUp, Zap,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { usePrep } from '../context/PrepContext';
import { extractKeywords } from '../utils/extractKeywords';
import './JobsBoard.css';

const SOURCE_COLORS = {
  Internshala: '#f97316',
  Remotive:    '#06b6d4',
  Sample:      '#8b5cf6',
  CSV:         '#10b981',
};

function SourceBadge({ source }) {
  const color = SOURCE_COLORS[source] || '#6b7280';
  return (
    <span
      className="jb-source-badge"
      style={{ background: `${color}22`, color, borderColor: `${color}44` }}
    >
      {source}
    </span>
  );
}

function SkillChip({ skill }) {
  return <span className="jb-skill-chip">{skill.trim()}</span>;
}

function JobCard({ job, onAdd, added }) {
  const [expanded, setExpanded] = useState(false);
  const skills = (job.skills || '')
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean);

  const descPreview = (job.description || '').slice(0, 200);
  const descFull    = job.description || '';
  const hasMore     = descFull.length > 200;

  return (
    <div className={`jb-card ${added ? 'jb-card--added' : ''}`}>
      <div className="jb-card-top">
        <div className="jb-card-meta">
          <div className="jb-card-title-row">
            <h3 className="jb-card-title">{job.title}</h3>
          </div>
          <div className="jb-card-sub">
            <span className="jb-card-company">
              <Building2 size={13} strokeWidth={2} />
              {job.company || 'Unknown Company'}
            </span>
            {job.location && (
              <span className="jb-card-location">
                <MapPin size={13} strokeWidth={2} />
                {job.location}
              </span>
            )}
          </div>
        </div>

        <div className="jb-card-actions">
          {job.link && (
            <a
              href={job.link}
              target="_blank"
              rel="noopener noreferrer"
              className="jb-btn-link"
              title="Open original listing"
            >
              <ExternalLink size={14} strokeWidth={2} />
            </a>
          )}
          <button
            className={`jb-btn-add ${added ? 'jb-btn-add--done' : ''}`}
            onClick={() => onAdd(job)}
            disabled={added}
            title={added ? 'Job description loaded!' : 'Use as Job Description'}
          >
            {added ? (
              <>
                <Check size={14} strokeWidth={2.5} />
                Added
              </>
            ) : (
              <>
                <Zap size={14} strokeWidth={2.5} />
                Add
              </>
            )}
          </button>
        </div>
      </div>

      {skills.length > 0 && (
        <div className="jb-skills-row">
          {skills.slice(0, 6).map(s => <SkillChip key={s} skill={s} />)}
          {skills.length > 6 && (
            <span className="jb-skill-chip jb-skill-chip--more">+{skills.length - 6} more</span>
          )}
        </div>
      )}

      {descFull && (
        <div className="jb-card-desc">
          <p className="jb-desc-text">
            {expanded ? descFull : descPreview}
            {!expanded && hasMore && '…'}
          </p>
          {hasMore && (
            <button className="jb-expand-btn" onClick={() => setExpanded(v => !v)}>
              {expanded
                ? <><ChevronUp size={13} /> Show less</>
                : <><ChevronDown size={13} /> Show more</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function JobsBoard() {
  const navigate = useNavigate();
  const { setJdText, setJdName, setKeywords, resumeText } = usePrep();

  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [addedId, setAddedId] = useState(null); // index of added card
  const [toastMsg, setToastMsg] = useState('');

  const fetchJobs = useCallback(async (q = '') => {
    setLoading(true);
    setError('');
    try {
      const url = q
        ? `http://localhost:8000/api/jobs/?q=${encodeURIComponent(q)}`
        : 'http://localhost:8000/api/jobs/';
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (e) {
      setError(e.message || 'Failed to load jobs. Is the Django backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  function handleSearch(e) {
    e.preventDefault();
    fetchJobs(search.trim());
  }

  function handleAdd(job, idx) {
    // Build a clean job-description text and load it into the PrepContext
    const jdText = [
      `Position: ${job.title}`,
      job.company  ? `Company: ${job.company}`  : '',
      job.location ? `Location: ${job.location}` : '',
      job.skills   ? `Required Skills: ${job.skills}` : '',
      '',
      job.description || '',
    ].filter(Boolean).join('\n');

    setJdText(jdText);
    setJdName(`${job.title} @ ${job.company || 'Company'}`);
    setKeywords(extractKeywords(resumeText || '', jdText));

    setAddedId(idx);
    setToastMsg(`✓ "${job.title}" loaded as Job Description`);
    setTimeout(() => setToastMsg(''), 3500);

    // Navigate back to dashboard after short delay
    setTimeout(() => navigate('/dashboard'), 1200);
  }

  const displayedJobs = jobs; // server-side filtering via ?q=

  return (
    <div className="jb-root">
      <Navbar />

      {/* Toast */}
      {toastMsg && (
        <div className="jb-toast">
          {toastMsg}
        </div>
      )}

      <div className="jb-container">
        {/* Header */}
        <div className="jb-header">
          <div>
            <h1 className="jb-title">
              Jobs Board
            </h1>
            <p className="jb-subtitle">
              Browse scraped job listings and click <strong>Add</strong> to instantly load a job description into your prep context.
            </p>
          </div>
        </div>

        {/* Search bar */}
        <form className="jb-search-bar" onSubmit={handleSearch}>
          <div className="jb-search-inner">
            <Search size={16} className="jb-search-icon" strokeWidth={2} />
            <input
              id="jb-search-input"
              className="jb-search-input"
              type="text"
              placeholder="Search by title, company, or skill…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="jb-search-btn" id="jb-search-submit">
            Search
          </button>
          <button
            type="button"
            className="jb-refresh-btn"
            onClick={() => { setSearch(''); fetchJobs(''); }}
            title="Refresh"
            id="jb-refresh-btn"
          >
            <RefreshCw size={15} strokeWidth={2} />
          </button>
        </form>

        {/* Status */}
        {!loading && !error && (
          <div className="jb-count">
            {displayedJobs.length === 0
              ? 'No jobs found — try a different search.'
              : `${displayedJobs.length} job${displayedJobs.length !== 1 ? 's' : ''} found`}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="jb-loading">
            <Loader2 size={32} strokeWidth={1.5} className="jb-spin" />
            <p>Loading jobs…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="jb-error">
            <p>{error}</p>
            <button className="jb-retry-btn" onClick={() => fetchJobs(search)}>Retry</button>
          </div>
        )}

        {/* Grid */}
        {!loading && !error && (
          <div className="jb-grid">
            {displayedJobs.map((job, idx) => (
              <JobCard
                key={idx}
                job={job}
                onAdd={(j) => handleAdd(j, idx)}
                added={addedId === idx}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
