import { useState, useEffect } from "react";
import "./LoginModal.css";

export default function LoginModal({ isOpen, onClose, startInSignup = false }) {
  const [isLogin, setIsLogin] = useState(!startInSignup);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sync mode when prop changes (e.g. opened as signup vs login)
  useEffect(() => {
    setIsLogin(!startInSignup);
  }, [startInSignup, isOpen]);

  // Reset fields every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setUsername("");
      setEmail("");
      setPassword("");
    }
  }, [isOpen]);

  // Prevent background scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  const loginUser = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.status === 200 && data.access) {
      localStorage.setItem("token", data.access);
      localStorage.setItem("username", username);
      alert("Login successful");
      window.location.href = "/";
    } else {
      alert("Invalid username or password. If you are a new user please signup.");
    }
  };

  const signupUser = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/register/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await res.json();

    if (res.status === 201) {
      alert("Signup successful. Now login.");
      setIsLogin(true);
    } else {
      alert(data.error || "Signup failed");
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="login-modal-overlay" onClick={handleOverlayClick}>
      <div className="login-modal-card">
        <button className="login-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h2 className="login-modal-title">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h2>
        <p className="login-modal-subtitle">
          {isLogin
            ? "Log in to continue to PrepArena"
            : "Sign up to start your prep journey"}
        </p>

        <div className="login-modal-form">
          <input
            className="login-modal-input"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          {!isLogin && (
            <input
              className="login-modal-input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}

          <input
            className="login-modal-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {isLogin ? (
            <button
              className="login-modal-btn login-modal-btn--login"
              onClick={loginUser}
            >
              Login
            </button>
          ) : (
            <button
              className="login-modal-btn login-modal-btn--signup"
              onClick={signupUser}
            >
              Signup
            </button>
          )}
        </div>

        <p className="login-modal-toggle">
          {isLogin ? "New user?" : "Already have an account?"}
          <span
            className="login-modal-toggle-link"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Signup" : "Login"}
          </span>
        </p>
      </div>
    </div>
  );
}
