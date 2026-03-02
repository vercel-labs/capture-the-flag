import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { matches, players, vulnerabilities, flagCaptures } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  context: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await context.params;

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const matchPlayers = await db
    .select()
    .from(players)
    .where(eq(players.matchId, matchId));

  const matchVulns = await db
    .select({
      id: vulnerabilities.id,
      category: vulnerabilities.category,
      description: vulnerabilities.description,
      location: vulnerabilities.location,
      difficulty: vulnerabilities.difficulty,
      pointValue: vulnerabilities.pointValue,
      capturedByPlayerId: vulnerabilities.capturedByPlayerId,
      playerId: vulnerabilities.playerId,
    })
    .from(vulnerabilities)
    .where(eq(vulnerabilities.matchId, matchId));

  const captures = await db
    .select()
    .from(flagCaptures)
    .where(eq(flagCaptures.matchId, matchId));

  return NextResponse.json({
    ...match,
    players: matchPlayers,
    vulnerabilities: matchVulns,
    captures,
  });
}
