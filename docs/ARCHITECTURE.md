# Metron — Architecture Reference

_Last updated: 2026-06-22_

This document describes how the Metron dashboard is put together: the domain
model, data flow, the statistics that power the analytics, and how each page
consumes them. It is the canonical reference for future development.

## 1. Stack

| Concern        | Choice                                              |
| -------------- | --------------------------------------------------- |
| UI framework   | React 18 + TypeScript                               |
| Build tool     | Vite 5                                              |
| Charts         | Recharts                                            |
| Routing        | React Router (**HashRouter**, see §6)               |
| Persistence    | Browser `localStorage` (no server)                  |
| Hosting        | GitHub Pages, published by GitHub Actions           |
| Fonts          | Inter (body) + Space Grotesk (display)              |

There is **no backend**. All data lives client-side and is seeded from a
reproducible synthetic generator on first load.

## 2. Directory map

```
src/
  components/
    Layout.tsx     Sidebar nav (SVG line-icons), PageHead component
    ui.tsx         Avatar, StatCard, Bar, Card primitives
  data/
    catalog.ts     Sports, events, TEST_TYPES, colors, commonTests()
    generate.ts    Synthetic dataset generator (40 athletes)
    store.tsx      React context + localStorage persistence
  lib/
    stats.ts       mean, stdDev, pearson, linearRegression, zScore,
                   percentileRank, correlationStrength, round
    format.ts      ageOn, yearsBetween, ageBand, genderLabel, formatDate,
                   formatMonth, initials
  pages/
    Overview.tsx        Squad KPIs, testing volume, composition
    Athletes.tsx        Roster table + "Add athlete" form
    AthleteProfile.tsx  Per-athlete battery vs peers, progression, load
    Testing.tsx         Testing log + "Record test" form
    Results.tsx         Season-best leaderboard, mark progression, UTR
    Correlations.tsx    Correlation heatmap + scatter explorer
    PeerComparison.tsx  Percentile radar vs same gender+age band peers
    CrossSport.tsx      Cross-sport population & athlete-vs-all comparison
    Periodization.tsx   Load vs test progress, phase breakdown
  types.ts         Domain model (see §3)
  App.tsx          Route table
  main.tsx         HashRouter mount
  index.css        Full design system (glassmorphism dark theme)
```

## 3. Domain model (`src/types.ts`)

- **Athlete** — `id`, `name`, `gender` (`"M" | "F"`), `birthDate`, and one or
  more **AthleteProfile**s.
- **AthleteProfile** — ties an athlete to a `sportId`, their `eventIds`,
  experience (years), and anthropometrics (height, mass). An athlete can in
  principle carry profiles for multiple sports; the current dataset assigns one
  sport each, and most code reads `athlete.profiles[0]`.
- **Sport** — `id`, `name`, and a list of **SportEvent**s.
- **SportEvent** — `id`, `name`, `unit`, `higherIsBetter`. For tennis the unit
  is **UTR** (Universal Tennis Rating, ~1–16.5, higher is better).
- **TestType** — a physical test: `id`, `name`, `shortName`, `unit`,
  `category` (Speed/Power/Strength/Endurance/Mobility), `higherIsBetter`, and a
  `sports` array scoping which sports use it (`[]` = all sports).
- **TestResult** — `athleteId`, `testTypeId`, `date`, `value`.
- **CompetitionResult** — `athleteId`, `eventId`, `date`, `mark`.
- **TrainingWeek** / **PeriodizationPhase** — weekly planned vs actual load
  through the macrocycle.
- **Dataset** — the aggregate persisted to localStorage.

## 4. Test catalogue & cross-sport fairness (`src/data/catalog.ts`)

Each `TestType` declares which `sports` use it. Sport-specific tests are scoped
explicitly:

- **Tennis:** `agility505` (5-0-5), `serveVel`, `mbThrow`, `grip`, plus shared.
- **Athletics:** `sprint30`, `flying20`, `clean1rm`, `bench1rm`, plus shared.
- **Swimming:** `bench1rm`, plus shared.
- **Shared by all** (`sports: []`): `cmj`, `sj`, `broad`, `rsi`, `squat1rm`,
  `ift`, `sitreach`, and `sprint10` (explicitly listed for all three).

`commonTests()` derives the **fair cross-sport basis dynamically**: it returns
the tests that *every* sport uses (`sports: []` OR includes every sport id).
This is what the Cross-Sport page compares on, so adding a new sport
automatically narrows the shared battery without code changes.

> **Important:** `bench1rm` is scoped to `["athletics", "swimming"]` so it does
> **not** appear in tennis correlation matrices. Similarly tennis-only tests are
> excluded from other sports' views.

## 5. Statistics (`src/lib/stats.ts`)

- `mean`, `stdDev` — basic descriptive stats.
- `pearson(xs, ys)` — Pearson correlation coefficient.
- `linearRegression(xs, ys)` — slope/intercept for the scatter explorer trend
  line.
- `zScore(value, values)` — standardized score.
- `percentileRank(value, values, higherIsBetter)` — **the backbone of all
  normalized comparison.** Honours `higherIsBetter` so that for time-based tests
  (lower = better) a faster athlete still scores a higher percentile. 50 =
  median, 100 = best.
- `correlationStrength(r)` — labels an r value (weak/moderate/strong).
- `round(value, decimals)`.

**Normalization principle:** because test units differ (seconds, cm, kg, km/h),
any cross-test or cross-sport aggregate must convert to percentiles first. Raw
values are only ever compared **within a single test** (same unit).

## 6. Hosting specifics

- **`vite.config.ts`** sets `base: "./"` so asset URLs are relative and work
  under the `/metron-dashboard/` GitHub Pages path.
- **`src/main.tsx`** uses `HashRouter` (not `BrowserRouter`) so deep links like
  `/#/athletes/123` resolve on static hosting without server rewrites.
- **`.github/workflows/`** — a `build` job runs on every push/PR (type-check +
  Vite build + artifact upload); a `deploy` job runs only on non-PR events and
  publishes to the `github-pages` environment. The deploy environment only
  accepts deployments from the default branch (`main`), so feature branches must
  be merged to deploy. See `docs/DEPLOYMENT.md`.

## 7. Data store (`src/data/store.tsx`)

A React context wraps the app and exposes the dataset plus mutation actions:

- `addAthlete(profileInline)` — appends an athlete with an inline profile.
- `addTestResult(result)`
- `addCompetitionResult(result)`
- `resetData()` — regenerates the synthetic dataset.

Every mutation writes through to `localStorage`. On first load (empty storage)
the store seeds from `generateDataset()`.
