/** @jsxImportSource chat */
import { Chat } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createRedisState } from "@chat-adapter/state-redis";
import { Modal, TextInput } from "chat";
import { start } from "workflow/api";
import { ctfMatchWorkflow } from "@/lib/workflow/ctf-match";
import { matchConfigSchema } from "@/lib/config/types";
import { DEFAULT_MATCH_CONFIG } from "@/lib/config/defaults";
import { db } from "@/lib/db/client";
import { players, leaderboardStats } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import { resumeHook } from "workflow/api";

export const bot = new Chat({
  userName: "ctf-bot",
  adapters: {
    slack: createSlackAdapter(),
  },
  state: createRedisState(),
});

// /ctf start — Opens config modal
bot.onSlashCommand("/ctf", async (event) => {
  const args = event.text?.trim() || "";

  if (args === "start --quick") {
    await handleQuickStart(event);
    return;
  }

  if (args === "start") {
    await handleStartModal(event);
    return;
  }

  if (args === "status") {
    await handleStatus(event);
    return;
  }

  if (args === "leaderboard") {
    await handleLeaderboard(event);
    return;
  }

  if (args.startsWith("stop ")) {
    const matchId = args.replace("stop ", "").trim();
    await handleStop(event, matchId);
    return;
  }

  await event.channel.post(
    "Usage: `/ctf start` | `/ctf start --quick` | `/ctf status` | `/ctf leaderboard` | `/ctf stop {matchId}`"
  );
});

async function handleStartModal(event: Parameters<Parameters<typeof bot.onSlashCommand>[1]>[0]) {
  await event.openModal(
    <Modal callbackId="ctf_start" title="Start CTF Match" submitLabel="Start Match">
      <TextInput
        id="appSpec"
        label="App Specification"
        placeholder="A Next.js ecommerce site"
        initialValue={DEFAULT_MATCH_CONFIG.appSpec}
      />
      <TextInput
        id="vulnCount"
        label="Number of Vulnerabilities (1-20)"
        placeholder="10"
        initialValue={String(DEFAULT_MATCH_CONFIG.vulnerabilityCount)}
      />
      <TextInput
        id="models"
        label="Models (comma-separated)"
        placeholder="anthropic/claude-opus-4.5, openai/gpt-5.1-codex"
        initialValue={DEFAULT_MATCH_CONFIG.models.join(", ")}
        multiline
      />
      <TextInput
        id="buildTime"
        label="Build Time Limit (seconds)"
        placeholder="600"
        initialValue={String(DEFAULT_MATCH_CONFIG.buildTimeLimitSeconds)}
      />
      <TextInput
        id="attackTime"
        label="Attack Time Limit (seconds)"
        placeholder="600"
        initialValue={String(DEFAULT_MATCH_CONFIG.attackTimeLimitSeconds)}
      />
    </Modal>
  );
}

bot.onModalSubmit("ctf_start", async (event) => {
  const { appSpec, vulnCount, models, buildTime, attackTime } = event.values;

  const config = matchConfigSchema.parse({
    appSpec: appSpec || DEFAULT_MATCH_CONFIG.appSpec,
    vulnerabilityCount: parseInt(vulnCount || "10"),
    models: (models || DEFAULT_MATCH_CONFIG.models.join(", "))
      .split(",")
      .map((m: string) => m.trim())
      .filter(Boolean),
    buildTimeLimitSeconds: parseInt(buildTime || "600"),
    attackTimeLimitSeconds: parseInt(attackTime || "600"),
  });

  if (event.relatedChannel) {
    await event.relatedChannel.post(
      `Starting CTF match with ${config.models.length} models and ${config.vulnerabilityCount} vulnerabilities...`
    );
  }

  await start(ctfMatchWorkflow, [
    {
      config,
      slackChannelId: event.relatedChannel?.id,
    },
  ]);
});

async function handleQuickStart(event: Parameters<Parameters<typeof bot.onSlashCommand>[1]>[0]) {
  await event.channel.post(
    `Starting CTF match with default settings (${DEFAULT_MATCH_CONFIG.models.length} models, ${DEFAULT_MATCH_CONFIG.vulnerabilityCount} vulnerabilities)...`
  );

  await start(ctfMatchWorkflow, [
    {
      config: DEFAULT_MATCH_CONFIG,
      slackChannelId: event.channel.id,
    },
  ]);
}

async function handleStatus(event: Parameters<Parameters<typeof bot.onSlashCommand>[1]>[0]) {
  const activeMatchIds = await redis.smembers(redisKeys.activeMatches);

  if (activeMatchIds.length === 0) {
    await event.channel.post("No active matches.");
    return;
  }

  const activeMatches = await Promise.all(
    activeMatchIds.map(async (matchId) => {
      const status = await redis.get(redisKeys.matchStatus(matchId));
      const matchPlayers = await db
        .select({ modelId: players.modelId, score: players.score })
        .from(players)
        .where(eq(players.matchId, matchId));
      return { matchId, status, players: matchPlayers };
    })
  );

  const lines = activeMatches.map((m) => {
    const playerScores = m.players
      .map((p) => `${p.modelId}: ${p.score ?? 0}pts`)
      .join(", ");
    return `**${m.matchId.slice(0, 8)}** — Phase: ${m.status} | ${playerScores}`;
  });

  await event.channel.post(
    `**Active Matches (${activeMatches.length}):**\n${lines.join("\n")}`
  );
}

async function handleLeaderboard(event: Parameters<Parameters<typeof bot.onSlashCommand>[1]>[0]) {
  const stats = await db
    .select()
    .from(leaderboardStats)
    .orderBy(desc(leaderboardStats.totalPoints))
    .limit(10);

  if (stats.length === 0) {
    await event.channel.post("No leaderboard data yet. Start a match with `/ctf start`!");
    return;
  }

  const lines = stats.map(
    (s, i) =>
      `${i + 1}. **${s.modelId}** — ${s.totalPoints ?? 0}pts | ${s.totalWins ?? 0}W/${s.totalMatches ?? 0}M | ${((s.winRate ?? 0) * 100).toFixed(0)}% WR`
  );

  await event.channel.post(`**Leaderboard (Top 10):**\n${lines.join("\n")}`);
}

async function handleStop(event: Parameters<Parameters<typeof bot.onSlashCommand>[1]>[0], matchId: string) {
  const activeMatchIds = await redis.smembers(redisKeys.activeMatches);
  if (!activeMatchIds.includes(matchId)) {
    await event.channel.post(`Match ${matchId.slice(0, 8)} is not active.`);
    return;
  }

  await event.channel.post(
    `Stopping match ${matchId.slice(0, 8)}...`
  );

  await resumeHook(`ctf-stop:${matchId}`, { reason: "Manually stopped via Slack" });
}
