import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PrepProvider } from './context/PrepContext';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import MockTestSetup from './pages/MockTestSetup';
import MockTest from './pages/MockTest';
import MockTestResults from './pages/MockTestResults';
import AIInterviewSetup from './pages/AIInterviewSetup';
import AIInterview from './pages/AIInterview';

function App() {
  return (
    <PrepProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/mock-test-setup" element={<MockTestSetup />} />
        <Route path="/dashboard/mock-test" element={<MockTest />} />
        <Route path="/dashboard/mock-results" element={<MockTestResults />} />
        <Route path="/dashboard/interview-setup" element={<AIInterviewSetup />} />
        <Route path="/dashboard/interview" element={<AIInterview />} />
      </Routes>
    </BrowserRouter>
    </PrepProvider>
  );
}

export default App;
