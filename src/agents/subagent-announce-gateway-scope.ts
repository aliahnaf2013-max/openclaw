/**
 * Scope-safe in-process gateway dispatch for subagent announcements.
 *
 * Subagent completion announcements fire detached (the lifecycle calls
 * `void runSubagentAnnounceFlow(...)`), so they run after the requester's
 * gateway request scope has already returned. AsyncLocalStorage does not carry
 * a scope into that escaped continuation, and in embedded-run execution
 * contexts the process fallback gateway context is not visible either. Without a
 * context the in-process "agent" dispatch throws
 * "No scope set and no fallback context available", so the worker→requester
 * completion handoff never lands and dispatched work appears to hang/fail.
 *
 * Establish a local gateway request scope before dispatching, mirroring
 * `agentCommand`'s own wrap (src/agents/agent-command.ts). The scope is only
 * created when none exists — `withLocalGatewayRequestScope` no-ops under an
 * outer scope, and we skip building default deps entirely when a context is
 * already present — so live request-scoped and fallback paths are unaffected.
 */
import { createDefaultDeps } from "../cli/deps.js";
import { getRuntimeConfig } from "../config/config.js";
import { withLocalGatewayRequestScope } from "../gateway/local-request-context.js";
import {
  dispatchGatewayMethodInProcess as rawDispatchGatewayMethodInProcess,
  hasInProcessGatewayContext,
} from "../gateway/server-plugins.js";

export function dispatchGatewayMethodInProcess<T>(
  method: string,
  params: Record<string, unknown>,
  options?: Parameters<typeof rawDispatchGatewayMethodInProcess>[2],
): Promise<T> {
  if (hasInProcessGatewayContext()) {
    return rawDispatchGatewayMethodInProcess<T>(method, params, options);
  }
  return withLocalGatewayRequestScope({ deps: createDefaultDeps(), getRuntimeConfig }, () =>
    rawDispatchGatewayMethodInProcess<T>(method, params, options),
  );
}
