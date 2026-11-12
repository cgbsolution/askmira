// Predictive search: matching and ranking (src/lib/predictive.ts).
// Run: npm run test:search   (Node's own test runner; Node strips the types.)
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  matchScore,
  rankSuggestions,
  suggestableText,
  valueSuggestions,
} from "../src/lib/predictive.ts";

const labels = (lines) => lines.map((line) => line.label);
const line = (label, keywords) => ({ label, keywords });

test("a label that starts with the term beats a word start, which beats a mid-word match", () => {
  const items = [line("Calibration"), line("A Rahul"), line("Rahul Verma"), line("Ra")];
  assert.deepEqual(labels(rankSuggestions(items, "ra")), ["Ra", "Rahul Verma", "A Rahul", "Calibration"]);
});

test("every typed word must appear, in any order", () => {
  const items = [line("Amit Kumar Jha"), line("Amit Sharma"), line("Kumar Amit")];
  assert.deepEqual(labels(rankSuggestions(items, "kumar amit")).sort(), ["Amit Kumar Jha", "Kumar Amit"]);
  assert.equal(matchScore("amit verma", "Amit Sharma"), null);
});

test("case, extra spaces and leading/trailing spaces do not matter", () => {
  assert.equal(matchScore("  PRIYA  ", "priya"), 0);
  assert.equal(matchScore("priya   k", "Priya Kothapalli"), 1);
  assert.deepEqual(labels(rankSuggestions([line("ANKIT KUMAR")], "ankit kumar")), ["ANKIT KUMAR"]);
});

test("an empty or blank term offers nothing", () => {
  assert.deepEqual(rankSuggestions([line("Payslips")], ""), []);
  assert.deepEqual(rankSuggestions([line("Payslips")], "    "), []);
});

test("symbols and regex characters are plain text, never a pattern", () => {
  const items = [line("C++ Developer"), line("R&D (Pune)"), line("50% basic"), line("a.b"), line("abc")];
  assert.deepEqual(labels(rankSuggestions(items, "c++")), ["C++ Developer"]);
  assert.deepEqual(labels(rankSuggestions(items, "(pune)")), ["R&D (Pune)"]);
  assert.deepEqual(labels(rankSuggestions(items, "50%")), ["50% basic"]);
  assert.deepEqual(labels(rankSuggestions(items, ".")), ["a.b"]);
  for (const typed of ["[", "*", "\\", "(", "?", "$", "^", "|", "-", "e"]) {
    assert.doesNotThrow(() => rankSuggestions(items, typed), typed);
  }
});

test("codes match anywhere, digits and leading zeros included", () => {
  const items = [line("CBL24-609"), line("AB0034"), line("AB0340")];
  assert.deepEqual(labels(rankSuggestions(items, "609")), ["CBL24-609"]);
  assert.deepEqual(labels(rankSuggestions(items, "0034")), ["AB0034"]);
  assert.deepEqual(labels(rankSuggestions(items, "ab0")).sort(), ["AB0034", "AB0340"]);
});

test("a huge pasted term matches nothing and does not hang", () => {
  const items = Array.from({ length: 5000 }, (_, i) => line(`Employee ${i}`));
  const started = Date.now();
  assert.deepEqual(rankSuggestions(items, "x".repeat(10000)), []);
  assert.ok(Date.now() - started < 1000);
});

test("keywords widen what a line answers to, below the label's own matches", () => {
  const items = [line("Payslips", "Payroll salary slip"), line("Payroll runs")];
  assert.deepEqual(labels(rankSuggestions(items, "payroll")), ["Payroll runs", "Payslips"]);
  assert.deepEqual(labels(rankSuggestions(items, "salary")), ["Payslips"]);
});

test("wordStart keeps only lines where every typed word starts a word", () => {
  const items = [line("Ask Miraa"), line("Calibration"), line("Rate cards"), line("Payslips", "payroll")];
  assert.deepEqual(labels(rankSuggestions(items, "ra", 8, { wordStart: true })), ["Rate cards"]);
  assert.deepEqual(labels(rankSuggestions(items, "payr", 8, { wordStart: true })), ["Payslips"]);
});

test("the limit caps the list, ties broken by shorter then alphabetical", () => {
  const items = [line("Amit B"), line("Amit A"), line("Amit"), line("Amitabh")];
  assert.deepEqual(labels(rankSuggestions(items, "amit", 3)), ["Amit", "Amit A", "Amit B"]);
});

test("suggestableText drops what nobody would type", () => {
  assert.equal(suggestableText("—"), null);
  assert.equal(suggestableText("-"), null);
  assert.equal(suggestableText("A"), null);
  assert.equal(suggestableText(""), null);
  assert.equal(suggestableText(42), null);
  assert.equal(suggestableText(null), null);
  assert.equal(suggestableText("x".repeat(81)), null);
  assert.equal(suggestableText("  General   shift "), "General shift");
  assert.equal(suggestableText("HR"), "HR");
});

test("valueSuggestions: one line per distinct value, case aside, with its field", () => {
  const rows = [
    { name: "Priya", code: "AB1", dept: "Sales" },
    { name: "priya", code: "AB2", dept: null },
    { name: "Rahul", code: "AB1", dept: "—" },
  ];
  const lines = valueSuggestions(rows, { Name: (r) => r.name, Code: (r) => r.code, Department: (r) => r.dept });
  assert.deepEqual(
    lines.map((l) => `${l.hint}:${l.label}`),
    ["Name:Priya", "Name:Rahul", "Code:AB1", "Code:AB2", "Department:Sales"],
  );
  assert.equal(new Set(lines.map((l) => l.id)).size, lines.length);
  assert.deepEqual(valueSuggestions(null, { Name: (r) => r.name }), []);
});

test("valueSuggestions stops at its cap on a huge list", () => {
  const rows = Array.from({ length: 20000 }, (_, i) => ({ name: `Person ${i}` }));
  assert.equal(valueSuggestions(rows, { Name: (r) => r.name }, 5000).length, 5000);
});
