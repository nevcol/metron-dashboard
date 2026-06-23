# Test Plan & Verification: Periodization Plan Builder (PR #5)

**Date:** 2026-06-23
**Feature:** Macrocycle plan builder on the Periodization page
**Branch:** `claude/periodization-builder`

## What changed

- `src/data/store.tsx` — new `saveTrainingPlan(athleteId, sportId, weeks)` mutation
  (upsert by `weekStart`, preserves logged `actualLoad`).
- `src/pages/Periodization.tsx` — Analyze / Build-plan mode toggle; new
  `PlanBuilder` sub-component with a guided generator, editable weekly grid, and a
  phase-coloured load-curve preview.
- `README.md`, `docs/DEVELOPMENT_LOG.md` — updated.

## Automated / static checks

- [x] `tsc -b` passes (strict mode; no unused locals/params)
- [x] `npm run build` succeeds, production bundle emitted
- [x] Generator verified numerically (standalone script):
  - Start date snaps to the Monday on/after the chosen date
  - 18 weeks for default lengths (8/4/4/2)
  - Consecutive weeks are exactly 7 days apart
  - Load curve is a sensible macrocycle: Preparation builds toward the peak with
    deload dips on every 4th build week, Pre-Competition intensifies then tapers,
    Competition tapers down, Transition deloads

## Manual smoke test (when a browser is available)

```bash
npm run dev   # http://localhost:5173/#/periodization
```

### Mode toggle
- [ ] Header shows an Analyze / Build-plan segmented toggle
- [ ] Analyze mode renders the original charts unchanged
- [ ] Build mode renders the Plan setup card + load curve + weekly grid

### Guided generator
- [ ] Changing a phase length regenerates the curve and grid
- [ ] Changing the peak load rescales the bars
- [ ] Toggling "Deload every 4th build week" adds/removes the dips
- [ ] Changing the start date shifts all week dates (Monday-aligned)

### Manual edits
- [ ] Editing a week's phase recolours its bar and updates the legend mapping
- [ ] Editing a week's planned load updates the bar and preview chart
- [ ] The per-row mini bar scales against the current peak

### Persistence
- [ ] "Save plan" writes the plan and shows a "Saved at …" confirmation
- [ ] Switching to Analyze shows the saved weeks in the load-vs-progress chart
- [ ] Re-saving / editing does not wipe the athlete's earlier (seeded) history
- [ ] Switching athlete/sport resets the builder (component is keyed by both)

## Known limitations & follow-ups

- Saved future weeks have `actualLoad = 0`, so Analyze adherence reads 0% until
  training is logged (expected — the plan hasn't been executed yet).
- No session/exercise-level detail yet (sets, reps, drills) — this version plans
  at the weekly-load + phase granularity only.
- No reusable plan templates yet (build once, apply to many athletes).
- Plans are not yet exportable (CSV/PDF).
