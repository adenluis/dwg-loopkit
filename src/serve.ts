import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { LoopConfig } from "./config.js";
import { loadConfig, getToken } from "./config-loader.js";
import { loadPlaybook, buildInstructions } from "./playbook/load.js";
import { createVaultTools } from "./vault/register-tools.js";
import { createDwgProxy } from "./proxy/dwg-client.js";
import type { DwgProxyState } from "./proxy/dwg-client.js";
import { createSessionStartTool } from "./playbook/session-start.js";
import type { ToolDef, ToolHandler } from "./types.js";
import { getPackageVersion, getUserCommandPrefix } from "./version.js";

export async function createLoopServer(configPath?: string): Promise<void> {
  const config = loadConfig(configPath);
  const playbook = loadPlaybook();
  const instructions = buildInstructions(config.vault.path, playbook);

  const vault = createVaultTools(config);
  const dwg = await createDwgProxy(config);
  const sessionStart = createSessionStartTool(config.vault.path, () => dwg.state);

  const allTools: ToolDef[] = [...sessionStart.tools, ...vault.tools, ...dwg.tools];
  const handlers: ToolHandler[] = [sessionStart.handler, vault.handler, dwg.handler];

  const server = new Server(
    { name: "dwg-loop", version: getPackageVersion() },
    {
      capabilities: { tools: {} },
      instructions,
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: allTools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: toolName, arguments: args } = request.params;

    for (const handler of handlers) {
      try {
        const result = await handler(toolName, args || {});
        if (result !== null) return result;
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : "Unknown error"}` }],
          isError: true,
        };
      }
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
      isError: true,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function serve(configPath?: string): Promise<void> {
  try {
    await createLoopServer(configPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`DWG Loop Kit failed to start: ${message}\n`);
    process.stderr.write(`Run \`${getUserCommandPrefix()} doctor\` to diagnose.\n`);
    process.exit(1);
  }
}