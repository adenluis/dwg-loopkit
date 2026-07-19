export interface InstallInfo {
  /** AI client id the MCP config was written for (see clients.ts) */
  client: string;
  /** Config scope used at init */
  scope: "global" | "project";
  /** Absolute path to the cli.js recorded in the AI client's MCP config */
  server: string;
  /** ISO timestamp of when the client config was last written */
  recordedAt: string;
}

export interface LoopConfig {
  version: number;
  dwg: {
    mcpUrl: string;
    tokenEnv: string | null;
    tokenFile: string | null;
  };
  vault: {
    path: string;
    toolPrefix: string;
  };
  playbook: {
    injectServerInstructions: boolean;
    refreshVaultPlaybookOnServe: boolean;
  };
  proxy: {
    timeoutMs: number;
  };
  /** Present on configs written by init >= 0.3.0; used by `update`/`--repoint` */
  install?: InstallInfo;
}

export const DEFAULT_CONFIG: Pick<LoopConfig, "version" | "playbook" | "proxy"> = {
  version: 1,
  playbook: {
    injectServerInstructions: true,
    refreshVaultPlaybookOnServe: false,
  },
  proxy: {
    timeoutMs: 60000,
  },
};

export const DEFAULT_DWG_MCP_URL = "https://dwg-research-center.vercel.app/mcp";