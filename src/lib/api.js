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

class HttpError extends Error {
  constructor(status, body, message) {
    super(message || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

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

    if (!res.ok && res.status !== 429) {
      throw new HttpError(res.status, json, `HTTP ${res.status}: ${path}`);
    }

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
    };
  } catch (err) {
    return {
      ok: false,
      error: err.name === "AbortError" ? "timeout" : err.message || "network_error",
      groundTruth,
      mode,
      scenario: scenario.id,
    };
  }
};

export const listRuns = () => request("/metrics/runs");

export const runSummary = (id = RUN_ID) =>
  request(`/metrics/runs/${encodeURIComponent(id)}/summary`);

export const runRows = (id = RUN_ID, { limit = 200, offset = 0 } = {}) =>
  request(`/metrics/runs/${encodeURIComponent(id)}?limit=${limit}&offset=${offset}`);
