import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mic, CheckCircle2, AlertCircle, User } from 'lucide-react';
import Navbar from '../components/Navbar';
import { usePrep } from '../context/PrepContext';
import './AIInterviewSetup.css';

export default function AIInterviewSetup() {
  const navigate = useNavigate();
  const { resumeText, jdText, resumeName, jdName } = usePrep();
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [voiceGender, setVoiceGender] = useState('female');

  const hasResume = !!resumeText;
  const hasJd = !!jdText;
  const contextReady = hasResume || hasJd;
  const canStart = contextReady;

  function handleStart() {
    if (!canStart) return;
    navigate('/dashboard/interview', {
      state: {
        resumeName: resumeName || '',
        jdName: jdName || '',
        company: hasJd ? '' : company.trim(),
        role: hasJd ? '' : role.trim(),
        voiceGender: voiceGender,
      },
    });
  }

  return (
    <div className="isetup-root">
      <Navbar />
      <div className="isetup-container">
        <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>

        <div className="isetup-header">
          <div className="isetup-icon"><Mic size={28} strokeWidth={1.75} /></div>
          <div>
            <h1 className="isetup-title">AI Interview</h1>
            <p className="isetup-sub">Use your dashboard prep context. The AI will tailor questions from your uploaded resume and selected job description.</p>
          </div>
        </div>

        <div className="isetup-grid">
          <div className="isetup-block">
            <h2 className="isetup-block-title">
              <span className="step-num">1</span> Dashboard Context
            </h2>
            <div className={`drop-zone ${contextReady ? 'has-file' : ''}`}>
              <div className="drop-file-icon">
                {hasResume ? <CheckCircle2 size={20} strokeWidth={2} /> : <AlertCircle size={20} strokeWidth={2} />}
              </div>
              <span className="drop-file-name">
                Resume: {resumeName || 'Not uploaded on Dashboard'}
              </span>
            </div>
            <div className={`drop-zone drop-zone-spaced ${contextReady ? 'has-file' : ''}`}>
              <div className="drop-file-icon">
                {hasJd ? <CheckCircle2 size={20} strokeWidth={2} /> : <AlertCircle size={20} strokeWidth={2} />}
              </div>
              <span className="drop-file-name">
                Job Description: {jdName || 'Not selected yet (add from Job Board or upload on Dashboard)'}
              </span>
            </div>
            {!contextReady && (
              <p className="drop-hint" style={{ marginTop: '0.8rem' }}>
                Add resume or JD from the <Link to="/dashboard" style={{ textDecoration: 'underline' }}>Dashboard</Link> before starting.
              </p>
            )}
          </div>

          <div className="isetup-block">
            <h2 className="isetup-block-title">
              <span className="step-num">2</span> Optional Role Details
            </h2>
            {hasJd && (
              <p className="isetup-note">
                A job description is already loaded, so company and role are not required.
              </p>
            )}
            <div className="isetup-fields">
              <div className="field-group">
                <label>Company</label>
                <input
                  type="text"
                  placeholder="e.g. Google, Amazon, Meta"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={hasJd}
                />
              </div>
              <div className="field-group">
                <label>Role</label>
                <input
                  type="text"
                  placeholder="e.g. Software Engineer L4"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={hasJd}
                />
              </div>
            </div>
          </div>

          <div className="isetup-block">
            <h2 className="isetup-block-title">
              <span className="step-num">3</span> Interviewer Voice
            </h2>
            <div className="voice-selector">
              <button 
                type="button"
                className={`voice-opt ${voiceGender === 'female' ? 'selected' : ''}`}
                onClick={() => setVoiceGender('female')}
              >
                <User size={18} />
                <span>Female</span>
              </button>
              <button 
                type="button"
                className={`voice-opt ${voiceGender === 'male' ? 'selected' : ''}`}
                onClick={() => setVoiceGender('male')}
              >
                <User size={18} />
                <span>Male</span>
              </button>
            </div>
          </div>

        </div>

        {canStart && (
          <div className="isetup-summary">
            <span>
              <Mic size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
              Interview ready — using dashboard context
              {!hasJd && company && ` · ${company}`}
              {!hasJd && role && ` ${role}`}
            </span>
          </div>
        )}

        <button
          className={`start-btn ${canStart ? 'active' : 'disabled'}`}
          onClick={handleStart}
          disabled={!canStart}
        >
          Start Interview →
        </button>

      </div>
    </div>
  );
}
