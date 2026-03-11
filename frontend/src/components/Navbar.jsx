import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  const username = localStorage.getItem('username');
  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  const aboutActive = location.pathname === '/' && location.hash === '#about';

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <span className="logo-mark">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect width="18" height="18" rx="5" fill="#f0b429" />
              <path d="M5 13L9 5L13 13" stroke="#05090f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="6.5" y1="10.5" x2="11.5" y2="10.5" stroke="#05090f" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <span className="logo-text">PrepArena</span>
        </Link>

        <ul className="navbar-links">
          <li>
            <Link to="/#about" className={`nav-link ${aboutActive ? 'active' : ''}`}>
              About
            </Link>
          </li>
          <li>
            <Link to={isDashboardRoute ? '/' : '/dashboard'} className={`nav-link ${isDashboardRoute ? 'active' : ''}`}>
              {isDashboardRoute ? 'Home' : 'Dashboard'}
            </Link>
          </li>
        </ul>

        <div className="navbar-auth">

          {username ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>

              <span style={{ color: "white" }}>
                Hello, {username}
              </span>

              <button
                onClick={() => {
                  localStorage.removeItem("token")
                  localStorage.removeItem("username")
                  window.location.reload()
                }}
                className="btn-login"
              >
                Logout
              </button>

            </div>
          ) : (
            <>
              <Link to="/login" className="btn-login">Log in</Link>
              <Link to="/login?mode=signup" className="btn-signup">Get started</Link>
            </>
          )}

        </div>
      </div>
    </nav>
  );
}
