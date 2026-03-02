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

interface BuildResult {
  playerId: string;
  modelId: string;
  sandboxId: string;
  appUrl: string;
  success: boolean;
  error?: string;
}

export async function buildPlayerApp(input: BuildInput): Promise<BuildResult> {
  "use step";

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
}

export async function buildAllApps(
  matchId: string,
  playerIds: string[],
  modelIds: string[],
  config: MatchConfig
): Promise<BuildResult[]> {
  "use step";

  await db
    .update(matches)
    .set({ status: "building", buildStartedAt: new Date() })
    .where(eq(matches.id, matchId));

  await redis.set(redisKeys.matchStatus(matchId), "building");

  // Build all apps in parallel
  const results = await Promise.all(
    playerIds.map((playerId, i) =>
      buildApp(matchId, playerId, modelIds[i], config)
    )
  );

  return results.map((result, i) => ({
    playerId: playerIds[i],
    modelId: modelIds[i],
    sandboxId: result.sandboxId,
    appUrl: result.appUrl,
    success: result.success,
    error: result.error,
  }));
}
