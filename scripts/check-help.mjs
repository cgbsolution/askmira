#!/usr/bin/env node
/**
 * Fails when a portal page has no help guide, or a guide names no page.
 *
 *   npm run check:help
 *
 * Every page under src/app/(admin) is opened from the Help button in the top
 * bar; its guide lives in src/lib/help/guides/, keyed by the page's route
 * ("/payroll/runs/[id]" for a dynamic one). A new page without a guide, or a
 * guide left behind by a removed page, is caught here.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const appDir = path.join(root, "app", "(admin)");
const guideDir = path.join(root, "lib", "help", "guides");

function pages(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...pages(full));
    else if (entry.name === "page.tsx") {
      const rel = path.relative(appDir, path.dirname(full)).split(path.sep).join("/");
      out.push(rel ? `/${rel}` : "/");
    }
  }
  return out;
}

const keys = new Set();
const problems = [];
for (const file of fs.readdirSync(guideDir)) {
  const text = fs.readFileSync(path.join(guideDir, file), "utf8");
  for (const match of text.matchAll(/^ {2}"(\/[^"]*)": \{/gm)) {
    if (keys.has(match[1])) problems.push(`duplicate guide for ${match[1]} (in ${file})`);
    keys.add(match[1]);
  }
}
const routes = pages(appDir);
for (const route of routes) if (!keys.has(route)) problems.push(`no help guide for ${route}`);
for (const key of keys) if (!routes.includes(key)) problems.push(`guide for ${key}, which is not a page`);

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} problem(s). Add or fix the guide in src/lib/help/guides/.`);
  process.exit(1);
}
console.log(`Help check passed: all ${routes.length} pages have a guide.`);
