import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { matches, players } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { start } from "workflow/api";
import { ctfMatchWorkflow } from "@/lib/workflow/ctf-match";
import { matchConfigSchema } from "@/lib/config/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const offset = parseInt(searchParams.get("offset") || "0");

  const matchList = await db
    .select()
    .from(matches)
    .orderBy(desc(matches.startedAt))
    .limit(limit)
    .offset(offset);

  // Attach players to each match
  const matchesWithPlayers = await Promise.all(
    matchList.map(async (match) => {
      const matchPlayers = await db
        .select()
        .from(players)
        .where(eq(players.matchId, match.id));
      return { ...match, players: matchPlayers };
    })
  );

  return NextResponse.json(matchesWithPlayers);
}

export async function POST(request: Request) {
  const body = await request.json();
  const config = matchConfigSchema.parse(body.config || {});

  const run = await start(ctfMatchWorkflow, [
    {
      config,
      slackChannelId: body.slackChannelId,
      slackThreadTs: body.slackThreadTs,
    },
  ]);

  return NextResponse.json({ runId: run.runId }, { status: 201 });
}
