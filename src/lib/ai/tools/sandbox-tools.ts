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
        "Run a shell command in the sandbox and wait for it to complete. " +
        "Returns stdout and stderr. Do NOT use this for long-running processes " +
        "like servers — use startServer instead.",
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

    startServer: tool({
      description:
        "Start a long-running server process in the background (detached). " +
        "Use this to start your web server (e.g., 'node server.js'). " +
        "Returns immediately without waiting for the process to exit.",
      inputSchema: z.object({
        command: z.string().describe("The command to run (e.g., 'node')"),
        args: z
          .array(z.string())
          .default([])
          .describe("Command arguments (e.g., ['server.js'])"),
        cwd: z
          .string()
          .optional()
          .describe("Working directory"),
      }),
      execute: async ({ command, args, cwd }) => {
        await sandbox.runCommand({
          cmd: command,
          args,
          cwd,
          detached: true,
        });
        // Brief wait for the server to start
        await new Promise((r) => setTimeout(r, 2000));
        return {
          started: true,
          message: "Server process started in background.",
        };
      },
    }),
  };
}
