import { describe, it, expect } from "vitest";
import {
  generateMatchShort,
  generateFlagToken,
  generateFlagTokens,
  isValidFlagFormat,
} from "@/lib/flags/generator";

describe("generateMatchShort", () => {
  it("returns first 4 hex chars of uuid without dashes", () => {
    const matchId = "a3f2b1c4-d5e6-7890-abcd-ef1234567890";
    expect(generateMatchShort(matchId)).toBe("a3f2");
  });

  it("handles different UUIDs", () => {
    const matchId = "deadbeef-1234-5678-9abc-def012345678";
    expect(generateMatchShort(matchId)).toBe("dead");
  });
});

describe("generateFlagToken", () => {
  it("returns a token in the correct format", () => {
    const matchId = "a3f2b1c4-d5e6-7890-abcd-ef1234567890";
    const result = generateFlagToken(matchId, 7);

    expect(result.token).toMatch(/^CTF\{a3f2_07_[a-f0-9]{16}\}$/);
    expect(result.vulnerabilityIndex).toBe(7);
    expect(result.matchShort).toBe("a3f2");
  });

  it("zero-pads the vulnerability index", () => {
    const matchId = "a3f2b1c4-d5e6-7890-abcd-ef1234567890";
    const result = generateFlagToken(matchId, 1);
    expect(result.token).toContain("_01_");
  });

  it("handles double-digit indices", () => {
    const matchId = "a3f2b1c4-d5e6-7890-abcd-ef1234567890";
    const result = generateFlagToken(matchId, 15);
    expect(result.token).toContain("_15_");
  });

  it("generates unique tokens for same match and index", () => {
    const matchId = "a3f2b1c4-d5e6-7890-abcd-ef1234567890";
    const token1 = generateFlagToken(matchId, 1);
    const token2 = generateFlagToken(matchId, 1);
    expect(token1.token).not.toBe(token2.token);
  });
});

describe("generateFlagTokens", () => {
  it("generates the correct number of tokens", () => {
    const matchId = "a3f2b1c4-d5e6-7890-abcd-ef1234567890";
    const tokens = generateFlagTokens(matchId, 5);

    expect(tokens).toHaveLength(5);
    tokens.forEach((t, i) => {
      expect(t.vulnerabilityIndex).toBe(i + 1);
    });
  });

  it("all tokens have valid format", () => {
    const matchId = "a3f2b1c4-d5e6-7890-abcd-ef1234567890";
    const tokens = generateFlagTokens(matchId, 10);

    tokens.forEach((t) => {
      expect(isValidFlagFormat(t.token)).toBe(true);
    });
  });

  it("all tokens are unique", () => {
    const matchId = "a3f2b1c4-d5e6-7890-abcd-ef1234567890";
    const tokens = generateFlagTokens(matchId, 10);
    const tokenStrings = tokens.map((t) => t.token);
    expect(new Set(tokenStrings).size).toBe(10);
  });
});

describe("isValidFlagFormat", () => {
  it("accepts valid flag format", () => {
    expect(isValidFlagFormat("CTF{a3f2_07_e9c1b4d82f6a0753}")).toBe(true);
  });

  it("rejects missing prefix", () => {
    expect(isValidFlagFormat("{a3f2_07_e9c1b4d82f6a0753}")).toBe(false);
  });

  it("rejects wrong prefix", () => {
    expect(isValidFlagFormat("FLAG{a3f2_07_e9c1b4d82f6a0753}")).toBe(false);
  });

  it("rejects missing braces", () => {
    expect(isValidFlagFormat("CTFa3f2_07_e9c1b4d82f6a0753")).toBe(false);
  });

  it("rejects short random hex", () => {
    expect(isValidFlagFormat("CTF{a3f2_07_e9c1b4d8}")).toBe(false);
  });

  it("rejects uppercase hex", () => {
    expect(isValidFlagFormat("CTF{A3F2_07_E9C1B4D82F6A0753}")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidFlagFormat("CTF{a3f2_07_zzzzzzzzzzzzzzzz}")).toBe(false);
  });

  it("rejects single digit index", () => {
    expect(isValidFlagFormat("CTF{a3f2_7_e9c1b4d82f6a0753}")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidFlagFormat("")).toBe(false);
  });
});
