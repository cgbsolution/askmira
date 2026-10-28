#!/usr/bin/env node
/**
 * Fails when a screen hand-rolls what shadcn/ui already provides.
 *
 *   npm run check:ui
 *
 * Every interactive or structural control — button, input, select, textarea,
 * label, table, dialog, progress, hr, fieldset, details — must come from
 * `src/components/ui/`. The browser's own pickers count as raw HTML too, even
 * through the shadcn Input: `<Input type="date">` draws a native calendar, so
 * date/time/month/colour/file fields must use the shadcn pickers.
 * Inline styles and raw HTML injection are refused everywhere. Plain layout and
 * text wrappers (div, span, p, ul, li, nav, section, form) are fine: shadcn's own
 * components are built from them.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const allowedDir = path.join(root, "components", "ui") + path.sep;

const PICKERS = {
  date: "DatePicker from @/components/common/DatePicker",
  time: "TimePicker from @/components/ui/time-picker",
  "datetime-local": "DateTimePicker from @/components/common/DateTimePicker",
  month: "MonthPicker from @/components/common/MonthPicker",
  week: "DatePicker from @/components/common/DatePicker",
  color: "ColorPicker from @/components/ui/color-picker",
  file: "FileInput / HiddenFileInput from @/components/ui/file-input",
  range: "a shadcn Slider in @/components/ui (add one in shadcn's style)",
};

const RULES = [
  {
    pattern: /<(button|input|select|textarea|label|table|thead|tbody|tfoot|tr|td|th|dialog|progress|hr|option)(\s|>|\/|$)/g,
    message: (m) => `raw <${m[1]}> — use the shadcn component from @/components/ui`,
  },
  {
    pattern: /<(fieldset|legend)(\s|>|$)/g,
    message: (m) => `raw <${m[1]}> — use FieldSet / FieldLegend from @/components/ui/field`,
  },
  {
    pattern: /<(details|summary)(\s|>|$)/g,
    message: (m) => `raw <${m[1]}> — use Collapsible from @/components/ui/collapsible`,
  },
  {
    // The shadcn Input still draws the browser's own picker for these types.
    pattern: /\btype=["'{`]+(date|time|datetime-local|month|week|color|file|range)\b/g,
    message: (m) => `native ${m[1]} picker — use ${PICKERS[m[1]]}`,
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

/*
 * Every table is a DataTable (search, columns, export, checkboxes, paging, one
 * look). The shadcn <Table> is for DataTable itself; anywhere else it needs a
 * `table-ok: <reason>` comment on the line above — a rowSpan grid, a calendar,
 * a printable page — so each exception is deliberate and visible.
 */
const dataTableDir = path.join(root, "components", "common", "data-table") + path.sep;
const TABLE = /<Table(\s|>|$)/;

const problems = [];
for (const file of walk(root)) {
  if (file.startsWith(allowedDir)) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
    const where = `${path.relative(path.dirname(root), file).split(path.sep).join("/")}:${index + 1}`;
    for (const rule of RULES) {
      for (const match of line.matchAll(rule.pattern)) {
        problems.push(`${where}  ${rule.message(match)}`);
      }
    }
    if (TABLE.test(line) && !file.startsWith(dataTableDir) && !/table-ok:/.test(lines[index - 1] ?? "")) {
      problems.push(`${where}  hand-built <Table> — use DataTable from @/components/common/data-table/DataTable`);
    }
  });
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} UI rule violation(s).`);
  process.exit(1);
}
console.log("UI check passed: every control comes from @/components/ui.");
