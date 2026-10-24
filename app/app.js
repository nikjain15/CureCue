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
const TITLES = { home: ["Home", "Member Services · Medicare · Mon Oct 27"], desk: ["Call", "Rosa M. · Sierra Advantage HMO"], day: ["My day", "Mon Oct 27"], quality: ["Evals", "Runs, gates, slices, failures, dataset, judge"], loop: ["How it learns", "Two human gates"] };
function show(v) { ["home", "desk", "day", "quality", "loop"].forEach(x => $("view-" + x).classList.toggle("on", x === v)); document.querySelectorAll(".rail button[data-view]").forEach(b => { if (b.dataset.view === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }); $("title").textContent = TITLES[v][0]; $("crumb").textContent = TITLES[v][1]; window.scrollTo({ top: 0 }); if (v === "day") renderDay(); }
document.querySelectorAll(".rail button[data-view]").forEach(b => b.onclick = () => show(b.dataset.view));

// ---------- Home: Cue's briefing, computed from the data ----------
const cbDue = D.contacts.filter(c => c.callback && c.callback.scheduled && c.callback.day === 0);
const nearClock = D.cases.filter(k => k.status === "open" && k.opened + k.days <= 7).sort((a, b) => (a.opened + a.days) - (b.opened + b.days));
const likely = D.members.filter(m => { const same = D.contacts.filter(c => c.member === m.id && c.day >= -30); const byReason = {}; same.forEach(c => { byReason[c.reason] = (byReason[c.reason] || 0) + 1; }); return Object.values(byReason).some(n => n >= 2) && same.some(c => c.callback && c.callback.promised && !c.callback.scheduled); });
const briefState = { cbDone: new Set() };
function item(m, why, acts, cls = "") { return `<div class="item ${cls}" data-m="${m.id}"><div class="av">${initials(m.name)}</div><div><b>${m.short} · ${m.plan}</b><div class="why">${why}</div></div><div class="act">${acts}</div></div>`; }
function renderHome() {
  $("briefmeta").textContent = `${cbDue.length} callbacks · ${nearClock.length} clocks · ${likely.length} likely repeat`;
  $("homen").textContent = cbDue.length + nearClock.length;
  $("cb").innerHTML = cbDue.map(c => { const m = member(c.member); const done = briefState.cbDone.has(c.member); return item(m, `Promised ${relDay(c.day)} about <mark>${c.reason.toLowerCase()}</mark>: ${c.note}.`, done ? `<span class="pill good">called</span>` : `<button class="btn sm primary" data-cb="${c.member}">Call now</button><span class="small">reason pre-filled</span>`, done ? "done" : ""); }).join("") || `<p class="small">None due today.</p>`;
  $("clock").innerHTML = nearClock.map(k => { const m = member(k.member); const left = k.opened + k.days; return item(m, `${k.type === "grievance" ? "Grievance" : "Appeal"} <strong>${k.id}</strong>: ${k.subject}. Opened ${relDay(k.opened)}, due <mark>${relDay(left)}</mark>. Owner: ${k.owner}.`, `<span class="pill ${left <= 5 ? "bad" : "warn"}">${left} days left</span>`, left <= 5 ? "urgent" : ""); }).join("");
  $("likely").innerHTML = likely.map(m => { const cs = D.contacts.filter(c => c.member === m.id && c.day >= -30); const promised = cs.find(c => c.callback && c.callback.promised && !c.callback.scheduled); const byReason = {}; cs.forEach(c => { byReason[c.reason] = (byReason[c.reason] || 0) + 1; }); const [reason, times] = Object.entries(byReason).sort((a, b) => b[1] - a[1])[0]; return item(m, `Called ${times} times in 30 days about ${reason.toLowerCase()}. On ${fmtOff(promised.day)} a callback was promised and <mark>never scheduled</mark>. If she calls, acknowledge both calls first.`, `<span class="pill warn">watch</span>`); }).join("") || `<p class="small">Nobody flagged.</p>`;
  $("coach").textContent = D.coaching;
  const mins = D.shift.reduce((a, s) => a + s.minutes, 0), acc = D.shift.reduce((a, s) => a + s.cues.accepted, 0), dec = D.shift.reduce((a, s) => a + s.cues.declined, 0);
  $("kpis").innerHTML = [[D.shift.length, "calls so far"], [`${Math.floor(mins / D.shift.length)}:${String(Math.round((mins / D.shift.length % 1) * 60)).padStart(2, "0")}`, "avg handle"], [`${acc}/${acc + dec}`, "cues accepted"]].map(([n, l]) => `<div class="kpi"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");
  $("handled").textContent = D.shift.length; $("aht").textContent = `${Math.floor(mins / D.shift.length)}:${String(Math.round((mins / D.shift.length % 1) * 60)).padStart(2, "0")}`;
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
    ["05:42", `Scored release ${R.CURRENT_RELEASE} against the golden set: ${R.score(GOLDEN, R.CURRENT_RELEASE).failed ? "blocked" : "every gate passed"}. No skill changed overnight.`],
    ["05:42", "Drafted nothing for any member. Nothing above was sent anywhere."]];
  $("log").innerHTML = rows.map(([t, l]) => `<li><span class="t">${t}</span><span>${l}</span></li>`).join("");
  $("logmeta").textContent = `run cue-2026-10-27-0540 · rules.js release ${R.CURRENT_RELEASE} · data.js ${D.members.length} members`;
})();

// ---------- Queue ----------
const QUEUE = [{ id: "M-001", reason: "billing question", wait: "0:04", ring: true }, { id: "M-002", reason: "appeal status", wait: "1:40" }, { id: "M-003", reason: "ID card", wait: "0:52" }];
function renderQueue() { $("queue").innerHTML = QUEUE.map((q, i) => { const m = member(q.id); const flags = D.contacts.filter(c => c.member === q.id && c.day >= -30).length; return `<div class="qcard ${q.ring ? "ring" : ""}" style="${i ? "opacity:.6" : ""}"><div class="av">${initials(m.name)}</div><div><b>${m.short}</b><div class="r">${m.plan} · ${q.reason} · ${flags ? flags + " contact" + (flags > 1 ? "s" : "") + " in 30 days" : "first contact"} · waiting ${q.wait}</div></div>${q.ring ? `<button class="btn primary" id="answer">Answer</button>` : ""}</div>`; }).join(""); $("qn").textContent = QUEUE.length; const a = $("answer"); if (a) a.onclick = answer; }
$("goready").onclick = () => { $("dot").className = "dot ready"; $("stt").textContent = "Ready"; $("queue").hidden = false; $("goready").disabled = true; $("readynote").textContent = "Ready. Rosa M. is ringing."; renderQueue(); CueVoice.warm(); };

// ---------- Graph ----------
function drawGraph(path = []) { const svg = $("graph"); let s = "";
  G.edges.forEach(([a, b, l]) => { const A = G.nodes[a], B = G.nodes[b]; const on = path.includes(a) && path.includes(b) && Math.abs(path.indexOf(a) - path.indexOf(b)) === 1;
    s += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${on ? 'var(--green)' : 'var(--line)'}" stroke-width="${on ? 3.5 : 1.2}"/>`;
    if (l) { const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2; const horizontal = A.y === B.y; s += `<text x="${mx}" y="${horizontal ? my - 16 : my - 6}" font-size="9" fill="var(--muted)" text-anchor="middle" font-family="Mulish, sans-serif">${l}</text>`; } });
  Object.entries(G.nodes).forEach(([k, n]) => { const on = path.includes(k); const w = n.kind === "plan" ? 150 : Math.min(132, n.label.length * 5.6 + 18);
    s += `<g data-n="${k}" style="cursor:pointer"><rect x="${n.x - w / 2}" y="${n.y - 12}" width="${w}" height="24" rx="7" fill="${on ? 'var(--green)' : (n.kind === 'plan' ? 'var(--panel-2)' : 'var(--panel)')}" stroke="${on ? 'var(--green)' : 'var(--line)'}"/><text x="${n.x}" y="${n.y + 4}" font-size="9.5" text-anchor="middle" fill="${on ? '#fff' : 'var(--fg)'}" font-family="Mulish, sans-serif" font-weight="700">${n.label}</text></g>`; });
  svg.innerHTML = s; svg.querySelectorAll("g[data-n]").forEach(g => g.onclick = () => showClause(g.dataset.n)); }
function showClause(k) { const n = G.nodes[k]; $("clause").innerHTML = n.text ? `<b>${n.label}</b> (${n.id}): ${n.text}` : `<b>${n.label}</b>`; }

// ---------- Member 360 ----------
const M = member("M-001");
const PLAN_ROWS = ["PCP", "SPEC", "REF", "ER", "WAIVE", "INPT", "MOOP"];
let mtab = "plan", hot = null;
function renderM360() {
  const claims = D.claims.filter(c => c.member === M.id).sort((a, b) => b.day - a.day), cases = D.cases.filter(k => k.member === M.id), contacts = D.contacts.filter(c => c.member === M.id).sort((a, b) => b.day - a.day), rx = D.pharmacy[M.id] || [];
  const tabs = [["plan", "Plan", PLAN_ROWS.length], ["claims", "Claims", claims.length], ["cases", "Cases", cases.length + (state.grievance ? 1 : 0)], ["contacts", "Contacts", contacts.length], ["rx", "Pharmacy", rx.length]];
  const panes = {
    plan: PLAN_ROWS.map(k => `<div class="row ${hot === k ? "hot" : ""}"><b>${G.nodes[k].label}</b><span class="small">${G.nodes[k].id}</span><span class="sub">${G.nodes[k].text}</span></div>`).join(""),
    claims: claims.map(c => `<div class="row ${hot === c.id ? "hot" : ""}"><b>${c.service} · ${fmtOff(c.day)}</b><span class="amt">${money(c.owed)}</span><span class="sub">${c.provider} · ${c.id} · billed ${money(c.billed)}, plan paid ${money(c.planPaid)} · <b>${c.reason}</b> (${c.rule})</span></div>`).join(""),
    cases: (state.grievance ? `<div class="row hot"><b>Grievance G-26-0417 · opened today</b><span class="pill warn">due ${fmtOff(30)}</span><span class="sub">Repeat contact about an unresolved bill · 30-day clock · Grievances team</span></div>` : "") + (cases.map(k => `<div class="row"><b>${k.type === "grievance" ? "Grievance" : "Appeal"} ${k.id} · ${fmtOff(k.opened)}</b><span class="pill ${k.status === "open" ? "warn" : "good"}">${k.status}</span><span class="sub">${k.subject}</span></div>`).join("") || `<p class="small">No cases on file.</p>`),
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
const state = { grievance: null, grievanceHeard: false, escalated: false, figures: [], pathsSeen: [], asked: {}, referral: null, callback: null, docSent: null, caseOpened: null, transferred: null, ended: false, accepted: 0, declined: 0 };
function cue({ k, cls = "", say, main, alt, why, cite }) { const el = document.createElement("div"); el.className = "cue " + cls;
  el.innerHTML = `<div class="k">${k}</div><div class="say">${say}</div><div class="acts">${main ? `<button class="main">${main.label}</button>` : ""}${alt ? `<button class="alt">${alt.label}</button>` : ""}<button class="why">Why?</button></div><div class="det">${why}${cite ? `<br>Source: <code>${cite}</code>` : ""}</div>`;
  const m = el.querySelector(".main"), a = el.querySelector(".alt"), w = el.querySelector(".why");
  if (m) m.onclick = () => { m.classList.add("done"); m.textContent = main.done; if (a) a.disabled = true; state.accepted++; if (main.fn) main.fn(); };
  if (a) a.onclick = () => { a.classList.add("done"); a.textContent = alt.done; if (m) m.disabled = true; state.declined++; if (alt.fn) alt.fn(); };
  w.onclick = () => el.querySelector(".det").classList.toggle("on");
  cues().insertBefore(el, quiet()); el.scrollIntoView({ block: "nearest" }); }
function setQuiet(t) { quiet().querySelector("span:last-child").textContent = t; }
function onMember(text) {
  const d = R.decide(text, R.CURRENT_RELEASE);   // the desk always runs the current release
  if (d.verdict === "escalate") { state.escalated = true; drawGraph(["APPL"]); showClause("APPL"); openTab("cases");
    cue({ k: "Stop", cls: "stop", say: `<b>Bring a supervisor in now.</b> "${d.trigger}" signals a dispute about care or coverage. Don't quote a benefit or a decision for this.`, main: { label: "Connect supervisor", done: "Supervisor joining", fn: () => { state.transferred = "Supervisor, discharge dispute"; markTool("transfer", "Supervisor joining"); } }, why: "A dispute about a care or coverage decision is never answered from a plan document. Cue drafts nothing and pauses every other cue for this topic.", cite: "P-APPL" }); setQuiet("Paused on this topic. A supervisor is handling it."); return; }
  if (d.grievance && !state.grievanceHeard) { state.grievanceHeard = true; drawGraph(["GRV"]); showClause("GRV"); openTab("contacts", "contacts"); const g = R.grievance(text);
    cue({ k: "Heads up", cls: "flag", say: `She said "<mark>${g.exec(text)[0]}</mark>". That counts as a grievance, even without the word. Log it?`, main: { label: "Log grievance", done: "Logged · 30-day clock started", fn: () => { state.grievance = true; state.caseOpened = "G-26-0417"; markTool("case", "G-26-0417 opened"); openTab("cases"); } }, alt: { label: "Not a grievance", done: "Noted: not a grievance", fn: () => { state.grievance = false; } }, why: "Repeat contact about an unresolved issue is dissatisfaction. If logged, a case opens with a due date 30 days out. Either choice is recorded in the note.", cite: "P-GRV" }); }
  if (d.verdict === "answer") { const key = d.path.join(">"); if (state.pathsSeen.includes(key)) return; state.pathsSeen.push(key);
    drawGraph(d.path); showClause(d.path[0]); const dr = d.draft; R.figureCheck(dr.say, d.path).forEach(f => state.figures.push(f));
    if (d.path[0] === "SPEC") { state.asked.spec = true; openTab("claims", "C-26-5519"); } if (d.path.includes("INPT")) { state.asked.er = true; openTab("plan", "WAIVE"); }
    const main = dr.main ? { label: dr.main.label, done: dr.main.done, fn: () => { if (dr.main.set) Object.assign(state, dr.main.set); if (dr.main.show) showClause(dr.main.show); } } : null;
    const alt = dr.alt ? { label: dr.alt.label, done: dr.alt.done, fn: () => { if (dr.alt.set) Object.assign(state, dr.alt.set); if (d.path[0] === "SPEC") suggestTool("callback"); } } : null;
    cue({ k: "Suggested answer", say: dr.say, main, alt, why: dr.why, cite: d.path.map(k => G.nodes[k].id).join(" → ") }); setQuiet("Listening. Nothing to add yet."); return; }
  if (d.account) { cue({ k: "Check first", say: "That's about the account, not the plan rules. Open the claim before answering. No number suggested.", why: "Cue only quotes figures that exist in a plan rule. Account questions need the claim system." }); openTab("claims"); }
}

// ---------- Ask Cue: grounded in plan rules, refuses the rest ----------
$("ask").onsubmit = e => { e.preventDefault(); const q = $("askq").value.trim(); if (!q) return; $("askq").value = "";
  const d = R.decide(q, R.CURRENT_RELEASE);
  if (d.verdict === "escalate") { cue({ k: "Stop", cls: "stop", say: `<b>That needs a person.</b> "${d.trigger}" is a dispute or a decision. Cue won't draft an answer.`, why: "Escalation wins every race, including a typed question.", cite: "P-APPL" }); return; }
  if (d.verdict === "answer") { const dr = d.draft; drawGraph(d.path); showClause(d.path[0]); const fig = R.figureCheck(dr.say, d.path); fig.forEach(f => state.figures.push(f));
    cue({ k: "You asked: " + q, say: dr.say, why: dr.why + (fig.length ? ` Figures checked against the path: ${fig.map(f => f.figure).join(", ")}.` : ""), cite: d.path.map(k => G.nodes[k].id).join(" → ") }); return; }
  cue({ k: "You asked: " + q, say: d.account ? "That's about the account, not the plan rules. Open the claim. No number suggested." : "<b>Not in the plan rules on file.</b> Cue has nothing to cite, so it says so rather than guess.", why: d.account ? "Account questions need the claim system." : "A question outside the plan is an abstention. It is counted, not hidden: see the abstention rate on the scorecard design.", cite: "no path" }); };

// ---------- Tools: Cue pre-fills, the advocate confirms ----------
const TOOLS = {
  case: () => ({ title: "Open a case", pre: state.grievanceHeard ? "Pre-filled from what Rosa said" : "Pre-filled from the member record", fields: [["Type", "select", ["Grievance", "Appeal", "Inquiry"], 0], ["Subject", "text", "Repeat contact about unresolved $120 dermatology bill (C-26-5519)"], ["Clock", "text", "30 days, due " + fmtOff(30)], ["Route to", "select", ["Grievances team", "Appeals team", "Claims"], 0]], confirm: f => { state.caseOpened = "G-26-0417"; state.grievance = true; openTab("cases"); return "G-26-0417 opened"; } }),
  callback: () => ({ title: "Schedule a callback", pre: "Pre-filled: the referral check is the open item", fields: [["Date", "date", dayDate(2).toISOString().slice(0, 10)], ["Window", "select", ["Morning", "Afternoon"], 1], ["Reason", "text", "Confirm referral status for Sep 30 visit, claim C-26-5519"], ["Number", "text", "On file ending 0188"]], confirm: f => { state.callback = fmt(new Date(f[0] + "T12:00:00")) + ", " + f[1].toLowerCase(); return "Callback " + state.callback; } }),
  doc: () => ({ title: "Send a document", pre: "Pre-filled: the rules this call used", fields: [["Document", "select", ["Referral rule and specialist copay (S-REF, S-SPEC)", "ER and hospital copays (S-ER, S-ER-W, S-INPT)", "Evidence of Coverage, full"], 0], ["Channel", "select", ["Text link", "Email", "Mail"], 0]], confirm: f => { state.docSent = f[0] + " by " + f[1].toLowerCase(); return "Sent: " + f[0]; } }),
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
const VERIFY = [{ w: "Advocate", t: "Thanks for calling. Before I can look at anything, can I get your full name?" }, { w: "Rosa", t: "Rosa Martinez.", h: [1, "Rosa Martinez"] }, { w: "Advocate", t: "And your date of birth?" }, { w: "Rosa", t: "March 9th, 1955.", h: [2, "03/09/1955"] }, { w: "Advocate", t: "Last four of your member ID?" }, { w: "Rosa", t: "4821.", h: [3, "4821"] }];
const CALL = [
  { w: "Rosa", t: "This is the third time I've called about this bill from the skin doctor." },
  { w: "Advocate", t: "I'm sorry, Rosa. I can see both earlier calls, so you won't have to repeat yourself. Let's sort it out." },
  { w: "Rosa", t: "They billed me $120 for a specialist visit and I thought I only pay $35." },
  { w: "Advocate", t: "Let me check whether a referral was on file for September 30th." },
  { w: "Rosa", t: "While I have you, if I go to the ER and they admit me, what do I owe?" },
  { w: "Rosa", t: "And my mother is in rehab. They are sending her home tomorrow and she is not ready." },
  { w: "Advocate", t: "I'm bringing a supervisor onto the call for that right now." }];
let paused = false, tick = null, t0 = 0, player = null;
function addLine(container, w, t) { const d = document.createElement("div"); d.className = "line" + (w === "Advocate" ? " adv" : ""); d.innerHTML = `<span class="w">${w === "Advocate" ? "You" : "Rosa"}</span>${t}`; container.appendChild(d); container.scrollTop = container.scrollHeight; }
function go(n) { document.querySelectorAll("#steps div").forEach((d, k) => { d.className = k < n ? "done" : k === n ? "on" : ""; }); ["s-verify", "s-handle", "s-wrap"].forEach((id, k) => $(id).classList.toggle("on", k === n)); $("nocall").hidden = true; window.scrollTo({ top: 0 }); }
function wave(on) { ["wave1", "wave2"].forEach(id => $(id).classList.toggle("on", on)); }
function answer() {
  QUEUE.shift(); renderQueue(); $("dot").className = "dot live"; $("stt").textContent = "On call"; t0 = Date.now(); tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $("timer").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }, 500);
  $("precard").innerHTML = `<b>Caller ID</b><span>number on file ending 0188</span><b>Likely member</b><span>Rosa M. · ••••4821 · not yet verified</span><b>Reason given</b><span>billing question</span><b>Before verification</b><span class="small">Cue shows nothing else.</span>`;
  show("desk"); go(0);
  const c = $("tr-verify"); player = CueVoice.play(VERIFY, { container: c, onStart: () => wave(true), onLine: (l) => { addLine(c, l.w, l.t); wave(false); if (l.h) $("h" + l.h[0]).innerHTML = `heard <b>${l.h[1]}</b>`; }, isPaused: () => false, offset: 0 }); }
function chk() { $("verified").disabled = !(v1.checked && v2.checked && v3.checked); }
["v1", "v2", "v3"].forEach(id => $(id).onchange = chk);
$("verified").onclick = () => { if (player) player.stop(); go(1); renderM360(); drawGraph(); const c = $("tr");
  cue({ k: "Before you start", say: "She's called twice about this bill, Oct 3 and Oct 14. On Oct 14 she was promised a callback that never got scheduled.", why: "From the member record's prior contacts. Shown once so you can acknowledge it before she has to raise it." });
  player = CueVoice.play(CALL, { container: c, onStart: () => wave(true), onLine: (l) => { addLine(c, l.w, l.t); wave(false); if (l.w === "Rosa") onMember(l.t); }, isPaused: () => paused || state.ended, offset: VERIFY.length }); };
$("pause").onclick = e => { paused = !paused; e.currentTarget.setAttribute("aria-pressed", String(paused)); $("stt").textContent = paused ? "On hold" : "On call"; if (paused) CueVoice.hold(); else CueVoice.resume(); };
$("mute").onclick = e => { const m = CueVoice.toggleMute(); e.currentTarget.setAttribute("aria-pressed", String(m)); $("mode").textContent = CueVoice.modeLabel(); toast(m ? "Audio off: transcript only" : "Audio on"); };
$("endcall").onclick = () => { state.ended = true; if (player) player.stop(); clearInterval(tick); wave(false); $("dot").className = "dot ready"; $("stt").textContent = "Wrap-up"; go(2); wrapup(); };

// ---------- Wrap-up, from this call only ----------
function wrapup() {
  const did = [];
  if (state.caseOpened) did.push(`Opened grievance ${state.caseOpened}, 30-day clock, due ${fmtOff(30)}`);
  if (state.referral === true) did.push("Confirmed referral on file; bill C-26-5519 sent for reprocessing");
  if (state.referral === false) did.push("Confirmed no referral on file; explained the rule");
  if (state.callback) did.push(`Scheduled callback ${state.callback}`);
  if (state.docSent) did.push(`Sent ${state.docSent}`);
  if (state.transferred) did.push(`Brought in ${state.transferred}`);
  $("didlist").innerHTML = did.map(d => `<li>${d}</li>`).join("") || `<li style="color:var(--muted)">No actions recorded.</li>`;
  const allOnPath = state.figures.length > 0 && state.figures.every(f => f.onPath);
  const items = [["Identity verified", true], ["Grievance decision recorded", state.grievance !== null, state.grievanceHeard],
    [state.figures.length ? `Every figure quoted traced to a plan rule (${state.figures.length} checked)` : "No figure was quoted", state.figures.length ? allOnPath : true, true],
    ["Referral checked before quoting", state.referral !== null, state.asked.spec], ["Discharge concern handed to a supervisor", state.escalated && !!state.transferred, state.escalated], ["Callback scheduled with a date", !!state.callback, state.referral !== true]];
  $("checklist").innerHTML = items.filter(([l, ok, applies]) => applies !== false).map(([l, ok]) => `<li><span class="b ${ok ? 'ok' : 'miss'}">${ok ? '✓' : '!'}</span><span>${l}${ok ? '' : ' <span class="pill bad">missing</span>'}</span></li>`).join("");
  const n = [`Rosa M. called (3rd contact) about a $120 specialist bill, date of service Sep 30 (C-26-5519).`];
  if (state.asked.spec) n.push(`Plan rule: $35 with referral on file (S-SPEC); not covered without (S-REF). ${state.referral === true ? "Referral confirmed; bill sent for reprocessing." : state.referral === false ? "No referral on file; rule explained." : "Referral status not confirmed on this call."}`);
  if (state.grievanceHeard) n.push(state.grievance === true ? `Grievance logged G-26-0417, 30-day clock, due ${fmtOff(30)}.` : state.grievance === false ? "Repeat contact noted; advocate judged not a grievance." : "Dissatisfaction heard; grievance decision NOT recorded.");
  if (state.asked.er) n.push("Asked about ER with admission: ER copay waived if admitted (S-ER-W); hospital $325/day days 1-5 (S-INPT); counts to $4,900 max (S-MOOP).");
  if (state.escalated) n.push(state.transferred ? "Mother's discharge concern: supervisor brought onto the call; nothing quoted." : "Mother's discharge concern raised; supervisor NOT yet brought in.");
  if (state.callback) n.push(`Callback scheduled ${state.callback}.`); if (state.docSent) n.push(`Document sent: ${state.docSent}.`);
  $("note").value = n.join("\n");
  $("code").value = state.escalated && !state.asked.spec ? "Escalated to supervisor" : state.grievance ? "Grievance · repeat contact" : "Benefits and cost question";
  const rc = [`Hi Rosa, a recap of today's call.`];
  if (state.asked.spec) { rc.push(`Specialist visits are $35 when your primary doctor's referral is on file.`); if (state.referral === true) rc.push(`Your referral was on file, so the $120 bill is being reprocessed.`); else if (state.referral === false) rc.push(`No referral was on file for your Sep 30 visit, which is why the $120 bill stands; we went through how to get a referral before the next visit.`); else rc.push(`We are still confirming your referral for Sep 30.`); }
  if (state.asked.er) rc.push(`If you ever go to the ER and are admitted within 24 hours, the $110 ER copay is waived and the daily hospital copay applies instead.`);
  if (state.callback) rc.push(`We will call you back ${state.callback}.`); if (state.docSent) rc.push(`The plan rules we discussed are on their way to you.`);
  rc.push(`Reply to this text if anything doesn't match what you understood.`); $("recap").textContent = rc.join(" ");
  $("approve").onclick = () => { $("approved").textContent = "Note approved. Call closed and added to today's timeline."; $("sendrecap").disabled = false; $("next").disabled = false; state.closed = true; };
  $("sendrecap").onclick = e => { e.target.disabled = true; $("sent").textContent = "Sent by you."; };
  $("next").onclick = () => show("day"); }

// ---------- My day ----------
function renderDay() {
  const calls = D.shift.map(s => ({ ...s, now: false }));
  if (state.closed) { const secs = Math.floor((Date.now() - t0) / 1000); calls.push({ time: "10:31", member: "M-001", reason: $("code").value, minutes: Math.max(1, Math.round(secs / 60)), cues: { accepted: state.accepted, declined: state.declined }, qa: !!state.grievance, now: true, note: "complete" }); }
  $("tl").innerHTML = calls.map(c => { const m = member(c.member); return `<li class="${c.now ? "now" : ""}"><span class="t">${c.time}</span><div><b>${m.short} · ${c.reason}</b><span class="sub">${c.minutes} min · ${c.cues.accepted} cue${c.cues.accepted === 1 ? "" : "s"} accepted${c.cues.declined ? `, ${c.cues.declined} declined` : ""}${c.now ? " · just now" : ""}</span></div><div class="pills">${c.qa ? `<span class="pill warn">QA sample</span>` : ""}<span class="pill good">note complete</span></div></li>`; }).join("");
  const mins = calls.reduce((a, s) => a + s.minutes, 0), acc = calls.reduce((a, s) => a + s.cues.accepted, 0), dec = calls.reduce((a, s) => a + s.cues.declined, 0);
  $("daytiles").innerHTML = [[calls.length, "calls today"], [`${Math.floor(mins / calls.length)}:${String(Math.round((mins / calls.length % 1) * 60)).padStart(2, "0")}`, "avg handle"], [`${Math.round(acc / Math.max(1, acc + dec) * 100)}%`, "cues accepted"], [calls.filter(c => c.qa).length, "in QA sample"]].map(([n, l]) => `<div class="tile"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");
  $("daynote").textContent = state.closed ? (state.callback ? "Rosa's call: you scheduled the callback with a date, which is the element yesterday's sample missed. The grievance clock starts today." : "Rosa's call: a callback was promised on Oct 14 and is still not scheduled. Open Schedule callback next time; Cue pre-fills it.") : D.coaching;
  $("qa").textContent = `${calls.filter(c => c.qa).length} of ${calls.length} calls today are in the daily 200-turn sample two advocates re-check. ${state.closed && state.grievance ? "Rosa's call was sampled because a grievance was logged." : "Calls with a grievance or an escalation are always sampled."}`;
  $("handled").textContent = calls.length;
}

CueVoice.init().then(() => { $("mode").textContent = CueVoice.modeLabel(); $("voicenote").textContent = CueVoice.readyNote(); });
if (location.hash === "#evals") show("quality");
window.addEventListener("hashchange", () => { if (location.hash === "#evals") show("quality"); });
window.CureCueDesk = { state, show, onMember, answer };
})();
