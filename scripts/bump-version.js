#!/usr/bin/env node

/**
 * Bump the version of all workspace packages in lockstep.
 *
 * Usage:
 *   node scripts/bump-version.js <major|minor|patch> [--pre <tag>] [--no-commit] [--dry-run]
 *   node scripts/bump-version.js --exact <version>     [--no-commit] [--dry-run]
 *
 * Examples:
 *   node scripts/bump-version.js patch                  # 0.1.1-preview → 0.1.2 (stages + commits)
 *   node scripts/bump-version.js minor --pre preview    # 0.1.1-preview → 0.2.0-preview
 *   node scripts/bump-version.js --exact 1.0.0          # → 1.0.0
 *   node scripts/bump-version.js patch --no-commit      # bump only, skip git commit
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let bump = null;   // major | minor | patch
let exact = null;   // explicit version string
let preTag = null;  // e.g. "preview"
let dryRun = false;
let noCommit = false;

for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run")   { dryRun = true; continue; }
    if (a === "--no-commit") { noCommit = true; continue; }
    if (a === "--pre")       { preTag = args[++i]; continue; }
    if (a === "--exact")   { exact  = args[++i]; continue; }
    if (["major", "minor", "patch"].includes(a)) { bump = a; continue; }
    console.error(`Unknown argument: ${a}`);
    process.exit(1);
}

if (!bump && !exact) {
    console.error("Usage: bump-version.js <major|minor|patch> [--pre <tag>] | --exact <version>");
    process.exit(1);
}

// ── Discover workspace packages ─────────────────────────────────────────────
function getPackagePaths() {
    const pkgsDir = path.join(root, "packages");
    return fs.readdirSync(pkgsDir)
        .map(d => path.join(pkgsDir, d, "package.json"))
        .filter(p => fs.existsSync(p));
}

// ── Semver helpers ──────────────────────────────────────────────────────────
function parseVersion(ver) {
    const match = ver.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (!match) throw new Error(`Cannot parse version: ${ver}`);
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        pre: match[4] || null,
    };
}

function bumpVersion(current, part, pre) {
    const v = parseVersion(current);
    switch (part) {
        case "major": v.major++; v.minor = 0; v.patch = 0; break;
        case "minor": v.minor++; v.patch = 0; break;
        case "patch": v.patch++; break;
    }
    const base = `${v.major}.${v.minor}.${v.patch}`;
    return pre ? `${base}-${pre}` : base;
}

// ── Resolve new version ─────────────────────────────────────────────────────
const packagePaths = getPackagePaths();
if (packagePaths.length === 0) {
    console.error("No packages found.");
    process.exit(1);
}

const firstPkg = JSON.parse(fs.readFileSync(packagePaths[0], "utf8"));
const currentVersion = firstPkg.version;
const newVersion = exact || bumpVersion(currentVersion, bump, preTag);

console.log(`\nVersion: ${currentVersion} → ${newVersion}`);
console.log(`Packages: ${packagePaths.length}`);
if (dryRun) console.log("(dry run — no files will be changed)\n");
else console.log();

// ── Apply ───────────────────────────────────────────────────────────────────
for (const pkgPath of packagePaths) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const name = pkg.name;
    const old = pkg.version;

    pkg.version = newVersion;

    if (!dryRun) {
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    }
    console.log(`  ${name}: ${old} → ${newVersion}`);
}

// ── Stage & commit ──────────────────────────────────────────────────────────
if (!dryRun && !noCommit) {
    const filesToStage = packagePaths.map(p => path.relative(root, p));
    execSync(`git add ${filesToStage.join(" ")}`, { cwd: root, stdio: "inherit" });

    const message = `chore: bump all packages to v${newVersion}`;
    execSync(`git commit -m "${message}"`, { cwd: root, stdio: "inherit" });

    console.log(`\nCommitted: ${message}`);
} else if (!dryRun) {
    console.log("\nDone. Skipped commit (--no-commit).");
}
