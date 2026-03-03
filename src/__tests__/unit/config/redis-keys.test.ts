import { describe, it, expect } from "vitest";
import { redisKeys } from "@/lib/redis/keys";

describe("redisKeys", () => {
  const matchId = "test-match-123";
  const playerId = "test-player-456";

  it("generates match status key", () => {
    expect(redisKeys.matchStatus(matchId)).toBe(
      "ctf:match:test-match-123:status"
    );
  });

  it("generates match flags key", () => {
    expect(redisKeys.matchFlags(matchId)).toBe(
      "ctf:match:test-match-123:flags"
    );
  });

  it("generates match scores key", () => {
    expect(redisKeys.matchScores(matchId)).toBe(
      "ctf:match:test-match-123:scores"
    );
  });

  it("generates match captures key", () => {
    expect(redisKeys.matchCaptures(matchId)).toBe(
      "ctf:match:test-match-123:captures"
    );
  });

  it("generates match timeline key", () => {
    expect(redisKeys.matchTimeline(matchId)).toBe(
      "ctf:match:test-match-123:timeline"
    );
  });

  it("generates match first capture key", () => {
    expect(redisKeys.matchFirstCapture(matchId)).toBe(
      "ctf:match:test-match-123:first_capture"
    );
  });

  it("generates match events key", () => {
    expect(redisKeys.matchEvents(matchId)).toBe(
      "ctf:match:test-match-123:events"
    );
  });

  it("generates active matches key", () => {
    expect(redisKeys.activeMatches).toBe("ctf:active_matches");
  });

  it("generates player flag attempts key", () => {
    expect(redisKeys.playerFlagAttempts(matchId, playerId)).toBe(
      "ctf:match:test-match-123:player:test-player-456:flag_attempts"
    );
  });
});
