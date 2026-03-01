#!/usr/bin/env node
/**
 * Build script for the PluginAnalyzer .NET CLI tool.
 *
 * Usage:
 *   node build.js            # Build for current platform
 *   node build.js --all      # Build for all supported platforms
 *   node build.js --platform osx-arm64  # Build for specific RID
 */
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const RIDS = ["win-x64", "linux-x64", "osx-x64", "osx-arm64"];
const DOTNET_DIR = path.join(__dirname, "dotnet");
const BIN_DIR = path.join(__dirname, "bin");
const CSPROJ = path.join(DOTNET_DIR, "PluginAnalyzer.csproj");

function getCurrentRid() {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  switch (process.platform) {
    case "win32": return `win-${arch}`;
    case "darwin": return `osx-${arch}`;
    default: return `linux-${arch}`;
  }
}

function hasDotnet() {
  try {
    execSync("dotnet --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function buildForRid(rid) {
  const outputDir = path.join(BIN_DIR, rid);
  console.log(`[analyzer] Building ${rid}...`);
  execSync(
    `dotnet publish "${CSPROJ}" ` +
    `--runtime ${rid} ` +
    `--self-contained true ` +
    `--configuration Release ` +
    `--output "${outputDir}" ` +
    `-p:PublishSingleFile=true ` +
    `-p:StripSymbols=true ` +
    `-p:DebugType=none`,
    { stdio: "inherit" },
  );
  console.log(`[analyzer]   -> ${outputDir}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (!hasDotnet()) {
  console.warn("[analyzer] dotnet SDK not found — skipping .NET build");
  process.exit(0);
}

const buildAll = process.argv.includes("--all");
const platformIdx = process.argv.indexOf("--platform");
const platformArg = platformIdx !== -1 ? process.argv[platformIdx + 1] : undefined;

const rids = buildAll ? RIDS : [platformArg || process.env.DOTNET_RID || getCurrentRid()];

fs.mkdirSync(BIN_DIR, { recursive: true });
for (const rid of rids) {
  buildForRid(rid);
}
console.log("[analyzer] Build complete.");
