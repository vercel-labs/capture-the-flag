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
        score: number;
      }>;
      for (const s of scores) {
        const p = players.get(s.playerId);
        if (p) p.score = s.score;
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

  const sorted = [...state.players.values()].sort((a, b) =>
    a.modelId.localeCompare(b.modelId),
  );
  const playerA = sorted[0];
  const playerB = sorted[1];

  if (!playerA || !playerB) {
    return null;
  }

  const stats = computeCaptureStats(state.captures, playerA.id, playerB.id);

  return (
    <div className="border border-card-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border flex items-center justify-between">
        <h3 className="font-mono text-sm font-medium">Sandbox Arena</h3>
        <span className="text-xs text-muted font-mono">
          {PHASE_LABELS[state.matchPhase] || state.matchPhase}
        </span>
      </div>

      {/* Desktop: 3-column grid */}
      <div className="hidden md:grid grid-cols-[1fr_120px_1fr] gap-0">
        <PlayerColumn
          player={playerA}
          targetModelId={playerB.modelId}
          isWinner={playerA.id === winnerId}
          isFirstBlood={playerA.id === state.firstBloodPlayerId}
          side="left"
        />
        <CenterArrows
          stats={stats}
          matchPhase={state.matchPhase}
          playerAModelId={playerA.modelId}
          playerBModelId={playerB.modelId}
        />
        <PlayerColumn
          player={playerB}
          targetModelId={playerA.modelId}
          isWinner={playerB.id === winnerId}
          isFirstBlood={playerB.id === state.firstBloodPlayerId}
          side="right"
        />
      </div>

      {/* Mobile: stacked */}
      <div className="md:hidden">
        <MobilePlayerRow
          player={playerA}
          targetModelId={playerB.modelId}
          isWinner={playerA.id === winnerId}
          isFirstBlood={playerA.id === state.firstBloodPlayerId}
          flagsCapturedAgainst={stats.aToB}
        />
        <div className="px-4 py-2 text-center font-mono text-xs text-muted border-y border-card-border/30">
          {stats.aToB} flags → ← {stats.bToA} flags
        </div>
        <MobilePlayerRow
          player={playerB}
          targetModelId={playerA.modelId}
          isWinner={playerB.id === winnerId}
          isFirstBlood={playerB.id === state.firstBloodPlayerId}
          flagsCapturedAgainst={stats.bToA}
        />
      </div>
    </div>
  );
}

// --- Sub-components ---

function PlayerColumn({
  player,
  targetModelId,
  isWinner,
  isFirstBlood,
  side,
}: {
  player: ArenaPlayer;
  targetModelId: string;
  isWinner: boolean;
  isFirstBlood: boolean;
  side: "left" | "right";
}) {
  const align = side === "left" ? "items-start text-left" : "items-end text-right";

  return (
    <div
      className={`p-4 flex flex-col gap-3 ${align} ${isWinner ? "ring-1 ring-inset ring-accent/30" : ""}`}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 ${side === "right" ? "flex-row-reverse" : ""}`}>
        <ModelAvatar modelId={player.modelId} size="lg" />
        <div>
          <div className="font-mono text-sm font-medium">{player.modelId}</div>
          <div className="font-mono text-lg font-bold tabular-nums">
            {player.score} pts
          </div>
        </div>
      </div>
      {isWinner && (
        <span className="text-xs font-mono font-medium text-accent bg-accent/10 px-2 py-0.5 rounded">
          WINNER
        </span>
      )}

      {/* Builder box */}
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

      {/* Attacker box */}
      <div className="w-full border border-danger/20 rounded p-2 space-y-1 bg-danger/5">
        <div className="text-[10px] font-mono text-danger/70 uppercase tracking-wider">
          Attacker
        </div>
        <SandboxStatus status={player.attackStatus} />
        <div className="text-[10px] text-muted">
          Target: {targetModelId}
        </div>
        <div className="text-xs font-mono tabular-nums">
          <span className="text-accent">{player.totalFlagsCaptured}</span>
          <span className="text-muted"> flag{player.totalFlagsCaptured !== 1 ? "s" : ""} captured</span>
        </div>
        {isFirstBlood && (
          <span className="text-[10px] font-mono font-medium text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
            FIRST BLOOD
          </span>
        )}
      </div>
    </div>
  );
}

function CenterArrows({
  stats,
  matchPhase,
  playerAModelId,
  playerBModelId,
}: {
  stats: { aToB: number; bToA: number };
  matchPhase: string;
  playerAModelId: string;
  playerBModelId: string;
}) {
  const isAttacking = matchPhase === "attacking";
  const strokeA = isAttacking ? "stroke-danger" : "stroke-muted/50";
  const strokeB = isAttacking ? "stroke-danger" : "stroke-muted/50";

  return (
    <div className="flex flex-col items-center justify-center py-4 border-x border-card-border/30">
      <svg
        viewBox="0 0 120 200"
        className="w-full h-40"
        aria-label={`${playerAModelId} captured ${stats.aToB} flags, ${playerBModelId} captured ${stats.bToA} flags`}
      >
        {/* A → B arrow (left attacker to right builder) */}
        <path
          d="M 10 60 C 50 60, 70 140, 110 140"
          fill="none"
          className={strokeA}
          strokeWidth="2"
          strokeDasharray={isAttacking ? "6 4" : "none"}
        >
          {isAttacking && (
            <animate
              attributeName="stroke-dashoffset"
              from="10"
              to="0"
              dur="1s"
              repeatCount="indefinite"
            />
          )}
        </path>

        {/* B → A arrow (right attacker to left builder) */}
        <path
          d="M 110 60 C 70 60, 50 140, 10 140"
          fill="none"
          className={strokeB}
          strokeWidth="2"
          strokeDasharray={isAttacking ? "6 4" : "none"}
        >
          {isAttacking && (
            <animate
              attributeName="stroke-dashoffset"
              from="10"
              to="0"
              dur="1s"
              repeatCount="indefinite"
            />
          )}
        </path>

        {/* A→B flag count badge */}
        <rect x="38" y="75" width="26" height="16" rx="4" className="fill-card" stroke="currentColor" strokeWidth="0.5" opacity="0.8" />
        <text x="51" y="87" textAnchor="middle" className="fill-accent text-[11px] font-mono">
          {stats.aToB}
        </text>

        {/* B→A flag count badge */}
        <rect x="56" y="109" width="26" height="16" rx="4" className="fill-card" stroke="currentColor" strokeWidth="0.5" opacity="0.8" />
        <text x="69" y="121" textAnchor="middle" className="fill-accent text-[11px] font-mono">
          {stats.bToA}
        </text>

        {/* VS text */}
        <text
          x="60"
          y="104"
          textAnchor="middle"
          className="fill-muted text-xs font-mono font-bold"
        >
          VS
        </text>
      </svg>
    </div>
  );
}

function MobilePlayerRow({
  player,
  targetModelId,
  isWinner,
  isFirstBlood,
  flagsCapturedAgainst,
}: {
  player: ArenaPlayer;
  targetModelId: string;
  isWinner: boolean;
  isFirstBlood: boolean;
  flagsCapturedAgainst: number;
}) {
  return (
    <div className={`p-4 ${isWinner ? "ring-1 ring-inset ring-accent/30" : ""}`}>
      <div className="flex items-center gap-3 mb-2">
        <ModelAvatar modelId={player.modelId} size="lg" />
        <div className="flex-1">
          <div className="font-mono text-sm font-medium">{player.modelId}</div>
          <div className="font-mono text-lg font-bold tabular-nums">
            {player.score} pts
          </div>
        </div>
        {isWinner && (
          <span className="text-xs font-mono font-medium text-accent bg-accent/10 px-2 py-0.5 rounded">
            WINNER
          </span>
        )}
      </div>
      <div className="flex gap-2 text-[10px] font-mono">
        <div className="flex-1 border border-card-border/50 rounded p-1.5">
          <span className="text-muted uppercase">Build:</span>{" "}
          <SandboxStatus status={player.buildStatus} />
        </div>
        <div className="flex-1 border border-danger/20 rounded p-1.5 bg-danger/5">
          <span className="text-danger/70 uppercase">Attack ({targetModelId}):</span>{" "}
          <SandboxStatus status={player.attackStatus} />
          <span className="text-accent ml-1">{flagsCapturedAgainst} flags</span>
          {isFirstBlood && (
            <span className="text-yellow-400 ml-1">FIRST BLOOD</span>
          )}
        </div>
      </div>
    </div>
  );
}
