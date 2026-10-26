// Checks the plan rules against the documents they cite, before anything else runs. Fails the build otherwise.
// 1. Each PDF in sources/ matches the SHA-256 recorded in rules.js (the copy is the file that was published).
// 2. Each rule's quote appears on the PDF page it cites (text extracted with pdftotext, from poppler-utils).
// 3. Each test line's source points at a page that exists.
// Run: node eval/check-sources.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const R = require("../rules.js");
const golden = require("./golden.js");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const norm = t => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").toLowerCase();

// Text of each page, two ways: layout keeps table rows together, raw keeps sentences that wrap across columns.
const pages = {};
function pagesOf(doc) {
  if (pages[doc]) return pages[doc];
  const file = path.join(root, R.SOURCES[doc].file);
  const extract = flag => execFileSync("pdftotext", ["-q", ...flag, file, "-"], { maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] }).toString().split("\f");
  const layout = extract(["-layout"]), raw = extract([]);
  return (pages[doc] = layout.map((t, i) => norm(t) + " \u0000 " + norm(raw[i] || "")));
}

for (const [k, S] of Object.entries(R.SOURCES)) {
  const buf = readFileSync(path.join(root, S.file));
  if (S.sha256) { const h = createHash("sha256").update(buf).digest("hex"); if (h !== S.sha256) errors.push(`${k}: ${S.file} does not match its recorded SHA-256`); }
  if (S.pages) { const n = pagesOf(k).length - 1; /* pdftotext ends every page with a form feed */ if (n !== S.pages) errors.push(`${k}: expected ${S.pages} pages, found ${n}`); }
}

let quotes = 0;
const cited = [...Object.values(R.GRAPH.nodes), ...Object.entries(R.DEADLINES).map(([k, d]) => ({ id: "deadline:" + k, ...d }))]; // plan rules and case deadlines
for (const n of cited) for (const src of n.src || []) {
  quotes++;
  const S = R.SOURCES[src.doc];
  const text = S.pages ? (pagesOf(src.doc)[src.page - 1] || "") : norm(readFileSync(path.join(root, S.file), "utf8"));
  // An ellipsis in a quote marks text left out; each piece must be on the page.
  for (const piece of src.quote.split("…").map(p => norm(p).trim()).filter(Boolean))
    if (!text.includes(piece)) errors.push(`${n.id}: "${piece}" not found on ${S.code}${src.page ? " p. " + src.page : ""}`);
}

for (const r of golden) if (r.src && r.src.doc) {
  const S = R.SOURCES[r.src.doc];
  if (!S) errors.push(`${r.id}: unknown source ${r.src.doc}`);
  else if (S.pages && !(r.src.page >= 1 && r.src.page <= S.pages)) errors.push(`${r.id}: page ${r.src.page} is outside ${S.code}`);
}

if (errors.length) { console.error("Source check failed:\n  " + errors.join("\n  ")); process.exit(1); }
console.log(`Source check: ${Object.keys(R.SOURCES).length} documents match their checksums; ${quotes} quotes found on their cited pages; ${golden.filter(r => r.src && r.src.doc).length} test-line sources point at real pages.`);
