import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as api from "./api";
import { RUN_ID } from "./config";

/**
 * Single source of truth for cross-cutting backend data:
 *   - readiness state of the rule and AI servers (drives the sidebar badge)
 *   - the live run's summary (drives the dashboard cards and top-bar pills)
 *
 * Without this, App.jsx and AnalysisDashboard.jsx would each install their
 * own polling timers against the same endpoints, which on the deployed
 * Render free tier means double the cold-start hits, double the egress, and
 * a needlessly chatty network panel.
 *
 * Polling rules:
 *   - cadence is conservative (15s health, 8s summary when active, 20s when idle)
 *   - polling pauses while the tab is hidden (Page Visibility API)
 *   - imperative `refreshSummary()` lets the simulation panel push fresh data
 *     to all consumers immediately after a user action
 */

const HEALTH_INTERVAL_MS = 15_000;
const SUMMARY_ACTIVE_INTERVAL_MS = 8_000;
const SUMMARY_IDLE_INTERVAL_MS = 20_000;
const HIDDEN_RECHECK_MS = 4_000;

const defaultHealth = {
  state: "waking", // "waking" | "ok" | "degraded" | "down"
  rule: null,
  ai: null,
  aiUrl: null,
  aiLatencyMs: null,
  error: null,
  lastChecked: null,
};

const Ctx = createContext({
  health: defaultHealth,
  summary: null,
  summaryError: null,
  summaryLoading: true,
  refreshSummary: async () => {},
  refreshHealth: async () => {},
});

export const useAppData = () => useContext(Ctx);

const isPageVisible = () => typeof document === "undefined" || !document.hidden;

const computeHealth = (res) => {
  const data = res.body?.data || res.body || {};
  const ruleOk = res.ok;
  const aiOk = !!data.aiServer?.reachable;
  return {
    state: ruleOk && aiOk ? "ok" : ruleOk ? "degraded" : "down",
    rule: ruleOk,
    ai: aiOk,
    aiUrl: data.aiServer?.url || null,
    aiLatencyMs: data.aiServer?.latencyMs ?? null,
    error: null,
    lastChecked: new Date().toISOString(),
  };
};

/**
 * Generic visibility-aware polling loop. Returns a cleanup function and an
 * imperative trigger you can call to fetch immediately and reset the cadence.
 */
function startPolling({ fetchFn, getInterval }) {
  let cancelled = false;
  let timer = null;

  const schedule = (delay) => {
    if (cancelled) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, delay);
  };

  async function tick() {
    if (cancelled) return;
    if (!isPageVisible()) {
      schedule(HIDDEN_RECHECK_MS);
      return;
    }
    let result;
    try {
      result = await fetchFn();
    } finally {
      schedule(getInterval(result));
    }
  }

  tick();

  const trigger = async () => {
    if (cancelled) return null;
    if (timer) clearTimeout(timer);
    let result;
    try {
      result = await fetchFn();
    } finally {
      schedule(getInterval(result));
    }
    return result;
  };

  const stop = () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };

  return { trigger, stop };
}

export function AppDataProvider({ children }) {
  const [health, setHealth] = useState(defaultHealth);
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const summaryCtrl = useRef(null);
  const healthCtrl = useRef(null);

  // Health
  useEffect(() => {
    const ctrl = startPolling({
      fetchFn: async () => {
        try {
          const res = await api.ready();
          setHealth(computeHealth(res));
          return { ok: true };
        } catch (err) {
          setHealth((prev) => ({
            ...prev,
            state: "down",
            error: err.message || "unreachable",
            lastChecked: new Date().toISOString(),
          }));
          return { ok: false };
        }
      },
      getInterval: () => HEALTH_INTERVAL_MS,
    });
    healthCtrl.current = ctrl;
    return ctrl.stop;
  }, []);

  // Summary
  useEffect(() => {
    const ctrl = startPolling({
      fetchFn: async () => {
        try {
          const res = await api.runSummary(RUN_ID);
          const data = res.body?.data || null;
          setSummary(data);
          setSummaryError(null);
          setSummaryLoading(false);
          return data;
        } catch (err) {
          setSummaryError(err.message || "fetch_failed");
          setSummaryLoading(false);
          return null;
        }
      },
      getInterval: (data) =>
        (data?.total ?? 0) > 0 ? SUMMARY_ACTIVE_INTERVAL_MS : SUMMARY_IDLE_INTERVAL_MS,
    });
    summaryCtrl.current = ctrl;

    // When the tab regains focus, force an immediate poll so the user sees
    // up-to-date data the moment they switch back.
    const onVisibility = () => {
      if (isPageVisible() && summaryCtrl.current) summaryCtrl.current.trigger();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      ctrl.stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const refreshSummary = useCallback(async () => {
    return summaryCtrl.current ? summaryCtrl.current.trigger() : null;
  }, []);

  const refreshHealth = useCallback(async () => {
    return healthCtrl.current ? healthCtrl.current.trigger() : null;
  }, []);

  return (
    <Ctx.Provider
      value={{ health, summary, summaryError, summaryLoading, refreshSummary, refreshHealth }}
    >
      {children}
    </Ctx.Provider>
  );
}
