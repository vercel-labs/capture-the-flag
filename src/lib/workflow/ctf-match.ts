import { createHook } from "workflow";
import { FatalError } from "workflow";
import { setupMatch } from "./steps/setup";
import { buildAllApps } from "./steps/build";
import { verifyDeployments } from "./steps/deploy";
import { runAttackPhase } from "./steps/attack";
import { scoreMatch } from "./steps/scoring";
import { cleanupMatch } from "./steps/cleanup";
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

  // Step 2: Build — each model builds an app in a sandbox (parallel)
  const buildResults = await buildAllApps(
    matchId,
    playerIds,
    config.models,
    config
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

  // Step 4: Attack — models attack each other's apps
  await runAttackPhase({
    matchId,
    config,
    playerApps: healthyApps,
  });

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
}
