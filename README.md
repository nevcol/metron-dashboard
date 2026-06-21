# Metron — Athlete Testing & Periodization Dashboard

Metron is a testing-focused athlete tracking dashboard. It centres on physical
**testing** data and the relationships around it: how tests connect to one
another, to demographics (age, gender, experience, sport, event), to where an
athlete stands among peers, and to training load and competition results.

> The name comes from the Greek *métron* — "measure".

**Live demo:** https://nevcol.github.io/metron-dashboard/ (published from CI on
each push to the development/main branches via GitHub Pages).

## What it does

- **Per-sport athlete profiles.** Each athlete carries a separate profile for
  every sport they compete in, with their events, experience and a full test
  battery.
- **Testing log.** Record and browse every physical test (sprints, jumps,
  strength, aerobic, mobility) across the squad, with a quick entry form.
- **Correlation analysis.** A pairwise correlation matrix and an interactive
  scatter explorer reveal how qualities relate to each other and to age,
  experience and body mass. Tests are *oriented* so a higher score always means
  a better performance, making the signs intuitive.
- **Peer comparison.** Percentile-rank radar and leaderboards place an athlete
  against peers of the same gender and five-year age band within the sport.
- **Results tracking.** Season-best rankings per event and the progression of
  competition marks over the season.
- **Periodization & load.** Weekly training load through the macrocycle phases,
  charted against test progress, plus a squad-level view of how average training
  load relates to test gains.

## Tech

- React 18 + TypeScript + Vite
- Recharts for visualisation
- React Router for navigation
- A small statistics library (`src/lib/stats.ts`): mean, SD, Pearson
  correlation, linear regression, z-score and percentile rank
- Client-side only. A realistic, **reproducible synthetic dataset** is generated
  on first load (`src/data/generate.ts`) and persisted to `localStorage`. The
  generator deliberately embeds real relationships (jump power ↔ sprint speed,
  strength ↔ power, training load ↔ test improvement, test gains ↔ competition
  results) so the analytics show meaningful signal. Use **Regenerate sample
  data** on the overview to reset.

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check and produce a production build
npm run preview  # preview the production build
```

## Project structure

```
src/
  components/    Layout, navigation and shared UI primitives
  data/          Catalog (sports, events, tests), dataset generator, store
  lib/           Statistics and formatting helpers
  pages/         Overview, Athletes, Athlete profile, Testing, Results,
                 Correlations, Peer comparison, Periodization
  types.ts       Domain model
```

## Roadmap ideas

- Real backend / multi-user data entry and authentication
- Configurable test catalogue and custom event types per organisation
- Normative reference tables (external benchmarks, not just internal peers)
- Injury/availability tracking layered onto the periodization view
- Export of athlete reports (PDF) and CSV import of test data
