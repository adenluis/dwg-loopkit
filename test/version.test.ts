import { describe, it, expect } from "vitest";
import {
  PACKAGE_NAME,
  getPackageVersion,
  getPinnedSpec,
  isNewerVersion,
  getUserCommandPrefix,
} from "../src/version.js";

describe("version helpers", () => {
  it("compares versions numerically", () => {
    expect(isNewerVersion("0.3.0", "0.2.2")).toBe(true);
    expect(isNewerVersion("0.2.2", "0.2.2")).toBe(false);
    expect(isNewerVersion("0.2.1", "0.2.2")).toBe(false);
    expect(isNewerVersion("1.0.0", "0.9.9")).toBe(true);
    expect(isNewerVersion("0.2.10", "0.2.9")).toBe(true);
    expect(isNewerVersion("0.10.0", "0.9.9")).toBe(true);
    expect(isNewerVersion("2.0.0", "10.0.0")).toBe(false);
  });

  it("builds a pinned npm spec", () => {
    expect(getPinnedSpec("1.2.3")).toBe(`${PACKAGE_NAME}@1.2.3`);
  });

  it("reads the package version", () => {
    expect(getPackageVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("picks the right command prefix per install mode", () => {
    expect(
      getUserCommandPrefix(
        "C:\\Users\\x\\AppData\\Local\\npm-cache\\_npx\\abc123\\node_modules\\@dwgintel\\loop\\dist\\cli.js"
      )
    ).toBe(`npx -y ${PACKAGE_NAME}`);
    expect(getUserCommandPrefix("/home/x/.npm/_npx/abc/node_modules/@dwgintel/loop/dist/cli.js")).toBe(
      `npx -y ${PACKAGE_NAME}`
    );
    expect(getUserCommandPrefix("/usr/local/lib/node_modules/@dwgintel/loop/dist/cli.js")).toBe("dwg-loop");
  });
});
