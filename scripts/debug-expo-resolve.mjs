// #region agent log
const ENDPOINT =
  "http://127.0.0.1:7700/ingest/ee08a5a6-e02d-4971-a272-a5ab7a320bbc";
const SESSION_ID = "1de49e";

function log(hypothesisId, message, data) {
  fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION_ID,
    },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      runId: "pre-fix",
      hypothesisId,
      location: "scripts/debug-expo-resolve.mjs:log",
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion agent log

log("H1", "debug script start", { cwd: process.cwd(), node: process.version });

const createdRequire = await import("node:module").then((m) => m.createRequire);
const require = createdRequire(import.meta.url);

function tryResolve(spec) {
  try {
    return { ok: true, resolved: require.resolve(spec) };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

const expoPkg = tryResolve("expo/package.json");
log("H2", "resolve expo/package.json", expoPkg);

const expoRoot = tryResolve("expo");
log("H2", "resolve expo", expoRoot);

console.log(
  JSON.stringify(
    {
      cwd: process.cwd(),
      node: process.version,
      expoPkg,
      expoRoot,
    },
    null,
    2,
  ),
);

