# Test Plan & Verification: Competition Scheduling (PR #8)

**Date:** 2026-07-01
**Feature:** Competitions (name + date + A/B/C priority) on the periodization plan
**Branch:** `claude/plan-competitions`

## What changed

- `src/types.ts` — new `CompetitionPriority` + `PlannedCompetition` types;
  optional `plannedCompetitions` collection on `Dataset`.
- `src/data/store.tsx` — store normalises the collection to `[]` for older
  persisted datasets; new `savePlannedCompetitions(athleteId, sportId, comps)`
  mutation (replace-per-athlete+sport).
- `src/pages/Periodization.tsx` — Competitions editor in the Plan setup card;
  dashed priority-coloured markers on the load curve; 🏆 banner pills on
  calendar week cards; 🏆 markers in the list view; Save plan persists the
  schedule alongside the weeks.

## Automated / static checks

- [x] `tsc -b` passes (strict mode; no unused locals/params)
- [x] `npm run build` succeeds, production bundle emitted
- [x] Backwards compatibility: `Dataset.plannedCompetitions` is optional and the
  store defaults it, so existing localStorage datasets load unchanged

## Manual smoke test (when a browser is available)

```bash
npm run dev   # http://localhost:5173/#/periodization → Build plan
```

### Competitions editor (Plan setup card)
- [ ] "+ Add" creates a row defaulted to the first Competition-phase week,
      priority A
- [ ] Name, date and priority are editable; the row dot matches the priority
      colour (A rose, B amber, C slate)
- [ ] "×" removes the row
- [ ] Setting a date before the plan start / after the last week shows the
      "outside plan" warning

### Load curve
- [ ] Each in-plan competition draws a dashed vertical line at its week,
      coloured by priority, labelled with its name above the chart
- [ ] A/B/C legend entries appear only for priorities in use
- [ ] Out-of-plan competitions draw no line (editor still lists them)

### Calendar & list views
- [ ] Calendar: the week card containing the competition shows a
      priority-coloured 🏆 banner with the name and priority letter
- [ ] Two competitions in the same week stack as two banners
- [ ] List: 🏆 appears next to the week start date; hover tooltip shows
      name · priority · date

### Persistence
- [ ] Save plan → "Saved at …" appears; note mentions the competition schedule
- [ ] Switch athlete and back → saved competitions reload in the editor
- [ ] Unnamed competitions save as "Competition"
- [ ] Saving with zero competitions clears any previously saved schedule for
      that athlete+sport (and leaves other athletes' schedules alone)

## Known limitations & follow-ups

- The generator does not yet shape the curve around competitions (e.g.
  auto-taper into an A comp) — markers are an overlay only.
- Analyze mode doesn't show planned competitions yet (it charts logged
  `competitionResults` only).
- No recurring competitions or multi-day events (a competition is a single
  date).
