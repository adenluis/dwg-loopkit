#!/usr/bin/env node

import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, "..");

const assets = [
  { src: "src/playbook/default.md", dest: "dist/playbook/playbook/default.md" },
];

const seedDir = { src: "seed", dest: "dist/seed" };

function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

let copied = 0;

for (const asset of assets) {
  const srcPath = join(root, asset.src);
  const destPath = join(root, asset.dest);
  if (!existsSync(srcPath)) {
    console.error(`  [SKIP] Source not found: ${asset.src}`);
    continue;
  }
  mkdirSync(dirname(destPath), { recursive: true });
  copyFileSync(srcPath, destPath);
  console.log(`  [OK]   ${asset.src} → ${asset.dest}`);
  copied++;
}

const seedSrc = join(root, seedDir.src);
const seedDest = join(root, seedDir.dest);
if (existsSync(seedSrc)) {
  copyDirRecursive(seedSrc, seedDest);
  console.log(`  [OK]   seed/ → dist/seed/`);
  copied++;
} else {
  console.error(`  [SKIP] Seed directory not found: ${seedDir.src}`);
}

console.log(`\nCopied ${copied} asset${copied === 1 ? "" : "s"} to dist/`);
