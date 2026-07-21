import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { getPinnedSpec, getThisCliPath } from "./version.js";
import { resolveServerCommand } from "./clients.js";
import type { ServerCommand } from "./clients.js";
import type { InstallInfo, InstallMode } from "./config.js";

/**
 * Install-mode machinery (v0.4.0).
 *
 * A Loop Kit install is either:
 *  - "global"     — `npm i -g` at init; the AI client config points at the
 *                   stable global cli.js, which survives npm cache pruning.
 *  - "npx-cache"  — the config points at the npx cache copy (ephemeral; an
 *                   npm cache clean removes it until `update` repairs).
 *  - "local"      — a dev build (node dist/cli.js from a repo checkout).
 *
 * init attempts the global install by default (only when running from the
 * npx cache — dev builds and already-global re-runs are untouched) and
 * falls back to npx-cache with an honest message. update + repoint PRESERVE
 * the recorded mode, so running update via npx can never drag a global
 * install back onto the cache.
 */

export function isNpxCachePath(p: string): boolean {
  return p.toLowerCase().includes("_npx");
}

function isUnderPath(p: string, root: string | null): boolean {
  if (!root) return false;
  return p.toLowerCase().startsWith(root.toLowerCase());
}

let _npmRootG: string | null | undefined;

/** Global npm root (`npm root -g`), cached. Null when npm is unavailable. */
export function getNpmRootG(): string | null {
  if (_npmRootG !== undefined) return _npmRootG;
  try {
    const root = execSync("npm root -g", { stdio: "pipe", timeout: 8000 }).toString().trim();
    _npmRootG = root.length > 0 ? root : null;
  } catch {
    _npmRootG = null;
  }
  return _npmRootG;
}

/** Expected cli.js path for a global install under the given npm root. */
export function globalCliPath(npmRootG: string): string {
  return join(npmRootG, "@dwgintel", "loop", "dist", "cli.js");
}

/**
 * Resolve the install mode. Precedence: the recorded install.mode wins, then
 * the recorded server path (under npm root = global, _npx = npx-cache), then
 * the running cli path. "local" is anything else (dev builds).
 */
export function resolveInstallMode(args: {
  install?: Pick<InstallInfo, "mode" | "server"> | null;
  runtimeCliPath?: string;
  npmRootG?: string | null;
}): InstallMode {
  const { install } = args;
  if (install?.mode === "global" || install?.mode === "npx-cache" || install?.mode === "local") {
    return install.mode;
  }
  const runtime = args.runtimeCliPath ?? getThisCliPath();
  const root = args.npmRootG === undefined ? getNpmRootG() : args.npmRootG;
  const candidate = install?.server ?? runtime;
  if (isUnderPath(candidate, root)) return "global";
  if (isNpxCachePath(candidate) || isNpxCachePath(runtime)) return "npx-cache";
  return "local";
}

/**
 * The server command for a mode. Global uses the stable global path when it
 * exists (a missing global copy — e.g. manually uninstalled — falls back to
 * the running resolution; the next update reinstalls it).
 */
export function serverForMode(
  mode: InstallMode,
  opts: { fallback?: ServerCommand; npmRootG?: string | null } = {}
): ServerCommand {
  if (mode === "global") {
    const root = opts.npmRootG === undefined ? getNpmRootG() : opts.npmRootG;
    if (root) {
      const p = globalCliPath(root);
      if (existsSync(p)) {
        return { command: process.execPath, args: [p, "serve"] };
      }
    }
  }
  return opts.fallback ?? resolveServerCommand();
}

/**
 * `npm install -g <spec>` and resolve the resulting global server command.
 * Returns null on any failure (permissions, network, npm missing) — callers
 * fall back to the npx-cache resolution.
 */
export function attemptGlobalInstall(spec: string = getPinnedSpec()): ServerCommand | null {
  try {
    execSync(`npm install -g ${spec}`, { stdio: "pipe", timeout: 180000 });
  } catch {
    return null;
  }
  const root = getNpmRootG();
  if (!root) return null;
  const p = globalCliPath(root);
  if (!existsSync(p)) return null;
  return { command: process.execPath, args: [p, "serve"] };
}

export interface InitInstall {
  mode: InstallMode;
  server: ServerCommand;
  /** True when a global install was attempted (whether or not it landed). */
  attemptedGlobal: boolean;
}

/**
 * init's install resolution. Attempts the global install only when running
 * from the npx cache (so dev builds keep pointing at the repo, and re-runs
 * from an already-global binary keep pointing at it). --no-global skips the
 * attempt entirely.
 */
export function resolveInstallForInit(opts: { noGlobal?: boolean } = {}): InitInstall {
  const runtime = getThisCliPath();
  const root = getNpmRootG();
  const runningGlobal = isUnderPath(runtime, root);

  if (!opts.noGlobal && isNpxCachePath(runtime) && !runningGlobal) {
    const server = attemptGlobalInstall();
    if (server) return { mode: "global", server, attemptedGlobal: true };
    return { mode: "npx-cache", server: resolveServerCommand(), attemptedGlobal: true };
  }

  const server = resolveServerCommand();
  const serverPath = server.args[0] ?? runtime;
  const mode: InstallMode = isUnderPath(serverPath, root)
    ? "global"
    : isNpxCachePath(serverPath)
      ? "npx-cache"
      : "local";
  return { mode, server, attemptedGlobal: false };
}

/** Mode label for a server path — used by repoint to keep metadata consistent. */
export function modeForServerPath(serverPath: string): InstallMode {
  if (isUnderPath(serverPath, getNpmRootG())) return "global";
  if (isNpxCachePath(serverPath)) return "npx-cache";
  return "local";
}
