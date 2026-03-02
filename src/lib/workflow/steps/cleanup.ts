import { db } from "@/lib/db/client";
import { matches, players, matchEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import { getSandbox, stopSandbox } from "@/lib/sandbox/manager";
import { getMatchTimeline, emitMatchEvent } from "@/lib/events/emitter";

export async function cleanupMatch(matchId: string): Promise<void> {
  "use step";

  // Get all players to find sandbox IDs
  const matchPlayers = await db
    .select()
    .from(players)
    .where(eq(players.matchId, matchId));

  // Stop all sandboxes
  const stopTasks = matchPlayers
    .filter((p) => p.sandboxId)
    .map(async (p) => {
      try {
        const sandbox = await getSandbox(p.sandboxId!);
        await stopSandbox(sandbox);
      } catch {
        // Sandbox may already be stopped
      }
    });

  await Promise.all(stopTasks);

  // Copy Redis timeline to match_events table
  const timeline = await getMatchTimeline(matchId);
  if (timeline.length > 0) {
    await db.insert(matchEvents).values(
      timeline.map((event) => ({
        matchId,
        playerId: (event as Record<string, unknown>).playerId as
          | string
          | undefined,
        eventType:
          (event as Record<string, unknown>).eventType as string,
        payload: (event as Record<string, unknown>).payload as Record<
          string,
          unknown
        >,
      }))
    );
  }

  // Update match status
  await db
    .update(matches)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(matches.id, matchId));

  // Clean up Redis
  await redis.set(redisKeys.matchStatus(matchId), "completed");
  await redis.srem(redisKeys.activeMatches, matchId);

  await emitMatchEvent(matchId, {
    eventType: "match_completed",
    payload: { completedAt: new Date().toISOString() },
  });
}
