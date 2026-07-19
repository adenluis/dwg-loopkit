# Changelog

All notable changes to DWG Loop Kit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-07-19

### Added
- Generated MCP configs now use absolute paths to the Node binary and the installed `cli.js` — GUI clients (Claude Desktop, Cursor) no longer fail when `npx` isn't on their PATH; faster, offline-safe starts
- Configs are pinned to the exact installed version; fallback form is `npx -y @dwgintel/loop@<version>` (never unpinned)
- `dwg-loop update`: downloads the latest version, re-points the AI client config, and refreshes vault rules in one command (global installs update via `npm i -g` and hand off to the new binary)
- `dwg-loop init --repoint`: re-point the recorded AI client at the current install + `seed --upgrade` (also repairs configs after an npm cache clear)
- Update notifications in-session: `dwg_loop_session_start` checks the npm registry (cached 24h, offline-tolerant) and has the AI mention an available update once, in plain language, with the exact update command
- Install metadata recorded in `~/.dwg-loop/config.json` (client, scope, server path, timestamp) to drive update/repoint
- Token UX: hidden (masked) input, `dwg_` prefix sanity check, and live validation against DWG during init with retry — a bad token is caught before the AI client ever starts
- Client auto-detection: installed clients are marked in the init menu and pre-selected as the default
- Vault path prompt offers a default (`~/dwg-vault`); scope question reworded to plain English ("all your projects / just this folder")
- Node.js >= 20 preflight with OS-specific guidance instead of a deep crash
- End-of-init summary: exact next steps (restart client → "DWG help") plus the correct doctor command for the install mode
- Doctor: shows installed/latest versions with update hint, checks the recorded server file still exists (with repair instructions), shares init's token-validation code
- Interactive init now tolerates pasted/piped multi-line input (buffered questioner; previously extra lines were dropped between prompts)

### Fixed
- Re-running `init` no longer overwrites existing vault contract files (DWG-CONTEXT.md, INDEX.md, ACTIVITY-LOG.md) — seed now skips existing files; `--force` remains available explicitly
- `detectLocalCliPath()` used bare `__dirname` in ESM (latent ReferenceError); replaced by the new server-command resolver
- False "comments were removed during merge" warning when the existing client config had no comments
- Shell quoting for `claude mcp add` / `codex mcp add` commands (paths with spaces, e.g. `C:\Program Files\nodejs`)
- Codex print-config now emits TOML literal strings so Windows paths survive a paste
- README: `doctor` invocation works for npx installs (`npx -y @dwgintel/loop doctor`); added token sourcing, per-client config locations, and a troubleshooting table
- `dwg-loop version` now works as a subcommand (previously only `--version`; the README has promised the subcommand since 0.1.0)

## [0.2.0] - 2026-07-16

### Added
- Auto-write MCP config into AI client config files during `init`
- Interactive client menu: opencode, Claude Desktop, Claude Code CLI, Cursor, Codex CLI, Other
- `--scope <global|project>` flag for global vs project-scoped config (where supported)
- Claude Code CLI integration: shells out to `claude mcp add` for auto-write
- Codex CLI integration: shells out to `codex mcp add` for auto-write
- JSONC comment-aware config parsing for opencode (comments stripped on merge with warning)
- Generic config block + guidance for unsupported clients (Other)
- `emit-config` command supports all 6 clients with `--scope` flag
- Per-client config formats: JSON (Claude Desktop, Claude Code, Cursor), JSON/JSONC (opencode), TOML (Codex)
- Config file path detection per client per platform (Windows, macOS, Linux)

### Fixed
- Seed directory not found when installed via npx (seed/ now ships in package, applySeed checks dist/seed/ fallback)

## [0.1.1] - 2026-07-16

### Fixed
- Seed directory not found when installed via npx (seed/ now ships in package, applySeed checks dist/seed/ fallback)

## [0.1.0] - 2026-07-15

### Added
- Local MCP server connecting AI to DWG INTEL research tools and private vault
- Single `@dwgintel/loop` package with vault tools (mcpvault) + DWG proxy
- Playbook system: always-injected operating core + on-demand rule modules
- Session-start, status, help, and vault_get_context tools for discoverability
- Onboarding interview with one-question-at-a-time + no-web-search guardrails
- Tagging and wikilink conventions for vault note organization
- CLI: init (with --vault, --token, --client, --yes flags), serve, doctor, seed (--force/--upgrade), config, emit-config
- Build script auto-copies non-TS assets (playbook + seed) to dist
- Secret scanner blocks seed phrases, private keys, passwords, API keys from vault writes
- DWG proxy with SSE response parsing and live connection state reporting
- 18 smoke tests (secret scanner, config loader, playbook load)
- GitHub Actions CI (build + test on PR) and publish workflow (npm publish on tag)
- MIT license

### Tools
- 4 loop tools: dwg_loop_session_start, dwg_loop_status, dwg_loop_help, vault_get_context
- 8 vault tools: read_note, write_note, patch_note, search_notes, list_directory, update_frontmatter, manage_tags, get_vault_stats
- 21 DWG research tools (proxied from DWG MCP server)
