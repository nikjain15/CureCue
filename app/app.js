/* CureCue advocate desk. Reads rules.js (decisions), data.js (the synthetic book of business) and voice.js (playback). */
(function () {
const R = window.CureCueRules, G = R.GRAPH, GOLDEN = window.CureCueGolden, D = window.CureCueData;
const $ = id => document.getElementById(id);
const TODAY = new Date(D.TODAY + "T12:00:00");
const dayDate = off => { const d = new Date(TODAY); d.setDate(d.getDate() + off); return d; };
const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtOff = off => fmt(dayDate(off));
const money = n => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 });
const initials = name => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
const member = id => D.members.find(m => m.id === id);
const relDay = off => off === 0 ? "today" : off === 1 ? "tomorrow" : off === -1 ? "yesterday" : off < 0 ? `${-off} days ago` : `in ${off} days`;
function toast(t) { const e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove("on"), 2800); }

// ---------- Views ----------
const TITLES = { home: ["Today", "Your briefing for Tue Oct 27"], desk: ["Live call", "Rosa M. · Medicare Advantage HMO-POS"], day: ["My day", "Calls, outcomes and QA for Tue Oct 27"], quality: ["Quality", "Every release tested before advocates use it"], loop: ["Improvement loop", "How Cue gets better, with two human sign-offs"], connect: ["Connections", "The sources Cue reads, and whether each is live"] };
function show(v) { ["home", "desk", "day", "quality", "loop", "connect"].forEach(x => $("view-" + x).classList.toggle("on", x === v)); document.querySelectorAll(".rail button[data-view]").forEach(b => { if (b.dataset.view === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }); $("title").textContent = TITLES[v][0]; $("crumb").textContent = TITLES[v][1]; window.scrollTo({ top: 0 }); if (v === "day") renderDay(); if (v === "connect" && window.CureCueConnect) CureCueConnect.open(); try { history.replaceState(null, "", v === "quality" ? "#evals" : v === "connect" ? "#connect" : location.pathname + location.search); } catch (e) {} }
document.querySelectorAll(".rail button[data-view]").forEach(b => b.onclick = () => show(b.dataset.view));
document.addEventListener("click", e => { const g = e.target.closest("[data-goto]"); if (g) { e.preventDefault(); show(g.dataset.goto); } });

// ---------- Home: Cue's briefing, computed from the data ----------
let cbDue, nearClock, likely, outcomes = null, closedCall = null; // outcomes and closedCall: what the last call left behind
function brief() { likely = computeLikely(); cbDue = D.contacts.filter(c => c.callback && c.callback.scheduled && c.callback.day === 0); nearClock = D.cases.filter(k => k.status === "open" && k.opened + k.days <= 7).sort((a, b) => (a.opened + a.days) - (b.opened + b.days)); }
function computeLikely() { return D.members.filter(m => { if (D.contacts.some(c => c.member === m.id && c.day === 0)) return false; const same = D.contacts.filter(c => c.member === m.id && c.day >= -30); const byReason = {}; same.forEach(c => { byReason[c.reason] = (byReason[c.reason] || 0) + 1; }); return Object.values(byReason).some(n => n >= 2) && same.some(c => c.callback && c.callback.promised && !c.callback.scheduled); }); }
brief();
const briefState = { cbDone: new Set() };
function item(m, why, acts, cls = "") { return `<div class="item ${cls}" data-m="${m.id}"><div class="av">${initials(m.name)}</div><div><b>${m.short} · ${m.plan}</b><div class="why">${why}</div></div><div class="act">${acts}</div></div>`; }
// Today's calls: the shift so far, plus Rosa's once it closes. Home, My day and the header all read this.
function dayCalls() { const calls = D.shift.map(s => ({ ...s, now: false })); if (closedCall) calls.push(closedCall); return calls; }
function dayStats() { const c = dayCalls(), mins = c.reduce((a, s) => a + s.minutes, 0); return { calls: c, n: c.length, aht: `${Math.floor(mins / c.length)}:${String(Math.round((mins / c.length % 1) * 60)).padStart(2, "0")}`, acc: c.reduce((a, s) => a + s.cues.accepted, 0), dec: c.reduce((a, s) => a + s.cues.declined, 0) }; }
function renderHome() {
  brief(); renderLastCall();
  const hr = new Date().getHours(); $("greet").textContent = `Good ${hr < 12 ? "morning" : hr < 17 ? "afternoon" : "evening"}, Nik. Here is what I found.`;
  $("briefmeta").textContent = `${cbDue.length} callbacks · ${nearClock.length} clocks · ${likely.length} likely repeat`;
  $("homen").textContent = cbDue.length + nearClock.length;
  $("cb").innerHTML = cbDue.map(c => { const m = member(c.member); const done = briefState.cbDone.has(c.member); return item(m, `Promised ${relDay(c.day)} about <mark>${c.reason.toLowerCase()}</mark>: ${c.note}.`, done ? `<span class="pill good">called</span>` : `<button class="btn sm primary" data-cb="${c.member}">Call now</button><span class="small">reason pre-filled</span>`, done ? "done" : ""); }).join("") || `<p class="small">None due today.</p>`;
  $("clock").innerHTML = nearClock.map(k => { const m = member(k.member); const left = k.opened + k.days; return item(m, `${k.type === "grievance" ? "Grievance" : "Appeal"} <strong>${k.id}</strong>: ${k.subject}. Opened ${relDay(k.opened)}, ${k.clock ? `<mark>${k.clock}</mark>` : `due <mark>${relDay(left)}</mark>`}. Owner: ${k.owner}.`, `<span class="pill ${left <= 5 ? "bad" : "warn"}">${k.clock ? k.clock : `${left} day${left === 1 ? "" : "s"} left`}</span>`, left <= 5 ? "urgent" : ""); }).join("");
  $("likely").innerHTML = likely.map(m => { const cs = D.contacts.filter(c => c.member === m.id && c.day >= -30); const promised = cs.find(c => c.callback && c.callback.promised && !c.callback.scheduled); const byReason = {}; cs.forEach(c => { byReason[c.reason] = (byReason[c.reason] || 0) + 1; }); const [reason, times] = Object.entries(byReason).sort((a, b) => b[1] - a[1])[0]; return item(m, `Called ${times} times in 30 days about ${reason.toLowerCase()}. On ${fmtOff(promised.day)} a callback was promised and <mark>never scheduled</mark>. If she calls, acknowledge both calls first.`, `<span class="pill warn">watch</span>`); }).join("") || `<p class="small">Nobody flagged.</p>`;
  $("coach").textContent = D.coaching;
  const st = dayStats();
  $("kpis").innerHTML = [[st.n, "calls so far"], [st.aht, "avg handle"], [`${st.acc}/${st.acc + st.dec}`, "cues accepted"]].map(([n, l]) => `<div class="kpi"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");
  $("handled").textContent = st.n; $("aht").textContent = st.aht;
  document.querySelectorAll("[data-cb]").forEach(b => b.onclick = () => { briefState.cbDone.add(b.dataset.cb); toast(`Dialling ${member(b.dataset.cb).short}. Reason and last note are on screen when they pick up. (Demo: outbound calls are not scripted.)`); renderHome(); });
}
renderHome();
// Cue's overnight log: every line is a computation over the data above, with the rows it read.
(function renderLog() {
  const open = D.cases.filter(k => k.status === "open");
  const rows = [
    ["05:40", `Re-checked ${open.length} open case clocks against today. ${nearClock.length} within 7 days, ${open.filter(k => k.opened + k.days <= 5).length} within 5. Nothing breached.`],
    ["05:41", `Read ${D.contacts.length} contacts from the last 90 days. ${D.contacts.filter(c => c.callback && c.callback.promised).length} carried a promised callback; ${cbDue.length} fall due today, ${D.contacts.filter(c => c.callback && c.callback.promised && !c.callback.scheduled).length} was never scheduled.`],
    ["05:41", `Flagged ${likely.length} member${likely.length === 1 ? "" : "s"} as likely to call back: two or more contacts on one reason in 30 days plus an unkept promise.`],
    ["05:42", `Tested release ${R.CURRENT_RELEASE} on the test lines: ${R.score(GOLDEN, R.CURRENT_RELEASE).failed ? "it failed a check and is stopped" : "it passed every check"}. Nothing changed overnight.`],
    ["05:42", "Drafted nothing for any member. Nothing above was sent anywhere."]];
  $("log").innerHTML = rows.map(([t, l]) => `<li><span class="t">${t}</span><span>${l}</span></li>`).join("");
  $("logmeta").textContent = `Overnight run · release ${R.CURRENT_RELEASE} · ${D.members.length} made-up members`;
})();

// ---------- Queue ----------
const QUEUE = [{ id: "M-001", reason: "billing question", wait: "0:04", ring: true }, { id: "M-002", reason: "appeal status", wait: "1:40" }, { id: "M-003", reason: "ID card", wait: "0:52" }];
$("qn").textContent = QUEUE.length;
function renderQueue() { $("queue").innerHTML = QUEUE.map((q, i) => { const m = member(q.id); const flags = D.contacts.filter(c => c.member === q.id && c.day >= -30).length; return `<div class="qcard ${q.ring ? "ring" : ""}" style="${i ? "opacity:.6" : ""}"><div class="av">${initials(m.name)}</div><div><b>${m.short}</b><div class="r">${m.plan} · ${q.reason} · ${flags ? flags + " contact" + (flags > 1 ? "s" : "") + " in 30 days" : "first contact"} · waiting ${q.wait}</div></div>${q.ring ? `<button class="btn primary" id="answer">Answer</button>` : ""}</div>`; }).join(""); $("qn").textContent = QUEUE.length; const a = $("answer"); if (a) a.onclick = answer; }
$("autoplay").onclick = () => { $("autoplay").disabled = true; auto.start(); };
$("goready").onclick = () => { $("dot").className = "dot ready"; $("stt").textContent = "Ready"; $("queue").hidden = false; $("goready").disabled = true; $("readynote").textContent = "Ready. Rosa M. is ringing."; renderQueue(); CueVoice.warm(); };

// ---------- Graph ----------
function drawGraph(path = []) { const svg = $("graph"); let s = "";
  G.edges.forEach(([a, b, l]) => { const A = G.nodes[a], B = G.nodes[b]; const on = path.includes(a) && path.includes(b) && Math.abs(path.indexOf(a) - path.indexOf(b)) === 1;
    s += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${on ? 'var(--green)' : 'var(--line)'}" stroke-width="${on ? 3.5 : 1.2}"/>`;
    if (l) { const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2; const horizontal = A.y === B.y; s += `<text x="${mx}" y="${horizontal ? my - 16 : my - 6}" font-size="9" fill="var(--muted)" text-anchor="middle" font-family="Mulish, sans-serif">${l}</text>`; } });
  Object.entries(G.nodes).filter(([, n]) => n.x !== undefined).forEach(([k, n]) => { const on = path.includes(k); const w = n.kind === "plan" ? 150 : Math.min(132, n.label.length * 5.6 + 18);
    s += `<g data-n="${k}" style="cursor:pointer"><rect x="${n.x - w / 2}" y="${n.y - 12}" width="${w}" height="24" rx="7" fill="${on ? 'var(--green)' : (n.kind === 'plan' ? 'var(--panel-2)' : 'var(--panel)')}" stroke="${on ? 'var(--green)' : 'var(--line)'}"/><text x="${n.x}" y="${n.y + 4}" font-size="9.5" text-anchor="middle" fill="${on ? '#fff' : 'var(--fg)'}" font-family="Mulish, sans-serif" font-weight="700">${n.label}</text></g>`; });
  svg.innerHTML = s; svg.querySelectorAll("g[data-n]").forEach(g => g.onclick = () => showClause(g.dataset.n)); }
function showClause(k) { const n = G.nodes[k]; $("clause").innerHTML = n.text ? `<b>${n.label}</b> (${n.id}): ${n.text}${n.src ? `<br><span class="small">Source: ${srcLinks(n)}</span>` : ""}` : `<b>${n.label}</b>`; }
// Links to the public document and PDF page each plan rule was read from
function srcHref(S, page) { return /\.pdf$/.test(S.file) ? `../${S.file}${page ? "#page=" + page : ""}` : S.url; }
// Rosa's earlier calls about the bill, read from her contact records rather than typed in
const rosaBill = () => D.contacts.filter(c => c.member === "M-001" && c.reason === "Claims and billing" && c.day < 0).sort((a, b) => a.day - b.day);
const rosaCalls = () => rosaBill().map(c => fmtOff(c.day)).join(" and ");
const rosaPromise = () => { const c = rosaBill().find(x => x.callback && x.callback.promised && !x.callback.scheduled); return c ? fmtOff(c.day) : "an earlier call"; };
// ---------- How Cue got this: the steps behind each suggestion, with the rule cards and the pages ----------
const escH = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
function hl(text, phrases) { let h = escH(text); (phrases || []).filter(Boolean).forEach(p => { const i = h.toLowerCase().indexOf(escH(p).toLowerCase()); if (i >= 0) h = h.slice(0, i) + "<mark>" + h.slice(i, i + escH(p).length) + "</mark>" + h.slice(i + escH(p).length); }); return h; }
function nodeCard(k) { const n = G.nodes[k]; return `<div class="tnode"><b>${n.label}</b> <span class="small">${n.id}</span><div>${n.text}</div>${(n.src || []).map(x => { const S = R.SOURCES[x.doc]; return `<q>${escH(x.quote)}</q><a class="srcchip" href="${srcHref(S, x.page)}" target="_blank" rel="noopener">${S.title}${x.page ? ", p. " + x.page : ""} ↗</a>`; }).join("")}</div>`; }
function edgeLabel(a, b) { const e = G.edges.find(([x, y]) => (x === a && y === b) || (x === b && y === a)); return e && e[2] ? e[2] : "then"; }
const RULES_ON_FILE = Object.values(G.nodes).filter(n => n.id).length;
function buildTrace(kind, text, d = {}) {
  const st = (h, body, cls = "") => `<li class="${cls}"><span class="h">${h}</span>${body}</li>`;
  const heard = p => st("Heard", `"${hl(text, p)}"`);
  const safe = st("Safety check, always first", `None of the ${R.ESC[R.CURRENT_RELEASE].length} stop patterns for appeals, denials, discharges or emergencies matched, so Cue may go on.`);
  let steps = [];
  if (kind === "answer") {
    const walk = d.path.map((k, i) => (i ? `<div class="tedge">↓ ${edgeLabel(d.path[i - 1], k)}</div>` : "") + nodeCard(k)).join("");
    const figs = R.figureCheck(d.draft.say, d.path).map(f => { const at = d.path.find(k => (G.nodes[k].text || "").includes(f.figure)); return `<span class="${f.onPath ? "figok" : "figbad"}">${f.figure} ${f.onPath ? "✓" : "✗"}</span>${at ? ` <span class="small">in ${G.nodes[at].id}</span>` : ""}`; }).join(" · ");
    steps = [heard([d.entry]), safe, st("Entry rule", `"${escH(d.entry)}" points to <b>${G.nodes[d.path[0]].label}</b>, one of ${RULES_ON_FILE} plan rules on file.`), st(d.path.length > 1 ? `Rules walked, ${d.path.length} in order` : "Rule used", walk), st("Every figure checked", (figs || "No dollar figures in this answer.") + `<div class="small">A figure that is not in a rule on this path would block the suggestion.</div>`), st("You decide", "Cue suggests. Nothing reaches the member until you say it.")];
  } else if (kind === "escalate") {
    steps = [heard([d.trigger]), st("Safety check, always first", `Stop pattern matched: "<b>${escH(d.trigger)}</b>". Nothing else runs: no rule lookup, no draft.`, "stop"), st("Rule", nodeCard("APPL")), st("You decide", "One action: bring in a person with authority.")];
  } else if (kind === "grievance") {
    steps = [heard([d.phrase]), st("Complaint check", `"${escH(d.phrase)}" is how dissatisfaction sounds, even without the word "complaint".`), st("Rule", nodeCard("GRV")), st("You decide", "Log it or not. Either choice is recorded in the note.")];
  } else if (kind === "process") {
    steps = [st("Heard", `"${hl(text, ["sending her home"])}"`), st("Supervisor joined", "Cue switches to process facts only. No benefit figure, no coverage decision."), st("Rule", nodeCard("FAST")), st("The supervisor decides", "Dana explains the rights and files the appeal with the member's representative.")];
  } else if (kind === "account") {
    steps = [heard([d.word]), safe, st("Not a plan rule", "This is about the member's own account (claims, premium, statements). The answer lives in the claim system, not the plan documents."), st("You decide", "Open the claim. Cue suggests no figure.")];
  } else if (kind === "refuse") {
    steps = [heard([]), safe, st("No rule matched", `None of the ${RULES_ON_FILE} plan rules on file covers this.`), st("Nothing drafted", "Cue says it has nothing to cite rather than guess. You answer, or look it up.")];
  } else if (kind === "record") {
    steps = [st("Read", "The member record: her contacts from the last 90 days."), st("Found", `Two calls about this bill (${rosaCalls()}). On ${rosaPromise()} a callback was promised and never scheduled.`), st("You decide", "Acknowledge both calls before she has to raise them.")];
  } else if (kind === "prefill") {
    steps = [st("From this call", "What the supervisor and the Quality Improvement Organization confirmed: appeal filed, coverage end date, decision timing."), st("Rule", nodeCard("FAST")), st("You decide", "Confirm the case and the callback. Nothing is filed until you do.")];
  }
  return `<ol class="trace">${steps.join("")}</ol>`;
}
function srcLinks(n) { return (n.src || []).map(x => { const S = R.SOURCES[x.doc]; return `<a href="${srcHref(S, x.page)}" target="_blank" rel="noopener">${S.title}${x.page ? ", p. " + x.page : ""}</a>`; }).join(" · "); }

// ---------- Member 360 ----------
const M = member("M-001");
const PLAN_ROWS = Object.keys(G.nodes).filter(k => G.nodes[k].id && G.nodes[k].id.startsWith("S-")); // every cited benefit rule
let mtab = "plan", hot = null;
function renderM360() {
  const claims = D.claims.filter(c => c.member === M.id).sort((a, b) => b.day - a.day), cases = D.cases.filter(k => k.member === M.id), contacts = D.contacts.filter(c => c.member === M.id).sort((a, b) => b.day - a.day), rx = D.pharmacy[M.id] || [];
  const tabs = [["plan", "Plan", PLAN_ROWS.length], ["claims", "Claims", claims.length], ["cases", "Cases", cases.length + (state.grievance ? 1 : 0)], ["contacts", "Contacts", contacts.length], ["rx", "Pharmacy", rx.length]];
  const panes = {
    plan: PLAN_ROWS.map(k => `<div class="row ${hot === k ? "hot" : ""}"><b>${G.nodes[k].label}</b><span class="small">${G.nodes[k].id}</span><span class="sub">${G.nodes[k].text}<br>Source: ${srcLinks(G.nodes[k])}</span></div>`).join(""),
    claims: claims.map(c => `<div class="row ${hot === c.id ? "hot" : ""}"><b>${c.service} · ${fmtOff(c.day)}</b><span class="amt">${money(c.owed)}</span><span class="sub">${c.provider} · ${c.id} · billed ${money(c.billed)}, plan paid ${money(c.planPaid)} · <b>${c.reason}</b> (${c.rule})</span></div>`).join(""),
    cases: (state.grievance ? `<div class="row hot"><b>Grievance G-26-0417 · opened today</b>${state.grievanceAnswered ? `<span class="pill good">resolved on the call</span>` : `<span class="pill warn">due ${fmtOff(30)}</span>`}<span class="sub">Repeat contact about an unresolved bill · 30-day clock · Grievances team</span></div>` : "") + (cases.map(k => `<div class="row"><b>${k.type === "grievance" ? "Grievance" : "Appeal"} ${k.id} · ${fmtOff(k.opened)}</b><span class="pill ${k.status === "open" ? "warn" : "good"}">${k.status}</span><span class="sub">${k.subject}</span></div>`).join("") || `<p class="small">No cases on file.</p>`),
    contacts: contacts.map(c => `<div class="row ${hot === "contacts" && c.reason === "Claims and billing" ? "hot" : ""}"><b>${fmtOff(c.day)} · ${c.reason}</b><span class="small">${c.by}</span><span class="sub">${c.note}${c.callback ? (c.callback.scheduled ? " · callback scheduled" : ` · <span class="pill bad">callback promised, never scheduled</span>`) : ""}</span></div>`).join(""),
    rx: rx.map(p => `<div class="row"><b>${p.drug}</b><span class="small">tier ${p.tier}</span><span class="sub">next fill ${relDay(p.next)} · ${p.mode}</span></div>`).join("") || `<p class="small">No prescriptions on file.</p>`
  };
  $("m360").innerHTML = `<div class="head"><div class="av">${initials(M.name)}</div><div><b>${M.name} · ${M.age}</b><span>${M.plan} · 2026 · ${M.lang} · PCP ${M.pcp} · ID ••••${M.last4}</span></div><span class="pill good" style="margin-left:auto">verified</span></div>
    <div class="flags">${M.flags.map(f => `<span class="pill warn">${f}</span>`).join("")}<span class="pill">${contacts.length} contacts in 90 days</span></div>
    <div class="mtabs" role="tablist">${tabs.map(([k, l, n]) => `<button role="tab" aria-selected="${k === mtab}" data-mt="${k}">${l}<span class="cnt">${n}</span></button>`).join("")}</div>
    ${tabs.map(([k]) => `<div class="mpane ${k === mtab ? "on" : ""}">${panes[k]}</div>`).join("")}`;
  $("m360").querySelectorAll("[data-mt]").forEach(b => b.onclick = () => { mtab = b.dataset.mt; hot = null; renderM360(); });
}
function openTab(t, h) { mtab = t; hot = h; renderM360(); }

// ---------- Call state ----------
const cues = () => $("cues"), quiet = () => $("quiet");
const state = { grievance: null, grievanceHeard: false, escalated: false, figures: [], pathsSeen: [], asked: {}, site: null, callback: null, docSent: null, caseOpened: null, transferred: null, ended: false, accepted: 0, declined: 0 };
function cue({ k, cls = "", say, main, alt, why, cite, trace }) { const el = document.createElement("div"); el.className = "cue " + cls; if (trace) { const lt = $("lasttrace"); if (lt) lt.innerHTML = `<b>${k}</b>` + trace; }
  el.innerHTML = `<div class="k">${k}</div><div class="say">${say}</div><div class="acts">${main ? `<button class="main">${main.label}</button>` : ""}${alt ? `<button class="alt">${alt.label}</button>` : ""}<button class="why">${trace ? "How Cue got this" : "Why?"}</button></div><div class="det">${trace || ""}${why ? `<div class="small" style="margin-top:4px">${why}</div>` : ""}</div>`;
  const m = el.querySelector(".main"), a = el.querySelector(".alt"), w = el.querySelector(".why");
  if (m) m.onclick = () => { m.classList.add("done"); m.textContent = main.done; if (a) a.disabled = true; state.accepted++; if (main.fn) main.fn(); };
  if (a) a.onclick = () => { a.classList.add("done"); a.textContent = alt.done; if (m) m.disabled = true; if (alt.choice) state.accepted++; else state.declined++; if (alt.fn) alt.fn(); };
  w.onclick = () => el.querySelector(".det").classList.toggle("on");
  cues().insertBefore(el, quiet()); el.scrollIntoView({ block: "nearest" });
  if (state.auto && (main || alt)) { const pickAlt = alt && auto.preferAlt(k, say); const b = pickAlt ? a : m; setTimeout(() => { if (b && !b.disabled && !b.classList.contains("done")) { b.classList.add("pressed"); b.click(); } }, auto.beat); } }
function setQuiet(t) { quiet().querySelector("span:last-child").textContent = t; }
function onMember(text) {
  const d = R.decide(text, R.CURRENT_RELEASE);   // the desk always runs the current release
  if (d.verdict === "escalate") { if (state.escalated) return; state.escalated = true; // one stop per call: every other cue is already paused drawGraph(["APPL"]); showClause("APPL"); openTab("cases");
    cue({ k: "Stop", cls: "stop", say: `<b>Bring a supervisor in now.</b> "${d.trigger}" signals a dispute about care or coverage. Don't quote a benefit or a decision for this.`, trace: buildTrace("escalate", text, d), main: { label: "Connect supervisor", done: "Supervisor joining", fn: () => { state.transferred = "Supervisor (Dana), discharge dispute"; markTool("transfer", "Supervisor joined"); if (state.callDone) playSupervisor(); } }, why: "A dispute about a care or coverage decision is never answered from a plan document. Cue drafts nothing and pauses every other cue for this topic." }); setQuiet("Paused on this topic. A supervisor is handling it."); return; }
  if (d.grievance && !state.grievanceHeard) { state.grievanceHeard = true; drawGraph(["GRV"]); showClause("GRV"); openTab("contacts", "contacts"); const g = R.grievance(text);
    cue({ k: "Heads up", cls: "flag", say: `She said "<mark>${g.exec(text)[0]}</mark>". That counts as a grievance, even without the word. Log it?`, trace: buildTrace("grievance", text, { phrase: g.exec(text)[0] }), main: { label: "Log grievance", done: "Logged · 30-day clock started", fn: () => { state.grievance = true; state.caseOpened = "G-26-0417"; markTool("case", "G-26-0417 opened"); openTab("cases"); } }, alt: { label: "Not a grievance", done: "Noted: not a grievance", fn: () => { state.grievance = false; } }, why: "If logged, a case opens with a due date 30 days out." }); }
  if (d.verdict === "answer") { const key = d.path.join(">"); if (state.pathsSeen.includes(key)) return; state.pathsSeen.push(key);
    drawGraph(d.path); showClause(d.path[0]); const dr = d.draft; R.figureCheck(dr.say, d.path).forEach(f => state.figures.push(f));
    if (d.path[0] === "SPEC") { state.asked.spec = true; openTab("claims", "C-26-5519"); } if (d.path.includes("INPT")) { state.asked.er = true; openTab("plan", "WAIVE"); }
    const main = dr.main ? { label: dr.main.label, done: dr.main.done, fn: () => { if (dr.main.set) Object.assign(state, dr.main.set); if (dr.main.show) showClause(dr.main.show); } } : null;
    const alt = dr.alt ? { label: dr.alt.label, done: dr.alt.done, choice: true, fn: () => { if (dr.alt.set) Object.assign(state, dr.alt.set); } } : null; // both options are answers, not a decline
    cue({ k: "Suggested answer", say: dr.say, main, alt, trace: buildTrace("answer", text, d) }); setQuiet("Listening. Nothing to add yet."); return; }
  if (d.account) { cue({ k: "Check first", say: "That's about the account, not the plan rules. Open the claim before answering. No number suggested.", trace: buildTrace("account", text, { word: (R.ACCOUNT.exec(text) || [])[0] }) }); openTab("claims"); }
}

// ---------- Ask Cue: grounded in plan rules, refuses the rest ----------
$("ask").onsubmit = e => { e.preventDefault(); const q = $("askq").value.trim(); if (!q) return; $("askq").value = "";
  const d = R.decide(q, R.CURRENT_RELEASE);
  if (d.verdict === "escalate") { cue({ k: "Stop", cls: "stop", say: `<b>That needs a person.</b> "${d.trigger}" is a dispute or a decision. Cue won't draft an answer.`, trace: buildTrace("escalate", q, d) }); return; }
  if (d.verdict === "answer") { const dr = d.draft; drawGraph(d.path); showClause(d.path[0]); const fig = R.figureCheck(dr.say, d.path); fig.forEach(f => state.figures.push(f));
    cue({ k: "You asked: " + q, say: dr.say, trace: buildTrace("answer", q, d) }); return; }
  cue({ k: "You asked: " + q, say: d.account ? "That's about the account, not the plan rules. Open the claim. No number suggested." : `<b>Not in the plan rules on file.</b> Cue has nothing to cite, so it says so rather than guess. It can answer questions like: ${["What's my ER copay?", "How much is an MRI?", "Is there a deductible?", "What does a skilled nursing stay cost?"].map(x => `<a href="#" class="tryq">${x}</a>`).join(" · ")}`, trace: buildTrace(d.account ? "account" : "refuse", q, { word: (R.ACCOUNT.exec(q) || [])[0] }) });
  document.querySelectorAll(".tryq").forEach(a => a.onclick = e => { e.preventDefault(); $("askq").value = a.textContent; $("ask").requestSubmit(); }); };

// ---------- Tools: Cue pre-fills, the advocate confirms ----------
const TOOLS = {
  case: () => ({ title: "Open a case", pre: state.grievanceHeard ? "Pre-filled from what Rosa said" : "Pre-filled from the member record", fields: [["Type", "select", ["Grievance", "Appeal", "Inquiry"], 0], ["Subject", "text", "Repeat contact about unresolved $120 dermatology procedure bill (C-26-5519)"], ["Clock", "text", "30 days, due " + fmtOff(30)], ["Route to", "select", ["Grievances team", "Appeals team", "Claims"], 0]], confirm: f => { state.caseOpened = "G-26-0417"; state.grievance = true; openTab("cases"); return "G-26-0417 opened"; } }),
  callback: () => ({ title: "Schedule a callback", pre: state.appealCase ? "Pre-filled: the mother's appeal decision is the open item" : "Pre-filled: where the procedure was done is the open item", fields: [["Date", "date", dayDate(2).toISOString().slice(0, 10)], ["Window", "select", ["Morning", "Afternoon"], 0], ["Reason", "text", "Confirm where the Sep 30 biopsy was done, claim C-26-5519"], ["Number", "text", "On file ending 0188"]], confirm: f => { state.callback = fmt(new Date(f[0] + "T12:00:00")) + ", " + f[1].toLowerCase(); return "Callback " + state.callback; } }),
  doc: () => ({ title: "Send a document", pre: "Pre-filled: the rules this call used", fields: [["Document", "select", ["Specialist and procedure copays (S-SPEC, S-DIAG)", "ER and hospital copays (S-ER, S-ER-W, S-INPT)", "Evidence of Coverage, full"], 0], ["Channel", "select", ["Text link", "Email", "Mail"], 0]], confirm: f => { state.docSent = f[0] + " by " + f[1].toLowerCase(); return "Sent: " + f[0]; } }),
  transfer: () => ({ title: "Transfer or conference", pre: state.escalated ? "Pre-filled: discharge dispute" : "Pre-filled from the call so far", fields: [["To", "select", ["Supervisor", "Appeals team", "Grievances team", "Pharmacy"], 0], ["Mode", "select", ["Conference (stay on)", "Warm transfer"], 0], ["Handoff note", "text", state.escalated ? "Mother's rehab discharge disputed; member distressed; nothing quoted" : "Repeat caller, billing question in progress"]], confirm: f => { state.transferred = f[0] + ", " + f[1].toLowerCase(); return f[0] + " joining"; } })
};
let openTool = null;
function suggestTool(t) { const b = document.querySelector(`#tools [data-tool=${t}]`); if (b && !b.classList.contains("done")) { b.style.borderColor = "var(--green)"; toast("Cue pre-filled a callback. Open Schedule callback to confirm."); } }
function markTool(t, label) { const b = document.querySelector(`#tools [data-tool=${t}]`); if (b) { b.classList.add("done"); b.lastChild.textContent = label; b.style.borderColor = ""; } }
function renderTool(t) { const T = TOOLS[t](); openTool = t; const box = $("tool"); box.className = "tool on";
  box.innerHTML = `<h4>${T.title} <span class="pre">· ${T.pre}</span></h4><div class="f">${T.fields.map(([l, k, v, sel], i) => `<div><label>${l}</label>${k === "select" ? `<select data-i="${i}">${v.map((o, j) => `<option ${j === sel ? "selected" : ""}>${o}</option>`).join("")}</select>` : `<input data-i="${i}" type="${k === "date" ? "date" : "text"}" value="${v}">`}</div>`).join("")}</div><div class="ctrl"><button class="btn sm primary" id="toolok">Confirm</button><button class="btn sm" id="toolx">Cancel</button><span class="small">Cue filled it; you confirm it. Nothing is sent until you do.</span></div>`;
  $("toolok").onclick = () => { const vals = [...box.querySelectorAll("[data-i]")].map(e => e.value); const done = T.confirm(vals); markTool(t, done); box.className = "tool"; toast(done); };
  $("toolx").onclick = () => { box.className = "tool"; openTool = null; }; }
document.querySelectorAll("#tools [data-tool]").forEach(b => b.onclick = () => renderTool(b.dataset.tool));

// ---------- Script and playback ----------
const SCRIPT = window.CureCueScript, VERIFY = SCRIPT.VERIFY, CALL = SCRIPT.CALL;
let paused = false, tick = null, t0 = 0, player = null;
const WHO = { Rosa: "Rosa", Advocate: "You", Supervisor: "Dana · supervisor" };
function addLine(container, w, t) { const d = document.createElement("div"); d.className = "line" + (w === "Advocate" ? " adv" : w === "Supervisor" ? " sup" : ""); d.innerHTML = `<span class="w">${WHO[w] || w}</span>${t}`; container.appendChild(d); container.scrollTop = container.scrollHeight; }
function go(n) { document.querySelectorAll("#steps div").forEach((d, k) => { d.className = k < n ? "done" : k === n ? "on" : ""; }); ["s-verify", "s-handle", "s-wrap"].forEach((id, k) => $(id).classList.toggle("on", k === n)); $("nocall").hidden = true; window.scrollTo({ top: 0 }); }
function wave(on) { ["wave1", "wave2"].forEach(id => $(id).classList.toggle("on", on)); }
function answer() {
  QUEUE.shift(); renderQueue(); $("dot").className = "dot live"; $("stt").textContent = "On call"; t0 = Date.now(); tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $("timer").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }, 500);
  $("precard").innerHTML = `<b>Caller ID</b><span>number on file ending 0188</span><b>Likely member</b><span>Rosa M. · ••••4821 · not yet verified</span><b>Reason given</b><span>billing question</span><b>Before verification</b><span class="small">Cue shows nothing else.</span>`;
  show("desk"); go(0);
  const c = $("tr-verify"); player = CueVoice.play(VERIFY, { container: c, onStart: () => wave(true), onLine: (l) => { addLine(c, l.w, l.t); wave(false); if (l.h) $("h" + l.h[0]).innerHTML = `heard <b>${l.h[1]}</b>`; }, isPaused: () => false, onDone: () => { if (state.auto) auto.verify(); } }); }
function chk() { $("verified").disabled = !(v1.checked && v2.checked && v3.checked); }
["v1", "v2", "v3"].forEach(id => $(id).onchange = chk);
$("verified").onclick = () => { if (player) player.stop(); go(1); renderM360(); drawGraph(); const c = $("tr");
  cue({ k: "Before you start", say: `She's called twice about this bill, ${rosaCalls()}. On ${rosaPromise()} she was promised a callback that never got scheduled.`, trace: buildTrace("record", "") });
  player = CueVoice.play(CALL, { container: c, onStart: () => wave(true), onLine: (l) => { addLine(c, l.w, l.t); wave(false); if (l.w === "Rosa") onMember(l.t); }, isPaused: () => paused || state.ended, onDone: () => { state.callDone = true; if (state.transferred) playSupervisor(); } }); };

// ---------- The supervisor's part, then the advocate's close. Guidance follows the plan's EOC, Chapter 9, Section 8. ----------
const EOC = R.SOURCES.EOC, eocLink = (p, t) => `<a href="../${EOC.file}#page=${p}" target="_blank" rel="noopener">${t}</a>`;
function playSupervisor() { if (state.supStarted || state.ended) return; state.supStarted = true; const c = $("tr");
  setQuiet("Supervisor on the call. Cue shows process facts only.");
  cue({ k: "For the supervisor · from the plan's documents", say: `Rehab is covered skilled nursing care. A <b>Notice of Medicare Non-Coverage</b> comes at least 2 days ahead; signing it is not agreeing. For a <b>fast-track appeal</b>, contact the Quality Improvement Organization by <b>noon the day before coverage ends</b>. It decides within one full day of having the information.`, trace: buildTrace("process", "They are sending her home on Thursday and she is not ready."), why: "Process facts, not a coverage decision." }); drawGraph(["GRV", "APPL"]);
  toast("Elena Martinez is a member too; Rosa M. is on file as her authorized representative.");
  player = CueVoice.play(SCRIPT.SUPERVISOR, { container: c, onStart: () => wave(true), onLine: l => { addLine(c, l.w, l.t); wave(false); }, isPaused: () => paused || state.ended, onDone: offerAppealCase }); }
function offerAppealCase() { if (state.ended) return;
  cue({ k: "Pre-filled for you", say: `<b>Appeal support case for Elena Martinez</b>: fast-track appeal filed with the Quality Improvement Organization on this call; skilled nursing coverage set to end ${fmtOff(2)}; decision within one full day of the reviewers having her information. <b>Callback to Rosa</b> ${fmtOff(2)}, morning.`, main: { label: "Open case and schedule callback", done: `A-26-0418 opened · callback ${fmtOff(2)}, morning`, fn: () => { state.appealCase = "A-26-0418"; if (!state.callback) { state.callback = fmtOff(2) + ", morning"; markTool("callback", "Callback " + state.callback); } playClose(); } }, trace: buildTrace("prefill", "") }); }
function playClose() { if (state.closeStarted || state.ended) return; state.closeStarted = true; const C = SCRIPT.CLOSE, c = $("tr");
  const lines = [{ w: "Advocate", t: C.bill[state.site || "unknown"] }];
  if (state.grievance === true) { lines.push({ w: "Advocate", t: C.grievance.logged }); state.grievanceAnswered = true; } else if (state.grievance === false) lines.push({ w: "Advocate", t: C.grievance.declined });
  lines.push({ w: "Advocate", t: C.wrap }, { w: "Rosa", t: C.thanks });
  player = CueVoice.play(lines, { container: c, onStart: () => wave(true), onLine: l => { addLine(c, l.w, l.t); wave(false); }, isPaused: () => paused || state.ended, onDone: () => { if (!state.ended) setTimeout(() => $("endcall").click(), 900); } }); }
$("pause").onclick = e => { paused = !paused; e.currentTarget.setAttribute("aria-pressed", String(paused)); $("stt").textContent = paused ? "On hold" : "On call"; if (paused) CueVoice.hold(); else CueVoice.resume(); };
$("mute").onclick = e => { const m = CueVoice.toggleMute(); e.currentTarget.setAttribute("aria-pressed", String(m)); $("mode").textContent = CueVoice.modeLabel(); toast(m ? "Audio off: transcript only" : "Audio on"); };
$("endcall").onclick = () => { state.ended = true; if (player) player.stop(); clearInterval(tick); wave(false); $("dot").className = "dot ready"; $("stt").textContent = "Wrap-up"; go(2); wrapup(); };

// ---------- Wrap-up, from this call only ----------
function wrapup() {
  const did = [];
  if (state.caseOpened) did.push(`Opened grievance ${state.caseOpened}, 30-day clock, due ${fmtOff(30)}`);
  if (state.site === "office") did.push("Confirmed the procedure was done in the office; bill C-26-5519 sent for reprocessing at $25");
  if (state.site === "hospital") did.push("Confirmed the procedure was done at a hospital outpatient department; explained the $120 copay");
  if (state.callback) did.push(`Scheduled callback ${state.callback}`);
  if (state.docSent) did.push(`Sent ${state.docSent}`);
  if (state.transferred) did.push(`Brought in ${state.transferred}`);
  if (state.appealCase) did.push(`Supervisor filed a fast-track appeal for Elena Martinez with the Quality Improvement Organization; opened ${state.appealCase}`);
  if (state.grievanceAnswered) did.push("Answered the complaint on the call; G-26-0417 resolved");
  $("didlist").innerHTML = did.map(d => `<li>${d}</li>`).join("") || `<li style="color:var(--muted)">No actions recorded.</li>`;
  const allOnPath = state.figures.length > 0 && state.figures.every(f => f.onPath);
  const items = [["Identity verified", true], ["Grievance decision recorded", state.grievance !== null, state.grievanceHeard],
    [state.figures.length ? `Every figure quoted traced to a plan rule (${state.figures.length} checked)` : "No figure was quoted", state.figures.length ? allOnPath : true, true],
    ["Place of service checked before quoting", state.site !== null, state.asked.spec], ["Discharge concern handed to a supervisor", state.escalated && !!state.transferred, state.escalated], ["Appeal deadline stated and appeal filed", !!state.appealCase, state.escalated], ["Callback scheduled with a date", !!state.callback, state.site !== "office"]];
  $("checklist").innerHTML = items.filter(([l, ok, applies]) => applies !== false).map(([l, ok]) => `<li><span class="b ${ok ? 'ok' : 'miss'}">${ok ? '✓' : '!'}</span><span>${l}${ok ? '' : ' <span class="pill bad">missing</span>'}</span></li>`).join("");
  const n = [`Rosa M. called (3rd contact) about a $120 bill from a dermatology visit with a biopsy, date of service Sep 30 (C-26-5519).`];
  if (state.asked.spec) n.push(`Plan rules: specialist office $25 (S-SPEC); diagnostic procedure at an outpatient hospital $120 (S-DIAG); no referral needed (S-REF). ${state.site === "office" ? "Done in the office; bill sent for reprocessing." : state.site === "hospital" ? "Done at a hospital outpatient department; $120 copay explained." : "Place of service not confirmed on this call."}`);
  if (state.grievanceHeard) n.push(state.grievance === true ? `Grievance logged G-26-0417, 30-day clock, due ${fmtOff(30)}.` : state.grievance === false ? "Repeat contact noted; advocate judged not a grievance." : "Dissatisfaction heard; grievance decision NOT recorded.");
  if (state.asked.er) n.push("Asked about ER with admission: $0 for the ER visit if admitted within 24 hours (S-ER-W); hospital $375/day days 1-7 (S-INPT); counts to $9,250 max (S-MOOP).");
  if (state.escalated) n.push(!state.transferred ? "Mother's discharge concern raised; supervisor NOT yet brought in." : state.appealCase ? `Mother (Elena Martinez; Rosa is authorized representative) has skilled nursing coverage ending ${fmtOff(2)}. Supervisor Dana explained the Notice of Medicare Non-Coverage and conferenced the Quality Improvement Organization; fast-track appeal filed before the noon ${fmtOff(1)} deadline. Case ${state.appealCase}. No benefit or decision quoted.` : "Mother's discharge concern: supervisor brought onto the call; nothing quoted.");
  if (state.grievanceAnswered) n.push("Complaint G-26-0417 answered on the call with the place-of-service explanation; resolved.");
  if (state.callback) n.push(`Callback scheduled ${state.callback}.`); if (state.docSent) n.push(`Document sent: ${state.docSent}.`);
  $("note").value = n.join("\n");
  $("code").value = state.escalated && !state.asked.spec ? "Escalated to supervisor" : state.grievance ? "Grievance · repeat contact" : "Benefits and cost question";
  const rc = [`Hi Rosa, a recap of today's call.`];
  if (state.asked.spec) { rc.push(`Specialist visits are $25, and you don't need a referral. A procedure done at a hospital outpatient department has a $120 copay.`); if (state.site === "office") rc.push(`Your Sep 30 biopsy was done in the office, so the $120 bill is being reprocessed at $25.`); else if (state.site === "hospital") rc.push(`Your Sep 30 biopsy was done at the hospital's outpatient department, which is why the bill is $120.`); else rc.push(`We are still confirming where your Sep 30 biopsy was done.`); }
  if (state.asked.er) rc.push(`If you ever go to the ER and are admitted to the same hospital within 24 hours, you pay $0 for the ER visit instead of $115, and the daily hospital copay applies instead.`);
  if (state.appealCase) rc.push(`Your mother's fast-track appeal is filed with the Quality Improvement Organization. They decide within one full day of having her information.`);
  if (state.callback) rc.push(`We will call you back ${state.callback}.`); if (state.docSent) rc.push(`The plan rules we discussed are on their way to you.`);
  rc.push(`Reply to this text if anything doesn't match what you understood.`); $("recap").textContent = rc.join(" ");
  $("approve").onclick = () => { closedCall = { time: new Date().toTimeString().slice(0, 5), member: "M-001", reason: $("code").value, minutes: Math.max(1, Math.round((Date.now() - t0) / 60000)), cues: { accepted: state.accepted, declined: state.declined }, qa: !!state.grievance || state.escalated, now: true }; recordOutcomes(); $("approved").textContent = "Note approved. Call closed; its cases and callback are on Home and in My day."; $("sendrecap").disabled = false; $("next").disabled = false; state.closed = true; state.closedAt = new Date(); $("dot").className = "dot ready"; $("stt").textContent = "Ready"; $("timer").textContent = ""; };
  $("sendrecap").onclick = e => { e.target.disabled = true; $("sent").textContent = "Sent by you."; if (outcomes) { outcomes.recap = true; renderHome(); } };
  $("next").onclick = () => show("day");
  if (state.auto) auto.finish(); }

// ---------- What the call leaves behind: cases, a contact, a callback. Home and the member record read these. ----------
function recordOutcomes() { if (state.recorded) return; state.recorded = true; $("readynote").textContent = "Rosa's call is closed; its outcomes are below. The other callers in the queue are not scripted in this demo.";
  if (state.grievance === true) { const k = D.cases.find(x => x.id === "G-26-0417"); const g = { id: "G-26-0417", member: "M-001", type: "grievance", opened: 0, days: 30, subject: "Repeat calls about a $120 biopsy bill" + (state.grievanceAnswered ? "; answered on the call" : ""), status: state.grievanceAnswered ? "resolved" : "open", owner: "Grievances team" }; if (k) Object.assign(k, g); else D.cases.push(g); }
  if (state.appealCase) D.cases.push({ id: state.appealCase, member: "M-009", type: "appeal", opened: 0, days: 2, clock: `coverage ends ${fmtOff(2)}`, subject: `Fast-track appeal filed with the Quality Improvement Organization; skilled nursing coverage ending ${fmtOff(2)}`, status: "open", owner: "Appeals team" });
  if (state.site === "office") { const cl = D.claims.find(x => x.id === "C-26-5519"); if (cl) cl.reason = "Sent back for reprocessing at the $25 office copay"; }
  D.contacts.push({ member: "M-001", day: 0, reason: "Claims and billing", note: `Biopsy bill ${state.site === "hospital" ? "explained: outpatient hospital copay" : state.site === "office" ? "sent for reprocessing" : "place of service still to confirm"}${state.appealCase ? "; mother's fast-track appeal filed with supervisor" : ""}`, callback: state.callback ? { promised: true, scheduled: true, day: 2 } : null, by: "Nik J." });
  outcomes = { site: state.site, grievance: state.grievance, answered: !!state.grievanceAnswered, appeal: state.appealCase, callback: state.callback, recap: false };
  renderHome(); }
function renderLastCall() { const w = $("lastcall-wrap"); if (!w) return; const o = outcomes; w.hidden = !o; if (!o) return; const rosa = member("M-001"), elena = member("M-009");
  const rows = [];
  rows.push(item(rosa, `Biopsy bill C-26-5519: ${o.site === "hospital" ? "the $120 outpatient hospital copay is correct; explained on the call" : o.site === "office" ? "done in the office; sent back to be reprocessed at $25" : "place of service still to confirm"}.`, `<span class="pill ${o.site ? "good" : "warn"}">${o.site ? "answered" : "open"}</span>`));
  if (o.grievance === true) rows.push(item(rosa, `Complaint <strong>G-26-0417</strong> logged for her repeat calls${o.answered ? ", and answered on the call" : ""}.`, `<span class="pill ${o.answered ? "good" : "warn"}">${o.answered ? "resolved" : "open · 30 days"}</span>`));
  if (o.appeal) rows.push(item(elena, `Appeal <strong>${o.appeal}</strong>: supervisor filed a fast-track appeal with the Quality Improvement Organization. Decision within one full day of the reviewers having her information.`, `<span class="pill warn">decision pending</span>`));
  if (o.callback) rows.push(item(rosa, `Callback booked <mark>${o.callback}</mark> to check her mother's appeal decision.`, `<span class="pill good">scheduled</span>`));
  rows.push(item(rosa, `Note approved${o.recap ? "; recap texted to Rosa" : ""}.`, `<span class="pill good">closed</span>`));
  $("lastcall").innerHTML = rows.join(""); }

// ---------- Watch the full call: the same desk, with each suggested action pressed after a beat ----------
const auto = {
  beat: 1800,
  // Which button the demo presses: the claim shows the biopsy at the hospital's outpatient department.
  preferAlt: (k, say) => /hospital outpatient department has a \$120/.test(say),
  start() { state.auto = true; $("goready").click(); setTimeout(() => { const a = $("answer"); if (a) a.click(); }, 900); },
  verify() { let i = 0; const boxes = ["v1", "v2", "v3"]; const tickNext = () => { if (i < boxes.length) { const v = $(boxes[i++]); v.checked = true; v.dispatchEvent(new Event("change")); setTimeout(tickNext, 450); } else setTimeout(() => $("verified").click(), 700); }; setTimeout(tickNext, 600); },
  finish() { setTimeout(() => { $("approve").click(); setTimeout(() => { $("sendrecap").click(); setTimeout(() => { show("home"); renderHome(); const w = $("lastcall-wrap"); if (w) w.scrollIntoView({ block: "start" }); toast("Call closed. Its outcomes are on Home."); state.auto = false; }, 1600); }, 1400); }, 2200); }
};

// ---------- My day ----------
function renderDay() {
  const st = dayStats(), calls = st.calls;
  $("tl").innerHTML = calls.map(c => { const m = member(c.member); return `<li class="${c.now ? "now" : ""}"><span class="t">${c.time}</span><div><b>${m.short} · ${c.reason}</b><span class="sub">${c.minutes} min · ${c.cues.accepted} cue${c.cues.accepted === 1 ? "" : "s"} accepted${c.cues.declined ? `, ${c.cues.declined} declined` : ""}${c.now ? " · just now" : ""}</span></div><div class="pills">${c.qa ? `<span class="pill warn">QA sample</span>` : ""}<span class="pill good">note complete</span></div></li>`; }).join("");
  const acc = st.acc, dec = st.dec;
  $("daytiles").innerHTML = [[calls.length, "calls today"], [st.aht, "avg handle"], [`${Math.round(acc / Math.max(1, acc + dec) * 100)}%`, "cues accepted"], [calls.filter(c => c.qa).length, "in QA sample"]].map(([n, l]) => `<div class="tile"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");
  $("daynote").textContent = !state.closed ? D.coaching : [state.callback ? "Rosa's call: you booked the callback with a date, the element yesterday's sample missed." : `Rosa's call: the callback promised on ${rosaPromise()} is still not scheduled. Open Schedule callback next time; Cue pre-fills it.`, state.grievance === true ? (state.grievanceAnswered ? "Her complaint was logged and answered on the call." : "Her complaint's 30-day clock starts today.") : ""].filter(Boolean).join(" ");
  $("qa").textContent = `${calls.filter(c => c.qa).length} of ${calls.length} calls today are in the QA sample two advocates re-check. Calls with a grievance or an escalation are always sampled.`;
  $("handled").textContent = st.n; $("aht").textContent = st.aht;
}

CueVoice.init().then(() => { $("mode").textContent = CueVoice.modeLabel(); $("voicenote").textContent = CueVoice.readyNote(); });
const HASHVIEW = { "#evals": "quality", "#connect": "connect" };
if (HASHVIEW[location.hash]) show(HASHVIEW[location.hash]);
window.addEventListener("hashchange", () => { if (HASHVIEW[location.hash]) show(HASHVIEW[location.hash]); });
window.CureCueDesk = { state, show, onMember, answer, buildTrace, cue };
})();
