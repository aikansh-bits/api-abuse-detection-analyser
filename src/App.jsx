import { useEffect, useMemo, useState } from "react";
import AnalysisDashboard from "./AnalysisDashboard";
import SimulationPanel from "./SimulationPanel";
import { AppDataProvider, useAppData } from "./lib/AppDataContext";

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
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
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
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
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

function HealthBars({ health, summary }) {
  // Translate health + summary into 0-100 health percentages.
  const ruleBar = health.state === "down" ? 0 : health.state === "degraded" ? 70 : 96;
  const aiBar = !health.ai ? 0
    : health.aiLatencyMs == null ? 92
    : health.aiLatencyMs < 50 ? 96
    : health.aiLatencyMs < 200 ? 86
    : 70;

  const detP95 = summary?.latencyMs?.detection?.p95 ?? null;
  // Throughput "health" = how close p95 is to a 200ms reference (lower = better).
  const throughputBar = detP95 == null ? 80
    : detP95 < 25 ? 96
    : detP95 < 75 ? 88
    : detP95 < 200 ? 70
    : 45;

  const items = [
    ["Rule Engine", "#4F8EF7", ruleBar],
    ["AI Model", "#34D399", aiBar],
    ["Throughput", "#FBBF24", throughputBar],
  ];

  return items.map(([label, color, pct]) => (
    <div key={label} style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: "#6B7280" }}>{label}</span>
        <span style={{ fontSize: 10, color }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, opacity: 0.85, transition: "width 0.6s" }} />
      </div>
    </div>
  ));
}

function StatusBar({ health }) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  const { color, label } = useMemo(() => {
    if (health.state === "ok") return { color: "#34D399", label: "SYSTEM ONLINE" };
    if (health.state === "degraded") return { color: "#FBBF24", label: "AI DEGRADED" };
    if (health.state === "waking") return { color: "#A78BFA", label: "WAKING UP…" };
    return { color: "#F87171", label: "BACKEND DOWN" };
  }, [health.state]);

  return (
    <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
        <span style={{ fontSize: 10, color, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "#374151", fontFamily: "'IBM Plex Mono', monospace" }}>v1.0.0</span>
        <span style={{ fontSize: 10, color: "#374151", fontFamily: "'IBM Plex Mono', monospace" }}>{time}</span>
      </div>
    </div>
  );
}

function TopBadges({ health, summary }) {
  const ruleP95 = summary?.latencyMs?.ruleEngine?.p95;
  const aiP95 = summary?.latencyMs?.aiCall?.p95;

  const ruleLabel = ruleP95 != null
    ? `◈ Rule p95: ${formatMs(ruleP95)}`
    : `◈ Rule: ${health.state === "down" ? "offline" : "ready"}`;
  const aiLabel = aiP95 != null
    ? `◉ AI p95: ${formatMs(aiP95)}`
    : `◉ AI: ${health.ai ? "ready" : "unreachable"}`;

  return (
    <>
      <span style={{
        fontSize: 10, padding: "4px 12px", borderRadius: 20,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        color: "#4F8EF7", fontFamily: "'IBM Plex Mono', monospace",
      }}>{ruleLabel}</span>
      <span style={{
        fontSize: 10, padding: "4px 12px", borderRadius: 20,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        color: health.ai ? "#34D399" : "#F87171",
        fontFamily: "'IBM Plex Mono', monospace",
      }}>{aiLabel}</span>
    </>
  );
}

const formatMs = (v) => v < 10 ? `${v.toFixed(2)}ms` : v < 100 ? `${v.toFixed(1)}ms` : `${Math.round(v)}ms`;

export default function App() {
  return (
    <AppDataProvider>
      <AppShell />
    </AppDataProvider>
  );
}

function AppShell() {
  const [active, setActive] = useState("analysis");
  const { health, summary } = useAppData();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0B0D11; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

        /* Range slider — fully custom so the thumb is clearly visible on the dark theme. */
        .range-slider {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 6px; border-radius: 999px;
          outline: none; cursor: pointer;
          /* The track fill is set inline via background:linear-gradient(...) */
        }
        .range-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 18px; height: 18px; border-radius: 50%;
          background: #F0F2F8;
          border: 3px solid var(--thumb-color, #4F8EF7);
          cursor: grab;
          box-shadow: 0 0 0 4px rgba(255,255,255,0.04), 0 2px 6px rgba(0,0,0,0.4);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .range-slider::-webkit-slider-thumb:hover { transform: scale(1.1); }
        .range-slider::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.15); }
        .range-slider::-moz-range-thumb {
          width: 18px; height: 18px; border-radius: 50%;
          background: #F0F2F8;
          border: 3px solid var(--thumb-color, #4F8EF7);
          cursor: grab;
          box-shadow: 0 0 0 4px rgba(255,255,255,0.04), 0 2px 6px rgba(0,0,0,0.4);
        }
        .range-slider::-moz-range-track {
          background: transparent;
          height: 6px; border-radius: 999px;
        }

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
              {NAV.map((item) => (
                <NavItem key={item.id} item={item} active={active === item.id} onClick={() => setActive(item.id)} />
              ))}
            </div>

            {/* <div style={{ marginTop: 28, padding: "0 8px" }}>
              <div style={{ fontSize: 9, color: "#374151", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                System Health
              </div>
              <HealthBars health={health} summary={summary} />
            </div> */}
          </div>

          <StatusBar health={health} />
        </aside>

        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{
            height: 52, flexShrink: 0,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", paddingLeft: 32, paddingRight: 24, gap: 16,
            background: "rgba(255,255,255,0.01)",
          }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#F0F2F8", fontFamily: "'Syne', sans-serif" }}>
                {NAV.find((n) => n.id === active)?.label}
              </span>
              <span style={{ fontSize: 11, color: "#4B5563", marginLeft: 12 }}>
                {NAV.find((n) => n.id === active)?.desc}
              </span>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <TopBadges health={health} summary={summary} />
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
