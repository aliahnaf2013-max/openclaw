# Playwright & Browser Satellite — Troubleshooting & Recommendations

**Generated:** 2026-05-29  
**Author:** Perplexity AI Assistant  
**Project:** OpenClaw — `extensions/browser` plugin + Agent Hub integration

---

## Executive Summary

The Playwright browser plugin (`@openclaw/browser-plugin`) is **fully coded and installed** but is **not running**. The browser-control service (`plugin-service.ts`) has never been started in this environment, no Chromium process is active, and the plugin is not registered in the Agent Hub tool registry. Three distinct gaps must be resolved in sequence: **runtime startup → CDP connectivity → Agent Hub registration**.

---

## Current State Snapshot

| Layer                            | Status              | Evidence                                               |
| -------------------------------- | ------------------- | ------------------------------------------------------ |
| Plugin source code               | ✅ Present          | `extensions/browser/` — 25 files + 37-file `src/` tree |
| `playwright-core` installed      | ✅ v1.59.1          | `node_modules/playwright-core/package.json`            |
| `openclaw.plugin.json`           | ✅ Correct          | `enabledByDefault: true`, `onStartup: true`            |
| Plugin tool schema               | ✅ Defined          | `src/browser-tool.schema.ts`                           |
| Browser-control service          | ❌ Not started      | No process, no bound port                              |
| Chromium / headless process      | ❌ Not running      | `ps aux` — zero matches                                |
| CDP port 9222                    | ❌ Closed           | Port scan confirmed idle                               |
| Docker daemon                    | ❌ Down             | `docker ps` unavailable                                |
| Agent Hub tool registration      | ❌ Missing          | `tool_inventory` returned 0 browser tools              |
| Playwright tool callable via hub | ❌ `tool_not_found` | Direct `playwright_navigate` call failed               |

---

## Gap Analysis — Root Causes

### Gap 1 — Browser-Control Service Not Started

The plugin defines `createBrowserPluginService()` in `src/plugin-service.ts`. This service must be started by the OpenClaw host process on startup. Since OpenClaw is not running (no processes found), the service `.start(ctx)` has never been called and no control server is listening.

**Impact:** No browser tool calls can execute. Everything downstream is blocked.

### Gap 2 — No Chromium Instance Available

The plugin supports two browser modes:

- `profile="openclaw"` — OpenClaw-managed isolated Chromium (default)
- `profile="user"` — attaches to the logged-in user's running browser via CDP

Neither is currently available. No Chromium process exists, and port 9222 (CDP endpoint) is closed.

**Impact:** Even if the service starts, the first browser action will fail immediately with a "browser not found" or "CDP connection refused" error.

### Gap 3 — Agent Hub Tool Not Registered

The `registerBrowserPlugin(api)` function in `plugin-registration.ts` calls `api.registerTool()` — but this only fires when OpenClaw loads the plugin at startup. Since OpenClaw is not running, the tool was never handed to the Agent Hub router, so `tool_inventory` shows 0 results.

**Impact:** The browser tool is invisible to any AI agent or hub orchestration.

### Gap 4 — Docker Not Running (CI/Remote Risk)

The `build:docker` script and Woodpecker CI pipelines suggest the production deployment uses Docker containers. The local Docker daemon is down, meaning any containerized browser satellite is also offline.

**Impact:** If the intended deployment model is Docker-based (e.g., a separate browser satellite container), starting OpenClaw alone locally will not be enough.

### Gap 5 — `qa-lab` Extension Also Affected

`@openclaw/qa-lab` also depends on `playwright-core@1.59.1` and has its own `index.ts` entry. QA scenario runners and the private debugger UI will be non-functional for the same reason.

---

## Troubleshooting Plan — Step-by-Step

### Phase 1: Verify Environment Prerequisites

**Step 1.1 — Check Node / Bun runtime**

```bash
node --version   # Should be v20+
bun --version    # Should be 1.x+
which openclaw   # Should resolve to a CLI binary
```

**Step 1.2 — Check Chromium binary availability**

```bash
# Check if Playwright-managed Chromium is installed
cd /Users/aliahnaf/SourceControl/openclaw
npx playwright install --list
# Or check the local cache
ls ~/.cache/ms-playwright/ 2>/dev/null || ls ~/Library/Caches/ms-playwright/ 2>/dev/null
```

If empty, install browsers:

```bash
npx playwright install chromium
# Or within the openclaw workspace:
pnpm exec playwright install chromium
```

**Step 1.3 — Check Docker daemon**

```bash
docker info
# If not running on macOS:
open -a Docker
# Wait ~30s then re-check
docker ps
```

---

### Phase 2: Start the OpenClaw Server Locally

**Step 2.1 — Build the project**

```bash
cd /Users/aliahnaf/SourceControl/openclaw
pnpm build  # or: node scripts/build-all.mjs
```

**Step 2.2 — Start OpenClaw with browser plugin enabled**

```bash
# Standard dev start
pnpm dev
# Or if there is a dedicated CLI start command:
openclaw start --plugins browser
# Or node-based:
node dist/cli.js start
```

**Step 2.3 — Verify browser-control service is bound**

```bash
# After startup, check for the control port
lsof -i :9222
lsof -i :3000
lsof -i :8081
# Look for OpenClaw or Chrome processes
ps aux | grep -E '(openclaw|chromium|chrome|playwright)'
```

---

### Phase 3: Validate Browser Connectivity

**Step 3.1 — Test CDP endpoint directly**

```bash
# Chrome DevTools Protocol — JSON list of targets
curl -s http://localhost:9222/json/version | python3 -m json.tool
curl -s http://localhost:9222/json/list
```

Expected: JSON response with browser version and open tabs.

**Step 3.2 — Run the built-in browser doctor**
The plugin includes `browser-doctor.ts` and `doctor-browser.ts` — these are health-check modules:

```bash
cd /Users/aliahnaf/SourceControl/openclaw
# Via CLI (if supported)
openclaw browser doctor
# Or via the plugin's test suite
pnpm --filter @openclaw/browser-plugin test -- --reporter=verbose doctor
```

**Step 3.3 — Run plugin service tests**

```bash
cd /Users/aliahnaf/SourceControl/openclaw
pnpm --filter @openclaw/browser-plugin test
# Key test files:
# - src/plugin-service.test.ts
# - src/doctor-browser.test.ts
# - src/browser-tool.test.ts
# - src/security-audit.test.ts
```

**Step 3.4 — Take a test screenshot**

```bash
# Quick smoke test via Playwright CLI
npx playwright screenshot --browser chromium https://google.com /tmp/test-screenshot.png
open /tmp/test-screenshot.png
```

---

### Phase 4: Validate Agent Hub Registration

**Step 4.1 — Confirm tool appears in hub after OpenClaw starts**
Once OpenClaw is running and the plugin registers, re-run the inventory check via the Agent Hub MCP tools. The browser tool should appear under the `browser` domain.

**Step 4.2 — Test a live browser tool call**

```
# Via Agent Hub execute_tool:
tool: browser
args: { action: "screenshot", url: "https://www.google.com" }
```

**Step 4.3 — If still not appearing — manual registration fallback**
Use `register_tool` in the Agent Hub with:

```json
{
  "tool_name": "browser",
  "domain": "browser",
  "description": "Control headless Chromium via OpenClaw browser-control service",
  "toolkit_id": "openclaw-browser",
  "provider_ids": ["openclaw-local"]
}
```

---

### Phase 5: Docker / Remote Satellite (Production Path)

**Step 5.1 — Start Docker and rebuild the browser satellite image**

```bash
open -a Docker && sleep 30
cd /Users/aliahnaf/SourceControl/openclaw
docker build -f Dockerfile.browser -t openclaw-browser-satellite .
# or using the build:docker script:
pnpm build:docker
```

**Step 5.2 — Run the browser satellite container**

```bash
docker run -d \
  --name openclaw-browser \
  -p 9222:9222 \
  -p 8081:8081 \
  --shm-size=2gb \
  openclaw-browser-satellite
```

**Step 5.3 — Verify Woodpecker CI pipeline for browser satellite**

```bash
# Check if there's a pipeline configured for the browser extension
cat /Users/aliahnaf/SourceControl/openclaw/.woodpecker/*.yml | grep -A10 'browser'
```

---

## Full Recommendations

### R1 — Add a Browser Health Check Script (Priority: HIGH)

Create `/Users/aliahnaf/SourceControl/openclaw/scripts/check-browser-health.sh`:

```bash
#!/bin/bash
echo "Checking browser satellite health..."
pgrep -f chromium && echo "✅ Chromium running" || echo "❌ Chromium not running"
curl -sf http://localhost:9222/json/version && echo "✅ CDP endpoint up" || echo "❌ CDP endpoint down"
curl -sf http://localhost:8081/health && echo "✅ Control service up" || echo "❌ Control service down"
```

Run this before every development session to catch issues early.

### R2 — Add Browser Satellite to Woodpecker CI (Priority: HIGH)

Add a dedicated pipeline step that:

- Starts the browser satellite container
- Runs `doctor-browser.test.ts` as a smoke test
- Reports failure to Slack if CDP endpoint doesn't respond within 30s

### R3 — Add `--shm-size` to Docker Run for Chromium Stability (Priority: HIGH)

Headless Chromium in Docker frequently crashes without adequate shared memory. Always run with `--shm-size=2gb` or mount `/dev/shm` explicitly. Without this, browser tests will fail randomly under load.

### R4 — Pin `playwright-core` Version Across All Extensions (Priority: MEDIUM)

Both `@openclaw/browser-plugin` and `@openclaw/qa-lab` use `playwright-core@1.59.1`. Add a `pnpm.overrides` in the root `package.json` to enforce a single version across the monorepo:

```json
"pnpm": {
  "overrides": {
    "playwright-core": "1.59.1"
  }
}
```

### R5 — Expose Browser Doctor as a CLI Command (Priority: MEDIUM)

The `browser-doctor.ts` module exists but it's unclear if it's wired to a runnable CLI command. Wire `openclaw browser doctor` as an official subcommand that outputs structured JSON health status — making it easy to call from CI and Agent Hub diagnostics.

### R6 — Register Browser Tool in Agent Hub with Risk Tier Metadata (Priority: MEDIUM)

When registering via `register_tool`, set the risk tier explicitly:

- `action: screenshot/snapshot/navigate` → `internal_read`
- `action: click/type/fill/evaluate` → `standard_write`
- `action: evaluate` with arbitrary JS → `privileged_write`

This prevents agents from accidentally calling destructive browser actions without approval gates.

### R7 — Add Browser Satellite to `openclaw start` Startup Sequence (Priority: MEDIUM)

The `activation.onStartup: true` flag in `openclaw.plugin.json` should trigger `createBrowserPluginService().start()` automatically. Audit the main OpenClaw startup sequence to confirm this lifecycle hook is actually being called and add a log line confirming browser service startup.

### R8 — Configure `profile="user"` Fallback for Local Dev (Priority: LOW)

For local development when the managed Chromium isn't available, the plugin supports attaching to an existing user browser via CDP. Document the one-time setup:

```bash
# Launch Chrome with remote debugging enabled
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

Then set `browser.profile: user` in the local OpenClaw config to use this fallback.

### R9 — Add Uptime Monitoring for Browser Control Service (Priority: LOW)

Add the browser satellite's health endpoint to the existing Pulse monitoring stack so alerts fire automatically if the service goes down rather than discovering it reactively.

### R10 — Document the `qa-lab` Dependency on Browser Satellite (Priority: LOW)

`@openclaw/qa-lab` depends on `playwright-core` but its README doesn't note that the browser satellite must be running for scenario execution. Add a prerequisite section to prevent future confusion.

---

## Quick Fix Sequence (TL;DR)

```bash
# 1. Install Chromium if missing
npx playwright install chromium

# 2. Start OpenClaw (triggers plugin service startup)
cd /Users/aliahnaf/SourceControl/openclaw && pnpm dev

# 3. Verify CDP endpoint (in a new terminal)
curl http://localhost:9222/json/version

# 4. Run doctor tests
pnpm --filter @openclaw/browser-plugin test

# 5. Test a browser tool call via Agent Hub
# (use execute_tool: browser, action: screenshot)
```

---

_This plan was generated by Perplexity AI on 2026-05-29 based on live filesystem and process analysis of the OpenClaw workspace._
