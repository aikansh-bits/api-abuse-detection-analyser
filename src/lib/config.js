/**
 * Frontend configuration.
 *
 * The single source of truth for "where does the backend live?". Reads
 * REACT_APP_RULE_API at build time (CRA inlines it into the bundle), with a
 * sensible localhost fallback so `npm start` works against a local server
 * with zero configuration.
 *
 * Each browser session gets its own runId so simultaneous viewers don't
 * pollute each other's JSONL run file. The id is short, URL-safe, and
 * timestamped so it sorts naturally in the metrics directory.
 */

const DEFAULT_LOCAL_RULE = "http://localhost:3000";
const DEFAULT_LOCAL_AI = "http://localhost:8000";

const stripTrailingSlash = (s) => (s || "").replace(/\/+$/, "");

export const API_BASE = stripTrailingSlash(
  process.env.REACT_APP_RULE_API || DEFAULT_LOCAL_RULE,
);

/**
 * Optional direct URL for the AI server. The frontend never makes detection
 * calls to it — those always route through the rule server — but knowing the
 * URL lets us send a parallel warmup ping on app mount, so both Render
 * services cold-start simultaneously instead of waking up serially.
 */
export const AI_API = stripTrailingSlash(
  process.env.REACT_APP_AI_API || DEFAULT_LOCAL_AI,
);

const randId = () =>
  Math.random().toString(36).slice(2, 8) +
  Math.random().toString(36).slice(2, 6);

const newRunId = () => {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `live-${ts}-${randId()}`;
};

const RUN_KEY = "apiAbuseAnalyser.runId.v1";

/**
 * Persist the run id so a page refresh keeps writing to the same JSONL file.
 * Each fresh tab still gets its own session via sessionStorage.
 */
const loadOrCreateRunId = () => {
  try {
    const existing = sessionStorage.getItem(RUN_KEY);
    if (existing) return existing;
    const id = newRunId();
    sessionStorage.setItem(RUN_KEY, id);
    return id;
  } catch {
    return newRunId();
  }
};

export const RUN_ID = loadOrCreateRunId();

export const resetRunId = () => {
  const id = newRunId();
  try {
    sessionStorage.setItem(RUN_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
};
