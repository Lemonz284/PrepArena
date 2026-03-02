import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './AIInterview.css';

/* Simulated AI question sequences */
const QUESTION_FLOW = [
  (ctx) => `Hi! I'm your AI interviewer. I've reviewed your resume and the ${ctx.company || 'target'} ${ctx.role || 'role'}. Let's get started. Can you briefly walk me through your background and what excites you about this opportunity?`,
  () => `Great, thanks for that intro. Let's dive into a technical question. Can you explain the difference between a process and a thread, and when you'd prefer one over the other?`,
  () => `Interesting. Now, imagine you're designing a URL shortener like bit.ly. Walk me through your high-level system design — what components would you include and why?`,
  () => `Good thinking. Let's talk about your experience. Tell me about a time you had to debug a particularly tricky issue in production. What was your approach?`,
  () => `That's a solid example. One more: how do you handle disagreements with teammates on technical decisions? Can you share a real situation?`,
  () => `Excellent. We're almost done. Do you have any questions for me about the role or the team?`,
];

export default function AIInterview() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resumeName = '', company = '', role = '' } = location.state || {};

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [qIndex, setQIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ended, setEnded] = useState(false);
  const bottomRef = useRef();

  // Deliver first question on mount
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setMessages([{
        role: 'ai',
        text: QUESTION_FLOW[0]({ company, role }),
      }]);
      setLoading(false);
    }, 1200);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function handleSend() {
    if (!input.trim() || loading || ended) return;
    const userMsg = { role: 'user', text: input.trim() };
    setInput('');
    setMessages((prev) => [...prev, userMsg]);

    const nextQ = qIndex + 1;

    if (nextQ >= QUESTION_FLOW.length) {
      // Interview over
      setLoading(true);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: 'ai', text: `Thank you for your time! That wraps up our session. I'll generate your performance report now. You'll find it on your dashboard shortly. Good luck!` },
        ]);
        setLoading(false);
        setEnded(true);
      }, 1000);
    } else {
      setLoading(true);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: 'ai', text: QUESTION_FLOW[nextQ]({ company, role }) },
        ]);
        setQIndex(nextQ);
        setLoading(false);
      }, 1200 + Math.random() * 800);
    }
  }

  const progress = Math.round((qIndex / (QUESTION_FLOW.length - 1)) * 100);

  return (
    <div className="iv-root">
      <Navbar />
      <div className="iv-container">

        {/* Header */}
        <div className="iv-header">
          <div className="iv-header-left">
            <Link to="/dashboard" className="back-link">← Exit</Link>
            <div className="iv-session-info">
              <span className="iv-badge">🎤 AI Interview</span>
              {company && <span className="iv-company">{company} · {role}</span>}
              {resumeName && <span className="iv-resume">📄 {resumeName}</span>}
            </div>
          </div>
          <div className="iv-progress-wrap">
            <span className="iv-progress-label">Q{qIndex + 1} / {QUESTION_FLOW.length}</span>
            <div className="iv-progress-bar">
              <div className="iv-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="iv-chat">
          {messages.map((m, i) => (
            <div key={i} className={`iv-msg iv-msg-${m.role}`}>
              <div className={`iv-avatar ${m.role === 'ai' ? 'avatar-ai' : 'avatar-user'}`}>
                {m.role === 'ai' ? '🤖' : '👤'}
              </div>
              <div className="iv-bubble">{m.text}</div>
            </div>
          ))}

          {loading && (
            <div className="iv-msg iv-msg-ai">
              <div className="iv-avatar avatar-ai">🤖</div>
              <div className="iv-bubble iv-typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {!ended ? (
          <div className="iv-input-row">
            <textarea
              className="iv-textarea"
              rows={3}
              placeholder="Type your answer here… (Enter to send, Shift+Enter for new line)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              disabled={loading}
            />
            <button className="iv-send-btn" onClick={handleSend} disabled={loading || !input.trim()}>
              Send →
            </button>
          </div>
        ) : (
          <div className="iv-ended-bar">
            <span>🎉 Interview complete! Your report is ready on the dashboard.</span>
            <Link to="/dashboard" className="iv-dash-btn">Go to Dashboard →</Link>
          </div>
        )}

      </div>
    </div>
  );
}
