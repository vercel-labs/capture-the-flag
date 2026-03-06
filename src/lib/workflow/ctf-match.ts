import { createHook } from "workflow";
import { FatalError } from "workflow";
import { setupMatch } from "./steps/setup";
import { startBuildPhase, buildPlayerApp } from "./steps/build";
import { verifyDeployments } from "./steps/deploy";
import {
  startAttackPhase,
  attackPlayerApp,
  completeAttackPhase,
} from "./steps/attack";
import { scoreMatch } from "./steps/scoring";
import { cleanupMatch, failMatch, forceFailMatch } from "./steps/cleanup";
import type { MatchConfig } from "@/lib/config/types";

interface CtfMatchInput {
  config: MatchConfig;
  slackChannelId?: string;
  slackThreadTs?: string;
}

export async function ctfMatchWorkflow(input: CtfMatchInput) {
  "use workflow";

  // Step 1: Setup — validate config, create DB records, init Redis
  const { matchId, playerIds, config } = await setupMatch({
    config: input.config,
    slackChannelId: input.slackChannelId,
    slackThreadTs: input.slackThreadTs,
  });

  // Create a hook for manual stop — resumeHook("ctf-stop:{matchId}") cancels
  createHook<{ reason: string }>({ token: `ctf-stop:${matchId}` });

  try {
    // Step 2a: Mark match as building
    await startBuildPhase(matchId);

    // Step 2b: Build each player's app (each dispatched as a separate step)
    const buildResults = await Promise.all(
      playerIds.map((playerId, i) =>
        buildPlayerApp({
          matchId,
          playerId,
          modelId: config.models[i],
          config,
        })
      )
    );

    // Check for build failures
    const successfulBuilds = buildResults.filter((r) => r.success);
    if (successfulBuilds.length < 2) {
      throw new FatalError(
        `Not enough successful builds (${successfulBuilds.length}/${buildResults.length}). Need at least 2.`
      );
    }

    // Step 3: Deploy — health check all sandbox URLs
    const deployResult = await verifyDeployments({
      matchId,
      playerApps: successfulBuilds.map((b) => ({
        playerId: b.playerId,
        modelId: b.modelId,
        appUrl: b.appUrl,
      })),
    });

    const healthyApps = deployResult.results.filter((r) => r.healthy);
    if (healthyApps.length < 2) {
      throw new FatalError(
        `Not enough healthy apps (${healthyApps.length}). Need at least 2.`
      );
    }

    // Step 4a: Mark match as attacking
    await startAttackPhase(matchId, healthyApps.length);

    // Step 4b: Each player attacks all others (each dispatched as a separate step)
    const attackPairs: Array<{
      attacker: { playerId: string; modelId: string };
      target: { playerId: string; modelId: string; appUrl: string };
    }> = [];
    for (const attacker of healthyApps) {
      for (const target of healthyApps) {
        if (attacker.playerId === target.playerId) continue;
        attackPairs.push({
          attacker: {
            playerId: attacker.playerId,
            modelId: attacker.modelId,
          },
          target: {
            playerId: target.playerId,
            modelId: target.modelId,
            appUrl: target.appUrl,
          },
        });
      }
    }

    const attackResults = await Promise.all(
      attackPairs.map(({ attacker, target }) =>
        attackPlayerApp({ matchId, attacker, target, config })
      )
    );

    // Step 4c: Update player statuses
    await completeAttackPhase(
      matchId,
      healthyApps.map((a) => a.playerId),
      attackResults
    );

    // Step 5: Scoring — tally results, update leaderboard
    const scoringResult = await scoreMatch(matchId);

    // Step 6: Cleanup — stop sandboxes, archive, notify
    await cleanupMatch(matchId);

    return {
      matchId,
      winnerId: scoringResult.winnerId,
      winnerModelId: scoringResult.winnerModelId,
      scores: scoringResult.scores,
    };
  } catch (error) {
    try {
      await failMatch(matchId);
    } catch {
      // Last resort: force-set status in DB so match isn't stuck as "LIVE"
      await forceFailMatch(matchId);
    }
    throw error;
  }
}
