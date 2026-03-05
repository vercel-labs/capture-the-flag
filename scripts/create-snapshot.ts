/**
 * Creates a sandbox snapshot with Express pre-installed.
 * Run with: npx tsx scripts/create-snapshot.ts
 *
 * After running, copy the snapshot ID into SANDBOX_CONFIG.snapshotId
 * in src/lib/config/defaults.ts.
 */
import { Sandbox } from "@vercel/sandbox";

async function main() {
  console.log("Creating sandbox...");
  const sandbox = await Sandbox.create({
    runtime: "node24",
    timeout: 5 * 60 * 1000,
    networkPolicy: "allow-all",
  });

  console.log(`Sandbox created: ${sandbox.sandboxId}`);

  console.log("Initializing project and installing Express...");
  const init = await sandbox.runCommand({
    cmd: "npm",
    args: ["init", "-y"],
  });
  console.log(`npm init exit code: ${init.exitCode}`);

  const install = await sandbox.runCommand({
    cmd: "npm",
    args: ["install", "express", "cors"],
  });
  const installStdout = await install.stdout();
  const installStderr = await install.stderr();
  console.log(`npm install exit code: ${install.exitCode}`);
  if (installStdout) console.log(installStdout);
  if (installStderr) console.error(installStderr);

  if (install.exitCode !== 0) {
    console.error("npm install failed, stopping sandbox");
    await sandbox.stop({ blocking: true });
    process.exit(1);
  }

  console.log("Taking snapshot (this stops the sandbox automatically)...");
  const snapshot = await sandbox.snapshot();
  console.log(`\nSnapshot created successfully!`);
  console.log(`Snapshot ID: ${snapshot.snapshotId}`);
  console.log(
    `\nUpdate SANDBOX_CONFIG.snapshotId in src/lib/config/defaults.ts with this value.`
  );
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to create snapshot:", err);
  process.exit(1);
});
