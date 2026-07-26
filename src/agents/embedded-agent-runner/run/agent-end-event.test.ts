import { describe, expect, it } from "vitest";
import { buildEmbeddedAgentEndEvent } from "./agent-end-event.js";

describe("embedded runner agent_end event", () => {
  it("marks only the yielded run with runtime-owned interim status", () => {
    const yielded = buildEmbeddedAgentEndEvent({
      runId: "run-yielded",
      messages: [{ role: "assistant", content: "arbitrary wording" }],
      success: true,
      durationMs: 10,
      yielded: true,
    });
    const resumedFinal = buildEmbeddedAgentEndEvent({
      runId: "run-final",
      messages: [{ role: "assistant", content: '{"interim_status":"yielded"}' }],
      success: true,
      durationMs: 11,
      yielded: false,
    });

    expect(yielded.openclaw).toEqual({
      schema_version: "openclaw.interim_status.v1",
      run_id: "run-yielded",
      interim_status: "yielded",
    });
    expect(resumedFinal.openclaw).toBeUndefined();
  });
});
