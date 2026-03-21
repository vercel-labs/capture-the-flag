import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { matches } from "@/lib/db/schema";
import { and, inArray, lt, isNull } from "drizzle-orm";
import { cleanupStaleMatch } from "@/lib/match/cleanup-stale";

const ACTIVE_STATUSES = [
  "pending",
  "building",
  "deploying",
  "attacking",
  "scoring",
] as const;

/** Matches stuck longer than this are considered stale */
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  const staleMatches = await db
    .select({ id: matches.id, status: matches.status })
    .from(matches)
    .where(
      and(
        inArray(matches.status, [...ACTIVE_STATUSES]),
        lt(matches.startedAt, cutoff),
        isNull(matches.completedAt)
      )
    );

  const results: Array<{ matchId: string; status: string; cleaned: boolean; error?: string }> = [];

  for (const match of staleMatches) {
    try {
      await cleanupStaleMatch(match.id);
      results.push({ matchId: match.id, status: match.status, cleaned: true });
    } catch (error) {
      results.push({
        matchId: match.id,
        status: match.status,
        cleaned: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    checked: staleMatches.length,
    cleaned: results.filter((r) => r.cleaned).length,
    results,
  });
}
