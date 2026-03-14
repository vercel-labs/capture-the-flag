import { db } from "@/lib/db/client";
import { matches, players } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import { attackApp } from "@/lib/sandbox/attacker";
import { emitMatchEvent } from "@/lib/events/emitter";
import type { MatchConfig } from "@/lib/config/types";

interface AttackPlayerInput {
  matchId: string;
  attacker: {
    playerId: string;
    modelId: string;
  };
  target: {
    playerId: string;
    modelId: string;
    appUrl: string;
  };
  config: MatchConfig;
}

export interface AttackPairResult {
  attackerPlayerId: string;
  attackerModelId: string;
  targetPlayerId: string;
  targetModelId: string;
  flagsCaptured: number;
  success: boolean;
  error?: string;
}

/**
 * Run a single attacker→target attack as its own workflow step.
 */
export async function attackPlayerApp(
  input: AttackPlayerInput
): Promise<AttackPairResult> {
  "use step";

  try {
    const { matchId, attacker, target, config } = input;

    const result = await attackApp(
      matchId,
      attacker.playerId,
      attacker.modelId,
      {
        playerId: target.playerId,
        modelId: target.modelId,
        appUrl: target.appUrl,
      },
      config
    );

    return {
      attackerPlayerId: attacker.playerId,
      attackerModelId: attacker.modelId,
      targetPlayerId: target.playerId,
      targetModelId: target.modelId,
      flagsCaptured: result.flagsCaptured,
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    console.error(JSON.stringify({
      step: "attackPlayerApp",
      matchId: input.matchId,
      attackerPlayerId: input.attacker.playerId,
      targetPlayerId: input.target.playerId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    throw error;
  }
}

/**
 * Mark the match as "attacking" — status update only.
 * Individual attacks are dispatched as separate steps from the workflow.
 */
export async function startAttackPhase(
  matchId: string,
  playerCount: number,
  healthyPlayerIds?: string[]
): Promise<void> {
  "use step";

  try {
    await db
      .update(matches)
      .set({ status: "attacking", attackStartedAt: new Date() })
      .where(eq(matches.id, matchId));
    await redis.set(redisKeys.matchStatus(matchId), "attacking");

    // Persist attackStatus to DB — only for healthy players if specified
    if (healthyPlayerIds && healthyPlayerIds.length > 0) {
      for (const id of healthyPlayerIds) {
        await db.update(players).set({ attackStatus: "attacking" }).where(eq(players.id, id));
      }
    } else {
      const matchPlayers = await db.select({ id: players.id }).from(players).where(eq(players.matchId, matchId));
      for (const p of matchPlayers) {
        await db.update(players).set({ attackStatus: "attacking" }).where(eq(players.id, p.id));
      }
    }

    await emitMatchEvent(matchId, {
      eventType: "attack_started",
      payload: { playerCount },
    });
  } catch (error) {
    console.error(JSON.stringify({
      step: "startAttackPhase",
      matchId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    throw error;
  }
}

/**
 * Update player statuses and emit completion event after all attacks finish.
 */
export async function completeAttackPhase(
  matchId: string,
  playerIds: string[],
  results: AttackPairResult[]
): Promise<void> {
  "use step";

  try {
    // Update player attack statuses
    for (const playerId of playerIds) {
      await db
        .update(players)
        .set({ attackStatus: "completed" })
        .where(eq(players.id, playerId));
    }

    await emitMatchEvent(matchId, {
      eventType: "attack_completed",
      payload: {
        totalFlagsCaptured: results.reduce(
          (sum, r) => sum + r.flagsCaptured,
          0
        ),
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      step: "completeAttackPhase",
      matchId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    throw error;
  }
}
