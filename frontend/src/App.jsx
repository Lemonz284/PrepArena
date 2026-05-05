import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PrepProvider } from './context/PrepContext';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import MockTestSetup from './pages/MockTestSetup';
import MockTest from './pages/MockTest';
import MockTestResults from './pages/MockTestResults';
import AIInterviewSetup from './pages/AIInterviewSetup';
import AIInterview from './pages/AIInterview';
import JobsBoard from './pages/JobsBoard';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/?login=1" replace />;
  }
  return children;
}

function App() {
  return (
    <PrepProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard/mock-test-setup" element={<ProtectedRoute><MockTestSetup /></ProtectedRoute>} />
          <Route path="/dashboard/mock-test" element={<ProtectedRoute><MockTest /></ProtectedRoute>} />
          <Route path="/dashboard/mock-results" element={<ProtectedRoute><MockTestResults /></ProtectedRoute>} />
          <Route path="/dashboard/interview-setup" element={<ProtectedRoute><AIInterviewSetup /></ProtectedRoute>} />
          <Route path="/dashboard/interview" element={<ProtectedRoute><AIInterview /></ProtectedRoute>} />
          <Route path="/dashboard/jobs" element={<ProtectedRoute><JobsBoard /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </PrepProvider>
  );
}

export default App;
