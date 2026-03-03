import { describe, it, expect } from "vitest";
import { DEFAULT_MATCH_CONFIG, SCORING, SANDBOX_CONFIG } from "@/lib/config/defaults";
import { matchConfigSchema } from "@/lib/config/types";

describe("DEFAULT_MATCH_CONFIG", () => {
  it("passes schema validation", () => {
    const result = matchConfigSchema.safeParse(DEFAULT_MATCH_CONFIG);
    expect(result.success).toBe(true);
  });

  it("has correct default values", () => {
    expect(DEFAULT_MATCH_CONFIG.appSpec).toBe("A Next.js ecommerce site");
    expect(DEFAULT_MATCH_CONFIG.vulnerabilityCount).toBe(10);
    expect(DEFAULT_MATCH_CONFIG.models).toHaveLength(3);
    expect(DEFAULT_MATCH_CONFIG.buildTimeLimitSeconds).toBe(600);
    expect(DEFAULT_MATCH_CONFIG.attackTimeLimitSeconds).toBe(600);
  });

  it("has at least 2 models", () => {
    expect(DEFAULT_MATCH_CONFIG.models.length).toBeGreaterThanOrEqual(2);
  });
});

describe("matchConfigSchema", () => {
  it("applies defaults for missing fields", () => {
    const result = matchConfigSchema.parse({});
    expect(result.appSpec).toBe("A Next.js ecommerce site");
    expect(result.vulnerabilityCount).toBe(10);
    expect(result.models).toHaveLength(3);
  });

  it("rejects vulnerability count below 1", () => {
    const result = matchConfigSchema.safeParse({ vulnerabilityCount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects vulnerability count above 20", () => {
    const result = matchConfigSchema.safeParse({ vulnerabilityCount: 21 });
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 2 models", () => {
    const result = matchConfigSchema.safeParse({ models: ["one"] });
    expect(result.success).toBe(false);
  });

  it("accepts custom config", () => {
    const result = matchConfigSchema.parse({
      appSpec: "A blog app",
      vulnerabilityCount: 5,
      models: ["a/b", "c/d"],
      buildTimeLimitSeconds: 300,
      attackTimeLimitSeconds: 300,
    });
    expect(result.appSpec).toBe("A blog app");
    expect(result.vulnerabilityCount).toBe(5);
  });
});

describe("SCORING constants", () => {
  it("has positive values for all scoring types", () => {
    expect(SCORING.FLAG_CAPTURE_POINTS).toBeGreaterThan(0);
    expect(SCORING.FIRST_BLOOD_BONUS).toBeGreaterThan(0);
    expect(SCORING.UNCOMPROMISED_VULN_DEFENSE_POINTS).toBeGreaterThan(0);
  });

  it("first blood bonus is greater than single flag capture", () => {
    expect(SCORING.FIRST_BLOOD_BONUS).toBeGreaterThan(
      SCORING.FLAG_CAPTURE_POINTS
    );
  });
});

describe("SANDBOX_CONFIG", () => {
  it("uses port 3000", () => {
    expect(SANDBOX_CONFIG.port).toBe(3000);
  });

  it("has reasonable health check retries", () => {
    expect(SANDBOX_CONFIG.healthCheckRetries).toBeGreaterThanOrEqual(3);
  });
});
