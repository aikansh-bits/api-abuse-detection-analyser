import { API_BASE, RUN_ID } from "./config";

/**
 * Tiny typed-ish API client for the rule-based-server.
 *
 * Two principles:
 *   1. The frontend NEVER trusts client-side timing for accuracy data; the
 *      server is the source of truth and writes a JSONL row per request.
 *      We do still measure the round-trip on the client because it's a
 *      useful "user-perceived latency" number to display next to the
 *      server's own detection_latency_ms.
 *   2. Render's free tier sleeps after 15 minutes; first request after
 *      sleep can take 30-60s. We give the first call a generous timeout
 *      and let callers display a "waking up" state.
 */

const buildUrl = (path) => {
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
};

/**
 * Internal fetch wrapper with timeout, JSON parsing, and structured errors.
 * `expose` on the response includes a few of the rule server's exposed
 * headers (decision, decision-source, server-side detection latency) so
 * callers can render them without re-parsing the body.
 */
const request = async (path, { method = "GET", headers = {}, body, timeoutMs = 30_000 } = {}) => {
  const url = buildUrl(path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      mode: "cors",
      credentials: "omit",
    });

    const clientLatencyMs = Math.round((performance.now() - startedAt) * 1000) / 1000;
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    const expose = {
      decision: res.headers.get("x-decision"),
      decisionSource: res.headers.get("x-decision-source"),
      detectionLatencyMs: parseFloatOrNull(res.headers.get("x-detection-latency-ms")),
      requestId: res.headers.get("x-request-id"),
    };

    // Note: we intentionally do NOT throw on non-2xx HTTP statuses. A 401 from
    // /api/login with a bad password, a 429 from the detection pipeline
    // blocking a malicious request, or a 400 from /api/payment with an
    // invalid amount are all *legitimate recordable outcomes* of the
    // simulation — not infrastructure failures. Only network-level errors
    // (fetch rejection: timeout, CORS, DNS) are treated as failures, and
    // those throw out of fetch() naturally.
    return { status: res.status, ok: res.ok, body: json, clientLatencyMs, expose };
  } finally {
    clearTimeout(timer);
  }
};

const parseFloatOrNull = (s) => {
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// ─── public surface ─────────────────────────────────────────────────────────

export const apiBase = () => API_BASE;
export const runId = () => RUN_ID;

export const ping = () => request("/health", { timeoutMs: 60_000 });

export const ready = () => request("/ready", { timeoutMs: 60_000 });

export const catalog = () => request("/catalog", { timeoutMs: 60_000 });

/**
 * Send one detection request to the rule-based server's mock API.
 *
 * Returns a normalised result useful for the UI:
 *   { decision, decisionSource, detectionLatencyMs, clientLatencyMs,
 *     groundTruth, mode, requestId, status, scenario, error? }
 */
export const sendDetectionRequest = async ({
  scenario,
  mode = "hybrid",
  budgetMs,
  groundTruth = "unknown",
  runIdOverride,
  userAgent,
  // Allow first-request mode to use a longer timeout for cold starts.
  timeoutMs = 90_000,
}) => {
  const headers = {
    "x-detection-mode": mode,
    "x-ground-truth": groundTruth,
    "x-run-id": runIdOverride || RUN_ID,
    "x-scenario": scenario.id,
    ...(budgetMs ? { "x-detection-budget-ms": String(budgetMs) } : {}),
    ...(scenario.headers || {}),
    ...(userAgent ? { "user-agent": userAgent } : {}),
  };

  // We retry once on a network-level failure (not on HTTP status — those are
  // legitimate recordable outcomes). "Failed to fetch" in the browser is
  // generic and covers genuinely transient cases (connection reset, DNS
  // hiccup, edge proxy timeout) where a second attempt almost always
  // succeeds. Retrying buys reliability without masking real bugs because
  // the second attempt is identical: if the server is genuinely broken,
  // it will fail too and we surface the error normally.
  const MAX_ATTEMPTS = 2;
  const RETRY_DELAY_MS = 350;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await request(scenario.path, {
        method: scenario.method || "GET",
        headers,
        body: scenario.body,
        timeoutMs,
      });

      return {
        ok: true,
        status: res.status,
        blocked: res.status === 429,
        decision: res.expose.decision || (res.status === 429 ? "block" : "allow"),
        decisionSource: res.expose.decisionSource || "unknown",
        detectionLatencyMs: res.expose.detectionLatencyMs,
        clientLatencyMs: res.clientLatencyMs,
        requestId: res.expose.requestId,
        groundTruth,
        mode,
        scenario: scenario.id,
        body: res.body,
        retried: attempt > 1,
      };
    } catch (err) {
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      const errorCode = err.name === "AbortError" ? "timeout" : err.message || "network_error";
      if (isLastAttempt) {
        return {
          ok: false,
          error: errorCode,
          groundTruth,
          mode,
          scenario: scenario.id,
          retried: true,
        };
      }
      // Brief pause before retrying — Render's edge sometimes needs a moment
      // to recover from a connection reset.
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  // Unreachable, but keeps TypeScript / ESLint quiet.
  return { ok: false, error: "exhausted_retries", groundTruth, mode, scenario: scenario.id };
};

export const listRuns = () => request("/metrics/runs");

export const runSummary = (id = RUN_ID) =>
  request(`/metrics/runs/${encodeURIComponent(id)}/summary`);

export const runRows = (id = RUN_ID, { limit = 200, offset = 0 } = {}) =>
  request(`/metrics/runs/${encodeURIComponent(id)}?limit=${limit}&offset=${offset}`);
