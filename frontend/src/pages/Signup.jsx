import { useState } from "react";

function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
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
    });

    const data = await res.json();

    if (res.status === 201) {
      alert("Signup successful. Please login.");
      window.location.href = "/login";
    } else {
      alert(data.error || "Signup failed");
    }
  };

  return (
    <div style={{ padding: "40px" }}>
      <h2>Signup</h2>

      <input placeholder="Username" onChange={(e)=>setUsername(e.target.value)} />
      <br /><br />

      <input placeholder="Email" onChange={(e)=>setEmail(e.target.value)} />
      <br /><br />

      <input type="password" placeholder="Password" onChange={(e)=>setPassword(e.target.value)} />
      <br /><br />

      <button onClick={handleSignup}>Signup</button>
    </div>
  );
}

export default Signup;