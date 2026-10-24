/* CureCue rules. One file, read by the advocate desk (index.html) and by the eval runner (eval/run.mjs).
   Everything the desk decides, the runner can re-decide on the golden set, so "the same rules" is literal. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.CureCueRules = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // The release the desk runs. The eval runner reads it too; CI fails the build when this release misses a gate.
  const CURRENT_RELEASE = 2;

  // ---------- Plan rules as a graph (one synthetic plan) ----------
  const GRAPH = {
    plan: "Sierra Advantage HMO 2026",
    nodes: {
      PLAN: { x: 210, y: 30, label: "Sierra Advantage HMO 2026", kind: "plan" },
      PCP: { x: 70, y: 100, label: "Primary care $0", id: "S-PCP", text: "Primary care visits: $0 copay." },
      REF: { x: 210, y: 100, label: "Referral rule", id: "S-REF", text: "Specialist visits need a referral from your primary care doctor. Without one the visit is not covered and you may be billed in full." },
      SPEC: { x: 350, y: 100, label: "Specialist $35", id: "S-SPEC", text: "Specialist visits: $35 copay, with a referral on file." },
      ER: { x: 70, y: 180, label: "ER $110", id: "S-ER", text: "Emergency room: $110 copay per visit." },
      WAIVE: { x: 210, y: 180, label: "Waived if admitted", id: "S-ER-W", text: "The ER copay is waived if you are admitted within 24 hours." },
      INPT: { x: 350, y: 180, label: "Hospital $325/day", id: "S-INPT", text: "Inpatient hospital: $325 per day for days 1 to 5, then $0." },
      MOOP: { x: 70, y: 260, label: "Yearly max $4,900", id: "S-MOOP", text: "The most you pay in a year for covered in-network care: $4,900." },
      GRV: { x: 210, y: 260, label: "Grievance", id: "P-GRV", text: "Any expression of dissatisfaction is a grievance, even without the word. It is logged when expressed and resolved within 30 days." },
      APPL: { x: 350, y: 260, label: "Appeal / dispute", id: "P-APPL", text: "Disagreeing with a coverage or care decision, including a discharge, is handled by people. Nothing is drafted." }
    },
    edges: [["PLAN", "PCP"], ["PLAN", "SPEC"], ["PLAN", "ER"], ["PLAN", "MOOP"], ["PLAN", "GRV"],
      ["SPEC", "REF", "needs"], ["REF", "PCP", "from"], ["ER", "WAIVE", "unless"], ["WAIVE", "INPT", "then"], ["INPT", "MOOP", "counts to"], ["GRV", "APPL", "not an"]]
  };

  // ---------- Retrieval: entry pattern to a fixed path over the graph ----------
  // Order matters: the multi-hop ER+admission path is tried before the single ER rule.
  const HOPS = [
    { re: /admit|admitted|overnight/i, and: /\ber\b|emergency/i, path: ["ER", "WAIVE", "INPT", "MOOP"] },
    { re: /dermatolog|specialist|referral|\$120/i, path: ["SPEC", "REF", "PCP"] },
    { re: /\ber\b|emergency/i, path: ["ER", "WAIVE"] },
    { re: /out.of.pocket|maximum|most I can pay/i, path: ["MOOP"] },
    { re: /regular doctor|primary/i, path: ["PCP"] }
  ];
  const retrieve = q => HOPS.find(h => h.re.test(q) && (!h.and || h.and.test(q))) || null;

  // ---------- Escalation (Guardian) by release ----------
  const ESC = {
    1: [/appeal/i, /denied/i, /grievance/i, /complaint/i],
    2: [/appeal/i, /denied/i, /grievance/i, /complaint/i, /sending (her|him|my mother|my father|me) home/i, /not ready/i, /chest pain/i, /can'?t breathe/i, /refused to pay/i, /discharg/i]
  };
  const escalation = (text, release) => ESC[release || CURRENT_RELEASE].find(r => r.test(text)) || null;

  // ---------- Dissatisfaction (Sentinel) ----------
  const GRV = [/third time/i, /again/i, /nobody/i, /frustrat/i, /ridiculous/i, /unacceptable/i, /fed up/i];
  const grievance = text => GRV.find(r => r.test(text)) || null;

  // ---------- Account questions: not plan rules, no figure suggested ----------
  const ACCOUNT = /eob|claim|premium|charged|billing/i;

  // ---------- Drafts: what the Citer proposes for a path. Every figure must sit on a node of the path. ----------
  function draft(path) {
    const head = path[0];
    if (head === "SPEC") return {
      say: "<b>$35 with a referral on file.</b> Without one, the visit isn't covered, which is how a bill for the full visit happens. <b>Check the referral for the visit date before you quote either way.</b>",
      why: "Path: Specialist $35 needs Referral rule, issued by Primary care. The one figure here, $35, is in rule S-SPEC. Her bill amount is on the EOB in the member record, not in a plan rule, so it is shown there and not quoted here.",
      main: { label: "Referral was on file", done: "Referral confirmed · bill to be reprocessed", set: { referral: true } },
      alt: { label: "No referral on file", done: "No referral · explain the rule", set: { referral: false } }
    };
    if (path.includes("INPT")) return {
      say: "<b>If she's admitted within 24 hours, the $110 ER copay is waived.</b> The hospital copay applies instead: $325 a day for days 1 to 5, then $0. All of it counts toward her $4,900 yearly max.",
      why: "Four rules in a chain: ER copay, unless admitted, then hospital copay, which counts to the yearly max. A single-rule lookup would have quoted $110 and been wrong.",
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
    if (ACCOUNT.test(text)) return { verdict: "human", clause: null, path: [], grievance: !!g, account: true };
    const h = retrieve(text);
    if (!h) return { verdict: "human", clause: null, path: [], grievance: !!g };
    return { verdict: "answer", clause: GRAPH.nodes[h.path[0]].id, path: h.path, grievance: !!g, draft: draft(h.path) };
  }

  // ---------- Scoring a golden set. Shared so the desk's Quality tab and CI agree to the digit. ----------
  function score(golden, release) {
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
    return { release: release || CURRENT_RELEASE, metrics: m, gates, missed, badFigures, failed: gates.filter(g => !g.pass).length };
  }

  return { CURRENT_RELEASE, GRAPH, HOPS, retrieve, escalation, grievance, ACCOUNT, draft, figures, figureCheck, decide, score };
});
