import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";
import type { LoopConfig } from "./config.js";

export function loadConfig(configPath?: string): LoopConfig {
  const path = configPath ?? resolve(homedir(), ".dwg-loop", "config.json");

  if (!existsSync(path)) {
    throw new Error(`Config file not found: ${path}\nRun \`dwg-loop init\` first.`);
  }

  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw) as LoopConfig;

  if (!parsed.vault?.path) {
    throw new Error("Config is missing vault.path");
  }
  if (!parsed.dwg?.mcpUrl) {
    throw new Error("Config is missing dwg.mcpUrl");
  }

  return parsed;
}

export function getToken(config: LoopConfig): string {
  if (config.dwg.tokenEnv) {
    const token = process.env[config.dwg.tokenEnv];
    if (!token) {
      throw new Error(`Token env var ${config.dwg.tokenEnv} is not set`);
    }
    return token;
  }

  if (config.dwg.tokenFile) {
    if (!existsSync(config.dwg.tokenFile)) {
      throw new Error(`Token file not found: ${config.dwg.tokenFile}`);
    }
    return readFileSync(config.dwg.tokenFile, "utf-8").trim();
  }

  throw new Error("No token configured. Set dwg.tokenEnv or dwg.tokenFile in config.");
}