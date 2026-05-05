import { createContext, useContext, useState, useEffect } from 'react';

const PrepContext = createContext(null);

export function PrepProvider({ children }) {
  const [resumeText, setResumeText] = useState(() => localStorage.getItem('preparena_resumeText') || '');
  const [jdText, setJdText]         = useState(() => localStorage.getItem('preparena_jdText') || '');
  const [resumeName, setResumeName] = useState(() => localStorage.getItem('preparena_resumeName') || '');
  const [jdName, setJdName]         = useState(() => localStorage.getItem('preparena_jdName') || '');
  const [keywords, setKeywords]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('preparena_keywords') || '[]'); }
    catch { return []; }
  });

  // Session history — persisted in localStorage
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('preparena_sessions') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('preparena_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Persist resume and JD context
  useEffect(() => {
    localStorage.setItem('preparena_resumeText', resumeText);
    localStorage.setItem('preparena_jdText', jdText);
    localStorage.setItem('preparena_resumeName', resumeName);
    localStorage.setItem('preparena_jdName', jdName);
    localStorage.setItem('preparena_keywords', JSON.stringify(keywords));
  }, [resumeText, jdText, resumeName, jdName, keywords]);

  // session shape: { id, type, topic, score, pct, date, dayKey, status }
  function addSession(session) {
    setSessions(prev => [session, ...prev].slice(0, 100));
  }

  function clearContext() {
    setResumeText(''); setJdText('');
    setResumeName(''); setJdName('');
    setKeywords([]);
    localStorage.removeItem('preparena_resumeText');
    localStorage.removeItem('preparena_jdText');
    localStorage.removeItem('preparena_resumeName');
    localStorage.removeItem('preparena_jdName');
    localStorage.removeItem('preparena_keywords');
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
