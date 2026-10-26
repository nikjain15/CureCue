// Scores the synthetic data as data, before anything reads it. Every reference resolves, every figure adds up,
// every clock is computable. Fails the build otherwise. Run: node eval/check-data.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const D = require("../app/data.js");
const R = require("../rules.js");
const errors = [];
const ids = new Set(D.members.map(m => m.id));
const ruleIds = new Set(Object.values(R.GRAPH.nodes).map(n => n.id).filter(Boolean));
if (!/^\d{4}-\d{2}-\d{2}$/.test(D.TODAY)) errors.push("TODAY is not a date");
const seen = new Set();
D.members.forEach(m => { if (seen.has(m.id)) errors.push(`duplicate member ${m.id}`); seen.add(m.id); if (!/^\d{4}$/.test(m.last4)) errors.push(`${m.id}: last4 malformed`); if (m.age < 18 || m.age > 110) errors.push(`${m.id}: age ${m.age}`); });
D.claims.forEach(c => {
  if (!ids.has(c.member)) errors.push(`claim ${c.id}: member ${c.member} does not exist`);
  if (!ruleIds.has(c.rule)) errors.push(`claim ${c.id}: rule ${c.rule} is not a node`);
  if (c.planPaid + c.owed !== c.billed) errors.push(`claim ${c.id}: paid ${c.planPaid} + owed ${c.owed} != billed ${c.billed}`);
  if (c.rule === "S-SPEC" && c.owed !== 25) errors.push(`claim ${c.id}: specialist copay should be $25, is ${c.owed}`);
  if (c.rule === "S-DIAG" && ![25, 120].includes(c.owed)) errors.push(`claim ${c.id}: procedure copay should be $25 (office) or $120 (outpatient hospital), is ${c.owed}`);
  if (c.rule === "S-ER" && c.owed !== 115) errors.push(`claim ${c.id}: ER copay should be $115, is ${c.owed}`);
  if (c.rule === "S-ER-W" && c.owed !== 0) errors.push(`claim ${c.id}: waived ER copay should be $0`);
  if (c.rule === "S-INPT" && c.owed % 375 !== 0) errors.push(`claim ${c.id}: inpatient owed ${c.owed} is not a multiple of $375`);
  if (c.rule === "S-PCP" && c.owed !== 0) errors.push(`claim ${c.id}: primary care should be $0`);
  if (c.day > 0) errors.push(`claim ${c.id}: service date in the future`);
});
D.cases.forEach(k => {
  const dl = R.DEADLINES[k.kind];
  if (!dl) errors.push(`case ${k.id}: unknown kind ${k.kind}`);
  else if (dl.days && k.days !== dl.days) errors.push(`case ${k.id}: clock ${k.days} days, but a ${dl.label.toLowerCase()} is ${dl.days} days (EOC p. ${dl.src[0].page})`);
  if ((k.kind === "grievance") !== (k.type === "grievance")) errors.push(`case ${k.id}: kind ${k.kind} does not match type ${k.type}`);
  if (!ids.has(k.member)) errors.push(`case ${k.id}: member missing`);
  if (!["grievance", "appeal"].includes(k.type)) errors.push(`case ${k.id}: type ${k.type}`);
  if ((k.type === "grievance") !== k.id.startsWith("G-")) errors.push(`case ${k.id}: id prefix does not match type`);
  if (!(k.days > 0)) errors.push(`case ${k.id}: no clock`);
  const due = k.opened + k.days;
  if (k.status === "open" && due < 0) errors.push(`case ${k.id}: open but clock breached ${-due} days ago`);
  if (k.status === "resolved" && k.opened > -k.days) errors.push(`case ${k.id}: resolved before its clock could run (fine) `) && errors.pop();
});
D.contacts.forEach((c, i) => { if (!ids.has(c.member)) errors.push(`contact ${i}: member missing`); if (c.day > 0) errors.push(`contact ${i}: in the future`); if (c.callback && c.callback.scheduled && typeof c.callback.day !== "number") errors.push(`contact ${i}: scheduled callback without a day`); });
D.shift.forEach(s => { if (!ids.has(s.member)) errors.push(`shift ${s.time}: member missing`); if (!(s.minutes > 0)) errors.push(`shift ${s.time}: no duration`); });
// Rosa's story must match the script: two prior calls about the bill, a $120 biopsy at the outpatient hospital copay, callback promised and not scheduled
const rosa = D.contacts.filter(c => c.member === "M-001" && c.reason === "Claims and billing");
if (rosa.length !== 2) errors.push(`Rosa should have two prior billing contacts, has ${rosa.length}`);
if (!rosa.some(c => c.callback && c.callback.promised && !c.callback.scheduled)) errors.push("Rosa's unscheduled callback is missing");
const bill = D.claims.find(c => c.member === "M-001" && c.rule === "S-DIAG");
if (!bill || bill.owed !== 120) errors.push("Rosa's $120 outpatient procedure claim is missing");
if (errors.length) { console.error("Data check failed:\n  " + errors.join("\n  ")); process.exit(1); }
console.log(`Data check: ${D.members.length} members, ${D.claims.length} claims, ${D.cases.length} cases, ${D.contacts.length} contacts, ${D.shift.length} shift calls. Consistent.`);
