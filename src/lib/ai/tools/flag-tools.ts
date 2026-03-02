import { tool } from "ai";
import { z } from "zod/v4";
import type { VulnerabilityCategory } from "@/lib/config/types";

interface FlagSubmitCallback {
  (flag: string, method?: string): Promise<{
    isValid: boolean;
    pointsAwarded: number;
    isFirstBlood: boolean;
    error?: string;
  }>;
}

interface VulnerabilityRegisterCallback {
  (vuln: {
    category: VulnerabilityCategory;
    description: string;
    flagToken: string;
    location: string;
    difficulty: number;
  }): Promise<{ success: boolean; vulnerabilityId: string }>;
}

export function createFlagTools(callbacks: {
  onSubmitFlag: FlagSubmitCallback;
  onRegisterVulnerability: VulnerabilityRegisterCallback;
}) {
  return {
    submitFlag: tool({
      description:
        "Submit a captured CTF flag. Use this when you find a flag token (format: CTF{...}) during penetration testing.",
      parameters: z.object({
        flag: z.string().describe("The flag token to submit (e.g., CTF{a3f2_07_e9c1b4d82f6a0753})"),
        method: z
          .string()
          .optional()
          .describe(
            "Description of how the flag was captured (e.g., 'SQL injection in search form')"
          ),
      }),
      execute: async ({ flag, method }) => {
        return callbacks.onSubmitFlag(flag, method);
      },
    }),

    registerVulnerability: tool({
      description:
        "Register a planted vulnerability after building it into the application. Call this for each vulnerability you create.",
      parameters: z.object({
        category: z.enum([
          "xss",
          "sqli",
          "csrf",
          "idor",
          "ssrf",
          "auth_bypass",
          "path_traversal",
          "command_injection",
          "information_disclosure",
          "broken_access_control",
          "security_misconfiguration",
        ]),
        description: z
          .string()
          .describe("Brief description of the vulnerability"),
        flagToken: z
          .string()
          .describe("The flag token hidden behind this vulnerability"),
        location: z
          .string()
          .describe(
            "Where in the app the vulnerability is (e.g., '/api/search', '/login')"
          ),
        difficulty: z
          .number()
          .min(1)
          .max(10)
          .describe("Difficulty rating from 1 (easy) to 10 (hard)"),
      }),
      execute: async ({ category, description, flagToken, location, difficulty }) => {
        return callbacks.onRegisterVulnerability({
          category: category as VulnerabilityCategory,
          description,
          flagToken,
          location,
          difficulty,
        });
      },
    }),
  };
}
