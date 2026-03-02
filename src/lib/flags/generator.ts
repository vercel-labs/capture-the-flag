import { randomBytes } from "crypto";
import type { FlagToken } from "./types";

/**
 * Generate a short match identifier (4 hex chars) from a match UUID.
 */
export function generateMatchShort(matchId: string): string {
  return matchId.replace(/-/g, "").slice(0, 4);
}

/**
 * Generate a single CTF flag token.
 * Format: CTF{<matchShort4>_<vulnIndex02d>_<randomHex16>}
 * Example: CTF{a3f2_07_e9c1b4d82f6a0753}
 */
export function generateFlagToken(
  matchId: string,
  vulnerabilityIndex: number
): FlagToken {
  const matchShort = generateMatchShort(matchId);
  const indexPart = String(vulnerabilityIndex).padStart(2, "0");
  const randomHex = randomBytes(8).toString("hex");
  const token = `CTF{${matchShort}_${indexPart}_${randomHex}}`;

  return {
    token,
    vulnerabilityIndex,
    matchShort,
  };
}

/**
 * Generate flag tokens for all vulnerabilities in a match.
 */
export function generateFlagTokens(
  matchId: string,
  count: number
): FlagToken[] {
  return Array.from({ length: count }, (_, i) =>
    generateFlagToken(matchId, i + 1)
  );
}

/**
 * Check if a string looks like a valid CTF flag format.
 */
export function isValidFlagFormat(flag: string): boolean {
  return /^CTF\{[a-f0-9]{4}_\d{2}_[a-f0-9]{16}\}$/.test(flag);
}
