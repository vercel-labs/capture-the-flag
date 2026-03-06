import { db } from "@/lib/db/client";
import { matches, players, matchEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import { getSandbox, stopSandbox } from "@/lib/sandbox/manager";
import { getMatchTimeline, emitMatchEvent } from "@/lib/events/emitter";

/**
 * Copy the Redis event timeline into the match_events DB table,
 * preserving original timestamps.
 */
async function copyTimelineToDb(matchId: string): Promise<void> {
  const timeline = await getMatchTimeline(matchId);
  if (timeline.length > 0) {
    await db.insert(matchEvents).values(
      timeline.map((event) => {
        const e = event as unknown as Record<string, unknown>;
        return {
          matchId,
          playerId: e.playerId as string | undefined,
          eventType: e.eventType as string,
          payload: e.payload as Record<string, unknown>,
          createdAt: e.timestamp ? new Date(e.timestamp as string) : new Date(),
        };
      })
    );
  }
}

/**
 * Mark a match as failed and clean up all sandbox resources.
 * Called when the workflow encounters an unrecoverable error.
 */
export async function failMatch(matchId: string): Promise<void> {
  "use step";

  try {
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

    // Mark all player sandboxes as shutdown
    for (const p of matchPlayers) {
      await db.update(players).set({ buildStatus: "shutdown" }).where(eq(players.id, p.id));
    }

    // Copy Redis timeline to DB before marking failed
    await copyTimelineToDb(matchId);

    // Mark match as failed
    await db
      .update(matches)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(matches.id, matchId));

    await redis.set(redisKeys.matchStatus(matchId), "failed");
    await redis.srem(redisKeys.activeMatches, matchId);

    await emitMatchEvent(matchId, {
      eventType: "match_failed",
      payload: { failedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error(JSON.stringify({
      step: "failMatch",
      matchId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    throw error;
  }
}

/**
 * Last-resort fallback: force-set match status to failed in DB and Redis.
 * This is a step function so it runs in Node.js (not the workflow VM),
 * avoiding the EventTarget crash from bundled @upstash/redis.
 */
export async function forceFailMatch(matchId: string): Promise<void> {
  "use step";

  try {
    await db
      .update(matches)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(matches.id, matchId));
    await redis.set(redisKeys.matchStatus(matchId), "failed").catch(() => {});
    await redis.srem(redisKeys.activeMatches, matchId).catch(() => {});
  } catch (error) {
    console.error(JSON.stringify({
      step: "forceFailMatch",
      matchId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    throw error;
  }
}

export async function cleanupMatch(matchId: string): Promise<void> {
  "use step";

  try {
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

    // Mark all player sandboxes as shutdown
    for (const p of matchPlayers) {
      await db.update(players).set({ buildStatus: "shutdown" }).where(eq(players.id, p.id));
    }

    // Copy Redis timeline to match_events table (preserving timestamps)
    await copyTimelineToDb(matchId);

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
  } catch (error) {
    console.error(JSON.stringify({
      step: "cleanupMatch",
      matchId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    throw error;
  }
}
