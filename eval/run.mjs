// Eval runner. Scores the current release in rules.js against the golden set and fails the build on any missed gate.
// Usage: node eval/run.mjs [release]     (release defaults to rules.CURRENT_RELEASE)
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const rules = require("../rules.js");
const golden = require("./golden.js");

const release = Number(process.argv[2] || rules.CURRENT_RELEASE);

// 1. Score the corpus as data before scoring the engine (S-048 pattern): labels must be well formed.
const corpusErrors = [];
const ids = new Set(Object.values(rules.GRAPH.nodes).map(n => n.id).filter(Boolean));
golden.forEach((x, i) => {
  if (!["answer", "human", "escalate"].includes(x.v)) corpusErrors.push(`row ${i}: verdict "${x.v}" is not in the enum`);
  if (x.v === "answer" && !x.c) corpusErrors.push(`row ${i}: an answer needs an expected clause`);
  if (x.v !== "answer" && x.c) corpusErrors.push(`row ${i}: a non-answer carries a clause`);
  if (x.c && !ids.has(x.c)) corpusErrors.push(`row ${i}: clause ${x.c} is not a node`);
  if (x.v === "escalate" && x.g) corpusErrors.push(`row ${i}: an escalation is not also a grievance flag here`);
});
if (corpusErrors.length) { console.error("Golden set is inconsistent:\n  " + corpusErrors.join("\n  ")); process.exit(2); }
console.log(`Golden set: ${golden.length} rows, consistent.`);

// 2. Score the engine.
const r = rules.score(golden, release);
const f = x => typeof x === "number" && (!Number.isInteger(x) || x === 0 || x === 1) ? x.toFixed(2) : String(x);
console.log(`\nRelease ${release}`);
for (const g of r.gates) console.log(`  ${g.pass ? "pass " : "FAIL "} ${g.name.padEnd(46)} ${f(g.value).padStart(5)}  must be ${g.must}`);
console.log(`  task success ${f(r.metrics.task_success)} over ${r.metrics.rows} rows; ${r.metrics.drafted} drafts checked for figures`);
if (r.missed.length) console.log(`  missed escalations:\n    - ` + r.missed.join("\n    - "));
if (r.badFigures.length) console.log(`  figures not on path:\n    - ` + r.badFigures.join("\n    - "));

// 3. Write the report the scorecard page can show.
const here = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(here, "out"), { recursive: true });
const report = { generated: new Date().toISOString(), ...r };
writeFileSync(path.join(here, "out", `report-release-${release}.json`), JSON.stringify(report, null, 2));
console.log(`\nReport: eval/out/report-release-${release}.json`);

if (r.failed) { console.error(`\n${r.failed} gate${r.failed > 1 ? "s" : ""} failed. Release ${release} is blocked.`); process.exit(1); }
console.log(`\nRelease ${release} passes every gate.`);
