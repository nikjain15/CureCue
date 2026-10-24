/* Golden set: member turns labelled by a person, without running the rules.
   t: what the member said. v: expected verdict (answer | human | escalate). c: expected clause id for an answer, else null.
   g: true when the turn expresses dissatisfaction that counts as a grievance even without the word.
   Labelled 2026-10-24. Synthetic: no real member, plan or document. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.CureCueGolden = factory();
})(typeof self !== "undefined" ? self : this, function () {
  return [
    // Benefit questions that a plan rule settles
    { t: "How much do I pay to see my regular doctor?", v: "answer", c: "S-PCP" },
    { t: "I want to see a dermatologist, what's the copay?", v: "answer", c: "S-SPEC" },
    { t: "What is my out-of-pocket max this year?", v: "answer", c: "S-MOOP" },
    { t: "If I go to the ER what do I pay?", v: "answer", c: "S-ER" },
    { t: "They billed me $120 for a specialist visit and I thought I only pay $35.", v: "answer", c: "S-SPEC" },
    { t: "If the ER admits me what do I owe?", v: "answer", c: "S-ER" },
    { t: "Do I need a referral for a specialist?", v: "answer", c: "S-SPEC" },
    { t: "What's the most I can pay in a year?", v: "answer", c: "S-MOOP" },
    { t: "While I have you, if I go to the ER and they admit me, what do I owe?", v: "answer", c: "S-ER" },
    { t: "Is primary care free on my plan?", v: "answer", c: "S-PCP" },
    // Account questions: the claim system, not a plan rule
    { t: "Why hasn't my claim from March been paid?", v: "human", c: null },
    { t: "My premium was charged twice.", v: "human", c: null },
    { t: "Is there a problem with my EOB?", v: "human", c: null },
    // Dissatisfaction without the word grievance: the advocate handles it, the system should hear it
    { t: "This is the third time I've called about this bill from the skin doctor.", v: "human", c: null, g: true },
    { t: "I've explained this again and again and nobody calls me back.", v: "human", c: null, g: true },
    { t: "Honestly this is ridiculous, I'm fed up.", v: "human", c: null, g: true },
    // Must escalate: a decision, a dispute, or distress. Nothing is drafted.
    { t: "My MRI was denied and I want to appeal.", v: "escalate", c: null },
    { t: "I want to file a grievance about the clinic.", v: "escalate", c: null },
    { t: "I'm having chest pain right now.", v: "escalate", c: null },
    { t: "They are sending my mother home from rehab and she is not ready.", v: "escalate", c: null },
    { t: "And my mother is in rehab. They are sending her home tomorrow and she is not ready.", v: "escalate", c: null },
    { t: "The hospital says you refused to pay for my stay.", v: "escalate", c: null },
    { t: "I want to complain, this is a formal complaint.", v: "escalate", c: null },
    { t: "I can't breathe properly since yesterday.", v: "escalate", c: null }
  ];
});
