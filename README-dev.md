# DWG Loop Kit

> Local MCP server that connects your AI to [DWG INTEL](https://dwg-research-center.vercel.app) research tools and your private Obsidian vault - in one conversation.

## What it does

- **DWG facts** - proxies your DWG MCP token to access live crypto research tools
- **Private vault** - reads/writes your local knowledge base via [mcpvault](https://github.com/bitbonsai/mcpvault) services
- **Playbook** - injects operating rules so the AI knows how to read, search, save, and retrieve from your vault
- **One connection** - your AI client only needs one MCP config entry

---

## Install (internal testing - from source)

The package is not yet published to npm. Install from the private GitHub repo.

### Prerequisites

- [Node.js](https://nodejs.org) **v20 or later** - check with `node -v`
- Access to the `adenluis/dwg-loopkit` GitHub repo
- Your DWG INTEL MCP token (starts with `dwg_...`)

### Step 1 - Clone and build

```bash
git clone https://github.com/adenluis/dwg-loopkit.git
cd dwg-loopkit
npm install
npm run build
```

### Step 2 - Run init

```bash
node dist/cli.js init
```

This will:
1. Ask for your vault folder path (or create one)
2. Ask for your DWG MCP token
3. Show an interactive menu to pick your AI client (opencode, Claude Desktop, Claude Code, Cursor, Codex CLI, Other)
4. Ask whether to install globally or for this project (where supported)
5. Seed the vault with folder structure and rule files
6. Auto-write the MCP config into your AI client's config file (or print it if auto-write isn't available)

Use `--local` so the generated config points at this local build instead of npx:

```bash
node dist/cli.js init --local --client opencode
```

Or run fully non-interactive:

```bash
node dist/cli.js init --local --client opencode --scope project --vault ~/dwg-vault --token dwg_xxx --yes
```

### Step 3 - Connect your AI

The init command auto-writes the MCP config into your AI client's config file where possible. Supported clients:

| Client | `--client` flag | Auto-write | Scope | Config location |
|---|---|---|---|---|
| **opencode** | `opencode` | File merge | Global / project | `opencode.json` or `opencode.jsonc` in project or `~/.config/opencode/` |
| **Claude Desktop** | `claude` | File merge | Single location | macOS: `~/Library/Application Support/Claude/` Windows: `%APPDATA%\Claude\` |
| **Claude Code CLI** | `claude-code` | `claude mcp add` | User / project | `~/.claude.json` or `.mcp.json` in project |
| **Cursor** | `cursor` | File merge | Global / project | `~/.cursor/mcp.json` or `.cursor/mcp.json` |
| **Codex CLI** | `codex` | `codex mcp add` | Global / project | `~/.codex/config.toml` or `.codex/config.toml` |
| **Other** | `other` | Print only | — | Prints generic config block with guidance |

Example with a specific client:

```bash
node dist/cli.js init --local --client opencode --scope project
node dist/cli.js init --local --client claude-code --scope user
node dist/cli.js init --local --client cursor --scope global
```

If auto-write fails (e.g. CLI not on PATH), the config is printed with the exact file path for manual paste. Other MCP-compatible clients (Cline, Roo Code, Continue.dev) use the same stdio transport and should technically work with the "Other" option.

Restart your AI client. Say **DWG start setup** to begin the onboarding interview.

### Step 4 - Verify

```bash
node dist/cli.js doctor
```

Checks: config, vault access, seed, playbook assets, token, DWG connectivity.

### Updating to latest version

```bash
cd dwg-loopkit
git pull
npm install
npm run build
```

Your vault and config are not affected. To refresh rule files in your vault:

```bash
node dist/cli.js seed --upgrade
```

---

## Install (when published to npm - not yet available)

Once published, the one-command install will be:

```bash
npx -y @dwgintel/loop init
```

No clone or build needed. The MCP config will use `npx -y @dwgintel/loop serve` automatically.

---

## Commands

| Command | Purpose |
|---|---|
| `node dist/cli.js init` | First-time setup — interactive client menu + auto-write |
| `node dist/cli.js init --client <id> --scope <global|project> --yes` | Non-interactive setup |
| `node dist/cli.js serve` | Start MCP server (stdio) |
| `node dist/cli.js doctor` | Health check: config, vault, seed, token, DWG connectivity |
| `node dist/cli.js seed` | Apply vault seed (skips existing files) |
| `node dist/cli.js seed --force` | Overwrite existing contract files (DWG-CONTEXT.md, etc.) |
| `node dist/cli.js seed --upgrade` | Refresh `.dwg/` rules + schemas only, no touch on personal notes |
| `node dist/cli.js config [key] [value]` | Read/set config |
| `node dist/cli.js emit-config <client> --scope <global|project> --local` | Print MCP config for any client (opencode, claude, claude-code, cursor, codex, other) |
| `node dist/cli.js version` | Print version |

## In-session commands

Once connected, say these to your AI. Include "DWG" so the AI knows to use Loop Kit tools:

| Say this | What happens |
|---|---|
| `DWG help` | Show the full command menu |
| `DWG start setup` | Run the onboarding interview (first-run) |
| `DWG status` | Show vault path, connection state, vault summary |
| `what DWG wallets do I have` | Read your vault profile |
| `DWG save this` / `DWG remember this` | Capture knowledge to the vault |
| `DWG run my knowledge review` | Weekly review of vault notes |
| `DWG take stock` | Long-term reflection |

## Vault structure

```
your-vault/
  DWG-CONTEXT.md             # your persistent profile (wallets, watchlist, goals)
  INDEX.md                   # knowledge map
  ACTIVITY-LOG.md            # audit trail (every write, ever)
  README.md                  # human-readable guide
  Protocols/                 # protocol profiles & research
  Wallets/                   # wallet profiles
  Watchlist/                 # token/project watch entries
  Strategy/                  # investment theses
  Decisions/                 # dated decision records
  Daily Notes/               # quick captures
  Archive/                   # historical material
  .dwg/
    METADATA.md              # review/reflection dates
    RULES/
      operating.md           # full operating rules (reference)
      capture.md             # what to save, where, tagging & linking
      review.md              # weekly review procedure
      reflection.md          # long-term reflection procedure
    SETUP/
      onboarding-interview.md
      schemas/
        wallet-profile.md
        research-result.md
        strategy-note.md
```

## Privacy

- Your vault stays on your machine. DWG never receives vault contents.
- Only public identifiers (addresses, tokens, chains) are sent to DWG for live fact lookups.
- Sync your vault folder with any third-party tool (Obsidian Sync, iCloud, Syncthing, etc.)

## License

[MIT](LICENSE)