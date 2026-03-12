import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import './HeroSection.css';

const CODE_SNIPPET = `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, num in enumerate(nums):
            complement = target - num
            if complement in seen:
                return [seen[complement], i]
            seen[num] = i
        return []`;

export default function HeroSection({ onOpenSignup }) {
  return (
    <section className="hero">
      <div className="hero-inner">
        <div className="hero-content">
          <div className="hero-badge">AI-Powered Interview Prep</div>
          <h1 className="hero-title">
            Ace your next technical interview
          </h1>
          <p className="hero-subtitle">
            Practice with AI, get honest feedback, and build real confidence
            before the interview that matters.
          </p>

          <div className="hero-ctas">
            <button className="cta-primary" onClick={onOpenSignup}>Start for free</button>
            <Link to="/dashboard" className="cta-secondary">Open dashboard</Link>
          </div>

          <div className="hero-social-proof">
            <div className="proof-avatars">
              {['#4e7fff', '#f0b429', '#34d399', '#f87171'].map((c, i) => (
                <span key={i} className="proof-avatar" style={{ background: c }} />
              ))}
            </div>
            <span className="proof-text">Trusted by 2,400+ engineers</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="code-editor">
            <div className="editor-header">
              <div className="editor-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <span className="editor-title">Two Sum — LeetCode #1</span>
              <span className="editor-lang">Python</span>
            </div>
            <div className="editor-body">
              <pre><code>{CODE_SNIPPET}</code></pre>
            </div>
            <div className="editor-footer">
              <span className="status-pill pass">All tests passed</span>
              <span className="time-badge">48ms · 95th percentile</span>
            </div>
          </div>

          <div className="feedback-card">
            <div className="feedback-header">
              <span className="feedback-icon-wrap">
                <Sparkles size={14} strokeWidth={2} />
              </span>
              <span className="feedback-label">AI Feedback</span>
            </div>
            <p className="feedback-text">
              Good use of a hash map for O(n) time. Consider adding
              edge-case handling for empty arrays.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
