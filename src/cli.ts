#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir, platform } from "os";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { execSync } from "child_process";
import { DEFAULT_CONFIG, DEFAULT_DWG_MCP_URL } from "./config.js";
import type { LoopConfig } from "./config.js";
import { serve } from "./serve.js";
import {
  CLIENTS,
  resolveClientId,
  generateConfigBlock,
  autoWriteConfig,
  getConfigFilePath,
  detectInstalledClients,
  resolveServerCommand,
  getClientHelpText,
} from "./clients.js";
import type { ClientId, Scope } from "./clients.js";
import {
  getPackageVersion,
  getPinnedSpec,
  getLatestVersion,
  isNewerVersion,
  getThisCliPath,
  getUserCommandPrefix,
} from "./version.js";
import { checkTokenWithDwg } from "./token-check.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_DIR = join(homedir(), ".dwg-loop");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

function expandTilde(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return join(homedir(), p.slice(2));
  }
  return p;
}

function checkNodeVersion(): void {
  const major = parseInt(process.versions.node.split(".")[0], 10);
  if (major >= 20) return;
  const os = platform();
  console.error(`\n  DWG Loop Kit needs Node.js 20 or later — you're running ${process.version}.\n`);
  if (os === "win32") {
    console.error("  Get the LTS installer from https://nodejs.org (choose Windows Installer).\n");
  } else if (os === "darwin") {
    console.error("  Update from https://nodejs.org or run: brew install node\n");
  } else {
    console.error("  Update via your package manager or https://nodejs.org\n");
  }
  process.exit(1);
}

checkNodeVersion();

const program = new Command();

program
  .name("dwg-loop")
  .description("DWG Loop Kit — connect your AI to DWG INTEL and your private vault")
  .version(getPackageVersion());

program
  .command("init")
  .description("Set up Loop Kit: choose vault, enter token, seed structure, write AI config")
  .option("--vault <path>", "path to vault folder (skip prompt)")
  .option("--token <token>", "DWG MCP token (skip prompt)")
  .option("--mcp-url <url>", "DWG MCP server URL", DEFAULT_DWG_MCP_URL)
  .option("--token-env <var>", "store token as env var reference instead of file")
  .option("--client <name>", "AI client: opencode | claude | claude-code | cursor | codex | other")
  .option("--scope <scope>", "config scope: global | project (default: global)")
  .option("--yes", "skip all prompts, use defaults or provided flags")
  .option("--local", "(deprecated — configs now always point at the running build)")
  .option("--repoint", "re-point the recorded AI client at this version and refresh rules (no prompts)")
  .action(init);

program
  .command("serve")
  .description("Start the MCP server (stdio) for your AI client")
  .option("--config <path>", "path to config.json")
  .action(serveCmd);

program
  .command("doctor")
  .description("Check config, vault access, playbook, DWG connectivity")
  .option("--config <path>", "path to config.json")
  .action(doctor);

program
  .command("update")
  .description("Update Loop Kit to the latest version and refresh vault rules")
  .action(updateCmd);

program
  .command("version")
  .description("Print version")
  .action(() => {
    console.log(getPackageVersion());
  });

program
  .command("seed")
  .description("Apply vault seed (folder structure + .dwg/* templates) to an existing or new vault")
  .option("--vault <path>", "path to vault (defaults to config)")
  .option("--force", "overwrite existing contract files (DWG-CONTEXT.md, INDEX.md, ACTIVITY-LOG.md)")
  .option("--upgrade", "upgrade .dwg/ rules and schemas without touching contract files or personal notes")
  .action(seedAction);

program
  .command("config")
  .description("Get or set config values")
  .argument("[key]", "config key to get/set (e.g. vault.path, dwg.mcpUrl)")
  .argument("[value]", "new value (omit to read current)")
  .option("--config <path>", "path to config.json")
  .action(configCmd);

program
  .command("emit-config")
  .description("Print MCP config JSON for an AI client")
  .argument("<client>", "client: opencode | claude | claude-code | cursor | codex | other")
  .option("--config <path>", "path to config.json")
  .option("--scope <scope>", "config scope: global | project (default: global)")
  .option("--local", "(deprecated — configs now always point at the running build)")
  .action(emitConfigAction);

program.parse();

async function init(opts: {
  vault?: string;
  token?: string;
  mcpUrl: string;
  tokenEnv?: string;
  client?: string;
  scope?: string;
  yes?: boolean;
  local?: boolean;
  repoint?: boolean;
}): Promise<void> {
  // Repoint mode: driven by `update` — no prompts, reuse the existing config.
  if (opts.repoint) {
    await repointExisting();
    return;
  }

  // terminal auto-detects: TTY → masked input works via _writeToOutput;
  // piped stdin → plain line mode, so scripted input isn't garbled.
  // Buffered questioner: queues input lines so pasted/piped multi-line
  // input is never dropped between sequential questions (rl.question loses
  // lines that arrive while no question is pending). askMasked echoes "*"
  // per character on TTYs for token entry.
  const q = createQuestioner();
  const nonInteractive = opts.yes === true;

  console.log("\n  DWG Loop Kit — Setup\n");

  // ── Vault path ──────────────────────────────────────────────────────────
  const defaultVault = join(homedir(), "dwg-vault");
  let vaultPath: string;
  if (opts.vault) {
    vaultPath = opts.vault;
  } else if (nonInteractive) {
    vaultPath = defaultVault;
    console.log(`  Using default vault path: ${vaultPath}`);
  } else {
    const answer = (await q.ask(`  Path to your vault folder [${defaultVault}]: `)).trim();
    vaultPath = answer || defaultVault;
  }
  if (!vaultPath) {
    console.error("  Vault path is required.");
    process.exit(1);
  }

  const resolvedVault = resolve(expandTilde(vaultPath));

  // Create vault if missing
  if (!existsSync(resolvedVault)) {
    if (nonInteractive) {
      mkdirSync(resolvedVault, { recursive: true });
      console.log(`  Created vault: ${resolvedVault}`);
    } else {
      const create = await q.ask(`  "${resolvedVault}" doesn't exist. Create it? (Y/n): `);
      const a = create.trim().toLowerCase();
      if (a === "" || a.startsWith("y")) {
        mkdirSync(resolvedVault, { recursive: true });
      } else {
        console.error("  Cannot continue without a vault path.");
        process.exit(1);
      }
    }
  }

  // ── Token ───────────────────────────────────────────────────────────────
  let token = "";
  if (opts.tokenEnv) {
    // Token lives in an env var — nothing to store or validate here.
    console.log(`  Token will be read from env var ${opts.tokenEnv} at runtime.`);
  } else if (opts.token) {
    token = opts.token.trim();
    const check = await checkTokenWithDwg(opts.mcpUrl, token);
    if (check.status === "ok") {
      console.log("  [OK] Token verified with DWG.");
    } else if (check.status === "rejected") {
      if (nonInteractive) {
        console.error(`  [FAIL] Token rejected by DWG (${check.httpStatus}). Check the token and try again.`);
        process.exit(3);
      }
      console.log(`  [!] That token was rejected by DWG (${check.httpStatus}).`);
      token = await promptForToken(q, opts.mcpUrl);
    } else {
      console.log(`  [!] Couldn't verify the token (${check.reason}). Saved anyway — run the doctor later to re-check.`);
    }
  } else if (nonInteractive) {
    console.error("  Token is required. Provide --token or --token-env.");
    process.exit(1);
  } else {
    token = await promptForToken(q, opts.mcpUrl);
  }

  // ── Client selection ────────────────────────────────────────────────────
  let clientId: ClientId;
  if (opts.client) {
    clientId = resolveClientId(opts.client);
  } else if (nonInteractive) {
    clientId = "other";
  } else {
    const detected = new Set(detectInstalledClients());
    console.log("\n  Which AI client do you use?\n");
    CLIENTS.forEach((c, i) => {
      const num = i + 1;
      const autoTag =
        c.autoWriteStrategy === "cli"
          ? "(auto-configure via CLI)"
          : c.autoWriteStrategy === "file"
            ? "(auto-configure)"
            : "(print config for manual setup)";
      const seen = detected.has(c.id) ? "  <- detected on this machine" : "";
      console.log(`    ${num}. ${c.label} ${autoTag}${seen}`);
    });
    console.log();
    const firstDetected = CLIENTS.findIndex((c) => detected.has(c.id));
    const defaultChoice = firstDetected >= 0 ? firstDetected + 1 : 1;
    const answer = await q.ask(`  Enter choice [${defaultChoice}]: `);
    const idx = parseInt(answer.trim(), 10) || defaultChoice;
    const clamped = Math.max(1, Math.min(idx, CLIENTS.length));
    clientId = CLIENTS[clamped - 1].id;
  }

  // ── Scope ───────────────────────────────────────────────────────────────
  let scope: Scope = "global";
  const clientDef = CLIENTS.find((c) => c.id === clientId)!;
  if (clientDef.hasScopeChoice) {
    if (opts.scope) {
      scope = opts.scope === "project" ? "project" : "global";
    } else if (!nonInteractive) {
      const answer = await q.ask(
        "\n  Use DWG Loop Kit in all your projects, or just this folder? (all/folder) [all]: "
      );
      const a = answer.trim().toLowerCase();
      if (a.startsWith("f") || a.startsWith("p")) {
        scope = "project";
      }
    }
  }

  q.close();

  // ── Write config + token, seed vault ────────────────────────────────────
  mkdirSync(CONFIG_DIR, { recursive: true });

  const server = resolveServerCommand();
  const config: LoopConfig = {
    ...DEFAULT_CONFIG,
    dwg: {
      mcpUrl: opts.mcpUrl,
      tokenEnv: opts.tokenEnv ?? null,
      tokenFile: opts.tokenEnv ? null : join(CONFIG_DIR, "token"),
    },
    vault: {
      path: resolvedVault,
      toolPrefix: "vault_",
    },
    install: {
      client: clientId,
      scope,
      server: server.args[0] ?? getThisCliPath(),
      recordedAt: new Date().toISOString(),
    },
  };

  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  if (!opts.tokenEnv && token) {
    writeFileSync(join(CONFIG_DIR, "token"), token, { mode: 0o600 });
  }

  // Seed skips existing contract files — re-running init never wipes the
  // member's DWG-CONTEXT.md, INDEX.md or ACTIVITY-LOG.md.
  await applySeed(resolvedVault, false, false);

  console.log("\n  Vault seeded. Config saved to:\n");
  console.log(`    ${CONFIG_PATH}`);

  // ── Auto-write or print client config ───────────────────────────────────
  console.log(`\n  Configuring ${clientDef.label} (${scope} scope)...\n`);

  const result = autoWriteConfig(clientId, CONFIG_PATH, scope, server);

  if (result.success) {
    console.log(`  [OK] ${result.message}`);
  } else {
    console.log(`  [!] ${result.message}`);
    console.log(`\n  Your ${clientDef.label} MCP config:\n`);
    console.log(generateConfigBlock(clientId, CONFIG_PATH, server));

    if (result.configPath) {
      console.log(`\n  Paste this into: ${result.configPath}\n`);
    } else {
      console.log("\n  Paste this into your AI client's MCP configuration.\n");
    }

    if (clientId === "other") {
      console.log(`  ${getClientHelpText(clientId)}\n`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const restartTarget = clientId === "other" ? "your AI client" : clientDef.label;
  console.log("\n  ------------------------------------------------");
  console.log("  Setup complete.\n");
  console.log("  Next steps:");
  console.log(`    1. Restart ${restartTarget} completely, then start a new conversation.`);
  console.log(`    2. Say "DWG help" to see what you can do.\n`);
  console.log("  If anything doesn't work, run:");
  console.log(`    ${getUserCommandPrefix()} doctor\n`);
  console.log(`  Your vault:  ${resolvedVault}`);
  console.log(`  Your config: ${CONFIG_PATH}\n`);
}

interface Questioner {
  ask(prompt: string): Promise<string>;
  askMasked(prompt: string): Promise<string>;
  close(): void;
}

/**
 * Buffered line questioner. Lines that arrive while no question is pending
 * (pasted or piped multi-line input) are queued instead of dropped, which is
 * the failure mode of sequential rl.question() calls. Masking echoes "*" per
 * character; it only takes effect on TTYs, where readline echoes input.
 */
function createQuestioner(): Questioner {
  const rl = createInterface({ input, output });
  const buffered: string[] = [];
  const waiters: Array<(line: string) => void> = [];

  rl.on("line", (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter(line);
    else buffered.push(line);
  });
  rl.on("close", () => {
    // EOF with a pending question: answer it blank so defaults apply.
    for (const waiter of waiters.splice(0)) waiter("");
  });

  const mutable = rl as unknown as { _writeToOutput: (s: string) => void };
  const originalWrite = mutable._writeToOutput;
  let mask = false;
  mutable._writeToOutput = (chunk: string): void => {
    if (mask && chunk !== "\n" && chunk !== "\r\n") {
      originalWrite.call(rl, "*");
    } else {
      originalWrite.call(rl, chunk);
    }
  };

  const take = (): Promise<string> => {
    if (buffered.length) return Promise.resolve(buffered.shift()!);
    return new Promise((resolvePromise) => waiters.push(resolvePromise));
  };

  return {
    async ask(prompt: string): Promise<string> {
      process.stdout.write(prompt);
      return (await take()).trim();
    },
    async askMasked(prompt: string): Promise<string> {
      process.stdout.write(prompt);
      mask = true;
      try {
        return (await take()).trim();
      } finally {
        mask = false;
      }
    },
    close(): void {
      rl.close();
    },
  };
}

/**
 * Interactive token prompt: masked input, dwg_ prefix sanity check, and a
 * live validation call against the DWG server with retry.
 */
async function promptForToken(q: Questioner, mcpUrl: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const token = await q.askMasked("  DWG MCP token (dwg_...): ");
    if (!token) {
      console.log("  Token is required — copy it from your DWG INTEL account (it starts with dwg_).");
      continue;
    }
    if (!token.startsWith("dwg_")) {
      const use = await q.ask("  That doesn't look like a DWG token (they start with \"dwg_\"). Use it anyway? (y/N): ");
      if (!use.trim().toLowerCase().startsWith("y")) continue;
    }
    process.stdout.write("  Checking token with DWG... ");
    const check = await checkTokenWithDwg(mcpUrl, token);
    if (check.status === "ok") {
      console.log("verified.");
      return token;
    }
    if (check.status === "rejected") {
      console.log(`rejected (${check.httpStatus}).`);
      if (attempt >= 3) {
        const keep = await q.ask("  Keep this token anyway? (y/N): ");
        if (keep.trim().toLowerCase().startsWith("y")) return token;
        console.error("  Cannot continue without a valid token.");
        process.exit(3);
      }
      console.log("  Check you copied the whole token and try again.");
      continue;
    }
    console.log(`couldn't verify (${check.reason}).`);
    console.log("  Saved anyway — the vault works offline; run the doctor later to re-check.");
    return token;
  }
}

/**
 * Re-point the recorded AI client's MCP config at this exact installed
 * version and refresh the vault's .dwg/ rules. Idempotent — also repairs
 * configs whose recorded server file was removed (e.g. npm cache cleared).
 */
async function repointExisting(): Promise<void> {
  console.log("\n  DWG Loop Kit — Repoint\n");

  if (!existsSync(CONFIG_PATH)) {
    console.error("  No existing config found. Run `init` first.");
    process.exit(1);
  }
  const config = loadConfigSafe(CONFIG_PATH);
  const server = resolveServerCommand();
  console.log(`  Version: ${getPackageVersion()}`);

  const install = config.install;
  if (!install?.client) {
    console.log("  [!] This setup predates install tracking — no recorded AI client to repoint.");
    console.log(`      Run \`${getUserCommandPrefix()} init\` once to record your client.`);
  } else {
    const clientId = resolveClientId(install.client);
    const scope: Scope = install.scope === "project" ? "project" : "global";
    const clientDef = CLIENTS.find((c) => c.id === clientId)!;
    console.log(`  Re-pointing ${clientDef.label} (${scope} scope) at this version...`);
    const result = autoWriteConfig(clientId, CONFIG_PATH, scope, server);
    if (result.success) {
      console.log(`  [OK] ${result.message}`);
    } else {
      console.log(`  [!] ${result.message}`);
      console.log(`\n  Your ${clientDef.label} MCP config:\n`);
      console.log(generateConfigBlock(clientId, CONFIG_PATH, server));
    }
    config.install = {
      client: clientId,
      scope,
      server: server.args[0] ?? getThisCliPath(),
      recordedAt: new Date().toISOString(),
    };
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }

  console.log("\n  Refreshing vault rules...");
  await applySeed(config.vault.path, false, true);
  console.log("\n  Done. Restart your AI client to pick up the change.\n");
}

let _isGlobalInstall: boolean | undefined;
function isGlobalInstall(): boolean {
  if (_isGlobalInstall !== undefined) return _isGlobalInstall;
  try {
    const root = execSync("npm root -g", { stdio: "pipe", timeout: 8000 }).toString().trim();
    _isGlobalInstall = root.length > 0 && getThisCliPath().toLowerCase().startsWith(root.toLowerCase());
  } catch {
    _isGlobalInstall = false;
  }
  return _isGlobalInstall;
}

async function updateCmd(): Promise<void> {
  console.log("\n  DWG Loop Kit — Update\n");
  const current = getPackageVersion();
  console.log(`  Installed version: ${current}`);
  process.stdout.write("  Checking npm for the latest version... ");
  const latest = await getLatestVersion({ forceRefresh: true, timeoutMs: 8000 });
  if (!latest) {
    console.log("failed.");
    console.error("\n  Couldn't reach the npm registry. Check your internet connection and try again.\n");
    process.exit(1);
  }
  console.log(latest);

  if (isNewerVersion(latest, current)) {
    console.log(`\n  Updating to ${latest}...`);
    const spec = getPinnedSpec(latest);
    try {
      if (isGlobalInstall()) {
        execSync(`npm install -g ${spec}`, { stdio: "inherit" });
        // Hand off to the new version so it finishes the job with its own code.
        execSync("dwg-loop update", { stdio: "inherit" });
      } else {
        // npx downloads the new version; its `update` sees it's latest and repoints.
        execSync(`npx -y ${spec} update`, { stdio: "inherit" });
      }
      return;
    } catch (e) {
      console.error(`\n  Update failed: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`  You can finish it manually with: npx -y ${spec} init --repoint\n`);
      process.exit(1);
    }
  }

  console.log("  You're on the latest version.");
  await repointExisting();
}

async function serveCmd(opts: { config?: string }): Promise<void> {
  const configPath = opts.config ?? process.env.DWG_LOOP_CONFIG;
  await serve(configPath);
}

async function doctor(opts: { config?: string }): Promise<void> {
  const configPath = opts.config ?? process.env.DWG_LOOP_CONFIG ?? CONFIG_PATH;
  let exitCode = 0;

  console.log("\n  DWG Loop Kit — Doctor\n");

  const current = getPackageVersion();
  let versionLine = `  Loop Kit version: ${current}`;
  const latest = await getLatestVersion();
  if (latest && isNewerVersion(latest, current)) {
    versionLine += `  ->  update available: ${latest} (run \`${getUserCommandPrefix()} update\`)`;
  }
  console.log(versionLine);

  try {
    const config = loadConfigSafe(configPath);
    console.log(`  [OK] Config found: ${configPath}`);
    console.log(`       DWG URL: ${config.dwg.mcpUrl}`);
    console.log(`       Vault:   ${config.vault.path}`);

    // Check playbook asset in dist
    const playbookPath = join(__dirname, "playbook", "playbook", "default.md");
    if (existsSync(playbookPath)) {
      console.log("  [OK] Playbook asset present (dist/playbook/playbook/default.md)");
    } else {
      console.log("  [FAIL] Playbook asset missing — run `npm run build` to rebuild");
      exitCode = 2;
    }

    // Check seed assets in dist
    const seedPath = join(__dirname, "..", "seed");
    if (existsSync(seedPath) || existsSync(join(__dirname, "seed"))) {
      console.log("  [OK] Seed assets present");
    } else {
      console.log("  [FAIL] Seed assets missing — run `npm run build` to rebuild");
      exitCode = 2;
    }

    // Check the server file recorded in the AI client's MCP config
    if (config.install?.server) {
      if (existsSync(config.install.server)) {
        console.log("  [OK] Recorded server file present");
      } else {
        console.log("  [FAIL] Recorded server file missing — the npm cache may have been cleared.");
        console.log(`         Run \`${getUserCommandPrefix()} update\` to repair.`);
        exitCode = 2;
      }
    } else {
      console.log("  [INFO] No install metadata (setup predates 0.3.0) — re-run init to record your client.");
    }

    if (existsSync(config.vault.path)) {
      console.log("  [OK] Vault path exists");
    } else {
      console.log("  [FAIL] Vault path does not exist");
      exitCode = 2;
    }

    const testFile = join(config.vault.path, ".dwg", "METADATA.md");
    if (existsSync(testFile)) {
      console.log("  [OK] Vault seed present (.dwg/METADATA.md found)");
    } else {
      console.log("  [WARN] Vault seed may be missing — run `dwg-loop seed`");
    }

    const contextFile = join(config.vault.path, "DWG-CONTEXT.md");
    if (existsSync(contextFile)) {
      const content = readFileSync(contextFile, "utf-8").trim();
      if (content.length === 0 || content.includes("Awaiting")) {
        console.log("  [INFO] First-run: DWG-CONTEXT.md is empty — onboarding interview will run");
      } else {
        console.log("  [OK] DWG-CONTEXT.md has content (setup complete)");
      }
    } else {
      console.log("  [WARN] DWG-CONTEXT.md missing — run `dwg-loop seed`");
    }

    let token: string | null = null;
    try {
      token = getTokenSafe(config);
      console.log("  [OK] Token configured");
    } catch {
      console.log("  [FAIL] Token not available");
      exitCode = 3;
    }

    if (config.dwg.mcpUrl && token) {
      const check = await checkTokenWithDwg(config.dwg.mcpUrl, token, 10000);
      if (check.status === "ok") {
        console.log("  [OK] DWG server reachable, token accepted");
      } else if (check.status === "rejected") {
        console.log(`  [FAIL] DWG server reachable but token rejected (${check.httpStatus})`);
        exitCode = 3;
      } else {
        console.log(`  [WARN] Could not verify with DWG server (${check.reason}) — vault still works locally`);
      }
    }
  } catch (error) {
    console.log(`  [FAIL] Config error: ${error instanceof Error ? error.message : String(error)}`);
    exitCode = 1;
  }

  console.log(`\n  ${exitCode === 0 ? "All checks passed." : "Some checks failed."}\n`);
  process.exit(exitCode);
}

async function seedCmd(opts: { vault?: string; force?: boolean; upgrade?: boolean }): Promise<void> {
  const configPath = process.env.DWG_LOOP_CONFIG ?? CONFIG_PATH;
  let vaultPath = opts.vault;

  if (!vaultPath) {
    try {
      const config = loadConfigSafe(configPath);
      vaultPath = config.vault.path;
    } catch {
      console.error("  No vault path provided and no config found. Run `dwg-loop init` first or pass --vault.");
      process.exit(1);
    }
  }

  await applySeed(resolve(expandTilde(vaultPath)), opts.force ?? false, opts.upgrade ?? false);
}

async function seedAction(opts: { vault?: string; force?: boolean; upgrade?: boolean }): Promise<void> {
  await seedCmd(opts);
}

async function configCmd(
  key: string | undefined,
  value: string | undefined,
  opts: { config?: string }
): Promise<void> {
  const configPath = opts.config ?? process.env.DWG_LOOP_CONFIG ?? CONFIG_PATH;
  const config = loadConfigSafe(configPath);

  if (!key) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  const parts = key.split(".");
  if (!value) {
    let current: unknown = config;
    for (const part of parts) {
      current = (current as Record<string, unknown>)[part];
    }
    console.log(String(current));
    return;
  }

  let obj: Record<string, unknown> = config as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj[parts[i]] as Record<string, unknown>;
  }
  obj[parts[parts.length - 1]] = value;

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`  Set ${key} = ${value}`);
}

async function emitConfigAction(
  client: string,
  opts: { config?: string; local?: boolean; scope?: string }
): Promise<void> {
  const configPath = opts.config ?? process.env.DWG_LOOP_CONFIG ?? CONFIG_PATH;
  const clientId = resolveClientId(client);
  const scope: Scope = opts.scope === "project" ? "project" : "global";

  const server = resolveServerCommand();
  console.log(generateConfigBlock(clientId, configPath, server));

  const targetFile = getConfigFilePath(clientId, scope);
  if (targetFile) {
    console.log(`\n  Target file: ${targetFile}`);
  }
}

async function applySeed(vaultPath: string, force = false, upgrade = false): Promise<void> {
  let seedDir = join(__dirname, "..", "seed");
  if (!existsSync(seedDir)) {
    seedDir = join(__dirname, "seed");
  }
  if (!existsSync(seedDir)) {
    throw new Error(`Seed directory not found: ${seedDir}`);
  }

  // Contract files: DWG-CONTEXT.md, INDEX.md, ACTIVITY-LOG.md, README.md
  // These are only written if missing, or if --force is set
  const contractFiles = ["DWG-CONTEXT.md", "INDEX.md", "ACTIVITY-LOG.md", "README.md"];

  // .dwg/ directory: rules, schemas, metadata
  // Always refreshed on seed (these are kit-managed, not user content)
  // In --upgrade mode, ONLY .dwg/ is touched — contract files are skipped entirely

  let created = 0;
  let skipped = 0;
  let updated = 0;

  if (!upgrade) {
    for (const file of contractFiles) {
      const srcPath = join(seedDir, file);
      const destPath = join(vaultPath, file);

      if (!existsSync(srcPath)) continue;

      if (existsSync(destPath)) {
        if (force) {
          writeFileSync(destPath, readFileSync(srcPath));
          console.log(`  [UPDATED] ${file} (overwritten)`);
          updated++;
        } else {
          console.log(`  [SKIP]    ${file} already exists (use --force to overwrite)`);
          skipped++;
        }
      } else {
        writeFileSync(destPath, readFileSync(srcPath));
        console.log(`  [CREATED] ${file}`);
        created++;
      }
    }
  }

  // .dwg/ — always copy (kit-managed rules, schemas, metadata)
  const dwgSrc = join(seedDir, ".dwg");
  const dwgDest = join(vaultPath, ".dwg");
  if (existsSync(dwgSrc)) {
    copyDirSync(dwgSrc, dwgDest);
    console.log(`  [OK]      .dwg/ rules + schemas ${upgrade ? "upgraded" : "seeded"}`);
    updated++;
  }

  // Always ensure folders exist
  mkdirSync(join(vaultPath, "Daily Notes"), { recursive: true });
  mkdirSync(join(vaultPath, "Archive"), { recursive: true });
  console.log(`  [OK]      Daily Notes/ + Archive/ folders ensured`);

  console.log(`\n  Seed complete: ${created} created, ${updated} updated, ${skipped} skipped.`);
  if (skipped > 0 && !force) {
    console.log(`  Run \`dwg-loop seed --force\` to overwrite existing contract files.`);
  }
}

function copyDirSync(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcEntryPath = join(src, entry.name);
    const destEntryPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcEntryPath, destEntryPath);
    } else {
      writeFileSync(destEntryPath, readFileSync(srcEntryPath));
    }
  }
}

function loadConfigSafe(configPath: string): LoopConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}. Run \`dwg-loop init\` first.`);
  }
  return JSON.parse(readFileSync(configPath, "utf-8")) as LoopConfig;
}

function getTokenSafe(config: LoopConfig): string {
  if (config.dwg.tokenEnv) {
    const token = process.env[config.dwg.tokenEnv];
    if (!token) throw new Error(`Env var ${config.dwg.tokenEnv} not set`);
    return token;
  }
  if (config.dwg.tokenFile && existsSync(config.dwg.tokenFile)) {
    return readFileSync(config.dwg.tokenFile, "utf-8").trim();
  }
  throw new Error("No token configured");
}
