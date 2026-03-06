import { db } from "@/lib/db/client";
import { matches, players } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import { buildApp } from "@/lib/sandbox/builder";
import { emitMatchEvent } from "@/lib/events/emitter";
import type { MatchConfig } from "@/lib/config/types";

interface BuildInput {
  matchId: string;
  playerId: string;
  modelId: string;
  config: MatchConfig;
}

export interface BuildResult {
  playerId: string;
  modelId: string;
  sandboxId: string;
  appUrl: string;
  success: boolean;
  error?: string;
}

export async function buildPlayerApp(input: BuildInput): Promise<BuildResult> {
  "use step";

  try {
    const { matchId, playerId, modelId, config } = input;

    await emitMatchEvent(matchId, {
      eventType: "build_started",
      playerId,
      payload: { modelId },
    });

    // Update player build status
    await db
      .update(players)
      .set({ buildStatus: "building" })
      .where(eq(players.id, playerId));

    const result = await buildApp(matchId, playerId, modelId, config);

    // Update player record
    await db
      .update(players)
      .set({
        sandboxId: result.sandboxId,
        appUrl: result.appUrl,
        buildStatus: result.success ? "completed" : "failed",
      })
      .where(eq(players.id, playerId));

    await emitMatchEvent(matchId, {
      eventType: result.success ? "build_completed" : "build_failed",
      playerId,
      payload: { modelId, sandboxId: result.sandboxId, appUrl: result.appUrl },
    });

    return {
      playerId,
      modelId,
      sandboxId: result.sandboxId,
      appUrl: result.appUrl,
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    console.error(JSON.stringify({
      step: "buildPlayerApp",
      matchId: input.matchId,
      playerId: input.playerId,
      modelId: input.modelId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    throw error;
  }
}

/**
 * Mark the match as "building" — status update only.
 * Individual builds are dispatched as separate steps from the workflow.
 */
export async function startBuildPhase(matchId: string): Promise<void> {
  "use step";

  try {
    await db
      .update(matches)
      .set({ status: "building", buildStartedAt: new Date() })
      .where(eq(matches.id, matchId));

    await redis.set(redisKeys.matchStatus(matchId), "building");
  } catch (error) {
    console.error(JSON.stringify({
      step: "startBuildPhase",
      matchId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    throw error;
  }
}
