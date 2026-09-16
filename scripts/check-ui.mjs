#!/usr/bin/env node
/**
 * Fails when a screen hand-rolls what shadcn/ui already provides.
 *
 *   npm run check:ui
 *
 * Every interactive or structural control — button, input, select, textarea,
 * label, table, dialog, progress, hr — must come from `src/components/ui/`.
 * Inline styles and raw HTML injection are refused everywhere. Plain layout and
 * text wrappers (div, span, p, ul, li, nav, section, form) are fine: shadcn's own
 * components are built from them.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const allowedDir = path.join(root, "components", "ui") + path.sep;

const RULES = [
  {
    pattern: /<(button|input|select|textarea|label|table|thead|tbody|tfoot|tr|td|th|dialog|progress|hr|option)(\s|>|\/|$)/g,
    message: (m) => `raw <${m[1]}> — use the shadcn component from @/components/ui`,
  },
  { pattern: /\bstyle=\{\{/g, message: () => "inline style — use Tailwind classes and tokens" },
  { pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=/g, message: () => "raw HTML injection" },
  { pattern: /#[0-9a-fA-F]{3,8}\b(?=["'`\s;)])/g, message: () => "raw hex colour — use a token class" },
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx|jsx)$/.test(entry.name) ? [full] : [];
  });
}

const problems = [];
for (const file of walk(root)) {
  if (file.startsWith(allowedDir)) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
    for (const rule of RULES) {
      for (const match of line.matchAll(rule.pattern)) {
        problems.push(`${path.relative(path.dirname(root), file)}:${index + 1}  ${rule.message(match)}`);
      }
    }
  });
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} UI rule violation(s).`);
  process.exit(1);
}
console.log("UI check passed: every control comes from @/components/ui.");
