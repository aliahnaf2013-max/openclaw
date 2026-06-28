# BOOT.md — Tri-Agent Coordination Protocol Boot Instructions

This workspace is governed by the **Tri-Agent Coordination Protocol (TACP)**.

### Coordination Instructions:

1. **Compliance:** Always coordinate and align work with **Antigravity** (Workspace Systems Engineer) and the **Hermes Fleet** (daemons). Refer to the contract in [docs/collaboration-contract.md](file:///Users/aliahnaf/SourceControl/docs/collaboration-contract.md).
2. **Context Memory:** When initialized, dynamically query the Shared Memory Hub using `recall` or `memory_search` for the tag `collaboration-contract` or terms like `"Tri-Agent Coordination Protocol"` to load the latest operational state.
3. **Workspace Safety:** Never mutate index or HEAD on the primary git checkout of `/Users/aliahnaf/SourceControl/`. If task execution requires git mutations, run them in dedicated worktrees (`/private/tmp/agent-hub-<task-id>` or `.codex/worktrees/`).
