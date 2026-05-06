import { useEffect, useState } from "react";
import { useAppData } from "./lib/AppDataContext";

const COLORS = {
  rule: "#4F8EF7",
  ai: "#34D399",
  danger: "#F87171",
  warn: "#FBBF24",
  neutral: "#8B92A5",
};

/**
 * Smoothly counts up to a target number. Ignores non-numeric values.
 */
function useAnimatedNumber(target, duration = 700) {
  const [value, setValue] = useState(typeof target === "number" ? target : 0);
  useEffect(() => {
    if (typeof target !== "number" || !Number.isFinite(target)) return;
    let raf;
    let start = null;
    const from = value;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setValue(from + (target - from) * progress);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => raf && cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return value;
}

function MetricCard({ label, value, sub, color, suffix = "", precision = 0 }) {
  const animated = useAnimatedNumber(typeof value === "number" ? value : 0);
  const display = typeof value === "number"
    ? (precision > 0 ? animated.toFixed(precision) : Math.round(animated).toLocaleString())
    : value;
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14,
      padding: "20px 22px",
      display: "flex", flexDirection: "column", gap: 6,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle at 80% 20%, ${color}22 0%, transparent 70%)`,
      }} />
      <span style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace" }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 700, color: "#F0F2F8", fontFamily: "'Syne', sans-serif", letterSpacing: "-0.02em" }}>
        {display}{suffix}
      </span>
      {sub && <span style={{ fontSize: 12, color: color || "#8B92A5" }}>{sub}</span>}
    </div>
  );
}

function PercentileBars({ title, latency, max }) {
  if (!latency) return null;
  const safeMax = Math.max(max, latency.max || 0, 1);
  const bars = [
    ["p50", latency.p50, COLORS.rule],
    ["p90", latency.p90, COLORS.warn],
    ["p95", latency.p95, COLORS.danger],
    ["p99", latency.p99, "#A78BFA"],
  ];
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "#8B92A5" }}>{title}</span>
        <span style={{ fontSize: 11, color: COLORS.neutral }}>{latency.count} samples · max {fmtMs(latency.max)}</span>
      </div>
      {bars.map(([label, val, color]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: "#6B7280", width: 30 }}>{label}</span>
          <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${Math.min((val / safeMax) * 100, 100)}%`,
              height: "100%", background: color, transition: "width 0.6s",
            }} />
          </div>
          <span style={{ fontSize: 11, color, width: 70, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>
            {fmtMs(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

function FiredRulesList({ firedRules }) {
  const entries = Object.entries(firedRules || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <div style={{ color: "#4B5563", fontSize: 12 }}>No rules have fired yet.</div>;
  }
  const max = Math.max(...entries.map((e) => e[1]));
  return (
    <div>
      {entries.slice(0, 8).map(([id, count]) => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#9CA3AF", width: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {id}
          </span>
          <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${(count / max) * 100}%`, height: "100%", background: COLORS.rule }} />
          </div>
          <span style={{ fontSize: 11, color: "#9CA3AF", width: 30, textAlign: "right" }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

function ConfusionGrid({ classification }) {
  if (!classification) return null;
  const c = classification;
  const cells = [
    ["True Positive", c.tp, COLORS.ai, "malicious blocked"],
    ["False Negative", c.fn, COLORS.warn, "malicious allowed"],
    ["False Positive", c.fp, COLORS.danger, "legitimate blocked"],
    ["True Negative", c.tn, COLORS.rule, "legitimate allowed"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {cells.map(([label, value, color, sub]) => (
        <div key={label} style={{
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${color}22`,
          borderLeft: `3px solid ${color}`,
          borderRadius: 10,
          padding: "12px 14px",
        }}>
          <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#F0F2F8", fontFamily: "'Syne', sans-serif", margin: "4px 0 2px" }}>{value}</div>
          <div style={{ fontSize: 10, color }}>{sub}</div>
        </div>
      ))}
    </div>
  );
}

function ModeBreakdown({ mode }) {
  const total = Object.values(mode || {}).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const order = ["rule", "hybrid", "ai"];
  return (
    <div>
      {order.map((m) => {
        const v = mode?.[m] || 0;
        const pct = total > 0 ? (v / total) * 100 : 0;
        const color = m === "rule" ? COLORS.rule : m === "ai" ? COLORS.ai : COLORS.warn;
        return (
          <div key={m} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "#9CA3AF", textTransform: "capitalize" }}>{m}</span>
              <span style={{ fontSize: 11, color }}>{v} · {pct.toFixed(0)}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.6s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmtMs(v) {
  if (v == null) return "—";
  if (v < 10) return `${v.toFixed(2)} ms`;
  if (v < 100) return `${v.toFixed(1)} ms`;
  return `${Math.round(v)} ms`;
}

function fmtPct(v) {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

export default function AnalysisDashboard() {
  // The dashboard always shows the live run from this session. The summary
  // comes from the shared context (one polling loop for the whole app).
  const { summary, summaryLoading: loading } = useAppData();

  const c = summary?.classification;
  const lat = summary?.latencyMs;
  const counts = summary?.counts;
  const total = summary?.total ?? 0;
  const throughput = summary?.throughput?.requestsPerSecond ?? 0;
  const overallMaxLatency = Math.max(
    lat?.detection?.max || 0,
    lat?.aiCall?.max || 0,
    1,
  );

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", height: "100%", fontFamily: "'IBM Plex Mono', monospace" }}>
      {/* <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, color: COLORS.rule, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          ● LIVE · {new Date().toLocaleTimeString()}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#F0F2F8", fontFamily: "'Syne', sans-serif", letterSpacing: "-0.02em", margin: 0 }}>
          Analysis Dashboard
        </h2>
        <p style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>
          Real-time accuracy & latency metrics, computed server-side from the JSONL log.
          API: <code style={{ color: "#9CA3AF" }}>{API_BASE}</code>
        </p>
      </div> */}

      {/* Run picker */}
      {/* <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 18,
        padding: "10px 14px",
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
      }}>
        <span style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase" }}>Run</span>
        <select value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)} style={{
          background: "rgba(255,255,255,0.04)", color: "#E5E7EB",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
          padding: "6px 10px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
          minWidth: 280, cursor: "pointer",
        }}>
          <option value={RUN_ID}>● {RUN_ID} (this session)</option>
          {allRuns
            .filter((r) => r.runId !== RUN_ID)
            .map((r) => (
              <option key={r.runId} value={r.runId}>{r.runId}</option>
            ))}
        </select>
        <span style={{ fontSize: 10, color: "#4B5563", marginLeft: "auto" }}>
          {loading ? "loading…" : error ? `error: ${error}` : `${total} records`}
        </span>
      </div> */}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <MetricCard label="Total Requests" value={total} sub={`${counts?.allowed ?? 0} allowed · ${counts?.blocked ?? 0} blocked`} color={COLORS.rule} />
        <MetricCard label="Accuracy" value={c ? c.accuracy * 100 : 0} suffix="%" precision={1} sub={`F1 ${fmtPct(c?.f1)} · FPR ${fmtPct(c?.fpr)}`} color={COLORS.ai} />
        <MetricCard label="Detection p95" value={lat?.detection?.p95 || 0} suffix=" ms" precision={2} sub={`mean ${fmtMs(lat?.detection?.mean)}`} color={COLORS.warn} />
        <MetricCard label="Throughput" value={throughput} suffix=" rps" precision={1} sub={`fallback ${counts?.fallbackUsed ?? 0} · budget hits ${counts?.budgetExceeded ?? 0}`} color={COLORS.danger} />
      </div>

      {/* Empty-state */}
      {total === 0 && !loading && (
        <div style={{
          padding: "32px", textAlign: "center",
          background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)",
          borderRadius: 16, color: "#6B7280",
        }}>
          <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.5 }}>◈</div>
          <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 4 }}>
            No detection records for this run yet.
          </div>
          <div style={{ fontSize: 12, color: "#4B5563" }}>
            Switch to the Simulation Panel and send some traffic — metrics will populate here in real time.
          </div>
        </div>
      )}

      {/* Latency + Confusion */}
      {total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
              Latency Percentiles
            </div>
            <PercentileBars title="Total detection" latency={lat?.detection} max={overallMaxLatency} />
            <PercentileBars title="Rule engine only" latency={lat?.ruleEngine} max={overallMaxLatency} />
            <PercentileBars title="AI call only" latency={lat?.aiCall} max={overallMaxLatency} />
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
              Confusion Matrix
            </div>
            <ConfusionGrid classification={c} />
            <div style={{ marginTop: 18, padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
              <Stat label="Precision" value={fmtPct(c?.precision)} color={COLORS.ai} />
              <Stat label="Recall" value={fmtPct(c?.recall)} color={COLORS.rule} />
              <Stat label="Specificity" value={fmtPct(c?.specificity)} color={COLORS.warn} />
              <Stat label="False Positive Rate" value={fmtPct(c?.fpr)} color={COLORS.danger} />
            </div>
          </div>
        </div>
      )}

      {/* Mode breakdown + Fired rules */}
      {total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
              Mode Breakdown
            </div>
            <ModeBreakdown mode={summary?.breakdown?.mode} />
            <div style={{ marginTop: 14 }}>
              <Stat label="Decisions: rule" value={summary?.breakdown?.decisionSource?.rule || 0} color={COLORS.rule} />
              <Stat label="Decisions: ai" value={summary?.breakdown?.decisionSource?.ai || 0} color={COLORS.ai} />
              <Stat label="Decisions: fallback" value={summary?.breakdown?.decisionSource?.fallback || 0} color={COLORS.warn} />
              <Stat label="Decisions: none" value={summary?.breakdown?.decisionSource?.none || 0} color="#6B7280" />
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 11, color: "#8B92A5", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
              Top Fired Rules
            </div>
            <FiredRulesList firedRules={summary?.breakdown?.firedRules} />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px dashed rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{label}</span>
      <span style={{ fontSize: 12, color, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
    </div>
  );
}
