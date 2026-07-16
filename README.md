# DWG Loop Kit

> Local MCP server that connects your AI to [DWG INTEL](https://dwg-research-center.vercel.app) research tools and your private Obsidian vault - in one conversation.

## What it does

- **DWG facts** - proxies your DWG MCP token to access live crypto research tools
- **Private vault** - reads/writes your local knowledge base via [mcpvault](https://github.com/bitbonsai/mcpvault) services
- **Playbook** - injects operating rules so the AI knows how to read, search, save, and retrieve from your vault
- **One connection** - your AI client only needs one MCP config entry

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org) v20 or later
- A local AI client that supports MCP (Claude Desktop, opencode, Cursor, etc.)
- A DWG INTEL membership with an MCP token

### Install and set up

```bash
npx -y @dwgintel/loop init
```

This will:
1. Ask for your vault folder path (or create one)
2. Ask for your DWG MCP token
3. Seed the vault with folder structure and rule files
4. Save config to `~/.dwg-loop/config.json`
5. Print the MCP config to paste into your AI client

### Connect your AI

Paste the generated config into:
- **Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
- **opencode:** `~/.config/opencode/opencode.json`
- **Cursor:** Settings > MCP

Restart your AI client. On first connection, the AI will greet you and offer to run the onboarding interview.

### Verify setup

```bash
dwg-loop doctor
```

Checks: config, vault access, seed, token, DWG connectivity.

## Commands

| Command | Purpose |
|---|---|
| `dwg-loop init` | First-time setup (interactive or `--vault`, `--token` flags) |
| `dwg-loop serve` | Start MCP server (stdio) |
| `dwg-loop doctor` | Health check: config, vault, seed, token, DWG connectivity |
| `dwg-loop seed` | Apply vault seed (skips existing files) |
| `dwg-loop seed --force` | Overwrite existing contract files (DWG-CONTEXT.md, etc.) |
| `dwg-loop seed --upgrade` | Refresh `.dwg/` rules + schemas only, no touch on personal notes |
| `dwg-loop config [key] [value]` | Read/set config |
| `dwg-loop emit-config <client>` | Print MCP config JSON (claude, opencode, cursor) |
| `dwg-loop version` | Print version |

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

## How updates work

- Bump `@dwgintel/loop` version in your AI client config (or re-run `npx -y @dwgintel/loop@latest init`)
- Run `dwg-loop seed --upgrade` to refresh rule files without touching your personal notes
- One version number for support: `dwg-loop version`

## License

[MIT](LICENSE)