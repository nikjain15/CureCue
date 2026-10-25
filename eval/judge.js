/* A stand-in judge. In production this is a model scoring answers; here it is a second, independent classifier
   (a lexicon scorer that shares no code with rules.js) so that the validation mechanism is real:
   its agreement with human labels is computed per metric on a held-out slice, and it may feed a gate only where
   agreement clears the threshold. Escalation is never judged by a model, by policy, whatever the agreement. */
(function (root, factory) { if (typeof module !== "undefined" && module.exports) module.exports = factory(); else root.CureCueJudge = factory(); })(typeof self !== "undefined" ? self : this, function () {
  const THRESHOLD = 0.85;
  const LEX = {
    escalate: ["appeal", "apel", "denied", "deny", "negaron", "grievance", "queja", "complain", "discharg", "sending", "home from", "de alta", "not ready", "no estoy list", "chest", "pecho", "breathe", "respirar", "dizzy", "pass out", "refused to pay", "negaron a pagar", "cut me off", "should i go to the er", "coverage ended"],
    dissatisfied: ["third", "tercera", "fourth", "again", "nobody", "nadie", "never came", "frustrat", "ridiculous", "ridículo", "unacceptable", "fed up", "harto", "sick of", "tired of", "useless", "done being patient", "different answer", "keep calling", "here we go", "lol", "super.", "nobody told me", "on earth"],
    account: ["claim", "reclamo", "premium", "prima", "eob", "statement", "billing on", "status"],
    clause: { "S-PCP": ["primary", "regular doctor", "primario", "primary doctor"], "S-SPEC": ["specialist", "dermatolog", "referral", "referido", "especialista"], "S-MOOP": ["out-of-pocket", "most i can pay", "yearly max", "maximum", "máximo", "stop paying"], "S-ER": ["er ", "er?", "emergency", "emergencias", "admit", "admitted"] }
  };
  const has = (t, words) => words.some(w => t.toLowerCase().includes(w));
  // The judge's own read of a turn. Different method from the rules (bag of words, scored, no ordering).
  function read(t) {
    const esc = has(t, LEX.escalate), dis = has(t, LEX.dissatisfied), acc = has(t, LEX.account);
    let clause = null; for (const [c, ws] of Object.entries(LEX.clause)) if (has(t, ws)) { clause = c; break; }
    const verdict = esc ? "escalate" : acc ? "human" : clause ? "answer" : "human";
    return { verdict, clause: verdict === "answer" ? clause : null, grievance: dis };
  }
  // Agreement with human labels per metric on a slice. Returns the table the scorecard prints.
  function validate(rows) {
    const held = rows.filter((r, i) => i % 3 === 0); // held-out third, fixed, never used to tune the lexicon
    let vN = 0, vOk = 0, gN = 0, gOk = 0, cN = 0, cOk = 0;
    held.forEach(r => { const j = read(r.t); vN++; if (j.verdict === r.v) vOk++; gN++; if (j.grievance === !!r.g) gOk++; if (r.v === "answer") { cN++; if (j.clause === r.c) cOk++; } });
    const row = (name, metric, agree, n, policy) => ({ name, metric, agreement: agree, n, allowed: policy === "never" ? false : agree >= THRESHOLD, policy });
    return { threshold: THRESHOLD, heldOut: held.length, rows: [
      row("Answer correctness (right clause)", "citation_accuracy", cN ? cOk / cN : 0, cN, "if validated"),
      row("Dissatisfaction heard", "grievance_recall", gN ? gOk / gN : 0, gN, "if validated"),
      row("Verdict (answer / human / escalate)", "routing_accuracy", vN ? vOk / vN : 0, vN, "if validated"),
      row("Escalation decision", "escalation_recall", null, vN, "never") ] };
  }
  return { THRESHOLD, read, validate };
});
