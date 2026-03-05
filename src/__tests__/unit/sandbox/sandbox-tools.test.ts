import { describe, it, expect, vi } from "vitest";
import { createSandboxTools } from "@/lib/ai/tools/sandbox-tools";

function createMockSandbox() {
  return {
    writeFiles: vi.fn().mockResolvedValue(undefined),
    readFileToBuffer: vi.fn().mockResolvedValue(Buffer.from("test content")),
    runCommand: vi.fn().mockImplementation(({ detached }) => {
      if (detached) {
        // Detached commands return a handle immediately (no stdout/stderr methods)
        return Promise.resolve({ pid: 1234 });
      }
      return Promise.resolve({
        exitCode: 0,
        stdout: () => Promise.resolve("output"),
        stderr: () => Promise.resolve(""),
      });
    }),
  };
}

describe("createSandboxTools", () => {
  it("returns writeFile, readFile, runCommand, and startServer tools", () => {
    const sandbox = createMockSandbox();
    const tools = createSandboxTools(sandbox as never);

    expect(tools).toHaveProperty("writeFile");
    expect(tools).toHaveProperty("readFile");
    expect(tools).toHaveProperty("runCommand");
    expect(tools).toHaveProperty("startServer");
  });

  describe("runCommand", () => {
    it("calls sandbox.runCommand and returns stdout/stderr", async () => {
      const sandbox = createMockSandbox();
      const tools = createSandboxTools(sandbox as never);

      const result = await tools.runCommand.execute(
        { command: "npm", args: ["install"], cwd: undefined },
        { toolCallId: "test", messages: [], abortSignal: undefined as never }
      );

      expect(sandbox.runCommand).toHaveBeenCalledWith({
        cmd: "npm",
        args: ["install"],
        cwd: undefined,
      });
      expect(result).toEqual({
        exitCode: 0,
        stdout: "output",
        stderr: "",
      });
    });

    it("does NOT pass detached flag", async () => {
      const sandbox = createMockSandbox();
      const tools = createSandboxTools(sandbox as never);

      await tools.runCommand.execute(
        { command: "ls", args: [], cwd: undefined },
        { toolCallId: "test", messages: [], abortSignal: undefined as never }
      );

      expect(sandbox.runCommand).toHaveBeenCalledWith(
        expect.not.objectContaining({ detached: true })
      );
    });
  });

  describe("startServer", () => {
    it("calls sandbox.runCommand with detached: true", async () => {
      const sandbox = createMockSandbox();
      const tools = createSandboxTools(sandbox as never);

      const result = await tools.startServer.execute(
        { command: "node", args: ["server.js"], cwd: undefined },
        { toolCallId: "test", messages: [], abortSignal: undefined as never }
      );

      expect(sandbox.runCommand).toHaveBeenCalledWith({
        cmd: "node",
        args: ["server.js"],
        cwd: undefined,
        detached: true,
      });
      expect(result).toEqual({
        started: true,
        message: "Server process started in background.",
      });
    });

    it("passes cwd when provided", async () => {
      const sandbox = createMockSandbox();
      const tools = createSandboxTools(sandbox as never);

      await tools.startServer.execute(
        { command: "node", args: ["server.js"], cwd: "/app" },
        { toolCallId: "test", messages: [], abortSignal: undefined as never }
      );

      expect(sandbox.runCommand).toHaveBeenCalledWith(
        expect.objectContaining({ cwd: "/app" })
      );
    });
  });
});
