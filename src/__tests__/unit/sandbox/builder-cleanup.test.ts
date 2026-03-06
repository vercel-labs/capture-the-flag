import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies
vi.mock("@/lib/sandbox/manager", () => ({
  createBuilderSandbox: vi.fn(),
  lockSandboxNetwork: vi.fn(),
}));

vi.mock("@/lib/ai/gateway", () => ({
  getModel: vi.fn().mockReturnValue("mock-model"),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn(),
    stepCountIs: vi.fn().mockReturnValue({ type: "step-count", stepCount: 20 }),
  };
});

vi.mock("@/lib/flags/generator", () => ({
  generateFlagTokens: vi.fn().mockReturnValue([
    { token: "CTF{test_01_0000000000000001}", vulnerabilityIndex: 1 },
  ]),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "vuln-1" }]),
      }),
    }),
  },
}));

vi.mock("@/lib/redis/client", () => ({
  redis: {
    hset: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("@/lib/events/emitter", () => ({
  emitMatchEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/redis/keys", () => ({
  redisKeys: {
    matchFlags: (id: string) => `ctf:match:${id}:flags`,
  },
}));

import { buildApp } from "@/lib/sandbox/builder";
import { createBuilderSandbox } from "@/lib/sandbox/manager";
import { generateText, stepCountIs } from "ai";
import { emitMatchEvent } from "@/lib/events/emitter";

describe("buildApp sandbox cleanup", () => {
  const mockSandbox = {
    stop: vi.fn().mockResolvedValue(undefined),
    sandboxId: "sbx-test-123",
    domain: vi.fn().mockReturnValue("test.sandbox.dev"),
    runCommand: vi.fn(),
    writeFiles: vi.fn(),
    readFileToBuffer: vi.fn(),
    updateNetworkPolicy: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createBuilderSandbox).mockResolvedValue({
      sandbox: mockSandbox as never,
      sandboxId: "sbx-test-123",
      appUrl: "https://test.sandbox.dev",
    });
  });

  it("stops sandbox when generateText throws", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("AI timeout"));

    const result = await buildApp("match-1", "player-1", "test/model", {
      appSpec: "test app",
      vulnerabilityCount: 1,
      models: ["test/model", "test/model2"],
      buildTimeLimitSeconds: 60,
      attackTimeLimitSeconds: 60,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("AI timeout");
    expect(mockSandbox.stop).toHaveBeenCalledWith({ blocking: false });
  });

  it("returns error result even if sandbox.stop fails", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("AI failed"));
    mockSandbox.stop.mockRejectedValue(new Error("Already stopped"));

    const result = await buildApp("match-1", "player-1", "test/model", {
      appSpec: "test app",
      vulnerabilityCount: 1,
      models: ["test/model", "test/model2"],
      buildTimeLimitSeconds: 60,
      attackTimeLimitSeconds: 60,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("AI failed");
    // stop was attempted even though it failed
    expect(mockSandbox.stop).toHaveBeenCalled();
  });

  it("does not stop sandbox on success", async () => {
    vi.mocked(generateText).mockResolvedValue({} as never);

    const result = await buildApp("match-1", "player-1", "test/model", {
      appSpec: "test app",
      vulnerabilityCount: 1,
      models: ["test/model", "test/model2"],
      buildTimeLimitSeconds: 60,
      attackTimeLimitSeconds: 60,
    });

    expect(result.success).toBe(true);
    expect(mockSandbox.stop).not.toHaveBeenCalled();
  });

  it("passes stopWhen: stepCountIs(20) to generateText", async () => {
    vi.mocked(generateText).mockResolvedValue({} as never);

    await buildApp("match-1", "player-1", "test/model", {
      appSpec: "test app",
      vulnerabilityCount: 1,
      models: ["test/model", "test/model2"],
      buildTimeLimitSeconds: 60,
      attackTimeLimitSeconds: 60,
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        stopWhen: stepCountIs(20),
      })
    );
  });

  it("emits vulnerability_registered event when vuln is registered", async () => {
    // Mock generateText to invoke the registerVulnerability tool callback
    vi.mocked(generateText).mockImplementation(async (opts: Record<string, unknown>) => {
      const tools = opts.tools as Record<string, { execute: (args: Record<string, unknown>) => Promise<unknown> }>;
      if (tools.registerVulnerability) {
        await tools.registerVulnerability.execute({
          category: "xss",
          description: "XSS in search",
          flagToken: "CTF{test_01_0000000000000001}",
          location: "/search",
          difficulty: 5,
        });
      }
      return {} as never;
    });

    await buildApp("match-1", "player-1", "test/model", {
      appSpec: "test app",
      vulnerabilityCount: 1,
      models: ["test/model", "test/model2"],
      buildTimeLimitSeconds: 60,
      attackTimeLimitSeconds: 60,
    });

    expect(emitMatchEvent).toHaveBeenCalledWith("match-1", {
      eventType: "vulnerability_registered",
      playerId: "player-1",
      payload: {
        category: "xss",
        description: "XSS in search",
        location: "/search",
        difficulty: 5,
        modelId: "test/model",
      },
    });
  });
});
