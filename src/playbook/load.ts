import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function loadPlaybook(): string {
  const bundledPath = join(__dirname, "playbook", "default.md");

  if (!existsSync(bundledPath)) {
    throw new Error(`Bundled playbook not found: ${bundledPath}`);
  }

  return readFileSync(bundledPath, "utf-8");
}

export function isFirstRun(vaultPath: string): boolean {
  const contextPath = resolve(vaultPath, "DWG-CONTEXT.md");
  if (!existsSync(contextPath)) return true;
  const content = readFileSync(contextPath, "utf-8").trim();
  return content.length === 0 || content.includes("Awaiting onboarding interview");
}

export interface VaultMetadata {
  lastReview: string | null;
  lastReflection: string | null;
  seedVersion: string | null;
}

export function readVaultMetadata(vaultPath: string): VaultMetadata {
  const metaPath = resolve(vaultPath, ".dwg", "METADATA.md");

  if (!existsSync(metaPath)) {
    return { lastReview: null, lastReflection: null, seedVersion: null };
  }

  const content = readFileSync(metaPath, "utf-8");
  const lastReviewMatch = content.match(/last_review:\s*(?:#?\s*)([0-9-]*)/);
  const lastReflectionMatch = content.match(/last_reflection:\s*(?:#?\s*)([0-9-]*)/);
  const seedVersionMatch = content.match(/seed_version:\s*([0-9.]+)/);

  return {
    lastReview: lastReviewMatch?.[1] || null,
    lastReflection: lastReflectionMatch?.[1] || null,
    seedVersion: seedVersionMatch?.[1] || null,
  };
}

export function buildInstructions(vaultPath: string, playbook: string): string {
  const firstRun = isFirstRun(vaultPath);
  const metadata = readVaultMetadata(vaultPath);

  let instructions = playbook;

  if (firstRun) {
    instructions += "\n\n---\n\n## SESSION STATE: FIRST-RUN\n\n" +
      "DWG-CONTEXT.md is empty or missing. You are in first-run mode. " +
      "Greet the member warmly, explain you need to learn about their crypto world " +
      "(about 10 minutes), and ask if they're ready to begin. " +
      "If yes, read `.dwg/SETUP/onboarding-interview.md` and follow it. " +
      "If not now, offer: \"Whenever you're ready, just say 'start setup'.\"";
  } else {
    if (metadata.lastReview) {
      const days = daysSince(metadata.lastReview);
      if (days !== null && days >= 7) {
        instructions += `\n\n---\n\n## SESSION STATE: REVIEW DUE\n\nLast knowledge review was ${days} days ago. At a natural pause, mention: "It's been ${days} days since your last knowledge review — say 'run my knowledge review' when you're ready."`;
      }
    }

    if (metadata.lastReflection) {
      const days = daysSince(metadata.lastReflection);
      if (days !== null && days >= 30) {
        instructions += `\n\n## SESSION STATE: REFLECTION DUE\n\nLast long-term reflection was ${days} days ago. If the member seems reflective or asks about their record, suggest: "It's been ${days} days since your last reflection — say 'take stock' when you're ready."`;
      }
    }
  }

  return instructions;
}

function daysSince(dateStr: string): number | null {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}