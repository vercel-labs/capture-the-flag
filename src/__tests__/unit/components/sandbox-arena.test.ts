import { describe, it, expect } from "vitest";
import {
  initArenaState,
  applyEvent,
  computeCaptureStats,
  computePlayerStats,
  type ArenaPlayer,
  type ArenaCapture,
  type ArenaState,
  // PlayerCaptureStats used via type inference in tests
} from "@/components/sandbox-arena";

// --- Helpers ---

function makePlayer(overrides: Partial<ArenaPlayer> = {}): ArenaPlayer {
  return {
    id: "p1",
    modelId: "anthropic/claude-sonnet-4",
    buildStatus: "pending",
    attackStatus: "pending",
    appUrl: null,
    sandboxId: null,
    score: 0,
    totalFlagsCaptured: 0,
    totalFlagsLost: 0,
    ...overrides,
  };
}

function makeCapture(overrides: Partial<ArenaCapture> = {}): ArenaCapture {
  return {
    id: "c1",
    attackerPlayerId: "p1",
    defenderPlayerId: "p2",
    isValid: true,
    pointsAwarded: 100,
    capturedAt: "2026-01-01T00:00:01Z",
    ...overrides,
  };
}

function twoPlayerState(
  overrides: Partial<ArenaState> = {},
): ArenaState {
  const players = new Map<string, ArenaPlayer>([
    ["p1", makePlayer({ id: "p1", modelId: "anthropic/claude-sonnet-4" })],
    ["p2", makePlayer({ id: "p2", modelId: "openai/gpt-4.1" })],
  ]);
  return {
    players,
    captures: [],
    firstBloodPlayerId: null,
    matchPhase: "pending",
    ...overrides,
  };
}

function nPlayerState(n: number): ArenaState {
  const modelIds = [
    "anthropic/claude-sonnet-4",
    "openai/gpt-4.1",
    "google/gemini-2.5-pro",
    "xai/grok-4",
    "mistral/devstral-2",
    "deepseek/deepseek-v3.2",
    "meta/llama-4-maverick",
  ];
  const players = new Map<string, ArenaPlayer>();
  for (let i = 0; i < n; i++) {
    const id = `p${i + 1}`;
    players.set(
      id,
      makePlayer({
        id,
        modelId: modelIds[i % modelIds.length],
      }),
    );
  }
  return {
    players,
    captures: [],
    firstBloodPlayerId: null,
    matchPhase: "pending",
  };
}

// --- initArenaState ---

describe("initArenaState", () => {
  it("creates state from players and empty captures", () => {
    const players = [
      makePlayer({ id: "p1" }),
      makePlayer({ id: "p2", modelId: "openai/gpt-4.1" }),
    ];
    const state = initArenaState(players, [], "pending");

    expect(state.players.size).toBe(2);
    expect(state.captures).toHaveLength(0);
    expect(state.firstBloodPlayerId).toBeNull();
    expect(state.matchPhase).toBe("pending");
  });

  it("detects first blood from earliest valid capture", () => {
    const players = [
      makePlayer({ id: "p1" }),
      makePlayer({ id: "p2", modelId: "openai/gpt-4.1" }),
    ];
    const captures = [
      makeCapture({
        id: "c2",
        attackerPlayerId: "p2",
        capturedAt: "2026-01-01T00:00:05Z",
      }),
      makeCapture({
        id: "c1",
        attackerPlayerId: "p1",
        capturedAt: "2026-01-01T00:00:01Z",
      }),
    ];

    const state = initArenaState(players, captures, "attacking");
    expect(state.firstBloodPlayerId).toBe("p1");
  });

  it("handles empty captures correctly", () => {
    const state = initArenaState([], [], "building");
    expect(state.players.size).toBe(0);
    expect(state.firstBloodPlayerId).toBeNull();
    expect(state.matchPhase).toBe("building");
  });

  it("preserves attackStatus from DB", () => {
    const players = [
      makePlayer({ id: "p1", attackStatus: "attacking" }),
      makePlayer({ id: "p2", modelId: "openai/gpt-4.1", attackStatus: "attacking" }),
    ];
    const state = initArenaState(players, [], "attacking");

    expect(state.players.get("p1")!.attackStatus).toBe("attacking");
    expect(state.players.get("p2")!.attackStatus).toBe("attacking");
  });

  it("uses match status as initial phase", () => {
    const state = initArenaState(
      [makePlayer()],
      [],
      "completed",
    );
    expect(state.matchPhase).toBe("completed");
  });

  it("handles 5 players", () => {
    const players = Array.from({ length: 5 }, (_, i) =>
      makePlayer({ id: `p${i + 1}`, modelId: `model-${i + 1}` }),
    );
    const state = initArenaState(players, [], "pending");

    expect(state.players.size).toBe(5);
    for (let i = 1; i <= 5; i++) {
      expect(state.players.get(`p${i}`)!.modelId).toBe(`model-${i}`);
    }
  });
});

// --- applyEvent ---

describe("applyEvent", () => {
  it("build_started sets player buildStatus to building", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, {
      eventType: "build_started",
      playerId: "p1",
    });

    expect(next.players.get("p1")!.buildStatus).toBe("building");
    expect(next.players.get("p2")!.buildStatus).toBe("pending");
  });

  it("build_completed sets buildStatus and appUrl", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, {
      eventType: "build_completed",
      playerId: "p1",
      payload: { appUrl: "https://app1.vercel.app" },
    });

    expect(next.players.get("p1")!.buildStatus).toBe("completed");
    expect(next.players.get("p1")!.appUrl).toBe("https://app1.vercel.app");
  });

  it("build_completed extracts sandboxId from payload", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, {
      eventType: "build_completed",
      playerId: "p1",
      payload: { appUrl: "https://app1.vercel.app", sandboxId: "sbx_abc123" },
    });

    expect(next.players.get("p1")!.sandboxId).toBe("sbx_abc123");
  });

  it("build_completed without sandboxId leaves it unchanged", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, {
      eventType: "build_completed",
      playerId: "p1",
      payload: { appUrl: "https://app1.vercel.app" },
    });

    expect(next.players.get("p1")!.sandboxId).toBeNull();
  });

  it("build_failed sets buildStatus to failed", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, {
      eventType: "build_failed",
      playerId: "p1",
    });

    expect(next.players.get("p1")!.buildStatus).toBe("failed");
  });

  it("deploy_started sets matchPhase and deploying status", () => {
    const initial = twoPlayerState();
    initial.players.get("p1")!.buildStatus = "completed";
    initial.players.get("p2")!.buildStatus = "completed";

    const next = applyEvent(initial, { eventType: "deploy_started" });

    expect(next.matchPhase).toBe("deploying");
    expect(next.players.get("p1")!.buildStatus).toBe("deploying");
    expect(next.players.get("p2")!.buildStatus).toBe("deploying");
  });

  it("deploy_started only updates completed builds", () => {
    const initial = twoPlayerState();
    initial.players.get("p1")!.buildStatus = "completed";
    initial.players.get("p2")!.buildStatus = "failed";

    const next = applyEvent(initial, { eventType: "deploy_started" });

    expect(next.players.get("p1")!.buildStatus).toBe("deploying");
    expect(next.players.get("p2")!.buildStatus).toBe("failed");
  });

  it("deploy_completed marks players live or failed using results", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, {
      eventType: "deploy_completed",
      payload: {
        results: [
          { playerId: "p1", healthy: true, appUrl: "https://app1.vercel.app" },
          { playerId: "p2", healthy: false },
        ],
      },
    });

    expect(next.players.get("p1")!.buildStatus).toBe("live");
    expect(next.players.get("p1")!.appUrl).toBe("https://app1.vercel.app");
    expect(next.players.get("p2")!.buildStatus).toBe("failed");
  });

  it("full build→deploy lifecycle transitions completed→deploying→live", () => {
    let state = twoPlayerState();

    // Build completed
    state = applyEvent(state, {
      eventType: "build_completed",
      playerId: "p1",
      payload: { appUrl: "https://app1.vercel.app" },
    });
    state = applyEvent(state, {
      eventType: "build_completed",
      playerId: "p2",
      payload: { appUrl: "https://app2.vercel.app" },
    });
    expect(state.players.get("p1")!.buildStatus).toBe("completed");
    expect(state.players.get("p2")!.buildStatus).toBe("completed");

    // Deploy started
    state = applyEvent(state, { eventType: "deploy_started" });
    expect(state.players.get("p1")!.buildStatus).toBe("deploying");
    expect(state.players.get("p2")!.buildStatus).toBe("deploying");

    // Deploy completed with playerId and appUrl in results
    state = applyEvent(state, {
      eventType: "deploy_completed",
      payload: {
        results: [
          { playerId: "p1", healthy: true, appUrl: "https://app1.vercel.app" },
          { playerId: "p2", healthy: true, appUrl: "https://app2.vercel.app" },
        ],
      },
    });
    expect(state.players.get("p1")!.buildStatus).toBe("live");
    expect(state.players.get("p2")!.buildStatus).toBe("live");
  });

  it("deploy_failed marks unhealthy players as failed", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, {
      eventType: "deploy_failed",
      payload: {
        results: [
          { playerId: "p1", healthy: false },
          { playerId: "p2", healthy: true },
        ],
      },
    });

    expect(next.players.get("p1")!.buildStatus).toBe("failed");
    expect(next.players.get("p2")!.buildStatus).toBe("live");
  });

  it("attack_started sets matchPhase and all players to attacking", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, { eventType: "attack_started" });

    expect(next.matchPhase).toBe("attacking");
    expect(next.players.get("p1")!.attackStatus).toBe("attacking");
    expect(next.players.get("p2")!.attackStatus).toBe("attacking");
  });

  it("flag_captured appends capture and increments counts", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, {
      eventType: "flag_captured",
      playerId: "p1",
      payload: {
        defenderPlayerId: "p2",
        isValid: true,
        pointsAwarded: 100,
        captureId: "cap-1",
      },
      timestamp: "2026-01-01T00:01:00Z",
    });

    expect(next.captures).toHaveLength(1);
    expect(next.captures[0].attackerPlayerId).toBe("p1");
    expect(next.captures[0].defenderPlayerId).toBe("p2");
    expect(next.players.get("p1")!.totalFlagsCaptured).toBe(1);
    expect(next.players.get("p2")!.totalFlagsLost).toBe(1);
  });

  it("flag_captured with isValid=false does not increment counts", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, {
      eventType: "flag_captured",
      playerId: "p1",
      payload: {
        defenderPlayerId: "p2",
        isValid: false,
        pointsAwarded: 0,
      },
    });

    expect(next.captures).toHaveLength(1);
    expect(next.players.get("p1")!.totalFlagsCaptured).toBe(0);
    expect(next.players.get("p2")!.totalFlagsLost).toBe(0);
  });

  it("first_blood sets firstBloodPlayerId", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, {
      eventType: "first_blood",
      playerId: "p1",
    });

    expect(next.firstBloodPlayerId).toBe("p1");
  });

  it("attack_completed sets all players attackStatus to completed", () => {
    const state = twoPlayerState();
    state.players.get("p1")!.attackStatus = "attacking";
    state.players.get("p2")!.attackStatus = "attacking";

    const next = applyEvent(state, { eventType: "attack_completed" });

    expect(next.players.get("p1")!.attackStatus).toBe("completed");
    expect(next.players.get("p2")!.attackStatus).toBe("completed");
  });

  it("scoring_completed updates player scores from payload", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, {
      eventType: "scoring_completed",
      payload: {
        scores: [
          { playerId: "p1", score: 450 },
          { playerId: "p2", score: 300 },
        ],
      },
    });

    expect(next.players.get("p1")!.score).toBe(450);
    expect(next.players.get("p2")!.score).toBe(300);
  });

  it("scoring_completed supports totalScore key as alias", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, {
      eventType: "scoring_completed",
      payload: {
        scores: [
          { playerId: "p1", totalScore: 550 },
          { playerId: "p2", totalScore: 200 },
        ],
      },
    });

    expect(next.players.get("p1")!.score).toBe(550);
    expect(next.players.get("p2")!.score).toBe(200);
  });

  it("match_completed sets matchPhase to completed", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, { eventType: "match_completed" });
    expect(next.matchPhase).toBe("completed");
  });

  it("match_completed sets live players buildStatus to shutdown", () => {
    const state = twoPlayerState();
    state.players.get("p1")!.buildStatus = "live";
    state.players.get("p2")!.buildStatus = "live";

    const next = applyEvent(state, { eventType: "match_completed" });

    expect(next.players.get("p1")!.buildStatus).toBe("shutdown");
    expect(next.players.get("p2")!.buildStatus).toBe("shutdown");
  });

  it("match_completed does not change failed buildStatus", () => {
    const state = twoPlayerState();
    state.players.get("p1")!.buildStatus = "live";
    state.players.get("p2")!.buildStatus = "failed";

    const next = applyEvent(state, { eventType: "match_completed" });

    expect(next.players.get("p1")!.buildStatus).toBe("shutdown");
    expect(next.players.get("p2")!.buildStatus).toBe("failed");
  });

  it("match_failed sets matchPhase to failed", () => {
    const state = twoPlayerState();
    const next = applyEvent(state, { eventType: "match_failed" });
    expect(next.matchPhase).toBe("failed");
  });

  it("match_failed sets live players buildStatus to shutdown", () => {
    const state = twoPlayerState();
    state.players.get("p1")!.buildStatus = "live";
    state.players.get("p2")!.buildStatus = "live";

    const next = applyEvent(state, { eventType: "match_failed" });

    expect(next.players.get("p1")!.buildStatus).toBe("shutdown");
    expect(next.players.get("p2")!.buildStatus).toBe("shutdown");
  });

  it("does not mutate original state", () => {
    const state = twoPlayerState();
    const originalP1Status = state.players.get("p1")!.buildStatus;

    applyEvent(state, {
      eventType: "build_started",
      playerId: "p1",
    });

    expect(state.players.get("p1")!.buildStatus).toBe(originalP1Status);
  });

  it("attack_started sets all N players to attacking", () => {
    const state = nPlayerState(5);
    const next = applyEvent(state, { eventType: "attack_started" });

    expect(next.matchPhase).toBe("attacking");
    for (let i = 1; i <= 5; i++) {
      expect(next.players.get(`p${i}`)!.attackStatus).toBe("attacking");
    }
  });

  it("scoring_completed updates scores for N players", () => {
    const state = nPlayerState(5);
    const scores = Array.from({ length: 5 }, (_, i) => ({
      playerId: `p${i + 1}`,
      score: (5 - i) * 100,
    }));

    const next = applyEvent(state, {
      eventType: "scoring_completed",
      payload: { scores },
    });

    for (let i = 0; i < 5; i++) {
      expect(next.players.get(`p${i + 1}`)!.score).toBe((5 - i) * 100);
    }
  });

  it("flag_captured works across different player pairs in N-player match", () => {
    const state = nPlayerState(5);

    let next = applyEvent(state, {
      eventType: "flag_captured",
      playerId: "p1",
      payload: { defenderPlayerId: "p3", isValid: true, pointsAwarded: 100, captureId: "c1" },
    });
    next = applyEvent(next, {
      eventType: "flag_captured",
      playerId: "p4",
      payload: { defenderPlayerId: "p2", isValid: true, pointsAwarded: 100, captureId: "c2" },
    });
    next = applyEvent(next, {
      eventType: "flag_captured",
      playerId: "p1",
      payload: { defenderPlayerId: "p5", isValid: true, pointsAwarded: 100, captureId: "c3" },
    });

    expect(next.captures).toHaveLength(3);
    expect(next.players.get("p1")!.totalFlagsCaptured).toBe(2);
    expect(next.players.get("p4")!.totalFlagsCaptured).toBe(1);
    expect(next.players.get("p3")!.totalFlagsLost).toBe(1);
    expect(next.players.get("p2")!.totalFlagsLost).toBe(1);
    expect(next.players.get("p5")!.totalFlagsLost).toBe(1);
  });
});

// --- computeCaptureStats ---

describe("computeCaptureStats", () => {
  it("counts valid captures between player pairs", () => {
    const captures: ArenaCapture[] = [
      makeCapture({ id: "c1", attackerPlayerId: "p1", defenderPlayerId: "p2" }),
      makeCapture({ id: "c2", attackerPlayerId: "p1", defenderPlayerId: "p2" }),
      makeCapture({ id: "c3", attackerPlayerId: "p2", defenderPlayerId: "p1" }),
    ];

    const stats = computeCaptureStats(captures, "p1", "p2");
    expect(stats.aToB).toBe(2);
    expect(stats.bToA).toBe(1);
  });

  it("excludes invalid captures", () => {
    const captures: ArenaCapture[] = [
      makeCapture({ id: "c1", attackerPlayerId: "p1", defenderPlayerId: "p2", isValid: true }),
      makeCapture({ id: "c2", attackerPlayerId: "p1", defenderPlayerId: "p2", isValid: false }),
    ];

    const stats = computeCaptureStats(captures, "p1", "p2");
    expect(stats.aToB).toBe(1);
    expect(stats.bToA).toBe(0);
  });

  it("returns zeros when no captures exist", () => {
    const stats = computeCaptureStats([], "p1", "p2");
    expect(stats.aToB).toBe(0);
    expect(stats.bToA).toBe(0);
  });
});

// --- computePlayerStats ---

describe("computePlayerStats", () => {
  it("counts captures and losses across multiple opponents", () => {
    const captures: ArenaCapture[] = [
      makeCapture({ id: "c1", attackerPlayerId: "p1", defenderPlayerId: "p2" }),
      makeCapture({ id: "c2", attackerPlayerId: "p1", defenderPlayerId: "p3" }),
      makeCapture({ id: "c3", attackerPlayerId: "p1", defenderPlayerId: "p2" }),
      makeCapture({ id: "c4", attackerPlayerId: "p3", defenderPlayerId: "p1" }),
    ];

    const stats = computePlayerStats(captures, "p1");
    expect(stats.totalCaptured).toBe(3);
    expect(stats.totalLost).toBe(1);
    expect(stats.capturedByOpponent.get("p2")).toBe(2);
    expect(stats.capturedByOpponent.get("p3")).toBe(1);
  });

  it("excludes invalid captures", () => {
    const captures: ArenaCapture[] = [
      makeCapture({ id: "c1", attackerPlayerId: "p1", defenderPlayerId: "p2", isValid: true }),
      makeCapture({ id: "c2", attackerPlayerId: "p1", defenderPlayerId: "p2", isValid: false }),
      makeCapture({ id: "c3", attackerPlayerId: "p2", defenderPlayerId: "p1", isValid: false }),
    ];

    const stats = computePlayerStats(captures, "p1");
    expect(stats.totalCaptured).toBe(1);
    expect(stats.totalLost).toBe(0);
  });

  it("returns zeros for player with no captures", () => {
    const captures: ArenaCapture[] = [
      makeCapture({ id: "c1", attackerPlayerId: "p2", defenderPlayerId: "p3" }),
    ];

    const stats = computePlayerStats(captures, "p1");
    expect(stats.totalCaptured).toBe(0);
    expect(stats.totalLost).toBe(0);
    expect(stats.capturedByOpponent.size).toBe(0);
  });

  it("works in 5-player match", () => {
    const captures: ArenaCapture[] = [
      makeCapture({ id: "c1", attackerPlayerId: "p1", defenderPlayerId: "p2" }),
      makeCapture({ id: "c2", attackerPlayerId: "p1", defenderPlayerId: "p3" }),
      makeCapture({ id: "c3", attackerPlayerId: "p1", defenderPlayerId: "p4" }),
      makeCapture({ id: "c4", attackerPlayerId: "p1", defenderPlayerId: "p5" }),
      makeCapture({ id: "c5", attackerPlayerId: "p2", defenderPlayerId: "p1" }),
      makeCapture({ id: "c6", attackerPlayerId: "p3", defenderPlayerId: "p1" }),
    ];

    const stats = computePlayerStats(captures, "p1");
    expect(stats.totalCaptured).toBe(4);
    expect(stats.totalLost).toBe(2);
    expect(stats.capturedByOpponent.size).toBe(4);
    expect(stats.capturedByOpponent.get("p2")).toBe(1);
    expect(stats.capturedByOpponent.get("p3")).toBe(1);
    expect(stats.capturedByOpponent.get("p4")).toBe(1);
    expect(stats.capturedByOpponent.get("p5")).toBe(1);
  });
});
