import { NextResponse } from "next/server";
import { validateFlag } from "@/lib/flags/validator";
import { db } from "@/lib/db/client";
import { flagCaptures } from "@/lib/db/schema";
import { emitMatchEvent } from "@/lib/events/emitter";

export async function POST(
  request: Request,
  context: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await context.params;
  const body = await request.json();
  const { attackerPlayerId, flag, method } = body;

  if (!attackerPlayerId || !flag) {
    return NextResponse.json(
      { error: "attackerPlayerId and flag are required" },
      { status: 400 }
    );
  }

  const result = await validateFlag({
    matchId,
    attackerPlayerId,
    submittedFlag: flag,
    method,
  });

  // Record the attempt
  await db.insert(flagCaptures).values({
    matchId,
    attackerPlayerId,
    defenderPlayerId: result.defenderPlayerId || attackerPlayerId,
    vulnerabilityId: result.vulnerabilityId || undefined,
    submittedFlag: flag,
    isValid: result.isValid,
    pointsAwarded: result.pointsAwarded,
    method,
  });

  if (result.isValid) {
    await emitMatchEvent(matchId, {
      eventType: "flag_captured",
      playerId: attackerPlayerId,
      payload: {
        pointsAwarded: result.pointsAwarded,
        isFirstBlood: result.isFirstBlood,
        method,
      },
    });

    if (result.isFirstBlood) {
      await emitMatchEvent(matchId, {
        eventType: "first_blood",
        playerId: attackerPlayerId,
      });
    }
  }

  return NextResponse.json(result);
}
