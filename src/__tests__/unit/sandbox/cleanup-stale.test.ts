import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/redis/client", () => ({
  redis: {
    del: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("@/lib/redis/keys", () => ({
  redisKeys: {
    matchStatus: (id: string) => `ctf:match:${id}:status`,
    matchFlags: (id: string) => `ctf:match:${id}:flags`,
    matchScores: (id: string) => `ctf:match:${id}:scores`,
    matchCaptures: (id: string) => `ctf:match:${id}:captures`,
    matchTimeline: (id: string) => `ctf:match:${id}:timeline`,
    matchFirstCapture: (id: string) => `ctf:match:${id}:first_capture`,
    matchEvents: (id: string) => `ctf:match:${id}:events`,
    activeMatches: "ctf:active_matches",
    playerFlagAttempts: (matchId: string, playerId: string) =>
      `ctf:match:${matchId}:player:${playerId}:flag_attempts`,
  },
}));

vi.mock("@/lib/sandbox/manager", () => ({
  getSandbox: vi.fn(),
  stopSandbox: vi.fn(),
}));

// Must mock drizzle-orm to provide eq and sql
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  sql: vi.fn(),
}));

import { cleanupStaleMatch, resolveMatchIdFromPrefix } from "@/lib/match/cleanup-stale";
import { db } from "@/lib/db/client";
import { redis } from "@/lib/redis/client";
import { getSandbox, stopSandbox } from "@/lib/sandbox/manager";

describe("cleanupStaleMatch", () => {
  const mockMatchId = "d2c1fe91-1234-5678-9abc-def012345678";
  const mockPlayers = [
    { id: "player-1", matchId: mockMatchId, sandboxId: "sbx-1", modelId: "m1", appUrl: null, buildStatus: "completed", attackStatus: "pending", totalFlagsCaptured: 0, totalFlagsLost: 0, score: 0 },
    { id: "player-2", matchId: mockMatchId, sandboxId: null, modelId: "m2", appUrl: null, buildStatus: "failed", attackStatus: "pending", totalFlagsCaptured: 0, totalFlagsLost: 0, score: 0 },
  ];

  const mockSandbox = { id: "sbx-1" };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up db.select().from().where() chain
    const whereResult = { where: vi.fn().mockResolvedValue(mockPlayers) };
    const fromResult = { from: vi.fn().mockReturnValue(whereResult) };
    vi.mocked(db.select).mockReturnValue(fromResult as never);

    // Set up db.update().set().where() chain
    const updateWhereResult = { where: vi.fn().mockResolvedValue(undefined) };
    const setResult = { set: vi.fn().mockReturnValue(updateWhereResult) };
    vi.mocked(db.update).mockReturnValue(setResult as never);

    vi.mocked(getSandbox).mockResolvedValue(mockSandbox as never);
    vi.mocked(stopSandbox).mockResolvedValue(undefined);
  });

  it("stops player sandboxes that have a sandboxId", async () => {
    await cleanupStaleMatch(mockMatchId);

    // Only player-1 has a sandboxId
    expect(getSandbox).toHaveBeenCalledTimes(1);
    expect(getSandbox).toHaveBeenCalledWith("sbx-1");
    expect(stopSandbox).toHaveBeenCalledTimes(1);
    expect(stopSandbox).toHaveBeenCalledWith(mockSandbox);
  });

  it("deletes all Redis keys for the match", async () => {
    await cleanupStaleMatch(mockMatchId);

    expect(redis.del).toHaveBeenCalledWith(
      `ctf:match:${mockMatchId}:status`,
      `ctf:match:${mockMatchId}:flags`,
      `ctf:match:${mockMatchId}:scores`,
      `ctf:match:${mockMatchId}:captures`,
      `ctf:match:${mockMatchId}:timeline`,
      `ctf:match:${mockMatchId}:first_capture`,
      `ctf:match:${mockMatchId}:events`,
      `ctf:match:${mockMatchId}:player:player-1:flag_attempts`,
      `ctf:match:${mockMatchId}:player:player-2:flag_attempts`
    );
  });

  it("removes match from active matches set", async () => {
    await cleanupStaleMatch(mockMatchId);

    expect(redis.srem).toHaveBeenCalledWith(
      "ctf:active_matches",
      mockMatchId
    );
  });

  it("updates DB match status to failed", async () => {
    await cleanupStaleMatch(mockMatchId);

    const updateMock = vi.mocked(db.update);
    expect(updateMock).toHaveBeenCalled();
  });

  it("handles sandbox stop failures gracefully", async () => {
    vi.mocked(getSandbox).mockRejectedValue(new Error("Sandbox not found"));

    // Should not throw
    await expect(cleanupStaleMatch(mockMatchId)).resolves.toBeUndefined();
  });
});

describe("resolveMatchIdFromPrefix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns full match ID when prefix matches", async () => {
    const fullId = "d2c1fe91-1234-5678-9abc-def012345678";
    const limitResult = { limit: vi.fn().mockResolvedValue([{ id: fullId }]) };
    const whereResult = { where: vi.fn().mockReturnValue(limitResult) };
    const fromResult = { from: vi.fn().mockReturnValue(whereResult) };
    vi.mocked(db.select).mockReturnValue(fromResult as never);

    const result = await resolveMatchIdFromPrefix("d2c1fe91");
    expect(result).toBe(fullId);
  });

  it("returns null when no match found", async () => {
    const limitResult = { limit: vi.fn().mockResolvedValue([]) };
    const whereResult = { where: vi.fn().mockReturnValue(limitResult) };
    const fromResult = { from: vi.fn().mockReturnValue(whereResult) };
    vi.mocked(db.select).mockReturnValue(fromResult as never);

    const result = await resolveMatchIdFromPrefix("nonexistent");
    expect(result).toBeNull();
  });
});
