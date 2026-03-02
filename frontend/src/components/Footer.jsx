import { Link } from 'react-router-dom';
import './Footer.css';

const LINKS = {
  Product: ['Mock Interviews', 'Practice Problems', 'System Design', 'Behavioral Prep', 'Company Prep'],
  Company: ['About Us', 'Blog', 'Careers', 'Press'],
  Support: ['FAQ', 'Contact', 'Privacy Policy', 'Terms of Service'],
};

export default function Footer() {
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
          <Link to="/signup" className="cta-banner-btn">
            Get started for free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-logo">
              <span className="logo-icon">⚡</span>
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
