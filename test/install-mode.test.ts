import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import {
  isNpxCachePath,
  globalCliPath,
  resolveInstallMode,
  serverForMode,
  modeForServerPath,
} from "../src/install-mode.js";
import type { ServerCommand } from "../src/clients.js";

const FAKE_ROOT = join("fake", "npm-root");
const CACHE_CLI = join("home", "x", ".npm", "_npx", "abc123", "node_modules", "@dwgintel", "loop", "dist", "cli.js");
const GLOBAL_CLI = join(FAKE_ROOT, "@dwgintel", "loop", "dist", "cli.js");
const LOCAL_CLI = join("repo", "dwg-loopkit", "dist", "cli.js");

describe("isNpxCachePath", () => {
  it("detects npx cache paths case-insensitively", () => {
    expect(isNpxCachePath(CACHE_CLI)).toBe(true);
    expect(isNpxCachePath("C:\\Users\\x\\AppData\\Local\\npm-cache\\_NPX\\abc\\cli.js")).toBe(true);
    expect(isNpxCachePath(LOCAL_CLI)).toBe(false);
  });
});

describe("globalCliPath", () => {
  it("joins the expected package path", () => {
    expect(globalCliPath(FAKE_ROOT)).toBe(GLOBAL_CLI);
  });
});

describe("resolveInstallMode", () => {
  it("recorded mode wins over everything", () => {
    expect(resolveInstallMode({ install: { mode: "global", server: CACHE_CLI }, runtimeCliPath: CACHE_CLI, npmRootG: FAKE_ROOT })).toBe("global");
    expect(resolveInstallMode({ install: { mode: "npx-cache", server: GLOBAL_CLI }, runtimeCliPath: GLOBAL_CLI, npmRootG: FAKE_ROOT })).toBe("npx-cache");
    expect(resolveInstallMode({ install: { mode: "local", server: CACHE_CLI }, runtimeCliPath: CACHE_CLI, npmRootG: FAKE_ROOT })).toBe("local");
  });

  it("falls back to the recorded server path heuristic", () => {
    expect(resolveInstallMode({ install: { server: GLOBAL_CLI }, runtimeCliPath: CACHE_CLI, npmRootG: FAKE_ROOT })).toBe("global");
    expect(resolveInstallMode({ install: { server: CACHE_CLI }, runtimeCliPath: LOCAL_CLI, npmRootG: FAKE_ROOT })).toBe("npx-cache");
  });

  it("falls back to the runtime path when nothing is recorded", () => {
    expect(resolveInstallMode({ runtimeCliPath: GLOBAL_CLI, npmRootG: FAKE_ROOT })).toBe("global");
    expect(resolveInstallMode({ runtimeCliPath: CACHE_CLI, npmRootG: FAKE_ROOT })).toBe("npx-cache");
    expect(resolveInstallMode({ runtimeCliPath: LOCAL_CLI, npmRootG: FAKE_ROOT })).toBe("local");
  });

  it("handles missing npm root gracefully", () => {
    expect(resolveInstallMode({ runtimeCliPath: CACHE_CLI, npmRootG: null })).toBe("npx-cache");
    expect(resolveInstallMode({ runtimeCliPath: LOCAL_CLI, npmRootG: null })).toBe("local");
  });
});

describe("serverForMode", () => {
  let tmp: string;
  let gcli: string;
  const fallback: ServerCommand = { command: "npx", args: ["-y", "@dwgintel/loop@9.9.9", "serve"] };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "dwg-install-mode-"));
    gcli = globalCliPath(tmp);
    mkdirSync(dirname(gcli), { recursive: true });
    writeFileSync(gcli, "// stub");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("global mode uses the stable global path when it exists", () => {
    const server = serverForMode("global", { npmRootG: tmp });
    expect(server.command).toBe(process.execPath);
    expect(server.args).toEqual([gcli, "serve"]);
  });

  it("global mode falls back when the global copy is missing", () => {
    const server = serverForMode("global", { npmRootG: join(tmp, "nope"), fallback });
    expect(server).toEqual(fallback);
  });

  it("non-global modes use the fallback (running) resolution", () => {
    expect(serverForMode("npx-cache", { fallback })).toEqual(fallback);
    expect(serverForMode("local", { fallback })).toEqual(fallback);
  });
});

describe("modeForServerPath", () => {
  it("labels cache paths npx-cache and others local/global by npm root", () => {
    expect(modeForServerPath(CACHE_CLI)).toBe("npx-cache");
    expect(modeForServerPath(LOCAL_CLI)).toBe("local");
  });
});
