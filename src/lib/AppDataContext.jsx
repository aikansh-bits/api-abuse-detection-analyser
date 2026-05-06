import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as api from "./api";
import { AI_API, API_BASE, RUN_ID } from "./config";

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

/**
 * Render's free tier sleeps services after 15 minutes of inactivity. A cold
 * start typically takes 30-60 s. Within this grace window we report the
 * status as "waking up" rather than "down" / "degraded", so the very first
 * page load doesn't flash a scary message while the backends are legitimately
 * just booting.
 */
const COLD_START_GRACE_MS = 75_000;

/**
 * Send a no-op fetch to the given URL purely to wake a sleeping Render
 * service. We don't care about the response or whether it succeeds — the
 * point is just to kick off the cold start as early as possible.
 */
const warmup = (url) => {
  if (!url) return;
  try {
    fetch(`${url}/health`, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      // 30s is well past the typical free-tier wake time. We deliberately
      // don't abort — once started, let it run to completion.
      signal: AbortSignal.timeout ? AbortSignal.timeout(30_000) : undefined,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
};

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
  const [hasBeenHealthy, setHasBeenHealthy] = useState(false);
  const mountedAt = useRef(Date.now());

  const summaryCtrl = useRef(null);
  const healthCtrl = useRef(null);

  // Cold-start warmup. Fire one ping at each backend in parallel as early as
  // possible so they wake up concurrently. Both calls are fire-and-forget;
  // the regular polling below picks up the actual readiness signal.
  useEffect(() => {
    warmup(API_BASE);
    warmup(AI_API);
  }, []);

  // Health
  useEffect(() => {
    const ctrl = startPolling({
      fetchFn: async () => {
        try {
          const res = await api.ready();
          const next = computeHealth(res);
          setHealth(next);
          if (next.state === "ok") setHasBeenHealthy(true);
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

  // Wrap the raw health state in a "waking" grace period for the very first
  // page load. We say "waking" while we're still inside the cold-start window
  // AND haven't yet observed a fully-healthy state. After that, fall through
  // to the underlying health.state ("ok" / "degraded" / "down").
  const elapsedSinceMount = Date.now() - mountedAt.current;
  const inGrace = elapsedSinceMount < COLD_START_GRACE_MS && !hasBeenHealthy;
  const displayedHealth =
    inGrace && health.state !== "ok"
      ? { ...health, state: "waking" }
      : health;

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
      value={{
        health: displayedHealth,
        summary,
        summaryError,
        summaryLoading,
        refreshSummary,
        refreshHealth,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
