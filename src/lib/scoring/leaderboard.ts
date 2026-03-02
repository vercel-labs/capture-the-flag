import { db } from "@/lib/db/client";
import { leaderboardStats } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import type { PlayerScore } from "./engine";

/**
 * Update the leaderboard_stats table after a match completes.
 */
export async function updateLeaderboard(
  matchScores: PlayerScore[],
  winnerId: string | null
) {
  for (const score of matchScores) {
    const isWinner = score.playerId === winnerId;

    await db
      .insert(leaderboardStats)
      .values({
        modelId: score.modelId,
        totalMatches: 1,
        totalWins: isWinner ? 1 : 0,
        totalFlagsCaptured: score.flagsCaptured,
        totalFlagsLost: score.flagsLost,
        totalPoints: score.totalScore,
        winRate: isWinner ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: leaderboardStats.modelId,
        set: {
          totalMatches: sql`${leaderboardStats.totalMatches} + 1`,
          totalWins: sql`${leaderboardStats.totalWins} + ${isWinner ? 1 : 0}`,
          totalFlagsCaptured: sql`${leaderboardStats.totalFlagsCaptured} + ${score.flagsCaptured}`,
          totalFlagsLost: sql`${leaderboardStats.totalFlagsLost} + ${score.flagsLost}`,
          totalPoints: sql`${leaderboardStats.totalPoints} + ${score.totalScore}`,
          winRate: sql`CASE WHEN ${leaderboardStats.totalMatches} + 1 > 0 THEN (${leaderboardStats.totalWins} + ${isWinner ? 1 : 0})::real / (${leaderboardStats.totalMatches} + 1)::real ELSE 0 END`,
        },
      });
  }
}

/**
 * Fetch the full leaderboard sorted by total points.
 */
export async function getLeaderboard() {
  return db
    .select()
    .from(leaderboardStats)
    .orderBy(sql`${leaderboardStats.totalPoints} DESC`);
}
