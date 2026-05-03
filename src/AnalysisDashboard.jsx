import { useState, useEffect } from "react";

const COLORS = {
  rule: "#4F8EF7",
  ai: "#34D399",
  danger: "#F87171",
  warn: "#FBBF24",
};

function useAnimatedNumber(target, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = null;
    const from = 0;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setValue(Math.round(from + (target - from) * progress));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

function MetricCard({ label, value, sub, color, prefix = "", suffix = "" }) {
  const animated = useAnimatedNumber(typeof value === "number" ? value : 0);
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 80, height: 80,
        background: `radial-gradient(circle at 80% 20%, ${color}22 0%, transparent 70%)`,
      }} />
      <span style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace" }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 700, color: "#F0F2F8", fontFamily: "'Syne', sans-serif", letterSpacing: "-0.02em" }}>
        {prefix}{typeof value === "number" ? animated.toLocaleString() : value}{suffix}
      </span>
      {sub && <span style={{ fontSize: 12, color: color || "#8B92A5" }}>{sub}</span>}
    </div>
  );
}

function MiniBarChart({ ruleVal, aiVal, label }) {
  const max = Math.max(ruleVal, aiVal, 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#8B92A5", fontFamily: "'IBM Plex Mono', monospace" }}>{label}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[["Rule-Based", ruleVal, COLORS.rule], ["AI-Based", aiVal, COLORS.ai]].map(([name, val, color]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "#6B7280", width: 72, flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace" }}>{name}</span>
            <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                width: `${(val / max) * 100}%`, height: "100%",
                background: color, borderRadius: 4,
                transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
              }} />
            </div>
            <span style={{ fontSize: 12, color, width: 42, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{val}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SparkLine({ data, color, height = 60 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 220, h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 8) - 4}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#sg-${color.replace("#","")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function LatencyChart({ ruleData, aiData }) {
  const labels = ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "10m"];
  const allVals = [...ruleData, ...aiData];
  const maxV = Math.max(...allVals);
  const minV = Math.min(...allVals);
  const range = maxV - minV || 1;
  const W = 440, H = 120;

  const toPath = (data) =>
    data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - minV) / range) * (H - 16) - 8}`).join(" ");

  const rulePts = toPath(ruleData);
  const aiPts = toPath(aiData);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        {[["Rule-Based", COLORS.rule, "dashed"], ["AI-Based", COLORS.ai, "solid"]].map(([name, color, dash]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke={color} strokeWidth="2" strokeDasharray={dash === "dashed" ? "4,3" : "none"} /></svg>
            <span style={{ fontSize: 11, color: "#8B92A5", fontFamily: "'IBM Plex Mono', monospace" }}>{name}</span>
          </div>
        ))}
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="ruleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.rule} stopOpacity="0.15" />
            <stop offset="100%" stopColor={COLORS.rule} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.ai} stopOpacity="0.15" />
            <stop offset="100%" stopColor={COLORS.ai} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1="0" y1={H * f} x2={W} y2={H * f} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        <polygon points={`0,${H} ${rulePts} ${W},${H}`} fill="url(#ruleGrad)" />
        <polygon points={`0,${H} ${aiPts} ${W},${H}`} fill="url(#aiGrad)" />
        <polyline points={rulePts} fill="none" stroke={COLORS.rule} strokeWidth="1.5" strokeDasharray="4,3" strokeLinejoin="round" />
        <polyline points={aiPts} fill="none" stroke={COLORS.ai} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {labels.map(l => <span key={l} style={{ fontSize: 10, color: "#4B5563", fontFamily: "'IBM Plex Mono', monospace" }}>{l}</span>)}
      </div>
    </div>
  );
}

function AccuracyBars() {
  const metrics = [
    { label: "Accuracy", rule: 72, ai: 96 },
    { label: "Detection", rule: 68, ai: 94 },
    { label: "F1 Score", rule: 70, ai: 95 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {metrics.map(m => (
        <div key={m.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#6B7280", fontFamily: "'IBM Plex Mono', monospace" }}>{m.label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 36, textAlign: "right", fontSize: 11, color: COLORS.rule, fontFamily: "'IBM Plex Mono', monospace" }}>{m.rule}%</div>
            <div style={{ flex: 1, display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
              <div style={{ width: `${m.rule}%`, background: COLORS.rule, opacity: 0.8 }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 36, textAlign: "right", fontSize: 11, color: COLORS.ai, fontFamily: "'IBM Plex Mono', monospace" }}>{m.ai}%</div>
            <div style={{ flex: 1, display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
              <div style={{ width: `${m.ai}%`, background: COLORS.ai }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalysisDashboard() {
  const [ruleLatency, setRuleLatency] = useState(() => Array.from({ length: 10 }, () => 6 + Math.random() * 6));
  const [aiLatency, setAiLatency] = useState(() => Array.from({ length: 10 }, () => 100 + Math.random() * 40));
  const [rps, setRps] = useState(() => Array.from({ length: 8 }, () => 8000 + Math.random() * 4000));

  useEffect(() => {
    const id = setInterval(() => {
      setRuleLatency(prev => [...prev.slice(1), 6 + Math.random() * 6]);
      setAiLatency(prev => [...prev.slice(1), 100 + Math.random() * 40]);
      setRps(prev => [...prev.slice(1), 8000 + Math.random() * 4000]);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const insights = [
    { icon: "◈", color: COLORS.ai, title: "High-security systems", desc: "Use AI-based detection for banking & payments. 96% accuracy justifies the 120ms overhead." },
    { icon: "◎", color: COLORS.rule, title: "Real-time & gaming", desc: "Rule-based at 8ms is ideal for latency-critical paths. Accept the 72% accuracy trade-off." },
    { icon: "◉", color: COLORS.warn, title: "Hybrid recommended", desc: "Route suspicious requests to AI, pass clean traffic through rules. Best of both worlds." },
    { icon: "◐", color: COLORS.danger, title: "Attack spike detected", desc: "Novel evasion patterns degrade rule-based by ~15%. AI maintains 98%+ under active attacks." },
  ];

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "100%", fontFamily: "'IBM Plex Mono', monospace" }}>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: "#4F8EF7", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          ● LIVE · {new Date().toLocaleTimeString()}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#F0F2F8", fontFamily: "'Syne', sans-serif", letterSpacing: "-0.02em", margin: 0 }}>
          Analysis Dashboard
        </h2>
        <p style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>Real-time performance metrics across both detection systems</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <MetricCard label="Total Requests" value={24831} sub="↑ 12% last hour" color={COLORS.rule} />
        <MetricCard label="Malicious Detected" value={1204} sub="↑ 3.4% session" color={COLORS.danger} />
        <MetricCard label="False Positives" value={87} sub="↓ 0.8% vs baseline" color={COLORS.warn} />
        <MetricCard label="Avg Latency" value={42} suffix=" ms" sub="blended mode" color={COLORS.ai} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Latency Over Time</div>
          <LatencyChart ruleData={ruleLatency} aiData={aiLatency} />
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Accuracy Metrics</div>
          <AccuracyBars />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Requests / Second</div>
          <SparkLine data={rps} color={COLORS.rule} height={72} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <span style={{ fontSize: 11, color: "#4B5563" }}>Rule-based peak: {Math.round(Math.max(...rps)).toLocaleString()} rps</span>
            <span style={{ fontSize: 11, color: COLORS.rule }}>{Math.round(rps[rps.length - 1]).toLocaleString()} now</span>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>System Comparison</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <MiniBarChart ruleVal={72} aiVal={96} label="Accuracy %" />
            <MiniBarChart ruleVal={68} aiVal={94} label="Detection Rate %" />
          </div>
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Insights & Recommendations</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {insights.map((ins) => (
            <div key={ins.title} style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${ins.color}22`,
              borderLeft: `3px solid ${ins.color}`,
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 18, color: ins.color, lineHeight: 1, marginTop: 1 }}>{ins.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#E5E7EB", marginBottom: 4, fontFamily: "'Syne', sans-serif" }}>{ins.title}</div>
                <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.6 }}>{ins.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
