import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import { RATE_LIMITS, REDIS_TTL, SCORING } from "@/lib/config/defaults";
import { isValidFlagFormat } from "./generator";
import { db } from "@/lib/db/client";
import { vulnerabilities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { FlagSubmission, FlagValidationResult } from "./types";

interface StoredFlagData {
  vulnerabilityId: string;
  playerId: string;
  pointValue: number;
}

/**
 * Check if a player is rate-limited for flag submissions.
 */
async function checkRateLimit(
  matchId: string,
  playerId: string
): Promise<boolean> {
  const key = redisKeys.playerFlagAttempts(matchId, playerId);
  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, REDIS_TTL.rateLimitSeconds);
  }
  return attempts > RATE_LIMITS.flagAttemptsPerWindow;
}

/**
 * Validate a submitted flag against the match's flag registry in Redis.
 */
export async function validateFlag(
  submission: FlagSubmission
): Promise<FlagValidationResult> {
  const { matchId, attackerPlayerId, submittedFlag } = submission;

  if (!isValidFlagFormat(submittedFlag)) {
    return {
      isValid: false,
      pointsAwarded: 0,
      isFirstBlood: false,
      error: "Invalid flag format",
    };
  }

  const isRateLimited = await checkRateLimit(matchId, attackerPlayerId);
  if (isRateLimited) {
    return {
      isValid: false,
      pointsAwarded: 0,
      isFirstBlood: false,
      error: "Rate limited. Try again later.",
    };
  }

  const flagDataRaw = await redis.hget(
    redisKeys.matchFlags(matchId),
    submittedFlag
  );
  if (!flagDataRaw) {
    return {
      isValid: false,
      pointsAwarded: 0,
      isFirstBlood: false,
      error: "Flag not recognized",
    };
  }

  const flagData = flagDataRaw as StoredFlagData;

  // Prevent self-capture
  if (flagData.playerId === attackerPlayerId) {
    return {
      isValid: false,
      pointsAwarded: 0,
      isFirstBlood: false,
      error: "Cannot capture your own flag",
    };
  }

  // Remove the flag from the hash so it can't be captured again
  const removed = await redis.hdel(
    redisKeys.matchFlags(matchId),
    submittedFlag
  );
  if (removed === 0) {
    return {
      isValid: false,
      pointsAwarded: 0,
      isFirstBlood: false,
      error: "Flag already captured",
    };
  }

  // Mark vulnerability as captured in the database
  await db
    .update(vulnerabilities)
    .set({ capturedByPlayerId: attackerPlayerId })
    .where(eq(vulnerabilities.id, flagData.vulnerabilityId));

  // Check if this is first blood
  const firstCaptureKey = redisKeys.matchFirstCapture(matchId);
  const existingFirst = await redis.get(firstCaptureKey);
  const isFirstBlood = existingFirst === null;

  if (isFirstBlood) {
    await redis.set(firstCaptureKey, attackerPlayerId, {
      ex: REDIS_TTL.matchKeysSeconds,
    });
  }

  const pointsAwarded =
    flagData.pointValue + (isFirstBlood ? SCORING.FIRST_BLOOD_BONUS : 0);

  // Update scores in sorted set
  await redis.zincrby(
    redisKeys.matchScores(matchId),
    pointsAwarded,
    attackerPlayerId
  );

  return {
    isValid: true,
    vulnerabilityId: flagData.vulnerabilityId,
    defenderPlayerId: flagData.playerId,
    pointsAwarded,
    isFirstBlood,
  };
}
