import { db } from "@/lib/db/client";
import { matches, players, flagCaptures, matchEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { MatchScoreboard } from "@/components/match-scoreboard";
import { MatchTimeline } from "@/components/match-timeline";
import { FlagLog } from "@/components/flag-log";

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

  const config = match.config as Record<string, unknown>;
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
