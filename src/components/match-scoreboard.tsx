import { ModelAvatar } from "./model-avatar";

interface Player {
  id: string;
  modelId: string;
  score: number | null;
  totalFlagsCaptured: number | null;
  totalFlagsLost: number | null;
  buildStatus: string | null;
  attackStatus: string | null;
}

export function MatchScoreboard({
  players,
  winnerId,
}: {
  players: Player[];
  winnerId: string | null;
}) {
  const sorted = [...players].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0)
  );

  return (
    <div className="border border-card-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border">
        <h3 className="font-mono text-sm font-medium">Scoreboard</h3>
      </div>
      <div className="divide-y divide-card-border/50">
        {sorted.map((player, i) => (
          <div
            key={player.id}
            className={`px-4 py-3 flex items-center justify-between ${player.id === winnerId ? "bg-success/5" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-muted text-sm w-4">
                {i + 1}
              </span>
              <ModelAvatar modelId={player.modelId} />
              <div>
                <div className="font-mono text-sm">{player.modelId}</div>
                <div className="text-xs text-muted">
                  Build: {player.buildStatus} | Attack:{" "}
                  {player.attackStatus}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm tabular-nums">
              <div className="text-center">
                <div className="text-success">{player.totalFlagsCaptured ?? 0}</div>
                <div className="text-[10px] text-muted">captured</div>
              </div>
              <div className="text-center">
                <div className="text-danger">{player.totalFlagsLost ?? 0}</div>
                <div className="text-[10px] text-muted">lost</div>
              </div>
              <div className="text-center min-w-[48px]">
                <div className="font-bold text-lg">{player.score ?? 0}</div>
                <div className="text-[10px] text-muted">pts</div>
              </div>
              {player.id === winnerId && (
                <span className="text-success text-xs font-medium">WINNER</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
