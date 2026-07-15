import { describe, it, expect } from "vitest";
import { scanForSecrets, shouldBlockWrite } from "../src/safety/secret-scan.js";

describe("secret-scan", () => {
  describe("scanForSecrets", () => {
    it("detects a 12-word seed phrase", () => {
      const content = "My seed phrase is apple banana cherry date elder fig grape honey iris jasmine kiwi lemon";
      const result = scanForSecrets(content);
      expect(result.found).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it("detects a private key", () => {
      const content = "private key: 0x" + "a".repeat(64);
      const result = scanForSecrets(content);
      expect(result.found).toBe(true);
    });

    it("detects an API key pattern", () => {
      const content = "api key: sk-1234567890abcdefghijklmnopqrstuvwxyz";
      const result = scanForSecrets(content);
      expect(result.found).toBe(true);
    });

    it("does NOT flag normal crypto content", () => {
      const content = "Member holds 100 VVV on Ethereum. Wallet: 0xD20a9202d2A69CB0E6d240E6DdA7257D4baE39eC";
      const result = scanForSecrets(content);
      expect(result.found).toBe(false);
    });

    it("does NOT flag a wallet address as a private key", () => {
      const content = "Wallet address: 0xD20a9202d2A69CB0E6d240E6DdA7257D4baE39eC";
      const result = scanForSecrets(content);
      expect(result.found).toBe(false);
    });

    it("does NOT flag normal text with the word 'password'", () => {
      const content = "The member should never share their password with anyone.";
      const result = scanForSecrets(content);
      expect(result.found).toBe(false);
    });
  });

  describe("shouldBlockWrite", () => {
    it("blocks a seed phrase", () => {
      const result = shouldBlockWrite("seed phrase: apple banana cherry date elder fig grape honey iris jasmine kiwi lemon");
      expect(result.block).toBe(true);
      expect(result.reason).toBeDefined();
    });

    it("allows normal content", () => {
      const result = shouldBlockWrite("# Vouch Protocol\n\nLiquid staking on PulseChain.");
      expect(result.block).toBe(false);
      expect(result.reason).toBeUndefined();
    });
  });
});
