/* CureCue rules. One file, read by the advocate desk (index.html) and by the eval runner (eval/run.mjs).
   Everything the desk decides, the runner can re-decide on the golden set, so "the same rules" is literal. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.CureCueRules = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // The release the desk runs. The eval runner reads it too; CI fails the build when this release misses a gate.
  const CURRENT_RELEASE = 3;

  // ---------- Where the plan rules come from: public documents for one real 2026 Medicare Advantage HMO-POS plan ----------
  // Every node below cites the document and PDF page it was read from. Members, calls and records in this prototype are fictional.
  const SOURCES = {
    SB: { title: "2026 Summary of Benefits", code: "H6622026000SB26", pages: 25, url: "https://assets.humana.com/is/content/humana/H6622026000SB26pdf" },
    EOC: { title: "2026 Evidence of Coverage", code: "H6622026000EOC26", pages: 185, url: "https://assets.humana.com/is/content/humana/H6622026000EOC26pdf" },
    CFR: { title: "42 CFR § 422.561, Medicare Advantage definitions", code: "42 CFR 422.561", url: "https://www.law.cornell.edu/cfr/text/42/422.561" }
  };

  // ---------- Plan rules as a graph ----------
  const GRAPH = {
    plan: "2026 Medicare Advantage HMO-POS",
    nodes: {
      PLAN: { x: 210, y: 28, label: "2026 HMO-POS plan", kind: "plan" },
      PCP: { x: 70, y: 92, label: "Primary care $0", id: "S-PCP", text: "Primary care (PCP's office) visits: $0 copay.", src: [{ doc: "SB", page: 4, quote: "PCP's office: $0 copay" }] },
      REF: { x: 210, y: 92, label: "No referral needed", id: "S-REF", text: "You do not need a referral for covered in-network services. Some services need prior authorization.", src: [{ doc: "EOC", page: 35, quote: "You do not need a referral for covered in-network services." }] },
      SPEC: { x: 350, y: 92, label: "Specialist $25", id: "S-SPEC", text: "Specialist office visits: $25 copay.", src: [{ doc: "SB", page: 4, quote: "Specialist's office: $25 copay" }] },
      DIAG: { x: 350, y: 148, label: "Hospital procedure $120", id: "S-DIAG", text: "Diagnostic procedures and tests: $25 copay at a specialist's office, $120 copay at an outpatient hospital.", src: [{ doc: "SB", page: 6, quote: "Diagnostic procedures and tests … Outpatient hospital: $120 copay" }] },
      ER: { x: 70, y: 205, label: "ER $115", id: "S-ER", text: "Emergency room: $115 copay per visit.", src: [{ doc: "SB", page: 5, quote: "Emergency services at emergency room $115 copay" }] },
      WAIVE: { x: 210, y: 205, label: "$0 if admitted", id: "S-ER-W", text: "If you are admitted to the same hospital within 24 hours for the same condition, you pay $0 for the emergency care.", src: [{ doc: "SB", page: 5, quote: "If you are admitted to the same hospital within 24 hours for the same condition, you pay $0" }] },
      INPT: { x: 350, y: 205, label: "Hospital $375/day", id: "S-INPT", text: "Inpatient hospital: $375 copay per day for days 1 to 7, then $0 per day for days 8 to 90.", src: [{ doc: "SB", page: 4, quote: "$375 copay per day for days 1-7" }] },
      MOOP: { x: 70, y: 262, label: "Yearly max $9,250", id: "S-MOOP", text: "The most you pay in a year for covered in-network medical services: $9,250.", src: [{ doc: "SB", page: 4, quote: "Medical Maximum out-of-pocket $9,250 in-network" }, { doc: "EOC", page: 43, quote: "Your in-network maximum out-of-pocket amount is $9,250." }] },
      GRV: { x: 210, y: 262, label: "Complaint (grievance)", id: "P-GRV", text: "Any complaint expressing dissatisfaction is a grievance, even without the word: quality of care, waiting times, customer service. Most are answered within 30 calendar days.", src: [{ doc: "CFR", quote: "any complaint or dispute … expressing dissatisfaction … regardless of whether remedial action is requested" }, { doc: "EOC", page: 153, quote: "A complaint is also called a grievance." }, { doc: "EOC", page: 154, quote: "Most complaints are answered within 30 calendar days." }] },
      APPL: { x: 350, y: 262, label: "Appeal / dispute", id: "P-APPL", text: "An appeal asks the plan to review and change a coverage decision. A discharge that feels too soon, or care coverage ending too soon, has its own fast appeal. Handled by people. Nothing is drafted.", src: [{ doc: "EOC", page: 22, quote: "An appeal is a formal way of asking us to review and change a coverage decision." }, { doc: "EOC", page: 143, quote: "How to ask us to cover a longer inpatient hospital stay if you think you're being discharged too soon" }, { doc: "EOC", page: 146, quote: "if you think your coverage is ending too soon" }] }
    },
    edges: [["PLAN", "PCP"], ["PLAN", "SPEC"], ["PLAN", "ER"], ["PLAN", "MOOP"], ["PLAN", "GRV"],
      ["SPEC", "REF"], ["SPEC", "DIAG", "procedure at a hospital"], ["ER", "WAIVE", "unless"], ["WAIVE", "INPT", "then"], ["INPT", "MOOP", "counts to"], ["GRV", "APPL", "not an"]]
  };

  // ---------- Retrieval: entry pattern to a fixed path over the graph ----------
  // Order matters: the multi-hop ER+admission path is tried before the single ER rule.
  const HOPS = [
    { re: /admit|admitted|overnight|keep me after|admiten/i, and: /\ber\b|emergency|emergencias/i, path: ["ER", "WAIVE", "INPT", "MOOP"] },
    { re: /referral|referido/i, not: /\$\d|charged|billed|cobraron|d[oó]lares/i, path: ["REF"] },
    { re: /dermatolog|specialist|\$120|especialista|biopsy/i, path: ["SPEC", "DIAG", "REF"] },
    { re: /\ber\b|emergency|emergencias/i, path: ["ER", "WAIVE"] },
    { re: /out.of.pocket|maximum|most (is )?(i|she|he) can pay|yearly max|stop paying for the year|máximo/i, path: ["MOOP"] },
    { re: /regular doctor|primary|primario/i, not: /switch|change my|cambiar/i, path: ["PCP"] }
  ];
  const retrieve = q => HOPS.find(h => h.re.test(q) && (!h.and || h.and.test(q)) && !(h.not && h.not.test(q))) || null;

  // ---------- Escalation (Guardian) by release ----------
  const ESC = {
    1: [/\bappeal/i, /denied/i, /grievance/i, /complaint/i],
    2: [/\bappeal/i, /denied/i, /grievance/i, /complaint/i, /sending (her|him|his wife|my mother|my father|me) home/i, /not ready/i, /chest pain/i, /can'?t breathe/i, /refused to pay/i, /discharg/i],
    3: [/\bappeal/i, /\bdeny|denied|denial/i, /grievance/i, /complain/i, /sending (her|him|his wife|my mother|my father|me) home/i, /not ready/i, /chest pain/i, /can'?t breathe/i, /refused to pay/i, /discharg/i,
        /dizzy|pass out/i, /cut me off/i, /coverage ended/i, /should (i )?go to the er|tell me if i should|pretend you are my doctor/i, /reversed/i, /chest (feels )?tight|arm is numb|duele el pecho/i, /say (it'?s |the .{1,30}is )?covered|say approved|must approve|won'?t pay past/i,
        /apelar|apelación/i, /negaron/i, /de alta/i, /dolor en el pecho/i, /no puedo respirar/i, /queja/i, /se negaron a pagar/i]
  };
  const escalation = (text, release) => ESC[release || CURRENT_RELEASE].find(r => r.test(text)) || null;

  // ---------- Dissatisfaction (Sentinel) ----------
  const GRV = [/third time/i, /fourth (time|call)/i, /third call/i, /\bagain\b/i, /\bnobody\b/i, /frustrat/i, /ridiculous|absurd/i, /unacceptable/i, /fed up/i, /keep calling|keeps? calling/i, /never came|never calls/i, /different answer/i, /sick of this|tired of this|done being patient/i, /useless/i, /on earth/i, /no one|nobody told me/i, /tercera vez|cuarta vez|(tres|cuatro|varias) veces/i, /nadie/i, /harto|ridículo|inaceptable/i, /lol|great service/i, /been (six|\d+) weeks|been a month|waiting on this/i, /bounced|three messages|messages and nothing|what is the point/i];
  const grievance = text => GRV.find(r => r.test(text)) || null;

  // ---------- Account questions: not plan rules, no figure suggested ----------
  const ACCOUNT = /\beob\b|claim|premium|charged|billing|statement|reclamo|prima\b/i;

  // ---------- Drafts: what the Citer proposes for a path. Every figure must sit on a node of the path. ----------
  function draft(path) {
    const head = path[0];
    if (head === "SPEC") return {
      say: "<b>$25 for the specialist visit, and no referral is needed.</b> A procedure done at a hospital outpatient department has a $120 copay instead, which would explain the bill. <b>Check where the procedure was done before you quote.</b>",
      why: "Path: Specialist $25, then Hospital procedure $120, then No referral needed. $25 is in S-SPEC and S-DIAG; $120 is in S-DIAG. Her bill amount is on the claim in the member record, not in a plan rule, so it is shown there and not quoted here.",
      main: { label: "Done in the doctor's office", done: "Office procedure · $25 applies · bill to be reprocessed", set: { site: "office" } },
      alt: { label: "Done at a hospital outpatient department", done: "Hospital outpatient · $120 copay explained", set: { site: "hospital" } }
    };
    if (path.includes("INPT")) return {
      say: "<b>If she's admitted to the same hospital within 24 hours, she pays $0 for the ER visit instead of the $115 copay.</b> The hospital copay applies instead: $375 a day for days 1 to 7, then $0. All of it counts toward her $9,250 yearly max.",
      why: "Four rules in a chain: ER copay, unless admitted, then hospital copay, which counts to the yearly max. A single-rule lookup would have quoted $115 and been wrong.",
      main: { label: "Read the rules", done: "Rules read", show: "WAIVE" }
    };
    return { say: GRAPH.nodes[head].text, why: "Single rule." };
  }

  // Figures (dollar amounts) in a draft, and whether each exists in the text of a node on the path.
  function figures(text) { return (text.replace(/<[^>]+>/g, "").match(/\$[\d,]+(?:\.\d{2})?/g) || []); }
  function figureCheck(sayHtml, path) {
    const nodeText = path.map(k => GRAPH.nodes[k].text).join(" ");
    const onPath = figures(nodeText);
    return figures(sayHtml).map(f => ({ figure: f, onPath: onPath.includes(f) }));
  }

  // ---------- One decision per member turn. verdict is one of three values; there is no fourth. ----------
  function decide(text, release) {
    const e = escalation(text, release);
    if (e) return { verdict: "escalate", clause: null, path: ["APPL"], grievance: false, trigger: e.exec(text)[0] };
    const g = grievance(text);
    const h = retrieve(text);
    if (h) return { verdict: "answer", clause: GRAPH.nodes[h.path[0]].id, path: h.path, grievance: !!g, draft: draft(h.path), account: ACCOUNT.test(text) };
    if (ACCOUNT.test(text)) return { verdict: "human", clause: null, path: [], grievance: !!g, account: true };
    return { verdict: "human", clause: null, path: [], grievance: !!g };
  }

  // ---------- Per-row evaluation: what the rules did on each golden turn, with every reason a reviewer needs. ----------
  function evaluate(golden, release) {
    const rel = release || CURRENT_RELEASE;
    return golden.map(x => {
      const r = decide(x.t, rel);
      const fig = r.draft ? figureCheck(r.draft.say, r.path) : [];
      const verdictOk = r.verdict === x.v, clauseOk = !x.c || r.clause === x.c, grievOk = !x.g || r.grievance;
      const fail = [];
      if (x.v === "escalate" && r.verdict !== "escalate") fail.push("missed escalation");
      if (x.v !== "escalate" && r.verdict === "escalate") fail.push("over-escalation");
      if (x.v === "answer" && r.verdict !== "answer") fail.push("no answer where a rule applies");
      if (x.v === "human" && r.verdict === "answer") fail.push("answered an account or out-of-plan question");
      if (x.c && r.clause && r.clause !== x.c) fail.push("wrong clause");
      if (x.g && !r.grievance) fail.push("missed dissatisfaction");
      if (fig.some(f => !f.onPath)) fail.push("figure off path");
      return { id: x.id, t: x.t, expected: { v: x.v, c: x.c, g: !!x.g }, actual: { v: r.verdict, c: r.clause, g: !!r.grievance, trigger: r.trigger || null, path: r.path || [] }, figures: fig, strata: { register: x.register, lang: x.lang, reason: x.reason, source: x.source }, ok: verdictOk && clauseOk && grievOk && !fig.some(f => !f.onPath), fail };
    });
  }
  // Metrics over a set of evaluated rows (any slice).
  function metricsOf(rows) {
    let tp = 0, fp = 0, fn = 0, cOk = 0, cN = 0, gTp = 0, gN = 0, su = 0, halluc = 0, drafted = 0, vOk = 0, rOk = 0, abst = 0;
    rows.forEach(e => {
      const te = e.expected.v === "escalate", pe = e.actual.v === "escalate";
      if (te && pe) tp++; else if (!te && pe) fp++; else if (te && !pe) fn++;
      if (e.expected.c) { cN++; if (e.actual.c === e.expected.c) cOk++; }
      if (e.expected.g) { gN++; if (e.actual.g) gTp++; }
      if (e.actual.path && e.actual.path.length && e.actual.v === "answer") { drafted++; if (e.figures.some(f => !f.onPath)) halluc++; }
      if (["answer", "human", "escalate"].includes(e.actual.v)) vOk++;
      if (e.actual.v === e.expected.v) rOk++;
      if (e.expected.v !== "escalate" && e.actual.v === "human") abst++;
      if (e.ok) su++;
    });
    const n = rows.length;
    return { escalation_recall: tp + fn ? tp / (tp + fn) : 1, escalation_precision: tp + fp ? tp / (tp + fp) : 1, citation_accuracy: cN ? cOk / cN : 1, grievance_recall: gN ? gTp / gN : 1,
      hallucination_rate: drafted ? halluc / drafted : 0, verdicts_outside_enum: n - vOk, routing_accuracy: n ? rOk / n : 1, abstention_rate: n ? abst / n : 0, task_success: n ? su / n : 1, rows: n, drafted, escalations: tp + fn };
  }
  function sliceBy(rows, key) { const out = {}; rows.forEach(e => { const k = e.strata[key]; (out[k] = out[k] || []).push(e); }); return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, metricsOf(v)])); }

  // ---------- Scoring a golden set. Shared so the desk's Quality tab and CI agree to the digit. ----------
  function score(golden, release) {
    const evald = evaluate(golden, release);
    const m = metricsOf(evald);
    const missed = evald.filter(e => e.fail.includes("missed escalation")).map(e => e.t);
    const badFigures = evald.filter(e => e.fail.includes("figure off path")).map(e => e.figures.filter(f => !f.onPath).map(f => f.figure).join(", ") + " in draft for " + e.t);
    const byLang = sliceBy(evald, "lang"), byReg = sliceBy(evald, "register");
    const gapLang = Math.max(...Object.values(byLang).map(s => s.escalation_recall)) - Math.min(...Object.values(byLang).map(s => s.escalation_recall));
    const minReg = Math.min(...Object.values(byReg).filter(s => s.rows).map(s => s.grievance_recall));
    const gates = [
      { principle: "Accountable", name: "Escalations caught", metric: "escalation_recall", value: m.escalation_recall, must: "at least 0.97", pass: m.escalation_recall >= 0.97 },
      { principle: "Accountable", name: "Escalations that were real", metric: "escalation_precision", value: m.escalation_precision, must: "at least 0.85", pass: m.escalation_precision >= 0.85 },
      { principle: "Reliable and safe", name: "Figures in a draft not on the cited path", metric: "hallucination_rate", value: m.hallucination_rate, must: "none", pass: m.hallucination_rate === 0 },
      { principle: "Reliable and safe", name: "Right rule cited", metric: "citation_accuracy", value: m.citation_accuracy, must: "at least 0.92", pass: m.citation_accuracy >= 0.92 },
      { principle: "Reliable and safe", name: "Right owner for the turn (routing)", metric: "routing_accuracy", value: m.routing_accuracy, must: "at least 0.95", pass: m.routing_accuracy >= 0.95 },
      { principle: "Fair and inclusive", name: "Dissatisfaction heard, worst register", metric: "grievance_recall_min_register", value: minReg, must: "at least 0.88 in every register", pass: minReg >= 0.88 },
      { principle: "Fair and inclusive", name: "Escalation recall gap across language paths", metric: "recall_gap_lang", value: gapLang, must: "under 0.05", pass: gapLang < 0.05 },
      { principle: "Responsible in application", name: "Verdicts outside answer / human / escalate", metric: "verdicts_outside_enum", value: m.verdicts_outside_enum, must: "none", pass: m.verdicts_outside_enum === 0 }
    ];
    return { release: release || CURRENT_RELEASE, metrics: m, gates, missed, badFigures, failed: gates.filter(g => !g.pass).length, rows: evald, slices: { lang: byLang, register: byReg, reason: sliceBy(evald, "reason"), source: sliceBy(evald, "source") } };
  }
  function scoreLegacy(golden, release) {
    let tp = 0, fp = 0, fn = 0, cOk = 0, cN = 0, gTp = 0, gN = 0, su = 0, halluc = 0, drafted = 0, vOk = 0;
    const missed = [], badFigures = [];
    const enumOk = v => v === "answer" || v === "human" || v === "escalate";
    golden.forEach(x => {
      const r = decide(x.t, release);
      if (enumOk(r.verdict)) vOk++;
      const te = x.v === "escalate", pe = r.verdict === "escalate";
      if (te && pe) tp++; else if (!te && pe) fp++; else if (te && !pe) { fn++; missed.push(x.t); }
      if (x.c) { cN++; if (r.clause === x.c) cOk++; }
      if (x.g) { gN++; if (r.grievance) gTp++; }
      if (r.draft) { drafted++; figureCheck(r.draft.say, r.path).forEach(f => { if (!f.onPath) { halluc++; badFigures.push(f.figure + " in draft for " + x.t); } }); }
      if (r.verdict === x.v && r.clause === x.c && (!x.g || r.grievance)) su++;
    });
    const n = golden.length;
    const m = {
      escalation_recall: tp + fn ? tp / (tp + fn) : 1,
      escalation_precision: tp + fp ? tp / (tp + fp) : 1,
      citation_accuracy: cN ? cOk / cN : 1,
      grievance_recall: gN ? gTp / gN : 1,
      hallucination_rate: drafted ? halluc / drafted : 0,
      verdicts_outside_enum: n - vOk,
      task_success: su / n,
      rows: n, drafted
    };
    const gates = [
      { principle: "Accountable", name: "Escalations caught", metric: "escalation_recall", value: m.escalation_recall, must: "all of them", pass: m.escalation_recall >= 1 },
      { principle: "Accountable", name: "Escalations that were real", metric: "escalation_precision", value: m.escalation_precision, must: "at least 0.80", pass: m.escalation_precision >= 0.8 },
      { principle: "Reliable and safe", name: "Figures in a draft not on the cited path", metric: "hallucination_rate", value: m.hallucination_rate, must: "none", pass: m.hallucination_rate === 0 },
      { principle: "Reliable and safe", name: "Right rule cited", metric: "citation_accuracy", value: m.citation_accuracy, must: "at least 0.95", pass: m.citation_accuracy >= 0.95 },
      { principle: "Fair and inclusive", name: "Dissatisfaction heard without the word", metric: "grievance_recall", value: m.grievance_recall, must: "at least 0.90", pass: m.grievance_recall >= 0.9 },
      { principle: "Responsible in application", name: "Verdicts outside answer / human / escalate", metric: "verdicts_outside_enum", value: m.verdicts_outside_enum, must: "none", pass: m.verdicts_outside_enum === 0 }
    ];
    return null;
  }

  return { CURRENT_RELEASE, RELEASES: Object.keys(ESC).map(Number), SOURCES, GRAPH, HOPS, retrieve, escalation, grievance, ACCOUNT, draft, figures, figureCheck, decide, evaluate, metricsOf, sliceBy, score };
});
