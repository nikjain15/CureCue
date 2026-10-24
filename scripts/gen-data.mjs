// Generates app/data.js: one synthetic plan's worth of members, contacts, cases, claims and callbacks.
// Deterministic (seeded), so every number on the desk traces to a row here. Run: node scripts/gen-data.mjs
// Dates are day offsets from the demo's "today" (a Monday), so clocks and due dates stay consistent on any real day.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let seed = 20261027;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = a => a[Math.floor(rnd() * a.length)];

const TODAY = "2026-10-27"; // demo day, a Monday

// ---------- Members (8). Rosa M. is the scripted call; the others fill the briefing and the queue. ----------
const members = [
  { id: "M-001", name: "Rosa Martinez", short: "Rosa M.", age: 71, plan: "Sierra Advantage HMO", lang: "English", last4: "4821", pcp: "Dr. Imani Okafor", flags: ["repeat caller"] },
  { id: "M-002", name: "Daniel Kowalski", short: "Daniel K.", age: 68, plan: "Sierra Advantage HMO", lang: "English", last4: "7730", pcp: "Dr. Priya Raman", flags: [] },
  { id: "M-003", name: "Anita Pereira", short: "Anita P.", age: 74, plan: "Sierra Advantage PPO", lang: "Portuguese", last4: "1194", pcp: "Dr. Luis Barroso", flags: ["interpreter"] },
  { id: "M-004", name: "Walter Nguyen", short: "Walter N.", age: 79, plan: "Sierra Advantage HMO", lang: "English", last4: "5582", pcp: "Dr. Imani Okafor", flags: ["recently discharged"] },
  { id: "M-005", name: "Gloria Whitfield", short: "Gloria W.", age: 66, plan: "Sierra Advantage HMO", lang: "English", last4: "2047", pcp: "Dr. Priya Raman", flags: ["caregiver calls"] },
  { id: "M-006", name: "Hector Alvarez", short: "Hector A.", age: 72, plan: "Sierra Advantage D-SNP", lang: "Spanish", last4: "9013", pcp: "Dr. Luis Barroso", flags: ["dual eligible"] },
  { id: "M-007", name: "June Takahashi", short: "June T.", age: 70, plan: "Sierra Advantage PPO", lang: "English", last4: "6618", pcp: "Dr. Noor Haddad", flags: ["TTY"] },
  { id: "M-008", name: "Samuel Osei", short: "Samuel O.", age: 77, plan: "Sierra Advantage HMO", lang: "English", last4: "3356", pcp: "Dr. Noor Haddad", flags: [] }
];

// ---------- Claims (12). Each cites the plan rule that explains it. ----------
const claims = [
  { id: "C-26-5519", member: "M-001", day: -27, provider: "Lindqvist Dermatology", service: "Specialist visit", billed: 120, planPaid: 0, owed: 120, rule: "S-REF", reason: "No referral on file" },
  { id: "C-26-5301", member: "M-001", day: -41, provider: "Dr. Imani Okafor", service: "Primary care visit", billed: 140, planPaid: 140, owed: 0, rule: "S-PCP", reason: "Paid in full" },
  { id: "C-26-5602", member: "M-002", day: -12, provider: "Valley Imaging", service: "MRI, knee", billed: 1180, planPaid: 1180, owed: 0, rule: "S-PCP", reason: "Paid, prior auth on file" },
  { id: "C-26-5610", member: "M-002", day: -9, provider: "Dr. Priya Raman", service: "Primary care visit", billed: 140, planPaid: 140, owed: 0, rule: "S-PCP", reason: "Paid in full" },
  { id: "C-26-5488", member: "M-003", day: -31, provider: "Coastal Cardiology", service: "Specialist visit", billed: 210, planPaid: 175, owed: 35, rule: "S-SPEC", reason: "Copay applied" },
  { id: "C-26-5633", member: "M-004", day: -6, provider: "St. Brigid Medical Center", service: "Inpatient, 3 days", billed: 14200, planPaid: 13225, owed: 975, rule: "S-INPT", reason: "$325 x 3 days" },
  { id: "C-26-5629", member: "M-004", day: -7, provider: "St. Brigid Emergency", service: "Emergency room", billed: 2300, planPaid: 2300, owed: 0, rule: "S-ER-W", reason: "ER copay waived, admitted" },
  { id: "C-26-5571", member: "M-005", day: -18, provider: "Dr. Priya Raman", service: "Primary care visit", billed: 140, planPaid: 140, owed: 0, rule: "S-PCP", reason: "Paid in full" },
  { id: "C-26-5540", member: "M-006", day: -22, provider: "Riverbend Podiatry", service: "Specialist visit", billed: 195, planPaid: 160, owed: 35, rule: "S-SPEC", reason: "Copay applied" },
  { id: "C-26-5595", member: "M-007", day: -14, provider: "Hillcrest Audiology", service: "Hearing exam", billed: 160, planPaid: 160, owed: 0, rule: "S-PCP", reason: "Paid in full" },
  { id: "C-26-5612", member: "M-008", day: -8, provider: "St. Brigid Emergency", service: "Emergency room", billed: 1900, planPaid: 1790, owed: 110, rule: "S-ER", reason: "ER copay, not admitted" },
  { id: "C-26-5420", member: "M-008", day: -36, provider: "Dr. Noor Haddad", service: "Primary care visit", billed: 140, planPaid: 140, owed: 0, rule: "S-PCP", reason: "Paid in full" }
];

// ---------- Cases (10): grievances and appeals with clocks. Grievance 30 days; appeal (reconsideration) 30 days here. ----------
const cases = [
  { id: "G-26-0388", member: "M-004", type: "grievance", opened: -26, days: 30, subject: "Discharge instructions not provided in writing", status: "open", owner: "Grievances team" },
  { id: "G-26-0391", member: "M-003", type: "grievance", opened: -25, days: 30, subject: "Interpreter line wait over 20 minutes", status: "open", owner: "Grievances team" },
  { id: "A-26-0142", member: "M-002", type: "appeal", opened: -20, days: 30, subject: "Physical therapy visits beyond 12", status: "open", owner: "Appeals team" },
  { id: "G-26-0402", member: "M-006", type: "grievance", opened: -16, days: 30, subject: "Pharmacy delivery missed twice", status: "open", owner: "Grievances team" },
  { id: "G-26-0405", member: "M-007", type: "grievance", opened: -12, days: 30, subject: "TTY call dropped", status: "open", owner: "Grievances team" },
  { id: "A-26-0151", member: "M-005", type: "appeal", opened: -10, days: 30, subject: "Home health hours", status: "open", owner: "Appeals team" },
  { id: "G-26-0409", member: "M-008", type: "grievance", opened: -5, days: 30, subject: "ER copay charged, member says admitted", status: "open", owner: "Grievances team" },
  { id: "G-26-0351", member: "M-001", type: "grievance", opened: -58, days: 30, subject: "Dental allowance card declined", status: "resolved", owner: "Grievances team" },
  { id: "G-26-0372", member: "M-005", type: "grievance", opened: -40, days: 30, subject: "Callback promised, not made", status: "resolved", owner: "Grievances team" },
  { id: "A-26-0120", member: "M-004", type: "appeal", opened: -44, days: 30, subject: "Skilled nursing days", status: "resolved", owner: "Appeals team" }
];

// ---------- Contacts (30): prior calls, with reason, outcome, and whether a callback was promised. ----------
const reasons = ["Benefits and cost question", "Claims and billing", "Pharmacy", "ID card", "Provider lookup", "Grievance", "Appeal status", "Transportation"];
const contacts = [
  { member: "M-001", day: -24, reason: "Claims and billing", note: "First call about dermatology bill; claim still processing", callback: null, by: "J. Alvarez" },
  { member: "M-001", day: -13, reason: "Claims and billing", note: "Same bill; told to call back after the EOB arrived", callback: { promised: true, scheduled: false }, by: "T. Brooks" },
  { member: "M-001", day: -60, reason: "Benefits and cost question", note: "Dental allowance card declined at the dentist; grievance G-26-0351 opened", callback: null, by: "Nik J." },
  { member: "M-004", day: -5, reason: "Claims and billing", note: "Asked why the inpatient bill shows $975; rule explained", callback: { promised: true, scheduled: true, day: 0 }, by: "Nik J." },
  { member: "M-004", day: -26, reason: "Grievance", note: "No written discharge instructions; G-26-0388 opened", callback: null, by: "R. Chen" },
  { member: "M-002", day: -20, reason: "Appeal status", note: "Filed appeal A-26-0142 for PT visits", callback: null, by: "T. Brooks" },
  { member: "M-002", day: -3, reason: "Appeal status", note: "Asked for status; told decision due within the clock", callback: { promised: true, scheduled: true, day: 0 }, by: "Nik J." },
  { member: "M-003", day: -25, reason: "Grievance", note: "Interpreter wait; G-26-0391 opened", callback: null, by: "J. Alvarez" },
  { member: "M-003", day: -2, reason: "ID card", note: "Replacement card requested, 7 to 10 days", callback: null, by: "R. Chen" },
  { member: "M-005", day: -10, reason: "Appeal status", note: "Caregiver filed A-26-0151 for home health hours", callback: null, by: "Nik J." },
  { member: "M-005", day: -40, reason: "Grievance", note: "Callback promised and not made; G-26-0372", callback: null, by: "T. Brooks" },
  { member: "M-005", day: -1, reason: "Appeal status", note: "Caregiver asked for status; no update yet", callback: { promised: true, scheduled: true, day: 1 }, by: "J. Alvarez" },
  { member: "M-006", day: -16, reason: "Pharmacy", note: "Delivery missed twice; G-26-0402 opened; Spanish line", callback: null, by: "R. Chen" },
  { member: "M-006", day: -4, reason: "Pharmacy", note: "Delivery rescheduled; confirmed by text", callback: null, by: "Nik J." },
  { member: "M-007", day: -12, reason: "Grievance", note: "TTY call dropped; G-26-0405 opened", callback: null, by: "J. Alvarez" },
  { member: "M-008", day: -5, reason: "Claims and billing", note: "ER copay on C-26-5612; member says he was admitted; G-26-0409 opened", callback: { promised: true, scheduled: true, day: 0 }, by: "Nik J." },
  { member: "M-008", day: -36, reason: "Provider lookup", note: "Asked for in-network podiatrist", callback: null, by: "T. Brooks" }
];
// fill to 30 with routine contacts
const routine = ["Benefits and cost question", "ID card", "Provider lookup", "Transportation", "Pharmacy"];
while (contacts.length < 30) {
  let m = pick(members).id; if (m === "M-001") m = "M-005"; const day = -Math.floor(rnd() * 85 + 3); const reason = pick(routine);
  contacts.push({ member: m, day, reason, note: ({ "Benefits and cost question": "Copay question answered from the plan", "ID card": "Card mailed", "Provider lookup": "Two in-network options given", "Transportation": "Ride booked", "Pharmacy": "Refill status given" })[reason], callback: null, by: pick(["Nik J.", "T. Brooks", "J. Alvarez", "R. Chen"]) });
}
contacts.sort((a, b) => a.day - b.day);

// ---------- Today's shift so far (for the My day view): calls handled before Rosa's. ----------
const shift = [
  { time: "08:04", member: "M-006", reason: "Pharmacy", minutes: 6, cues: { accepted: 1, declined: 0 }, qa: false },
  { time: "08:17", member: "M-007", reason: "Benefits and cost question", minutes: 4, cues: { accepted: 1, declined: 0 }, qa: false },
  { time: "08:31", member: "M-003", reason: "ID card", minutes: 5, cues: { accepted: 0, declined: 0 }, qa: false },
  { time: "08:49", member: "M-004", reason: "Claims and billing", minutes: 9, cues: { accepted: 2, declined: 0 }, qa: true },
  { time: "09:12", member: "M-008", reason: "Provider lookup", minutes: 5, cues: { accepted: 1, declined: 1 }, qa: false },
  { time: "09:30", member: "M-002", reason: "Appeal status", minutes: 7, cues: { accepted: 1, declined: 0 }, qa: false },
  { time: "10:02", member: "M-005", reason: "Benefits and cost question", minutes: 6, cues: { accepted: 1, declined: 0 }, qa: false }
];

const data = { TODAY, members, claims, cases, contacts, shift,
  pharmacy: { "M-001": [{ drug: "Atorvastatin 20 mg", tier: 1, next: 9, mode: "mail" }, { drug: "Lisinopril 10 mg", tier: 1, next: 9, mode: "mail" }], "M-006": [{ drug: "Metformin 500 mg", tier: 1, next: 2, mode: "delivery" }] },
  coaching: "Yesterday's QA sample: 3 of your 4 sampled calls had every required note element. The miss was a callback with no date. Cue now pre-fills the date when a callback is promised." };

const out = `/* Generated by scripts/gen-data.mjs. Do not edit by hand. Synthetic: no real plan, member, provider or document. */
(function (root, factory) { if (typeof module !== "undefined" && module.exports) module.exports = factory(); else root.CureCueData = factory(); })(typeof self !== "undefined" ? self : this, function () { return ${JSON.stringify(data, null, 1)}; });
`;
const here = path.dirname(fileURLToPath(import.meta.url));
writeFileSync(path.join(here, "..", "app", "data.js"), out);
console.log(`app/data.js: ${members.length} members, ${claims.length} claims, ${cases.length} cases, ${contacts.length} contacts, ${shift.length} calls today`);
