import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/sandbox/manager", () => ({
  createAttackerSandbox: vi.fn(),
}));

vi.mock("@/lib/ai/gateway", () => ({
  getModel: vi.fn().mockReturnValue("mock-model"),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn().mockResolvedValue({}),
    stepCountIs: vi.fn().mockReturnValue({ type: "step-count", stepCount: 30 }),
  };
});

vi.mock("@/lib/ai/tools/sandbox-tools", () => ({
  createSandboxTools: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/ai/tools/http-tools", () => ({
  createHttpTools: vi.fn().mockReturnValue({
    httpRequest: {
      execute: vi.fn().mockResolvedValue({ status: 200 }),
    },
  }),
}));

vi.mock("@/lib/ai/tools/flag-tools", () => ({
  createFlagTools: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/flags/validator", () => ({
  validateFlag: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("@/lib/events/emitter", () => ({
  emitMatchEvent: vi.fn().mockResolvedValue(undefined),
}));

import { attackApp } from "@/lib/sandbox/attacker";
import { createAttackerSandbox } from "@/lib/sandbox/manager";
import { generateText, stepCountIs } from "ai";

describe("attackApp stopWhen", () => {
  const mockSandbox = {
    stop: vi.fn(),
    domain: vi.fn().mockReturnValue("test.sandbox.dev"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAttackerSandbox).mockResolvedValue({
      sandbox: mockSandbox as never,
      sandboxId: "sbx-atk-123",
    });
  });

  it("passes stopWhen: stepCountIs(30) to generateText", async () => {
    await attackApp(
      "match-1",
      "attacker-1",
      "test/model",
      { playerId: "defender-1", modelId: "test/model2", appUrl: "https://test.sandbox.dev" },
      {
        appSpec: "test app",
        vulnerabilityCount: 1,
        models: ["test/model", "test/model2"],
        buildTimeLimitSeconds: 60,
        attackTimeLimitSeconds: 60,
      }
    );

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        stopWhen: stepCountIs(30),
      })
    );
  });

  it("returns success with zero captures when no flags found", async () => {
    const result = await attackApp(
      "match-1",
      "attacker-1",
      "test/model",
      { playerId: "defender-1", modelId: "test/model2", appUrl: "https://test.sandbox.dev" },
      {
        appSpec: "test app",
        vulnerabilityCount: 1,
        models: ["test/model", "test/model2"],
        buildTimeLimitSeconds: 60,
        attackTimeLimitSeconds: 60,
      }
    );

    expect(result.success).toBe(true);
    expect(result.flagsCaptured).toBe(0);
  });
});
