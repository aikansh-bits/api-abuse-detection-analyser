import { useState } from "react";
import AnalysisDashboard from "./AnalysisDashboard";
import SimulationPanel from "./SimulationPanel";

const NAV = [
  {
    id: "analysis",
    label: "Analysis Dashboard",
    desc: "Live metrics & charts",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="10" width="4" height="7" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="7" y="6" width="4" height="11" rx="1" fill="currentColor" />
        <rect x="13" y="2" width="4" height="15" rx="1" fill="currentColor" opacity="0.8" />
      </svg>
    ),
  },
  {
    id: "simulation",
    label: "Simulation Panel",
    desc: "Send & test traffic",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
        <circle cx="9" cy="9" r="4.5" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
        <circle cx="9" cy="9" r="2" fill="currentColor" />
        <line x1="9" y1="1.5" x2="9" y2="3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="16.5" y1="9" x2="14.5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="9" y1="16.5" x2="9" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="1.5" y1="9" x2="3.5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

function Logo() {
  return (
    <div style={{ padding: "28px 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: "linear-gradient(135deg, #4F8EF7 0%, #34D399 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 14L6 9L10 11L16 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="14" cy="4" r="1.5" fill="white" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#F0F2F8", fontFamily: "'Syne', sans-serif", lineHeight: 1.2 }}>
            API ABUSE
          </div>
          <div style={{ fontSize: 10, color: "#4B5563", letterSpacing: "0.06em", fontFamily: "'IBM Plex Mono', monospace" }}>
            DETECTION ANALYZER
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ item, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "11px 16px", borderRadius: 12,
      background: active ? "rgba(79,142,247,0.12)" : "transparent",
      border: active ? "1px solid rgba(79,142,247,0.25)" : "1px solid transparent",
      cursor: "pointer", textAlign: "left",
      display: "flex", alignItems: "center", gap: 12,
      color: active ? "#4F8EF7" : "#6B7280",
      transition: "all 0.2s",
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ flexShrink: 0 }}>{item.icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Syne', sans-serif", lineHeight: 1.3, color: active ? "#4F8EF7" : "#9CA3AF" }}>
          {item.label}
        </div>
        <div style={{ fontSize: 10, color: active ? "rgba(79,142,247,0.7)" : "#4B5563", fontFamily: "'IBM Plex Mono', monospace", marginTop: 1 }}>
          {item.desc}
        </div>
      </div>
      {active && (
        <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#4F8EF7", boxShadow: "0 0 8px #4F8EF7" }} />
      )}
    </button>
  );
}

function StatusBar() {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  useState(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  });
  return (
    <div style={{
      padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.06)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 6px #34D399" }} />
        <span style={{ fontSize: 10, color: "#34D399", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.06em" }}>SYSTEM ONLINE</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "#374151", fontFamily: "'IBM Plex Mono', monospace" }}>v2.4.1</span>
        <span style={{ fontSize: 10, color: "#374151", fontFamily: "'IBM Plex Mono', monospace" }}>{time}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("analysis");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0B0D11; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        input[type=range] { -webkit-appearance: none; appearance: none; height: 5px; border-radius: 3px; background: rgba(255,255,255,0.1); outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; cursor: pointer; }
        button { outline: none; }
      `}</style>

      <div style={{
        display: "flex", height: "100vh", width: "100%",
        background: "#0B0D11",
        backgroundImage: "radial-gradient(ellipse at 20% 0%, rgba(79,142,247,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(52,211,153,0.05) 0%, transparent 50%)",
        fontFamily: "'IBM Plex Mono', monospace",
        overflow: "hidden",
      }}>

        <aside style={{
          width: 220, flexShrink: 0,
          background: "rgba(255,255,255,0.02)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column",
          height: "100%",
        }}>
          <Logo />

          <div style={{ padding: "16px 12px", flex: 1 }}>
            <div style={{ fontSize: 9, color: "#374151", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0 8px", marginBottom: 10 }}>
              Navigation
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {NAV.map(item => (
                <NavItem key={item.id} item={item} active={active === item.id} onClick={() => setActive(item.id)} />
              ))}
            </div>

            <div style={{ marginTop: 28, padding: "0 8px" }}>
              <div style={{ fontSize: 9, color: "#374151", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                System Health
              </div>
              {[["Rule Engine", "#4F8EF7", 94], ["AI Model", "#34D399", 87], ["Throughput", "#FBBF24", 72]].map(([label, color, pct]) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "#6B7280" }}>{label}</span>
                    <span style={{ fontSize: 10, color }}>{pct}%</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, opacity: 0.8 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <StatusBar />
        </aside>

        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          <div style={{
            height: 52, flexShrink: 0,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", paddingLeft: 32, paddingRight: 24,
            gap: 16,
            background: "rgba(255,255,255,0.01)",
          }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#F0F2F8", fontFamily: "'Syne', sans-serif" }}>
                {NAV.find(n => n.id === active)?.label}
              </span>
              <span style={{ fontSize: 11, color: "#4B5563", marginLeft: 12 }}>
                {NAV.find(n => n.id === active)?.desc}
              </span>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {["◈ Rule-Based: 8ms", "◉ AI-Based: 120ms"].map((label, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: "4px 12px", borderRadius: 20,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: i === 0 ? "#4F8EF7" : "#34D399",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}>{label}</span>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ height: "100%", display: active === "analysis" ? "block" : "none", overflowY: "auto" }}>
              <AnalysisDashboard />
            </div>
            <div style={{ height: "100%", display: active === "simulation" ? "block" : "none", overflowY: "auto" }}>
              <SimulationPanel />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
