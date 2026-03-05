import { generateText } from "ai";
import { getModel } from "@/lib/ai/gateway";
import { createSandboxTools } from "@/lib/ai/tools/sandbox-tools";
import { createFlagTools } from "@/lib/ai/tools/flag-tools";
import { buildAppPrompt } from "@/lib/ai/prompts/build-app";
import { generateFlagTokens } from "@/lib/flags/generator";
import { createBuilderSandbox, lockSandboxNetwork } from "./manager";
import { db } from "@/lib/db/client";
import { vulnerabilities } from "@/lib/db/schema";
import { redis } from "@/lib/redis/client";
import { redisKeys } from "@/lib/redis/keys";
import { REDIS_TTL } from "@/lib/config/defaults";
import type { VulnerabilityCategory } from "@/lib/config/types";
import type { MatchConfig } from "@/lib/config/types";

interface BuildResult {
  sandboxId: string;
  appUrl: string;
  vulnerabilityIds: string[];
  success: boolean;
  error?: string;
}

/**
 * Orchestrate AI building a vulnerable app in a sandbox.
 */
export async function buildApp(
  matchId: string,
  playerId: string,
  modelId: string,
  config: MatchConfig
): Promise<BuildResult> {
  const { sandbox, sandboxId, appUrl } = await createBuilderSandbox();
  const vulnerabilityIds: string[] = [];

  try {
    // Generate flag tokens
    const flagTokens = generateFlagTokens(matchId, config.vulnerabilityCount);

    // Pick vulnerability categories (cycle through available ones)
    const categories: VulnerabilityCategory[] = [
      "xss",
      "sqli",
      "idor",
      "information_disclosure",
      "path_traversal",
      "auth_bypass",
      "ssrf",
      "command_injection",
      "broken_access_control",
      "security_misconfiguration",
      "csrf",
    ];

    const vulnSpecs = flagTokens.map((ft, i) => ({
      category: categories[i % categories.length],
      flagToken: ft.token,
      index: ft.vulnerabilityIndex,
    }));

    // Create tools
    const sandboxTools = createSandboxTools(sandbox);
    const flagTools = createFlagTools({
      onSubmitFlag: async () => ({
        isValid: false,
        pointsAwarded: 0,
        isFirstBlood: false,
        error: "Cannot submit flags during build phase",
      }),
      onRegisterVulnerability: async (vuln) => {
        const [inserted] = await db
          .insert(vulnerabilities)
          .values({
            matchId,
            playerId,
            category: vuln.category,
            description: vuln.description,
            flagToken: vuln.flagToken,
            location: vuln.location,
            difficulty: vuln.difficulty,
            pointValue: 100,
          })
          .returning({ id: vulnerabilities.id });

        vulnerabilityIds.push(inserted.id);

        // Store flag in Redis for fast validation
        await redis.hset(redisKeys.matchFlags(matchId), {
          [vuln.flagToken]: JSON.stringify({
            vulnerabilityId: inserted.id,
            playerId,
            pointValue: 100,
          }),
        });
        await redis.expire(
          redisKeys.matchFlags(matchId),
          REDIS_TTL.matchKeysSeconds
        );

        return { success: true, vulnerabilityId: inserted.id };
      },
    });

    // Generate the prompt
    const prompt = buildAppPrompt({
      appSpec: config.appSpec,
      vulnerabilities: vulnSpecs,
    });

    // Run AI with tools
    await generateText({
      model: getModel(modelId),
      prompt,
      tools: {
        ...sandboxTools,
        ...flagTools,
      },
      maxOutputTokens: 16384,
      temperature: 0.7,
      maxRetries: 2,
      timeout: { totalMs: config.buildTimeLimitSeconds * 1000 },
    });

    // Lock sandbox network after build
    await lockSandboxNetwork(sandbox);

    return {
      sandboxId,
      appUrl,
      vulnerabilityIds,
      success: true,
    };
  } catch (error) {
    try {
      await sandbox.stop({ blocking: false });
    } catch {
      // Sandbox may already be stopped
    }
    return {
      sandboxId,
      appUrl,
      vulnerabilityIds,
      success: false,
      error: error instanceof Error ? error.message : "Unknown build error",
    };
  }
}
