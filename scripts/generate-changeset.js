#!/usr/bin/env node

/**
 * Auto-generate a changeset file based on:
 *   1. Which packages have file changes (git diff)
 *   2. Conventional commit messages to determine bump level
 *
 * Usage:
 *   node scripts/generate-changeset.js <base-ref>
 *
 * Environment:
 *   BASE_REF  — fallback base ref if not passed as argument (default: master)
 *
 * Conventional commit mapping:
 *   feat:             → minor
 *   fix:, perf:, etc. → patch
 *   BREAKING CHANGE   → major  (in body/footer or feat!:/fix!:)
 *   chore:, docs:, ci:, test:, style:, refactor: → patch (only if package files changed)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const baseRef = process.argv[2] || process.env.BASE_REF || "main";

// ── Package discovery ────────────────────────────────────────────────────────
const packagesDir = path.join(root, "packages");
const allPackages = fs.readdirSync(packagesDir)
    .filter(d => {
        const pkgPath = path.join(packagesDir, d, "package.json");
        return fs.existsSync(pkgPath);
    })
    .map(d => {
        const pkg = JSON.parse(fs.readFileSync(path.join(packagesDir, d, "package.json"), "utf8"));
        return { dir: d, name: pkg.name, private: !!pkg.private };
    });

// Only VS Code extensions (non-private packages, or packages with a "main" pointing to extension)
const extensionPackages = allPackages.filter(p => {
    const pkgJson = JSON.parse(
        fs.readFileSync(path.join(packagesDir, p.dir, "package.json"), "utf8")
    );
    // Extensions have vsce package scripts
    return pkgJson.scripts && pkgJson.scripts.package && pkgJson.scripts.package.includes("vsce");
});

const extensionNames = new Set(extensionPackages.map(p => p.name));

// ── Detect changed files ─────────────────────────────────────────────────────
let changedFiles;
try {
    changedFiles = execSync(`git diff --name-only ${baseRef}...HEAD`, { cwd: root, encoding: "utf8" })
        .trim()
        .split("\n")
        .filter(Boolean);
} catch {
    // Fallback: diff against base ref directly
    changedFiles = execSync(`git diff --name-only ${baseRef} HEAD`, { cwd: root, encoding: "utf8" })
        .trim()
        .split("\n")
        .filter(Boolean);
}

if (changedFiles.length === 0) {
    console.log("No changed files detected. Skipping changeset generation.");
    process.exit(0);
}

// Map changed files to package directories
const changedPackageDirs = new Set();
for (const file of changedFiles) {
    const match = file.match(/^packages\/([^/]+)\//);
    if (match) {
        changedPackageDirs.add(match[1]);
    }
    // Changes to shared infra (scripts/, root config) don't auto-bump packages
}

// Resolve to package names, including dependents for shared libraries
const directlyChanged = allPackages.filter(p => changedPackageDirs.has(p.dir));
const changedNames = new Set(directlyChanged.map(p => p.name));

// If a shared library changed, cascade to its dependents
const sharedLibs = directlyChanged.filter(p => !extensionNames.has(p.name));
if (sharedLibs.length > 0) {
    for (const ext of extensionPackages) {
        const pkgJson = JSON.parse(
            fs.readFileSync(path.join(packagesDir, ext.dir, "package.json"), "utf8")
        );
        const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
        for (const lib of sharedLibs) {
            if (deps[lib.name]) {
                changedNames.add(ext.name);
            }
        }
    }
}

// Filter to only publishable (extension) packages
const packagesToBump = [...changedNames].filter(n => extensionNames.has(n));

if (packagesToBump.length === 0) {
    console.log("No extension packages changed. Skipping changeset generation.");
    process.exit(0);
}

// ── Parse conventional commits for bump level ────────────────────────────────
let commits;
try {
    commits = execSync(`git log --format="%s%n%b---COMMIT_END---" ${baseRef}...HEAD`, { cwd: root, encoding: "utf8" });
} catch {
    commits = execSync(`git log --format="%s%n%b---COMMIT_END---" ${baseRef}..HEAD`, { cwd: root, encoding: "utf8" });
}

const commitMessages = commits.split("---COMMIT_END---").map(c => c.trim()).filter(Boolean);

let bumpLevel = "patch"; // default

for (const msg of commitMessages) {
    // Check for breaking changes
    if (/BREAKING[- ]CHANGE/i.test(msg) || /^[a-z]+(\(.+\))?!:/.test(msg)) {
        bumpLevel = "major";
        break; // major is the highest, no need to check further
    }
    // Check for features
    if (/^feat(\(.+\))?:/.test(msg)) {
        bumpLevel = "minor"; // keep checking for major
    }
}

// ── Generate changeset file ──────────────────────────────────────────────────
const id = crypto.randomBytes(4).toString("hex");
const changesetName = `auto-${id}`;
const changesetDir = path.join(root, ".changeset");

const frontmatter = packagesToBump
    .sort()
    .map(name => `"${name}": ${bumpLevel}`)
    .join("\n");

// Build summary from commit subjects
const subjects = commitMessages
    .map(msg => msg.split("\n")[0]) // first line only
    .filter(s => !/^Merge |^chore: version packages/.test(s));

const summary = subjects.length > 0
    ? subjects.map(s => `- ${s}`).join("\n")
    : `- Auto-generated changeset for ${packagesToBump.length} package(s)`;

const content = `---\n${frontmatter}\n---\n\n${summary}\n`;

fs.writeFileSync(path.join(changesetDir, `${changesetName}.md`), content);

console.log(`Created .changeset/${changesetName}.md`);
console.log(`  Bump: ${bumpLevel}`);
console.log(`  Packages: ${packagesToBump.join(", ")}`);
