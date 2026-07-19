# DWG Loop Kit

> Local MCP server that connects your AI to [DWG INTEL](https://dwg-research-center.vercel.app) research tools and your private Obsidian vault - in one conversation.

## What it does

- **DWG facts** - proxies your DWG MCP token to access live crypto research tools
- **Private vault** - reads/writes your local knowledge base via [mcpvault](https://github.com/bitbonsai/mcpvault) services
- **Playbook** - injects operating rules so the AI knows how to read, search, save, and retrieve from your vault
- **One connection** - your AI client only needs one MCP config entry

## Quick start

### 1. Install Node.js 20 or later

Check whether you have it: open a terminal (PowerShell on Windows, Terminal on Mac) and run `node -v`. If you see v20 or higher, skip ahead.

- **Windows** - download the LTS installer from [nodejs.org](https://nodejs.org) (choose Windows Installer)
- **Mac** - download from [nodejs.org](https://nodejs.org), or `brew install node`
- **Linux** - use your package manager or [nodejs.org](https://nodejs.org)

### 2. Copy your DWG MCP token

Log into your [DWG INTEL account](https://dwg-research-center.vercel.app) and copy your MCP token from your account settings. It starts with `dwg_`.

### 3. Run the installer

```bash
npx -y @dwgintel/loop init
```

The installer does the work for you:

1. **Vault folder** - press Enter to accept the default (`~/dwg-vault`), or type your own path
2. **Token** - paste your token (hidden as you type); it's checked against DWG immediately, so a typo can't silently break your setup
3. **AI client** - detected clients are marked automatically; just confirm the right one
4. **Scope** - "all your projects" (recommended) or just one folder
5. Your vault is seeded with its folder structure and rule files
6. The MCP config is written into your AI client's config file with full absolute paths (no `npx` PATH problems), or printed for manual paste if auto-write isn't available

### 4. Restart your AI client

Quit it fully and reopen, then start a new conversation and say **DWG help**. On first connection the AI will greet you and offer the onboarding interview.

### Verify any time

```bash
npx -y @dwgintel/loop doctor
```

Checks: version + updates, config, vault access, seed, recorded server file, token, DWG connectivity.

## Supported AI clients

| Client | Auto-write | Scope | Notes |
|---|---|---|---|
| **opencode** | Yes (file merge) | Global / project | Merges into `opencode.json` or `opencode.jsonc` |
| **Claude Desktop** | Yes (file merge) | Single location | Writes to `claude_desktop_config.json` |
| **Claude Code CLI** | Yes (via `claude mcp add`) | User / project | Uses Claude Code's CLI to add the server |
| **Cursor** | Yes (file merge) | Global / project | Writes to `.cursor/mcp.json` |
| **Codex CLI** | Yes (via `codex mcp add`) | Global / project | Uses Codex CLI to add the server |
| **Other** | No (prints config) | — | Prints config block with guidance |

Generated configs point at the exact Node binary and server file used during install (absolute paths), pinned to the installed version - so clients that can't see `npx` on their PATH still start reliably. If auto-write fails (e.g., CLI not on PATH), it falls back to printing the config with the exact file path to paste it into.

### Non-interactive setup

Skip the prompts by providing flags directly:

```bash
npx -y @dwgintel/loop init --vault ~/dwg-vault --token dwg_xxx --client opencode --scope project --yes
```

| Flag | Purpose |
|---|---|
| `--vault <path>` | Vault folder path (created if missing) |
| `--token <token>` | DWG MCP token (starts with `dwg_...`) |
| `--client <name>` | AI client: `opencode`, `claude`, `claude-code`, `cursor`, `codex`, `other` |
| `--scope <scope>` | `global` (default) or `project` |
| `--yes` | Skip all prompts, use defaults or provided flags |

## Updating

Your install runs a **fixed version** - nothing changes underneath you mid-session. When a new version is released, your AI mentions it once at a natural pause ("A Loop Kit update is available..."). To install it:

```bash
npx -y @dwgintel/loop update
```

(`dwg-loop update` if you installed globally.)

One command does everything: downloads the new version, re-points your AI client's config at it, and refreshes the vault's rule files - your personal notes are never touched.

## Troubleshooting

| Symptom | Fix |
|---|---|
| **"node" or "npx" is not recognised** | Node.js isn't installed (or the terminal was open during install). Install Node 20+ from [nodejs.org](https://nodejs.org), then open a **new** terminal. |
| **Server needs Node 20+** | You're on an old Node version. Update from [nodejs.org](https://nodejs.org) (or `brew install node` on Mac). |
| **AI client starts but no DWG tools appear** | Restart the client *completely* (quit, not just close the window). Still nothing? Run `npx -y @dwgintel/loop doctor`. |
| **Token rejected (401)** | The token is wrong or revoked. Re-copy it from your DWG INTEL account and re-run `npx -y @dwgintel/loop init` (your vault notes are never overwritten by init). |
| **Worked before, now the server won't start after cleaning npm cache** | The recorded server file was removed. Run `npx -y @dwgintel/loop update` - it repairs the config. |
| **Where is my client's config file?** | opencode: `~/.config/opencode/opencode.json` · Claude Desktop (Win): `%APPDATA%\Claude\claude_desktop_config.json` · (Mac): `~/Library/Application Support/Claude/claude_desktop_config.json` · Cursor: `~/.cursor/mcp.json` · Codex: `~/.codex/config.toml` |
| **Something else** | Run `npx -y @dwgintel/loop doctor` and share the output with DWG support. `npx -y @dwgintel/loop version` gives your version number. |

## Commands

| Command | Purpose |
|---|---|
| `dwg-loop init` | First-time setup — interactive client menu + auto-write |
| `dwg-loop init --client opencode --scope project --yes` | Non-interactive setup for opencode, project scope |
| `dwg-loop update` | Update to the latest version + refresh vault rules |
| `dwg-loop init --repoint` | Re-point the recorded AI client at this install (repair) |
| `dwg-loop serve` | Start MCP server (stdio) |
| `dwg-loop doctor` | Health check: version, config, vault, seed, server file, token, DWG connectivity |
| `dwg-loop seed` | Apply vault seed (skips existing files) |
| `dwg-loop seed --force` | Overwrite existing contract files (DWG-CONTEXT.md, etc.) |
| `dwg-loop seed --upgrade` | Refresh `.dwg/` rules + schemas only, no touch on personal notes |
| `dwg-loop config [key] [value]` | Read/set config |
| `dwg-loop emit-config <client> --scope <global|project>` | Print MCP config for any client (opencode, claude, claude-code, cursor, codex, other) |
| `dwg-loop version` | Print version |

Installed via npx (the default), prefix commands with `npx -y @dwgintel/loop` instead of `dwg-loop` — e.g. `npx -y @dwgintel/loop doctor`.

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
- Your MCP token is stored locally in `~/.dwg-loop/` and never printed or logged.
- Sync your vault folder with any third-party tool (Obsidian Sync, iCloud, Syncthing, etc.)

## License

[MIT](LICENSE)
