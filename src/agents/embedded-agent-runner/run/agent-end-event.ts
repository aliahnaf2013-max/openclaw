import type { PluginHookAgentEndEvent } from "../../../plugins/hook-types.js";
import { createOpenClawYieldedInterimStatus } from "../../interim-status.js";

export function buildEmbeddedAgentEndEvent(params: {
  runId: string;
  messages: unknown[];
  success: boolean;
  error?: string;
  durationMs: number;
  yielded: boolean;
}): PluginHookAgentEndEvent {
  return {
    runId: params.runId,
    messages: params.messages,
    success: params.success,
    ...(params.error ? { error: params.error } : {}),
    durationMs: params.durationMs,
    ...(params.yielded ? { openclaw: createOpenClawYieldedInterimStatus(params.runId) } : {}),
  };
}
