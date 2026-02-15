#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const npmExecPath = process.env.npm_execpath;
const npmCommand = npmExecPath ? process.execPath : "npm";
const npmBaseArgs = npmExecPath ? [npmExecPath] : [];
const npmUsesShell = !npmExecPath && isWindows;
const backendOnly = process.argv.includes("--backend-only");

const services = backendOnly
  ? [
      { name: "connector", dir: path.join(rootDir, "BE", "connector"), port: 4002 },
      { name: "api", dir: path.join(rootDir, "BE", "api"), port: 4001 },
    ]
  : [
      { name: "connector", dir: path.join(rootDir, "BE", "connector"), port: 4002 },
      { name: "api", dir: path.join(rootDir, "BE", "api"), port: 4001 },
      { name: "frontend", dir: path.join(rootDir, "FE"), port: 3000 },
    ];

let shuttingDown = false;
const childProcesses = [];

function ensureDockerRunning() {
  const result = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (result.status !== 0) {
    console.error("docker is not running. start docker desktop and retry.");
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForContainerHealthy(containerName, timeoutMs = 120000) {
  const startedAt = Date.now();
  console.log(`[clarus] waiting for ${containerName} to become healthy`);

  while (Date.now() - startedAt < timeoutMs) {
    const result = spawnSync(
      "docker",
      ["inspect", "--format", "{{.State.Health.Status}}", containerName],
      { encoding: "utf8" }
    );

    if (result.status === 0) {
      const status = result.stdout.trim();
      if (status === "healthy") {
        return;
      }
      if (status === "unhealthy") {
        throw new Error(`${containerName} is unhealthy.`);
      }
    }

    await sleep(2000);
  }

  throw new Error(`timed out waiting for ${containerName} to become healthy.`);
}

function runCommand(command, args, options = {}) {
  const { cwd = rootDir, stdio = "inherit", allowFailure = false } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio, shell: false });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || allowFailure) {
        resolve(code);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

function ensurePortFree(port, service) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        reject(
          new Error(
            `port ${port} is already in use. stop that process before starting ${service}.`
          )
        );
        return;
      }
      reject(error);
    });

    server.listen(port, () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve();
      });
    });
  });
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => {
      resolve(false);
    });

    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForServiceReady(service, timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnect(service.port)) {
      return;
    }
    await sleep(1000);
  }

  throw new Error(`timed out waiting for ${service.name} on port ${service.port}.`);
}

function startService(service) {
  console.log(`[clarus] starting ${service.name}`);
  let child;
  try {
    child = spawn(npmCommand, [...npmBaseArgs, "run", "dev"], {
      cwd: service.dir,
      stdio: "inherit",
      detached: !isWindows,
      shell: npmUsesShell,
    });
  } catch (error) {
    console.error(`[clarus] failed to start ${service.name}:`, error.message);
    void shutdown(1);
    return;
  }

  child.on("error", (error) => {
    console.error(`[clarus] failed to start ${service.name}:`, error.message);
    void shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[clarus] ${service.name} exited (${reason}). stopping services.`);
    void shutdown(typeof code === "number" ? code : 1);
  });

  childProcesses.push(child);
}

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null || !child.pid) {
    return;
  }

  if (isWindows) {
    await runCommand(
      "taskkill",
      ["/pid", String(child.pid), "/t", "/f"],
      { stdio: "ignore", allowFailure: true }
    );
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    // Process is already gone.
  }
}

async function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[clarus] stopping ${backendOnly ? "backend services" : "services"}`);
  await Promise.all(childProcesses.map(stopChildProcess));
  process.exit(exitCode);
}

async function main() {
  ensureDockerRunning();

  for (const service of services) {
    await ensurePortFree(service.port, service.name);
  }

  await runCommand("docker", ["compose", "up", "-d"], {
    cwd: path.join(rootDir, "BE"),
  });
  await waitForContainerHealthy("clarus-postgres");

  const backendServices = services.filter((service) => service.name !== "frontend");
  const frontendService = services.find((service) => service.name === "frontend");

  for (const service of backendServices) {
    startService(service);
  }

  for (const service of backendServices) {
    await waitForServiceReady(service);
  }

  if (!backendOnly) {
    if (!frontendService) {
      throw new Error("frontend service definition is missing.");
    }
    startService(frontendService);
    await waitForServiceReady(frontendService);
  }
}

process.on("SIGINT", () => {
  void shutdown(0);
});

process.on("SIGTERM", () => {
  void shutdown(0);
});

process.on("unhandledRejection", (error) => {
  console.error(error);
  void shutdown(1);
});

process.on("uncaughtException", (error) => {
  console.error(error);
  void shutdown(1);
});

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
