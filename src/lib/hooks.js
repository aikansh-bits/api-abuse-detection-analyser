import { useEffect, useRef, useState } from "react";
import * as api from "./api";

/**
 * Polls /ready every `intervalMs` so the sidebar can show real "system
 * health". The first call gets a generous timeout because Render free-tier
 * services sleep after 15 minutes of inactivity, and the wake-up roundtrip
 * can take 30–60 seconds. While we're waiting on the first response we
 * surface a `state: "waking"` status the UI can render specially.
 */
export const useApiHealth = (intervalMs = 15_000) => {
  const [state, setState] = useState({
    state: "waking", // "waking" | "ok" | "degraded" | "down"
    rule: null,
    ai: null,
    error: null,
    lastChecked: null,
  });
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    const check = async () => {
      try {
        const res = await api.ready();
        if (cancelled.current) return;
        const data = res.body?.data || res.body || {};
        const rule = res.ok;
        const ai = !!data.aiServer?.reachable;
        setState({
          state: rule && ai ? "ok" : rule ? "degraded" : "down",
          rule,
          ai,
          aiUrl: data.aiServer?.url,
          aiLatencyMs: data.aiServer?.latencyMs,
          error: null,
          lastChecked: new Date().toISOString(),
        });
      } catch (err) {
        if (cancelled.current) return;
        setState((prev) => ({
          ...prev,
          state: "down",
          error: err.message || "unreachable",
          lastChecked: new Date().toISOString(),
        }));
      }
    };

    check();
    const id = setInterval(check, intervalMs);
    return () => {
      cancelled.current = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return state;
};

/**
 * Polls the per-run summary endpoint at a steady cadence. `version` is a
 * monotonic counter the simulation panel can bump after every send to
 * trigger an immediate re-fetch (so users see their effect right away
 * instead of waiting for the next poll tick).
 */
export const useRunSummary = (runId, { intervalMs = 4_000, version = 0 } = {}) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    let timer;

    const fetchOnce = async () => {
      try {
        const res = await api.runSummary(runId);
        if (cancelled.current) return;
        setSummary(res.body?.data || null);
        setLoading(false);
        setError(null);
      } catch (err) {
        if (cancelled.current) return;
        setError(err.message || "fetch_failed");
        setLoading(false);
      } finally {
        if (!cancelled.current) {
          timer = setTimeout(fetchOnce, intervalMs);
        }
      }
    };

    fetchOnce();
    return () => {
      cancelled.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId, intervalMs, version]);

  return { summary, loading, error };
};
