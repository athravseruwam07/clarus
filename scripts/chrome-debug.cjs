#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const isWindows = process.platform === "win32";
const defaultProfileDir = path.join(os.tmpdir(), "clarus-chrome");

const cdpPort = process.env.CLARUS_CDP_PORT || "9222";
const profileDir = process.env.CLARUS_CHROME_PROFILE_DIR || defaultProfileDir;
const startUrl = process.env.CLARUS_START_URL || "http://localhost:3000/login";

function commandExists(command) {
  const probe = isWindows ? "where" : "which";
  const result = spawnSync(probe, [command], { stdio: "ignore", shell: false });
  return result.status === 0;
}

function detectChromeBinary() {
  if (process.env.CLARUS_CHROME_BIN) {
    return process.env.CLARUS_CHROME_BIN;
  }

  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }

  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA || "";
    const candidates = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
  }

  const linuxCandidates = [
    "google-chrome",
    "google-chrome-stable",
    "chromium-browser",
    "chromium",
  ];
  return linuxCandidates.find(commandExists) || null;
}

const chromeBin = detectChromeBinary();
if (!chromeBin) {
  console.error("could not find chrome.");
  console.error("set CLARUS_CHROME_BIN to your chrome binary path and retry.");
  process.exit(1);
}

if (path.isAbsolute(chromeBin) && !fs.existsSync(chromeBin)) {
  console.error(`could not find chrome at: ${chromeBin}`);
  console.error("set CLARUS_CHROME_BIN to your chrome binary path and retry.");
  process.exit(1);
}

fs.mkdirSync(profileDir, { recursive: true });

console.log(`[clarus] launching chrome with remote debugging on port ${cdpPort}`);
console.log(`[clarus] profile dir: ${profileDir}`);
console.log(`[clarus] start url: ${startUrl}`);

const chrome = spawn(
  chromeBin,
  [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    startUrl,
  ],
  {
    detached: true,
    stdio: "ignore",
    shell: false,
  }
);

chrome.unref();

console.log(`[clarus] chrome pid: ${chrome.pid}`);
console.log(
  "[clarus] now set PLAYWRIGHT_CONNECT_OVER_CDP=true in BE/connector/.env and restart the connector"
);

