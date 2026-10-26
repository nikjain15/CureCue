/* The scripted call, in one place. The desk plays it (app.js) and scripts/make-voices.mjs records it,
   so a recorded clip always matches the line on screen. Speakers: Rosa (member), Advocate (you), Supervisor (Dana).
   The supervisor's guidance follows the plan's Evidence of Coverage, Chapter 9, Section 8 (PDF pages 146 to 148):
   notice at least 2 days ahead, fast-track appeal to the Quality Improvement Organization by noon the day before
   coverage ends, a decision within one full day of the reviewers having the information. */
(function (root, factory) { if (typeof module !== "undefined" && module.exports) module.exports = factory(); else root.CureCueScript = factory(); })(typeof self !== "undefined" ? self : this, function () {
  const VERIFY = [
    { w: "Advocate", t: "Thanks for calling. Before I can look at anything, can I get your full name?" },
    { w: "Rosa", t: "Rosa Martinez.", h: [1, "Rosa Martinez"] },
    { w: "Advocate", t: "And your date of birth?" },
    { w: "Rosa", t: "March 9th, 1955.", h: [2, "03/09/1955"] },
    { w: "Advocate", t: "Last four of your member ID?" },
    { w: "Rosa", t: "4821.", h: [3, "4821"] }];
  const CALL = [
    { w: "Rosa", t: "This is the third time I've called about this bill from the skin doctor." },
    { w: "Advocate", t: "I'm sorry, Rosa. I can see both earlier calls, so you won't have to repeat yourself. Let's sort it out." },
    { w: "Rosa", t: "They billed me $120 for the skin doctor and I thought I only pay $25." },
    { w: "Advocate", t: "Let me check where the biopsy on September 30th was done." },
    { w: "Rosa", t: "While I have you, if I go to the ER and they admit me, what do I owe?" },
    { w: "Rosa", t: "And my mother is in rehab. They are sending her home on Thursday and she is not ready." },
    { w: "Advocate", t: "I'm bringing a supervisor onto the call for that right now." }];
  // Plays once the advocate connects the supervisor.
  const SUPERVISOR = [
    { w: "Supervisor", t: "Hi Rosa, this is Dana, the supervisor. I'm sorry you're dealing with this. Is your mother a member with us too?" },
    { w: "Rosa", t: "Yes, Elena Martinez. I'm her authorized representative." },
    { w: "Supervisor", t: "I can see that on her record. Did the rehab facility give her a written notice called the Notice of Medicare Non-Coverage?" },
    { w: "Rosa", t: "They had her sign something this morning. Does that mean she agreed to leave?" },
    { w: "Supervisor", t: "No. Signing only shows she received it. Her coverage ends on Thursday, so she can ask for a fast-track appeal. The deadline is noon tomorrow." },
    { w: "Rosa", t: "Who decides? You?" },
    { w: "Supervisor", t: "No. The Quality Improvement Organization decides. They're independent doctors paid by the federal government, not part of the plan, and they decide within one full day of having her information." },
    { w: "Rosa", t: "Can we do it right now?" },
    { w: "Supervisor", t: "Yes. I'm conferencing them in, and I'll stay on until they confirm the appeal is filed." },
    { w: "Supervisor", t: "They've confirmed it. Your mother's appeal is filed, and the plan will send the detailed reasons for ending her coverage today." }];
  // The advocate's close depends on what was confirmed on the call; every variant is recorded.
  const CLOSE = {
    bill: {
      hospital: "On your bill: the biopsy was done in the hospital's outpatient department, so the $120 copay is correct under your plan.",
      office: "On your bill: the biopsy was done in the doctor's office, so it should have been $25. I've sent the claim back to be reprocessed.",
      unknown: "On your bill: I still need to confirm where the biopsy was done, so I'll call you back with the answer."
    },
    grievance: {
      logged: "I've logged your repeat calls as a complaint, and noted that we answered it on today's call.",
      declined: "I've noted your repeat calls on your record."
    },
    wrap: "I'm scheduling a callback for Thursday morning to check the decision on your mother's appeal, and texting you a recap.",
    thanks: "Thank you both. That finally makes sense."
  };
  // Every line that can be spoken, for the recorder.
  function allLines() {
    const out = [...VERIFY, ...CALL, ...SUPERVISOR];
    Object.values(CLOSE.bill).forEach(t => out.push({ w: "Advocate", t }));
    Object.values(CLOSE.grievance).forEach(t => out.push({ w: "Advocate", t }));
    out.push({ w: "Advocate", t: CLOSE.wrap }, { w: "Rosa", t: CLOSE.thanks });
    return out;
  }
  return { VERIFY, CALL, SUPERVISOR, CLOSE, allLines };
});
