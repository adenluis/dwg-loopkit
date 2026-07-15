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