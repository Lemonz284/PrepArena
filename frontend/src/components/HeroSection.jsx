import { Link } from 'react-router-dom';
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

export default function HeroSection() {
  return (
    <section className="hero">
      <div className="hero-inner">
        {/* Left – text */}
        <div className="hero-content">
          <div className="hero-badge">🚀 AI-Powered Interview Prep</div>
          <h1 className="hero-title">
            Ace your next technical interview with&nbsp;
            <span className="hero-highlight">PrepArena</span>
          </h1>
          <p className="hero-subtitle">
            Practice coding, system design, and behavioral interviews with AI
            feedback. Get detailed, actionable insights so you know exactly what
            to work on before the real thing.
          </p>

          <div className="hero-ctas">
            <Link to="/signup" className="cta-primary">
              <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                <path d="M43.6 20H24v8h11.3C33.6 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.6-8 19.6-20 0-1.3-.1-2.7-.4-4z" fill="#4285F4"/>
                <path d="M6.3 14.7l6.6 4.8C14.5 16.1 18.9 13 24 13c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34 6.5 29.3 4 24 4c-7.6 0-14.2 4.3-17.7 10.7z" fill="#EA4335"/>
                <path d="M24 44c5.2 0 9.9-1.8 13.6-4.7l-6.3-5.2C29.5 35.7 26.9 36.8 24 36.8c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.7 39.7 16.3 44 24 44z" fill="#34A853"/>
                <path d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.3 5.2C41 35.4 44 30 44 24c0-1.3-.1-2.7-.4-4z" fill="#FBBC05"/>
              </svg>
              Continue with Google
            </Link>
            <Link to="/signup?method=email" className="cta-secondary">
              Or sign up with email
            </Link>
          </div>

          <p className="hero-note">Free to get started · No credit card required</p>
        </div>

        {/* Right – mock code editor */}
        <div className="hero-visual">
          <div className="code-editor">
            <div className="editor-header">
              <div className="editor-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <span className="editor-title">Two Sum – LeetCode #1</span>
              <span className="editor-lang">Python</span>
            </div>
            <div className="editor-body">
              <pre><code>{CODE_SNIPPET}</code></pre>
            </div>
            <div className="editor-footer">
              <span className="status-pill pass">✓ All test cases passed</span>
              <span className="time-badge">Runtime: 48ms · 95th percentile</span>
            </div>
          </div>

          <div className="feedback-card">
            <div className="feedback-header">
              <span className="feedback-icon">🤖</span>
              <span className="feedback-label">AI Feedback</span>
            </div>
            <p className="feedback-text">
              Great use of a hash map for O(n) time complexity. Consider adding
              edge-case handling for empty arrays.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
