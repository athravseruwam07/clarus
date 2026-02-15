#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const npmExecPath = process.env.npm_execpath;

function run(command, args, cwd, shell) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNpm(args, cwd) {
  if (npmExecPath) {
    run(process.execPath, [npmExecPath, ...args], cwd, false);
    return;
  }

  run("npm", args, cwd, isWindows);
}

function runNpx(args, cwd) {
  if (npmExecPath) {
    run(process.execPath, [npmExecPath, "exec", "--", ...args], cwd, false);
    return;
  }

  run("npx", args, cwd, isWindows);
}

function ensureDockerRunning() {
  const result = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (result.status !== 0) {
    console.error("docker is not running. start docker desktop and retry.");
    process.exit(1);
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForContainerHealthy(containerName, timeoutMs = 120000) {
  const startedAt = Date.now();
  console.log(`[clarus] waiting for ${containerName} to become healthy`);

  while (Date.now() - startedAt < timeoutMs) {
    const result = spawnSync(
      "docker",
      ["inspect", "--format", "{{.State.Health.Status}}", containerName],
      { encoding: "utf8", shell: false }
    );

    if (result.status === 0) {
      const status = result.stdout.trim();
      if (status === "healthy") {
        return;
      }
      if (status === "unhealthy") {
        console.error(`${containerName} is unhealthy.`);
        process.exit(1);
      }
    }

    sleep(2000);
  }

  console.error(`timed out waiting for ${containerName} to become healthy.`);
  process.exit(1);
}

ensureDockerRunning();

console.log("[clarus] starting postgres");
run("docker", ["compose", "up", "-d"], path.join(rootDir, "BE"), false);
waitForContainerHealthy("clarus-postgres");

console.log("[clarus] installing connector deps + chromium");
runNpm(["install"], path.join(rootDir, "BE", "connector"));
runNpx(["playwright", "install", "chromium"], path.join(rootDir, "BE", "connector"));

console.log("[clarus] installing api deps + prisma");
runNpm(["install"], path.join(rootDir, "BE", "api"));
runNpx(["prisma", "generate"], path.join(rootDir, "BE", "api"));
runNpx(["prisma", "db", "push"], path.join(rootDir, "BE", "api"));

console.log("[clarus] installing frontend deps");
runNpm(["install"], path.join(rootDir, "FE"));

console.log("[clarus] setup complete");
