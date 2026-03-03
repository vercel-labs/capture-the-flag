import { db } from "@/lib/db/client";
import { matches, players, vulnerabilities, flagCaptures } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import {
  calculateMatchScores,
  type ScoringInput,
  type PlayerScore,
} from "@/lib/scoring/engine";
import { updateLeaderboard } from "@/lib/scoring/leaderboard";
import { emitMatchEvent } from "@/lib/events/emitter";

interface ScoringResult {
  scores: PlayerScore[];
  winnerId: string | null;
  winnerModelId: string | null;
}

export async function scoreMatch(matchId: string): Promise<ScoringResult> {
  "use step";

  await db
    .update(matches)
    .set({ status: "scoring" })
    .where(eq(matches.id, matchId));
  await redis.set(redisKeys.matchStatus(matchId), "scoring");

  await emitMatchEvent(matchId, { eventType: "scoring_started" });

  // Get all players for this match
  const matchPlayers = await db
    .select()
    .from(players)
    .where(eq(players.matchId, matchId));

  // Get first blood info
  const firstBloodPlayerId = await redis.get(
    redisKeys.matchFirstCapture(matchId)
  );

  // Build scoring inputs
  const scoringInputs: ScoringInput[] = await Promise.all(
    matchPlayers.map(async (player) => {
      // Count vulnerabilities planted by this player
      const playerVulns = await db
        .select()
        .from(vulnerabilities)
        .where(eq(vulnerabilities.playerId, player.id));

      // Count compromised vulnerabilities
      const compromisedVulns = playerVulns.filter(
        (v) => v.capturedByPlayerId !== null
      );

      // Count flags captured by this player
      const captures = await db
        .select()
        .from(flagCaptures)
        .where(
          and(
            eq(flagCaptures.matchId, matchId),
            eq(flagCaptures.attackerPlayerId, player.id),
            eq(flagCaptures.isValid, true)
          )
        );

      return {
        playerId: player.id,
        modelId: player.modelId,
        flagsCaptured: captures.length,
        flagsLost: compromisedVulns.length,
        isFirstBlood: firstBloodPlayerId === player.id,
        totalVulnerabilities: playerVulns.length,
        vulnerabilitiesCompromised: compromisedVulns.length,
      };
    })
  );

  const { scores, winner } = calculateMatchScores(scoringInputs);

  // Update player scores in DB
  for (const score of scores) {
    await db
      .update(players)
      .set({
        totalFlagsCaptured: score.flagsCaptured,
        totalFlagsLost: score.flagsLost,
        score: score.totalScore,
      })
      .where(eq(players.id, score.playerId));
  }

  // Update match with winner
  const winnerId = winner?.playerId ?? null;
  await db
    .update(matches)
    .set({ winnerId })
    .where(eq(matches.id, matchId));

  // Update global leaderboard
  await updateLeaderboard(scores, winnerId);

  await emitMatchEvent(matchId, {
    eventType: "scoring_completed",
    payload: {
      scores: scores.map((s) => ({
        modelId: s.modelId,
        totalScore: s.totalScore,
        flagsCaptured: s.flagsCaptured,
        flagsLost: s.flagsLost,
      })),
      winnerModelId: winner?.modelId ?? null,
    },
  });

  return {
    scores,
    winnerId,
    winnerModelId: winner?.modelId ?? null,
  };
}
