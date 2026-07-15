import { describe, it, expect } from "vitest";
import { isFirstRun, readVaultMetadata } from "../src/playbook/load.js";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_VAULT = join(tmpdir(), "dwg-loop-test-vault");

describe("playbook/load", () => {
  describe("isFirstRun", () => {
    it("returns true when DWG-CONTEXT.md does not exist", () => {
      const path = join(tmpdir(), "nonexistent-vault-" + Date.now());
      expect(isFirstRun(path)).toBe(true);
    });

    it("returns true when DWG-CONTEXT.md contains 'Awaiting onboarding interview'", () => {
      if (existsSync(TEST_VAULT)) rmSync(TEST_VAULT, { recursive: true, force: true });
      mkdirSync(TEST_VAULT, { recursive: true });
      writeFileSync(
        join(TEST_VAULT, "DWG-CONTEXT.md"),
        "# Member Context\n\n*Awaiting onboarding interview.*\n"
      );
      expect(isFirstRun(TEST_VAULT)).toBe(true);
    });

    it("returns false when DWG-CONTEXT.md has real content", () => {
      if (existsSync(TEST_VAULT)) rmSync(TEST_VAULT, { recursive: true, force: true });
      mkdirSync(TEST_VAULT, { recursive: true });
      writeFileSync(
        join(TEST_VAULT, "DWG-CONTEXT.md"),
        "# Member Context\n\n## Profile\n- Experience: Veteran\n"
      );
      expect(isFirstRun(TEST_VAULT)).toBe(false);
    });
  });

  describe("readVaultMetadata", () => {
    it("returns nulls when METADATA.md does not exist", () => {
      const path = join(tmpdir(), "nonexistent-vault-" + Date.now());
      const meta = readVaultMetadata(path);
      expect(meta.lastReview).toBeNull();
      expect(meta.lastReflection).toBeNull();
      expect(meta.seedVersion).toBeNull();
    });

    it("reads dates from METADATA.md", () => {
      if (existsSync(TEST_VAULT)) rmSync(TEST_VAULT, { recursive: true, force: true });
      mkdirSync(join(TEST_VAULT, ".dwg"), { recursive: true });
      writeFileSync(
        join(TEST_VAULT, ".dwg", "METADATA.md"),
        "last_review: 2026-07-01\nlast_reflection: 2026-06-15\nseed_version: 1.0\n"
      );
      const meta = readVaultMetadata(TEST_VAULT);
      expect(meta.lastReview).toBe("2026-07-01");
      expect(meta.lastReflection).toBe("2026-06-15");
      expect(meta.seedVersion).toBe("1.0");
    });
  });

  if (existsSync(TEST_VAULT)) {
    rmSync(TEST_VAULT, { recursive: true, force: true });
  }
});
