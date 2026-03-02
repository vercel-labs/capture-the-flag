import { db } from "@/lib/db/client";
import { matches, players } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import { attackApp } from "@/lib/sandbox/attacker";
import { emitMatchEvent } from "@/lib/events/emitter";
import type { MatchConfig } from "@/lib/config/types";

interface AttackInput {
  matchId: string;
  config: MatchConfig;
  playerApps: Array<{
    playerId: string;
    modelId: string;
    appUrl: string;
  }>;
}

interface AttackResult {
  results: Array<{
    attackerPlayerId: string;
    attackerModelId: string;
    targetModelId: string;
    flagsCaptured: number;
    success: boolean;
    error?: string;
  }>;
}

export async function runAttackPhase(input: AttackInput): Promise<AttackResult> {
  "use step";

  const { matchId, config, playerApps } = input;

  await db
    .update(matches)
    .set({ status: "attacking", attackStartedAt: new Date() })
    .where(eq(matches.id, matchId));
  await redis.set(redisKeys.matchStatus(matchId), "attacking");

  await emitMatchEvent(matchId, {
    eventType: "attack_started",
    payload: { playerCount: playerApps.length },
  });

  // Each player attacks all other players' apps concurrently
  const attackTasks: Promise<{
    attackerPlayerId: string;
    attackerModelId: string;
    targetModelId: string;
    flagsCaptured: number;
    success: boolean;
    error?: string;
  }>[] = [];

  for (const attacker of playerApps) {
    for (const target of playerApps) {
      if (attacker.playerId === target.playerId) continue;

      attackTasks.push(
        attackApp(matchId, attacker.playerId, attacker.modelId, {
          playerId: target.playerId,
          modelId: target.modelId,
          appUrl: target.appUrl,
        }, config).then((result) => ({
          attackerPlayerId: attacker.playerId,
          attackerModelId: attacker.modelId,
          targetModelId: target.modelId,
          flagsCaptured: result.flagsCaptured,
          success: result.success,
          error: result.error,
        }))
      );
    }
  }

  const results = await Promise.all(attackTasks);

  // Update player attack statuses
  for (const app of playerApps) {
    await db
      .update(players)
      .set({ attackStatus: "completed" })
      .where(eq(players.id, app.playerId));
  }

  await emitMatchEvent(matchId, {
    eventType: "attack_completed",
    payload: {
      totalFlagsCaptured: results.reduce((sum, r) => sum + r.flagsCaptured, 0),
    },
  });

  return { results };
}
