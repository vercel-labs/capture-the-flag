import { describe, it, expect } from "vitest";
import { formatEventDetails } from "@/components/match-timeline";

describe("formatEventDetails", () => {
  describe("build_failed", () => {
    it("formats with error reason and model ID", () => {
      const detail = formatEventDetails("build_failed", {
        modelId: "openai/gpt-4.1",
        sandboxId: "sbx_123",
        appUrl: "",
        error: "Build timed out after 600 seconds",
      });

      expect(detail.header).toBe("openai/gpt-4.1");
      expect(detail.lines).toContain("Build timed out after 600 seconds");
    });

    it("handles missing error gracefully", () => {
      const detail = formatEventDetails("build_failed", {
        modelId: "openai/gpt-4.1",
        sandboxId: "sbx_123",
      });

      expect(detail.header).toBe("openai/gpt-4.1");
      expect(detail.lines).toHaveLength(0);
    });

    it("handles missing model ID", () => {
      const detail = formatEventDetails("build_failed", {
        error: "Some error",
      });

      expect(detail.header).toBe("");
      expect(detail.lines).toContain("Some error");
    });
  });

  describe("vulnerability_registered", () => {
    it("formats full payload with CWE reference", () => {
      const detail = formatEventDetails("vulnerability_registered", {
        category: "xss",
        description: "Stored XSS in comments",
        location: "/api/comments",
        difficulty: 7,
        modelId: "anthropic/claude-sonnet-4",
      });

      expect(detail.header).toBe("[XSS] CWE-79");
      expect(detail.lines).toContain("Stored XSS in comments");
      expect(detail.lines).toContain("location: /api/comments");
      expect(detail.lines).toContain("difficulty: 7/10");
      expect(detail.lines).toContain("defender: anthropic/claude-sonnet-4");
      expect(detail.cweUrl).toBe(
        "https://cwe.mitre.org/data/definitions/79.html"
      );
    });

    it("handles missing optional fields", () => {
      const detail = formatEventDetails("vulnerability_registered", {
        category: "sqli",
      });

      expect(detail.header).toBe("[SQLI] CWE-89");
      expect(detail.lines).toHaveLength(0);
    });

    it("handles unknown category gracefully", () => {
      const detail = formatEventDetails("vulnerability_registered", {
        category: "unknown_vuln",
        description: "some desc",
      });

      expect(detail.header).toBe("[UNKNOWN_VULN]");
      expect(detail.lines).toContain("some desc");
      expect(detail.cweUrl).toBeUndefined();
    });
  });

  describe("flag_captured", () => {
    it("formats with vulnerability details", () => {
      const detail = formatEventDetails("flag_captured", {
        attackerModelId: "openai/gpt-4.1",
        defenderModelId: "anthropic/claude-sonnet-4",
        pointsAwarded: 150,
        method: "reflected XSS via search",
        vulnerabilityCategory: "xss",
        vulnerabilityDescription: "XSS in search page",
      });

      expect(detail.header).toContain("openai/gpt-4.1");
      expect(detail.header).toContain("anthropic/claude-sonnet-4");
      expect(detail.header).toContain("+150pts");
      expect(detail.lines).toContain("XSS CWE-79");
      expect(detail.lines).toContain("XSS in search page");
      expect(detail.lines).toContain("method: reflected XSS via search");
    });

    it("formats without vulnerability details", () => {
      const detail = formatEventDetails("flag_captured", {
        attackerModelId: "a",
        defenderModelId: "b",
        pointsAwarded: 100,
      });

      expect(detail.header).toBe("a → b (+100pts)");
      expect(detail.lines).toHaveLength(0);
    });
  });

  describe("first_blood", () => {
    it("formats first blood announcement", () => {
      const detail = formatEventDetails("first_blood", {
        attackerModelId: "openai/gpt-4.1",
        defenderModelId: "anthropic/claude-sonnet-4",
      });

      expect(detail.header).toBe(
        "openai/gpt-4.1 drew first blood against anthropic/claude-sonnet-4!"
      );
    });
  });

  describe("scoring_completed", () => {
    it("formats score breakdown with winner marking", () => {
      const detail = formatEventDetails("scoring_completed", {
        scores: [
          {
            modelId: "anthropic/claude-sonnet-4",
            totalScore: 550,
            capturePoints: 300,
            firstBloodBonus: 50,
            defensePoints: 200,
            flagsCaptured: 3,
            flagsLost: 1,
          },
          {
            modelId: "openai/gpt-4.1",
            totalScore: 400,
            capturePoints: 200,
            firstBloodBonus: 0,
            defensePoints: 200,
            flagsCaptured: 2,
            flagsLost: 2,
          },
        ],
        winnerModelId: "anthropic/claude-sonnet-4",
      });

      expect(detail.header).toBe("2 players scored");
      expect(detail.lines).toHaveLength(2);
      expect(detail.lines![0]).toContain("anthropic/claude-sonnet-4: 550pts");
      expect(detail.lines![0]).toContain("capture=300");
      expect(detail.lines![0]).toContain("firstBlood=+50");
      expect(detail.lines![0]).toContain("defense=200");
      expect(detail.lines![0]).toContain("3 captured, 1 lost");
      expect(detail.lines![0]).toContain("[WINNER]");
      expect(detail.lines![1]).not.toContain("[WINNER]");
    });

    it("handles legacy score key", () => {
      const detail = formatEventDetails("scoring_completed", {
        scores: [{ modelId: "test", score: 100 }],
        winnerModelId: null,
      });

      expect(detail.lines![0]).toContain("test: 100pts");
    });
  });

  describe("attack_progress", () => {
    it("formats http_request action", () => {
      const detail = formatEventDetails("attack_progress", {
        action: "http_request",
        method: "POST",
        url: "https://app.example.com/login",
        status: 200,
      });

      expect(detail.header).toBe(
        "POST https://app.example.com/login -> 200"
      );
    });

    it("formats flag_attempt action", () => {
      const detail = formatEventDetails("attack_progress", {
        action: "flag_attempt",
        error: "Flag not recognized",
      });

      expect(detail.header).toBe("flag attempt failed: Flag not recognized");
    });
  });

  describe("default", () => {
    it("uses generic key=value format for unknown events", () => {
      const detail = formatEventDetails("some_custom_event", {
        foo: "bar",
        count: 42,
      });

      expect(detail.header).toBe("foo=bar count=42");
    });

    it("returns empty header for no payload", () => {
      const detail = formatEventDetails("any_event");
      expect(detail.header).toBe("");
    });
  });
});
