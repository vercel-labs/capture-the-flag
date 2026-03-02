import { db } from "@/lib/db/client";
import { matches, players } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { MatchCard } from "@/components/match-card";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
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

      {matchesWithPlayers.length === 0 ? (
        <div className="text-center text-muted py-16">
          <p className="text-lg">No matches yet.</p>
          <p className="text-sm mt-2">
            Start a match via Slack with{" "}
            <code className="font-mono text-accent">/ctf start</code>
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matchesWithPlayers.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
