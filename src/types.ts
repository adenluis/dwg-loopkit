export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ToolHandlerResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

export type ToolHandler = (
  name: string,
  args: Record<string, unknown>
) => Promise<ToolHandlerResult | null>;