import { readFileSync } from "fs";
import { resolve } from "path";

const SECRET_PATTERNS = [
  /(?:seed|mnemonic|recovery)\s*(?:phrase)?\s*[:is]?\s*([a-z]\s*){12,}/i,
  /(?:private\s*key|privkey)\s*[:is]?\s*0x[a-fA-F0-9]{64}/i,
  /(?:password|passwd|pass)\s*[:is]?\s*\S{8,}/i,
  /(?:api\s*key|apikey)\s*[:is]?\s*\S{20,}/i,
];

const SECRET_KEYWORDS = [
  "seed phrase",
  "private key",
  "mnemonic",
  "recovery phrase",
  "api key",
  "password",
];

export function scanForSecrets(content: string): { found: boolean; reasons: string[] } {
  const reasons: string[] = [];

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      reasons.push("Content matches a secret pattern (seed phrase, private key, password, or API key)");
      break;
    }
  }

  const lower = content.toLowerCase();
  for (const keyword of SECRET_KEYWORDS) {
    if (lower.includes(keyword)) {
      if (/\b\d+\b/.test(content) || /0x[a-fA-F0-9]{20,}/.test(content)) {
        reasons.push(`Content contains "${keyword}" alongside numeric/hex data — possible secret`);
        break;
      }
    }
  }

  return { found: reasons.length > 0, reasons };
}

export function shouldBlockWrite(content: string): { block: boolean; reason?: string } {
  const scan = scanForSecrets(content);
  if (scan.found) {
    return { block: true, reason: scan.reasons[0] };
  }
  return { block: false };
}