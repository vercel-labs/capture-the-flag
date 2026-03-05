import { db } from "@/lib/db/client";
import { matches, players, flagCaptures, matchEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { MatchScoreboard } from "@/components/match-scoreboard";
import { MatchTimeline } from "@/components/match-timeline";
import { FlagLog } from "@/components/flag-log";
import { SandboxArena } from "@/components/sandbox-arena";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  building: "Building Apps",
  deploying: "Deploying",
  attacking: "Attack Phase",
  scoring: "Scoring",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));

  if (!match) {
    notFound();
  }

  const matchPlayers = await db
    .select()
    .from(players)
    .where(eq(players.matchId, matchId));

  const captures = await db
    .select()
    .from(flagCaptures)
    .where(eq(flagCaptures.matchId, matchId));

  const events = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.matchId, matchId));

  const config = match.config as {
    appSpec?: string;
    vulnerabilityCount?: number;
    buildTimeLimitSeconds?: number;
    attackTimeLimitSeconds?: number;
  } | null;
  const isActive = ["building", "deploying", "attacking", "scoring"].includes(
    match.status
  );

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-mono">
              Match {matchId.slice(0, 8)}
            </h1>
            <p className="text-muted text-sm mt-1">
              {STATUS_LABELS[match.status] || match.status}
              {match.startedAt &&
                ` — Started ${new Date(match.startedAt).toLocaleString()}`}
            </p>
          </div>
          {isActive && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-xs text-accent font-mono">LIVE</span>
            </div>
          )}
        </div>

        {config && (
          <div className="mt-4 flex gap-4 text-xs text-muted font-mono">
            {config.appSpec && <span>App: {String(config.appSpec)}</span>}
            {config.vulnerabilityCount && (
              <span>Vulns: {String(config.vulnerabilityCount)}</span>
            )}
            {config.buildTimeLimitSeconds && (
              <span>Build: {String(config.buildTimeLimitSeconds)}s</span>
            )}
            {config.attackTimeLimitSeconds && (
              <span>Attack: {String(config.attackTimeLimitSeconds)}s</span>
            )}
          </div>
        )}
      </div>

      <div className="mb-6">
        <SandboxArena
          matchId={matchId}
          matchStatus={match.status}
          winnerId={match.winnerId}
          initialPlayers={matchPlayers.map((p) => ({
            id: p.id,
            modelId: p.modelId,
            buildStatus: p.buildStatus ?? "pending",
            attackStatus: p.attackStatus ?? "pending",
            appUrl: p.appUrl,
            score: p.score ?? 0,
            totalFlagsCaptured: p.totalFlagsCaptured ?? 0,
            totalFlagsLost: p.totalFlagsLost ?? 0,
          }))}
          initialCaptures={captures.map((c) => ({
            id: c.id,
            attackerPlayerId: c.attackerPlayerId,
            defenderPlayerId: c.defenderPlayerId,
            isValid: c.isValid,
            pointsAwarded: c.pointsAwarded,
            capturedAt: c.capturedAt?.toISOString() ?? null,
          }))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <MatchScoreboard
            players={matchPlayers}
            winnerId={match.winnerId}
          />
          <FlagLog
            captures={captures.map((c) => ({
              ...c,
              capturedAt: c.capturedAt?.toISOString() ?? null,
            }))}
            players={matchPlayers.map((p) => ({
              id: p.id,
              modelId: p.modelId,
            }))}
          />
        </div>
        <div>
          <MatchTimeline
            matchId={matchId}
            initialEvents={events.map((e) => ({
              eventType: e.eventType,
              playerId: e.playerId ?? undefined,
              payload: (e.payload as Record<string, unknown>) ?? undefined,
              timestamp: e.createdAt?.toISOString(),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
