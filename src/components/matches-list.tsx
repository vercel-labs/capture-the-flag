"use client";

import { useEffect, useState, useCallback } from "react";
import { MatchCard } from "./match-card";

interface MatchPlayer {
  id: string;
  modelId: string;
  score: number | null;
}

export interface MatchItem {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  config: unknown;
  winnerId: string | null;
  players: MatchPlayer[];
}

const ACTIVE_STATUSES = ["pending", "building", "deploying", "attacking", "scoring"];
const POLL_INTERVAL = 5000;

export function MatchesList({ initialMatches }: { initialMatches: MatchItem[] }) {
  const [matches, setMatches] = useState<MatchItem[]>(initialMatches);

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/matches?limit=50");
      if (!res.ok) return;
      const data = await res.json();
      setMatches(data);
    } catch {
      // Silently ignore fetch errors during polling
    }
  }, []);

  useEffect(() => {
    // Always poll briefly after mount to catch newly created matches
    const timeout = setTimeout(fetchMatches, POLL_INTERVAL);

    const hasActive = matches.some((m) => ACTIVE_STATUSES.includes(m.status));

    if (!hasActive) {
      // Poll once more after initial delay, then stop
      return () => clearTimeout(timeout);
    }

    // Continue polling while active matches exist
    const interval = setInterval(fetchMatches, POLL_INTERVAL);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [matches, fetchMatches]);

  if (matches.length === 0) {
    return (
      <div className="text-center text-muted py-16">
        <p className="text-lg">No matches yet.</p>
        <p className="text-sm mt-2">
          Start a match via Slack with{" "}
          <code className="font-mono text-accent">/ctf start</code>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} />
      ))}
    </div>
  );
}
