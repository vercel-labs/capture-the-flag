/**
 * E2E smoke test: Verify every CTF_ELIGIBLE_MODELS entry works via AI Gateway.
 *
 * Each model is tested for:
 * - Gateway accepts the model ID (no 404/auth errors)
 * - Model supports tool use (generates tool calls)
 * - Model follows instructions (writes correct content)
 * - Sandbox tool integration works
 *
 * Run with: pnpm vitest run src/__tests__/e2e/model-smoke.test.ts
 * Requires: VERCEL_TOKEN and AI_GATEWAY_TOKEN environment variables
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Sandbox } from "@vercel/sandbox";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/gateway";
import { CTF_ELIGIBLE_MODELS } from "@/lib/ai/models";
import { SANDBOX_CONFIG } from "@/lib/config/defaults";

let sandbox: Sandbox;

beforeAll(async () => {
  sandbox = await Sandbox.create({
    runtime: SANDBOX_CONFIG.template,
    ports: [SANDBOX_CONFIG.port],
    timeout: SANDBOX_CONFIG.timeoutMs,
    networkPolicy: "allow-all",
  });
}, 60_000);

afterAll(async () => {
  if (sandbox) {
    try {
      await sandbox.stop({ blocking: true });
    } catch {
      // Sandbox may already be stopped
    }
  }
}, 30_000);

describe.each(CTF_ELIGIBLE_MODELS)("$label ($id)", ({ id }) => {
  const slug = id.replace(/[/.]/g, "-");

  it.concurrent(
    "can use tools to write and read a file",
    async () => {
      const writeFile = tool({
        description: "Write a file to the sandbox.",
        inputSchema: z.object({
          path: z.string(),
          content: z.string(),
        }),
        execute: async ({ path, content }) => {
          await sandbox.writeFiles([{ path, content: Buffer.from(content) }]);
          return { success: true, path };
        },
      });

      const readFile = tool({
        description: "Read a file from the sandbox.",
        inputSchema: z.object({
          path: z.string(),
        }),
        execute: async ({ path }) => {
          const buf = await sandbox.readFileToBuffer({ path });
          if (!buf) return { success: false, error: "File not found" };
          return { success: true, content: buf.toString("utf-8") };
        },
      });

      const result = await generateText({
        model: getModel(id),
        prompt: `Write a file called "${slug}.txt" containing exactly "ok" using the writeFile tool, then read it back using the readFile tool.`,
        tools: { writeFile, readFile },
        maxOutputTokens: 1024,
        stopWhen: stepCountIs(3),
        timeout: { totalMs: 30_000 },
      });

      // The model should have made tool calls
      expect(result.steps.length).toBeGreaterThanOrEqual(1);

      const toolCalls = result.steps.flatMap((s) => s.toolCalls ?? []);
      expect(toolCalls.length).toBeGreaterThanOrEqual(1);

      // Find readFile result
      const toolResults = result.steps.flatMap((s) => s.toolResults ?? []);
      const readResult = toolResults.find(
        (r) => r.toolName === "readFile" && r.result?.content === "ok"
      );
      expect(readResult).toBeDefined();
    },
    30_000
  );
}, { timeout: 5 * 60 * 1000 });
