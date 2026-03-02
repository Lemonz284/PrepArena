import { createContext, useContext, useState } from 'react';

const PrepContext = createContext(null);

export function PrepProvider({ children }) {
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText]         = useState('');
  const [resumeName, setResumeName] = useState('');
  const [jdName, setJdName]         = useState('');
  const [keywords, setKeywords]     = useState([]);   // extracted from both docs

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
