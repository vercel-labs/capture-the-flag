import { db } from "@/lib/db/client";
import { matches, players } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import { healthCheck } from "@/lib/sandbox/manager";
import { emitMatchEvent } from "@/lib/events/emitter";

interface DeployInput {
  matchId: string;
  playerApps: Array<{
    playerId: string;
    modelId: string;
    appUrl: string;
  }>;
}

interface DeployResult {
  allHealthy: boolean;
  results: Array<{
    playerId: string;
    modelId: string;
    appUrl: string;
    healthy: boolean;
  }>;
}

export async function verifyDeployments(
  input: DeployInput
): Promise<DeployResult> {
  "use step";

  try {
    const { matchId, playerApps } = input;

    await db
      .update(matches)
      .set({ status: "deploying" })
      .where(eq(matches.id, matchId));
    await redis.set(redisKeys.matchStatus(matchId), "deploying");

    await emitMatchEvent(matchId, {
      eventType: "deploy_started",
      payload: { playerCount: playerApps.length },
    });

    // Health check all apps in parallel
    const results = await Promise.all(
      playerApps.map(async (app) => {
        const healthy = await healthCheck(app.appUrl);

        if (healthy) {
          await db
            .update(players)
            .set({ appUrl: app.appUrl, buildStatus: "live" })
            .where(eq(players.id, app.playerId));
        }

        return {
          playerId: app.playerId,
          modelId: app.modelId,
          appUrl: app.appUrl,
          healthy,
        };
      })
    );

    const allHealthy = results.every((r) => r.healthy);

    await emitMatchEvent(matchId, {
      eventType: allHealthy ? "deploy_completed" : "deploy_failed",
      payload: {
        results: results.map((r) => ({
          playerId: r.playerId,
          modelId: r.modelId,
          healthy: r.healthy,
          ...(r.healthy && r.appUrl ? { appUrl: r.appUrl } : {}),
        })),
      },
    });

    return { allHealthy, results };
  } catch (error) {
    console.error(JSON.stringify({
      step: "verifyDeployments",
      matchId: input.matchId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    throw error;
  }
}
