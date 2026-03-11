import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

function AuthPage() {
  const location = useLocation();
  const modeFromQuery = new URLSearchParams(location.search).get("mode");
  const startInSignup = modeFromQuery === "signup";

  const [isLogin, setIsLogin] = useState(!startInSignup)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    setIsLogin(!startInSignup);
  }, [startInSignup]);

  const loginUser = async () => {

    const res = await fetch("http://127.0.0.1:8000/api/login/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        email,
        password
      })
    })

    const data = await res.json()

    if (res.status === 201) {
      alert("Signup successful. Now login.")
      setIsLogin(true)
    } else {
      alert(data.error)
    }

  }

  return (
    <div
  style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    background: "linear-gradient(135deg, #0f172a, #1e293b, #020617)",
    position: "relative",
    overflow: "hidden"
  }}
>
  <div
      style={{
        position: "absolute",
        width: "500px",
        height: "500px",
        background: "#3b82f6",
        filter: "blur(200px)",
        top: "-150px",
        left: "-150px",
        opacity: "0.4"
      }}
    ></div>

    <div
      style={{
        position: "absolute",
        width: "400px",
        height: "400px",
        background: "#22c55e",
        filter: "blur(180px)",
        bottom: "-120px",
        right: "-120px",
        opacity: "0.3"
      }}
    ></div>

      <div style={{
        width: "380px",
        background: "#1e293b",
        padding: "40px",
        borderRadius: "10px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.4)"
      }}>

        <h2 style={{
          textAlign: "center",
          color: "white",
          marginBottom: "25px"
        }}>
          {isLogin ? "Welcome Back" : "Create Account"}
        </h2>

        <input
          placeholder="Username"
          onChange={(e) => setUsername(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "15px",
            borderRadius: "6px",
            border: "none"
          }}
        />

        {!isLogin && (
          <input
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "15px",
              borderRadius: "6px",
              border: "none"
            }}
          />
        )}

        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "20px",
            borderRadius: "6px",
            border: "none"
          }}
        />

        {isLogin ? (
          <button
            onClick={loginUser}
            style={{
              width: "100%",
              padding: "12px",
              background: "#3b82f6",
              border: "none",
              color: "white",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            Login
          </button>
        ) : (
          <button
            onClick={signupUser}
            style={{
              width: "100%",
              padding: "12px",
              background: "#22c55e",
              border: "none",
              color: "white",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            Signup
          </button>
        )}

        <p style={{
          textAlign: "center",
          color: "#cbd5f5",
          marginTop: "20px"
        }}>
          {isLogin ? "New user?" : "Already have an account?"}

          <span
            style={{
              color: "#3b82f6",
              cursor: "pointer",
              marginLeft: "6px"
            }}
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Signup" : "Login"}
          </span>
        </p>

      </div>

    </div>
  )

}

export default AuthPage