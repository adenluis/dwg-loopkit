---
name: onboarding-interview
purpose: First-session interview to build the member's knowledge system
triggers: ["start setup", "begin setup", "setup interview", first-run]
reference_for: DWG INTEL Prompt 1 (Install My Personal Crypto Knowledge System)
installed_version: 1.0
---

# Onboarding Interview

> Adapted from DWG INTEL Prompt 1. Follow this during the first session when DWG-CONTEXT.md is empty.

---

## Purpose

Build this member's personal crypto knowledge system. The knowledge base exists primarily for you (the AI), not the member. Its purpose is to help you retrieve the right context, remember what matters, and improve every future conversation.

The member should never feel like they are managing a vault. They should simply feel like: "My AI gets smarter every time I use it."

---

## Before You Begin

Confirm that you can reliably create and maintain files on the member's local computer (you have vault tools). If you cannot access persistent local files, explain why, stop the installation, and recommend using an AI environment with local file access.

If a previous installation exists (DWG-CONTEXT.md has content), inspect it. Determine whether to resume, repair, or refresh it. Never overwrite existing work without showing the member what will change.

If no installation exists, proceed with the interview.

---

## Phase 1 — Learn The Member

Interview the member naturally. **Ask exactly ONE question at a time.** Wait for the answer before asking the next. Never batch multiple questions into a single message. If a member's answer covers the next question, skip it and move on.

### Onboarding guardrails (non-negotiable)

- **NO web searches, no webfetch, no browser tools.** The onboarding interview is a conversation between you and the member only.
- **NO wallet discovery, no on-chain lookups, no DWG tool calls.** Do not look up addresses on etherscan, bscscan, or any explorer. Do not call DWG research tools. Wallet discovery happens AFTER onboarding, in a separate session.
- **NO file reads outside the vault.** Do not read the member's filesystem.
- **Stay on track.** If the member mentions something interesting (a wallet, a protocol, a token), note it and move on. Do not rabbit-hole into research mid-interview. Say: "Noted — we can dig into that after setup."
- **Keep it under 10 minutes.** Be efficient. Harvest from long answers. Skip questions the member already answered.
- **One question at a time.** This is the most common failure mode. Never ask 2+ questions in one message.

Learn (in roughly this order, but adapt to the conversation):
1. Crypto experience level
2. Goals (what are they trying to achieve?)
3. Chains they're active on
4. Wallets they want tracked (just collect the address/label — do NOT look it up)
5. Protocols they use
6. Watchlist (tokens/projects they're watching)
7. Preferred communication style
8. Storage consent (see Required Privacy Questions below)

Avoid collecting unnecessary information. Harvest information from long answers instead of asking repetitive questions. Stop once you genuinely understand the member.

---

## Required Privacy Questions

Always ask:

**1.** Should I remember:
- what you own?
- or what you own **and** how much?

Default to remembering what, not how much.

**2.** For each wallet:
- Should I remember the full address?
- or only a nickname?

Recommend full addresses because they improve future research, but respect the member's decision.

---

## Phase 2 — Confirm Understanding

Before building anything:

1. Summarise everything you learned.
2. Clearly separate: facts, member opinions, preferences, unanswered questions.
3. Ask the member to review it.
4. Make any requested corrections.
5. Only continue after explicit approval.

Never build from assumptions.

---

## Phase 3 — Build The Knowledge System

Create a clean, AI-first knowledge system. Keep the structure simple. Create whatever files and folders are genuinely required for long-term knowledge retrieval.

### Fixed contract files (never rename these)

Create these at the vault root:

- **`DWG-CONTEXT.md`** — the persistent member context (who they are, wallets, goals, preferences, consents)
- **`INDEX.md`** — the knowledge index and navigation map
- **`ACTIVITY-LOG.md`** — the append-only activity history
- **`Daily Notes/`** — a home for dated quick captures (may already exist from seed)
- **`Archive/`** — historical material, kept out of the active path (may already exist from seed)

### Additional structure

Create knowledge areas as you judge best — organised by the member's projects, ecosystems, or themes. Also create:
- A welcome guide (this vault's README)
- Knowledge index entries
- Initial entity notes for wallets, projects, and watchlists the member mentioned
- Reusable templates (see `.dwg/SETUP/schemas/`)

Do not create unnecessary complexity. The structure should be understandable by both humans and future AI systems.

Populate using only information approved by the member. Do not invent information. Do not use external knowledge.

---

## DWG-CONTEXT.md structure

The context file should contain:

```markdown
---
last_updated: YYYY-MM-DD
---

# Member Context

## Profile
- Experience level:
- Goals:
- Investing style:
- Communication style:

## Wallets
| Label | Chain | Address |
|---|---|---|
| (nickname) | (chain) | (address or "nickname only") |

## Watchlist
- (project/token — why watching)

## Privacy Consents
- Holdings detail: (what / what+how much)
- Wallet addresses: (full / nickname only)

## Storage Consents
- What may be stored: (defaults: decisions, research, lessons, preferences)
- What must not be stored: (member's specific exclusions)

## Member Overrides
- (member-specific rules added later)
```

---

## INDEX.md structure

A living map of the vault. Each entry: note title, path, one-line purpose. Keep it simple. The AI uses it as a hint, not truth — if it disagrees with files, files win.

---

## Verification

Before finishing:

Confirm that:
- Every required file exists (the five contract names)
- Every link works
- No prohibited information was stored
- Nothing outside the knowledge system was modified
- The installation record accurately reflects completion

Read the files back. Do not rely on memory. If anything failed, explain exactly what failed. Do not pretend success.

---

## Completion

Once verification passes, explain to the member:
- What was created
- How it will help future conversations
- How the knowledge system improves over time

Tell them they never need to manage the system manually. Whenever future conversations produce valuable knowledge, they can simply say: "Save what's useful."

The installation is now complete. Future sessions follow the operating rules automatically.