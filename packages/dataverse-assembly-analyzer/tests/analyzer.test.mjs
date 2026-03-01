import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createClient, getRuntimeIdentifier } from "assembly-backend";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Resolve binary + fixture paths (skip if not built) ──────────────

const rid = getRuntimeIdentifier();
const analyzerBin = path.resolve(
  __dirname,
  "../bin",
  rid,
  process.platform === "win32" ? "PluginAnalyzer.exe" : "PluginAnalyzer"
);

const testDll = path.resolve(
  __dirname,
  "../../assembly-backend/tests/fixtures/bin/TestAssembly.dll"
);

const hasAnalyzer = fs.existsSync(analyzerBin);
const hasTestDll = fs.existsSync(testDll);

// ── Exec mode integration (PluginAnalyzer) ──────────────────────────

describe.skipIf(!hasAnalyzer || !hasTestDll)("Integration — exec mode (PluginAnalyzer)", () => {
  it("analyzes a .NET assembly via exec mode", async () => {
    const client = createClient({
      binaryPath: analyzerBin,
      mode: "exec",
      requestTimeout: 30_000,
    });

    try {
      const result = await client.invoke("analyzePlugins", {
        assemblyPath: testDll,
      });
      expect(result).toBeDefined();
      expect(result.assemblyName).toBe("TestAssembly");
    } finally {
      client.dispose();
    }
  }, 30_000);

  it("returns error for unknown command", async () => {
    const client = createClient({
      binaryPath: analyzerBin,
      mode: "exec",
      requestTimeout: 10_000,
    });

    try {
      await expect(
        client.invoke("nonExistentCommand", {})
      ).rejects.toMatchObject({ code: "UNKNOWN_COMMAND" });
    } finally {
      client.dispose();
    }
  }, 10_000);

  it("loads assembly via built-in load command", async () => {
    const client = createClient({
      binaryPath: analyzerBin,
      mode: "exec",
      requestTimeout: 10_000,
    });

    try {
      const result = await client.invoke("load", {
        assemblyId: "test-assembly",
        filePath: testDll,
      });
      expect(result).toMatchObject({
        assemblyId: "test-assembly",
        loaded: true,
      });
    } finally {
      client.dispose();
    }
  }, 10_000);
});
