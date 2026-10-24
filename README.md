# CureCue

An ambient assistant for member-service advocates at a Medicare Advantage plan. The assistant, **Cue**, listens alongside the advocate on a live call, speaks only when it has something useful, and never speaks to the member. The advocate stays accountable for every word.

**Site:** `index.html` (what it is). **Advocate desk:** `app/` (the demo call, with voice). **How it is built and why:** `architecture.html`. **The rules both run on:** `rules.js`. **The eval:** `eval/`.

## Voice

The call plays with recorded clips when `app/audio/manifest.json` exists, otherwise with the browser's own voices (Web Speech API), otherwise as a streaming transcript. To generate the clips with ElevenLabs on your own machine:

```
ELEVEN_API_KEY=... ./scripts/make-voices.sh
```

The key is read from the environment only. Clips are gitignored; commit them deliberately if they should ship with the site.

## What it does on one call

- **Verifies identity before anything.** Cue shows what it heard next to each check; the advocate ticks the box. It reads nothing and suggests nothing until then.
- **Hears dissatisfaction** that counts as a grievance even without the word, and asks the advocate to log it. Both answers are recorded in the note.
- **Answers benefit questions from the plan's own rules,** walking a knowledge graph of clauses (specialist copay needs a referral, which comes from primary care; an ER copay is waived if admitted, then the hospital copay applies). Every figure in a draft is checked against the nodes on the path; a figure that is not there fails the eval.
- **Stops hard** on anything near a coverage decision, a discharge dispute or distress. Nothing is drafted; a supervisor is brought in.
- **Drafts the note and the member recap from this call only,** with a required-elements checklist. The advocate approves the note and sends the recap.
- **Scores itself the same way CI does.** The Quality tab runs `rules.js` against `eval/golden.js` in the page; `eval/run.mjs` runs the same two files on every push and a missed gate fails the build.

## The eval

```
node eval/run.mjs        # scores the release set in rules.js (CURRENT_RELEASE)
node eval/run.mjs 1      # scores an older release; Release 1 is blocked on escalation recall
```

`eval/golden.js` is 24 member turns labelled by a person without running the rules: expected verdict (answer, human, escalate), expected clause, and whether the turn carries dissatisfaction. The runner checks the golden set for internal consistency before it scores anything. Gates: escalation recall 1.00, escalation precision 0.80, figures off the cited path 0, citation accuracy 0.95, grievance recall 0.90, verdicts outside the three-value enum 0. The report lands in `eval/out/`.

## Principles

Route first, then reason. Escalation wins every race. Fail closed. Deterministic first. Context engineered, not stuffed. Narrow, idempotent tools that never send or decide. Every figure sourced. Memory scoped. A kill switch per skill. Nothing changes itself: two named human gates in the improvement loop.

## Status

Working prototype with rule-based agents, one synthetic plan and one scripted call. All members, plans, providers, figures and calls are synthetic. No real health plan, organisation, person or document is represented. The visual language is a design direction, not a brand. No model is called; the architecture page shows where models and a validated judge would sit.

## Roadmap

1. Larger synthetic dataset with a consistency check that runs before the engine (more plans, clauses with plan-year versions, personas, calls).
2. Agents as versioned skill files behind the same `decide()` contract; a model behind the enterprise gateway for composition.
3. Synthetic voice for the softphone.
4. Adversarial audit agent; canary simulation.
