# Playwright Browser Satellite — Parallel Team Execution Plan

**Generated:** 2026-05-29  
**Owner:** Ahnaf Ali, SVP & CIO  
**Project:** OpenClaw — Playwright + Browser Satellite Full Remediation  
**Execution Mode:** 4 Parallel Teams → Single Integration Gate

---

## Strategic Overview

This plan assigns all remediation and validation work across **4 parallel teams** that run simultaneously, converging at a single integration gate before final sign-off. Each team has a defined persona, toolset, skill set, and process. Total estimated wall-clock time: **90–120 minutes** when executed in parallel vs. 4–5 hours sequentially.

```
KICKOFF (T+0)
    │
    ├── Team Alpha  ──────────────── Environment & Runtime Setup
    ├── Team Beta   ──────────────── Code Validation & Testing
    ├── Team Gamma  ──────────────── Agent Hub Registration & Integration
    └── Team Delta  ──────────────── CI/CD, Docker & Monitoring
         │                                    │
         └────────── INTEGRATION GATE (T+90) ─┘
                              │
                       SIGN-OFF & GO-LIVE
```

---

## Team Alpha — Environment & Runtime

**Persona:** DevOps / Infrastructure Engineer  
**Mission:** Get the OpenClaw server running with the browser plugin active and Chromium accessible  
**Blocking:** All other teams need Alpha to complete Chromium startup before full E2E testing

### Skills Required

- macOS process management and port inspection
- Node.js / Bun runtime configuration
- Playwright browser binary management
- Chrome DevTools Protocol (CDP)
- Environment variable and config file management

### Tools

| Tool               | Purpose                                                   |
| ------------------ | --------------------------------------------------------- |
| `bash_execute`     | Run startup commands, check ports, inspect processes      |
| `read_file`        | Inspect config files, `.env`, `pnpm-workspace.yaml`       |
| `edit_file`        | Fix config values if browser is disabled or misconfigured |
| `find_files`       | Locate `.env`, `openclaw.config.*`, browser config files  |
| `spotlight_search` | Fast workspace-wide search for config and lock files      |

### Process

**Step A1 — Verify runtime prerequisites (T+0, ~10 min)**

```bash
node --version                            # Must be v20+
bun --version                             # Must be 1.x+
which openclaw || npx openclaw --version  # Confirm CLI reachable
npx playwright install --list             # Check Chromium binary status
ls ~/Library/Caches/ms-playwright/        # Confirm local cache
```

**Step A2 — Install Chromium if missing (T+10, ~5 min)**

```bash
cd /Users/aliahnaf/SourceControl/openclaw
pnpm exec playwright install chromium
# Verify:
npx playwright --version
```

**Step A3 — Check and fix browser config (T+10, ~5 min)**

```bash
# Look for any config that disables browser
find /Users/aliahnaf/SourceControl/openclaw -maxdepth 3 \
  -name '*.config.*' -o -name '.env' -o -name '*.env.*' \
  | xargs grep -l 'browser' 2>/dev/null
# Ensure browser.enabled is not false
```

**Step A4 — Build OpenClaw (T+15, ~15 min)**

```bash
cd /Users/aliahnaf/SourceControl/openclaw
pnpm build
# Monitor for build errors in browser-plugin specifically:
pnpm --filter @openclaw/browser-plugin build
```

**Step A5 — Start OpenClaw dev server (T+30, ~5 min)**

```bash
cd /Users/aliahnaf/SourceControl/openclaw
pnpm dev
# In a second terminal, tail logs:
tail -f ~/.openclaw/logs/openclaw.log 2>/dev/null || \
  tail -f /tmp/openclaw-*.log 2>/dev/null
```

**Step A6 — Validate CDP endpoint (T+35, ~5 min)**

```bash
# Confirm Chromium is running and CDP is bound
curl -s http://localhost:9222/json/version | python3 -m json.tool
curl -s http://localhost:9222/json/list
# Check process
ps aux | grep -E '(chromium|chrome|openclaw)' | grep -v grep
lsof -i :9222
```

### Alpha Deliverable

- ✅ OpenClaw running with confirmed output: `Browser plugin started`
- ✅ `curl http://localhost:9222/json/version` returns browser JSON
- ✅ Screenshot can be taken: `npx playwright screenshot --browser chromium https://google.com /tmp/alpha-smoke.png`
- 📄 Post results to `#browser-satellite` Slack channel

---

## Team Beta — Code Validation & Testing

**Persona:** QA Engineer / Staff Engineer  
**Mission:** Run all existing tests, validate the browser tool schema, doctor checks, and security audit — identify any code-level bugs before integration  
**Can start immediately; full E2E tests require Alpha to finish Step A6**

### Skills Required

- TypeScript / Node.js testing with Vitest
- Playwright browser automation testing
- JSON Schema validation
- Security audit pattern review
- Test report analysis and defect logging

### Tools

| Tool           | Purpose                                                          |
| -------------- | ---------------------------------------------------------------- |
| `bash_execute` | Run test suites                                                  |
| `read_file`    | Inspect failing test files                                       |
| `edit_file`    | Fix broken imports, config mismatches                            |
| `grep_files`   | Search for `TODO`, `FIXME`, `disabled`, `skip` across test files |
| `find_files`   | Locate all `*.test.ts` files in browser extension                |

### Process

**Step B1 — Audit all test files (T+0, ~10 min)**

```bash
# Find all test files in browser extension
find /Users/aliahnaf/SourceControl/openclaw/extensions/browser \
  -name '*.test.ts' | sort

# Check for skipped/disabled tests
grep -rn 'skip\|only\|todo\|xtest\|xit' \
  /Users/aliahnaf/SourceControl/openclaw/extensions/browser/src/*.test.ts 2>/dev/null
```

**Step B2 — Run unit tests (no browser required) (T+10, ~15 min)**

```bash
cd /Users/aliahnaf/SourceControl/openclaw
# Run browser plugin unit tests
pnpm --filter @openclaw/browser-plugin test -- --reporter=verbose
# Target specific files:
pnpm --filter @openclaw/browser-plugin test -- src/security-audit.test.ts
pnpm --filter @openclaw/browser-plugin test -- src/plugin-service.test.ts
```

**Step B3 — Run doctor tests (T+15, ~10 min)**

```bash
pnpm --filter @openclaw/browser-plugin test -- src/doctor-browser.test.ts --reporter=verbose
```

**Step B4 — Run browser tool schema validation (T+15, ~5 min)**

```bash
# Validate the tool schema compiles and exports correctly
cd /Users/aliahnaf/SourceControl/openclaw
node -e "
  import('./extensions/browser/src/browser-tool.schema.js')
    .then(m => { console.log('Schema OK:', Object.keys(m)); })
    .catch(e => { console.error('Schema FAIL:', e.message); })
"
```

**Step B5 — Run full E2E browser tests (requires Alpha A6 complete) (T+40, ~20 min)**

```bash
cd /Users/aliahnaf/SourceControl/openclaw
pnpm --filter @openclaw/browser-plugin test -- src/browser-tool.test.ts --reporter=verbose
# Also run the UI screenshot tests:
pnpm --filter openclaw-ui test -- --browser chromium \
  src/ui/__screenshots__/navigation.browser.test.ts
pnpm --filter openclaw-ui test -- --browser chromium \
  src/ui/__screenshots__/config-form.browser.test.ts
```

**Step B6 — Run qa-lab tests (T+50, ~15 min)**

```bash
pnpm --filter @openclaw/qa-lab test -- --reporter=verbose
```

**Step B7 — Security audit check (T+60, ~10 min)**

```bash
cd /Users/aliahnaf/SourceControl/openclaw
pnpm --filter @openclaw/browser-plugin test -- src/security-audit.test.ts
# Also run the index test:
pnpm --filter @openclaw/browser-plugin test -- index.test.ts
```

### Beta Deliverable

- ✅ All unit tests passing (0 failures)
- ✅ Doctor tests clean
- ✅ Schema exports valid
- ✅ E2E browser tests passing (after Alpha is up)
- ✅ Security audit findings reviewed
- 📄 Test report saved to `/tmp/browser-test-report.txt`
- 📄 Any failures logged as GitHub issues or Notion tasks

---

## Team Gamma — Agent Hub Registration & Integration

**Persona:** Platform Engineer / AI Integration Specialist  
**Mission:** Register the browser tool in the Agent Hub, validate it's callable by agents, configure risk tiers, and test end-to-end from hub to browser  
**Starts immediately; live tool call tests require Alpha A6 complete**

### Skills Required

- Agent Hub tool registration and metadata
- MCP (Model Context Protocol) tool definitions
- Risk tier policy configuration
- AI agent tool call validation
- JSON Schema and TypeBox schema authoring

### Tools

| Tool                                      | Purpose                                    |
| ----------------------------------------- | ------------------------------------------ |
| `mcp_tool_pluse_agent_hub_execute_tool`   | Execute browser tool via hub               |
| `mcp_tool_pluse_agent_hub_tool_inventory` | Validate tool appears post-registration    |
| `mcp_tool_pluse_agent_hub_discover_tools` | Confirm browser domain populated           |
| `mcp_tool_pluse_agent_hub_register_tool`  | Register browser tool with metadata        |
| `mcp_tool_pluse_agent_hub_bust_cache`     | Clear stale hub cache after registration   |
| `mcp_tool_pluse_agent_hub_stats`          | Run diagnostics post-registration          |
| `mcp_tool_pluse_agent_hub_memory_add`     | Store registration facts for agent context |

### Process

**Step G1 — Confirm current hub state (T+0, ~5 min)**

```
tool_inventory(provider="browser", status="available")
discover_tools(domain="browser")
# Expected: 0 results (confirms baseline is empty)
```

**Step G2 — Identify toolkit_id and provider_ids (T+5, ~10 min)**

```bash
# Find the openclaw plugin registration endpoint or toolkit config
grep -r 'toolkit_id\|provider_id\|hub.*register' \
  /Users/aliahnaf/SourceControl/openclaw/extensions/browser/src/ 2>/dev/null
grep -r 'toolkit_id\|provider_id' \
  /Users/aliahnaf/SourceControl/openclaw/packages/ 2>/dev/null | head -20
```

**Step G3 — Register browser tool with full metadata (T+15, ~10 min)**

```
register_tool({
  tool_name: "browser",
  domain: "browser",
  description: "Control headless Chromium via OpenClaw browser-control service.
    Supports: status, start, stop, snapshot, screenshot, navigate, open, focus,
    close, tabs, profiles, act (click/type/fill/hover/drag/evaluate), console, pdf, upload, dialog.",
  toolkit_id: "openclaw-browser",
  provider_ids: ["openclaw-local"],
  runtime: "worker"
})
```

**Step G4 — Bust cache and re-validate (T+25, ~5 min)**

```
bust_cache(type="tool", key="browser/browser")
tool_inventory(provider="browser", status="available")
# Expected: browser tool appears with correct metadata
```

**Step G5 — Smoke test via hub — read-only calls (T+30, ~10 min)**

```
# Test 1: Status check (safe, no browser needed)
execute_tool(tool="browser", args={ action: "status" })

# Test 2: Doctor check
execute_tool(tool="browser", args={ action: "doctor" })

# Test 3: Profiles list
execute_tool(tool="browser", args={ action: "profiles" })
```

**Step G6 — Full E2E browser tool calls (requires Alpha A6 complete) (T+45, ~15 min)**

```
# Test 4: Navigate and screenshot
execute_tool(tool="browser", args={
  action: "screenshot",
  url: "https://www.google.com",
  profile: "openclaw"
})

# Test 5: Snapshot (accessibility tree)
execute_tool(tool="browser", args={
  action: "snapshot",
  url: "https://www.google.com",
  format: "aria"
})

# Test 6: Navigate action
execute_tool(tool="browser", args={
  action: "navigate",
  url: "https://pulse.ai"
})
```

**Step G7 — Document risk tier configuration (T+60, ~10 min)**
Create `extensions/browser/HUB_REGISTRATION.md` with:

- Tool metadata spec
- Risk tier matrix per action type
- Agent permission policy recommendations
- Re-registration runbook for future deployments

**Step G8 — Store registration facts in Agent Hub memory (T+70, ~5 min)**

```
memory_add({
  content: "Browser tool registered in Agent Hub on 2026-05-29.
    Toolkit: openclaw-browser. Provider: openclaw-local.
    CDP endpoint: localhost:9222.
    Risk tiers: status/snapshot/screenshot=internal_read,
    navigate/open/click/fill=standard_write, evaluate=privileged_write.",
  category: "reference",
  tags: "browser,playwright,agent-hub,openclaw",
  write_intent: "operational_fact"
})
```

### Gamma Deliverable

- ✅ `tool_inventory` shows browser tool with correct metadata
- ✅ `execute_tool(browser, {action:"status"})` returns valid JSON response
- ✅ Screenshot E2E test completes and returns image
- ✅ Risk tier matrix documented
- ✅ Registration facts stored in hub memory
- 📄 `HUB_REGISTRATION.md` written to `extensions/browser/`

---

## Team Delta — CI/CD, Docker & Monitoring

**Persona:** Platform Reliability Engineer  
**Mission:** Fix the Docker daemon, add browser satellite health checks to Woodpecker CI, wire monitoring, and ensure the full stack is reproducible in production  
**Can run fully in parallel — no dependency on Alpha, Beta, or Gamma**

### Skills Required

- Docker container orchestration
- Woodpecker CI pipeline YAML authoring
- Shell scripting for health checks
- Cloudflare Workers deployment (for edge-hosted satellite)
- Monitoring / alerting configuration

### Tools

| Tool                                          | Purpose                                |
| --------------------------------------------- | -------------------------------------- |
| `bash_execute`                                | Docker commands, health check scripts  |
| `write_file`                                  | Write health check scripts, CI configs |
| `edit_file`                                   | Update Woodpecker pipeline YAMLs       |
| `read_file`                                   | Inspect existing Dockerfile            |
| `mcp_tool_pluse_agent_hub_woodpecker_api`     | Trigger and monitor pipelines          |
| `mcp_tool_pluse_agent_hub_cloudflare_api`     | Check Cloudflare Workers deployment    |
| `mcp_tool_pluse_agent_hub_slack_post_message` | Post status to Slack                   |

### Process

**Step D1 — Fix Docker daemon (T+0, ~10 min)**

```bash
# Start Docker Desktop on macOS
open -a Docker
sleep 30
docker info
docker ps
```

If Docker Desktop isn't installed:

```bash
brew install --cask docker
open -a Docker
```

**Step D2 — Inspect and validate Dockerfile (T+10, ~10 min)**

```bash
cat /Users/aliahnaf/SourceControl/openclaw/Dockerfile
# Check for:
# - Chromium/Playwright installation steps
# - --shm-size recommendations
# - PLAYWRIGHT_BROWSERS_PATH env var
# - Non-root user for security
```

**Step D3 — Add --shm-size and browser env to Dockerfile if missing (T+15, ~10 min)**
Ensure the following are present in the Docker build:

```dockerfile
# Playwright browser path
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0

# Install Chromium dependencies
RUN npx playwright install chromium --with-deps

# Run as non-root
RUN adduser --disabled-password --gecos '' appuser
USER appuser
```

And in `docker run` commands add `--shm-size=2gb`.

**Step D4 — Build and test Docker image (T+25, ~20 min)**

```bash
cd /Users/aliahnaf/SourceControl/openclaw
docker build -t openclaw-browser-satellite:latest .
# Run container with browser satellite
docker run -d \
  --name openclaw-browser \
  -p 9222:9222 \
  -p 8081:8081 \
  --shm-size=2gb \
  -e BROWSER_ENABLED=true \
  openclaw-browser-satellite:latest
# Verify:
curl -s http://localhost:9222/json/version
```

**Step D5 — Write browser health check script (T+10, ~10 min)**
Create `/Users/aliahnaf/SourceControl/openclaw/scripts/check-browser-health.sh`:

```bash
#!/bin/bash
set -e
PASS=0; FAIL=0

check() {
  if eval "$2" > /dev/null 2>&1; then
    echo "✅ $1"; ((PASS++))
  else
    echo "❌ $1"; ((FAIL++))
  fi
}

echo "=== Browser Satellite Health Check ==="
echo "Time: $(date)"
echo ""

check "Chromium process running" "pgrep -f chromium"
check "CDP port 9222 listening" "lsof -i :9222 | grep LISTEN"
check "CDP /json/version responds" "curl -sf http://localhost:9222/json/version"
check "Browser control port listening" "lsof -i :8081 | grep LISTEN"
check "OpenClaw process running" "pgrep -f openclaw"

# Docker check
if docker info > /dev/null 2>&1; then
  check "Browser satellite container running" "docker ps | grep openclaw-browser"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && echo "🟢 ALL SYSTEMS GO" && exit 0 || echo "🔴 ISSUES DETECTED" && exit 1
```

```bash
chmod +x /Users/aliahnaf/SourceControl/openclaw/scripts/check-browser-health.sh
```

**Step D6 — Add Woodpecker CI pipeline for browser health (T+20, ~15 min)**
Create `/Users/aliahnaf/SourceControl/openclaw/.woodpecker/browser-satellite.yml`:

```yaml
when:
  event: [push, manual]
  branch: [main, develop]

steps:
  - name: browser-health-check
    image: node:20-slim
    commands:
      - npm install -g playwright
      - npx playwright install chromium --with-deps
      - npx playwright --version
      - echo "✅ Chromium binary available"

  - name: browser-plugin-unit-tests
    image: node:20-slim
    commands:
      - cd extensions/browser
      - pnpm install --frozen-lockfile
      - pnpm test -- --reporter=verbose src/security-audit.test.ts
      - pnpm test -- --reporter=verbose src/plugin-service.test.ts
      - echo "✅ Unit tests passed"

  - name: browser-doctor-test
    image: node:20-slim
    commands:
      - cd extensions/browser
      - pnpm test -- --reporter=verbose src/doctor-browser.test.ts
      - echo "✅ Doctor check passed"

  - name: notify-slack-on-failure
    image: curlimages/curl
    when:
      status: [failure]
    commands:
      - |
        curl -X POST $SLACK_WEBHOOK_URL \
          -H 'Content-type: application/json' \
          -d '{"text":"🔴 Browser satellite CI failed on '$CI_COMMIT_BRANCH' — check Woodpecker logs"}'
```

**Step D7 — Add npm script alias (T+35, ~5 min)**
Add to root `package.json` scripts:

```json
"browser:health": "bash scripts/check-browser-health.sh",
"browser:start": "openclaw browser start",
"browser:doctor": "openclaw browser doctor"
```

**Step D8 — Verify Cloudflare Worker / Edge deployment (T+40, ~15 min)**

```bash
# Check if browser satellite has a Cloudflare deployment
find /Users/aliahnaf/SourceControl/openclaw -name 'wrangler.toml' | \
  xargs grep -l 'browser' 2>/dev/null

# If found, verify deployment status via Cloudflare API
# cf_workers_list to see if openclaw-browser worker is deployed
```

### Delta Deliverable

- ✅ Docker daemon running and `docker ps` clean
- ✅ `openclaw-browser-satellite` Docker image builds successfully
- ✅ Container runs with CDP accessible on port 9222
- ✅ `check-browser-health.sh` script written and executable
- ✅ Woodpecker CI pipeline YAML created for browser satellite
- ✅ `npm run browser:health` script works
- 📄 Docker run command documented in `DEPLOYMENT.md`

---

## Integration Gate — T+90 min

All 4 teams report status. The following criteria must ALL be green before sign-off:

### Go/No-Go Checklist

```
ALPHA:
[ ] OpenClaw process running
[ ] Chromium process running
[ ] curl http://localhost:9222/json/version returns JSON
[ ] Screenshot smoke test produces valid PNG

BETA:
[ ] pnpm test for @openclaw/browser-plugin: 0 failures
[ ] doctor-browser.test.ts: all passing
[ ] security-audit.test.ts: no critical findings
[ ] UI screenshot tests: matching snapshots

GAMMA:
[ ] tool_inventory shows browser tool
[ ] execute_tool(browser, status) returns valid response
[ ] execute_tool(browser, screenshot) returns image
[ ] HUB_REGISTRATION.md written
[ ] Risk tiers configured

DELTA:
[ ] Docker daemon running
[ ] openclaw-browser-satellite image builds
[ ] check-browser-health.sh passes all checks
[ ] Woodpecker browser-satellite.yml committed
[ ] npm run browser:health passes
```

### If Any Gate Fails

| Failure                          | Escalation Path                                                    |
| -------------------------------- | ------------------------------------------------------------------ |
| Alpha: Chromium won't start      | Team Beta + Delta join Alpha; check Dockerfile for browser install |
| Beta: Test failures              | Team Beta raises issue; Team Alpha checks if CDP is up             |
| Gamma: Tool not appearing in hub | Team Gamma + Alpha verify OpenClaw startup logs together           |
| Delta: Docker build fails        | Check Dockerfile for missing `playwright install` step             |

---

## Communication Protocol

| Event                 | Channel                    | Owner          |
| --------------------- | -------------------------- | -------------- |
| Kickoff               | `#browser-satellite` Slack | All Team Leads |
| Alpha CDP up          | `#browser-satellite` Slack | Team Alpha     |
| Beta tests passing    | `#browser-satellite` Slack | Team Beta      |
| Gamma tool registered | `#browser-satellite` Slack | Team Gamma     |
| Delta Docker up       | `#browser-satellite` Slack | Team Delta     |
| Integration gate      | Video call / Slack thread  | All            |
| Sign-off              | Notion task update + Slack | Ahnaf          |

---

## Personas Reference Card

| Team      | Persona                   | Mindset                        | Primary Risk                                    |
| --------- | ------------------------- | ------------------------------ | ----------------------------------------------- |
| **Alpha** | DevOps / Infra Engineer   | "Nothing works until it runs"  | Config errors, missing binaries                 |
| **Beta**  | QA / Staff Engineer       | "Code isn't done until tested" | Silent test skips, outdated snapshots           |
| **Gamma** | Platform / AI Integration | "Tools must be discoverable"   | Hub cache, missing toolkit_id                   |
| **Delta** | Platform Reliability      | "It must be reproducible"      | Docker shm, missing Playwright install in image |

---

## Risk Register

| Risk                       | Probability          | Impact   | Mitigation                                                                    |
| -------------------------- | -------------------- | -------- | ----------------------------------------------------------------------------- |
| Chromium binary missing    | High                 | Critical | `npx playwright install chromium` in Step A2                                  |
| OpenClaw fails to start    | Medium               | Critical | Check `pnpm build` output; inspect `extensions/browser/src/plugin-service.ts` |
| Docker shm crash           | High (in containers) | High     | Always `--shm-size=2gb`                                                       |
| Agent Hub cache stale      | Medium               | Medium   | `bust_cache` after every registration                                         |
| Test snapshots outdated    | Low                  | Medium   | `--update-snapshots` flag if UI changed                                       |
| CDP port conflict          | Low                  | High     | `lsof -i :9222` before start; kill conflicting process                        |
| `evaluate` action security | Medium               | High     | Restrict to `privileged_write` tier with approval gate                        |

---

## Quick Reference: All Commands in Order

```bash
# === ALPHA ===
npx playwright install chromium
cd /Users/aliahnaf/SourceControl/openclaw && pnpm build && pnpm dev
curl -s http://localhost:9222/json/version
npx playwright screenshot --browser chromium https://google.com /tmp/alpha-smoke.png

# === BETA ===
pnpm --filter @openclaw/browser-plugin test -- --reporter=verbose
pnpm --filter @openclaw/browser-plugin test -- src/doctor-browser.test.ts
pnpm --filter @openclaw/browser-plugin test -- src/security-audit.test.ts

# === GAMMA (via Agent Hub MCP tools) ===
# tool_inventory(provider="browser")
# register_tool({ tool_name: "browser", ... })
# bust_cache(type="tool", key="browser/browser")
# execute_tool(tool="browser", args={ action: "status" })
# execute_tool(tool="browser", args={ action: "screenshot", url: "https://google.com" })

# === DELTA ===
open -a Docker && sleep 30 && docker info
docker build -t openclaw-browser-satellite:latest .
docker run -d --name openclaw-browser -p 9222:9222 --shm-size=2gb openclaw-browser-satellite:latest
bash /Users/aliahnaf/SourceControl/openclaw/scripts/check-browser-health.sh
```

---

_Generated by Perplexity AI | 2026-05-29 | OpenClaw Browser Satellite Remediation_
