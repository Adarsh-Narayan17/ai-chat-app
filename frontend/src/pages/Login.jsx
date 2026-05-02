import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post("/api/auth/login", form);
      login(data);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.glow} />
      <div style={styles.card} className="fade-up">
        <div style={styles.logo}>
          <span style={styles.logoIcon}>◈</span>
          <span style={styles.logoText}>Claira</span>
        </div>
        <h2 style={styles.title}>Welcome back</h2>
        <p style={styles.subtitle}>Sign in to continue your conversations</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={styles.input}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              style={styles.input}
              required
            />
          </div>
          <button type="submit" style={loading ? { ...styles.btn, opacity: 0.7 } : styles.btn} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={styles.footer}>
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    position: "relative",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: 600,
    height: 600,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(124,111,255,0.08) 0%, transparent 70%)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "48px 40px",
    width: "100%",
    maxWidth: 420,
    position: "relative",
    zIndex: 1,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
  },
  logoIcon: {
    fontSize: 28,
    color: "var(--accent)",
    lineHeight: 1,
  },
  logoText: {
    fontFamily: "var(--font-display)",
    fontSize: 22,
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.5px",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: 26,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 8,
    letterSpacing: "-0.5px",
  },
  subtitle: {
    color: "var(--text-secondary)",
    marginBottom: 32,
    fontSize: 14,
  },
  error: {
    background: "rgba(248, 113, 113, 0.1)",
    border: "1px solid rgba(248, 113, 113, 0.3)",
    color: "var(--danger)",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 20,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "12px 16px",
    color: "var(--text-primary)",
    fontSize: 15,
    outline: "none",
    transition: "border-color 0.2s",
  },
  btn: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "13px",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "var(--font-display)",
    letterSpacing: "0.3px",
    transition: "opacity 0.2s, transform 0.1s",
    marginTop: 4,
  },
  footer: {
    textAlign: "center",
    color: "var(--text-secondary)",
    fontSize: 14,
    marginTop: 24,
  },
};
