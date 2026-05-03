import { useState, useRef, useEffect } from "react";

const COLORS = { rule: "#4F8EF7", ai: "#34D399", danger: "#F87171", warn: "#FBBF24", neutral: "#8B92A5" };

function StatusDot({ active, color }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: active ? color : "rgba(255,255,255,0.1)",
      boxShadow: active ? `0 0 8px ${color}88` : "none",
      transition: "all 0.3s",
    }} />
  );
}

function ResultEntry({ entry, index }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 30); return () => clearTimeout(t); }, []);
  const isMal = entry.result === "Malicious";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
      background: isMal ? "rgba(248,113,113,0.05)" : "rgba(52,211,153,0.04)",
      border: `1px solid ${isMal ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.12)"}`,
      borderRadius: 10,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(-8px)",
      transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <span style={{ fontSize: 10, color: "#4B5563", minWidth: 28 }}>#{String(index + 1).padStart(3, "0")}</span>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 6,
        background: isMal ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)",
        color: isMal ? COLORS.danger : COLORS.ai,
        minWidth: 80, textAlign: "center",
      }}>{entry.result}</span>
      <span style={{ fontSize: 11, color: COLORS.neutral, flex: 1 }}>{entry.traffic} traffic</span>
      <span style={{ fontSize: 11, color: "#6B7280" }}>{entry.system}</span>
      <span style={{ fontSize: 11, color: entry.latency < 20 ? COLORS.rule : "#A78BFA", minWidth: 50, textAlign: "right" }}>
        {entry.latency} ms
      </span>
    </div>
  );
}

function GaugeArc({ value, max, color, label, sublabel }) {
  const pct = Math.min(value / max, 1);
  const angle = pct * 180;
  const r = 52, cx = 70, cy = 68;
  const startAngle = 180;
  const endAngle = 180 + angle;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const largeArc = angle > 180 ? 1 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width="140" height="80" viewBox="0 0 140 80">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round" />
        {pct > 0 && (
          <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            style={{ transition: "all 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize="18" fontWeight="700" fontFamily="'Syne', sans-serif">{value}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#6B7280" fontSize="9" fontFamily="'IBM Plex Mono', monospace">{sublabel}</text>
      </svg>
      <span style={{ fontSize: 11, color: "#8B92A5", fontFamily: "'IBM Plex Mono', monospace" }}>{label}</span>
    </div>
  );
}

export default function SimulationPanel() {
  const [trafficMode, setTrafficMode] = useState("normal");
  const [sliderVal, setSliderVal] = useState(50);
  const [results, setResults] = useState([]);
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState({ total: 0, malicious: 0, safe: 0, avgLatency: 0, latencies: [] });
  const logRef = useRef(null);

  const sliderMode = sliderVal <= 30 ? "rule" : sliderVal >= 70 ? "ai" : "hybrid";

  function sendRequest() {
    if (sending) return;
    setSending(true);
    setTimeout(() => {
      const isAttack = trafficMode === "attack";
      let system, latency, isMal;

      if (sliderMode === "rule") {
        system = "Rule-Based";
        latency = Math.round(6 + Math.random() * 6);
        isMal = isAttack ? Math.random() < 0.68 : Math.random() < 0.05;
      } else if (sliderMode === "ai") {
        system = "AI-Based";
        latency = Math.round(100 + Math.random() * 40);
        isMal = isAttack ? Math.random() < 0.94 : Math.random() < 0.008;
      } else {
        const useAI = isAttack ? Math.random() < 0.7 : Math.random() < 0.25;
        system = useAI ? "AI-Based" : "Rule-Based";
        latency = useAI ? Math.round(100 + Math.random() * 40) : Math.round(6 + Math.random() * 6);
        isMal = isAttack ? Math.random() < (useAI ? 0.94 : 0.68) : Math.random() < 0.01;
      }

      const entry = { result: isMal ? "Malicious" : "Safe", system, latency, traffic: isAttack ? "attack" : "normal", ts: Date.now() };

      setResults(prev => [entry, ...prev].slice(0, 30));
      setStats(prev => {
        const newLatencies = [...prev.latencies, latency].slice(-50);
        const avg = Math.round(newLatencies.reduce((a, b) => a + b, 0) / newLatencies.length);
        return {
          total: prev.total + 1,
          malicious: prev.malicious + (isMal ? 1 : 0),
          safe: prev.safe + (isMal ? 0 : 1),
          avgLatency: avg,
          latencies: newLatencies,
        };
      });
      setSending(false);
    }, 300 + Math.random() * 200);
  }

  const modeLabel = sliderMode === "rule" ? "Rule-Based" : sliderMode === "ai" ? "AI-Based" : "Hybrid";
  const modeColor = sliderMode === "rule" ? COLORS.rule : sliderMode === "ai" ? COLORS.ai : COLORS.warn;

  const malRate = stats.total > 0 ? Math.round((stats.malicious / stats.total) * 100) : 0;

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "100%", fontFamily: "'IBM Plex Mono', monospace" }}>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: modeColor, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          <StatusDot active color={modeColor} /> &nbsp;{modeLabel} MODE
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#F0F2F8", fontFamily: "'Syne', sans-serif", letterSpacing: "-0.02em", margin: 0 }}>
          Simulation Panel
        </h2>
        <p style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>Send synthetic API traffic and observe detection behavior live</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 22 }}>
          <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 18 }}>Traffic Type</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {[["normal", "Normal", COLORS.ai], ["attack", "Attack", COLORS.danger]].map(([mode, label, color]) => (
              <button key={mode} onClick={() => setTrafficMode(mode)} style={{
                flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 12, fontWeight: 600,
                fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer",
                background: trafficMode === mode ? `${color}18` : "rgba(255,255,255,0.03)",
                border: `1px solid ${trafficMode === mode ? color : "rgba(255,255,255,0.08)"}`,
                color: trafficMode === mode ? color : "#6B7280",
                transition: "all 0.2s",
              }}>
                {trafficMode === mode && <StatusDot active color={color} />} &nbsp;{label}
              </button>
            ))}
          </div>
          <button onClick={sendRequest} disabled={sending} style={{
            width: "100%", padding: "13px 0", borderRadius: 12, fontSize: 13, fontWeight: 700,
            fontFamily: "'Syne', sans-serif", cursor: sending ? "not-allowed" : "pointer",
            background: sending ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${modeColor}cc, ${modeColor}88)`,
            border: `1px solid ${modeColor}44`, color: sending ? "#4B5563" : "#fff",
            letterSpacing: "0.05em", transition: "all 0.2s",
            transform: sending ? "scale(0.98)" : "scale(1)",
          }}>
            {sending ? "Processing..." : "▶ Send Request"}
          </button>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 22 }}>
          <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Speed ↔ Accuracy</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4B5563", marginBottom: 8 }}>
            <span>Speed Priority</span>
            <span>Accuracy Priority</span>
          </div>
          <input type="range" min="0" max="100" step="1" value={sliderVal}
            onChange={e => setSliderVal(Number(e.target.value))}
            style={{ width: "100%", accentColor: modeColor, marginBottom: 12 }} />
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 14 }}>
            {[["Rule-Based", "rule", COLORS.rule], ["Hybrid", "hybrid", COLORS.warn], ["AI-Based", "ai", COLORS.ai]].map(([label, key, color]) => (
              <span key={key} style={{
                fontSize: 10, padding: "3px 10px", borderRadius: 20,
                background: sliderMode === key ? `${color}20` : "rgba(255,255,255,0.04)",
                color: sliderMode === key ? color : "#4B5563",
                border: `1px solid ${sliderMode === key ? color + "44" : "transparent"}`,
                transition: "all 0.3s",
              }}>{label}</span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#6B7280", textAlign: "center" }}>
            Est. latency: <span style={{ color: modeColor }}>
              {sliderMode === "rule" ? "~8ms" : sliderMode === "ai" ? "~120ms" : "~40ms blend"}
            </span>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
          <GaugeArc value={stats.total} max={Math.max(stats.total, 50)} color={COLORS.rule} label="Total Requests" sublabel="requests" />
          <GaugeArc value={stats.malicious} max={Math.max(stats.total, 1)} color={COLORS.danger} label="Malicious" sublabel={`${malRate}% rate`} />
          <GaugeArc value={stats.avgLatency} max={150} color={modeColor} label="Avg Latency" sublabel="ms" />
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase" }}>Detection Log</span>
          {results.length > 0 && (
            <button onClick={() => { setResults([]); setStats({ total: 0, malicious: 0, safe: 0, avgLatency: 0, latencies: [] }); }}
              style={{ fontSize: 10, color: "#4B5563", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
              Clear
            </button>
          )}
        </div>
        {results.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#374151", fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>◈</div>
            No requests yet. Send traffic to begin simulation.
          </div>
        ) : (
          <div ref={logRef} style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
            {results.map((r, i) => <ResultEntry key={r.ts + i} entry={r} index={stats.total - 1 - i} />)}
          </div>
        )}
      </div>

    </div>
  );
}
