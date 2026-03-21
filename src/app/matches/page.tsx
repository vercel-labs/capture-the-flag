import { db } from "@/lib/db/client";
import { matches, players } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { MatchesList } from "@/components/matches-list";
import { isMatchCreationAllowed } from "@/lib/match-creation-guard";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const matchCreationAllowed = await isMatchCreationAllowed();

  const matchList = await db
    .select()
    .from(matches)
    .orderBy(desc(matches.startedAt))
    .limit(50);

  const matchesWithPlayers = await Promise.all(
    matchList.map(async (match) => {
      const matchPlayers = await db
        .select({
          id: players.id,
          modelId: players.modelId,
          score: players.score,
        })
        .from(players)
        .where(eq(players.matchId, match.id));
      return {
        ...match,
        startedAt: match.startedAt?.toISOString() ?? null,
        completedAt: match.completedAt?.toISOString() ?? null,
        players: matchPlayers,
      };
    })
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-mono">Match History</h1>
        <p className="text-muted text-sm mt-1">
          All CTF matches, most recent first
        </p>
      </div>

      <MatchesList initialMatches={matchesWithPlayers} matchCreationDisabled={!matchCreationAllowed} />
    </div>
  );
}
