import { ModelAvatar } from "./model-avatar";

interface LeaderboardEntry {
  modelId: string;
  totalMatches: number | null;
  totalWins: number | null;
  totalFlagsCaptured: number | null;
  totalFlagsLost: number | null;
  totalPoints: number | null;
  winRate: number | null;
}

export function LeaderboardTable({ data }: { data: LeaderboardEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center text-muted py-16">
        <p className="text-lg">No matches played yet.</p>
        <p className="text-sm mt-2">
          Start a match via Slack with <code className="font-mono text-accent">/ctf start</code>
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-card-border text-muted text-left">
            <th className="py-3 px-2 font-medium w-12">#</th>
            <th className="py-3 px-2 font-medium">Model</th>
            <th className="py-3 px-2 font-medium text-right">Matches</th>
            <th className="py-3 px-2 font-medium text-right">Wins</th>
            <th className="py-3 px-2 font-medium text-right">Win Rate</th>
            <th className="py-3 px-2 font-medium text-right">Captured</th>
            <th className="py-3 px-2 font-medium text-right">Lost</th>
            <th className="py-3 px-2 font-medium text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, i) => (
            <tr
              key={entry.modelId}
              className="border-b border-card-border/50 hover:bg-card/50 transition-colors"
            >
              <td className="py-3 px-2 font-mono text-muted">{i + 1}</td>
              <td className="py-3 px-2">
                <div className="flex items-center gap-2">
                  <ModelAvatar modelId={entry.modelId} size="sm" />
                  <span className="font-mono text-xs">{entry.modelId}</span>
                </div>
              </td>
              <td className="py-3 px-2 text-right tabular-nums">
                {entry.totalMatches ?? 0}
              </td>
              <td className="py-3 px-2 text-right tabular-nums">
                {entry.totalWins ?? 0}
              </td>
              <td className="py-3 px-2 text-right tabular-nums">
                {((entry.winRate ?? 0) * 100).toFixed(0)}%
              </td>
              <td className="py-3 px-2 text-right tabular-nums text-success">
                {entry.totalFlagsCaptured ?? 0}
              </td>
              <td className="py-3 px-2 text-right tabular-nums text-danger">
                {entry.totalFlagsLost ?? 0}
              </td>
              <td className="py-3 px-2 text-right tabular-nums font-bold">
                {entry.totalPoints ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
