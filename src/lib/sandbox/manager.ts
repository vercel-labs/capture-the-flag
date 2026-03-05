import { Sandbox } from "@vercel/sandbox";
import { SANDBOX_CONFIG } from "@/lib/config/defaults";

export interface SandboxInstance {
  sandbox: Sandbox;
  sandboxId: string;
  appUrl: string;
}

/**
 * Create a sandbox for building a vulnerable web app.
 * Starts with allow-all network so the AI can install packages.
 * When a snapshotId is provided, the sandbox starts from a pre-built image
 * (e.g., with Express pre-installed) to save build time.
 */
export async function createBuilderSandbox(
  snapshotId?: string
): Promise<SandboxInstance> {
  const effectiveSnapshot = snapshotId ?? SANDBOX_CONFIG.snapshotId;

  const sandbox = await Sandbox.create(
    effectiveSnapshot
      ? {
          source: { type: "snapshot", snapshotId: effectiveSnapshot },
          ports: [SANDBOX_CONFIG.port],
          timeout: SANDBOX_CONFIG.timeoutMs,
          networkPolicy: "allow-all",
        }
      : {
          runtime: SANDBOX_CONFIG.template,
          ports: [SANDBOX_CONFIG.port],
          timeout: SANDBOX_CONFIG.timeoutMs,
          networkPolicy: "allow-all",
        }
  );

  const appUrl = sandbox.domain(SANDBOX_CONFIG.port);

  return {
    sandbox,
    sandboxId: sandbox.sandboxId,
    appUrl: `https://${appUrl}`,
  };
}

/**
 * Create a sandbox for attacking a target app.
 * Network is restricted to the target URLs and AI Gateway only.
 */
export async function createAttackerSandbox(
  allowedDomains: string[]
): Promise<SandboxInstance> {
  const sandbox = await Sandbox.create({
    runtime: SANDBOX_CONFIG.template,
    ports: [SANDBOX_CONFIG.port],
    timeout: SANDBOX_CONFIG.timeoutMs,
    networkPolicy: {
      allow: [...allowedDomains, "ai-gateway.vercel.sh"],
    },
  });

  const appUrl = sandbox.domain(SANDBOX_CONFIG.port);

  return {
    sandbox,
    sandboxId: sandbox.sandboxId,
    appUrl: `https://${appUrl}`,
  };
}

/**
 * Lock a builder sandbox to deny-all network after build is complete.
 */
export async function lockSandboxNetwork(sandbox: Sandbox): Promise<void> {
  await sandbox.updateNetworkPolicy("deny-all");
}

/**
 * Health check a sandbox URL with retries and exponential backoff.
 */
export async function healthCheck(
  url: string,
  retries = SANDBOX_CONFIG.healthCheckRetries,
  backoffMs = SANDBOX_CONFIG.healthCheckBackoffMs
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok || response.status < 500) {
        return true;
      }
    } catch {
      // continue retrying
    }
    if (i < retries - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, backoffMs * Math.pow(2, i))
      );
    }
  }
  return false;
}

/**
 * Stop a sandbox.
 */
export async function stopSandbox(sandbox: Sandbox): Promise<void> {
  await sandbox.stop({ blocking: true });
}

/**
 * Retrieve an existing sandbox by ID.
 */
export async function getSandbox(sandboxId: string): Promise<Sandbox> {
  return Sandbox.get({ sandboxId });
}
