import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir, platform } from "os";
import { execSync } from "child_process";
import { getPinnedSpec } from "./version.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type ClientId =
  | "opencode"
  | "claude"
  | "claude-code"
  | "cursor"
  | "codex"
  | "agent-zero"
  | "other";

export type Scope = "global" | "project";

export interface ClientDef {
  id: ClientId;
  label: string;
  hasScopeChoice: boolean;
  autoWriteStrategy: "file" | "cli" | "print-only";
}

export const CLIENTS: ClientDef[] = [
  { id: "opencode", label: "opencode", hasScopeChoice: true, autoWriteStrategy: "file" },
  { id: "claude", label: "Claude Desktop", hasScopeChoice: false, autoWriteStrategy: "file" },
  { id: "claude-code", label: "Claude Code CLI", hasScopeChoice: true, autoWriteStrategy: "cli" },
  { id: "cursor", label: "Cursor", hasScopeChoice: true, autoWriteStrategy: "file" },
  { id: "codex", label: "Codex CLI", hasScopeChoice: true, autoWriteStrategy: "cli" },
  { id: "agent-zero", label: "Agent-Zero", hasScopeChoice: false, autoWriteStrategy: "print-only" },
  { id: "other", label: "Other / Not listed", hasScopeChoice: false, autoWriteStrategy: "print-only" },
];

export function resolveClientId(input: string): ClientId {
  const lower = input.toLowerCase().trim();
  if (lower === "opencode") return "opencode";
  if (lower === "claude" || lower === "claude-desktop") return "claude";
  if (lower === "claude-code" || lower === "claude code") return "claude-code";
  if (lower === "cursor") return "cursor";
  if (lower === "codex" || lower === "codex-cli") return "codex";
  if (lower === "agent-zero" || lower === "agentzero" || lower === "agent zero") return "agent-zero";
  return "other";
}

/**
 * The command an AI client should spawn to run the Loop Kit server.
 *
 * Primary form: the absolute path to the running Node binary plus the
 * absolute path to this package's cli.js. GUI clients (Claude Desktop,
 * Cursor) spawn MCP servers with a minimal environment where `npx` is often
 * not on PATH — absolute paths sidestep that whole failure class, start
 * faster (no npx resolution), and work offline.
 *
 * Fallback form (cli.js not found, e.g. running from source via tsx):
 * pinned `npx` spec, so the version is still exact.
 */
export interface ServerCommand {
  command: string;
  args: string[];
}

export function resolveServerCommand(cliJsPath?: string): ServerCommand {
  const candidate = cliJsPath ?? join(__dirname, "cli.js");
  if (existsSync(candidate)) {
    return { command: process.execPath, args: [candidate, "serve"] };
  }
  return { command: "npx", args: ["-y", getPinnedSpec(), "serve"] };
}

/**
 * Detect which supported AI clients appear to be installed, by looking for
 * their config files/directories. Pure filesystem probes — fast, no spawned
 * processes. Used to pre-select the interactive menu; never restrictive.
 */
export function detectInstalledClients(cwd: string = process.cwd(), home: string = homedir()): ClientId[] {
  const detected: ClientId[] = [];
  const isMac = platform() === "darwin";
  const isWin = platform() === "win32";

  if (
    existsSync(join(home, ".config", "opencode")) ||
    existsSync(join(cwd, "opencode.json")) ||
    existsSync(join(cwd, "opencode.jsonc"))
  ) {
    detected.push("opencode");
  }

  const claudeDir = isMac
    ? join(home, "Library", "Application Support", "Claude")
    : isWin
      ? join(home, "AppData", "Roaming", "Claude")
      : join(home, ".config", "Claude");
  if (existsSync(claudeDir)) {
    detected.push("claude");
  }

  if (existsSync(join(home, ".claude.json")) || existsSync(join(home, ".claude"))) {
    detected.push("claude-code");
  }

  if (existsSync(join(home, ".cursor")) || existsSync(join(cwd, ".cursor"))) {
    detected.push("cursor");
  }

  if (existsSync(join(home, ".codex")) || existsSync(join(cwd, ".codex"))) {
    detected.push("codex");
  }

  return detected;
}

export function generateConfigBlock(
  client: ClientId,
  configPath: string,
  server: ServerCommand = resolveServerCommand()
): string {
  switch (client) {
    case "opencode":
      return JSON.stringify({
        mcp: {
          "dwg-loop": {
            type: "local",
            command: [server.command, ...server.args],
            enabled: true,
            environment: { DWG_LOOP_CONFIG: configPath },
          },
        },
      }, null, 2);

    case "claude":
    case "claude-code":
      return JSON.stringify({
        mcpServers: {
          "dwg-loop": {
            command: server.command,
            args: server.args,
            env: { DWG_LOOP_CONFIG: configPath },
          },
        },
      }, null, 2);

    case "cursor":
      return JSON.stringify({
        mcpServers: {
          "dwg-loop": {
            type: "stdio",
            command: server.command,
            args: server.args,
            env: { DWG_LOOP_CONFIG: configPath },
          },
        },
      }, null, 2);

    case "codex":
      // TOML literal strings (single quotes) so Windows paths survive intact
      return [
        "[mcp_servers.dwg-loop]",
        `command = '${server.command}'`,
        `args = [${server.args.map((a) => `'${a}'`).join(", ")}]`,
        "",
        "[mcp_servers.dwg-loop.env]",
        `DWG_LOOP_CONFIG = '${configPath}'`,
      ].join("\n");

    case "other":
    default:
      return JSON.stringify({
        mcpServers: {
          "dwg-loop": {
            command: server.command,
            args: server.args,
            env: { DWG_LOOP_CONFIG: configPath },
          },
        },
      }, null, 2);
  }
}

export function getConfigFilePath(client: ClientId, scope: Scope): string | null {
  const home = homedir();
  const cwd = process.cwd();
  const isMac = platform() === "darwin";
  const isWin = platform() === "win32";

  switch (client) {
    case "opencode":
      if (scope === "project") {
        for (const f of ["opencode.json", "opencode.jsonc"]) {
          const p = join(cwd, f);
          if (existsSync(p)) return p;
        }
        return join(cwd, "opencode.json");
      }
      return join(home, ".config", "opencode", "opencode.json");

    case "claude":
      if (isMac) return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
      if (isWin) return join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json");
      return join(home, ".config", "Claude", "claude_desktop_config.json");

    case "claude-code":
      if (scope === "project") return join(cwd, ".mcp.json");
      return join(home, ".claude.json");

    case "cursor":
      if (scope === "project") return join(cwd, ".cursor", "mcp.json");
      return join(home, ".cursor", "mcp.json");

    case "codex":
      if (scope === "project") return join(cwd, ".codex", "config.toml");
      return join(home, ".codex", "config.toml");

    default:
      return null;
  }
}

export interface AutoWriteResult {
  success: boolean;
  message: string;
  configPath?: string;
}

export function autoWriteConfig(
  client: ClientId,
  configPath: string,
  scope: Scope,
  server: ServerCommand = resolveServerCommand()
): AutoWriteResult {
  switch (client) {
    case "claude-code":
      return autoWriteClaudeCode(configPath, scope, server);
    case "codex":
      return autoWriteCodex(configPath, scope, server);
    case "opencode":
      return autoWriteFileClient(client, configPath, scope, "mcp", "dwg-loop", server);
    case "claude":
      return autoWriteFileClient(client, configPath, scope, "mcpServers", "dwg-loop", server);
    case "cursor":
      return autoWriteFileClient(client, configPath, scope, "mcpServers", "dwg-loop", server);
    default:
      return { success: false, message: "Print-only client — no auto-write available." };
  }
}

/** Shell-quote one argument for execSync (cmd.exe / sh). */
function q(s: string): string {
  return `"${s.replace(/"/g, "")}"`;
}

function autoWriteClaudeCode(
  configPath: string,
  scope: Scope,
  server: ServerCommand
): AutoWriteResult {
  try {
    execSync("claude --version", { stdio: "pipe", timeout: 5000 });
  } catch {
    return {
      success: false,
      message: "Claude Code CLI not found on PATH. Falling back to manual config.",
      configPath: getConfigFilePath("claude-code", scope) ?? undefined,
    };
  }

  const scopeFlag = scope === "project" ? "--scope project" : "--scope user";
  const envFlag = `--env ${q(`DWG_LOOP_CONFIG=${configPath}`)}`;
  const fullCmd = `claude mcp add ${scopeFlag} dwg-loop ${envFlag} -- ${q(server.command)} ${server.args.map(q).join(" ")}`;

  try {
    execSync(fullCmd, { stdio: "pipe", timeout: 10000 });
    return {
      success: true,
      message: `MCP server added via Claude Code CLI (${scope} scope).`,
      configPath: getConfigFilePath("claude-code", scope) ?? undefined,
    };
  } catch (e) {
    return {
      success: false,
      message: `Claude Code CLI command failed: ${(e as Error).message}`,
      configPath: getConfigFilePath("claude-code", scope) ?? undefined,
    };
  }
}

function autoWriteCodex(
  configPath: string,
  scope: Scope,
  server: ServerCommand
): AutoWriteResult {
  try {
    execSync("codex --version", { stdio: "pipe", timeout: 5000 });
  } catch {
    return {
      success: false,
      message: "Codex CLI not found on PATH. Falling back to manual config.",
      configPath: getConfigFilePath("codex", scope) ?? undefined,
    };
  }

  const envFlag = `--env ${q(`DWG_LOOP_CONFIG=${configPath}`)}`;
  const fullCmd = `codex mcp add dwg-loop ${envFlag} -- ${q(server.command)} ${server.args.map(q).join(" ")}`;

  try {
    execSync(fullCmd, { stdio: "pipe", timeout: 10000 });
    return {
      success: true,
      message: `MCP server added via Codex CLI.`,
      configPath: getConfigFilePath("codex", scope) ?? undefined,
    };
  } catch (e) {
    return {
      success: false,
      message: `Codex CLI command failed: ${(e as Error).message}`,
      configPath: getConfigFilePath("codex", scope) ?? undefined,
    };
  }
}

function autoWriteFileClient(
  client: ClientId,
  configPath: string,
  scope: Scope,
  mcpKey: string,
  entryKey: string,
  server: ServerCommand
): AutoWriteResult {
  const targetFile = getConfigFilePath(client, scope);
  if (!targetFile) {
    return { success: false, message: "Could not determine config file path." };
  }

  const dir = dirname(targetFile);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let existing: Record<string, unknown> = {};
  let hadComments = false;

  if (existsSync(targetFile)) {
    const raw = readFileSync(targetFile, "utf-8");
    hadComments = stripJsonComments(raw).trim() !== raw.trim();
    try {
      existing = JSON.parse(stripJsonComments(raw)) as Record<string, unknown>;
    } catch {
      return {
        success: false,
        message: `Could not parse existing config at ${targetFile}. Falling back to manual config.`,
        configPath: targetFile,
      };
    }
  }

  let entry: Record<string, unknown>;
  if (client === "opencode") {
    entry = {
      type: "local",
      command: [server.command, ...server.args],
      enabled: true,
      environment: { DWG_LOOP_CONFIG: configPath },
    };
  } else if (client === "cursor") {
    entry = {
      type: "stdio",
      command: server.command,
      args: server.args,
      env: { DWG_LOOP_CONFIG: configPath },
    };
  } else {
    entry = {
      command: server.command,
      args: server.args,
      env: { DWG_LOOP_CONFIG: configPath },
    };
  }

  const mcpSection = (existing[mcpKey] as Record<string, unknown>) ?? {};
  mcpSection[entryKey] = entry;
  existing[mcpKey] = mcpSection;

  try {
    writeFileSync(targetFile, JSON.stringify(existing, null, 2) + "\n");
    let msg = `Config written to ${targetFile}`;
    if (hadComments) {
      msg += " (note: comments in your config were removed during the merge)";
    }
    return { success: true, message: msg, configPath: targetFile };
  } catch (e) {
    return {
      success: false,
      message: `Could not write to ${targetFile}: ${(e as Error).message}`,
      configPath: targetFile,
    };
  }
}

function stripJsonComments(text: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  let escaped = false;

  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      i++;
      continue;
    }

    if (char === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }

    if (char === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

export function getClientHelpText(client: ClientId): string {
  const spec = getPinnedSpec();
  switch (client) {
    case "claude-code":
      return `Using Claude Code? Run: claude mcp add --scope user dwg-loop --env DWG_LOOP_CONFIG=<path> -- npx -y ${spec} serve`;
    case "codex":
      return `Using Codex CLI? Run: codex mcp add dwg-loop --env DWG_LOOP_CONFIG=<path> -- npx -y ${spec} serve`;
    case "agent-zero":
      return "Agent-Zero: paste the printed JSON into your MCP server settings. If the Loop Kit runs inside the Agent-Zero container, choose a vault path in persistent, mapped storage so a container rebuild can't remove your knowledge system.";
    default:
      return "If your client uses a different config format, use the printed JSON block — the key parameters are the command and args shown plus env DWG_LOOP_CONFIG=<your config path>.";
  }
}
