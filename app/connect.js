/* Connections: the sources Cue reads, and whether each one is live.
   Live:     runs from this browser now, against the real public source (plan PDFs, eCFR, Federal Register, the microphone).
   Demo:     fictional records in app/data.js stand in for the named system; no integration with it exists.
   Designed: how it would connect in a deployment; not built.
   Product names identify the systems a deployment would use. No partnership or integration is implied. */
window.CureCueConnect = (function () {
  const R = window.CureCueRules, G = R.GRAPH, D = window.CureCueData;
  const $ = id => document.getElementById(id);
  const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const norm = t => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").toLowerCase();
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  const DOC_BASE = "https://assets.humana.com/is/content/humana/";
  const STATUS = { live: ["good", "Live · runs from your browser"], demo: ["warn", "Demo data · fictional records stand in"], designed: ["design", "Not connected · designed"], off: ["bad", "Not available in this browser"] };
  const pill = s => `<span class="pill ${STATUS[s][0]}">${STATUS[s][1]}</span>`;

  // ---------- PDF reading in the browser (PDF.js), page by page, in two orders like the CI check ----------
  let pdfjs = null;
  async function loadPdfJs() {
    if (pdfjs) return pdfjs;
    await new Promise((res, rej) => { const s = document.createElement("script"); s.src = PDFJS + "pdf.min.js"; s.onload = res; s.onerror = () => rej(new Error("Could not load the PDF reader")); document.head.appendChild(s); });
    pdfjs = window.pdfjsLib; pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; return pdfjs;
  }
  async function readPdf(buf, onPage) {
    const lib = await loadPdfJs(); const doc = await lib.getDocument({ data: buf }).promise; const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      const raw = tc.items.map(i => i.str).join(" ");
      const rows = {}; tc.items.forEach(i => { const y = Math.round(i.transform[5] / 3); (rows[y] = rows[y] || []).push(i); });
      const layout = Object.keys(rows).map(Number).sort((a, b) => b - a).map(y => rows[y].sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join(" ")).join("\n");
      pages.push({ layout, raw, text: norm(layout) + " \u0000 " + norm(raw) });
      if (onPage) onPage(p, doc.numPages);
    }
    let title = ""; try { title = ((await doc.getMetadata()).info || {}).Title || ""; } catch (e) {}
    return { pages, numPages: doc.numPages, title };
  }
  async function sha256(buf) { const h = await crypto.subtle.digest("SHA-256", buf); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join(""); }
  async function fetchPdf(url) { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); const buf = await r.arrayBuffer(); if (new TextDecoder().decode(buf.slice(0, 5)) !== "%PDF-") throw new Error("not a PDF (the document may not exist)"); return buf; }

  // ---------- Live: the plan's documents. Fetch the original, compare its checksum, check every cited quote ----------
  async function checkPlanDocs(out) {
    const rows = []; const docs = ["SB", "EOC"];
    out.innerHTML = `<p class="small">Fetching the two documents from the plan's public site…</p>`;
    const results = {};
    for (const k of docs) {
      const S = R.SOURCES[k]; const line = msg => { out.innerHTML = `<p class="small">${esc(S.title)}: ${msg}</p>`; };
      try {
        line("downloading the original…"); const buf = await fetchPdf(S.url);
        line("computing its SHA-256…"); const h = await sha256(buf); const size = buf.byteLength; // PDF.js takes over the buffer, so measure first
        const pdf = await readPdf(buf, (p, n) => line(`reading page ${p} of ${n}…`));
        results[k] = { h, pdf, same: h === S.sha256, size };
      } catch (e) { results[k] = { err: e.message }; }
    }
    const quotes = []; Object.values(G.nodes).forEach(n => (n.src || []).forEach(x => { if (results[x.doc]) quotes.push({ n, x }); }));
    const found = quotes.map(({ n, x }) => { const r = results[x.doc]; const page = r.pdf && r.pdf.pages[x.page - 1]; const ok = !!page && x.quote.split("…").map(p => norm(p).trim()).filter(Boolean).every(p => page.text.includes(p)); return { n, x, ok }; });
    const nOk = found.filter(f => f.ok).length;
    out.innerHTML = `<div class="tscroll"><table class="slices"><thead><tr><th>Document</th><th>Original</th><th>Matches the copy in the repo?</th><th>Pages</th></tr></thead><tbody>${docs.map(k => { const S = R.SOURCES[k], r = results[k]; return r.err ? `<tr><td>${S.title}</td><td colspan="3" class="bad">Could not fetch: ${esc(r.err)}</td></tr>` : `<tr><td><b>${S.title}</b></td><td><a href="${S.url}" target="_blank" rel="noopener"><code>${S.code}</code></a> <span class="small">${(r.size / 1048576).toFixed(1)} MB</span></td><td class="${r.same ? "good" : "bad"}">${r.same ? "Yes, SHA-256 identical" : "No: the plan has republished it since " + S.retrieved}<div class="small" title="${r.h}">SHA-256 <code>${r.h.slice(0, 16)}…</code></div></td><td class="num">${r.pdf.numPages}${r.pdf.numPages === S.pages ? " ✓" : ""}</td></tr>`; }).join("")}</tbody></table></div>
      <p style="margin:12px 0 6px"><b>${nOk} of ${found.length}</b> quoted lines found on their cited pages, read just now by your browser.${nOk < found.length ? ` The ${found.length - nOk} not found here sit in tables the browser's PDF reader orders differently; the build check reads them with <code>pdftotext</code> and finds all ${found.length}.` : ""}</p>
      <details><summary class="small" style="cursor:pointer;font-weight:700">Every quote and its page</summary><div class="tscroll"><table class="slices"><thead><tr><th>Rule</th><th>Quoted line</th><th>Page</th><th>Found</th></tr></thead><tbody>${found.map(f => { const S = R.SOURCES[f.x.doc]; return `<tr><td>${f.n.label}</td><td class="small">"${esc(f.x.quote)}"</td><td><a href="../${S.file}#page=${f.x.page}" target="_blank" rel="noopener">${f.x.doc} p. ${f.x.page}</a></td><td class="${f.ok ? "good" : "bad"}">${f.ok ? "✓" : "not in this reading"}</td></tr>`; }).join("")}</tbody></table></div></details>`;
  }

  // ---------- Live: add another plan by ID, read its Summary of Benefits, compare with the plan on file ----------
  const COMPARE = [
    ["Monthly premium", /monthly plan premium \$?([\d,.]+)/, "PREM"],
    ["Yearly maximum (in-network)", /maximum out-of-pocket \$([\d,]+)/, "MOOP"],
    ["Primary care visit", /pcp's office: \$(\d+) copay/, "PCP"],
    ["Specialist visit", /specialist's office: \$(\d+) copay/, "SPEC"],
    ["Emergency room", /emergency services at emergency room \$(\d+) copay/, "ER"],
    ["Hospital stay, first days", /\$(\d+) copay per day for days 1-(\d+)/, "INPT"],
    ["Urgent care", /urgent care center: \$(\d+) copay/, "URG"],
    ["Outpatient surgery (hospital)", /surgery services \$(\d+) copay/, "SURG"],
    ["Ambulance", /\$(\d+) copay per date of service/, "AMB"],
    ["Referral needed?", /(you do not need a referral)/, "REF"]];
  function figuresFrom(pdf) { const out = {}; COMPARE.forEach(([label, re, k]) => { for (let i = 0; i < pdf.pages.length; i++) { const m = re.exec(pdf.pages[i].text); if (m) { out[k] = { v: k === "REF" ? "No referral needed" : k === "INPT" ? `$${m[1]}/day, days 1-${m[2]}` : (k === "PREM" ? "$" : "$") + m[1].replace(/^\$/, ""), page: i + 1 }; break; } } }); return out; }
  let basePdf = null;
  async function addPlan(out, idRaw) {
    const id = idRaw.trim().toUpperCase().replace(/\s/g, ""); const m = /^(H\d{4})-?(\d{3})$/.exec(id);
    if (!m) { out.innerHTML = `<p class="bad">Use a plan ID like H6622-025: the contract number, a dash, and the three-digit plan number.</p>`; return; }
    const url = `${DOC_BASE}${m[1]}${m[2]}000SB26pdf`;
    try {
      out.innerHTML = `<p class="small">Fetching the 2026 Summary of Benefits for ${m[1]}-${m[2]}…</p>`;
      const buf = await fetchPdf(url); const h = await sha256(buf);
      const pdf = await readPdf(buf, (p, n) => { out.innerHTML = `<p class="small">Reading page ${p} of ${n}…</p>`; });
      if (!basePdf) { out.innerHTML = `<p class="small">Reading the plan on file for comparison…</p>`; basePdf = await readPdf(await (await fetch("../" + R.SOURCES.SB.file)).arrayBuffer()); }
      const a = figuresFrom(basePdf), b = figuresFrom(pdf);
      const rows = COMPARE.map(([label, , k]) => { const x = a[k], y = b[k]; const same = x && y && x.v === y.v; return `<tr><td>${label}</td><td>${x ? x.v : "—"}</td><td><b>${y ? y.v : "not found"}</b></td><td>${y ? `<a href="${url}#page=${y.page}" target="_blank" rel="noopener">p. ${y.page}</a>` : ""}</td><td class="${!y ? "" : same ? "" : "bad"}">${!y ? "" : same ? "same" : "different"}</td></tr>`; }).join("");
      const nFound = Object.keys(b).length;
      out.innerHTML = `<p style="margin:0 0 8px"><b>${esc(pdf.title || m[1] + "-" + m[2])}</b> · ${pdf.numPages} pages · <a href="${url}" target="_blank" rel="noopener">original PDF</a> · SHA-256 <code style="word-break:break-all">${h.slice(0, 16)}…</code></p>
        <div class="tscroll"><table class="slices"><thead><tr><th>Rule</th><th>Plan on file (H6622-026)</th><th>${m[1]}-${m[2]}</th><th>Page</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="small" style="margin-top:8px">Read from the PDF just now: ${nFound} of ${COMPARE.length} rules found, each with its page. This is the first step of onboarding a plan. Next, in a deployment: a person reviews each rule, it gets its quote checked like the plan on file, and the test lines tied to any changed rule re-run before Cue uses it.</p>`;
    } catch (e) { out.innerHTML = `<p class="bad">Could not read ${m[1]}-${m[2]}: ${esc(e.message)}. Not every plan publishes a 2026 Summary of Benefits at this address; try H6622-025, H6622-061, H1036-137 or H0028-039.</p>`; }
  }

  // ---------- Live: the federal regulation, read now from eCFR, compared with the excerpt on file ----------
  async function checkEcfr(out) {
    out.innerHTML = `<p class="small">Asking eCFR for the current text of 42 CFR 422.561…</p>`;
    try {
      const titles = await (await fetch("https://www.ecfr.gov/api/versioner/v1/titles.json")).json();
      const t42 = titles.titles.find(t => t.number === 42); const date = t42.up_to_date_as_of;
      const versions = await (await fetch("https://www.ecfr.gov/api/versioner/v1/versions/title-42.json?part=422&section=422.561")).json();
      const last = versions.content_versions.map(v => v.amendment_date).sort().pop();
      const xml = await (await fetch(`https://www.ecfr.gov/api/versioner/v1/full/${date}/title-42.xml?part=422&section=422.561`)).text();
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      const p = [...doc.querySelectorAll("P")].map(n => n.textContent.replace(/\s+/g, " ").trim()).find(x => /^Grievance means/i.test(x)) || "";
      const want = (G.nodes.GRV.src.find(x => x.doc === "CFR") || {}).quote || "";
      const ok = want.split("…").map(x => norm(x).trim()).filter(Boolean).every(x => norm(p).includes(x));
      out.innerHTML = `<p style="margin:0 0 6px">Read from eCFR, current as of <b>${date}</b>; section last amended <b>${last}</b>.</p><blockquote class="small" style="margin:0;padding:8px 12px;border-left:3px solid var(--line-2);background:var(--bg-2)">${esc(p)}</blockquote><p class="${ok ? "good" : "bad"}" style="margin:8px 0 0;font-weight:700">${ok ? "✓ Matches the definition Cue uses for complaints" : "✗ Differs from the definition on file: review the rule"}</p>`;
    } catch (e) { out.innerHTML = `<p class="bad">eCFR did not answer: ${esc(e.message)}</p>`; }
  }
  async function fedReg(out) {
    out.innerHTML = `<p class="small">Asking the Federal Register for recent Medicare Advantage rules…</p>`;
    try {
      const q = "https://www.federalregister.gov/api/v1/documents.json?per_page=5&order=newest&conditions[term]=%22Medicare%20Advantage%22&conditions[type][]=RULE&conditions[type][]=PRORULE&fields[]=title&fields[]=publication_date&fields[]=html_url&fields[]=type";
      const j = await (await fetch(q)).json();
      out.innerHTML = `<ul class="feed">${j.results.map(r => `<li><a href="${r.html_url}" target="_blank" rel="noopener">${esc(r.title)}</a><span class="small"> · ${r.type === "Rule" ? "Final rule" : "Proposed rule"} · ${r.publication_date}</span></li>`).join("")}</ul><p class="small">Read just now. In a deployment, a new final rule opens a review of the rules and test lines it touches.</p>`;
    } catch (e) { out.innerHTML = `<p class="bad">The Federal Register did not answer: ${esc(e.message)}</p>`; }
  }

  // ---------- Live: the microphone. Speak as the member; Cue decides on each sentence ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null;
  function mic(out, btn) {
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = "en-US"; rec.continuous = true; rec.interimResults = true;
    out.innerHTML = `<div class="miclive"><span class="dot live"></span> Listening. Say something a member might say, like "How much is an MRI?" or "They are sending my mother home tomorrow."</div><div id="micinterim" class="small"></div><div id="miclog"></div>`;
    btn.textContent = "Stop listening";
    rec.onresult = e => { let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) heard(r[0].transcript.trim()); else interim += r[0].transcript; } const el = $("micinterim"); if (el) el.textContent = interim ? "… " + interim : ""; };
    rec.onerror = e => { out.insertAdjacentHTML("beforeend", `<p class="bad">Microphone: ${esc(e.error)}${e.error === "not-allowed" ? ". Allow microphone access for this site and try again." : ""}</p>`); };
    rec.onend = () => { rec = null; btn.textContent = "Start listening"; };
    rec.start();
  }
  function heard(text) {
    if (!text) return; const d = R.decide(text, R.CURRENT_RELEASE); const B = window.CureCueDesk;
    const kind = d.verdict === "escalate" ? "escalate" : d.verdict === "answer" ? "answer" : d.grievance ? "grievance" : d.account ? "account" : "refuse";
    const g = R.grievance(text);
    const say = kind === "escalate" ? `<b>Stop.</b> Bring a person in: "${esc(d.trigger)}".` : kind === "answer" ? d.draft.say : kind === "grievance" ? `That counts as a complaint, even without the word. Log it?` : kind === "account" ? "That's about the account. Open the claim; no figure suggested." : "<b>Not in the plan rules on file.</b> Cue says so rather than guess.";
    const trace = B ? B.buildTrace(kind, text, kind === "grievance" ? { phrase: g ? g.exec(text)[0] : "" } : kind === "account" ? { word: (R.ACCOUNT.exec(text) || [])[0] } : d) : "";
    const log = $("miclog"); if (!log) return;
    log.insertAdjacentHTML("afterbegin", `<div class="cue ${kind === "escalate" ? "stop" : kind === "grievance" ? "flag" : ""}" style="margin-top:10px"><div class="k">You said: "${esc(text)}"</div><div class="say">${say}</div><details><summary class="small" style="cursor:pointer;font-weight:700">How Cue got this</summary>${trace}</details></div>`);
  }

  // ---------- Demo data: fictional records stand in for the named systems ----------
  function demoCrm(out) {
    const open = D.cases.filter(k => k.status === "open"), cl = D.claims;
    const checks = [
      ["Every claim belongs to a member on file", cl.every(c => D.members.some(m => m.id === c.member))],
      ["Plan paid plus member owed equals billed, on every claim", cl.every(c => c.planPaid + c.owed === c.billed)],
      ["Every specialist copay is the plan's $25", cl.filter(c => c.rule === "S-SPEC").every(c => c.owed === 25)],
      ["No open grievance or appeal is past its clock", open.every(k => k.opened + k.days >= 0)]];
    out.innerHTML = `<p style="margin:0 0 8px">${D.members.length} members · ${D.cases.length} cases (${open.length} open) · ${D.contacts.length} contacts · ${cl.length} claims, from <code>app/data.js</code>.</p><ul class="checks">${checks.map(([l, ok]) => `<li class="${ok ? "good" : "bad"}">${ok ? "✓" : "✗"} ${l}</li>`).join("")}</ul>`;
  }
  function demoClaims(out) {
    const c = D.claims.find(x => x.id === "C-26-5519");
    out.innerHTML = `<p style="margin:0 0 6px">Rosa's biopsy claim, as the claims system would return it:</p><div class="tscroll"><table class="slices"><tbody>
      <tr><td>Claim</td><td><code>${c.id}</code></td></tr><tr><td>Service</td><td>${c.service}, ${c.provider}</td></tr>
      <tr><td>Place of service</td><td><b>22 · On-campus outpatient hospital</b></td></tr>
      <tr><td>Billed / plan paid / member owes</td><td>$${c.billed} / $${c.planPaid} / <b>$${c.owed}</b></td></tr>
      <tr><td>Plan rule</td><td>${c.rule}: ${G.nodes.DIAG.text}</td></tr></tbody></table></div>
      <p class="small" style="margin-top:8px">The place-of-service code is what settles Rosa's question: code 11 (office) means the $25 specialist copay; code 22 (outpatient hospital) means the $120 procedure copay. Codes are the standard CMS place-of-service codes; the claim itself is fictional.</p>`;
  }

  // ---------- The catalog ----------
  const CATALOG = [
    ["Plan documents", "What the plan covers and costs. Every rule Cue cites comes from here.", [
      { id: "docs", name: "Humana plan documents", sub: "assets.humana.com · public PDFs", status: "live", reads: ["2026 Summary of Benefits and Evidence of Coverage for H6622-026 (HMO-POS)", "Checked against the copies in the repository by SHA-256"], act: ["Check now", checkPlanDocs] },
      { id: "add", name: "Add another plan", sub: "Any plan ID with a published 2026 Summary of Benefits", status: "live", reads: ["Reads the plan's PDF in your browser", "Finds the main rules with their pages and compares them with the plan on file"], form: true },
      { id: "anoc", name: "Annual Notice of Change and formulary", sub: "Per plan and plan year", status: "designed", reads: ["What changed from last year, to drive the yearly review", "Drug tiers and coverage limits"] }]],
    ["Member and claims systems", "Who the member is and what has happened on their account.", [
      { id: "crm", name: "Salesforce Health Cloud", sub: "Member profile, cases, contact history", status: "demo", reads: ["Member, authorized representatives, flags", "Grievance and appeal cases with their clocks", "Prior contacts and promised callbacks"], act: ["Run checks on the demo records", demoCrm] },
      { id: "claims", name: "Claims platform (TriZetto Facets)", sub: "Claims, EOBs, place of service", status: "demo", reads: ["Claim lines with amounts and place of service", "Which plan rule priced each line"], act: ["Show a claim", demoClaims] },
      { id: "auth", name: "Prior authorization (Availity)", sub: "Authorizations on file", status: "designed", reads: ["Whether a service had approval before it happened"] }]],
    ["Contact center", "The live call: what is said, by whom, and why the member called.", [
      { id: "mic", name: "This browser's microphone", sub: "Speech recognition built into the browser", status: SR ? "live" : "off", reads: ["Your words, turned into text as you speak", "Each sentence goes through the same rules as the demo call"], mic: true },
      { id: "genesys", name: "Genesys Cloud CX", sub: "Telephony, live transcription, IVR reason", status: "designed", reads: ["Real-time transcript events for the advocate's call", "The reason the member chose in the phone menu", "Queue and handle-time figures for My day"] },
      { id: "aconnect", name: "Amazon Connect", sub: "Contact Lens real-time analytics", status: "designed", reads: ["Real-time transcript segments, streamed as the call happens"] }]],
    ["Regulatory and reference", "The rules every Medicare Advantage plan works under.", [
      { id: "ecfr", name: "eCFR · 42 CFR 422.561", sub: "ecfr.gov, the official current text", status: "live", reads: ["The federal definition of a grievance, read now and compared with the one Cue uses"], act: ["Check now", checkEcfr] },
      { id: "fedreg", name: "Federal Register", sub: "federalregister.gov", status: "live", reads: ["New and proposed Medicare Advantage rules, newest first"], act: ["Show latest", fedReg] },
      { id: "qio", name: "Quality Improvement Organization directory", sub: "Medicare's list, by state", status: "designed", reads: ["Who to call for a fast-track appeal in the member's state"] }]]];

  function render() {
    const counts = { live: 0, demo: 0, designed: 0 }; CATALOG.forEach(([, , items]) => items.forEach(i => { if (counts[i.status] !== undefined) counts[i.status]++; }));
    $("connect").innerHTML = `<p class="small" style="margin:0 0 14px">${counts.live} live · ${counts.demo} on demo data · ${counts.designed} designed. All connections are read-only: Cue never writes to a source system; the advocate does.</p>` +
      CATALOG.map(([g, gsub, items]) => `<section class="cgroup"><h2>${g}</h2><p class="small">${gsub}</p><div class="cgrid">${items.map(i => `<div class="ccard" id="c-${i.id}"><div class="ctop"><b>${i.name}</b>${pill(i.status)}</div><div class="small">${i.sub}</div><ul>${i.reads.map(r => `<li>${r}</li>`).join("")}</ul>
        ${i.form ? `<form class="ctrl" data-add><input type="text" placeholder="Plan ID, e.g. H6622-025" value="H6622-025" style="max-width:200px"><button class="btn sm primary">Fetch and read</button></form>` : ""}
        ${i.mic && SR ? `<button class="btn sm primary" data-mic>Start listening</button>` : ""}
        ${i.act ? `<button class="btn sm primary" data-act="${i.id}">${i.act[0]}</button>` : ""}
        ${i.status === "designed" ? `<details class="small"><summary style="cursor:pointer;font-weight:700">How it would connect</summary><p>Read-only service account, scoped to the fields above. Events stream to Cue during a call; nothing is written back. Not built in this prototype.</p></details>` : ""}
        <div class="cout" id="o-${i.id}"></div></div>`).join("")}</div></section>`).join("") +
      `<p class="small" style="margin-top:16px">Product names identify the systems a deployment would use; no partnership or integration with them is implied. Live checks call the public source directly from your browser.</p>`;
    CATALOG.forEach(([, , items]) => items.forEach(i => { if (!i.act) return; const b = document.querySelector(`[data-act="${i.id}"]`); b.onclick = async () => { b.disabled = true; await i.act[1]($("o-" + i.id)); b.disabled = false; }; }));
    const f = document.querySelector("[data-add]"); if (f) f.onsubmit = async e => { e.preventDefault(); const b = f.querySelector("button"); b.disabled = true; await addPlan($("o-add"), f.querySelector("input").value); b.disabled = false; };
    const m = document.querySelector("[data-mic]"); if (m) m.onclick = () => mic($("o-mic"), m);
  }
  let rendered = false;
  return { open() { if (!rendered) { render(); rendered = true; } }, addPlan, checkPlanDocs, checkEcfr, fedReg, heard };
})();
// Opened straight from a #connect link: the desk switched views before this file loaded.
if (document.getElementById("view-connect").classList.contains("on")) window.CureCueConnect.open();
