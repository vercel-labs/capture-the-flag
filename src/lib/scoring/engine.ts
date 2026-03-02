import { SCORING } from "@/lib/config/defaults";

export interface PlayerScore {
  playerId: string;
  modelId: string;
  flagsCaptured: number;
  flagsLost: number;
  capturePoints: number;
  firstBloodBonus: number;
  defensePoints: number;
  totalScore: number;
}

export interface ScoringInput {
  playerId: string;
  modelId: string;
  flagsCaptured: number;
  flagsLost: number;
  isFirstBlood: boolean;
  totalVulnerabilities: number;
  vulnerabilitiesCompromised: number;
}

/**
 * Calculate the total score for a single player.
 */
export function calculatePlayerScore(input: ScoringInput): PlayerScore {
  const capturePoints = input.flagsCaptured * SCORING.FLAG_CAPTURE_POINTS;
  const firstBloodBonus = input.isFirstBlood ? SCORING.FIRST_BLOOD_BONUS : 0;
  const uncompromisedCount =
    input.totalVulnerabilities - input.vulnerabilitiesCompromised;
  const defensePoints =
    uncompromisedCount * SCORING.UNCOMPROMISED_VULN_DEFENSE_POINTS;

  return {
    playerId: input.playerId,
    modelId: input.modelId,
    flagsCaptured: input.flagsCaptured,
    flagsLost: input.flagsLost,
    capturePoints,
    firstBloodBonus,
    defensePoints,
    totalScore: capturePoints + firstBloodBonus + defensePoints,
  };
}

/**
 * Determine the winner from a list of player scores.
 * Winner is the player with the highest total score.
 * Ties are broken by fewer flags lost, then by alphabetical model ID.
 */
export function determineWinner(scores: PlayerScore[]): PlayerScore | null {
  if (scores.length === 0) return null;

  return scores.reduce((best, current) => {
    if (current.totalScore > best.totalScore) return current;
    if (current.totalScore < best.totalScore) return best;
    if (current.flagsLost < best.flagsLost) return current;
    if (current.flagsLost > best.flagsLost) return best;
    return current.modelId < best.modelId ? current : best;
  });
}

/**
 * Calculate scores for all players in a match.
 */
export function calculateMatchScores(inputs: ScoringInput[]): {
  scores: PlayerScore[];
  winner: PlayerScore | null;
} {
  const scores = inputs.map(calculatePlayerScore);
  const winner = determineWinner(scores);
  return { scores, winner };
}
