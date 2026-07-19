import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";
import { loadPlaybook, isFirstRun, readVaultMetadata } from "../playbook/load.js";
import { loadConfig, getToken } from "../config-loader.js";
import type { DwgProxyState } from "../proxy/dwg-client.js";
import type { ToolDef, ToolHandler } from "../types.js";
import { getPackageVersion, getLatestVersion, isNewerVersion, getUserCommandPrefix } from "../version.js";

type DwgStateGetter = () => DwgProxyState | null;

export function createSessionStartTool(vaultPath: string, dwgStateGetter?: DwgStateGetter): { tools: ToolDef[]; handler: ToolHandler } {
  const playbook = loadPlaybook();

  const tools: ToolDef[] = [
    {
      name: "dwg_loop_session_start",
      description:
        "DWG Loop Kit — Call this tool FIRST at the start of every conversation. " +
        "Returns your operating instructions, the current vault state (first-run onboarding interview or steady-state), " +
        "and review/reflection reminders. You are the AI of a DWG INTEL member — this tool defines your role and rules. " +
        "Always call this before answering any question.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "dwg_loop_status",
      description:
        "DWG Loop Kit — Show current system status: vault path, vault contents summary (wallets, watchlist, chains), " +
        "DWG connection, token state, first-run vs steady-state, and last review/reflection dates. " +
        "Call this when the member asks where things are stored, wants to check the system, or asks what you know about them.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "vault_get_context",
      description:
        "Read the member's profile, wallets, watchlist, chains, protocols, communication style, and privacy consents " +
        "from DWG-CONTEXT.md in the local vault. " +
        "ALWAYS call this when the member asks about their wallets, profile, preferences, watchlist, or what you know about them. " +
        "This is the LOCAL vault — not DWG remote memory or panels. The member's wallets live here, not in DWG memory.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "dwg_loop_help",
      description:
        "DWG Loop Kit — Show the member a plain-English menu of everything they can do: " +
        "natural language commands, trigger phrases, and available capabilities. " +
        "Call this when the member asks 'help', 'what can you do', 'commands', 'menu', " +
        "'how do I use this', or seems lost. " +
        "The output is pre-formatted markdown — display it verbatim to the member. Do NOT summarise, paraphrase, or condense it.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];

  const handler: ToolHandler = async (name: string, _args: Record<string, unknown>) => {
    if (name === "dwg_loop_status") {
      return { content: [{ type: "text", text: buildStatusReport(vaultPath, dwgStateGetter) }] };
    }

    if (name === "vault_get_context") {
      return { content: [{ type: "text", text: readContextFile(vaultPath) }] };
    }

    if (name === "dwg_loop_help") {
      return { content: [{ type: "text", text: buildHelpMenu(vaultPath) }] };
    }

    if (name !== "dwg_loop_session_start") return null;

    const firstRun = isFirstRun(vaultPath);
    const metadata = readVaultMetadata(vaultPath);

    let output = playbook;

    if (firstRun) {
      output +=
        "\n\n---\n\n## SESSION STATE: FIRST-RUN\n\n" +
        "DWG-CONTEXT.md is empty or missing. You are in first-run mode.\n" +
        "Greet the member warmly. Explain that before the system can work, you need to learn about their crypto world " +
        "(about 10 minutes). Ask if they're ready to begin.\n" +
        "If yes → read `.dwg/SETUP/onboarding-interview.md` using vault_read_note and follow it.\n" +
        "If not now → offer: \"Whenever you're ready, just say 'start setup'.\"\n" +
        "Do NOT skip the interview. Do NOT invent a profile. Do NOT proceed to steady-state until the member has " +
        "approved a summary and you have written DWG-CONTEXT.md.";
    } else {
      if (metadata.lastReview) {
        const days = daysSince(metadata.lastReview);
        if (days !== null && days >= 7) {
          output += `\n\n## REVIEW DUE\n\nLast knowledge review was ${days} days ago. At a natural pause, mention: "It's been ${days} days since your last knowledge review — say 'run my knowledge review' when you're ready."`;
        }
      }
      if (metadata.lastReflection) {
        const days = daysSince(metadata.lastReflection);
        if (days !== null && days >= 30) {
          output += `\n\n## REFLECTION DUE\n\nLast long-term reflection was ${days} days ago. Suggest: "It's been ${days} days since your last reflection — say 'take stock' when you're ready."`;
        }
      }
      output +=
        "\n\n## SESSION STATE: STEADY-STATE\n\n" +
        "Read DWG-CONTEXT.md silently using vault_get_context. Then follow the operating rules for every question.";
    }

    const updateNotice = await buildUpdateNotice();
    if (updateNotice) {
      output += updateNotice;
    }

    return {
      content: [{ type: "text", text: output }],
    };
  };

  return { tools, handler };
}

/**
 * Checks (cached, max once per 24h) whether a newer Loop Kit is published.
 * Returns an instruction block for the AI, or null when up to date / offline.
 */
async function buildUpdateNotice(): Promise<string | null> {
  try {
    const latest = await getLatestVersion();
    if (!latest) return null;
    const current = getPackageVersion();
    if (!isNewerVersion(latest, current)) return null;
    const cmd = `${getUserCommandPrefix()} update`;
    return (
      "\n\n## LOOP KIT UPDATE AVAILABLE\n\n" +
      `DWG Loop Kit ${latest} has been released (this install is ${current}). ` +
      "At a natural pause, mention it ONCE in plain language: " +
      `"A Loop Kit update (${latest}) is available. To install it, open a terminal and run: ${cmd}". ` +
      "Do not interrupt a task to say this, do not repeat it within the session, and do not speculate about what changed."
    );
  } catch {
    return null;
  }
}

function readContextFile(vaultPath: string): string {
  const contextPath = resolve(vaultPath, "DWG-CONTEXT.md");
  if (!existsSync(contextPath)) {
    return "DWG-CONTEXT.md not found. The vault may not be initialised — run `dwg-loop init` and `dwg-loop seed`.";
  }
  const content = readFileSync(contextPath, "utf-8").trim();
  if (content.length === 0 || content.includes("Awaiting onboarding")) {
    return "DWG-CONTEXT.md is empty (first-run). Onboarding interview has not been completed yet.";
  }
  return content;
}

function buildHelpMenu(vaultPath: string): string {
  const firstRun = isFirstRun(vaultPath);
  const lines: string[] = [
    "# DWG Loop Kit — Commands & Capabilities",
    "",
    "Here's everything you can do. Include \"DWG\" in your phrase so the AI knows to use Loop Kit tools.",
    "",
    "---",
    "",
    "## Getting Started",
    "",
    "| Say this | What happens |",
    "|---|---|",
    "| **DWG help** | Show this command menu |",
    "| **DWG start setup** | Begin the onboarding interview (first-run only) |",
    "| **call dwg_loop_session_start** | Load operating instructions + session state (manual fallback) |",
    "| **DWG status** | Show vault path, connection state, vault summary |",
    "",
    "## Your Profile & Context",
    "",
    "| Say this | What happens |",
    "|---|---|",
    "| **what DWG wallets do I have** | Read your vault profile (wallets, chains, watchlist) |",
    "| **what does DWG know about me** | Same — reads your DWG-CONTEXT.md |",
    "| **update my DWG profile** | Edit your DWG-CONTEXT.md (asks confirmation first) |",
    "",
    "## Crypto Research (DWG INTEL Tools)",
    "",
    "| Say this | What happens |",
    "|---|---|",
    "| **DWG list tools** | Show available live research tools |",
    "| **DWG check gas** / **what's ETH gas** | Current network fee (Protect wing) |",
    "| **DWG check this address** + address | Sanctions check (Investigate wing) |",
    "| **DWG what kind of wallet is** + address | Wallet capabilities check |",
    "| **DWG how's my loan doing** | Live lending positions (Own wing) |",
    "| **DWG is this project still being built** + repo | GitHub dev activity |",
    "| **DWG why is my transaction stuck** + tx hash | Transaction diagnostics |",
    "| **DWG what's changed since my last checks** | Re-run saved checks for changes |",
    "| **DWG what's my wallet holding** + address + chain | Live holdings read |",
    "",
    "> DWG tools need a chain (ethereum, arbitrum, base, pulsechain, etc.) and address. The AI will ask if you don't specify.",
    "",
    "## Knowledge & Vault",
    "",
    "| Say this | What happens |",
    "|---|---|",
    "| **DWG save this** / **DWG remember this** | Capture knowledge to the vault |",
    "| **DWG list vault** | Show vault directory structure |",
    "| **DWG search for** + keyword | Search vault notes by content |",
    "| **DWG read** + note name | Read a specific vault note |",
    "| **DWG what's my activity log** | Show the audit trail of all vault writes |",
    "",
    "## Knowledge Maintenance",
    "",
    "| Say this | What happens |",
    "|---|---|",
    "| **DWG run my knowledge review** | Weekly review — check for stale notes, gaps, contradictions |",
    "| **DWG take stock** | Long-term reflection — patterns, recurring lessons, strategy review |",
    "| **DWG reorganise vault** / **DWG tidy vault** | Clean up file placement, tags, and wikilinks |",
    "",
    "## Vault Structure",
    "",
    "```",
    "vault/",
    "  DWG-CONTEXT.md       ← your profile (who you are, wallets, watchlist)",
    "  INDEX.md             ← knowledge map (what notes exist)",
    "  ACTIVITY-LOG.md      ← audit trail (every write, ever)",
    "  Protocols/           ← protocol profiles & research",
    "  Wallets/             ← wallet profiles",
    "  Watchlist/           ← token/project watch entries",
    "  Strategy/            ← investment theses",
    "  Decisions/           ← dated decision records",
    "  Daily Notes/         ← quick captures",
    "  Archive/             ← historical material",
    "  .dwg/",
    "    RULES/             ← operating, capture, review, reflection rules",
    "    SETUP/             ← onboarding interview + note schemas",
    "    METADATA.md        ← review/reflection dates",
    "```",
    "",
    "## Tips",
    "",
    "- Include \"DWG\" in your request so the AI knows to use Loop Kit tools.",
    "- Say **\"DWG save what's useful\"** after any conversation to capture durable knowledge.",
    "- The AI reads your profile silently — you never need to remind it who you are.",
    "- Every vault write is logged in ACTIVITY-LOG.md. You can always audit what was saved.",
    "- The AI never gives financial advice — it gives facts with sources. Decisions are yours.",
  ];

  if (firstRun) {
    lines.splice(4, 0, "",
      "> **First-run detected:** Say **DWG start setup** to begin your onboarding interview (~10 minutes).",
      "");
  }

  return lines.join("\n");
}

function buildStatusReport(vaultPath: string, dwgStateGetter?: DwgStateGetter): string {
  const lines: string[] = ["# DWG Loop Kit — System Status", ""];

  lines.push("## Loop Kit");
  lines.push(`- Version: ${getPackageVersion()}`);
  lines.push("");

  // Vault path
  lines.push("## Vault");
  lines.push(`- Path: \`${vaultPath}\``);
  lines.push(`- Exists: ${existsSync(vaultPath) ? "Yes" : "No"}`);

  if (existsSync(vaultPath)) {
    let fileCount = 0;
    try {
      fileCount = countFilesRecursive(vaultPath);
    } catch {}
    lines.push(`- Total files: ${fileCount}`);

    const contextPath = resolve(vaultPath, "DWG-CONTEXT.md");
    const contextExists = existsSync(contextPath);
    let contextState = "missing";
    if (contextExists) {
      const content = readFileSync(contextPath, "utf-8").trim();
      contextState = content.length === 0 || content.includes("Awaiting onboarding") ? "empty (first-run)" : "populated";
    }
    lines.push(`- DWG-CONTEXT.md: ${contextState}`);

    // Show vault summary if populated
    if (contextState === "populated") {
      const summary = summarizeContext(contextPath);
      if (summary) {
        lines.push("");
        lines.push("### Member Context Summary");
        lines.push(summary);
      }
    }

    const metadata = readVaultMetadata(vaultPath);
    lines.push(`- Last review: ${metadata.lastReview ?? "never"}`);
    lines.push(`- Last reflection: ${metadata.lastReflection ?? "never"}`);
  }

  lines.push("");

  // DWG connection
  lines.push("## DWG INTEL Connection");
  try {
    const config = loadConfig();
    lines.push(`- MCP URL: ${config.dwg.mcpUrl}`);
    lines.push(`- Token source: ${config.dwg.tokenEnv ? `env: ${config.dwg.tokenEnv}` : config.dwg.tokenFile ? `file: ${config.dwg.tokenFile}` : "none"}`);

    try {
      getToken(config);
      lines.push("- Token: loaded");
    } catch (e) {
      lines.push(`- Token: ${e instanceof Error ? e.message : "not available"}`);
    }
  } catch (e) {
    lines.push(`- Config: ${e instanceof Error ? e.message : "failed to load"}`);
  }

  // Live proxy state (from server startup)
  if (dwgStateGetter) {
    const proxyState = dwgStateGetter();
    if (proxyState) {
      lines.push("");
      lines.push("### Live Connection Status");
      lines.push(`- Connected: ${proxyState.connected ? "Yes" : "No"}`);
      lines.push(`- DWG tools available: ${proxyState.toolCount}`);
      if (proxyState.lastFetch) {
        lines.push(`- Last fetch: ${proxyState.lastFetch}`);
      }
      if (proxyState.error) {
        lines.push(`- Error: ${proxyState.error}`);
      }
    }
  }

  lines.push("");

  // Session state
  const firstRun = isFirstRun(vaultPath);
  lines.push("## Session State");
  lines.push(`- Mode: ${firstRun ? "FIRST-RUN (onboarding needed)" : "STEADY-STATE"}`);

  return lines.join("\n");
}

function summarizeContext(contextPath: string): string {
  try {
    const content = readFileSync(contextPath, "utf-8");
    const lines: string[] = [];

    // Extract wallets table
    const walletMatch = content.match(/## Wallets\n([\s\S]*?)(?=\n## |$)/);
    if (walletMatch) {
      const walletLines = walletMatch[1].trim().split("\n").filter(l => l.startsWith("|") && !l.includes("---") && !l.includes("Label"));
      if (walletLines.length > 0) {
        lines.push("- Wallets:");
        for (const wl of walletLines) {
          const cells = wl.split("|").map(c => c.trim()).filter(c => c);
          if (cells.length >= 3) lines.push(`  - ${cells[0]}: ${cells[2]} (${cells[1]})`);
        }
      }
    }

    // Extract watchlist
    const watchMatch = content.match(/## Watchlist\n([\s\S]*?)(?=\n## |$)/);
    if (watchMatch) {
      const items = watchMatch[1].trim().split("\n").filter(l => l.startsWith("-")).map(l => l.trim());
      if (items.length > 0) {
        lines.push(`- Watchlist: ${items.map(i => i.replace("-", "").trim()).join(", ")}`);
      }
    }

    // Extract chains
    const chainMatch = content.match(/## Chains\n([\s\S]*?)(?=\n## |$)/);
    if (chainMatch) {
      const items = chainMatch[1].trim().split("\n").filter(l => l.startsWith("-")).map(l => l.trim());
      if (items.length > 0) {
        lines.push(`- Chains: ${items.map(i => i.replace("-", "").trim()).join(", ")}`);
      }
    }

    return lines.join("\n");
  } catch {
    return "";
  }
}

function countFilesRecursive(dir: string): number {
  let count = 0;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      count += countFilesRecursive(fullPath);
    } else {
      count++;
    }
  }
  return count;
}

function daysSince(dateStr: string): number | null {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}
