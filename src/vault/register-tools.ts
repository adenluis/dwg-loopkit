import { FileSystemService, FrontmatterHandler, PathFilter, SearchService } from "@bitbonsai/mcpvault";
import type { LoopConfig } from "../config.js";
import type { ToolDef, ToolHandler } from "../types.js";
import { shouldBlockWrite } from "../safety/secret-scan.js";

export function createVaultTools(config: LoopConfig): { tools: ToolDef[]; handler: ToolHandler } {
  const vaultPath = config.vault.path;
  const prefix = config.vault.toolPrefix || "";

  const pathFilter = new PathFilter();
  const frontmatterHandler = new FrontmatterHandler();
  const fs = new FileSystemService(vaultPath, pathFilter, frontmatterHandler);

  const tools: ToolDef[] = [
    {
      name: `${prefix}read_note`,
      description: "Read a note from the member's vault with parsed frontmatter",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the note relative to vault root" },
          prettyPrint: { type: "boolean", default: false },
        },
        required: ["path"],
      },
    },
    {
      name: `${prefix}write_note`,
      description: "Write a note to the member's vault (overwrite, append, or prepend)",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the note relative to vault root" },
          content: { type: "string", description: "Content of the note" },
          frontmatter: { type: "object", description: "Frontmatter object (optional)" },
          mode: { type: "string", enum: ["overwrite", "append", "prepend"], default: "overwrite" },
        },
        required: ["path", "content"],
      },
    },
    {
      name: `${prefix}patch_note`,
      description: "Efficiently update part of a note by replacing a specific string",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          oldString: { type: "string" },
          newString: { type: "string" },
          replaceAll: { type: "boolean", default: false },
        },
        required: ["path", "oldString", "newString"],
      },
    },
    {
      name: `${prefix}search_notes`,
      description: "Search for notes in the member's vault by content or frontmatter",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query text" },
          limit: { type: "number", default: 5 },
          searchContent: { type: "boolean", default: true },
          searchFrontmatter: { type: "boolean", default: false },
          caseSensitive: { type: "boolean", default: false },
          pathPrefix: { type: "string" },
          excludePaths: { type: "array", items: { type: "string" } },
          prettyPrint: { type: "boolean", default: false },
        },
        required: ["query"],
      },
    },
    {
      name: `${prefix}list_directory`,
      description: "List files and directories in the vault",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", default: "/" },
          prettyPrint: { type: "boolean", default: false },
        },
      },
    },
    {
      name: `${prefix}update_frontmatter`,
      description: "Update frontmatter of a note without changing content",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          frontmatter: { type: "object" },
          merge: { type: "boolean", default: true },
        },
        required: ["path", "frontmatter"],
      },
    },
    {
      name: `${prefix}manage_tags`,
      description: "Add, remove, or list tags in a note",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          operation: { type: "string", enum: ["add", "remove", "list"] },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["path", "operation"],
      },
    },
    {
      name: `${prefix}get_vault_stats`,
      description: "Get vault statistics: total notes, folders, size, recently modified files",
      inputSchema: {
        type: "object",
        properties: {
          recentCount: { type: "number", default: 5 },
          prettyPrint: { type: "boolean", default: false },
        },
      },
    },
  ];

  const handler: ToolHandler = async (name: string, args: Record<string, unknown>) => {
    const indent = args.prettyPrint ? 2 : undefined;

    switch (name) {
      case `${prefix}read_note`: {
        const note = await fs.readNote(args.path as string);
        return { content: [{ type: "text", text: JSON.stringify({ fm: note.frontmatter, content: note.content }, null, indent) }] };
      }
      case `${prefix}write_note`: {
        const content = args.content as string;
        const scan = shouldBlockWrite(content);
        if (scan.block) {
          return {
            content: [{ type: "text", text: `BLOCKED: ${scan.reason}. Seed phrases, private keys, passwords, and API keys are never saved to the vault.` }],
            isError: true,
          };
        }
        await fs.writeNote({
          path: args.path as string,
          content,
          frontmatter: args.frontmatter as Record<string, unknown> | undefined,
          mode: ((args.mode as string) || "overwrite") as "overwrite" | "append" | "prepend",
        });
        return { content: [{ type: "text", text: `Successfully wrote note: ${args.path} (mode: ${args.mode || "overwrite"})` }] };
      }
      case `${prefix}patch_note`: {
        const newString = args.newString as string;
        const scan = shouldBlockWrite(newString);
        if (scan.block) {
          return {
            content: [{ type: "text", text: `BLOCKED: ${scan.reason}. Seed phrases, private keys, passwords, and API keys are never saved to the vault.` }],
            isError: true,
          };
        }
        const result = await fs.patchNote({
          path: args.path as string,
          oldString: args.oldString as string,
          newString,
          replaceAll: args.replaceAll as boolean,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: !result.success };
      }
      case `${prefix}search_notes`: {
        const search = new SearchService(vaultPath, pathFilter);
        const results = await search.search({
          query: args.query as string,
          limit: args.limit as number,
          searchContent: args.searchContent as boolean,
          searchFrontmatter: args.searchFrontmatter as boolean,
          caseSensitive: args.caseSensitive as boolean,
          pathPrefix: args.pathPrefix as string,
          excludePaths: args.excludePaths as string[],
        });
        return { content: [{ type: "text", text: JSON.stringify(results, null, indent) }] };
      }
      case `${prefix}list_directory`: {
        const listing = await fs.listDirectory((args.path as string) || "");
        return { content: [{ type: "text", text: JSON.stringify({ dirs: listing.directories, files: listing.files }, null, indent) }] };
      }
      case `${prefix}update_frontmatter`: {
        await fs.updateFrontmatter({
          path: args.path as string,
          frontmatter: args.frontmatter as Record<string, unknown>,
          merge: (args.merge as boolean) ?? true,
        });
        return { content: [{ type: "text", text: `Successfully updated frontmatter for: ${args.path}` }] };
      }
      case `${prefix}manage_tags`: {
        const result = await fs.manageTags({
          path: args.path as string,
          operation: (args.operation as string) as "add" | "remove" | "list",
          tags: args.tags as string[],
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: !result.success };
      }
      case `${prefix}get_vault_stats`: {
        const stats = await fs.getVaultStats((args.recentCount as number) || 5);
        return { content: [{ type: "text", text: JSON.stringify({
          notes: stats.totalNotes,
          folders: stats.totalFolders,
          size: stats.totalSize,
          recent: stats.recentlyModified,
        }, null, indent) }] };
      }
      default:
        return null;
    }
  };

  return { tools, handler };
}