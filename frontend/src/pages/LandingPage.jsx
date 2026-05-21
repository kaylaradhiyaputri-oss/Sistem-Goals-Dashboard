import { useNavigate } from "react-router-dom";
import { Target, Users, BarChart2, Bell, FileText, CheckSquare, ArrowRight } from "lucide-react";

const features = [
  {
    icon: BarChart2,
    title: "Tracking Progres Real-time",
    desc: "Pantau perkembangan goal Anda secara langsung dengan grafik dan visualisasi yang mudah dipahami.",
  },
  {
    icon: Users,
    title: "Kolaborasi Tim",
    desc: "Buat goal tim, assign task ke anggota, dan monitor progres seluruh tim dalam satu dashboard.",
  },
  {
    icon: BarChart2,
    title: "Analytics Mendalam",
    desc: "Dapatkan insight produktivitas dengan statistik bulanan, heatmap aktivitas, dan grafik performa.",
  },
  {
    icon: Bell,
    title: "Notifikasi",
    desc: "Dapatkan pengingat deadline melalui browser atau email agar tidak ada target yang terlewat.",
  },
  {
    icon: FileText,
    title: "Export Laporan",
    desc: "Export laporan progres dalam format PDF atau CSV.",
  },
  {
    icon: CheckSquare,
    title: "Manajemen Milestone",
    desc: "Pecah goal besar menjadi milestone kecil yang lebih mudah dicapai dan dipantau.",
  },
];

// ── Logo component — dipakai di Landing & Dashboard ──
export function Logo({ size = "md" }) {
  const sizes = { sm: { box: 28, font: 15 }, md: { box: 34, font: 18 }, lg: { box: 42, font: 22 } };
  const s = sizes[size];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        className="logo-mark"
        style={{ width: s.box, height: s.box }}
        aria-hidden="true"
      >
        <Target size={s.box * 0.52} color="#fff" strokeWidth={2.5} />
      </div>
      <span
        className="gradient-text"
        style={{ fontWeight: 800, fontSize: s.font, letterSpacing: "-0.02em", lineHeight: 1 }}
      >
        Goal Progress Dashboard      </span>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>

      {/* ── Navbar ── */}
      <nav
        className="topbar"
        style={{
          justifyContent: "space-between",
          padding: "0 2rem",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <Logo size="md" />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => navigate("/login")}
            className="btn-ghost"
            style={{ padding: "8px 18px" }}
          >
            Login
          </button>
          <button
            onClick={() => navigate("/register")}
            className="btn-primary"
            style={{ padding: "8px 20px" }}
          >
            Daftar Gratis
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        className="bg-grid"
        style={{
          textAlign: "center",
          padding: "6rem 2rem 5rem",
          background: "var(--bg-surface)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative glow blobs */}
        <div style={{
          position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)",
          width: 600, height: 300,
          background: "radial-gradient(ellipse, rgba(37,99,235,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div className="fade-slide-up">
          <div className="deadline-chip" style={{ marginBottom: "1.5rem", display: "inline-flex" }}>
          Goal-Progress Dashboard - by Kelompok 7
          </div>
          <h1 style={{
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            fontWeight: 900,
            margin: "0 0 1.25rem",
            lineHeight: 1.1,
            color: "var(--text-primary)",
            letterSpacing: "-0.03em",
          }}>
            Capai Target {" "}
            <span className="gradient-text">Anti Ngaret</span>
          </h1>
          <p style={{
            fontSize: 18,
            color: "var(--text-secondary)",
            maxWidth: 400,
            margin: "0 auto 2.5rem",
            lineHeight: 1.75,
          }}>
            Tentukan target, pecah menjadi milestone, dan pantau progres secara real-time dengan visualisasi yang menarik.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/register")}
              className="btn-primary"
              style={{ padding: "13px 32px", fontSize: 15 }}
            >
              Mulai Sekarang <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "5rem 2rem", background: "var(--bg-elevated)" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <p className="section-label" style={{ display: "block", marginBottom: 8 }}>Fitur</p>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
            Fitur Unggulan
          </h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          maxWidth: 960,
          margin: "0 auto",
        }}>
          {features.map((f) => (
            <div key={f.title} className="tech-card" style={{ padding: "1.75rem" }}>
              <div
                className="stat-icon"
                style={{ background: "rgba(37,99,235,0.08)", marginBottom: 14 }}
              >
                <f.icon size={20} color="var(--accent-primary)" />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "var(--text-primary)" }}>
                {f.title}
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: "5rem 2rem",
        textAlign: "center",
        background: "var(--bg-surface)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at center, rgba(37,99,235,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div
          className="glass-card"
          style={{
            maxWidth: 600,
            margin: "0 auto",
            padding: "3rem 2.5rem",
            background: "linear-gradient(135deg, rgba(37,99,235,0.04) 0%, rgba(6,182,212,0.03) 100%)",
            borderColor: "rgba(37,99,235,0.15)",
          }}
        >
          <h2 style={{
            fontSize: 26, fontWeight: 800, marginBottom: "0.75rem",
            color: "var(--text-primary)", letterSpacing: "-0.02em",
          }}>
            Siap Jadi Lebih{" "}
            <span className="gradient-text">Produktivitas?</span>
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", fontSize: 15 }}>
            Yuk bergabung!
          </p>
          <button
            onClick={() => navigate("/register")}
            className="btn-primary"
            style={{ padding: "13px 36px", fontSize: 15 }}
          >
            Mulai Gratis Sekarang <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        background: "var(--bg-elevated)",
        borderTop: "1px solid var(--border-subtle)",
        textAlign: "center",
        padding: "1.75rem",
        fontSize: 13,
        color: "var(--text-muted)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
          <Logo size="sm" />
        </div>
        © 2026 Goal-Progress Dashboard. By Kelompok 7
      </footer>
    </div>
  );
}
