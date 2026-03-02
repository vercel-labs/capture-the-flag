import type { VulnerabilityCategory } from "@/lib/config/types";

export interface FlagToken {
  token: string;
  vulnerabilityIndex: number;
  matchShort: string;
}

export interface PlantedVulnerability {
  category: VulnerabilityCategory;
  description: string;
  flagToken: string;
  location: string;
  difficulty: number;
  pointValue: number;
}

export interface FlagSubmission {
  matchId: string;
  attackerPlayerId: string;
  submittedFlag: string;
  method?: string;
}

export interface FlagValidationResult {
  isValid: boolean;
  vulnerabilityId?: string;
  defenderPlayerId?: string;
  pointsAwarded: number;
  isFirstBlood: boolean;
  error?: string;
}
