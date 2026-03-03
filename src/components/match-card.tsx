import Link from "next/link";
import { ModelAvatar } from "./model-avatar";

interface MatchCardProps {
  match: {
    id: string;
    status: string;
    startedAt: string | Date | null;
    completedAt: string | Date | null;
    config: { models?: string[]; vulnerabilityCount?: number } | unknown;
    players: Array<{
      id: string;
      modelId: string;
      score: number | null;
    }>;
    winnerId: string | null;
  };
}

const STATUS_COLORS: Record<string, string> = {
  pending: "text-muted",
  building: "text-warning",
  deploying: "text-warning",
  attacking: "text-danger",
  scoring: "text-accent",
  completed: "text-accent",
  failed: "text-danger",
  cancelled: "text-muted",
};

export function MatchCard({ match }: MatchCardProps) {
  const config = match.config as { models?: string[]; vulnerabilityCount?: number };
  const startDate = match.startedAt
    ? new Date(match.startedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const winner = match.players.find((p) => p.id === match.winnerId);

  return (
    <Link href={`/matches/${match.id}`}>
      <div className="border border-card-border rounded-lg p-4 bg-card hover:border-accent/30 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-xs text-muted">
            {match.id.slice(0, 8)}
          </span>
          <span
            className={`text-xs font-medium uppercase tracking-wider ${STATUS_COLORS[match.status] || "text-muted"}`}
          >
            {match.status}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {match.players.map((player) => (
            <div
              key={player.id}
              className={`flex items-center gap-1.5 ${player.id === match.winnerId ? "ring-1 ring-accent rounded-full px-1.5 py-0.5" : ""}`}
            >
              <ModelAvatar modelId={player.modelId} size="sm" />
              <span className="text-xs font-mono tabular-nums">
                {player.score ?? 0}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted">
          <span>{startDate}</span>
          {winner && (
            <span className="text-accent">
              Winner: {winner.modelId.split("/")[1]}
            </span>
          )}
          {config?.vulnerabilityCount && (
            <span>{config.vulnerabilityCount} vulns</span>
          )}
        </div>
      </div>
    </Link>
  );
}
