import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db/client", () => ({
  db: { select: vi.fn() },
}));

vi.mock("@/lib/db/schema", () => ({
  matches: {
    id: "id",
    status: "status",
    startedAt: "started_at",
    completedAt: "completed_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  inArray: vi.fn((col: unknown, vals: unknown[]) => ({ inArray: [col, vals] })),
  lt: vi.fn((col: unknown, val: unknown) => ({ lt: [col, val] })),
  isNull: vi.fn((col: unknown) => ({ isNull: col })),
}));

vi.mock("@/lib/match/cleanup-stale", () => ({
  cleanupStaleMatch: vi.fn(),
}));

import { GET } from "@/app/api/cron/cleanup-stale-matches/route";
import { db } from "@/lib/db/client";
import { cleanupStaleMatch } from "@/lib/match/cleanup-stale";

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

function makeRequest(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret) headers["authorization"] = `Bearer ${secret}`;
  return new Request("http://localhost/api/cron/cleanup-stale-matches", { headers });
}

function mockDbSelect(rows: Array<{ id: string; status: string }>) {
  const whereResult = { where: vi.fn().mockResolvedValue(rows) };
  const fromResult = { from: vi.fn().mockReturnValue(whereResult) };
  vi.mocked(db.select).mockReturnValue(fromResult as never);
}

describe("GET /api/cron/cleanup-stale-matches", () => {
  it("returns 401 without authorization header", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong secret", async () => {
    const res = await GET(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct secret and no stale matches", async () => {
    mockDbSelect([]);
    const res = await GET(makeRequest("test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ checked: 0, cleaned: 0, results: [] });
  });

  it("cleans stale matches and returns results", async () => {
    const staleMatches = [
      { id: "match-1", status: "building" },
      { id: "match-2", status: "attacking" },
    ];
    mockDbSelect(staleMatches);
    vi.mocked(cleanupStaleMatch).mockResolvedValue(undefined);

    const res = await GET(makeRequest("test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.checked).toBe(2);
    expect(body.cleaned).toBe(2);
    expect(cleanupStaleMatch).toHaveBeenCalledWith("match-1");
    expect(cleanupStaleMatch).toHaveBeenCalledWith("match-2");
  });

  it("reports errors for individual match cleanup failures", async () => {
    mockDbSelect([{ id: "match-1", status: "building" }]);
    vi.mocked(cleanupStaleMatch).mockRejectedValue(new Error("DB connection lost"));

    const res = await GET(makeRequest("test-cron-secret"));
    const body = await res.json();

    expect(body.checked).toBe(1);
    expect(body.cleaned).toBe(0);
    expect(body.results[0]).toEqual({
      matchId: "match-1",
      status: "building",
      cleaned: false,
      error: "DB connection lost",
    });
  });
});
