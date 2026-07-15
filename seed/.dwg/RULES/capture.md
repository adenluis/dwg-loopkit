---
name: capture-rules
purpose: What to save, when to save it, and how to save it
triggers: [save, remember, capture, "new knowledge", "add this", "keep this"]
reference_for: DWG INTEL Prompt 3 (Quiet Capture)
installed_version: 1.0
---

# Capture Rules

> Condensed from DWG INTEL Prompt 3. Read this when the member asks to save something, or when durable knowledge arises naturally in conversation.

---

## When to capture

**Capture immediately when the member explicitly asks:**
- "remember this"
- "save this"
- "add this to my research"
- "keep this"

No further permission required.

**Otherwise, quietly decide.** A capture should satisfy both questions:

1. **Will this still matter in a month?**
2. **Will remembering this improve future conversations?**

If either answer is no, don't save it.

**Most conversations should produce little or no new knowledge.** Quality over quantity. That is healthy.

---

## What to capture

**Durable knowledge:**
- Investment decisions and the reasoning at the moment of deciding
- Lessons learned (from outcomes, good and bad)
- Changes in beliefs
- Long-term watchlists
- Recurring research
- Important unanswered questions
- Durable preferences
- Wallet information
- Project theses
- Tax records
- Significant personal context relevant to crypto

**Do not capture:**
- Casual conversation
- Temporary market discussion
- Hype
- Your own reasoning/analysis
- Buy/sell suggestions
- Everyday questions
- Anything the member asked not to remember

**When unsure:** don't save. If the same idea returns later in the conversation, that's stronger evidence it matters.

---

## What a capture contains

Every capture should be:
- **Short** — distil, don't transcribe
- **Factual** — distinguish sourced facts, member views, speculation, open questions
- **Dated** — every fact carries its date
- **Traceable** — `source:` field on every fact (`dwg`, `member`, `web`, `unverified`)
- **In the member's own words** — their reasoning, not your paraphrase

Never save large blocks of conversation. Never save your own analysis.

---

## Where knowledge belongs

1. **Search for an existing home first** — check INDEX.md, one folder listing, one candidate note read.
2. **Prefer updating an existing note** over creating a new one.
3. **Create new** only when knowledge genuinely has no existing home.
4. A new note and its INDEX.md line are **one action** — never create a note the index can't find.

### File placement

| Type | Location | Example |
|---|---|---|
| Protocol profiles | `Protocols/` | `Protocols/Vouch.md` |
| Wallet profiles | `Wallets/` | `Wallets/deployer.md` |
| Watchlist entries | `Watchlist/` | `Watchlist/VOUCH.md` |
| Research deep-dives | `Protocols/` (if about a protocol) or `Research/` (if cross-cutting) | `Protocols/Vouch-Research.md` |
| Strategy/thesis notes | `Strategy/` | `Strategy/L2-thesis.md` |
| Decisions | `Decisions/` | `Decisions/2026-07-15-sold-SOL.md` |
| Quick captures | `Daily Notes/` | `Daily Notes/2026-07-15.md` |

**Never drop files at the vault root** unless they are contract files (DWG-CONTEXT.md, INDEX.md, ACTIVITY-LOG.md, README.md). Research notes go inside a folder.

### Naming convention

- Entity notes: `Protocols/Vouch.md`, `Watchlist/VOUCH.md`, `Wallets/deployer.md`
- Research notes: append `-Research` to the entity name → `Protocols/Vouch-Research.md` (not `Vouch Protocol Research.md` at root)
- Decision notes: `Decisions/YYYY-MM-DD-action.md`

---

## Connecting knowledge

- Connect decisions to the reasoning behind them
- Connect lessons to the decisions that created them
- Connect research to the projects it supports
- Connect questions to their eventual answers
- Connect evidence to the conclusions it influenced

Future conversations should understand not only **what** happened, but **why**.

### Wikilinks (mandatory)

Every note must link to related notes using `[[filename]]` wikilinks (without folder path or `.md` extension). These are the connective tissue of the vault.

**Rules:**
- When you create or update a note, check if related entity notes exist. If they do, add `[[NoteName]]` links.
- Links go in a `## Connections` section at the bottom of the note (or inline where natural).
- Link bidirectionally — if `Protocols/Vouch-Research.md` links to `[[Vouch]]`, then `Protocols/Vouch.md` should also link to `[[Vouch-Research]]`.
- Link to the wallet that holds the asset: `[[deployer]]`.
- Link to watchlist entries: `[[VOUCH]]`.

**Example — Vouch research note:**
```markdown
## Connections
- [[Vouch]] — protocol profile
- [[VOUCH]] — watchlist entry
- [[deployer]] — wallet holding Vouch ecosystem assets
```

**Example — Protocol profile updated after research:**
```markdown
## Connections
- [[Vouch-Research]] — deep dive from 2026-07-15
- [[VOUCH]] — governance token watchlist entry
- [[deployer]] — member's wallet with Vouch holdings
```

### Tagging conventions

Tags make notes findable by search. Use consistent tags across related notes.

**Required tags by type:**
| Note type | Required tag |
|---|---|
| Protocol profile | `protocol` |
| Wallet profile | `wallet` |
| Watchlist entry | `watchlist` |
| Research note | `research` |
| Strategy/thesis | `strategy` |
| Decision | `decision` |
| Daily capture | `daily` |

**Entity tags (shared across all notes about the same subject):**
When multiple notes relate to the same entity, they ALL share an entity tag so a single tag search finds everything.

**Example — all Vouch-related notes carry `vouch`:**
- `Protocols/Vouch.md` → tags: `["protocol", "vouch"]`
- `Watchlist/VOUCH.md` → tags: `["watchlist", "token", "vouch"]`
- `Protocols/Vouch-Research.md` → tags: `["research", "vouch", "pulsechain"]`

**Chain tags** (when relevant): `ethereum`, `arbitrum`, `base`, `pulsechain`, `bsc`, `optimism`, `polygon`

**Theme tags** (optional, when useful): `defi`, `liquid-staking`, `governance`, `lending`, `lp`, `staking`

**Rules:**
- Every note gets its type tag + entity tag(s) at minimum.
- Tags are lowercase, hyphenated.
- Never use more than 6 tags per note.
- When creating a note about an entity that already has notes, copy that entity's existing tag.

---

## Contradictions

Never silently overwrite existing knowledge. When new information conflicts:

1. Record the conflict
2. Preserve both old and new
3. Identify what changed and when
4. If the member changes their own view, preserve the previous position as historical context

History is often more valuable than the final conclusion.

---

## Confirmation style

Keep confirmations almost invisible:
- "Added that to your Pendle research."
- "I've recorded that lesson."

Do not mention folders, note names, file paths, markdown, metadata, or organisation.

---

## If the member says "don't save that"

Undo the capture completely. The veto is immediate and absolute for Tier 2 items (created this session). Confirm briefly.

For older knowledge, treat it as an intentional change — preserve history where appropriate.

---

## What belongs to other modules

- **Maintenance** (reorganise, merge, archive, clean duplicates, review stale) → leave a `#dwg/flag YYYY-MM-DD reason` marker and defer to review
- **Long-term patterns** (recurring mistakes, behavioural analysis, principles) → defer to reflection

Do not do these during ordinary conversations.

---

## Provenance is law

Every fact written carries `source:` — `dwg` (tool + timestamp), `member` (their words), `web` (URL), or `unverified`. Never cite a vault note as authority for a claim whose own source is missing or unverified.

**DWG results are snapshots.** Saved to the vault, they stay snapshots — "supply was 48M per DWG on 13 Jul 2026" — never a timeless truth.

**The scam guard.** Never write "verified", "safe", "legitimate" or "official" about any URL, contract, or address unless that status came from a DWG result. Anything from the web or member pasted is `status: unchecked`.