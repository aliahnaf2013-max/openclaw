export const OPENCLAW_INTERIM_STATUS_SCHEMA_VERSION = "openclaw.interim_status.v1" as const;

export type OpenClawInterimStatus = {
  schema_version: typeof OPENCLAW_INTERIM_STATUS_SCHEMA_VERSION;
  run_id: string;
  interim_status: "yielded";
};

/**
 * Builds the per-run marker only from runtime-owned yield state.
 * Assistant text never participates, and final resumed turns omit the marker.
 */
export function createOpenClawYieldedInterimStatus(runId: string): OpenClawInterimStatus {
  return {
    schema_version: OPENCLAW_INTERIM_STATUS_SCHEMA_VERSION,
    run_id: runId,
    interim_status: "yielded",
  };
}
