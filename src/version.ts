import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const PACKAGE_NAME = "@dwgintel/loop";

const REGISTRY_LATEST_URL = `https://registry.npmjs.org/${PACKAGE_NAME.replace("/", "%2f")}/latest`;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function getPackageVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
      return pkg.version ?? "0.0.0";
    }
  } catch {
    // fall through
  }
  return "0.0.0";
}

/** Pinned npm spec for an exact version, e.g. "@dwgintel/loop@0.3.0". */
export function getPinnedSpec(version: string = getPackageVersion()): string {
  return `${PACKAGE_NAME}@${version}`;
}

/** True when `candidate` is a higher dotted-numeric version than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (v: string): number[] =>
    v.trim().split(".").map((p) => parseInt(p, 10) || 0);
  const a = parse(candidate);
  const b = parse(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/** Absolute path to the running CLI entrypoint (dist/cli.js once built). */
export function getThisCliPath(): string {
  return join(__dirname, "cli.js");
}

/**
 * The command prefix a member should use for CLI commands. Installs that ran
 * via npx have no `dwg-loop` binary on PATH, so they must go through npx;
 * global installs can use the binary directly.
 */
export function getUserCommandPrefix(cliPath: string = getThisCliPath()): string {
  return cliPath.toLowerCase().includes("_npx") ? `npx -y ${PACKAGE_NAME}` : "dwg-loop";
}

interface UpdateCheckCache {
  checkedAt: number;
  latest: string | null;
}

function updateCheckCachePath(): string {
  return join(homedir(), ".dwg-loop", "update-check.json");
}

/**
 * Latest published version. Served from a 24h on-disk cache when fresh,
 * otherwise fetched from the npm registry. Returns null when offline or on
 * any failure — callers must treat null as "no notification".
 */
export async function getLatestVersion(opts?: {
  forceRefresh?: boolean;
  timeoutMs?: number;
}): Promise<string | null> {
  const force = opts?.forceRefresh ?? false;
  const timeoutMs = opts?.timeoutMs ?? 2500;
  const cacheFile = updateCheckCachePath();

  if (!force && existsSync(cacheFile)) {
    try {
      const cache = JSON.parse(readFileSync(cacheFile, "utf-8")) as UpdateCheckCache;
      if (typeof cache.checkedAt === "number" && Date.now() - cache.checkedAt < CHECK_INTERVAL_MS) {
        return cache.latest;
      }
    } catch {
      // corrupt cache — refetch
    }
  }

  try {
    const response = await fetch(REGISTRY_LATEST_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { version?: string };
    const latest = typeof data.version === "string" ? data.version : null;
    try {
      mkdirSync(dirname(cacheFile), { recursive: true });
      const cache: UpdateCheckCache = { checkedAt: Date.now(), latest };
      writeFileSync(cacheFile, JSON.stringify(cache));
    } catch {
      // cache write failure is harmless
    }
    return latest;
  } catch {
    return null;
  }
}
