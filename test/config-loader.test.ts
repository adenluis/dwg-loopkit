import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { resolve } from "path";
import { loadConfig, getToken } from "../src/config-loader.js";

const TEST_CONFIG_DIR = join(homedir(), ".dwg-loop-test");
const TEST_CONFIG_PATH = join(TEST_CONFIG_DIR, "config.json");
const TEST_TOKEN_PATH = join(TEST_CONFIG_DIR, "token");

function writeTestConfig(): void {
  mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  writeFileSync(TEST_TOKEN_PATH, "dwg_test_token_12345");

  const config = {
    version: 1,
    playbook: {
      injectServerInstructions: true,
      refreshVaultPlaybookOnServe: false,
    },
    proxy: { timeoutMs: 60000 },
    dwg: {
      mcpUrl: "https://example.com/mcp",
      tokenEnv: null,
      tokenFile: TEST_TOKEN_PATH,
    },
    vault: {
      path: "/tmp/test-vault",
      toolPrefix: "vault_",
    },
  };

  writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config, null, 2));
}

describe("config-loader", () => {
  beforeEach(() => {
    writeTestConfig();
  });

  afterEach(() => {
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
  });

  it("loads config from explicit path", () => {
    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.version).toBe(1);
    expect(config.vault.path).toBe("/tmp/test-vault");
    expect(config.dwg.mcpUrl).toBe("https://example.com/mcp");
  });

  it("throws on missing config file", () => {
    expect(() => loadConfig("/nonexistent/path.json")).toThrow();
  });

  it("loads token from token file", () => {
    const config = loadConfig(TEST_CONFIG_PATH);
    const token = getToken(config);
    expect(token).toBe("dwg_test_token_12345");
  });

  it("throws when token file is missing", () => {
    const config = loadConfig(TEST_CONFIG_PATH);
    config.dwg.tokenFile = "/nonexistent/token";
    expect(() => getToken(config)).toThrow();
  });

  it("throws when no token source configured", () => {
    const config = loadConfig(TEST_CONFIG_PATH);
    config.dwg.tokenFile = null;
    config.dwg.tokenEnv = null;
    expect(() => getToken(config)).toThrow();
  });
});
