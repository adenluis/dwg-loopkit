import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { homedir, platform } from "os";
import { execSync } from "child_process";

export type ClientId =
  | "opencode"
  | "claude"
  | "claude-code"
  | "cursor"
  | "codex"
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
  { id: "other", label: "Other / Not listed", hasScopeChoice: false, autoWriteStrategy: "print-only" },
];

export function resolveClientId(input: string): ClientId {
  const lower = input.toLowerCase().trim();
  if (lower === "opencode") return "opencode";
  if (lower === "claude" || lower === "claude-desktop") return "claude";
  if (lower === "claude-code" || lower === "claude code") return "claude-code";
  if (lower === "cursor") return "cursor";
  if (lower === "codex" || lower === "codex-cli") return "codex";
  return "other";
}

export function generateConfigBlock(
  client: ClientId,
  configPath: string,
  localCliPath: string | null
): string {
  const command: string =
    localCliPath ? "node" : "npx";
  const args: string[] = localCliPath
    ? [localCliPath, "serve"]
    : ["-y", "@dwgintel/loop", "serve"];

  switch (client) {
    case "opencode":
      return JSON.stringify({
        mcp: {
          "dwg-loop": {
            type: "local",
            command: localCliPath ? ["node", localCliPath, "serve"] : ["npx", "-y", "@dwgintel/loop", "serve"],
            enabled: true,
            environment: { DWG_LOOP_CONFIG: configPath },
          },
        },
      }, null, 2);

    case "claude":
      return JSON.stringify({
        mcpServers: {
          "dwg-loop": {
            command,
            args,
            env: { DWG_LOOP_CONFIG: configPath },
          },
        },
      }, null, 2);

    case "claude-code":
      return JSON.stringify({
        mcpServers: {
          "dwg-loop": {
            command,
            args,
            env: { DWG_LOOP_CONFIG: configPath },
          },
        },
      }, null, 2);

    case "cursor":
      return JSON.stringify({
        mcpServers: {
          "dwg-loop": {
            type: "stdio",
            command,
            args,
            env: { DWG_LOOP_CONFIG: configPath },
          },
        },
      }, null, 2);

    case "codex":
      return [
        "[mcp_servers.dwg-loop]",
        `command = "${localCliPath ? "node" : "npx"}"`,
        localCliPath
          ? `args = ["${localCliPath}", "serve"]`
          : `args = ["-y", "@dwgintel/loop", "serve"]`,
        "",
        "[mcp_servers.dwg-loop.env]",
        `DWG_LOOP_CONFIG = "${configPath}"`,
      ].join("\n");

    case "other":
    default:
      return JSON.stringify({
        mcpServers: {
          "dwg-loop": {
            command,
            args,
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
  localCliPath: string | null
): AutoWriteResult {
  switch (client) {
    case "claude-code":
      return autoWriteClaudeCode(configPath, scope, localCliPath);
    case "codex":
      return autoWriteCodex(configPath, scope, localCliPath);
    case "opencode":
      return autoWriteFileClient(client, configPath, scope, "mcp", "dwg-loop");
    case "claude":
      return autoWriteFileClient(client, configPath, scope, "mcpServers", "dwg-loop");
    case "cursor":
      return autoWriteFileClient(client, configPath, scope, "mcpServers", "dwg-loop");
    default:
      return { success: false, message: "Print-only client — no auto-write available." };
  }
}

function autoWriteClaudeCode(
  configPath: string,
  scope: Scope,
  localCliPath: string | null
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

  const cmd = localCliPath ? localCliPath : "npx";
  const cmdArgs = localCliPath
    ? ["serve"]
    : ["-y", "@dwgintel/loop", "serve"];

  const scopeFlag = scope === "project" ? "--scope project" : "--scope user";
  const envFlag = `--env DWG_LOOP_CONFIG=${configPath}`;
  const fullCmd = `claude mcp add ${scopeFlag} ${envFlag} dwg-loop -- ${cmd} ${cmdArgs.join(" ")}`;

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
  localCliPath: string | null
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

  const cmd = localCliPath ? localCliPath : "npx";
  const cmdArgs = localCliPath
    ? ["serve"]
    : ["-y", "@dwgintel/loop", "serve"];

  const envFlag = `--env DWG_LOOP_CONFIG=${configPath}`;
  const fullCmd = `codex mcp add ${envFlag} dwg-loop -- ${cmd} ${cmdArgs.join(" ")}`;

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
  entryKey: string
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
    hadComments = stripJsonComments(raw) !== raw.trim();
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

  const localCliPath = detectLocalCliPath();

  let entry: Record<string, unknown>;
  if (client === "opencode") {
    entry = {
      type: "local",
      command: localCliPath
        ? ["node", localCliPath, "serve"]
        : ["npx", "-y", "@dwgintel/loop", "serve"],
      enabled: true,
      environment: { DWG_LOOP_CONFIG: configPath },
    };
  } else if (client === "cursor") {
    entry = {
      type: "stdio",
      command: localCliPath ? "node" : "npx",
      args: localCliPath
        ? [localCliPath, "serve"]
        : ["-y", "@dwgintel/loop", "serve"],
      env: { DWG_LOOP_CONFIG: configPath },
    };
  } else {
    entry = {
      command: localCliPath ? "node" : "npx",
      args: localCliPath
        ? [localCliPath, "serve"]
        : ["-y", "@dwgintel/loop", "serve"],
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

let _localCliPath: string | null | undefined;

export function setLocalCliPath(path: string | null): void {
  _localCliPath = path;
}

export function detectLocalCliPath(): string | null {
  if (_localCliPath !== undefined) return _localCliPath;
  const localPath = resolve(__dirname, "cli.js");
  _localCliPath = existsSync(localPath) ? localPath : null;
  return _localCliPath;
}

export function getClientHelpText(client: ClientId): string {
  switch (client) {
    case "claude-code":
      return "Using Claude Code? Run: claude mcp add --scope user dwg-loop --env DWG_LOOP_CONFIG=<path> -- npx -y @dwgintel/loop serve";
    case "codex":
      return "Using Codex CLI? Run: codex mcp add dwg-loop --env DWG_LOOP_CONFIG=<path> -- npx -y @dwgintel/loop serve";
    default:
      return "If your client uses a different config format, the key parameters are:\n  command: npx\n  args: [\"-y\", \"@dwgintel/loop\", \"serve\"]\n  env: DWG_LOOP_CONFIG=<your config path>\nAdjust to your client's format.";
  }
}