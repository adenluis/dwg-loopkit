#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { DEFAULT_CONFIG, DEFAULT_DWG_MCP_URL } from "./config.js";
import type { LoopConfig } from "./config.js";
import { serve } from "./serve.js";
import {
  CLIENTS,
  resolveClientId,
  generateConfigBlock,
  autoWriteConfig,
  getConfigFilePath,
  detectLocalCliPath,
  setLocalCliPath,
  getClientHelpText,
} from "./clients.js";
import type { ClientId, Scope } from "./clients.js";

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

const program = new Command();

program
  .name("dwg-loop")
  .description("DWG Loop Kit — connect your AI to DWG INTEL and your private vault")
  .version(getPackageVersion());

program
  .command("init")
  .description("Set up Loop Kit: choose vault, enter token, seed structure, print AI config")
  .option("--vault <path>", "path to vault folder (skip prompt)")
  .option("--token <token>", "DWG MCP token (skip prompt)")
  .option("--mcp-url <url>", "DWG MCP server URL", DEFAULT_DWG_MCP_URL)
  .option("--token-env <var>", "store token as env var reference instead of file")
  .option("--client <name>", "AI client: opencode | claude | claude-code | cursor | codex | other")
  .option("--scope <scope>", "config scope: global | project (default: global)")
  .option("--yes", "skip all prompts, use defaults or provided flags")
  .option("--local", "generate MCP config pointing at this local build instead of npx")
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
  .option("--local", "generate MCP config pointing at this local build instead of npx")
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
}): Promise<void> {
  const rl = createInterface({ input, output });
  const nonInteractive = opts.yes === true;

  console.log("\n  DWG Loop Kit — Setup\n");

  // Vault path
  let vaultPath: string;
  if (opts.vault) {
    vaultPath = opts.vault;
  } else if (nonInteractive) {
    vaultPath = resolve(homedir(), "dwg-vault");
    console.log(`  Using default vault path: ${vaultPath}`);
  } else {
    vaultPath = (await rl.question("  Path to your vault folder (e.g. ~/dwg-vault): ")).trim();
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
      const create = await rl.question(`  "${resolvedVault}" doesn't exist. Create it? (y/n): `);
      if (create.trim().toLowerCase().startsWith("y")) {
        mkdirSync(resolvedVault, { recursive: true });
      } else {
        console.error("  Cannot continue without a vault path.");
        process.exit(1);
      }
    }
  }

  // Token
  let token: string;
  if (opts.token) {
    token = opts.token;
  } else if (opts.tokenEnv) {
    token = "";
  } else if (nonInteractive) {
    console.error("  Token is required. Provide --token or --token-env.");
    process.exit(1);
  } else {
    token = (await rl.question("  DWG MCP token (dwg_...): ")).trim();
  }
  if (!token && !opts.tokenEnv) {
    console.error("  Token is required.");
    process.exit(1);
  }

  // Client selection
  let clientId: ClientId;
  if (opts.client) {
    clientId = resolveClientId(opts.client);
  } else if (nonInteractive) {
    clientId = "other";
  } else {
    console.log("\n  Which AI client do you use?\n");
    CLIENTS.forEach((c, i) => {
      const num = i + 1;
      const autoTag =
        c.autoWriteStrategy === "cli"
          ? "(auto-configure via CLI)"
          : c.autoWriteStrategy === "file"
            ? "(auto-configure)"
            : "(print config for manual setup)";
      console.log(`    ${num}. ${c.label} ${autoTag}`);
    });
    console.log();
    const answer = await rl.question(`  Enter choice [1]: `);
    const idx = parseInt(answer.trim(), 10) || 1;
    const clamped = Math.max(1, Math.min(idx, CLIENTS.length));
    clientId = CLIENTS[clamped - 1].id;
  }

  // Scope selection
  let scope: Scope = "global";
  const clientDef = CLIENTS.find((c) => c.id === clientId)!;
  if (clientDef.hasScopeChoice) {
    if (opts.scope) {
      scope = opts.scope === "project" ? "project" : "global";
    } else if (!nonInteractive) {
      const answer = await rl.question("\n  Install globally or for this project only? (global/project) [global]: ");
      if (answer.trim().toLowerCase().startsWith("p")) {
        scope = "project";
      }
    }
  }

  // Local path detection
  if (opts.local) {
    setLocalCliPath(resolve(__dirname, "cli.js"));
  } else {
    setLocalCliPath(null);
  }

  await rl.close();

  mkdirSync(CONFIG_DIR, { recursive: true });

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
  };

  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  if (!opts.tokenEnv && token) {
    writeFileSync(join(CONFIG_DIR, "token"), token, { mode: 0o600 });
  }

  await applySeed(resolvedVault, true, false);

  console.log("\n  Vault seeded. Config saved to:\n");
  console.log(`    ${CONFIG_PATH}`);

  // Auto-write or print config
  const localCliPath = detectLocalCliPath();

  console.log(`\n  Configuring ${clientDef.label} (${scope} scope)...\n`);

  const result = autoWriteConfig(clientId, CONFIG_PATH, scope, localCliPath);

  if (result.success) {
    console.log(`  [OK] ${result.message}`);
    console.log("\n  Restart your AI client. After connecting, say \"DWG help\" to see all commands.\n");
  } else {
    console.log(`  [!] ${result.message}`);
    console.log(`\n  Your ${clientDef.label} MCP config:\n`);
    console.log(generateConfigBlock(clientId, CONFIG_PATH, localCliPath));

    if (result.configPath) {
      console.log(`\n  Paste this into: ${result.configPath}\n`);
    } else {
      console.log("\n  Paste this into your AI client's MCP configuration.\n");
    }

    if (clientId === "other") {
      console.log(`  ${getClientHelpText(clientId)}\n`);
    }

    console.log("  After connecting, say \"DWG help\" to see all commands.\n");
  }
}

async function serveCmd(opts: { config?: string }): Promise<void> {
  const configPath = opts.config ?? process.env.DWG_LOOP_CONFIG;
  await serve(configPath);
}

async function doctor(opts: { config?: string }): Promise<void> {
  const configPath = opts.config ?? process.env.DWG_LOOP_CONFIG ?? CONFIG_PATH;
  let exitCode = 0;

  console.log("\n  DWG Loop Kit — Doctor\n");

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

    try {
      const token = getTokenSafe(config);
      console.log("  [OK] Token configured");
    } catch {
      console.log("  [FAIL] Token not available");
      exitCode = 3;
    }

    if (config.dwg.mcpUrl) {
      try {
        const response = await fetch(config.dwg.mcpUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": `Bearer ${getTokenSafe(config)}`,
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
          console.log("  [OK] DWG server reachable");
        } else if (response.status === 401) {
          console.log("  [FAIL] DWG server reachable but token invalid (401)");
          exitCode = 3;
        } else {
          console.log(`  [WARN] DWG server returned ${response.status}`);
        }
      } catch {
        console.log("  [WARN] Could not reach DWG server (vault still works locally)");
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

  if (opts.local) {
    setLocalCliPath(resolve(__dirname, "cli.js"));
  } else {
    setLocalCliPath(null);
  }

  const localCliPath = detectLocalCliPath();
  console.log(generateConfigBlock(clientId, configPath, localCliPath));

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

function getPackageVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    if (existsSync(pkgPath)) {
      return JSON.parse(readFileSync(pkgPath, "utf-8")).version ?? "0.0.0";
    }
  } catch {
  }
  return "0.0.0";
}