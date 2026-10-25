/* Eval console. Everything here is computed in the page from rules.js, eval/golden.js and eval/judge.js, the same files CI runs. */
(function () {
const R = window.CureCueRules, G = window.CureCueGolden, J = window.CureCueJudge;
const $ = id => document.getElementById(id);
const f2 = x => (typeof x === "number" ? (Number.isInteger(x) && x !== 0 && x !== 1 ? String(x) : x.toFixed(2)) : String(x));
const pct = x => Math.round(x * 100) + "%";
const RUNS = R.RELEASES.map(rel => ({ rel, ...R.score(G, rel) }));
const current = RUNS.find(r => r.rel === R.CURRENT_RELEASE);
const DATE = { 1: "86a0594", 2: "dbbe135", 3: "97c8de2" }; // the commit each release landed in
const NOTE = { 1: "Stop rule hears appeal, denied, grievance, complaint.", 2: "Adds discharge, distress, refusal to pay.", 3: "Adds Spanish and interpreter-path phrasings, clinical distress variants, instruction-in-speech patterns." };
let sel = R.CURRENT_RELEASE, cmpA = 2, cmpB = R.CURRENT_RELEASE, failFilter = "all", failRel = R.CURRENT_RELEASE;
const pill = (ok, t) => `<span class="pill ${ok ? "good" : "bad"}">${t}</span>`;
const gateRow = g => `<tr><td>${g.principle}</td><td>${g.name}</td><td class="num"><b>${f2(g.value)}</b></td><td>${g.must}</td><td>${pill(g.pass, g.pass ? "pass" : "blocked")}</td></tr>`;

function tab(t) { ["runs", "detail", "compare", "failures", "dataset", "judge"].forEach(x => $("ev-" + x).classList.toggle("on", x === t)); document.querySelectorAll("#evtabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.ev === t))); }
document.querySelectorAll("#evtabs button").forEach(b => b.onclick = () => tab(b.dataset.ev));

// ---------- Runs ----------
function renderRuns() {
  $("ev-runs-body").innerHTML = RUNS.slice().reverse().map(r => `<tr class="${r.rel === sel ? "sel" : ""}"><td><b>Release ${r.rel}</b>${r.rel === R.CURRENT_RELEASE ? ' <span class="pill good">on the desk</span>' : ""}</td><td>${DATE[r.rel] || ""}</td><td>${G.meta ? G.meta.version : ""} · ${G.length} turns</td><td class="num">${f2(r.metrics.escalation_recall)}</td><td class="num">${f2(r.metrics.citation_accuracy)}</td><td class="num">${f2(r.metrics.routing_accuracy)}</td><td class="num">${r.rows.filter(e => !e.ok).length}</td><td>${r.failed ? pill(false, r.failed + " gate" + (r.failed > 1 ? "s" : "") + " fail today") : pill(true, "all gates pass")}</td><td><button class="btn sm" data-open="${r.rel}">Open</button></td></tr>`).join("");
  $("ev-runs-note").textContent = `Each row is a release of rules.js scored against the same golden set. Releases 1 and 2 are kept so they can be re-scored. In history, Release 1 was blocked on the original 24-turn English set and Release 2 passed it; both fail today's set. The desk runs Release ${R.CURRENT_RELEASE}. Synthetic turns, written and labelled by one author.`;
  document.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { sel = Number(b.dataset.open); renderDetail(); renderRuns(); tab("detail"); });
}
// ---------- Run detail ----------
function renderDetail() {
  const r = RUNS.find(x => x.rel === sel); const m = r.metrics;
  $("ev-detail-title").textContent = `Release ${sel} · ${G.length} turns · ${DATE[sel] || ""}`;
  $("ev-detail-note").textContent = NOTE[sel] || "";
  $("ev-gates").innerHTML = r.gates.map(gateRow).join("");
  $("ev-sum").innerHTML = r.failed ? `${pill(false, "blocked")} ${r.failed} gate${r.failed > 1 ? "s" : ""} missed. ${r.missed.length ? r.missed.length + " escalation" + (r.missed.length > 1 ? "s" : "") + " missed." : ""}` : `${pill(true, "passes")} Every gate passes. ${r.rows.filter(e => !e.ok).length} turn${r.rows.filter(e => !e.ok).length === 1 ? "" : "s"} still fail inside the gates' budgets; read the hard set row under By source as the unseen number.`;
  $("ev-tiles").innerHTML = [["Escalations caught", f2(m.escalation_recall), m.escalation_recall < .97], ["Escalation precision", f2(m.escalation_precision), m.escalation_precision < .85], ["Right rule cited", f2(m.citation_accuracy), m.citation_accuracy < .92], ["Right owner (routing)", f2(m.routing_accuracy), m.routing_accuracy < .95], ["Figures off the path", String(Math.round(m.hallucination_rate * m.drafted)), m.hallucination_rate > 0], ["No draft offered", pct(m.abstention_rate), false], ["Turns fully right", f2(m.task_success), false]].map(([l, v, bad]) => `<div class="tile"><div class="n" style="color:${bad ? 'var(--bad)' : 'var(--good)'}">${v}</div><div class="l">${l}</div></div>`).join("");
  const sliceTable = (title, sl, key) => `<h3 style="margin-top:14px">${title}</h3><div class="tscroll"><table class="slices"><thead><tr><th>${key}</th><th>turns</th><th>escalations caught</th><th>dissatisfaction heard</th><th>right rule cited</th><th>routing</th></tr></thead><tbody>${Object.entries(sl).map(([k, s]) => `<tr><td><b>${k}</b></td><td class="num">${s.rows}</td><td class="num ${s.escalations && s.escalation_recall < 1 ? "bad" : ""}">${s.escalations ? f2(s.escalation_recall) : "n/a"}</td><td class="num ${s.grievance_recall < .9 ? "bad" : ""}">${f2(s.grievance_recall)}</td><td class="num ${s.citation_accuracy < .95 ? "bad" : ""}">${f2(s.citation_accuracy)}</td><td class="num ${s.routing_accuracy < .95 ? "bad" : ""}">${f2(s.routing_accuracy)}</td></tr>`).join("")}</tbody></table></div>`;
  $("ev-slices").innerHTML = sliceTable("By language path", r.slices.lang, "language") + sliceTable("By register", r.slices.register, "register") + sliceTable("By source (hard set = written after Release 3)", r.slices.source, "source");
  $("ev-detail-fail").onclick = () => { failRel = sel; renderFailures(); tab("failures"); };
}
// ---------- Compare ----------
function renderCompare() {
  const A = RUNS.find(x => x.rel === cmpA), B = RUNS.find(x => x.rel === cmpB);
  $("cmpA").innerHTML = RUNS.map(r => `<option value="${r.rel}" ${r.rel === cmpA ? "selected" : ""}>Release ${r.rel}</option>`).join("");
  $("cmpB").innerHTML = RUNS.map(r => `<option value="${r.rel}" ${r.rel === cmpB ? "selected" : ""}>Release ${r.rel}</option>`).join("");
  const keys = [["escalation_recall", "Escalations caught"], ["escalation_precision", "Escalation precision"], ["citation_accuracy", "Right rule cited"], ["routing_accuracy", "Right owner (routing)"], ["hallucination_rate", "Figures off the path (rate)"], ["abstention_rate", "No draft offered (rate)"], ["task_success", "Turns fully right"]];
  $("ev-cmp-body").innerHTML = keys.map(([k, l]) => { const a = A.metrics[k], b = B.metrics[k], d = Math.round(b * 100) / 100 - Math.round(a * 100) / 100; const better = k === "hallucination_rate" ? d < 0 : k === "abstention_rate" ? null : d > 0; return `<tr><td>${l}</td><td class="num">${f2(a)}</td><td class="num">${f2(b)}</td><td class="num ${better === null ? "" : better ? "good" : d === 0 ? "" : "bad"}">${d === 0 ? "same" : (d > 0 ? "+" : "") + f2(d)}</td></tr>`; }).join("");
  const fixed = A.rows.filter(e => !e.ok).filter(e => B.rows.find(x => x.id === e.id).ok), broke = B.rows.filter(e => !e.ok).filter(e => A.rows.find(x => x.id === e.id).ok);
  $("ev-cmp-rows").innerHTML = `<h3 style="margin-top:14px">Turns fixed by Release ${cmpB} (${fixed.length})</h3>` + (fixed.length ? `<ul class="turns">${fixed.map(e => `<li><span class="pill good">fixed</span> <b>${e.id}</b> ${e.t} <span class="small">· was: ${e.fail.join(", ")}</span></li>`).join("")}</ul>` : `<p class="small">None.</p>`) + `<h3 style="margin-top:14px">Turns broken by Release ${cmpB} (${broke.length})</h3>` + (broke.length ? `<ul class="turns">${broke.map(e => `<li><span class="pill bad">regressed</span> <b>${e.id}</b> ${e.t} <span class="small">· now: ${e.fail.join(", ")}</span></li>`).join("")}</ul>` : `<p class="small">None. A release that fixes turns and breaks none is the only kind that promotes.</p>`);
  $("cmpA").onchange = e => { cmpA = Number(e.target.value); renderCompare(); }; $("cmpB").onchange = e => { cmpB = Number(e.target.value); renderCompare(); };
}
// ---------- Failures ----------
const firstFixed = id => { const rel = RUNS.find(r => r.rows.find(x => x.id === id).ok); return rel ? rel.rel : null; };
function renderFailures() {
  const r = RUNS.find(x => x.rel === failRel);
  const all = r.rows.filter(e => !e.ok);
  const classes = {}; all.forEach(e => e.fail.forEach(c => { classes[c] = (classes[c] || 0) + 1; }));
  $("ev-fail-rel").innerHTML = RUNS.map(x => `<option value="${x.rel}" ${x.rel === failRel ? "selected" : ""}>Release ${x.rel}</option>`).join("");
  $("ev-fail-rel").onchange = e => { failRel = Number(e.target.value); failFilter = "all"; renderFailures(); };
  $("ev-fail-classes").innerHTML = [`<button class="btn sm ${failFilter === "all" ? "primary" : ""}" data-fc="all">all (${all.length})</button>`].concat(Object.entries(classes).map(([c, n]) => `<button class="btn sm ${failFilter === c ? "primary" : ""}" data-fc="${c}">${c} (${n})</button>`)).join(" ");
  document.querySelectorAll("[data-fc]").forEach(b => b.onclick = () => { failFilter = b.dataset.fc; renderFailures(); });
  const list = failFilter === "all" ? all : all.filter(e => e.fail.includes(failFilter));
  $("ev-fail-body").innerHTML = list.length ? list.map(e => { const fx = firstFixed(e.id); const why = e.fail.includes("missed escalation") ? `No stop pattern in Release ${failRel} matched this phrasing.` : e.fail.includes("over-escalation") ? `"${e.actual.trigger}" matched a stop pattern; the human label says the turn did not need a person. Over-escalation is the safe failure and is budgeted, not banned.` : e.fail.includes("missed dissatisfaction") ? "No dissatisfaction pattern matched; the register is " + e.strata.register + "." : e.fail.includes("wrong clause") ? `Retrieval entered at ${e.actual.c} instead of ${e.expected.c}.` : e.fail.includes("no answer where a rule applies") ? "No entry pattern matched, so the turn fell to the advocate." : e.fail.includes("figure off path") ? "A figure in the draft is not on any node of the cited path." : "Answered a question that should have gone to the claim system or the advocate."; return `<tr><td><b>${e.id}</b><div class="small">${e.strata.lang} · ${e.strata.register} · ${e.strata.source}</div></td><td>${e.t}</td><td>${e.expected.v}${e.expected.c ? " · " + e.expected.c : ""}${e.expected.g ? " · grievance" : ""}</td><td>${e.actual.v}${e.actual.c ? " · " + e.actual.c : ""}${e.actual.g ? " · grievance" : ""}${e.actual.trigger ? `<div class="small">trigger "${e.actual.trigger}"</div>` : ""}</td><td>${e.fail.map(c => `<span class="pill ${c.startsWith("over") ? "warn" : "bad"}">${c}</span>`).join(" ")}<div class="small" style="margin-top:4px">${why}</div></td><td>${fx && fx > failRel ? pill(true, "fixed in Release " + fx) : fx === failRel ? "" : e.fail.every(c => c === "over-escalation" || c === "no answer where a rule applies") && e.fail.includes("over-escalation") ? `<span class="pill warn">open, budgeted</span>` : `<span class="pill bad">open</span>`}</td></tr>`; }).join("") : `<tr><td colspan="6" class="small">No failing turns in this release.</td></tr>`;
  $("ev-fail-note").textContent = `Release ${failRel}: ${all.length} of ${G.length} turns fail. A turn fails when the verdict, the clause, the dissatisfaction flag or a figure disagrees with the human label. "Fixed in" is computed by re-running the turn against each later release.`;
}
// ---------- Dataset ----------
function renderDataset() {
  const by = k => G.reduce((a, r) => { a[r[k]] = (a[r[k]] || 0) + 1; return a; }, {});
  const strata = [["v", "Expected verdict"], ["register", "Register"], ["lang", "Language path"], ["source", "Source"], ["reason", "Call reason"]];
  $("ev-ds-meta").textContent = `${G.meta ? G.meta.version : "golden"} · ${G.length} turns · labelled ${G.meta ? G.meta.labelled : ""} · schema: ${G.meta ? G.meta.schema.join(", ") : ""}`;
  $("ev-ds-strata").innerHTML = strata.map(([k, l]) => `<div class="card" style="padding:12px 14px"><h3>${l}</h3>${Object.entries(by(k)).sort((a, b) => b[1] - a[1]).map(([n, c]) => `<div class="bar"><span>${n}</span><i style="width:${Math.round(c / G.length * 100)}%"></i><b>${c}</b></div>`).join("")}</div>`).join("");
  const adj = G.filter(r => r.labels); const agree = adj.filter(r => r.labels.A.v === r.labels.B.v && !!r.labels.A.g === !!r.labels.B.g).length;
  $("ev-ds-adj").innerHTML = `<p class="small">Simulated: one author wrote both labellers' calls for these ${adj.length} turns to show what adjudication looks like. Agreement before adjudication: <b>${(agree / adj.length).toFixed(2)}</b>, illustrative, not measured. Labeller tags on other rows alternate, and plan type rotates, so neither is reported as a slice.</p><div class="tscroll"><table class="slices"><thead><tr><th>Turn</th><th>Labeller A</th><th>Labeller B</th><th>Adjudicated</th></tr></thead><tbody>${adj.map(r => `<tr class="${r.labels.A.v === r.labels.B.v && !!r.labels.A.g === !!r.labels.B.g ? "" : "dis"}"><td>${r.t}</td><td>${r.labels.A.v}${r.labels.A.g ? " · grievance" : ""}</td><td>${r.labels.B.v}${r.labels.B.g ? " · grievance" : ""}</td><td><b>${r.v}${r.g ? " · grievance" : ""}</b></td></tr>`).join("")}</tbody></table></div>`;
  $("ev-ds-browse").innerHTML = `<div class="tscroll"><table class="slices"><thead><tr><th>Id</th><th>Turn</th><th>Expected</th><th>Strata</th></tr></thead><tbody>${G.map(r => `<tr><td>${r.id}</td><td>${r.t}</td><td>${r.v}${r.c ? " · " + r.c : ""}${r.g ? " · grievance" : ""}</td><td class="small">${r.lang} · ${r.register} · ${r.reason} · ${r.source}</td></tr>`).join("")}</tbody></table></div>`;
}
// ---------- Judge ----------
function renderJudge() {
  const jv = J.validate(G);
  $("ev-judge-body").innerHTML = jv.rows.map(x => `<tr><td><b>${x.name}</b></td><td class="num">${x.agreement === null ? "n/a" : f2(x.agreement)}</td><td class="num">${x.n}</td><td>${x.policy === "never" ? '<span class="pill bad">never, by policy</span>' : x.allowed ? '<span class="pill good">would be allowed</span>' : '<span class="pill warn">refused</span>'}</td></tr>`).join("");
  $("ev-judge-note").textContent = `Held-out slice: every third turn, ${jv.heldOut} of ${G.length}. Threshold ${jv.threshold}. In this prototype the judge is a word-list scorer that shares no code with the rules, written by the same author as the golden set, so its agreement overstates a real judge's. No gate reads it today; every gate is scored against the labels directly. In production it is a model under the same validation: agreement with people per metric, a gate only where it clears, refusals printed. The escalation decision is never given to a judge, whatever the agreement.`;
}
$("ev-runs-open-current").onclick = () => { sel = R.CURRENT_RELEASE; renderDetail(); tab("detail"); };
renderRuns(); renderDetail(); renderCompare(); renderFailures(); renderDataset(); renderJudge();
})();
