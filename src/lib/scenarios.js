/**
 * Catalogue of synthetic API requests that the simulation panel fires at the
 * rule-based-server. Each entry is fully self-describing — path, method,
 * body, ground-truth label, and a short human description for the
 * detection log.
 *
 * Two top-level groups: `LEGITIMATE` and `MALICIOUS`. The simulation panel
 * picks at random from one or the other based on the user's "Traffic Type"
 * toggle. The split between attack flavours within MALICIOUS is roughly
 * representative: payload attacks, then behavioural ones.
 */

export const LEGITIMATE = [
  {
    id: "login_ok",
    label: "Login (valid credentials)",
    method: "POST",
    path: "/api/login",
    body: { username: "alice", password: "password" },
  },
  {
    id: "data_fetch",
    label: "Fetch dashboard data",
    method: "GET",
    path: "/api/data",
  },
  {
    id: "search_normal",
    label: "Search (normal keyword)",
    method: "GET",
    path: "/api/search?q=summer+sale",
  },
  {
    id: "payment_small",
    label: "Process a small payment",
    method: "POST",
    path: "/api/payment",
    body: { amount: 42.5, currency: "USD" },
  },
  {
    id: "profile_view",
    label: "View profile",
    method: "GET",
    path: "/api/profile/u-1042",
  },
  {
    id: "echo_ping",
    label: "Echo ping",
    method: "GET",
    path: "/api/echo",
  },
];

export const MALICIOUS = [
  {
    id: "sqli_tautology",
    label: "SQL injection — '1'='1' tautology",
    family: "sqli",
    method: "GET",
    path: "/api/search?q=1%27%20OR%20%271%27%3D%271",
  },
  {
    id: "sqli_union",
    label: "SQL injection — UNION SELECT",
    family: "sqli",
    method: "GET",
    path: "/api/search?q=1%27%20UNION%20SELECT%20*%20FROM%20users--",
  },
  {
    id: "sqli_timed",
    label: "SQL injection — time-based blind (SLEEP)",
    family: "sqli",
    method: "GET",
    path: "/api/search?q=1%27%20AND%20SLEEP%285%29--",
  },
  {
    id: "xss_script",
    label: "XSS — <script>alert(1)</script>",
    family: "xss",
    method: "GET",
    path: "/api/search?q=%3Cscript%3Ealert%281%29%3C%2Fscript%3E",
  },
  {
    id: "xss_onerror",
    label: "XSS — img onerror handler",
    family: "xss",
    method: "GET",
    path: "/api/search?q=%3Cimg%20src%3Dx%20onerror%3Dalert%281%29%3E",
  },
  {
    id: "path_traversal_etc_passwd",
    label: "Path traversal — /etc/passwd",
    family: "traversal",
    method: "GET",
    path: "/api/data?path=..%2F..%2F..%2Fetc%2Fpasswd",
  },
  {
    id: "cmd_injection_cat",
    label: "Command injection — ; cat /etc/passwd",
    family: "cmd",
    method: "GET",
    path: "/api/search?q=%3B%20cat%20%2Fetc%2Fpasswd",
  },
  {
    id: "cmd_injection_subshell",
    label: "Command injection — $(rm -rf)",
    family: "cmd",
    method: "GET",
    path: "/api/search?q=%24%28rm%20-rf%20%2F%29",
  },
  {
    id: "brute_force_login",
    label: "Brute-force login (bad password)",
    family: "brute",
    method: "POST",
    path: "/api/login",
    body: { username: "admin", password: "wrong-password-attempt" },
  },
  {
    id: "scanner_scrape",
    label: "Bot scrape (sqlmap user-agent)",
    family: "scanner",
    method: "GET",
    path: "/api/echo",
    headers: { "user-agent": "sqlmap/1.7.2 (https://sqlmap.org)" },
  },
];

/** Pick a uniformly random element from a non-empty array. */
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Map a slider mode to the rule-server's X-Detection-Mode header value. */
export const sliderModeToHeader = (sliderMode) => {
  if (sliderMode === "rule") return "rule";
  if (sliderMode === "ai") return "ai";
  return "hybrid";
};
