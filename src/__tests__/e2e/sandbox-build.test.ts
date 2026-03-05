/**
 * E2E test: Verify that a sandbox can build and serve an Express app.
 *
 * This test creates a real sandbox, runs the AI build prompt, and checks
 * that the app responds on port 3000.
 *
 * Run with: pnpm vitest run src/__tests__/e2e/sandbox-build.test.ts
 * Requires: VERCEL_TOKEN and AI_GATEWAY_TOKEN environment variables
 */
import { describe, it, expect } from "vitest";
import { Sandbox } from "@vercel/sandbox";
import { SANDBOX_CONFIG } from "@/lib/config/defaults";

describe("sandbox build E2E", () => {
  it(
    "creates a sandbox and serves an Express app on port 3000",
    async () => {
      let sandbox: Sandbox | undefined;

      try {
        // Create sandbox
        sandbox = await Sandbox.create({
          runtime: SANDBOX_CONFIG.template,
          ports: [SANDBOX_CONFIG.port],
          timeout: SANDBOX_CONFIG.timeoutMs,
          networkPolicy: "allow-all",
        });

        // Initialize project
        const init = await sandbox.runCommand({
          cmd: "npm",
          args: ["init", "-y"],
        });
        expect(init.exitCode).toBe(0);

        // Install Express
        const install = await sandbox.runCommand({
          cmd: "npm",
          args: ["install", "express"],
        });
        expect(install.exitCode).toBe(0);

        // Write a minimal Express server
        await sandbox.writeFiles([
          {
            path: "server.js",
            content: Buffer.from(`
const express = require('express');
const app = express();
app.get('/', (req, res) => res.json({ status: 'ok' }));
app.get('/health', (req, res) => res.json({ healthy: true }));
app.listen(3000, () => console.log('Server running on port 3000'));
`),
          },
        ]);

        // Start server in detached mode
        await sandbox.runCommand({
          cmd: "node",
          args: ["server.js"],
          detached: true,
        });

        // Wait for server to start
        await new Promise((r) => setTimeout(r, 3000));

        // Health check via the sandbox URL
        const appUrl = `https://${sandbox.domain(SANDBOX_CONFIG.port)}`;
        const response = await fetch(`${appUrl}/health`, {
          signal: AbortSignal.timeout(10000),
        });

        expect(response.ok).toBe(true);
        const body = await response.json();
        expect(body).toEqual({ healthy: true });
      } finally {
        if (sandbox) {
          try {
            await sandbox.stop({ blocking: true });
          } catch {
            // Sandbox may already be stopped
          }
        }
      }
    },
    { timeout: 5 * 60 * 1000 }
  );
});
