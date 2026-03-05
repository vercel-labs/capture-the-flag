import { generateText, stepCountIs } from "ai";
import { getModel } from "@/lib/ai/gateway";
import { createSandboxTools } from "@/lib/ai/tools/sandbox-tools";
import { createHttpTools } from "@/lib/ai/tools/http-tools";
import { createFlagTools } from "@/lib/ai/tools/flag-tools";
import { attackAppPrompt } from "@/lib/ai/prompts/attack-app";
import { validateFlag } from "@/lib/flags/validator";
import { createAttackerSandbox } from "./manager";
import { db } from "@/lib/db/client";
import { flagCaptures } from "@/lib/db/schema";
import { emitMatchEvent } from "@/lib/events/emitter";
import type { MatchConfig } from "@/lib/config/types";

interface AttackTarget {
  playerId: string;
  modelId: string;
  appUrl: string;
}

interface AttackResult {
  sandboxId: string;
  flagsCaptured: number;
  success: boolean;
  error?: string;
}

/**
 * Orchestrate AI pentesting against a target app.
 */
export async function attackApp(
  matchId: string,
  attackerPlayerId: string,
  attackerModelId: string,
  target: AttackTarget,
  config: MatchConfig
): Promise<AttackResult> {
  // Extract domain from target URL for network policy
  const targetDomain = new URL(target.appUrl).hostname;
  const { sandbox, sandboxId } = await createAttackerSandbox([targetDomain]);

  let flagsCaptured = 0;

  try {
    const sandboxTools = createSandboxTools(sandbox);
    const rawHttpTools = createHttpTools();
    const rawHttpExecute = rawHttpTools.httpRequest.execute!;

    let httpRequestCount = 0;
    const httpTools = {
      httpRequest: {
        ...rawHttpTools.httpRequest,
        execute: async (...args: Parameters<typeof rawHttpExecute>) => {
          const result = await rawHttpExecute(...args);
          httpRequestCount++;

          // Emit progress on first request and every 5th request
          if (httpRequestCount === 1 || httpRequestCount % 5 === 0) {
            const input = args[0];
            const status = typeof result === "object" && "status" in result ? result.status : undefined;
            await emitMatchEvent(matchId, {
              eventType: "attack_progress",
              playerId: attackerPlayerId,
              payload: {
                action: "http_request",
                method: input.method ?? "GET",
                url: input.url,
                ...(status !== undefined && { status }),
                requestNumber: httpRequestCount,
              },
            });
          }

          return result;
        },
      },
    };
    const flagTools = createFlagTools({
      onSubmitFlag: async (flag, method) => {
        const result = await validateFlag({
          matchId,
          attackerPlayerId,
          submittedFlag: flag,
          method,
        });

        // Record every attempt in the database
        await db.insert(flagCaptures).values({
          matchId,
          attackerPlayerId,
          defenderPlayerId: result.defenderPlayerId || target.playerId,
          vulnerabilityId: result.vulnerabilityId || undefined,
          submittedFlag: flag,
          isValid: result.isValid,
          pointsAwarded: result.pointsAwarded,
          method,
        });

        if (result.isValid) {
          flagsCaptured++;

          // Emit events
          await emitMatchEvent(matchId, {
            eventType: "flag_captured",
            playerId: attackerPlayerId,
            payload: {
              attackerModelId,
              defenderModelId: target.modelId,
              pointsAwarded: result.pointsAwarded,
              method,
            },
          });

          if (result.isFirstBlood) {
            await emitMatchEvent(matchId, {
              eventType: "first_blood",
              playerId: attackerPlayerId,
              payload: {
                attackerModelId,
                defenderModelId: target.modelId,
              },
            });
          }
        } else {
          await emitMatchEvent(matchId, {
            eventType: "attack_progress",
            playerId: attackerPlayerId,
            payload: {
              action: "flag_attempt",
              error: result.error,
              method,
            },
          });
        }

        return {
          isValid: result.isValid,
          pointsAwarded: result.pointsAwarded,
          isFirstBlood: result.isFirstBlood,
          error: result.error,
        };
      },
      onRegisterVulnerability: async () => ({
        success: false,
        vulnerabilityId: "",
      }),
    });

    const prompt = attackAppPrompt({
      targetUrl: target.appUrl,
      targetModelId: target.modelId,
      appSpec: config.appSpec,
    });

    await generateText({
      model: getModel(attackerModelId),
      prompt,
      tools: {
        ...sandboxTools,
        ...httpTools,
        ...flagTools,
      },
      maxOutputTokens: 16384,
      temperature: 0.3,
      maxRetries: 2,
      stopWhen: stepCountIs(30),
      timeout: { totalMs: config.attackTimeLimitSeconds * 1000 },
    });

    return {
      sandboxId,
      flagsCaptured,
      success: true,
    };
  } catch (error) {
    return {
      sandboxId,
      flagsCaptured,
      success: false,
      error: error instanceof Error ? error.message : "Unknown attack error",
    };
  }
}
