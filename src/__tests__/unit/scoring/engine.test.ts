import { describe, it, expect } from "vitest";
import {
  calculatePlayerScore,
  determineWinner,
  calculateMatchScores,
  type ScoringInput,
} from "@/lib/scoring/engine";
import { SCORING } from "@/lib/config/defaults";

describe("calculatePlayerScore", () => {
  it("calculates capture points correctly", () => {
    const result = calculatePlayerScore({
      playerId: "p1",
      modelId: "model-a",
      flagsCaptured: 3,
      flagsLost: 0,
      isFirstBlood: false,
      totalVulnerabilities: 10,
      vulnerabilitiesCompromised: 0,
    });

    expect(result.capturePoints).toBe(3 * SCORING.FLAG_CAPTURE_POINTS);
    expect(result.firstBloodBonus).toBe(0);
  });

  it("adds first blood bonus", () => {
    const result = calculatePlayerScore({
      playerId: "p1",
      modelId: "model-a",
      flagsCaptured: 1,
      flagsLost: 0,
      isFirstBlood: true,
      totalVulnerabilities: 10,
      vulnerabilitiesCompromised: 0,
    });

    expect(result.firstBloodBonus).toBe(SCORING.FIRST_BLOOD_BONUS);
    expect(result.totalScore).toBe(
      SCORING.FLAG_CAPTURE_POINTS +
        SCORING.FIRST_BLOOD_BONUS +
        10 * SCORING.UNCOMPROMISED_VULN_DEFENSE_POINTS
    );
  });

  it("calculates defense points for uncompromised vulnerabilities", () => {
    const result = calculatePlayerScore({
      playerId: "p1",
      modelId: "model-a",
      flagsCaptured: 0,
      flagsLost: 3,
      isFirstBlood: false,
      totalVulnerabilities: 10,
      vulnerabilitiesCompromised: 3,
    });

    expect(result.defensePoints).toBe(
      7 * SCORING.UNCOMPROMISED_VULN_DEFENSE_POINTS
    );
  });

  it("handles zero vulnerabilities", () => {
    const result = calculatePlayerScore({
      playerId: "p1",
      modelId: "model-a",
      flagsCaptured: 5,
      flagsLost: 0,
      isFirstBlood: false,
      totalVulnerabilities: 0,
      vulnerabilitiesCompromised: 0,
    });

    expect(result.defensePoints).toBe(0);
    expect(result.totalScore).toBe(5 * SCORING.FLAG_CAPTURE_POINTS);
  });

  it("calculates total score as sum of all components", () => {
    const result = calculatePlayerScore({
      playerId: "p1",
      modelId: "model-a",
      flagsCaptured: 2,
      flagsLost: 1,
      isFirstBlood: true,
      totalVulnerabilities: 5,
      vulnerabilitiesCompromised: 1,
    });

    expect(result.totalScore).toBe(
      result.capturePoints + result.firstBloodBonus + result.defensePoints
    );
  });
});

describe("determineWinner", () => {
  it("returns null for empty scores", () => {
    expect(determineWinner([])).toBeNull();
  });

  it("returns the player with highest total score", () => {
    const scores = [
      {
        playerId: "p1",
        modelId: "a",
        flagsCaptured: 1,
        flagsLost: 0,
        capturePoints: 100,
        firstBloodBonus: 0,
        defensePoints: 0,
        totalScore: 100,
      },
      {
        playerId: "p2",
        modelId: "b",
        flagsCaptured: 3,
        flagsLost: 0,
        capturePoints: 300,
        firstBloodBonus: 0,
        defensePoints: 0,
        totalScore: 300,
      },
    ];

    expect(determineWinner(scores)!.playerId).toBe("p2");
  });

  it("breaks ties by fewer flags lost", () => {
    const scores = [
      {
        playerId: "p1",
        modelId: "a",
        flagsCaptured: 2,
        flagsLost: 3,
        capturePoints: 200,
        firstBloodBonus: 0,
        defensePoints: 0,
        totalScore: 200,
      },
      {
        playerId: "p2",
        modelId: "b",
        flagsCaptured: 2,
        flagsLost: 1,
        capturePoints: 200,
        firstBloodBonus: 0,
        defensePoints: 0,
        totalScore: 200,
      },
    ];

    expect(determineWinner(scores)!.playerId).toBe("p2");
  });

  it("breaks further ties by alphabetical model ID", () => {
    const scores = [
      {
        playerId: "p1",
        modelId: "zebra",
        flagsCaptured: 2,
        flagsLost: 1,
        capturePoints: 200,
        firstBloodBonus: 0,
        defensePoints: 0,
        totalScore: 200,
      },
      {
        playerId: "p2",
        modelId: "alpha",
        flagsCaptured: 2,
        flagsLost: 1,
        capturePoints: 200,
        firstBloodBonus: 0,
        defensePoints: 0,
        totalScore: 200,
      },
    ];

    expect(determineWinner(scores)!.playerId).toBe("p2");
  });
});

describe("calculateMatchScores", () => {
  it("returns scores and winner for all players", () => {
    const inputs: ScoringInput[] = [
      {
        playerId: "p1",
        modelId: "model-a",
        flagsCaptured: 5,
        flagsLost: 2,
        isFirstBlood: true,
        totalVulnerabilities: 10,
        vulnerabilitiesCompromised: 2,
      },
      {
        playerId: "p2",
        modelId: "model-b",
        flagsCaptured: 2,
        flagsLost: 5,
        isFirstBlood: false,
        totalVulnerabilities: 10,
        vulnerabilitiesCompromised: 5,
      },
    ];

    const { scores, winner } = calculateMatchScores(inputs);

    expect(scores).toHaveLength(2);
    expect(winner).not.toBeNull();
    expect(winner!.playerId).toBe("p1");
  });
});
