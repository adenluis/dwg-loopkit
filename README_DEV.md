# DWG Loop Kit

> Local MCP server that connects your AI to DWG INTEL research tools and your private Obsidian vault — in one conversation.

## First-time install & setup

### Prerequisites

- [Node.js](https://nodejs.org) **v20 or later** — check with `node -v`
- A local AI client that supports MCP (Claude Desktop, opencode, Cursor, etc.)
- Your DWG INTEL MCP token (starts with `dwg_...`)

### Step 1 — Build the package

The package is not yet on npm, so build it locally first:

```bash
cd loopkit
npm install
npm run build
```

This compiles TypeScript to `dist/` and pulls dependencies (including `@bitbonsai/mcpvault`).

### Step 2 — Run init

```bash
node dist/cli.js init
```

You'll be asked:

1. **Vault folder path** — where your knowledge base will live (e.g. `C:\Users\Jeremy\Documents\DWG-Knowledge`). Creates it if it doesn't exist.
2. **DWG MCP token** — your `dwg_...` token from DWG INTEL.

Init then:
- Saves your config to `~/.dwg-loop/config.json`
- Saves your token to `~/.dwg-loop/token` (file permissions set to owner-only)
- Seeds your vault with the full folder structure, rule files, and templates
- Prints the MCP config you need for Step 3

You can also pass both non-interactively:

```bash
node dist/cli.js init --vault "C:\Users\Jeremy\Documents\DWG-Knowledge" --token "dwg_yourtoken"
```

### Step 3 — Run doctor

```bash
node dist/cli.js doctor
```

This verifies:
- Config file parsed correctly
- Vault path exists and is accessible
- Vault seed present (`.dwg/METADATA.md`)
- First-run status (whether onboarding interview will trigger)
- Token configured
- DWG server reachable with valid token

Everything should show `[OK]` except potentially the DWG server check (depends on network/token validity). `[INFO]` lines are informational, not failures.

### Step 4 — Connect your AI client

The `init` command printed a JSON config. Copy it into your AI client:

**opencode** — `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "dwg-loop": {
      "type": "local",
      "command": ["node", "C:\\path\\to\\loopkit\\dist\\cli.js", "serve"],
      "enabled": true,
      "environment": {
        "DWG_LOOP_CONFIG": "C:\\Users\\Jeremy\\.dwg-loop\\config.json"
      }
    }
  }
}
```

**Claude Desktop** — `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dwg-loop": {
      "command": "node",
      "args": ["C:\\path\\to\\loopkit\\dist\\cli.js", "serve"],
      "env": {
        "DWG_LOOP_CONFIG": "C:\\Users\\Jeremy\\.dwg-loop\\config.json"
      }
    }
  }
}
```

**Cursor** — Settings → MCP, same structure as Claude Desktop.

> **Important:** Use the **absolute path** to `dist/cli.js` on your machine — not `npx @dwg/loop`. The package isn't published yet.

You can regenerate the config any time:

```bash
node dist/cli.js emit-config opencode
node dist/cli.js emit-config claude
node dist/cli.js emit-config cursor
```

### Step 5 — Restart your AI client and test

Restart your AI client so it picks up the new MCP server.

**First session — onboarding interview:**

On the first MCP connection, the kit detects that `DWG-CONTEXT.md` is empty. It injects first-run instructions that make the AI:

1. Greet you warmly
2. Explain it needs to learn about your crypto world (~10 minutes)
3. Ask if you're ready to begin

If you say yes, the AI reads `.dwg/SETUP/onboarding-interview.md` and conducts the interview — one question at a time, learning about your crypto experience, goals, wallets, projects, watchlists, etc.

After the interview, the AI:
- Shows you a summary for approval
- Once approved, creates `DWG-CONTEXT.md`, updates `INDEX.md`, and writes initial notes
- The system is now ready for the knowledge loop

**Second+ sessions — steady state:**

The AI reads `DWG-CONTEXT.md` silently at the start, then follows the operating rules for every question. The knowledge loop runs automatically:

```
You ask a question
    → AI searches your vault for relevant context
    → AI calls DWG tools for live facts
    → AI answers using both
    → AI saves useful results back to your vault
    → Next time, it finds those notes and compounds
```

### Verification checklist

After your first real conversation, check:

- [ ] The AI greeted you and offered the interview
- [ ] After the interview, `DWG-CONTEXT.md` has content (not "Awaiting onboarding interview")
- [ ] `INDEX.md` has entries
- [ ] `ACTIVITY-LOG.md` has at least one line recording the interview
- [ ] You can ask "what do you know about my crypto world?" and get a personalised answer
- [ ] Vault files stay on your machine (nothing was uploaded)

---

## Commands reference

| Command | Purpose |
|---|---|
| `node dist/cli.js init` | First-time setup (config + seed vault + print AI config) |
| `node dist/cli.js serve` | Start MCP server (stdio) — called by your AI client |
| `node dist/cli.js doctor` | Health check (config, vault, seed, token, DWG connectivity) |
| `node dist/cli.js seed` | Re-apply vault seed (folder structure + rule files) |
| `node dist/cli.js seed --upgrade` | Upgrade seed rules without wiping personal notes |
| `node dist/cli.js config [key] [value]` | Read or set config values (e.g. `config vault.path`) |
| `node dist/cli.js emit-config <client>` | Print MCP config JSON for claude / opencode / cursor |
| `node dist/cli.js version` | Print version |

---

## Vault structure after seeding

```
your-vault/
  .dwg/
    METADATA.md                  # review/reflection dates (kit-managed)
    RULES/
      operating.md               # full operating rules (reference)
      capture.md                 # what to save and when
      review.md                  # weekly review procedure
      reflection.md              # long-term reflection procedure
    SETUP/
      onboarding-interview.md    # first-session interview guide
      schemas/
        wallet-profile.md        # note template for wallets
        research-result.md       # note template for DWG research
        strategy-note.md         # note template for theses
  DWG-CONTEXT.md                 # your persistent profile (AI-managed)
  INDEX.md                       # knowledge map (AI-managed)
  ACTIVITY-LOG.md                # audit trail (AI-managed, append-only)
  Daily Notes/                   # quick captures
  Archive/                       # historical material
  README.md                      # human-readable vault guide
```

---

## How it works under the hood

```
                    Your AI client (MCP-capable)
                              │
                              │  ONE MCP connection (stdio)
                              ▼
                 ┌────────────────────────────┐
                 │     DWG Loop Kit (local)   │
                 │                            │
                 │  A. Playbook (instructions)│  ← always injected
                 │  B. Vault tools            │  ← mcpvault library
                 │  C. DWG proxy tools        │  ← remote /mcp + token
                 │  D. CLI (init/doctor/seed) │
                 └───────────┬───────┬────────┘
                             │       │
              local disk      │       │  HTTPS + bearer token
                             ▼       ▼
                      ┌──────────┐  ┌─────────────────┐
                      │ Vault    │  │ DWG INTEL /mcp  │
                      │ folder   │  │ facts-only tools │
                      │ PRIVATE  │  │                  │
                      └──────────┘  └─────────────────┘
```

The AI sees **one** MCP server with two kinds of tools:
- `vault_*` tools — search, read, write, patch notes in your local folder
- `dwg_*` tools — research tools from the live DWG INTEL server (forwarded with your token)

---

## Privacy

- **Vault stays on your machine.** DWG Loop Kit has no API that uploads vault contents to DWG.
- Only public identifiers (wallet addresses, tokens, chains) leave the machine — and only when the AI calls a DWG research tool.
- Your token is stored in `~/.dwg-loop/token` with owner-only file permissions.
- Sync your vault with any third-party tool (Obsidian Sync, iCloud, Syncthing, Git, etc.) — the kit doesn't care how the folder gets there.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `command not found: node` | Install [Node.js](https://nodejs.org) v20+ |
| `Config not found` | Run `node dist/cli.js init` first |
| `DWG server returned 401` | Token is invalid or expired — get a new one from the DWG website |
| Vault tools work but DWG tools fail | Network issue or token problem — vault is still usable offline |
| AI says "I can't reach your vault" | Check vault path exists: `dwg-loop doctor` |
| Onboarding interview didn't trigger | Check `DWG-CONTEXT.md` is empty/contains "Awaiting onboarding interview" |
| Want to re-run the interview | Delete or empty `DWG-CONTEXT.md`, then restart your AI client |

---

## Updating

```bash
cd loopkit
git pull
npm install
npm run build
node dist/cli.js seed --upgrade
```

`seed --upgrade` refreshes `.dwg/RULES/*` and `.dwg/SETUP/*` without touching your personal notes, `DWG-CONTEXT.md`, `INDEX.md`, or `ACTIVITY-LOG.md`.

---

## Development

```bash
# Dev mode (runs via tsx, no build needed)
npm run dev -- init
npm run dev -- serve
npm run dev -- doctor

# Tests (coming soon)
npm test

# Type check only
npx tsc --noEmit
```