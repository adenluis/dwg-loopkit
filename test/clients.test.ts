import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir, platform } from "os";
import { join } from "path";
import {
  CLIENTS,
  resolveClientId,
  resolveServerCommand,
  generateConfigBlock,
  detectInstalledClients,
} from "../src/clients.js";
import { getPinnedSpec } from "../src/version.js";
import { buildDwgHeaders } from "../src/proxy/dwg-client.js";

describe("resolveServerCommand", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "dwg-clients-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("uses absolute node + cli.js when the file exists", () => {
    const cliJs = join(tmp, "cli.js");
    writeFileSync(cliJs, "// stub");
    const server = resolveServerCommand(cliJs);
    expect(server.command).toBe(process.execPath);
    expect(server.args).toEqual([cliJs, "serve"]);
  });

  it("falls back to a pinned npx spec when cli.js is missing", () => {
    const server = resolveServerCommand(join(tmp, "does-not-exist", "cli.js"));
    expect(server.command).toBe("npx");
    expect(server.args).toEqual(["-y", getPinnedSpec(), "serve"]);
    // pinned spec carries an exact version, never a bare package name
    expect(server.args[1]).toMatch(/^@dwgintel\/loop@\d+\.\d+\.\d+$/);
  });
});

describe("generateConfigBlock", () => {
  const server = { command: "/usr/local/bin/node", args: ["/opt/loop/dist/cli.js", "serve"] };
  const configPath = "/home/member/.dwg-loop/config.json";

  it("opencode: emits command array under mcp with environment", () => {
    const block = JSON.parse(generateConfigBlock("opencode", configPath, server));
    const entry = block.mcp["dwg-loop"];
    expect(entry.type).toBe("local");
    expect(entry.command).toEqual(["/usr/local/bin/node", "/opt/loop/dist/cli.js", "serve"]);
    expect(entry.enabled).toBe(true);
    expect(entry.environment.DWG_LOOP_CONFIG).toBe(configPath);
  });

  it("claude: emits command/args under mcpServers with env", () => {
    const block = JSON.parse(generateConfigBlock("claude", configPath, server));
    const entry = block.mcpServers["dwg-loop"];
    expect(entry.command).toBe("/usr/local/bin/node");
    expect(entry.args).toEqual(["/opt/loop/dist/cli.js", "serve"]);
    expect(entry.env.DWG_LOOP_CONFIG).toBe(configPath);
  });

  it("cursor: emits stdio type", () => {
    const block = JSON.parse(generateConfigBlock("cursor", configPath, server));
    expect(block.mcpServers["dwg-loop"].type).toBe("stdio");
  });

  it("codex: emits TOML literal strings so Windows paths survive", () => {
    const winServer = { command: "C:\\Program Files\\nodejs\\node.exe", args: ["C:\\loop\\cli.js", "serve"] };
    const block = generateConfigBlock("codex", configPath, winServer);
    expect(block).toContain("command = 'C:\\Program Files\\nodejs\\node.exe'");
    expect(block).toContain("args = ['C:\\loop\\cli.js', 'serve']");
    expect(block).toContain(`DWG_LOOP_CONFIG = '${configPath}'`);
  });

  it("agent-zero: emits the generic mcpServers JSON block", () => {
    const block = JSON.parse(generateConfigBlock("agent-zero", configPath, server));
    const entry = block.mcpServers["dwg-loop"];
    expect(entry.command).toBe("/usr/local/bin/node");
    expect(entry.args).toEqual(["/opt/loop/dist/cli.js", "serve"]);
    expect(entry.env.DWG_LOOP_CONFIG).toBe(configPath);
  });
});

describe("agent-zero client entry", () => {
  it("resolves agent-zero aliases", () => {
    expect(resolveClientId("agent-zero")).toBe("agent-zero");
    expect(resolveClientId("Agent Zero")).toBe("agent-zero");
    expect(resolveClientId("agentzero")).toBe("agent-zero");
    expect(resolveClientId("something-else")).toBe("other");
  });

  it("is listed as print-only", () => {
    const a0 = CLIENTS.find((c) => c.id === "agent-zero");
    expect(a0).toBeDefined();
    expect(a0!.autoWriteStrategy).toBe("print-only");
    expect(a0!.hasScopeChoice).toBe(false);
  });
});

describe("buildDwgHeaders", () => {
  it("identifies as dwg-loop with the package version", () => {
    const headers = buildDwgHeaders("dwg_test");
    expect(headers["Authorization"]).toBe("Bearer dwg_test");
    expect(headers["User-Agent"]).toMatch(/^dwg-loop\/\d+\.\d+\.\d+$/);
    expect(headers["X-DWG-AI-Client"]).toBeUndefined();
  });

  it("carries the AI-client hint when provided", () => {
    const headers = buildDwgHeaders("dwg_test", "cursor");
    expect(headers["X-DWG-AI-Client"]).toBe("cursor");
  });
});

describe("detectInstalledClients", () => {
  let home: string;
  let cwd: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "dwg-home-"));
    cwd = mkdtempSync(join(tmpdir(), "dwg-cwd-"));
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  it("detects nothing in empty dirs", () => {
    expect(detectInstalledClients(cwd, home)).toEqual([]);
  });

  it("detects cursor via ~/.cursor", () => {
    mkdirSync(join(home, ".cursor"));
    expect(detectInstalledClients(cwd, home)).toContain("cursor");
  });

  it("detects codex via ~/.codex", () => {
    mkdirSync(join(home, ".codex"));
    expect(detectInstalledClients(cwd, home)).toContain("codex");
  });

  it("detects claude-code via ~/.claude.json", () => {
    writeFileSync(join(home, ".claude.json"), "{}");
    expect(detectInstalledClients(cwd, home)).toContain("claude-code");
  });

  it("detects opencode via ~/.config/opencode", () => {
    mkdirSync(join(home, ".config", "opencode"), { recursive: true });
    expect(detectInstalledClients(cwd, home)).toContain("opencode");
  });

  it("detects opencode via project opencode.jsonc", () => {
    writeFileSync(join(cwd, "opencode.jsonc"), "{}");
    expect(detectInstalledClients(cwd, home)).toContain("opencode");
  });

  it("detects Claude Desktop via its per-platform config dir", () => {
    const claudeDir =
      platform() === "darwin"
        ? join(home, "Library", "Application Support", "Claude")
        : platform() === "win32"
          ? join(home, "AppData", "Roaming", "Claude")
          : join(home, ".config", "Claude");
    mkdirSync(claudeDir, { recursive: true });
    expect(existsSync(claudeDir)).toBe(true);
    expect(detectInstalledClients(cwd, home)).toContain("claude");
  });
});
