# CureCue

An ambient assistant for member-service advocates at a Medicare Advantage plan. It listens alongside the advocate on a live call, speaks only when it has something useful, and never speaks to the member. The advocate stays accountable for every word.

**Live prototype:** `index.html` (advocate desktop). **How it is built and why:** `architecture.html`.

## What it does on one call

- **Verifies identity before anything.** Reads nothing and suggests nothing until the advocate confirms the member.
- **Hears dissatisfaction** that counts as a grievance even without the word, and asks the advocate to log it. Both answers are recorded.
- **Answers benefit questions from the plan's own rules,** walking a knowledge graph of clauses (specialist copay needs a referral, which comes from primary care; an ER copay is waived if admitted, then the hospital copay applies). Every figure is traced to a rule on the path. The path is the citation.
- **Stops hard** on anything near a coverage decision, a discharge dispute or distress. Nothing is drafted; a supervisor is brought in.
- **Drafts the note and the member recap** with a required-elements checklist. The advocate approves the note and sends the recap.
- **Turns every call into an eval row.** A generated scorecard, sectioned by AI principles, with gates that fail the build.

## Principles

Route first, then reason. Escalation wins every race. Fail closed. Deterministic first. Context engineered, not stuffed. Narrow, idempotent tools that never send or decide. Every figure sourced. Memory scoped. A kill switch per skill. Nothing changes itself: two named human gates in the improvement loop.

## Status

Low-fidelity working prototype. All members, plans, providers, figures and calls are synthetic. No real health plan, organisation, person or document is represented. The visual language is a design direction, not a brand.

## Roadmap

1. Synthetic dataset with a consistency check that runs before the engine (plans, clauses with plan-year versions, personas, calls, ground truth).
2. Agents as versioned skill files; harness; eval runner; CI gate.
3. Synthetic voice for the softphone.
4. Adversarial audit agent; canary simulation.
