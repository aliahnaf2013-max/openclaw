#!/usr/bin/env bash
# =============================================================================
# OpenClaw Browser Satellite — Full Validation Script
# Generated: 2026-05-29
# Run from proc-serv03 after the openclaw Multipass VM is started
# =============================================================================

set -euo pipefail

VM_HOST="openclaw.local"
GATEWAY_PORT=18789
CDP_PORT=9222
SMOKE_URL="https://google.com"
SMOKE_OUTPUT="/tmp/openclaw-smoke-test.png"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC}  $1"; }
fail() { echo -e "${RED}❌ FAIL${NC}  $1"; }
info() { echo -e "${YELLOW}ℹ️  INFO${NC}  $1"; }

echo ""
echo "================================================================"
echo "  OpenClaw Browser Satellite — Validation"
echo "  $(date)"
echo "================================================================"
echo ""

# -------------------------------------------------------------------
# STEP 1: Multipass VM status
# -------------------------------------------------------------------
echo "--- Step 1: Multipass VM Status ---"
if /usr/local/bin/multipass list 2>/dev/null | grep -q 'openclaw'; then
  STATUS=$(/usr/local/bin/multipass list 2>/dev/null | grep openclaw | awk '{print $2}')
  if [ "$STATUS" = "Running" ]; then
    pass "Multipass VM 'openclaw' is Running"
  else
    fail "Multipass VM 'openclaw' status: $STATUS — starting now..."
    /usr/local/bin/multipass start openclaw
    sleep 8
    pass "Multipass VM 'openclaw' started"
  fi
else
  fail "Multipass VM 'openclaw' not found in list"
  exit 1
fi

# -------------------------------------------------------------------
# STEP 2: DNS / mDNS resolution
# -------------------------------------------------------------------
echo ""
echo "--- Step 2: DNS Resolution ---"
if ping -c 1 -W 3 "$VM_HOST" > /dev/null 2>&1; then
  VM_IP=$(ping -c 1 "$VM_HOST" 2>/dev/null | grep 'PING' | awk -F'[()]' '{print $2}')
  pass "$VM_HOST resolves → $VM_IP"
else
  fail "$VM_HOST not resolving — trying to get IP from multipass"
  VM_IP=$(/usr/local/bin/multipass info openclaw 2>/dev/null | grep IPv4 | awk '{print $2}')
  if [ -n "$VM_IP" ]; then
    info "VM IP from multipass: $VM_IP — add to /etc/hosts:"
    echo "  sudo sh -c 'echo \"$VM_IP  openclaw.local\" >> /etc/hosts'"
  else
    fail "Could not determine VM IP"
    exit 1
  fi
fi

# -------------------------------------------------------------------
# STEP 3: OpenClaw Gateway WebSocket port
# -------------------------------------------------------------------
echo ""
echo "--- Step 3: OpenClaw Gateway (port $GATEWAY_PORT) ---"
if nc -z -w 3 "$VM_HOST" "$GATEWAY_PORT" 2>/dev/null; then
  pass "Gateway port $GATEWAY_PORT is open on $VM_HOST"
else
  fail "Gateway port $GATEWAY_PORT is NOT open — OpenClaw may not be running inside the VM"
  info "SSH in and start: multipass shell openclaw && cd ~/openclaw && pnpm start"
fi

# -------------------------------------------------------------------
# STEP 4: Chrome DevTools Protocol endpoint
# -------------------------------------------------------------------
echo ""
echo "--- Step 4: CDP Endpoint (port $CDP_PORT) ---"
CDP_RESPONSE=$(curl -s --connect-timeout 5 "http://${VM_HOST}:${CDP_PORT}/json/version" 2>/dev/null)
if echo "$CDP_RESPONSE" | grep -q 'Browser'; then
  BROWSER_VERSION=$(echo "$CDP_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Browser','unknown'))" 2>/dev/null)
  pass "CDP endpoint live — Browser: $BROWSER_VERSION"
else
  fail "CDP endpoint not responding on port $CDP_PORT"
  info "Chromium headless may not be running inside the VM"
fi

# -------------------------------------------------------------------
# STEP 5: Playwright smoke test
# -------------------------------------------------------------------
echo ""
echo "--- Step 5: Playwright Smoke Test ---"
if command -v npx > /dev/null 2>&1; then
  if npx playwright screenshot --browser chromium "$SMOKE_URL" "$SMOKE_OUTPUT" > /tmp/pw-smoke.log 2>&1; then
    pass "Playwright screenshot captured → $SMOKE_OUTPUT"
  else
    fail "Playwright screenshot failed — check /tmp/pw-smoke.log"
    cat /tmp/pw-smoke.log | tail -10
  fi
else
  info "npx not available — skipping Playwright smoke test"
fi

# -------------------------------------------------------------------
# STEP 6: Agent Hub tool registration check
# -------------------------------------------------------------------
echo ""
echo "--- Step 6: Agent Hub Tool Availability ---"
OCLAW_TOOLS=$(curl -s --connect-timeout 5 \
  "http://${VM_HOST}:${GATEWAY_PORT}/api/tools" \
  -H 'Content-Type: application/json' 2>/dev/null)
if echo "$OCLAW_TOOLS" | grep -qi 'browser'; then
  pass "'browser' tool found in Agent Hub registry"
else
  info "Could not verify Agent Hub tool list (may require auth token)"
fi

# -------------------------------------------------------------------
# SUMMARY
# -------------------------------------------------------------------
echo ""
echo "================================================================"
echo "  Validation complete — $(date)"
echo "================================================================"
echo ""
