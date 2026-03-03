import { createContext, useContext, useState, useEffect } from 'react';

const PrepContext = createContext(null);

export function PrepProvider({ children }) {
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText]         = useState('');
  const [resumeName, setResumeName] = useState('');
  const [jdName, setJdName]         = useState('');
  const [keywords, setKeywords]     = useState([]);   // extracted from both docs

  // Session history — persisted in localStorage
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('preparena_sessions') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('preparena_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // session shape: { id, type, topic, score, pct, date, dayKey, status }
  function addSession(session) {
    setSessions(prev => [session, ...prev].slice(0, 100));
  }

  function clearContext() {
    setResumeText(''); setJdText('');
    setResumeName(''); setJdName('');
    setKeywords([]);
  }

  return (
    <PrepContext.Provider value={{
      resumeText, setResumeText,
      jdText,     setJdText,
      resumeName, setResumeName,
      jdName,     setJdName,
      keywords,   setKeywords,
      sessions,   addSession,
      clearContext,
    }}>
      {children}
    </PrepContext.Provider>
  );
}

export function usePrep() {
  const ctx = useContext(PrepContext);
  if (!ctx) throw new Error('usePrep must be used inside PrepProvider');
  return ctx;
}
