import { useCallback, useMemo, useRef, useState } from "react";
import { sendDetectionRequest } from "./lib/api";
import { LEGITIMATE, MALICIOUS, pick, sliderModeToHeader } from "./lib/scenarios";
import { useAppData } from "./lib/AppDataContext";

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
  const isBlocked = entry.decision === "block";
  const groundIsMal = entry.groundTruth === "malicious";
  const correct = (groundIsMal && isBlocked) || (!groundIsMal && !isBlocked);
  const verdictLabel = isBlocked ? "Blocked" : "Allowed";
  const verdictColor = isBlocked ? COLORS.danger : COLORS.ai;
  const sourceLabel = entry.decisionSource === "rule" ? "rule"
    : entry.decisionSource === "ai" ? "ai"
    : entry.decisionSource === "fallback" ? "fallback"
    : "—";
  const latency = entry.detectionLatencyMs ?? entry.clientLatencyMs;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
      background: isBlocked ? "rgba(248,113,113,0.05)" : "rgba(52,211,153,0.04)",
      border: `1px solid ${isBlocked ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.12)"}`,
      borderRadius: 10,
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <span style={{ fontSize: 10, color: "#4B5563", minWidth: 36 }}>#{String(index + 1).padStart(3, "0")}</span>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 6,
        background: isBlocked ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)",
        color: verdictColor,
        minWidth: 76, textAlign: "center",
      }}>{verdictLabel}</span>
      <span style={{
        fontSize: 10, color: groundIsMal ? COLORS.danger : COLORS.ai,
        opacity: 0.7, minWidth: 70,
      }}>{groundIsMal ? "✱ malicious" : "✓ legitimate"}</span>
      <span style={{ fontSize: 11, color: COLORS.neutral, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {entry.label}
      </span>
      <span style={{
        fontSize: 10, padding: "2px 8px", borderRadius: 4,
        background: "rgba(255,255,255,0.04)", color: "#9CA3AF",
        minWidth: 60, textAlign: "center",
      }}>src: {sourceLabel}</span>
      <span style={{
        fontSize: 11, color: latency != null && latency < 5 ? COLORS.rule : "#A78BFA",
        minWidth: 64, textAlign: "right",
      }}>
        {latency != null ? `${latency.toFixed(2)} ms` : "—"}
      </span>
      <span style={{
        fontSize: 10, opacity: correct ? 0.6 : 1, minWidth: 14, textAlign: "center",
        color: correct ? COLORS.ai : COLORS.warn,
      }}>{correct ? "✓" : "!"}</span>
    </div>
  );
}

function GaugeArc({ value, max, color, label, sublabel }) {
  const safeMax = Math.max(max, 1);
  const pct = Math.min(value / safeMax, 1);
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

const initialStats = () => ({
  total: 0,
  blocked: 0,
  allowed: 0,
  tp: 0, fp: 0, tn: 0, fn: 0,
  errors: 0,
  ruleSrc: 0, aiSrc: 0, fallbackSrc: 0, noneSrc: 0,
  latencies: [],
  lastDetectionLatency: null,
});

// Slider value <-> mode mapping. The slider uses 0-100 so the user can fine-tune
// "speed vs accuracy" feel, but we snap to canonical positions when they click
// one of the mode pills.
const MODE_TO_SLIDER = { rule: 10, hybrid: 50, ai: 90 };
const sliderToMode = (v) => (v <= 30 ? "rule" : v >= 70 ? "ai" : "hybrid");

const BUDGET_PRESETS = [10, 25, 50, 100, 250];

export default function SimulationPanel() {
  const [trafficMode, setTrafficMode] = useState("normal");      // normal | attack
  const [sliderVal, setSliderVal] = useState(50);                // 0-100
  const [budgetMs, setBudgetMs] = useState(50);                  // detection latency budget
  const [results, setResults] = useState([]);                    // recent N entries
  const [stats, setStats] = useState(initialStats);
  const [busy, setBusy] = useState(false);                       // disable buttons during one-shot
  const [bursting, setBursting] = useState(false);               // burst-test in progress
  const [errorMsg, setErrorMsg] = useState(null);
  const burstAbort = useRef(false);

  const { refreshSummary } = useAppData();

  const sliderMode = sliderToMode(sliderVal);
  const modeLabel = sliderMode === "rule" ? "Rule-Based" : sliderMode === "ai" ? "AI-Based" : "Hybrid";
  const modeColor = sliderMode === "rule" ? COLORS.rule : sliderMode === "ai" ? COLORS.ai : COLORS.warn;

  const accuracy = useMemo(() => {
    const t = stats.tp + stats.tn + stats.fp + stats.fn;
    return t === 0 ? 0 : Math.round(((stats.tp + stats.tn) / t) * 100);
  }, [stats]);

  const recordResult = useCallback((entry) => {
    setResults((prev) => [entry, ...prev].slice(0, 40));
    setStats((prev) => {
      const next = { ...prev };
      next.total += 1;
      if (entry.error) {
        next.errors += 1;
        return next;
      }
      const blocked = entry.decision === "block";
      if (blocked) next.blocked += 1; else next.allowed += 1;

      if (entry.groundTruth === "malicious" && blocked) next.tp += 1;
      else if (entry.groundTruth === "legitimate" && blocked) next.fp += 1;
      else if (entry.groundTruth === "legitimate" && !blocked) next.tn += 1;
      else if (entry.groundTruth === "malicious" && !blocked) next.fn += 1;

      if (entry.decisionSource === "rule") next.ruleSrc += 1;
      else if (entry.decisionSource === "ai") next.aiSrc += 1;
      else if (entry.decisionSource === "fallback") next.fallbackSrc += 1;
      else next.noneSrc += 1;

      if (entry.detectionLatencyMs != null) {
        next.latencies = [...prev.latencies, entry.detectionLatencyMs].slice(-200);
        next.lastDetectionLatency = entry.detectionLatencyMs;
      }
      return next;
    });
  }, []);

  const fireOne = useCallback(async () => {
    setErrorMsg(null);
    const isAttack = trafficMode === "attack";
    const scenario = isAttack ? pick(MALICIOUS) : pick(LEGITIMATE);
    const groundTruth = isAttack ? "malicious" : "legitimate";
    const mode = sliderModeToHeader(sliderMode);

    const result = await sendDetectionRequest({
      scenario,
      mode,
      budgetMs,
      groundTruth,
    });

    const entry = {
      label: scenario.label,
      decision: result.decision,
      decisionSource: result.decisionSource,
      detectionLatencyMs: result.detectionLatencyMs,
      clientLatencyMs: result.clientLatencyMs,
      groundTruth,
      mode,
      ts: Date.now(),
      error: result.ok ? null : result.error,
    };

    if (!result.ok) {
      // We retried once internally; if we still failed, surface a friendlier
      // message that distinguishes transient network hiccups from real bugs.
      const friendly =
        result.error === "timeout"
          ? "Request timed out — the rule server may still be cold-starting on Render. Try again in a few seconds."
          : result.error === "network_error" || result.error === "Failed to fetch"
            ? "Network error — check your connection (the request was retried once and still failed)."
            : `Request failed: ${result.error}`;
      setErrorMsg(friendly);
    }
    recordResult(entry);
  }, [trafficMode, sliderMode, budgetMs, recordResult]);

  const handleSend = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fireOne();
      // Push a fresh summary fetch so the dashboard updates immediately.
      refreshSummary();
    } finally {
      setBusy(false);
    }
  }, [busy, fireOne, refreshSummary]);

  const handleBurst = useCallback(async () => {
    if (bursting) {
      burstAbort.current = true;
      return;
    }
    setBursting(true);
    burstAbort.current = false;
    setErrorMsg(null);

    const N = 30;
    const concurrency = 4;
    const queue = Array.from({ length: N }, (_, i) => i);

    const worker = async () => {
      while (queue.length > 0 && !burstAbort.current) {
        queue.shift();
        await fireOne();
        // small jitter so the rule-server's burst detector can fire reasonably
        await new Promise((r) => setTimeout(r, 60 + Math.random() * 80));
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));
    setBursting(false);
    refreshSummary();
  }, [bursting, fireOne, refreshSummary]);

  const handleClear = () => {
    setResults([]);
    setStats(initialStats());
    setErrorMsg(null);
  };

  const blockRate = stats.total > 0 ? Math.round(((stats.blocked) / stats.total) * 100) : 0;
  const avgLatency = stats.latencies.length > 0
    ? Math.round((stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length) * 10) / 10
    : 0;

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "100%", fontFamily: "'IBM Plex Mono', monospace" }}>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: modeColor, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          <StatusDot active color={modeColor} /> &nbsp;{modeLabel} MODE · BUDGET {budgetMs}ms
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#F0F2F8", fontFamily: "'Syne', sans-serif", letterSpacing: "-0.02em", margin: 0 }}>
          Simulation Panel
        </h2>
        {/* <p style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>
          Live traffic to the rule-based-server · run id&nbsp;
          <code style={{ color: "#9CA3AF", fontSize: 12 }}>{RUN_ID}</code>
        </p> */}
      </div>

      {errorMsg && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 10,
          background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)",
          color: COLORS.danger, fontSize: 12,
        }}>
          {errorMsg}
        </div>
      )}

      {/* Controls */}
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
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSend} disabled={busy || bursting} style={{
              flex: 1, padding: "13px 0", borderRadius: 12, fontSize: 13, fontWeight: 700,
              fontFamily: "'Syne', sans-serif", cursor: (busy || bursting) ? "not-allowed" : "pointer",
              background: (busy || bursting) ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${modeColor}cc, ${modeColor}88)`,
              border: `1px solid ${modeColor}44`, color: (busy || bursting) ? "#4B5563" : "#fff",
              letterSpacing: "0.05em", transition: "all 0.2s",
            }}>
              {busy ? "Sending..." : "▶ Send Request"}
            </button>
            <button onClick={handleBurst} style={{
              flex: 1, padding: "13px 0", borderRadius: 12, fontSize: 12, fontWeight: 700,
              fontFamily: "'Syne', sans-serif", cursor: "pointer",
              background: bursting ? `${COLORS.warn}25` : "rgba(255,255,255,0.04)",
              border: `1px solid ${bursting ? COLORS.warn : "rgba(255,255,255,0.10)"}`,
              color: bursting ? COLORS.warn : "#9CA3AF",
              letterSpacing: "0.05em", transition: "all 0.2s",
            }}>
              {bursting ? "■ Stop burst" : "◎ Burst x30"}
            </button>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 22 }}>
          <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Speed ↔ Accuracy</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4B5563", marginBottom: 8 }}>
            <span>Speed Priority</span>
            <span>Accuracy Priority</span>
          </div>
          <input
            type="range" min="0" max="100" step="1" value={sliderVal}
            onChange={(e) => setSliderVal(Number(e.target.value))}
            className="range-slider"
            style={{
              marginBottom: 12,
              "--thumb-color": modeColor,
              background: `linear-gradient(to right, ${modeColor} 0%, ${modeColor} ${sliderVal}%, rgba(255,255,255,0.10) ${sliderVal}%, rgba(255,255,255,0.10) 100%)`,
            }}
          />
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 14 }}>
            {[["Rule", "rule", COLORS.rule], ["Hybrid", "hybrid", COLORS.warn], ["AI", "ai", COLORS.ai]].map(([label, key, color]) => {
              const active = sliderMode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSliderVal(MODE_TO_SLIDER[key])}
                  style={{
                    fontSize: 10, padding: "4px 12px", borderRadius: 20,
                    background: active ? `${color}25` : "rgba(255,255,255,0.04)",
                    color: active ? color : "#9CA3AF",
                    border: `1px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4B5563", marginTop: 6, marginBottom: 4 }}>
            <span>Latency Budget</span>
            <span style={{ color: modeColor }}>{budgetMs} ms</span>
          </div>
          <input
            type="range" min="5" max="500" step="5" value={budgetMs}
            onChange={(e) => setBudgetMs(Number(e.target.value))}
            className="range-slider"
            style={{
              "--thumb-color": modeColor,
              background: `linear-gradient(to right, ${modeColor} 0%, ${modeColor} ${((budgetMs - 5) / 495) * 100}%, rgba(255,255,255,0.10) ${((budgetMs - 5) / 495) * 100}%, rgba(255,255,255,0.10) 100%)`,
            }}
          />
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
            {BUDGET_PRESETS.map((ms) => {
              const active = budgetMs === ms;
              return (
                <button
                  key={ms}
                  type="button"
                  onClick={() => setBudgetMs(ms)}
                  style={{
                    fontSize: 10, padding: "3px 10px", borderRadius: 14,
                    background: active ? `${modeColor}25` : "rgba(255,255,255,0.04)",
                    color: active ? modeColor : "#9CA3AF",
                    border: `1px solid ${active ? modeColor : "rgba(255,255,255,0.08)"}`,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                >
                  {ms}ms
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live KPIs */}
      {stats.total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          <GaugeArc value={stats.total} max={Math.max(stats.total, 50)} color={COLORS.rule} label="Requests" sublabel="total" />
          <GaugeArc value={stats.blocked} max={Math.max(stats.total, 1)} color={COLORS.danger} label="Blocked" sublabel={`${blockRate}% rate`} />
          <GaugeArc value={accuracy} max={100} color={COLORS.ai} label="Accuracy" sublabel="%" />
          <GaugeArc value={Math.round(avgLatency * 10) / 10} max={Math.max(budgetMs, 50)} color={modeColor} label="Avg detection" sublabel="ms" />
        </div>
      )}

      {/* Confusion Matrix + breakdown */}
      {stats.total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Confusion Matrix (this session)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
              <ConfCell label="True Positive" sub="malicious · blocked" value={stats.tp} color={COLORS.ai} />
              <ConfCell label="False Negative" sub="malicious · allowed" value={stats.fn} color={COLORS.warn} />
              <ConfCell label="False Positive" sub="legitimate · blocked" value={stats.fp} color={COLORS.danger} />
              <ConfCell label="True Negative" sub="legitimate · allowed" value={stats.tn} color={COLORS.rule} />
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Decision Source</div>
            <SourceBar label="Rule engine" value={stats.ruleSrc} total={stats.total} color={COLORS.rule} />
            <SourceBar label="AI scorer" value={stats.aiSrc} total={stats.total} color={COLORS.ai} />
            <SourceBar label="Fallback (budget)" value={stats.fallbackSrc} total={stats.total} color={COLORS.warn} />
            <SourceBar label="None (allowed)" value={stats.noneSrc} total={stats.total} color="#6B7280" />
            {stats.errors > 0 && (
              <SourceBar label="Errors" value={stats.errors} total={stats.total} color={COLORS.danger} />
            )}
          </div>
        </div>
      )}

      {/* Detection Log */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase" }}>Detection Log</span>
          {results.length > 0 && (
            <button onClick={handleClear}
              style={{ fontSize: 10, color: "#4B5563", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
              Clear
            </button>
          )}
        </div>
        {results.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#374151", fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>◈</div>
            No requests yet. Pick traffic type, choose a mode, and send.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
            {results.map((r, i) => <ResultEntry key={r.ts + "-" + i} entry={r} index={stats.total - 1 - i} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfCell({ label, sub, value, color }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${color}22`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
      padding: "12px 14px",
    }}>
      <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#F0F2F8", fontFamily: "'Syne', sans-serif", margin: "4px 0 2px" }}>{value}</div>
      <div style={{ fontSize: 10, color: color }}>{sub}</div>
    </div>
  );
}

function SourceBar({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>{label}</span>
        <span style={{ fontSize: 11, color }}>{value} · {pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}
