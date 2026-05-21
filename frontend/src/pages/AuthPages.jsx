import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Target } from "lucide-react";
import { login, register } from "../lib/api";

function AuthCard({ title, children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "2.5rem",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem" }}>
          <Target size={24} color="#2563eb" />
          <span style={{ fontWeight: 800, fontSize: 20, color: "#111827" }}>GoalProgress</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: "1.75rem", color: "#111827" }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  marginTop: 6,
};

const btnStyle = {
  width: "100%",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px",
  fontWeight: 700,
  fontSize: 16,
  cursor: "pointer",
  marginTop: "1.25rem",
};

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Selamat datang kembali">
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>Email</label>
          <input
            style={inputStyle}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@contoh.com"
            required
          />
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>Password</label>
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        {error && (
          <div style={{ color: "#dc2626", fontSize: 13, marginTop: 8, padding: "8px 12px", background: "#fef2f2", borderRadius: 6 }}>
            {error}
          </div>
        )}
        <button style={btnStyle} type="submit" disabled={loading}>
          {loading ? "Masuk..." : "Masuk"}
        </button>
      </form>
      <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: 14, color: "#6b7280" }}>
        Belum punya akun?{" "}
        <Link to="/register" style={{ color: "#2563eb", fontWeight: 600 }}>
          Daftar gratis
        </Link>
      </p>
    </AuthCard>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, name);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Buat akun baru">
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>Nama</label>
          <input
            style={inputStyle}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama lengkap"
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>Email</label>
          <input
            style={inputStyle}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@contoh.com"
            required
          />
        </div>
        <div>
          <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>Password</label>
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 6 karakter"
            required
            minLength={6}
          />
        </div>
        {error && (
          <div style={{ color: "#dc2626", fontSize: 13, marginTop: 8, padding: "8px 12px", background: "#fef2f2", borderRadius: 6 }}>
            {error}
          </div>
        )}
        <button style={btnStyle} type="submit" disabled={loading}>
          {loading ? "Mendaftar..." : "Daftar Gratis"}
        </button>
      </form>
      <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: 14, color: "#6b7280" }}>
        Sudah punya akun?{" "}
        <Link to="/login" style={{ color: "#2563eb", fontWeight: 600 }}>
          Masuk
        </Link>
      </p>
    </AuthCard>
  );
}
