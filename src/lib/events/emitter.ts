import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import { REDIS_TTL } from "@/lib/config/defaults";
import type { MatchEventType } from "@/lib/config/types";

interface MatchEvent {
  eventType: MatchEventType;
  playerId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Emit a match event to Redis pub/sub and timeline.
 */
export async function emitMatchEvent(
  matchId: string,
  event: MatchEvent
): Promise<void> {
  const eventData = {
    ...event,
    matchId,
    timestamp: new Date().toISOString(),
  };

  const serialized = JSON.stringify(eventData);

  // Append to timeline list
  await redis.rpush(redisKeys.matchTimeline(matchId), serialized);
  await redis.expire(
    redisKeys.matchTimeline(matchId),
    REDIS_TTL.matchKeysSeconds
  );

  // Publish to events channel for SSE consumers
  await redis.publish(redisKeys.matchEvents(matchId), serialized);
}

/**
 * Get all events from the match timeline.
 */
export async function getMatchTimeline(
  matchId: string
): Promise<MatchEvent[]> {
  const events = await redis.lrange(redisKeys.matchTimeline(matchId), 0, -1);
  return events.map((e) =>
    typeof e === "string" ? JSON.parse(e) : e
  ) as MatchEvent[];
}
