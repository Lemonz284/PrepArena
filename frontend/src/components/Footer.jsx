import { Link } from 'react-router-dom';
import './Footer.css';

const LINKS = {
  Product: ['Mock Interviews', 'Practice Problems', 'System Design', 'Behavioral Prep', 'Company Prep'],
  Company: ['About', 'Blog', 'Careers', 'Press'],
  Support: ['FAQ', 'Contact', 'Privacy Policy', 'Terms of Service'],
};

export default function Footer({ onOpenSignup }) {
  return (
    <>
      {/* CTA Banner */}
      <section className="cta-banner">
        <div className="cta-banner-inner">
          <h2 className="cta-banner-title">
            Ready to land your dream job?
          </h2>
          <p className="cta-banner-sub">
            Join thousands of engineers who used PrepArena to get offers at
            top companies. Start for free today.
          </p>
          <button className="cta-banner-btn" onClick={onOpenSignup}>
            Get started for free →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-logo">
              <span className="logo-mark">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect width="18" height="18" rx="5" fill="#f0b429" />
                  <path d="M5 13L9 5L13 13" stroke="#05090f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="6.5" y1="10.5" x2="11.5" y2="10.5" stroke="#05090f" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <span>PrepArena</span>
            </div>
            <p className="footer-tagline">
              The smartest way to prepare for technical interviews.
            </p>
          </div>

          <div className="footer-links">
            {Object.entries(LINKS).map(([section, items]) => (
              <div className="footer-col" key={section}>
                <h4 className="footer-col-title">{section}</h4>
                <ul>
                  {items.map((item) => (
                    <li key={item}>
                      <Link to="#" className="footer-link">{item}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} PrepArena. All rights reserved.</span>
        </div>
      </footer>
    </>
  );
}
