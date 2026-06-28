#!/usr/bin/env bash
# =============================================================================
# Install OpenClaw VM LaunchAgent + /etc/hosts entry
# Run once on proc-serv03 to make OpenClaw survive reboots
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ ${NC} $1"; }
fail() { echo -e "${RED}❌ ${NC} $1"; }
info() { echo -e "${YELLOW}ℹ️  ${NC} $1"; }

PLIST_SRC="$(dirname "$0")/openclaw-vm-autostart.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.openclaw.vm.plist"

echo ""
echo "================================================================"
echo "  OpenClaw VM Autostart Installer"
echo "  $(date)"
echo "================================================================"
echo ""

# -------------------------------------------------------------------
# 1. Copy plist to LaunchAgents
# -------------------------------------------------------------------
if [ ! -f "$PLIST_SRC" ]; then
  fail "Plist source not found at $PLIST_SRC"
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SRC" "$PLIST_DEST"
pass "LaunchAgent plist installed → $PLIST_DEST"

# -------------------------------------------------------------------
# 2. Load the LaunchAgent now
# -------------------------------------------------------------------
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"
pass "LaunchAgent loaded (will also run on next login)"

# -------------------------------------------------------------------
# 3. Start the VM immediately if not running
# -------------------------------------------------------------------
info "Checking Multipass VM status..."
VM_STATUS=$(/usr/local/bin/multipass list 2>/dev/null | grep openclaw | awk '{print $2}' || echo "unknown")

if [ "$VM_STATUS" = "Running" ]; then
  pass "VM 'openclaw' already Running"
else
  info "VM status: $VM_STATUS — starting now..."
  /usr/local/bin/multipass start openclaw
  sleep 8
  pass "VM 'openclaw' started"
fi

# -------------------------------------------------------------------
# 4. Pin openclaw.local in /etc/hosts (if not already there)
# -------------------------------------------------------------------
if grep -q 'openclaw.local' /etc/hosts 2>/dev/null; then
  pass "/etc/hosts already contains openclaw.local"
else
  info "Getting VM IP from multipass..."
  VM_IP=$(/usr/local/bin/multipass info openclaw 2>/dev/null | grep IPv4 | awk '{print $2}')
  if [ -n "$VM_IP" ]; then
    echo "$VM_IP  openclaw.local" | sudo tee -a /etc/hosts > /dev/null
    pass "Added '$VM_IP  openclaw.local' to /etc/hosts"
  else
    fail "Could not get VM IP — add manually: sudo sh -c 'echo \"<VM_IP>  openclaw.local\" >> /etc/hosts'"
  fi
fi

# -------------------------------------------------------------------
# 5. Verify gateway reachability
# -------------------------------------------------------------------
echo ""
info "Waiting 5s for OpenClaw gateway to bind..."
sleep 5

if nc -z -w 5 openclaw.local 18789 2>/dev/null; then
  pass "OpenClaw gateway reachable at openclaw.local:18789 ✓"
else
  info "Gateway not yet up — OpenClaw may still be starting inside the VM"
  info "SSH in to check: multipass shell openclaw"
  info "Then run: cd ~/openclaw && pnpm start"
fi

echo ""
echo "================================================================"
echo "  Install complete — $(date)"
echo "  Run validate-browser-satellite.sh to do a full health check"
echo "================================================================"
echo ""
