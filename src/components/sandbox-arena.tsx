"use client";

import { useEffect, useState } from "react";
import { ModelAvatar } from "./model-avatar";
import { SandboxStatus } from "./sandbox-status";

// --- Types ---

export interface ArenaPlayer {
  id: string;
  modelId: string;
  buildStatus: string;
  attackStatus: string;
  appUrl: string | null;
  score: number;
  totalFlagsCaptured: number;
  totalFlagsLost: number;
}

export interface ArenaCapture {
  id: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  isValid: boolean;
  pointsAwarded: number | null;
  capturedAt: string | null;
}

interface ArenaEvent {
  eventType: string;
  playerId?: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

export interface ArenaState {
  players: Map<string, ArenaPlayer>;
  captures: ArenaCapture[];
  firstBloodPlayerId: string | null;
  matchPhase: string;
}

// --- Pure functions ---

export function initArenaState(
  initialPlayers: ArenaPlayer[],
  initialCaptures: ArenaCapture[],
  matchStatus: string,
): ArenaState {
  const players = new Map<string, ArenaPlayer>();
  for (const p of initialPlayers) {
    players.set(p.id, { ...p });
  }

  let firstBloodPlayerId: string | null = null;
  const validCaptures = initialCaptures.filter((c) => c.isValid);
  if (validCaptures.length > 0) {
    const sorted = [...validCaptures].sort((a, b) => {
      if (!a.capturedAt || !b.capturedAt) return 0;
      return new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
    });
    firstBloodPlayerId = sorted[0].attackerPlayerId;
  }

  return {
    players,
    captures: [...initialCaptures],
    firstBloodPlayerId,
    matchPhase: matchStatus,
  };
}

export function applyEvent(state: ArenaState, event: ArenaEvent): ArenaState {
  const players = new Map(
    Array.from(state.players.entries()).map(([k, v]) => [k, { ...v }]),
  );
  const captures = [...state.captures];
  let { firstBloodPlayerId, matchPhase } = state;

  switch (event.eventType) {
    case "build_started": {
      const p = event.playerId ? players.get(event.playerId) : undefined;
      if (p) p.buildStatus = "building";
      break;
    }
    case "build_completed": {
      const p = event.playerId ? players.get(event.playerId) : undefined;
      if (p) {
        p.buildStatus = "completed";
        if (event.payload?.appUrl) {
          p.appUrl = event.payload.appUrl as string;
        }
      }
      break;
    }
    case "build_failed": {
      const p = event.playerId ? players.get(event.playerId) : undefined;
      if (p) p.buildStatus = "failed";
      break;
    }
    case "deploy_started": {
      matchPhase = "deploying";
      for (const p of players.values()) {
        if (p.buildStatus === "completed") p.buildStatus = "deploying";
      }
      break;
    }
    case "deploy_completed": {
      matchPhase = "deploying";
      const results = (event.payload?.results ?? []) as Array<{
        playerId: string;
        healthy: boolean;
        appUrl?: string;
      }>;
      for (const r of results) {
        const p = players.get(r.playerId);
        if (p) {
          p.buildStatus = r.healthy ? "live" : "failed";
          if (r.appUrl) p.appUrl = r.appUrl;
        }
      }
      break;
    }
    case "deploy_failed": {
      matchPhase = "deploying";
      const results = (event.payload?.results ?? []) as Array<{
        playerId: string;
        healthy: boolean;
      }>;
      for (const r of results) {
        const p = players.get(r.playerId);
        if (p) {
          p.buildStatus = r.healthy ? "live" : "failed";
        }
      }
      break;
    }
    case "attack_started": {
      matchPhase = "attacking";
      for (const p of players.values()) {
        p.attackStatus = "attacking";
      }
      break;
    }
    case "flag_captured": {
      const attackerId = event.playerId;
      const defenderId = event.payload?.defenderPlayerId as string | undefined;
      const isValid = (event.payload?.isValid as boolean) ?? true;
      const pointsAwarded = (event.payload?.pointsAwarded as number) ?? 0;
      const captureId =
        (event.payload?.captureId as string) ?? `capture-${captures.length}`;

      captures.push({
        id: captureId,
        attackerPlayerId: attackerId ?? "",
        defenderPlayerId: defenderId ?? "",
        isValid,
        pointsAwarded,
        capturedAt: event.timestamp ?? null,
      });

      if (isValid && attackerId) {
        const attacker = players.get(attackerId);
        if (attacker) attacker.totalFlagsCaptured += 1;
        if (defenderId) {
          const defender = players.get(defenderId);
          if (defender) defender.totalFlagsLost += 1;
        }
      }
      break;
    }
    case "first_blood": {
      if (event.playerId) {
        firstBloodPlayerId = event.playerId;
      }
      break;
    }
    case "attack_completed": {
      for (const p of players.values()) {
        p.attackStatus = "completed";
      }
      break;
    }
    case "scoring_completed": {
      const scores = (event.payload?.scores ?? []) as Array<{
        playerId: string;
        score?: number;
        totalScore?: number;
      }>;
      for (const s of scores) {
        const p = players.get(s.playerId);
        if (p) p.score = s.score ?? s.totalScore ?? 0;
      }
      break;
    }
    case "match_completed": {
      matchPhase = "completed";
      break;
    }
    case "match_failed": {
      matchPhase = "failed";
      break;
    }
  }

  return { players, captures, firstBloodPlayerId, matchPhase };
}

export function computeCaptureStats(
  captures: ArenaCapture[],
  playerAId: string,
  playerBId: string,
): { aToB: number; bToA: number } {
  let aToB = 0;
  let bToA = 0;
  for (const c of captures) {
    if (!c.isValid) continue;
    if (c.attackerPlayerId === playerAId && c.defenderPlayerId === playerBId) {
      aToB++;
    } else if (
      c.attackerPlayerId === playerBId &&
      c.defenderPlayerId === playerAId
    ) {
      bToA++;
    }
  }
  return { aToB, bToA };
}

export interface PlayerCaptureStats {
  totalCaptured: number;
  totalLost: number;
  capturedByOpponent: Map<string, number>;
}

export function computePlayerStats(
  captures: ArenaCapture[],
  playerId: string,
): PlayerCaptureStats {
  let totalCaptured = 0;
  let totalLost = 0;
  const capturedByOpponent = new Map<string, number>();

  for (const c of captures) {
    if (!c.isValid) continue;
    if (c.attackerPlayerId === playerId) {
      totalCaptured++;
      const prev = capturedByOpponent.get(c.defenderPlayerId) ?? 0;
      capturedByOpponent.set(c.defenderPlayerId, prev + 1);
    } else if (c.defenderPlayerId === playerId) {
      totalLost++;
    }
  }

  return { totalCaptured, totalLost, capturedByOpponent };
}

// --- Component ---

interface SandboxArenaProps {
  matchId: string;
  matchStatus: string;
  winnerId: string | null;
  initialPlayers: ArenaPlayer[];
  initialCaptures: ArenaCapture[];
}

const PHASE_LABELS: Record<string, string> = {
  pending: "Waiting",
  building: "Building",
  deploying: "Deploying",
  attacking: "Attacking",
  scoring: "Scoring",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function SandboxArena({
  matchId,
  matchStatus,
  winnerId,
  initialPlayers,
  initialCaptures,
}: SandboxArenaProps) {
  const [state, setState] = useState<ArenaState>(() =>
    initArenaState(initialPlayers, initialCaptures, matchStatus),
  );

  useEffect(() => {
    const eventSource = new EventSource(`/api/matches/${matchId}/events`);

    eventSource.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as ArenaEvent;
        if (event.eventType === "stream_end") {
          eventSource.close();
          return;
        }
        setState((prev) => applyEvent(prev, event));
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [matchId]);

  const playerCount = state.players.size;

  const sorted = [...state.players.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.modelId.localeCompare(b.modelId);
  });

  if (sorted.length < 2) {
    return null;
  }

  const allPlayers = new Map(
    sorted.map((p) => [p.id, p.modelId]),
  );

  const showOpponentBreakdown = playerCount <= 6;

  return (
    <div className="border border-card-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border flex items-center justify-between">
        <h3 className="font-mono text-sm font-medium">
          Sandbox Arena
          <span className="text-muted ml-2 font-normal">
            {playerCount} players
          </span>
        </h3>
        <span className="text-xs text-muted font-mono">
          {PHASE_LABELS[state.matchPhase] || state.matchPhase}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-card-border/30">
        {sorted.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            captures={state.captures}
            isWinner={player.id === winnerId}
            isFirstBlood={player.id === state.firstBloodPlayerId}
            allPlayers={allPlayers}
            showOpponentBreakdown={showOpponentBreakdown}
          />
        ))}
      </div>
    </div>
  );
}

// --- Sub-components ---

function PlayerCard({
  player,
  captures,
  isWinner,
  isFirstBlood,
  allPlayers,
  showOpponentBreakdown,
}: {
  player: ArenaPlayer;
  captures: ArenaCapture[];
  isWinner: boolean;
  isFirstBlood: boolean;
  allPlayers: Map<string, string>;
  showOpponentBreakdown: boolean;
}) {
  const stats = computePlayerStats(captures, player.id);

  return (
    <div
      className={`p-4 flex flex-col gap-3 bg-card ${isWinner ? "ring-1 ring-inset ring-accent/30" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <ModelAvatar modelId={player.modelId} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm font-medium truncate">{player.modelId}</div>
          <div className="font-mono text-lg font-bold tabular-nums">
            {player.score} pts
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {isWinner && (
          <span className="text-xs font-mono font-medium text-accent bg-accent/10 px-2 py-0.5 rounded">
            WINNER
          </span>
        )}
        {isFirstBlood && (
          <span className="text-[10px] font-mono font-medium text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
            FIRST BLOOD
          </span>
        )}
      </div>

      {/* Build status box */}
      <div className="w-full border border-card-border/50 rounded p-2 space-y-1">
        <div className="text-[10px] font-mono text-muted uppercase tracking-wider">
          App Sandbox
        </div>
        <SandboxStatus status={player.buildStatus} />
        {player.appUrl && (
          <div className="text-[10px] text-muted truncate" title={player.appUrl}>
            {player.appUrl}
          </div>
        )}
      </div>

      {/* Attack status box */}
      <div className="w-full border border-danger/20 rounded p-2 space-y-1 bg-danger/5">
        <div className="text-[10px] font-mono text-danger/70 uppercase tracking-wider">
          Attacker
        </div>
        <SandboxStatus status={player.attackStatus} />
        <div className="text-xs font-mono tabular-nums">
          <span className="text-accent">{stats.totalCaptured}</span>
          <span className="text-muted"> captured</span>
          <span className="text-muted mx-1">/</span>
          <span className="text-danger">{stats.totalLost}</span>
          <span className="text-muted"> lost</span>
        </div>

        {showOpponentBreakdown && stats.capturedByOpponent.size > 0 && (
          <div className="space-y-0.5 pt-1 border-t border-danger/10">
            {[...stats.capturedByOpponent.entries()].map(([opponentId, count]) => (
              <div key={opponentId} className="text-[10px] text-muted truncate">
                <span className="text-accent">{count}</span>
                {" vs "}
                <span className="font-medium">{allPlayers.get(opponentId) ?? opponentId}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
