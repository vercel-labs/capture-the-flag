import { tool } from "ai";
import { z } from "zod";
import type { Sandbox } from "@vercel/sandbox";

export function createSandboxTools(sandbox: Sandbox) {
  return {
    writeFile: tool({
      description:
        "Write a file to the sandbox filesystem. The path is relative to /vercel/sandbox.",
      inputSchema: z.object({
        path: z.string().describe("File path relative to /vercel/sandbox"),
        content: z.string().describe("File content to write"),
      }),
      execute: async ({ path, content }) => {
        await sandbox.writeFiles([
          { path, content: Buffer.from(content) },
        ]);
        return { success: true, path };
      },
    }),

    readFile: tool({
      description:
        "Read a file from the sandbox filesystem. Returns the file content as text.",
      inputSchema: z.object({
        path: z.string().describe("File path relative to /vercel/sandbox"),
      }),
      execute: async ({ path }) => {
        const buf = await sandbox.readFileToBuffer({ path });
        if (!buf) {
          return { success: false, error: "File not found" };
        }
        return { success: true, content: buf.toString("utf-8") };
      },
    }),

    runCommand: tool({
      description:
        "Run a shell command in the sandbox. Returns stdout and stderr.",
      inputSchema: z.object({
        command: z.string().describe("The command to run (e.g., 'npm')"),
        args: z
          .array(z.string())
          .default([])
          .describe("Command arguments"),
        cwd: z
          .string()
          .optional()
          .describe("Working directory (default: /vercel/sandbox)"),
      }),
      execute: async ({ command, args, cwd }) => {
        const result = await sandbox.runCommand({
          cmd: command,
          args,
          cwd,
        });
        const stdout = await result.stdout();
        const stderr = await result.stderr();
        return {
          exitCode: result.exitCode,
          stdout,
          stderr,
        };
      },
    }),
  };
}
