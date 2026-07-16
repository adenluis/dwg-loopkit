# Changelog

All notable changes to DWG Loop Kit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-15

### Added
- Local MCP server connecting AI to DWG INTEL research tools and private vault
- Single `@dwg/loop` package with vault tools (mcpvault) + DWG proxy
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
