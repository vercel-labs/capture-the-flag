import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidFlagFormat } from "@/lib/flags/generator";

describe("isValidFlagFormat (validator integration)", () => {
  it("validates correct flags", () => {
    expect(isValidFlagFormat("CTF{a3f2_07_e9c1b4d82f6a0753}")).toBe(true);
    expect(isValidFlagFormat("CTF{dead_01_0000000000000000}")).toBe(true);
    expect(isValidFlagFormat("CTF{abcd_99_ffffffffffffffff}")).toBe(true);
  });

  it("rejects malformed flags", () => {
    expect(isValidFlagFormat("")).toBe(false);
    expect(isValidFlagFormat("not a flag")).toBe(false);
    expect(isValidFlagFormat("CTF{}")).toBe(false);
    expect(isValidFlagFormat("CTF{short}")).toBe(false);
    expect(isValidFlagFormat("ctf{a3f2_07_e9c1b4d82f6a0753}")).toBe(false);
  });
});

// --- validateFlag DB update test ---

const { mockWhere, mockSet, mockUpdate } = vi.hoisted(() => {
  const mockWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  return { mockWhere, mockSet, mockUpdate };
});

vi.mock("@/lib/redis/client", () => ({
  redis: {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    hget: vi.fn().mockResolvedValue({
      vulnerabilityId: "vuln-123",
      playerId: "defender-1",
      pointValue: 100,
    }),
    hdel: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    zincrby: vi.fn().mockResolvedValue(100),
  },
}));

vi.mock("@/lib/redis/keys", () => ({
  redisKeys: {
    playerFlagAttempts: (matchId: string, playerId: string) =>
      `ctf:match:${matchId}:player:${playerId}:attempts`,
    matchFlags: (matchId: string) => `ctf:match:${matchId}:flags`,
    matchFirstCapture: (matchId: string) => `ctf:match:${matchId}:first`,
    matchScores: (matchId: string) => `ctf:match:${matchId}:scores`,
  },
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    update: mockUpdate,
  },
}));

vi.mock("@/lib/db/schema", () => ({
  vulnerabilities: { id: "vulnerabilities.id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockImplementation((col, val) => ({ col, val })),
}));

vi.mock("@/lib/config/defaults", () => ({
  RATE_LIMITS: { flagAttemptsPerWindow: 10 },
  REDIS_TTL: { rateLimitSeconds: 60, matchKeysSeconds: 3600 },
  SCORING: { FIRST_BLOOD_BONUS: 50 },
}));

import { validateFlag } from "@/lib/flags/validator";
import { eq } from "drizzle-orm";
import { vulnerabilities } from "@/lib/db/schema";

describe("validateFlag DB update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates capturedByPlayerId on successful capture", async () => {
    const result = await validateFlag({
      matchId: "match-1",
      attackerPlayerId: "attacker-1",
      submittedFlag: "CTF{a3f2_07_e9c1b4d82f6a0753}",
      method: "sqli",
    });

    expect(result.isValid).toBe(true);
    expect(result.vulnerabilityId).toBe("vuln-123");

    // Verify DB update was called
    expect(mockUpdate).toHaveBeenCalledWith(vulnerabilities);
    expect(mockSet).toHaveBeenCalledWith({ capturedByPlayerId: "attacker-1" });
    expect(mockWhere).toHaveBeenCalledWith(eq(vulnerabilities.id, "vuln-123"));
  });
});
