import { db } from "@/lib/db/client";
import { matches, players } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import { getSandbox, stopSandbox } from "@/lib/sandbox/manager";

/**
 * Clean up a stale match by full match ID.
 * NOT a workflow step — called directly from bot command handler.
 */
export async function cleanupStaleMatch(matchId: string): Promise<void> {
  // Stop all player sandboxes
  const matchPlayers = await db
    .select()
    .from(players)
    .where(eq(players.matchId, matchId));

  await Promise.all(
    matchPlayers
      .filter((p) => p.sandboxId)
      .map(async (p) => {
        try {
          const sandbox = await getSandbox(p.sandboxId!);
          await stopSandbox(sandbox);
        } catch {
          // Sandbox may already be stopped
        }
      })
  );

  // Delete all Redis keys for this match
  const keysToDelete = [
    redisKeys.matchStatus(matchId),
    redisKeys.matchFlags(matchId),
    redisKeys.matchScores(matchId),
    redisKeys.matchCaptures(matchId),
    redisKeys.matchTimeline(matchId),
    redisKeys.matchFirstCapture(matchId),
    redisKeys.matchEvents(matchId),
  ];
  for (const p of matchPlayers) {
    keysToDelete.push(redisKeys.playerFlagAttempts(matchId, p.id));
  }
  await redis.del(...keysToDelete);
  await redis.srem(redisKeys.activeMatches, matchId);

  // Mark match as failed in DB
  await db
    .update(matches)
    .set({ status: "failed", completedAt: new Date() })
    .where(eq(matches.id, matchId));
}

/**
 * Resolve a full match UUID from a short prefix (e.g., "d2c1fe91").
 * Returns null if no match is found.
 */
export async function resolveMatchIdFromPrefix(
  prefix: string
): Promise<string | null> {
  const result = await db
    .select({ id: matches.id })
    .from(matches)
    .where(sql`${matches.id}::text LIKE ${prefix + "%"}`)
    .limit(1);

  return result.length > 0 ? result[0].id : null;
}
