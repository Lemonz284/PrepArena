import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './AIInterviewSetup.css';

export default function AIInterviewSetup() {
  const navigate = useNavigate();
  const [resumeFile, setResumeFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [resumeDrag, setResumeDrag] = useState(false);
  const [jdDrag, setJdDrag] = useState(false);
  const resumeRef = useRef();
  const jdRef = useRef();

  const canStart = resumeFile && (jdFile || (company && role));

  function handleStart() {
    if (!canStart) return;
    navigate('/dashboard/interview', {
      state: {
        resumeName: resumeFile?.name,
        jdName: jdFile?.name || null,
        company,
        role,
      },
    });
  }

  function onDropResume(e) {
    e.preventDefault(); setResumeDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) setResumeFile(f);
  }

  function onDropJD(e) {
    e.preventDefault(); setJdDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) setJdFile(f);
  }

  return (
    <div className="isetup-root">
      <Navbar />
      <div className="isetup-container">
        <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>

        <div className="isetup-header">
          <div className="isetup-icon">🎤</div>
          <div>
            <h1 className="isetup-title">AI Interview</h1>
            <p className="isetup-sub">Upload your resume and job context. The AI will tailor every question to you.</p>
          </div>
        </div>

        <div className="isetup-grid">

          {/* Resume Upload */}
          <div className="isetup-block">
            <h2 className="isetup-block-title">
              <span className="step-num">1</span> Upload Your Resume
              <span className="isetup-required">Required</span>
            </h2>
            <div
              className={`drop-zone ${resumeDrag ? 'dragging' : ''} ${resumeFile ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setResumeDrag(true); }}
              onDragLeave={() => setResumeDrag(false)}
              onDrop={onDropResume}
              onClick={() => resumeRef.current.click()}
            >
              {resumeFile ? (
                <>
                  <span className="drop-file-icon">📄</span>
                  <span className="drop-file-name">{resumeFile.name}</span>
                  <button className="drop-remove" onClick={(e) => { e.stopPropagation(); setResumeFile(null); }}>✕ Remove</button>
                </>
              ) : (
                <>
                  <span className="drop-icon">⬆️</span>
                  <span className="drop-label">Drag & Drop</span>
                  <span className="drop-hint">PDF or DOC · Max 5 MB</span>
                </>
              )}
            </div>
            <input ref={resumeRef} type="file" accept=".pdf,.doc,.docx" hidden
              onChange={(e) => { if (e.target.files[0]) setResumeFile(e.target.files[0]); }} />
          </div>

          {/* JD Upload */}
          <div className="isetup-block">
            <h2 className="isetup-block-title">
              <span className="step-num">2</span> Job Description
              <span className="isetup-optional">Optional if filling below</span>
            </h2>
            <div
              className={`drop-zone ${jdDrag ? 'dragging' : ''} ${jdFile ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setJdDrag(true); }}
              onDragLeave={() => setJdDrag(false)}
              onDrop={onDropJD}
              onClick={() => jdRef.current.click()}
            >
              {jdFile ? (
                <>
                  <span className="drop-file-icon">📋</span>
                  <span className="drop-file-name">{jdFile.name}</span>
                  <button className="drop-remove" onClick={(e) => { e.stopPropagation(); setJdFile(null); }}>✕ Remove</button>
                </>
              ) : (
                <>
                  <span className="drop-icon">⬆️</span>
                  <span className="drop-label">Drag & Drop</span>
                  <span className="drop-hint">PDF, DOC or TXT · Max 5 MB</span>
                </>
              )}
            </div>
            <input ref={jdRef} type="file" accept=".pdf,.doc,.docx,.txt" hidden
              onChange={(e) => { if (e.target.files[0]) setJdFile(e.target.files[0]); }} />

            <div className="or-divider">— or type manually —</div>

            <div className="isetup-fields">
              <div className="field-group">
                <label>Company</label>
                <input
                  type="text"
                  placeholder="e.g. Google, Amazon, Meta"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Role</label>
                <input
                  type="text"
                  placeholder="e.g. Software Engineer L4"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
            </div>
          </div>

        </div>

        {canStart && (
          <div className="isetup-summary">
            <span>🎤 Interview ready — <strong>{resumeFile.name}</strong> {company && `· ${company} ${role}`}</span>
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
