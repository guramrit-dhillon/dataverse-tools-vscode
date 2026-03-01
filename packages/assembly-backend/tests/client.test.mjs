import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { Writable } from "stream";
import childProcess from "child_process";
import fs from "fs";

// Patch the real child_process and fs at runtime since vitest's vi.mock
// doesn't intercept require() inside CJS modules.
const originalSpawn = childProcess.spawn;
const originalExistsSync = fs.existsSync;

let mockSpawnFn;
let mockExistsSyncFn;

function patchModules() {
  childProcess.spawn = (...args) => mockSpawnFn(...args);
  fs.existsSync = (...args) => mockExistsSyncFn(...args);
}

function restoreModules() {
  childProcess.spawn = originalSpawn;
  fs.existsSync = originalExistsSync;
}

const {
  getRuntimeIdentifier,
  getBinaryPath,
  BackendClient,
  createClient,
  SUPPORTED_RIDS,
  DEFAULT_IDLE_TIMEOUT,
  DEFAULT_REQUEST_TIMEOUT,
} = await import("../index.js");

// ── Helpers ──────────────────────────────────────────────────────────

function createMockProcess() {
  const proc = new EventEmitter();
  proc.stdin = new Writable({ write(_, __, cb) { cb(); } });
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();
  proc.stdin._written = [];
  const origWrite = proc.stdin.write.bind(proc.stdin);
  proc.stdin.write = vi.fn((data, enc, cb) => {
    proc.stdin._written.push(data);
    if (typeof enc === "function") return origWrite(data, enc);
    return origWrite(data, enc, cb);
  });
  return proc;
}

// Yield to the microtask queue so async _ensureProcess resolves
// and _pending map is populated before we emit mock responses.
const tick = () => new Promise((r) => process.nextTick(r));

let mockProc;

// ── Utility function tests ────────────────────────────────────────────

describe("getRuntimeIdentifier", () => {
  it("returns a supported RID", () => {
    const rid = getRuntimeIdentifier();
    expect(SUPPORTED_RIDS).toContain(rid);
  });
});

describe("getBinaryPath", () => {
  afterEach(() => restoreModules());

  it("returns path when binary exists", () => {
    mockExistsSyncFn = () => true;
    patchModules();
    const p = getBinaryPath("TestBin", { binDir: "/some/dir" });
    expect(p).toContain("TestBin");
    expect(p).toContain(getRuntimeIdentifier());
  });

  it("throws when binary does not exist", () => {
    mockExistsSyncFn = () => false;
    patchModules();
    expect(() => getBinaryPath("Missing", { binDir: "/some/dir" })).toThrow(/Binary not found/);
  });
});

describe("createClient", () => {
  it("returns a BackendClient instance", () => {
    const client = createClient({ binaryPath: "/bin/test" });
    expect(client).toBeInstanceOf(BackendClient);
    client.dispose();
  });
});

describe("constants", () => {
  it("exports expected defaults", () => {
    expect(DEFAULT_IDLE_TIMEOUT).toBe(300_000);
    expect(DEFAULT_REQUEST_TIMEOUT).toBe(30_000);
    expect(SUPPORTED_RIDS).toHaveLength(4);
  });
});

// ── Exec mode tests ──────────────────────────────────────────────────

describe("BackendClient — exec mode", () => {
  beforeEach(() => {
    mockProc = createMockProcess();
    mockSpawnFn = vi.fn(() => mockProc);
    mockExistsSyncFn = () => true;
    patchModules();
  });

  afterEach(() => restoreModules());

  it("spawns with --exec --method --params", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "exec" });
    const promise = client.invoke("doSomething", { key: "value" });

    mockProc.stdout.emit("data", Buffer.from(JSON.stringify({ id: "exec", result: { ok: true } })));
    mockProc.emit("close", 0);

    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(mockSpawnFn.mock.calls[0][1]).toContain("--exec");
    expect(mockSpawnFn.mock.calls[0][1]).toContain("doSomething");
    expect(mockSpawnFn.mock.calls[0][1]).toContain(JSON.stringify({ key: "value" }));
    client.dispose();
  });

  it("omits --params when params is undefined", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "exec" });
    const promise = client.invoke("noParams");

    mockProc.stdout.emit("data", Buffer.from(JSON.stringify({ id: "exec", result: null })));
    mockProc.emit("close", 0);
    await promise;

    expect(mockSpawnFn.mock.calls[0][1]).not.toContain("--params");
    client.dispose();
  });

  it("rejects when response has error field", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "exec" });
    const promise = client.invoke("fail");

    mockProc.stdout.emit("data", Buffer.from(JSON.stringify({
      id: "exec", error: { code: "TEST_ERROR", message: "something broke" },
    })));
    mockProc.emit("close", 1);

    await expect(promise).rejects.toMatchObject({ code: "TEST_ERROR", message: "something broke" });
    client.dispose();
  });

  it("rejects with PARSE_FAILED when stdout is invalid JSON", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "exec" });
    const promise = client.invoke("bad");

    mockProc.stdout.emit("data", Buffer.from("not json at all"));
    mockProc.emit("close", 1);

    await expect(promise).rejects.toMatchObject({ code: "PARSE_FAILED" });
    client.dispose();
  });

  it("rejects with NOT_FOUND on spawn error", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "exec" });
    const promise = client.invoke("cmd");

    mockProc.emit("error", new Error("ENOENT"));
    await expect(promise).rejects.toMatchObject({ code: "NOT_FOUND" });
    client.dispose();
  });

  it("rejects after dispose", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "exec" });
    client.dispose();
    await expect(client.invoke("cmd")).rejects.toThrow("disposed");
  });
});

// ── Stdio mode tests ─────────────────────────────────────────────────

describe("BackendClient — stdio mode", () => {
  beforeEach(() => {
    mockProc = createMockProcess();
    mockSpawnFn = vi.fn(() => mockProc);
    mockExistsSyncFn = () => true;
    patchModules();
  });

  afterEach(() => restoreModules());

  function emitResponse(id, result) {
    mockProc.stdout.emit("data", Buffer.from(JSON.stringify({ id, result }) + "\n"));
  }

  function emitError(id, code, message) {
    mockProc.stdout.emit("data", Buffer.from(JSON.stringify({ id, error: { code, message } }) + "\n"));
  }

  it("spawns process with --stdio on first invoke", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 0 });
    const promise = client.invoke("cmd", { x: 1 });

    await tick();
    expect(mockSpawnFn).toHaveBeenCalledOnce();
    expect(mockSpawnFn.mock.calls[0][1]).toEqual(["--stdio"]);

    emitResponse("req-1", { done: true });
    expect(await promise).toEqual({ done: true });
    client.dispose();
  });

  it("reuses process on subsequent invokes", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 0 });

    const p1 = client.invoke("cmd1");
    await tick();
    emitResponse("req-1", "a");
    await p1;

    const p2 = client.invoke("cmd2");
    await tick();
    emitResponse("req-2", "b");
    await p2;

    expect(mockSpawnFn).toHaveBeenCalledOnce();
    client.dispose();
  });

  it("sends correct JSON-RPC message to stdin", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 0 });

    const promise = client.invoke("myCommand", { arg: 42 });
    await tick();
    emitResponse("req-1", "ok");
    await promise;

    const parsed = JSON.parse(mockProc.stdin._written[0]);
    expect(parsed).toEqual({ id: "req-1", command: "myCommand", params: { arg: 42 } });
    client.dispose();
  });

  it("rejects when response has error", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 0 });

    const promise = client.invoke("fail");
    await tick();
    emitError("req-1", "BAD", "oops");

    await expect(promise).rejects.toThrow("[BAD] oops");
    client.dispose();
  });

  it("handles multiple concurrent requests", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 0 });

    const p1 = client.invoke("cmd1");
    const p2 = client.invoke("cmd2");
    const p3 = client.invoke("cmd3");

    await tick();

    // Respond out of order
    emitResponse("req-3", "c");
    emitResponse("req-1", "a");
    emitResponse("req-2", "b");

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1).toBe("a");
    expect(r2).toBe("b");
    expect(r3).toBe("c");
    client.dispose();
  });

  it("rejects all pending on process close", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 0 });

    const p1 = client.invoke("cmd1");
    const p2 = client.invoke("cmd2");
    await tick();

    mockProc.emit("close", 1);

    await expect(p1).rejects.toThrow(/exited/);
    await expect(p2).rejects.toThrow(/exited/);
    client.dispose();
  });

  it("rejects all pending on process error", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 0 });

    const p1 = client.invoke("cmd");
    await tick();
    mockProc.emit("error", new Error("crash"));

    await expect(p1).rejects.toThrow(/process error/);
    client.dispose();
  });

  it("skips blank lines in stdout", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 0 });

    const promise = client.invoke("cmd");
    await tick();
    mockProc.stdout.emit("data", Buffer.from("\n\n" + JSON.stringify({ id: "req-1", result: "ok" }) + "\n"));

    expect(await promise).toBe("ok");
    client.dispose();
  });

  it("skips invalid JSON lines without crashing", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 0 });

    const promise = client.invoke("cmd");
    await tick();
    mockProc.stdout.emit("data", Buffer.from("not json\n" + JSON.stringify({ id: "req-1", result: "ok" }) + "\n"));

    expect(await promise).toBe("ok");
    client.dispose();
  });

  it("skips unmatched response IDs", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 0 });

    const promise = client.invoke("cmd");
    await tick();
    emitResponse("req-999", "wrong");
    emitResponse("req-1", "right");

    expect(await promise).toBe("right");
    client.dispose();
  });

  it("rejects after dispose", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 0 });

    const p = client.invoke("cmd");
    await tick();
    emitResponse("req-1", "ok");
    await p;

    client.dispose();
    await expect(client.invoke("cmd")).rejects.toThrow("disposed");
  });
});

// ── Idle timeout tests ───────────────────────────────────────────────

describe("BackendClient — idle timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockProc = createMockProcess();
    mockSpawnFn = vi.fn(() => mockProc);
    mockExistsSyncFn = () => true;
    patchModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreModules();
  });

  function emitResponse(id, result) {
    mockProc.stdout.emit("data", Buffer.from(JSON.stringify({ id, result }) + "\n"));
  }

  it("sends shutdown after idle timeout", async () => {
    const client = createClient({
      binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 5000, requestTimeout: 60000,
    });

    const p = client.invoke("cmd");
    await vi.advanceTimersByTimeAsync(0); // flush microtasks
    emitResponse("req-1", "ok");
    await p;

    await vi.advanceTimersByTimeAsync(5000);

    const shutdownWrite = mockProc.stdin._written.find((w) => w.includes('"shutdown"'));
    expect(shutdownWrite).toBeDefined();
    client.dispose();
  });

  it("does not set timer when idleTimeoutMs <= 0", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 0 });

    const p = client.invoke("cmd");
    await vi.advanceTimersByTimeAsync(0);
    emitResponse("req-1", "ok");
    await p;

    vi.advanceTimersByTime(999999);

    const shutdownWrite = mockProc.stdin._written.find((w) => w.includes('"shutdown"'));
    expect(shutdownWrite).toBeUndefined();
    client.dispose();
  });

  it("resets timer on each invoke", async () => {
    const client = createClient({
      binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 5000, requestTimeout: 60000,
    });

    const p1 = client.invoke("cmd1");
    await vi.advanceTimersByTimeAsync(0);
    emitResponse("req-1", "ok");
    await p1;

    vi.advanceTimersByTime(3000);

    const p2 = client.invoke("cmd2");
    await vi.advanceTimersByTimeAsync(0);
    emitResponse("req-2", "ok");
    await p2;

    await vi.advanceTimersByTimeAsync(3000);
    expect(mockProc.stdin._written.filter((w) => w.includes('"shutdown"'))).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(2000);
    expect(mockProc.stdin._written.filter((w) => w.includes('"shutdown"'))).toHaveLength(1);

    client.dispose();
  });
});

// ── Request timeout tests ────────────────────────────────────────────

describe("BackendClient — request timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockProc = createMockProcess();
    mockSpawnFn = vi.fn(() => mockProc);
    mockExistsSyncFn = () => true;
    patchModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreModules();
  });

  it("rejects after requestTimeout ms", async () => {
    const client = createClient({
      binaryPath: "/bin/test", mode: "stdio", requestTimeout: 1000, idleTimeoutMs: 0,
    });

    const promise = client.invoke("slow");
    await vi.advanceTimersByTimeAsync(0);
    vi.advanceTimersByTime(1000);

    await expect(promise).rejects.toThrow(/timed out/);
    client.dispose();
  });

  it("clears timeout on successful response", async () => {
    const client = createClient({
      binaryPath: "/bin/test", mode: "stdio", requestTimeout: 1000, idleTimeoutMs: 0,
    });

    const promise = client.invoke("fast");
    await vi.advanceTimersByTimeAsync(0);
    mockProc.stdout.emit("data", Buffer.from(JSON.stringify({ id: "req-1", result: "quick" }) + "\n"));

    expect(await promise).toBe("quick");
    vi.advanceTimersByTime(2000);
    client.dispose();
  });
});

// ── Dispose tests ────────────────────────────────────────────────────

describe("BackendClient — dispose", () => {
  beforeEach(() => {
    mockProc = createMockProcess();
    mockSpawnFn = vi.fn(() => mockProc);
    mockExistsSyncFn = () => true;
    patchModules();
  });

  afterEach(() => restoreModules());

  it("kills process on dispose", async () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "stdio", idleTimeoutMs: 0 });

    const p = client.invoke("cmd");
    await tick();
    mockProc.stdout.emit("data", Buffer.from(JSON.stringify({ id: "req-1", result: "ok" }) + "\n"));
    await p;

    client.dispose();
    expect(mockProc.kill).toHaveBeenCalled();
  });

  it("safe to call dispose multiple times", () => {
    const client = createClient({ binaryPath: "/bin/test", mode: "exec" });
    client.dispose();
    client.dispose();
    client.dispose();
  });
});
