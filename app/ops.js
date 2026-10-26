/* Operations screens: Supervisor (escalations waiting, the team), QA review (sampled calls scored against the note
   checklist), Audit (every cue and action with its rule and page, case deadlines from the plan's Evidence of Coverage,
   export). Everything reads the same state the advocate desk writes; the team roster and its statuses are demo data. */
window.CureCueOps = (function () {
  const R = window.CureCueRules, G = R.GRAPH, D = window.CureCueData;
  const $ = id => document.getElementById(id);
  const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const desk = () => window.CureCueDesk;
  const hhmm = d => d.toTimeString().slice(0, 5);
  const today = new Date(D.TODAY + "T12:00:00");
  const dateOf = off => { const d = new Date(today); d.setDate(d.getDate() + off); return d; };
  const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const srcLink = (x, label) => { const S = R.SOURCES[x.doc]; const href = /\.pdf$/.test(S.file) ? `../${S.file}#page=${x.page}` : S.url; return `<a href="${href}" target="_blank" rel="noopener">${label || `${x.doc} p. ${x.page}`}</a>`; };

  // ---------- Supervisor ----------
  // Demo roster: the advocates who appear in the contact history. Only Nik's status is live; the rest are illustrative.
  const TEAM = [["Nik J.", null], ["T. Brooks", ["On call", "Claims and billing", "6:12"]], ["J. Alvarez", ["Wrap-up", "Appeal status", "1:05"]], ["R. Chen", ["Ready", "", ""]]];
  function renderSupervise() {
    const S = desk().state; const waiting = S.escalated && !S.transferred;
    $("sup-queue").innerHTML = waiting
      ? `<div class="item urgent"><div class="av">RM</div><div><b>Nik J. · Rosa M. · discharge dispute</b><div class="why">Cue stopped on "sending her home". Her mother's skilled nursing coverage ends ${fmt(dateOf(2))}; a fast-track appeal is due by noon ${fmt(dateOf(1))}.</div></div><div class="act"><button class="btn sm primary" id="sup-join">Join call</button></div></div>`
      : S.transferred ? `<div class="item"><div class="av">RM</div><div><b>You joined Rosa M.'s call</b><div class="why">${S.appealCase ? `Fast-track appeal filed; case ${S.appealCase}.` : "On the call now."}</div></div><div class="act"><span class="pill good">handled</span></div></div>`
      : `<p class="small">No escalations waiting. When Cue stops a call, it appears here with what was heard.</p>`;
    const j = $("sup-join"); if (j) j.onclick = () => { const b = [...document.querySelectorAll("#cues .cue.stop .main")].find(x => !x.disabled && !x.classList.contains("done")); if (b) b.click(); desk().show("desk"); };
    const live = S.ended ? ["Wrap-up", "Claims and billing", ""] : S.escalated || S.supStarted ? ["On call", "Claims and billing · escalated", ""] : document.getElementById("stt").textContent === "On call" ? ["On call", "Claims and billing", ""] : [document.getElementById("stt").textContent, "", ""];
    $("sup-team").innerHTML = `<div class="tscroll"><table class="slices"><thead><tr><th>Advocate</th><th>Status</th><th>Call</th><th>Time</th></tr></thead><tbody>${TEAM.map(([n, st]) => { const v = st || live; return `<tr><td><b>${n}</b>${st ? "" : ' <span class="pill good">live</span>'}</td><td>${v[0]}</td><td>${v[1]}</td><td>${v[2]}</td></tr>`; }).join("")}</tbody></table></div><p class="small" style="margin-top:6px">Nik's row follows the desk. The other advocates are demo data.</p>`;
    const open = D.cases.filter(k => k.status === "open").map(k => ({ k, due: k.opened + k.days })).sort((a, b) => a.due - b.due);
    $("sup-cases").innerHTML = `<div class="tscroll"><table class="slices"><thead><tr><th>Case</th><th>Member</th><th>Type</th><th>Owner</th><th>Due</th></tr></thead><tbody>${open.map(({ k, due }) => `<tr><td><b>${k.id}</b><div class="small">${esc(k.subject)}</div></td><td>${desk().member(k.member).short}</td><td>${R.DEADLINES[k.kind] ? R.DEADLINES[k.kind].label : k.type}</td><td>${k.owner}</td><td class="${due <= 5 ? "bad" : ""}">${k.clock || `${fmt(dateOf(due))} · ${due} day${due === 1 ? "" : "s"}`}</td></tr>`).join("")}</tbody></table></div>`;
  }

  // ---------- QA review ----------
  const ELEMENTS = [["identity", "Identity verified before any account detail"], ["figuresSourced", "Every figure quoted came from a plan rule"], ["grievance", "Dissatisfaction recognised and a grievance decision recorded"], ["appealRights", "Appeal or fast-track rights given when coverage was disputed"], ["callbackDated", "Any callback promised has a date"], ["noteComplete", "Note says what was asked, what was answered and what is open"]];
  const reviews = {};
  function sampled() {
    const calls = desk().dayCalls().filter(c => c.qa);
    return calls.map(c => {
      if (c.now) { const S = desk().state; return { ...c, note: $("note").value, elements: { identity: true, figuresSourced: S.figures.length ? S.figures.every(f => f.onPath) : true, grievance: S.grievanceHeard ? S.grievance !== null : null, appealRights: S.escalated ? !!S.appealCase : null, callbackDated: !!S.callback, noteComplete: !!$("note").value } }; }
      return c; });
  }
  function renderQa() {
    const list = sampled();
    $("qa-list").innerHTML = list.length ? list.map((c, i) => { const m = desk().member(c.member); const e = c.elements || {}; const app = ELEMENTS.filter(([k]) => e[k] !== null && e[k] !== undefined); const met = app.filter(([k]) => e[k]).length; const r = reviews[c.time + c.member];
      return `<div class="qacall"><div class="qahead"><b>${c.time} · ${m.short} · ${c.reason}</b><span class="pill ${met === app.length ? "good" : "warn"}">${met} of ${app.length} elements</span>${r ? `<span class="pill good">reviewed: ${r.score}</span>` : ""}</div>
        <p class="small" style="margin:6px 0">${esc(c.note || "")}</p>
        <ul class="checks">${ELEMENTS.map(([k, l]) => e[k] === null || e[k] === undefined ? `<li class="small" style="color:var(--muted)">— ${l} (not applicable)</li>` : `<li class="${e[k] ? "good" : "bad"}">${e[k] ? "✓" : "✗"} ${l}</li>`).join("")}</ul>
        ${r ? `<p class="small">Reviewer note: ${esc(r.comment || "none")}</p>` : `<form class="ctrl" data-qa="${i}"><select style="max-width:180px"><option>Meets standard</option><option>Coaching needed</option><option>Escalate to QA lead</option></select><input type="text" placeholder="Reviewer note" style="max-width:280px"><button class="btn sm primary">Record review</button></form>`}</div>`; }).join("")
      : `<p class="small">No sampled calls yet.</p>`;
    document.querySelectorAll("[data-qa]").forEach(f => f.onsubmit = e => { e.preventDefault(); const c = list[+f.dataset.qa]; const score = f.querySelector("select").value, comment = f.querySelector("input").value; reviews[c.time + c.member] = { score, comment }; desk().audit("qa", "QA reviewer", `Reviewed the ${c.time} call (${desk().member(c.member).short}): ${score}${comment ? ". " + comment : ""}`); renderQa(); });
    $("qa-meta").textContent = `${list.length} of ${desk().dayCalls().length} calls today are sampled. Calls with a grievance or an escalation are always sampled; the rest are picked at random.`;
  }

  // ---------- Audit ----------
  let filter = "all";
  function rowsFor() { return desk().AUDIT.filter(a => filter === "all" || a.type === filter).slice().reverse(); }
  function renderAudit() {
    const A = desk().AUDIT, counts = {}; A.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
    const LBL = { cue: "Cue suggestions", action: "Actions by people", note: "Notes", qa: "QA reviews", check: "Source checks", system: "Overnight run" };
    $("aud-filter").innerHTML = [`<button class="btn sm ${filter === "all" ? "primary" : ""}" data-af="all">All (${A.length})</button>`].concat(Object.keys(LBL).filter(k => counts[k]).map(k => `<button class="btn sm ${filter === k ? "primary" : ""}" data-af="${k}">${LBL[k]} (${counts[k]})</button>`)).join(" ");
    document.querySelectorAll("[data-af]").forEach(b => b.onclick = () => { filter = b.dataset.af; renderAudit(); });
    $("aud-body").innerHTML = rowsFor().map(a => `<tr><td class="small">${fmt(a.at)} ${hhmm(a.at)}</td><td>${esc(a.actor)}</td><td>${esc(a.summary)}</td><td class="small">${a.rules.join(" → ")}${a.sources.length ? "<br>" + a.sources.filter((x, i, arr) => arr.findIndex(y => y.doc === x.doc && y.page === x.page) === i).map(x => srcLink(x)).join(" · ") : ""}</td><td class="small">${a.release}</td></tr>`).join("") || `<tr><td colspan="5" class="small">Nothing recorded yet.</td></tr>`;
    // Case deadlines, each tied to the page that sets it
    const cases = D.cases.slice().sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || (a.opened + a.days) - (b.opened + b.days));
    $("aud-cases").innerHTML = cases.map(k => { const dl = R.DEADLINES[k.kind]; const due = k.opened + k.days; return `<tr><td><b>${k.id}</b><div class="small">${esc(k.subject)}</div></td><td>${dl ? dl.label : k.type}</td><td>${fmt(dateOf(k.opened))}</td><td class="${k.status === "open" && due <= 5 ? "bad" : ""}">${k.clock || fmt(dateOf(due))}</td><td>${k.status === "open" ? `<span class="pill warn">open</span>` : `<span class="pill good">${k.status}</span>`}</td><td class="small">${dl ? `${dl.text} ${srcLink(dl.src[0])}` : ""}</td></tr>`; }).join("");
  }
  function exportAudit(kind) {
    const A = desk().AUDIT.map(a => ({ time: a.at.toISOString(), actor: a.actor, type: a.type, summary: a.summary, rules: a.rules.join(" "), sources: a.sources.map(x => `${x.doc} p.${x.page}`).join("; "), release: a.release }));
    const body = kind === "json" ? JSON.stringify(A, null, 2) : [Object.keys(A[0] || { time: "" }).join(","), ...A.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([body], { type: kind === "json" ? "application/json" : "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `curecue-audit-${D.TODAY}.${kind}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    desk().audit("action", "Nik J. (advocate)", `Exported the audit log as ${kind.toUpperCase()}`);
  }

  let current = null;
  function open(v) { current = v; if (v === "supervise") renderSupervise(); if (v === "qa") renderQa(); if (v === "audit") renderAudit(); }
  function changed() { if (current && document.getElementById("view-" + current) && document.getElementById("view-" + current).classList.contains("on")) open(current); }
  document.addEventListener("click", e => { const b = e.target.closest("[data-export]"); if (b) exportAudit(b.dataset.export); });
  return { open, changed };
})();
