# CureCue

An ambient assistant for member-service advocates at a Medicare Advantage plan. The assistant, **Cue**, listens alongside the advocate on a live call, speaks only when it has something useful, and never speaks to the member. The advocate stays accountable for every word.

**Site:** `index.html` (what it is). **Advocate desk:** `app/` (the demo call, with voice). **How it is built and why:** `architecture.html`. **The rules both run on:** `rules.js`. **The eval:** `eval/`.

## Voice

The call plays with recorded clips when `app/audio/manifest.json` exists, otherwise with the browser's own voices (Web Speech API), otherwise as a streaming transcript. To generate the clips with ElevenLabs on your own machine:

```
ELEVEN_API_KEY=... ./scripts/make-voices.sh
```

The key is read from the environment only. Clips are gitignored; commit them deliberately if they should ship with the site.

## The desk, day to day

- **Home is Cue's briefing.** Callbacks you promised that fall due today, cases close to their clock, members likely to call back and why, yesterday's QA note, and a log of what Cue computed overnight with the rows it read. Every line traces to `app/data.js`.
- **In a call:** softphone, transcript, Cue's cues with a Why and a source, a member 360 (plan, claims, cases, contacts, pharmacy) that Cue opens to the right tab as the call moves, and four actions Cue pre-fills and the advocate confirms: open case, schedule callback, send document, transfer.
- **Ask Cue:** a typed question is answered only from plan rules on file; account questions go to the claim system; disputes stop; anything else is an abstention, said out loud.
- **After the call:** note and recap from this call only, a checklist, then the call lands in My day with cues accepted, QA sampling and one line of feedback.

`scripts/gen-data.mjs` generates the synthetic book of business deterministically; `eval/check-data.mjs` checks it as data (every reference resolves, every claim adds up, every clock computes) and runs in CI before the eval.

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
