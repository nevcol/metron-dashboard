# Test Plan & Verification: Tabbed Athlete Profile (PR #9)

**Date:** 2026-07-02
**Feature:** Reorganise the Athlete Profile into Overview / Schedule / Calendar / Testing tabs
**Branch:** `claude/athlete-profile-organization-dl255l`

## What changed

- `src/pages/AthleteProfile.tsx` — rewritten as a tabbed page. Bio card and
  age/tests/competition-marks stat row stay visible above the tabs; the four
  tabs (`OverviewTab`, `ScheduleTab`, `CalendarTab`, `TestingTab`) are
  page-local components at the bottom of the file, following the existing
  "sub-components belong to their one page" convention.
- `src/pages/Periodization.tsx` — added `useSearchParams` support for
  `?athlete=<id>` and `?mode=build` so the profile's Schedule tab can deep-link
  into the builder with the right sport/athlete/mode preselected. Removed the
  page-local `PHASE_COLOR`/`PHASE_ORDER`/`STRENGTH_PHASE_*`/`QUALITY_*`/
  `PRIORITY_*` consts in favor of importing them from `catalog.ts`.
- `src/data/catalog.ts` — new exports: `PHASE_ORDER`, `PHASE_COLOR`,
  `STRENGTH_PHASE_ORDER`, `STRENGTH_PHASE_COLOR`, `QUALITY_GROUPS`,
  `ALL_QUALITIES`, `QUALITY_COLOR`, `PRIORITY_ORDER`, `PRIORITY_COLOR` — moved
  from `Periodization.tsx` so `AthleteProfile.tsx` can share them without
  duplicating the color maps.
- `README.md` — expanded the "Per-sport athlete profiles" bullet to describe
  the four tabs.
- `docs/ARCHITECTURE.md` — updated the directory map's `catalog.ts` and
  `AthleteProfile.tsx` one-liners; bumped "Last updated".
- `docs/DEVELOPMENT_LOG.md` — prepended entry (see above this file for the
  full write-up).

## Automated / static checks

- [x] `npm run build` (`tsc -b && vite build`) succeeds, production bundle
      emitted, no new chunk-size regressions beyond the pre-existing >500kB
      warning.
- [x] `npm run lint` (`tsc -b --noEmit`) — reports the same pre-existing
      `TS6310` composite-project warning that exists on `main` before this
      branch's changes (confirmed via `git stash` + re-run); not introduced
      or worsened by this change.
- [x] No new TypeScript errors, no unused locals/params introduced.

## Manual smoke test (performed via Playwright against `npm run dev`)

### Overview tab
- [x] Bio card, age/tests/competition-marks stats render above the tabs
- [x] Test progression chart renders for the default test (CMJ) and updates
      when a different test is selected
- [x] Training load chart (planned vs actual, last 26 weeks) renders
- [x] Competition results table lists the athlete's logged results

### Schedule tab
- [x] Empty state ("No periodization plan yet… Build one →") shown correctly
      logic-wise for athletes/sports with zero training weeks and zero
      scheduled competitions
- [x] Phase breakdown table (weeks / avg planned / avg actual / adherence)
      matches the athlete's `trainingWeeks` for the selected sport
- [x] "Edit plan →" and "Scheduled competitions" panel both present
- [x] After building and saving a plan (with a competition) from the
      Periodization builder, returning to this tab shows the updated phase
      totals and the new competition in the list

### Calendar tab
- [x] Weeks group by month, 12 weeks (~3 months) per page
- [x] ← Earlier / Later → shift the window and update the date-range label
- [x] Weeks with a matching `TrainingWeek` show the phase-coloured left
      border and strength-phase/primary-quality pills and load bar; weeks
      with no data render muted but still present (calendar continuity)
- [x] Logged test results appear as 🧪 markers on the correct week
- [x] A newly scheduled competition (added via the Periodization builder and
      saved) shows as a 🏆 priority-coloured banner on its exact week when
      paged into view
- [x] Legend at the bottom lists phase colors, scheduled-competition,
      logged-result, and test-logged markers unambiguously (fixed an initial
      draft where the priority-A legend dot was mislabeled "Competition",
      colliding with the phase-name "Competition")

### Testing tab
- [x] Percentile radar renders (confirmed against the equivalent chart on
      `PeerComparison.tsx` using the same athlete/data — matches)
- [x] Test battery vs peers table (percentile, standing bar, color-coded)
      renders with the same values as the previous single-view profile
- [x] "Full peer comparison →" link navigates to `/peers`

### Cross-page regression check
- [x] Navigated every route (`/`, `/athletes`, `/testing`, `/results`,
      `/correlations`, `/peers`, `/cross-sport`, `/periodization`) with the
      browser console open — zero errors
- [x] Periodization page Analyze mode, Build mode, and both Calendar/List
      weekly-plan views render unchanged after the catalog color-map move
- [x] Periodization deep link (`?athlete=<id>&mode=build`) correctly
      preselects sport, athlete, and Build mode; falls back to previous
      defaults when navigated to directly without query params

## Known limitations & follow-ups

- The Calendar tab's window size (12 weeks) and step are fixed; a future
  pass could add a "jump to today" button or a coarser month-picker for
  athletes with multi-year plans.
- The Schedule tab is intentionally read-only (phase summary + scheduled
  comps) rather than embedding the full plan builder, to avoid duplicating
  ~500 lines of builder UI; all editing still happens on the Periodization
  page, now one click away via the deep link.
- `ScheduleTab`'s phase adherence and `CalendarTab`'s week lookups both
  re-derive from `trainingWeeks` independently per tab (no shared memo across
  tabs) — acceptable at current dataset size per the existing `latestTests`
  precedent noted in the engineering mentorship doc.
