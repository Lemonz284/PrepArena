import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">PrepArena</span>
        </Link>

        {/* Nav Links */}
        <ul className="navbar-links">
          <li>
            <Link
              to="/about"
              className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`}
            >
              About Us
            </Link>
          </li>
          <li>
            <Link
              to="/dashboard"
              className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
            >
              Dashboard
            </Link>
          </li>
        </ul>

        {/* Auth */}
        <div className="navbar-auth">
          <Link to="/login" className="btn-login">
            Log in
          </Link>
          <Link to="/signup" className="btn-signup">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
