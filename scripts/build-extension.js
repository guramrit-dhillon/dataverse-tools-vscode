const { context } = require("esbuild");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const extensionRoot = process.cwd();
const outDir = path.join(extensionRoot, "out");

function log(msg) {
  console.log(`[build] ${msg}`);
}

// ── .NET workspace packages that must be kept external ────────────────────────
// These are require()'d at runtime and must not be bundled by esbuild.
const DOTNET_PACKAGES = [
  "assembly-backend",
  "dataverse-assembly-analyzer",
  "assembly-decompiler",
];

async function getWebviewEntries() {
  const viewsDir = path.join(extensionRoot, "views");

  if (!fs.existsSync(viewsDir)) {
    return [];
  }

  const files = await fsp.readdir(viewsDir);

  return files
    .filter(f => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map(f => path.join(viewsDir, f));
}

async function clean() {
  await fsp.rm(outDir, { recursive: true, force: true });
}

/**
 * Detect which .NET packages this extension depends on by checking
 * the extension's own package.json dependencies.
 */
function getDotnetDependencies() {
  const pkgJsonPath = path.join(extensionRoot, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    return [];
  }
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  return DOTNET_PACKAGES.filter(name => name in allDeps);
}

function createExtensionBuild() {
  const dotnetDeps = getDotnetDependencies();
  const external = ["vscode", ...dotnetDeps];

  return context({
    entryPoints: [path.join(extensionRoot, "src/extension.ts")],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node18",
    outfile: path.join(outDir, "extension.js"),
    minify: production,
    sourcemap: true,
    sourcesContent: false,
    external,
    logLevel: "silent",
    loader: {
      ".html": "text",
      ".svg": "text",
      ".txt": "text",
      ".css": "text"
    }
  });
}

function createWebviewBuild(entries) {
  return context({
    entryPoints: entries,
    bundle: true,
    platform: "browser",
    format: "iife",
    target: ["chrome100"],
    outdir: path.join(outDir, "views"),
    minify: false,
    sourcemap: 'external',
    sourcesContent: false,
    // vscode-webview is provided by the VS Code runtime in webview context — not bundled
    external: ["vscode-webview"],
    logLevel: "silent"
  });
}

async function copyCodiconAssets() {
  const viewsOut = path.join(outDir, "views");
  await fsp.mkdir(viewsOut, { recursive: true });
  try {
    const codiconsDir = path.join(
      path.dirname(require.resolve("@vscode/codicons/package.json")),
      "dist"
    );
    await fsp.copyFile(path.join(codiconsDir, "codicon.ttf"), path.join(viewsOut, "codicon.ttf"));
    await fsp.copyFile(path.join(codiconsDir, "codicon.css"), path.join(viewsOut, "codicon.css"));
    log("Copied codicon assets");
  } catch {
    // @vscode/codicons not installed — skip silently
  }
}

function getRuntimeIdentifier() {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  switch (process.platform) {
    case "win32": return `win-${arch}`;
    case "darwin": return `osx-${arch}`;
    default: return `linux-${arch}`;
  }
}

/**
 * Copy .NET workspace package files into the extension's output directory
 * so the extension works in production (VSIX) without npm workspace symlinks.
 *
 * Copies: package.json, index.js, and the current platform's binary.
 * Recursively copies transitive DOTNET_PACKAGES dependencies.
 */
async function copyNpmDependencies() {
  const dotnetDeps = getDotnetDependencies();
  if (dotnetDeps.length === 0) {
    return;
  }

  const rid = getRuntimeIdentifier();
  const copied = new Set();

  async function copyPackage(pkg) {
    if (copied.has(pkg)) {
      return;
    }
    copied.add(pkg);

    let pkgDir;
    try {
      pkgDir = path.dirname(
        require.resolve(`${pkg}/package.json`, { paths: [extensionRoot] })
      );
    } catch {
      return;
    }

    const destDir = path.join(outDir, "node_modules", pkg);
    await fsp.mkdir(destDir, { recursive: true });

    // Copy package.json and index.js
    for (const file of ["package.json", "index.js"]) {
      const src = path.join(pkgDir, file);
      if (fs.existsSync(src)) {
        await fsp.copyFile(src, path.join(destDir, file));
      }
    }

    // Copy platform-specific binary (if this package has one)
    const srcBinDir = path.join(pkgDir, "bin", rid);
    if (fs.existsSync(srcBinDir)) {
      const destBinDir = path.join(destDir, "bin", rid);
      await fsp.mkdir(destBinDir, { recursive: true });

      const files = await fsp.readdir(srcBinDir);
      for (const file of files) {
        await fsp.copyFile(
          path.join(srcBinDir, file),
          path.join(destBinDir, file),
        );
      }
      log(`Copied ${pkg} binary for ${rid}`);
    } else if (fs.existsSync(path.join(pkgDir, "bin"))) {
      log(`Warning: ${pkg}/bin/${rid} not found — skipping binary copy`);
    }

    // Recursively copy transitive DOTNET_PACKAGES dependencies
    const depPkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
    const depDeps = depPkg.dependencies || {};
    for (const transitive of DOTNET_PACKAGES) {
      if (transitive in depDeps) {
        await copyPackage(transitive);
      }
    }
  }

  for (const pkg of dotnetDeps) {
    await copyPackage(pkg);
  }
}

async function main() {
  log(`Building extension in ${extensionRoot}`);
  await clean();

  const webviewEntries = await getWebviewEntries();

  const builds = [];
  builds.push(createExtensionBuild());

  if (webviewEntries.length > 0) {
    builds.push(createWebviewBuild(webviewEntries));
  }

  const contexts = await Promise.all(builds);

  if (watch) {
    log("Watching...");
    await Promise.all(contexts.map(ctx => ctx.watch()));
  } else {
    await Promise.all(contexts.map(ctx => ctx.rebuild()));
    await Promise.all(contexts.map(ctx => ctx.dispose()));
    log("Build complete");
  }

  await copyCodiconAssets();
  await copyNpmDependencies();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
