import { describe, it, expect, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createClient, getRuntimeIdentifier } from "assembly-backend";
import { createDecompiler } from "../index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Resolve binary + fixture paths (skip if not built) ──────────────

const rid = getRuntimeIdentifier();
const decompilerBin = path.resolve(
  __dirname,
  "../bin",
  rid,
  process.platform === "win32" ? "AssemblyDecompiler.exe" : "AssemblyDecompiler"
);

const testDll = path.resolve(
  __dirname,
  "../../assembly-backend/tests/fixtures/bin/TestAssembly.dll"
);

const hasDecompiler = fs.existsSync(decompilerBin);
const hasTestDll = fs.existsSync(testDll);

// ── High-level API (createDecompiler → DecompiledAssembly) ──────────

describe.skipIf(!hasDecompiler || !hasTestDll)("Integration — high-level API (createDecompiler)", () => {
  let decompiler;

  afterEach(() => {
    if (decompiler) {
      decompiler.dispose();
      decompiler = null;
    }
  });

  it("loadAssembly returns a DecompiledAssembly with metadata", async () => {
    decompiler = createDecompiler({
      binaryPath: decompilerBin,
      idleTimeoutMs: 0,
      requestTimeout: 15_000,
    });

    const testDllBase64 = fs.readFileSync(testDll).toString("base64");
    const assembly = await decompiler.loadAssembly("api-test", testDllBase64);

    expect(assembly.assemblyId).toBe("api-test");
    expect(assembly.namespaces).toBeInstanceOf(Array);
    expect(assembly.typeCount).toBeGreaterThan(0);
  }, 15_000);

  it("DecompiledAssembly.listTypes returns types for a namespace", async () => {
    decompiler = createDecompiler({
      binaryPath: decompilerBin,
      idleTimeoutMs: 0,
      requestTimeout: 15_000,
    });

    const testDllBase64 = fs.readFileSync(testDll).toString("base64");
    const assembly = await decompiler.loadAssembly("types-test", testDllBase64);

    const types = await assembly.listTypes("TestAssembly");
    expect(types).toBeInstanceOf(Array);
    expect(types.length).toBeGreaterThan(0);
    expect(types[0]).toHaveProperty("fullName");
    expect(types[0]).toHaveProperty("name");
    expect(types[0]).toHaveProperty("kind");
  }, 15_000);

  it("DecompiledAssembly.decompileType returns C# source", async () => {
    decompiler = createDecompiler({
      binaryPath: decompilerBin,
      idleTimeoutMs: 0,
      requestTimeout: 15_000,
    });

    const testDllBase64 = fs.readFileSync(testDll).toString("base64");
    const assembly = await decompiler.loadAssembly("decompile-test", testDllBase64);

    const source = await assembly.decompileType("TestAssembly.SamplePlugin");
    expect(source).toContain("class SamplePlugin");
  }, 15_000);
});

// ── Low-level stdio protocol (AssemblyDecompiler) ───────────────────

describe.skipIf(!hasDecompiler || !hasTestDll)("Integration — stdio mode (AssemblyDecompiler)", () => {
  let client;

  afterEach(() => {
    if (client) {
      client.dispose();
      client = null;
    }
  });

  it("load and unload round-trip via built-in commands", async () => {
    client = createClient({
      binaryPath: decompilerBin,
      mode: "stdio",
      idleTimeoutMs: 0,
      requestTimeout: 15_000,
    });

    const loadResult = await client.invoke("load", {
      assemblyId: "integration-test",
      filePath: testDll,
    });

    expect(loadResult).toMatchObject({
      assemblyId: "integration-test",
      loaded: true,
    });

    const unloadResult = await client.invoke("unload", {
      assemblyId: "integration-test",
    });

    expect(unloadResult).toMatchObject({
      assemblyId: "integration-test",
      unloaded: true,
    });

    // Unload again — should return false
    const unloadAgain = await client.invoke("unload", {
      assemblyId: "integration-test",
    });

    expect(unloadAgain).toMatchObject({
      assemblyId: "integration-test",
      unloaded: false,
    });
  }, 15_000);

  it("shutdown exits cleanly", async () => {
    client = createClient({
      binaryPath: decompilerBin,
      mode: "stdio",
      idleTimeoutMs: 0,
      requestTimeout: 10_000,
    });

    await client.invoke("load", {
      assemblyId: "shutdown-test",
      filePath: testDll,
    });

    const result = await client.invoke("shutdown", {});
    expect(result).toMatchObject({ ok: true });

    await new Promise((r) => setTimeout(r, 200));

    client.dispose();
    client = null;
  }, 10_000);

  it("process persists between invokes", async () => {
    client = createClient({
      binaryPath: decompilerBin,
      mode: "stdio",
      idleTimeoutMs: 0,
      requestTimeout: 10_000,
    });

    await client.invoke("load", {
      assemblyId: "persist-test",
      filePath: testDll,
    });

    const result = await client.invoke("unload", {
      assemblyId: "persist-test",
    });

    expect(result).toMatchObject({ unloaded: true });
  }, 10_000);
});
