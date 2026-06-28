/**
 * Subagent announcements dispatch in-process from a detached continuation with
 * no gateway request scope. The scope-safe wrapper must establish a local scope
 * so the dispatch resolves instead of throwing
 * "No scope set and no fallback context available".
 */
import { describe, expect, it } from "vitest";
import {
  clearFallbackGatewayContext,
  dispatchGatewayMethodInProcessRaw,
} from "../gateway/server-plugins.js";
import { dispatchGatewayMethodInProcess } from "./subagent-announce-gateway-scope.js";

describe("subagent announce gateway scope", () => {
  it("raw in-process dispatch throws without a scope or fallback context", async () => {
    clearFallbackGatewayContext();
    await expect(
      dispatchGatewayMethodInProcessRaw("agent.identity.get", { agentId: "main" }),
    ).rejects.toThrow(/No scope set and no fallback context available/);
  });

  it("scope-safe dispatch establishes a local scope and resolves", async () => {
    clearFallbackGatewayContext();
    const response = await dispatchGatewayMethodInProcess<{ agentId?: string }>(
      "agent.identity.get",
      { agentId: "main" },
    );
    expect(response).toMatchObject({ agentId: "main" });
  });
});
