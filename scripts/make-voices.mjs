// Records every line in app/script.js with three distinct macOS voices and writes app/audio/manifest.json.
// macOS only (uses the built-in `say` and `afconvert`). Run: node scripts/make-voices.mjs
// The desk plays a clip when the manifest has one for that exact speaker and text; otherwise it falls back to browser voices.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const S = require("../app/script.js");
const VOICES = { Rosa: { voice: "Samantha", rate: 168 }, Advocate: { voice: "Daniel", rate: 182 }, Supervisor: { voice: "Moira", rate: 176 } };
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "..", "app", "audio");
mkdirSync(dir, { recursive: true });
readdirSync(dir).filter(f => /\.(m4a|mp3)$/.test(f)).forEach(f => rmSync(path.join(dir, f)));
const clips = {};
for (const { w, t } of S.allLines()) {
  const key = w + "|" + t; if (clips[key]) continue;
  const v = VOICES[w]; const name = w.toLowerCase() + "-" + createHash("sha1").update(key).digest("hex").slice(0, 10);
  const aiff = path.join(dir, name + ".aiff"), m4a = path.join(dir, name + ".m4a");
  execFileSync("say", ["-v", v.voice, "-r", String(v.rate), "-o", aiff, t]);
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "64000", aiff, m4a]);
  rmSync(aiff);
  clips[key] = name + ".m4a";
  console.log(name + ".m4a", w + ":", t);
}
writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ voices: Object.fromEntries(Object.entries(VOICES).map(([k, v]) => [k, v.voice])), clips }, null, 1) + "\n");
console.log(`${Object.keys(clips).length} clips, app/audio/manifest.json written`);
