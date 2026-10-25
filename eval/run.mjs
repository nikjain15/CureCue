// Eval runner. Checks the golden set as data, scores a release against it with per-slice metrics, validates the judge,
// writes the report, and fails the build on any missed gate.
// Usage: node eval/run.mjs [release]     (release defaults to rules.CURRENT_RELEASE)
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const rules = require("../rules.js");
const golden = require("./golden.js");
const judge = require("./judge.js");
const release = Number(process.argv[2] || rules.CURRENT_RELEASE);

// 1. Score the corpus as data before scoring the engine. Labels and strata must be well formed.
const corpusErrors = [];
const ids = new Set(Object.values(rules.GRAPH.nodes).map(n => n.id).filter(Boolean));
const ENUM = { v: ["answer", "human", "escalate"], register: ["plain", "implicit", "angry"], lang: ["en", "es", "interp"], plan: ["HMO", "PPO", "D-SNP"], source: ["hand", "adversarial"], labeller: ["A", "B"] };
const seen = new Set();
golden.forEach((x, i) => {
  if (seen.has(x.id)) corpusErrors.push(`${x.id}: duplicate id`); seen.add(x.id);
  if (seen.has("t:" + x.t)) corpusErrors.push(`${x.id}: duplicate text`); seen.add("t:" + x.t);
  for (const [k, vals] of Object.entries(ENUM)) if (!vals.includes(x[k])) corpusErrors.push(`${x.id}: ${k} "${x[k]}" not in ${vals.join("/")}`);
  if (x.v === "answer" && !x.c) corpusErrors.push(`${x.id}: an answer needs an expected clause`);
  if (x.v !== "answer" && x.c) corpusErrors.push(`${x.id}: a non-answer carries a clause`);
  if (x.c && !ids.has(x.c)) corpusErrors.push(`${x.id}: clause ${x.c} is not a node`);
  if (x.v === "escalate" && x.g) corpusErrors.push(`${x.id}: an escalation is not also a grievance flag here`);
  if (x.labels) { for (const L of ["A", "B"]) if (!x.labels[L] || !ENUM.v.includes(x.labels[L].v)) corpusErrors.push(`${x.id}: adjudicated row missing labeller ${L}`); }
});
if (corpusErrors.length) { console.error("Golden set is inconsistent:\n  " + corpusErrors.join("\n  ")); process.exit(2); }
const by = k => golden.reduce((a, r) => { a[r[k]] = (a[r[k]] || 0) + 1; return a; }, {});
console.log(`Golden set ${golden.meta ? golden.meta.version : ""}: ${golden.length} rows, consistent. verdict ${JSON.stringify(by("v"))} lang ${JSON.stringify(by("lang"))} register ${JSON.stringify(by("register"))} source ${JSON.stringify(by("source"))}`);
const adj = golden.filter(r => r.labels);
if (adj.length) { const agree = adj.filter(r => r.labels.A.v === r.labels.B.v && !!r.labels.A.g === !!r.labels.B.g).length; console.log(`Adjudicated subset: ${adj.length} rows, labeller agreement ${(agree / adj.length).toFixed(2)} before adjudication.`); }

// 2. Score the engine.
const r = rules.score(golden, release);
const f = x => typeof x === "number" && (!Number.isInteger(x) || x === 0 || x === 1) ? x.toFixed(2) : String(x);
console.log(`\nRelease ${release}`);
for (const g of r.gates) console.log(`  ${g.pass ? "pass " : "FAIL "} ${g.name.padEnd(46)} ${f(g.value).padStart(5)}  must be ${g.must}`);
console.log(`  task success ${f(r.metrics.task_success)} over ${r.metrics.rows} rows; ${r.metrics.drafted} drafts checked for figures; abstention ${f(r.metrics.abstention_rate)}`);
for (const [k, sl] of Object.entries(r.slices)) if (k === "lang" || k === "register" || k === "source") console.log(`  by ${k}: ` + Object.entries(sl).map(([n, m]) => `${n} esc ${f(m.escalation_recall)} griev ${f(m.grievance_recall)} cite ${f(m.citation_accuracy)} (${m.rows})`).join(" · "));
const fails = r.rows.filter(e => !e.ok);
if (fails.length) { console.log(`  ${fails.length} failing turn${fails.length > 1 ? "s" : ""}:`); fails.forEach(e => console.log(`    - ${e.id} [${e.fail.join(", ")}] ${e.t}`)); }

// 3. Judge validation on the held-out slice.
const jv = judge.validate(golden);
console.log(`\nJudge validation (held-out ${jv.heldOut} rows, threshold ${jv.threshold}):`);
jv.rows.forEach(x => console.log(`  ${x.name.padEnd(40)} ${x.agreement === null ? "  n/a" : f(x.agreement).padStart(5)}  ${x.policy === "never" ? "never fed to a gate, by policy" : x.allowed ? "may feed its gate" : "refused"}`));

// 4. Report.
const here = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(here, "out"), { recursive: true });
writeFileSync(path.join(here, "out", `report-release-${release}.json`), JSON.stringify({ generated: new Date().toISOString(), golden: golden.meta, release, metrics: r.metrics, gates: r.gates, slices: r.slices, failures: fails.map(e => ({ id: e.id, t: e.t, fail: e.fail, expected: e.expected, actual: e.actual })), judge: jv }, null, 2));
console.log(`\nReport: eval/out/report-release-${release}.json`);
if (r.failed) { console.error(`\n${r.failed} gate${r.failed > 1 ? "s" : ""} failed. Release ${release} is blocked.`); process.exit(1); }
console.log(`\nRelease ${release} passes every gate.`);
