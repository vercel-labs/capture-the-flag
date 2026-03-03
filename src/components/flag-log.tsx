import { ModelAvatar } from "./model-avatar";

interface FlagCapture {
  id: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  submittedFlag: string;
  isValid: boolean;
  pointsAwarded: number | null;
  method: string | null;
  capturedAt: string | Date | null;
}

interface Player {
  id: string;
  modelId: string;
}

export function FlagLog({
  captures,
  players,
}: {
  captures: FlagCapture[];
  players: Player[];
}) {
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const validCaptures = captures.filter((c) => c.isValid);

  return (
    <div className="border border-card-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border flex items-center justify-between">
        <h3 className="font-mono text-sm font-medium">Flag Captures</h3>
        <span className="text-xs text-accent">
          {validCaptures.length} captured
        </span>
      </div>
      <div className="divide-y divide-card-border/30">
        {captures.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted text-sm">
            No flag submissions yet.
          </div>
        ) : (
          captures.map((capture) => {
            const attacker = playerMap.get(capture.attackerPlayerId);
            const defender = playerMap.get(capture.defenderPlayerId);

            return (
              <div
                key={capture.id}
                className={`px-4 py-2 flex items-center gap-3 ${capture.isValid ? "" : "opacity-50"}`}
              >
                {attacker && (
                  <ModelAvatar modelId={attacker.modelId} size="sm" />
                )}
                <span className="text-xs text-muted">-&gt;</span>
                {defender && (
                  <ModelAvatar modelId={defender.modelId} size="sm" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs truncate">
                    {capture.submittedFlag}
                  </div>
                  {capture.method && (
                    <div className="text-[10px] text-muted truncate">
                      {capture.method}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {capture.isValid ? (
                    <span className="text-accent text-xs font-mono">
                      +{capture.pointsAwarded ?? 0}
                    </span>
                  ) : (
                    <span className="text-danger text-xs font-mono">
                      invalid
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
