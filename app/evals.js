/* Test console. Everything here is computed in the page from rules.js, eval/golden.js and eval/judge.js, the same files CI runs. Plain words throughout. */
(function () {
const R = window.CureCueRules, G = window.CureCueGolden, J = window.CureCueJudge;
const $ = id => document.getElementById(id);
const pct = x => Math.round(x * 100) + "%";
const RUNS = R.RELEASES.map(rel => ({ rel, ...R.score(G, rel) }));
const COMMIT = { 1: "86a0594", 2: "dbbe135", 3: "97c8de2" }; // the commit each release landed in
const NOTE = { 1: "Flags appeals, denials, grievances and complaints.", 2: "Also flags discharge disputes, chest pain, trouble breathing and refusals to pay.", 3: "Also flags the same things in Spanish and through interpreters, more emergency phrasings, and members telling it what to say." };
// Plain names for the eight checks, the groups, the responses and the kinds of mistake
const CHECK = { escalation_recall: "Supervisor calls flagged", escalation_precision: "Flags that were right", hallucination_rate: "Unbacked dollar amounts", citation_accuracy: "Right plan rule used", routing_accuracy: "Sent to the right place", grievance_recall_min_register: "Unhappy members noticed (worst tone)", recall_gap_lang: "Gap between languages", verdicts_outside_enum: "Responses outside the three allowed" };
const MUST = { escalation_recall: "at least 97%", escalation_precision: "at least 85%", hallucination_rate: "none", citation_accuracy: "at least 92%", routing_accuracy: "at least 95%", grievance_recall_min_register: "at least 88% for every tone", recall_gap_lang: "under 5 points", verdicts_outside_enum: "none" };
const LN = { en: "English", es: "Spanish", interp: "Through an interpreter" }, TONE = { plain: "Calm", implicit: "Indirect", angry: "Angry" }, SRC = { hand: "Written with the rules", adversarial: "Written to trick it", hard: "New, written after Release 3" };
const VERB = { answer: "Answer from a plan rule", human: "Leave to the advocate", escalate: "Hand to a supervisor" };
const MISTAKE = { "missed escalation": "missed a supervisor call", "over-escalation": "called a supervisor needlessly", "missed dissatisfaction": "missed an unhappy member", "wrong clause": "wrong plan rule", "no answer where a rule applies": "didn't answer a plan question", "answered an account or out-of-plan question": "answered what it shouldn't", "figure off path": "unbacked dollar amount" };
const RULE = Object.fromEntries(Object.values(R.GRAPH.nodes).filter(n => n.id).map(n => [n.id, n.label]));
const fmt = (k, v, drafted) => k === "hallucination_rate" ? String(Math.round(v * drafted)) : k === "recall_gap_lang" ? Math.round(v * 100) + " pts" : k === "verdicts_outside_enum" ? String(v) : pct(v);
const say = (v, c, g) => `${VERB[v]}${c ? ` <span class="small">(${RULE[c] || c})</span>` : ""}${g ? " · member unhappy" : ""}`;
let sel = R.CURRENT_RELEASE, cmpA = 2, cmpB = R.CURRENT_RELEASE, failFilter = "all", failRel = R.CURRENT_RELEASE;
const pill = (ok, t) => `<span class="pill ${ok ? "good" : "bad"}">${t}</span>`;
const gateRow = (g, r) => `<tr><td>${CHECK[g.metric] || g.name}</td><td class="num"><b>${fmt(g.metric, g.value, r.metrics.drafted)}</b></td><td>${MUST[g.metric] || g.must}</td><td>${pill(g.pass, g.pass ? "pass" : "fails")}</td></tr>`;

function tab(t) { ["runs", "detail", "compare", "failures", "dataset", "judge"].forEach(x => $("ev-" + x).classList.toggle("on", x === t)); document.querySelectorAll("#evtabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.ev === t))); }
document.querySelectorAll("#evtabs button").forEach(b => b.onclick = () => tab(b.dataset.ev));

// ---------- Releases ----------
function renderRuns() {
  $("ev-runs-body").innerHTML = RUNS.slice().reverse().map(r => `<tr class="${r.rel === sel ? "sel" : ""}"><td><b>Release ${r.rel}</b>${r.rel === R.CURRENT_RELEASE ? ' <span class="pill good">in use</span>' : ""}</td><td><code>${COMMIT[r.rel] || ""}</code></td><td class="num">${pct(r.metrics.escalation_recall)}</td><td class="num">${pct(r.metrics.citation_accuracy)}</td><td class="num">${pct(r.metrics.routing_accuracy)}</td><td class="num">${r.rows.filter(e => !e.ok).length}</td><td>${r.failed ? pill(false, "fails " + r.failed + " of " + r.gates.length + " checks") : pill(true, "passes all " + r.gates.length + " checks")}</td><td><button class="btn sm" data-open="${r.rel}">Open</button></td></tr>`).join("");
  $("ev-runs-note").textContent = `Each row is one version of CureCue's rules, re-tested on today's ${G.length} test lines. At the time, Release 1 failed its first test (24 English lines) and was never used, and Release 2 passed it. Both fail today's bigger test. Advocates use Release ${R.CURRENT_RELEASE}. The test lines are made up and were written by one person.`;
  document.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { sel = Number(b.dataset.open); renderDetail(); renderRuns(); tab("detail"); });
}
// ---------- Release detail ----------
function renderDetail() {
  const r = RUNS.find(x => x.rel === sel); const m = r.metrics; const wrong = r.rows.filter(e => !e.ok).length;
  $("ev-detail-title").textContent = `Release ${sel} · ${G.length} test lines · commit ${COMMIT[sel] || ""}`;
  $("ev-detail-note").textContent = NOTE[sel] || "";
  $("ev-gates").innerHTML = r.gates.map(g => gateRow(g, r)).join("");
  $("ev-sum").innerHTML = r.failed ? `${pill(false, "stopped")} Fails ${r.failed} of ${r.gates.length} checks.${r.missed.length ? ` Missed ${r.missed.length} supervisor call${r.missed.length > 1 ? "s" : ""}.` : ""}` : `${pill(true, "passes")} Passes all ${r.gates.length} checks, but still gets ${wrong} line${wrong === 1 ? "" : "s"} wrong. The "new, written after Release 3" row below is the most honest number.`;
  $("ev-tiles").innerHTML = [["Supervisor calls flagged", `${Math.round(m.escalation_recall * m.escalations)} of ${m.escalations}`, m.escalation_recall < .97], ["Flags that were right", pct(m.escalation_precision), m.escalation_precision < .85], ["Right plan rule used", pct(m.citation_accuracy), m.citation_accuracy < .92], ["Sent to the right place", pct(m.routing_accuracy), m.routing_accuracy < .95], ["Unbacked dollar amounts", String(Math.round(m.hallucination_rate * m.drafted)), m.hallucination_rate > 0], ["No suggested answer", pct(m.abstention_rate), false], ["Lines fully right", pct(m.task_success), false]].map(([l, v, bad]) => `<div class="tile"><div class="n" style="color:${bad ? 'var(--bad)' : 'var(--good)'}">${v}</div><div class="l">${l}</div></div>`).join("");
  const sliceTable = (title, sl, key, names) => `<h3 style="margin-top:14px">${title}</h3><div class="tscroll"><table class="slices"><thead><tr><th>${key}</th><th>lines</th><th>supervisor calls flagged</th><th>unhappy members noticed</th><th>right plan rule</th><th>right place</th></tr></thead><tbody>${Object.entries(sl).map(([k, s]) => `<tr><td><b>${names[k] || k}</b></td><td class="num">${s.rows}</td><td class="num ${s.escalations && s.escalation_recall < 1 ? "bad" : ""}">${s.escalations ? pct(s.escalation_recall) : "none"}</td><td class="num ${s.grievance_recall < .9 ? "bad" : ""}">${pct(s.grievance_recall)}</td><td class="num ${s.citation_accuracy < .95 ? "bad" : ""}">${pct(s.citation_accuracy)}</td><td class="num ${s.routing_accuracy < .95 ? "bad" : ""}">${pct(s.routing_accuracy)}</td></tr>`).join("")}</tbody></table></div>`;
  $("ev-slices").innerHTML = sliceTable("By language", r.slices.lang, "language", LN) + sliceTable("By tone", r.slices.register, "tone", TONE) + sliceTable("Lines it was built with, versus new lines", r.slices.source, "group", SRC);
  $("ev-detail-fail").onclick = () => { failRel = sel; renderFailures(); tab("failures"); };
}
// ---------- Compare ----------
function renderCompare() {
  const A = RUNS.find(x => x.rel === cmpA), B = RUNS.find(x => x.rel === cmpB);
  $("cmpA").innerHTML = RUNS.map(r => `<option value="${r.rel}" ${r.rel === cmpA ? "selected" : ""}>Release ${r.rel}</option>`).join("");
  $("cmpB").innerHTML = RUNS.map(r => `<option value="${r.rel}" ${r.rel === cmpB ? "selected" : ""}>Release ${r.rel}</option>`).join("");
  const keys = [["escalation_recall", "Supervisor calls flagged"], ["escalation_precision", "Flags that were right"], ["citation_accuracy", "Right plan rule used"], ["routing_accuracy", "Sent to the right place"], ["hallucination_rate", "Unbacked dollar amounts (share of answers)"], ["abstention_rate", "No suggested answer"], ["task_success", "Lines fully right"]];
  $("ev-cmp-body").innerHTML = keys.map(([k, l]) => { const a = Math.round(A.metrics[k] * 100), b = Math.round(B.metrics[k] * 100), d = b - a; const better = k === "hallucination_rate" ? d < 0 : k === "abstention_rate" ? null : d > 0; return `<tr><td>${l}</td><td class="num">${a}%</td><td class="num">${b}%</td><td class="num ${better === null ? "" : better ? "good" : d === 0 ? "" : "bad"}">${d === 0 ? "same" : (d > 0 ? "+" : "") + d + " pts"}</td></tr>`; }).join("");
  const fixed = A.rows.filter(e => !e.ok).filter(e => B.rows.find(x => x.id === e.id).ok), broke = B.rows.filter(e => !e.ok).filter(e => A.rows.find(x => x.id === e.id).ok);
  const plain = e => e.fail.map(c => MISTAKE[c] || c).join(", ");
  $("ev-cmp-rows").innerHTML = `<h3 style="margin-top:14px">Lines Release ${cmpB} fixed (${fixed.length})</h3>` + (fixed.length ? `<ul class="turns">${fixed.map(e => `<li><span class="pill good">fixed</span> "${e.t}" <span class="small">· was: ${plain(e)}</span></li>`).join("")}</ul>` : `<p class="small">None.</p>`) + `<h3 style="margin-top:14px">Lines Release ${cmpB} broke (${broke.length})</h3>` + (broke.length ? `<ul class="turns">${broke.map(e => `<li><span class="pill bad">broke</span> "${e.t}" <span class="small">· now: ${plain(e)}</span></li>`).join("")}</ul>` : `<p class="small">None.</p>`);
  $("cmpA").onchange = e => { cmpA = Number(e.target.value); renderCompare(); }; $("cmpB").onchange = e => { cmpB = Number(e.target.value); renderCompare(); };
}
// ---------- Mistakes ----------
const firstFixed = id => { const rel = RUNS.find(r => r.rows.find(x => x.id === id).ok); return rel ? rel.rel : null; };
function renderFailures() {
  const r = RUNS.find(x => x.rel === failRel);
  const all = r.rows.filter(e => !e.ok);
  // An over-escalated plan question is shown as one mistake, not also as "didn't answer"
  const shown = e => e.fail.filter(c => !(c === "no answer where a rule applies" && e.fail.includes("over-escalation")));
  const classes = {}; all.forEach(e => shown(e).forEach(c => { classes[c] = (classes[c] || 0) + 1; }));
  $("ev-fail-rel").innerHTML = RUNS.map(x => `<option value="${x.rel}" ${x.rel === failRel ? "selected" : ""}>Release ${x.rel}</option>`).join("");
  $("ev-fail-rel").onchange = e => { failRel = Number(e.target.value); failFilter = "all"; renderFailures(); };
  $("ev-fail-classes").innerHTML = [`<button class="btn sm ${failFilter === "all" ? "primary" : ""}" data-fc="all">all (${all.length})</button>`].concat(Object.entries(classes).map(([c, n]) => `<button class="btn sm ${failFilter === c ? "primary" : ""}" data-fc="${c}">${MISTAKE[c] || c} (${n})</button>`)).join(" ");
  document.querySelectorAll("[data-fc]").forEach(b => b.onclick = () => { failFilter = b.dataset.fc; renderFailures(); });
  const list = failFilter === "all" ? all : all.filter(e => shown(e).includes(failFilter));
  $("ev-fail-body").innerHTML = list.length ? list.map(e => {
    const fx = firstFixed(e.id);
    const why = e.fail.includes("missed escalation") ? `None of Release ${failRel}'s trigger phrases matched this wording. The most serious kind of mistake.`
      : e.fail.includes("over-escalation") ? `Hearing "${e.actual.trigger}" made it call a supervisor, but the member didn't need one. A safe mistake, allowed in small numbers.`
      : e.fail.includes("missed dissatisfaction") ? `The member was unhappy but said it ${e.strata.register === "implicit" ? "indirectly" : "in a way it didn't recognise"}.`
      : e.fail.includes("wrong clause") ? `Answered from "${RULE[e.actual.c] || e.actual.c}" instead of "${RULE[e.expected.c] || e.expected.c}".`
      : e.fail.includes("no answer where a rule applies") ? "It didn't recognise the question, so the line fell to the advocate. Safe, but counted."
      : e.fail.includes("figure off path") ? "The suggested answer quoted a dollar amount that isn't in the plan rule it used."
      : "It answered a question no plan rule covers. It should have left it to the advocate.";
    const status = fx && fx > failRel ? pill(true, "fixed in Release " + fx) : fx === failRel ? "" : e.fail.every(c => c === "over-escalation" || c === "no answer where a rule applies") && e.fail.includes("over-escalation") ? `<span class="pill warn">open, allowed</span>` : `<span class="pill bad">open</span>`;
    return `<tr><td><div class="small">${LN[e.strata.lang]} · ${TONE[e.strata.register]}</div><div class="small">${SRC[e.strata.source]}</div></td><td>"${e.t}"</td><td>${say(e.expected.v, e.expected.c, e.expected.g)}</td><td>${say(e.actual.v, e.actual.c, e.actual.g)}</td><td>${shown(e).map(c => `<span class="pill ${c.startsWith("over") ? "warn" : "bad"}">${MISTAKE[c] || c}</span>`).join(" ")}<div class="small" style="margin-top:4px">${why}</div></td><td>${status}</td></tr>`;
  }).join("") : `<tr><td colspan="6" class="small">No mistakes in this release.</td></tr>`;
  $("ev-fail-note").textContent = `Release ${failRel} gets ${all.length} of ${G.length} lines wrong. A line counts as wrong if the response, the plan rule, the "member unhappy" note or a dollar amount differs from what was written down. "Fixed in" comes from re-running the line on each later release.`;
}
// ---------- Test lines ----------
function renderDataset() {
  const by = k => G.reduce((a, r) => { a[r[k]] = (a[r[k]] || 0) + 1; return a; }, {});
  const strata = [["v", "Right response", VERB], ["register", "Tone", TONE], ["lang", "Language", LN], ["source", "How it was written", SRC], ["reason", "Reason for the call", {}]];
  $("ev-ds-meta").textContent = `${G.length} lines a member might say, written by hand (not taken from real calls), each with the right response decided from the documents above on ${G.meta ? G.meta.labelled : ""}. The right responses were written without looking at what CureCue does.`;
  // The documents, and which plan rules each one supplies
  $("ev-ds-sources").innerHTML = `<div class="tscroll"><table class="slices"><thead><tr><th>Document</th><th>File</th><th>Used for</th></tr></thead><tbody>${Object.entries(R.SOURCES).map(([k, S]) => { const used = Object.values(R.GRAPH.nodes).filter(n => (n.src || []).some(x => x.doc === k)).map(n => { const x = n.src.find(y => y.doc === k); return `<a href="${S.url}${x.page ? "#page=" + x.page : ""}" target="_blank" rel="noopener">${n.label}${x.page ? ` <span class="small">p. ${x.page}</span>` : ""}</a>`; }); return `<tr><td><b>${S.title}</b>${S.pages ? `<div class="small">${S.pages} pages, public PDF</div>` : `<div class="small">public regulation</div>`}</td><td><a href="${S.url}" target="_blank" rel="noopener"><code>${S.code}</code></a></td><td>${used.join(" · ")}</td></tr>`; }).join("")}</tbody></table></div><p class="small" style="margin-top:6px">The plan is a 2026 Medicare Advantage HMO-POS plan. Members, calls and records in this prototype are fictional.</p>`;
  $("ev-ds-strata").innerHTML = strata.map(([k, l, names]) => `<div class="card" style="padding:12px 14px"><h3>${l}</h3>${Object.entries(by(k)).sort((a, b) => b[1] - a[1]).map(([n, c]) => `<div class="bar"><span>${names[n] || n}</span><i style="width:${Math.round(c / G.length * 100)}%"></i><b>${c}</b></div>`).join("")}</div>`).join("");
  const adj = G.filter(r => r.labels); const agree = adj.filter(r => r.labels.A.v === r.labels.B.v && !!r.labels.A.g === !!r.labels.B.g).length;
  const call = L => `${VERB[L.v]}${L.g ? " · unhappy" : ""}`;
  $("ev-ds-adj").innerHTML = `<p class="small">Made up to show how two people's disagreements would be settled; one person wrote both sides. These ${adj.length} lines agree ${pct(agree / adj.length)} of the time before settling. That is an illustration, not a measurement.</p><div class="tscroll"><table class="slices"><thead><tr><th>Line</th><th>Person A</th><th>Person B</th><th>Settled as</th></tr></thead><tbody>${adj.map(r => `<tr class="${r.labels.A.v === r.labels.B.v && !!r.labels.A.g === !!r.labels.B.g ? "" : "dis"}"><td>"${r.t}"</td><td>${call(r.labels.A)}</td><td>${call(r.labels.B)}</td><td><b>${call(r)}</b></td></tr>`).join("")}</tbody></table></div>`;
  const srcCell = r => { const x = r.src || {}; const S = x.doc ? R.SOURCES[x.doc] : null; return S ? `<a href="${S.url}${x.page ? "#page=" + x.page : ""}" target="_blank" rel="noopener">${S.title}${x.page ? ", p. " + x.page : ""}</a>${x.why ? `<div class="small">${x.why}</div>` : ""}` : `<span class="small">${x.why || ""}</span>`; };
  const browse = () => { const f = $("ev-ds-filter").value, q = $("ev-ds-q").value.trim().toLowerCase();
    const list = G.filter(r => (f === "all" || (f === "g" ? r.g : r.v === f)) && (!q || r.t.toLowerCase().includes(q)));
    $("ev-ds-browse").innerHTML = `<p class="small" style="margin:0 0 6px">${list.length} of ${G.length} lines</p><div class="tscroll"><table class="slices"><thead><tr><th>Line</th><th>Right response</th><th>Source</th><th>Group</th></tr></thead><tbody>${list.map(r => `<tr><td>"${r.t}"</td><td>${say(r.v, r.c, r.g)}</td><td>${srcCell(r)}</td><td class="small">${LN[r.lang]} · ${TONE[r.register]} · ${r.reason} · ${SRC[r.source]}</td></tr>`).join("")}</tbody></table></div>`; };
  $("ev-ds-filter").onchange = browse; $("ev-ds-q").oninput = browse; browse();
}
// ---------- Auto-grader ----------
function renderJudge() {
  const jv = J.validate(G);
  const JN = { citation_accuracy: "Was the right plan rule used?", grievance_recall: "Is the member unhappy?", routing_accuracy: "Answer, advocate, or supervisor?", escalation_recall: "Does this need a supervisor?" };
  $("ev-judge-body").innerHTML = jv.rows.map(x => `<tr><td><b>${JN[x.metric] || x.name}</b></td><td class="num">${x.agreement === null ? "—" : pct(x.agreement)}</td><td class="num">${x.n}</td><td>${x.policy === "never" ? '<span class="pill bad">never, by rule</span>' : x.allowed ? '<span class="pill good">would be</span>' : '<span class="pill warn">no</span>'}</td></tr>`).join("");
  $("ev-judge-note").textContent = `An automatic grader is only trusted where it marks like a person. It is compared with the written-down answers on every third line (${jv.heldOut} of ${G.length}); below ${pct(jv.threshold)} agreement it isn't used. Today's grader is a simple word list written by the same person as the test lines, so a real AI grader would agree less. None of the eight checks uses it yet. Supervisor calls are never left to a grader.`;
}
$("ev-runs-open-current").onclick = () => { sel = R.CURRENT_RELEASE; renderDetail(); tab("detail"); };
renderRuns(); renderDetail(); renderCompare(); renderFailures(); renderDataset(); renderJudge();
})();
