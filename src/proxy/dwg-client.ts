import type { LoopConfig } from "../config.js";
import { getToken } from "../config-loader.js";
import type { ToolDef, ToolHandler } from "../types.js";

interface RemoteTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

function parseSseResponse(text: string): Record<string, unknown> | null {
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      try {
        return JSON.parse(line.slice(6));
      } catch {}
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function dwgHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "Authorization": `Bearer ${token}`,
  };
}

export interface DwgProxyState {
  connected: boolean;
  toolCount: number;
  error: string | null;
  lastFetch: string | null;
}

export async function createDwgProxy(config: LoopConfig): Promise<{ tools: ToolDef[]; handler: ToolHandler; state: DwgProxyState }> {
  const token = getToken(config);
  const mcpUrl = config.dwg.mcpUrl;
  const proxyPrefix = "dwg_";

  const state: DwgProxyState = {
    connected: false,
    toolCount: 0,
    error: null,
    lastFetch: null,
  };

  let remoteTools: ToolDef[] = [];
  let toolsCached = false;

  async function fetchToolsList(): Promise<ToolDef[]> {
    if (toolsCached) return remoteTools;

    state.lastFetch = new Date().toISOString();

    try {
      const response = await fetch(mcpUrl, {
        method: "POST",
        headers: dwgHeaders(token),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        state.connected = false;
        if (response.status === 401) {
          state.error = "Token invalid (401). Run `dwg-loop doctor` to check your token.";
        } else {
          state.error = `DWG server returned HTTP ${response.status}`;
        }
        return remoteTools;
      }

      const rawText = await response.text();
      const data = parseSseResponse(rawText) as { result?: { tools?: RemoteTool[] } } | null;

      if (!data?.result?.tools) {
        state.connected = false;
        state.error = "DWG server reachable but returned no tools in response";
        return remoteTools;
      }

      remoteTools = data.result.tools.map(tool => ({
        name: `${proxyPrefix}${tool.name}`,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
      toolsCached = true;
      state.connected = true;
      state.error = null;
      state.toolCount = remoteTools.length;
      return remoteTools;
    } catch (error) {
      state.connected = false;
      const message = error instanceof Error ? error.message : "Unknown error";
      state.error = `DWG unreachable: ${message}. Vault tools still work — DWG research tools unavailable this session.`;
      return remoteTools;
    }
  }

  remoteTools = await fetchToolsList();

  const tools: ToolDef[] = remoteTools;

  const handler: ToolHandler = async (name: string, args: Record<string, unknown>) => {
    if (!name.startsWith(proxyPrefix)) return null;

    const remoteName = name.slice(proxyPrefix.length);

    try {
      const response = await fetch(mcpUrl, {
        method: "POST",
        headers: dwgHeaders(token),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: { name: remoteName, arguments: args ?? {} },
        }),
        signal: AbortSignal.timeout(config.proxy.timeoutMs),
      });

      if (!response.ok) {
        const status = response.status;
        const hint = status === 401 ? "token invalid — run `dwg-loop doctor`" : `DWG returned ${status}`;
        return { content: [{ type: "text", text: `DWG error: ${hint}` }], isError: true };
      }

      const rawText = await response.text();
      const data = parseSseResponse(rawText) as { result?: { content?: unknown[] }, error?: { message?: string } } | null;

      if (!data) {
        return { content: [{ type: "text", text: "DWG returned an unparseable response" }], isError: true };
      }

      if (data.error) {
        const errMsg = (data.error as { message?: string }).message ?? "Unknown DWG error";
        return { content: [{ type: "text", text: `DWG error: ${errMsg}` }], isError: true };
      }

      const result = data.result as { content?: Array<{ type: string; text: string }> } | undefined;

      if (result?.content) {
        return { content: result.content };
      }

      return { content: [{ type: "text", text: "DWG returned no content" }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: `DWG unreachable: ${message}. The vault still works — DWG facts are unavailable this session.` }],
        isError: true,
      };
    }
  };

  return { tools, handler, state };
}
