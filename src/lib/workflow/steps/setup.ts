import { db } from "@/lib/db/client";
import { matches, players } from "@/lib/db/schema";
import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import { REDIS_TTL } from "@/lib/config/defaults";
import { matchConfigSchema, type MatchConfig } from "@/lib/config/types";
import { emitMatchEvent } from "@/lib/events/emitter";

interface SetupInput {
  config: MatchConfig;
  slackChannelId?: string;
  slackThreadTs?: string;
}

interface SetupResult {
  matchId: string;
  playerIds: string[];
  config: MatchConfig;
}

export async function setupMatch(input: SetupInput): Promise<SetupResult> {
  "use step";

  try {
    // Validate config
    const config = matchConfigSchema.parse(input.config);

    // Create match record
    const [match] = await db
      .insert(matches)
      .values({
        status: "pending",
        config,
        slackChannelId: input.slackChannelId,
        slackThreadTs: input.slackThreadTs,
        startedAt: new Date(),
      })
      .returning({ id: matches.id });

    // Create player records for each model
    const playerRecords = await db
      .insert(players)
      .values(
        config.models.map((modelId) => ({
          matchId: match.id,
          modelId,
          buildStatus: "pending",
          attackStatus: "pending",
        }))
      )
      .returning({ id: players.id, modelId: players.modelId });

    // Initialize Redis state
    const matchId = match.id;
    await redis.set(redisKeys.matchStatus(matchId), "pending", {
      ex: REDIS_TTL.matchKeysSeconds,
    });
    await redis.sadd(redisKeys.activeMatches, matchId);

    await emitMatchEvent(matchId, {
      eventType: "match_created",
      payload: {
        models: config.models,
        vulnerabilityCount: config.vulnerabilityCount,
      },
    });

    return {
      matchId,
      playerIds: playerRecords.map((p) => p.id),
      config,
    };
  } catch (error) {
    console.error(JSON.stringify({
      step: "setupMatch",
      models: input.config.models,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    throw error;
  }
}
