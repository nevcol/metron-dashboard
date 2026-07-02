# Metron — Engineering Mentorship Document

_Last reviewed: 2026-07-02_
_Covers all commits through `9843332`_

> This document is written for developers (human or AI) who are about to write code in Metron for the first time. Read it before touching anything.

---

## 1. READ ME FIRST

Eight things to internalize before you write a single line:

1. **There is no backend.** Everything is `localStorage`. The "dataset" is a deterministic synthetic fixture generated once at first load, then persisted. Mutations go through the store context — never write to `localStorage` directly.

2. **Derived state is not state.** No page stores computed values with `useState`. Every chart row, leaderboard, percentile, and composite score is derived via `useMemo` from the raw store. If you find yourself reaching for `useState` for something computed, stop — you're about to create a sync bug.

3. **Cross-unit comparison requires percentiles.** A 44 cm CMJ and a 1.74 s sprint cannot be averaged. The only mathematically valid cross-test aggregate is a percentile rank. `percentileRank` in `src/lib/stats.ts` is the single function that normalizes across units. Use it. Never raw-average values with different units.

4. **`higherIsBetter` is not optional metadata.** It lives on `TestType` and `SportEvent` and must be threaded into every sorting, coloring, and ranking operation. Forgetting it silently inverts the ranking (the slowest sprinter becomes the "best" sprinter).

5. **Percentiles are computed over the active filtered pool, not the global population.** This is intentional and documented. Do not "fix" it. It means "90th percentile among women 20–24" is a different number from "90th percentile across all athletes" — which is exactly what staff want.

6. **`TypeScript strict` with `noUnusedLocals` and `noUnusedParameters` will fail your build.** `npm run build` is `tsc -b && vite build`. An unused import is a build error, not a warning. Check `tsc --noEmit` before you push.

7. **HashRouter + `base: "./"` are not negotiable.** The app is hosted on GitHub Pages as a static site under a subpath. Switching to `BrowserRouter` or changing `base` will break all deployed links.

8. **The `athlete.profiles[0]` assumption is load-bearing.** The data model supports multiple sport profiles per athlete but the generator assigns exactly one. Many pages assume `profiles[0]` is the primary sport. This is technical debt, not a bug — see Section 8.

9. **Not every store mutation is append-only.** `addAthlete`/`addTestResult`/`addCompetitionResult` just append. `saveTrainingPlan` (added for the Periodization plan builder) is an **upsert keyed by `weekStart`** — it updates matching weeks in place (preserving `actualLoad`) and appends the rest. `savePlannedCompetitions` (added for competition scheduling) is a **replace-by-scope** mutation — it wipes and re-inserts the full competition list for one `athleteId + sportId` pair, leaving every other athlete/sport's schedule untouched. Three different mutation shapes now exist in the same store; check which one you're calling.

10. **Never hardcode a hex color in chart JSX — use the CSS var() chart tokens.** The app has two themes (Noir / Ivory, see Section 2) and every chart's grid, axis, tooltip, and primary series color is threaded through CSS custom properties (`--chart-grid`, `--chart-axis`, `--chart-axis-strong`, `--tooltip-bg`, `--tooltip-border`, `--tooltip-text`, `--series-1`) passed as `var(--token)` strings into Recharts SVG props (`stroke`, `fill`, `contentStyle`). A hardcoded `"#243456"` in new chart code will look fine in Noir and break in Ivory. Categorical/identity colors (`CATEGORY_COLORS`, `SPORT_COLORS`, `STRENGTH_PHASE_COLOR`, `QUALITY_COLOR`, `PRIORITY_COLOR`) are the deliberate exception — those stay theme-invariant by design so a sport or category keeps the same color regardless of theme.

11. **Optional dataset fields need a store-level default, not a page-level one.** `Dataset.plannedCompetitions` is typed `PlannedCompetition[] | undefined` specifically so older data persisted in `localStorage` (from before the field existed) doesn't crash on load. The normalization (`dataset.plannedCompetitions ?? []`) happens once, in `store.tsx`'s `StoreValue` construction — every page consumes `plannedCompetitions` via `useStore()` as a guaranteed array. If you add another optional collection to `Dataset`, normalize it in the store, not in each consuming page.

---

## 2. Architecture Mental Model

### Data flow

```
localStorage (STORAGE_KEY = "metron.dataset.v1")
  └─► StoreProvider (src/data/store.tsx)
        initializes: load() → generateDataset() on first visit
        exposes via context: Dataset + mutation actions
        writes back to localStorage on every dataset change (useEffect)
          └─► useStore() hook → consumed by every page
                └─► useMemo chains (page-local derived state)
                      └─► Recharts / JSX render
```

Nothing bypasses the store. Pages never read from `localStorage` or call `generateDataset` directly.

### The percentile normalization principle

Different tests have incompatible units (seconds, centimetres, kilograms, km/h). The only fair cross-test aggregate is to convert every test result to a **percentile rank within the relevant population**, then average those percentiles.

This is implemented in `src/lib/stats.ts`:

```ts
percentileRank(value, population, higherIsBetter): number
// Returns 0-100. 100 = best. Honors lower-is-better for time-based tests.
// Returns 50 if population is empty (safe default, not a crash).
```

When `higherIsBetter = false` (sprint times), the function counts athletes with a *worse* (higher) time as "below" you, so a faster time still earns a higher percentile. This inversion is the only place where `higherIsBetter` affects the math — everywhere else it affects sorting direction and display.

### How `filteredAthletes` drives CrossSport.tsx

The Cross-Sport page has a single root memo cascade. Every statistic flows from `filteredAthletes`:

```
filteredAthletes (useMemo from genderFilter + ageBandFilter)
  └─► { pool, pctFor, rawFor, composite } (useMemo)
        pool    = Map<testId, number[]>  — the per-test population for percentile calc
        pctFor  = (athleteId, testId) → percentile within pool
        rawFor  = (athleteId, testId) → raw value
        composite = Map<athleteId, number>  — mean of all pctFor values
  └─► sportAthletes (useMemo) — filteredAthletes bucketed by sport
  └─► sportRadar, sportSummary (useMemo)
  └─► ranked (useMemo) — sorted by composite
  └─► rawBoard (useMemo) — sorted by rawFor for a single selected test
```

Change `genderFilter` or `ageBandFilter` and the entire tree recomputes. If you add a filter, wire it to `filteredAthletes` — do not wire it to any individual downstream memo.

### Periodization: Analyze vs Build mode, and the plan builder

`Periodization.tsx` (now ~1,220 lines) has grown from a read-only analytics view into a dual-mode page:

```
Mode = "analyze" | "build"   (page-level useState, header seg toggle)

"analyze" — unchanged: load-vs-adherence charts, phase distribution,
            load-vs-test-progress scatter, all driven by existing trainingWeeks.

"build"   — PlanBuilder component: generates a draft macrocycle, lets the
            coach hand-edit it week by week, then persists it.
```

**Generation → edit → persist pipeline:**

```
PlanSettings (startDate, per-phase lengths, peakLoad, deload toggle, phaseQualities)
  └─► generatePlan(settings): DraftWeek[]   — pure function, no store access
        walks PHASE_ORDER, interpolates PHASE_SHAPE fraction-of-peak per week,
        applies a deload dip every 4th Preparation/Pre-Competition week,
        assigns strengthPhase (PHASE_DEFAULT_STRENGTH, or "Deload" on deload weeks)
        and primaryQuality (from settings.phaseQualities) per week
  └─► draft: DraftWeek[] (useState in PlanBuilder) — hand edits via editWeek() patch
  └─► saveTrainingPlan(athleteId, sportId, weeks) — store mutation, upserts by weekStart
```

`saveTrainingPlan` (`src/data/store.tsx`) is an **upsert keyed on `weekStart`**, not a
wholesale replace: any existing `TrainingWeek` whose `weekStart` matches a draft week is
updated in place (preserving its logged `actualLoad`); any draft week with no existing
match is appended. This means re-saving a plan, or extending it forward, never wipes the
two years of seeded training history that the Analyze view depends on. If you touch this
function, keep the upsert semantics — a naive "delete all + insert new" would silently
erase `actualLoad` for weeks already trained.

**Strength phases and training qualities** (`StrengthPhase`, `TrainingQuality` in
`src/types.ts`) are a second, finer-grained periodization axis layered onto the existing
`PeriodizationPhase`. Unlike `CATEGORY_COLORS`/`SPORT_COLORS` in `catalog.ts`, the color
maps and grouping catalogue for these two new types (`STRENGTH_PHASE_COLOR`,
`QUALITY_GROUPS`, `QUALITY_COLOR`, `PHASE_DEFAULT_STRENGTH`, `PHASE_DEFAULT_QUALITY`) live
as page-local constants at the top of `Periodization.tsx`, not in `catalog.ts`. This is a
deliberate deviation (these concepts are specific to the plan builder, not shared catalog
data like tests/sports) — but if a second page ever needs to render a quality pill or
strength-phase color, promote these maps to `catalog.ts` first rather than duplicating them.

**Calendar / List view toggle:** the weekly plan grid has its own `WeekView = "calendar" |
"list"` seg toggle (default `"calendar"`), independent of the page-level `Mode` toggle.
`CalendarView` groups draft weeks by month with phase-accent-bordered cards, colour-coded
strength-phase and primary-quality pills, and inline expand-to-edit (including secondary
quality toggles via `onToggleSecondary`). `list` view is the denser original grid with
Strength/Quality `<optgroup>` selects (`QualitySelect` component). Both views edit the same
`draft` state through the same `editWeek`/`toggleSecondary` callbacks — do not fork the
edit logic per view.

### Theme system: Noir / Ivory

The app ships two full themes, toggled from a sidebar control in `Layout.tsx`:

```
Theme = "noir" | "ivory"   (default "noir")

document.documentElement.dataset.theme  ← single source of truth for CSS
localStorage["metron.theme"]            ← persistence
```

Mechanics:

```
index.html — inline <script> (before any CSS/JS loads) reads
             localStorage["metron.theme"] and sets document.documentElement
             .dataset.theme synchronously. This runs pre-paint so there is
             no flash of the wrong theme on reload.
  └─► src/index.css
        :root { ... }                      — Noir tokens (default)
        :root[data-theme="ivory"] { ... }  — Ivory token overrides, plus
                                              per-selector overrides for
                                              body::before, .sidebar,
                                              .nav a.active, .pill.accent,
                                              .bar-track, etc.
  └─► Layout.tsx — useState<Theme>(initialTheme), useEffect writes
        document.documentElement.dataset.theme, updates the
        <meta name="theme-color"> tag, and persists to localStorage
        (wrapped in try/catch — private-mode storage can throw)
```

All themeable surface, text, and chart colors are CSS custom properties (see
Section 4's variable list, plus the newer chart tokens `--series-1`,
`--chart-grid`, `--chart-axis`, `--chart-axis-strong`, `--tooltip-bg`,
`--tooltip-border`, `--tooltip-text`, and the glass tokens `--glass-sheen`,
`--glass-tint`, `--glass-edge`, `--glow`, `--ring`, `--head-grad`). Every
Recharts chart across Overview/Correlations/CrossSport/PeerComparison/
Periodization/Results passes these as `var(--token)` strings into SVG
presentation props (`stroke`, `fill`, `contentStyle.background`, etc.) rather
than hardcoded hex, so a single theme switch re-colors every chart's chrome
without touching component code. Identity colors (`CATEGORY_COLORS`,
`SPORT_COLORS`, `STRENGTH_PHASE_COLOR`, `QUALITY_COLOR`, `PRIORITY_COLOR`) are
intentionally left as fixed hex values — they encode "which category/sport/
phase is this," not "what does the surface look like," and must stay stable
across themes so a sport's color doesn't change when the coach flips themes.

If you add a new chart, follow the existing pattern: reference the chart
tokens via `var(--...)`, never introduce a new hardcoded hex for grid lines,
axes, or tooltips.

### Competition scheduling on the periodization plan

Layered onto the plan builder (`PlanBuilder` in `Periodization.tsx`), coaches
can attach a list of future competitions (name, date, A/B/C priority) to the
plan being built:

```
PlannedCompetition (types.ts): { id, athleteId, sportId, date, name, priority }
CompetitionPriority = "A" | "B" | "C"   (A = key/taper target, B = important,
                                          C = training comp)

Dataset.plannedCompetitions?: PlannedCompetition[]   — optional field; the
  store normalizes it to `[]` (see READ ME FIRST #11) so older persisted
  datasets don't need a migration.

PlanBuilder local state: DraftComp[] (key, date, name, priority)
  — seeded on mount from any existing plannedCompetitions matching the
    current athlete+sport (re-seeds when you switch athlete/sport since the
    component is keyed by both).
  addComp / editComp / removeComp — plain array-of-objects edits, same
    "state holds user input, derive the rest" pattern as draft weeks.
  compMarkers (useMemo) — maps each dated competition onto the index of the
    draft week whose 7-day range contains it (compsInWeek/isoDayOffset
    helpers), for chart/calendar placement.

saveDraft() persists BOTH collections together:
  saveTrainingPlan(athleteId, sportId, draft)              — the weeks
  savePlannedCompetitions(athleteId, sportId, comps)        — the schedule
savePlannedCompetitions (store.tsx) is a replace-by-scope mutation: it drops
  any existing entries for this athleteId+sportId and re-inserts the current
  comps list. It does NOT upsert per-competition and does NOT touch other
  athletes'/sports' schedules.
```

Rendering surfaces for a scheduled competition:
- **Load curve chart** — a dashed, priority-colored Recharts `ReferenceLine`
  at the competition's week, labelled with its name; the A/B/C legend only
  renders entries for priorities actually in use (`PRIORITY_COLOR`,
  `PRIORITY_ORDER` — page-local constants, same convention as
  `STRENGTH_PHASE_COLOR`/`QUALITY_COLOR`).
- **Calendar view** — a priority-colored trophy banner on the week card that
  contains the competition.
- **List view** — a trophy marker with a hover tooltip next to the week's
  start date.

The plan setup card also flags a competition whose date falls outside the
current draft's week range ("outside plan" warning) — this is a UI hint only,
not a validation error; an out-of-range competition is still saved.

### The `commonTests()` fairness pattern

`src/data/catalog.ts` `commonTests()`:

```ts
export function commonTests(): TestType[] {
  return TEST_TYPES.filter((t) =>
    SPORTS.every((s) => t.sports.length === 0 || t.sports.includes(s.id)),
  );
}
```

A test is "common" if its `sports` array is empty (applies to all) OR it explicitly lists every sport. Adding a new sport that doesn't share a previously-shared test will automatically shrink the common battery — no code change needed. This is the architectural mechanism for cross-sport fairness.

---

## 3. Core Principles with WHY

### Derived state everywhere

No page stores computed values in `useState`. The pattern is:

```tsx
const [rawFilter, setRawFilter] = useState("all");      // state: user input only
const derived = useMemo(() => compute(raw, rawFilter), [raw, rawFilter]); // derived
```

WHY: A separate `useEffect` that computes and `setState`s derived values runs one render behind, creates snapshot inconsistencies, and makes the code harder to trace. `useMemo` is synchronous, always in sync, and makes the data flow explicit.

### Percentile-first for any cross-unit comparison

If you are comparing athletes across tests with different units, percentile is mandatory. If two values share the same unit and test (e.g. the CMJ leaderboard), raw values are fine.

### `higherIsBetter` honored everywhere

Thread `TestType.higherIsBetter` and `SportEvent.higherIsBetter` into:
- `percentileRank(value, population, higherIsBetter)` — stats.ts
- Sort directions on leaderboards
- "Beat the average" comparisons (`v >= popAvg` vs `v <= popAvg`)
- Bar width inversions when lower is better (`valueMax - r.value` in CrossSport)
- "Best" highlight in raw tables (min vs max)

Missing this will silently invert your rankings.

### Graceful empty states

Never call `Math.max(...arr)` or `mean([])` on arrays that might be empty. Every page component checks `if (!athlete)` or `if (filteredAthletes.length === 0)` before rendering and returns an `<div className="empty">` fallback. The stats library handles empty arrays:

- `mean([])` returns `0`
- `percentileRank(value, [], higherIsBetter)` returns `50` (median — safe, not crash)
- `stdDev` returns `0` for fewer than 2 points

### `effectiveAthleteId` fallback pattern

`CrossSport.tsx` lines 153–155:

```tsx
const effectiveAthleteId = ranked.some((r) => r.athlete.id === athleteId)
  ? athleteId
  : ranked[0]?.athlete.id ?? "";
```

State (`athleteId`) survives filter changes. But the selected athlete might not be in the new filtered pool. `effectiveAthleteId` remaps to the top-ranked athlete in the current pool without resetting state (so toggling the filter back restores the original selection). Use this pattern anywhere a selection can go stale due to filtering.

---

## 4. Conventions to Follow

### File layout

```
src/
  components/    Shared UI primitives (Layout, ui.tsx)
  data/          Data layer: catalog, generator, store
  lib/           Pure utility functions: stats, format
  pages/         One file per route, named PascalCase
  types.ts       All TypeScript interfaces — single source of truth
  App.tsx        Route table only
  main.tsx       ReactDOM.createRoot, providers, HashRouter
```

No co-located test files yet. No barrel `index.ts` files.

### Component patterns

Sub-components that belong to exactly one page live at the **bottom of that page file**, not in `src/components/`. Examples: `FilterBar`, `SquadOverview`, `RankTable` in `CrossSport.tsx`. Export these as named functions (not default), keeping them file-private by convention.

Shared primitives (`Avatar`, `Card`, `Bar`, `StatCard`) live in `src/components/ui.tsx`.

`PageHead` and `Layout` live in `src/components/Layout.tsx`. Every page opens with `<PageHead title="..." />`.

### The `.seg` toggle UI pattern

Segmented control for mode-switching (e.g. Percentile / Raw values):

```tsx
<div className="seg">
  <button className={mode === "pct" ? "active" : ""} onClick={() => setMode("pct")}>
    Percentile
  </button>
  <button className={mode === "raw" ? "active" : ""} onClick={() => setMode("raw")}>
    Raw values
  </button>
</div>
```

The `active` class is applied via className string concatenation, never via ternary on style. All `.seg` styling comes from `index.css`.

### TypeScript strictness

`tsconfig.json` enables `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`. These are enforced at **build time** via `tsc -b` (the build script is `tsc -b && vite build`). An unused import is a build failure. Before committing:

```bash
npm run lint   # tsc -b --noEmit
npm run build  # full type-check + bundle
```

Common failure modes:
- Importing a type but using it only as a value annotation (use `import type`)
- Destructuring a variable from `useStore()` that you don't reference
- Adding a function parameter you don't use (prefix with `_` to silence)

### CSS variables from `index.css`

Never hardcode colors or spacing in component JSX that should be themeable. Use CSS variables:

```
--text, --text-dim, --text-faint      Text hierarchy
--accent, --accent-2, --accent-3      Brand blue / indigo / purple
--good (#34d399), --warn (#fbbf24), --bad (#fb7185)   Semantic status
--bg, --bg-2, --panel, --panel-solid  Surface hierarchy
--border, --border-strong             Dividers
--radius, --radius-sm                 Border radius
--grad                                The three-stop brand gradient
```

For test category colors, use `CATEGORY_COLORS` from `src/data/catalog.ts`. For sport colors, use `SPORT_COLORS`. Never introduce a hardcoded color that duplicates one of these maps.

---

## 5. Gotchas and Pitfalls

### `bench1rm` is not universal — check `sports` before assuming

`src/data/catalog.ts` line 173: `bench1rm` has `sports: ["athletics", "swimming"]`. It is absent from tennis. `testsForSport("tennis")` will not return it. `commonTests()` will not return it. Code that calls `latestTests(results, id, "tennis").get("bench1rm")` will get `undefined`. Never assume a test appears in every sport's battery.

The general rule: `sports: []` means truly universal. Any non-empty `sports` array means scoped. When you add a test, think carefully which scoping you need.

### `athlete.profiles[0]` assumption

`src/types.ts` lines 56–58 define `profiles: AthleteProfile[]` (plural). The generator assigns one profile per athlete. But many pages read `athlete.profiles[0]?.sportId` as the primary sport. If a real multi-sport athlete were added:

- `CrossSport.tsx` line 99: `sportAthletes` would bucket by `profiles[0]?.sportId` — the athlete would appear only in their first sport's bucket.
- `Overview.tsx` line 87: `for (const p of a.profiles)` — this one iterates correctly.
- `AthleteProfile.tsx` line 34: reads `athlete?.profiles[0]?.sportId` for initial sport state — correct for the multi-sport select, but the initial default would always be profiles[0].
- `CrossSport.tsx` RankTable, line 601: `r.athlete.profiles[0]?.sportId` — would show wrong sport badge for multi-sport athletes.

This is a known limitation. Do not add multi-sport athletes to the generator without auditing these call sites first.

### Percentiles recompute over the filtered pool — this is correct

`CrossSport.tsx` lines 60–93: `pool` is built from `filteredAthletes`, not `athletes`. This means a player's percentile rank changes when you apply a gender or age filter. This is the intended behavior (staff want "top 10% among women 20–24"), but it surprises people who expect percentiles to be global. The `PageHead` subtitle text explicitly warns users: "normalized ... over the whole population" means the currently filtered population.

Do not refactor `pool` to use the full `athletes` array. That would break the filtering feature and contradict the documented design intent.

### HashRouter + `base: "./"` are required for GitHub Pages

`src/main.tsx` line 3: `HashRouter`. `vite.config.ts` line 6: `base: "./"`.

GitHub Pages serves the app under `/metron-dashboard/` (a subpath). `BrowserRouter` would break because the static server doesn't have rewrite rules. `HashRouter` puts the route in the URL fragment (`/#/athletes/123`), which never hits the server. Changing `base` to `"/"` would break asset loading under the subpath.

If you switch hosting to a server that supports rewrites (Vercel, Netlify, etc.) you could move to `BrowserRouter`, but you must also change `base` and all absolute links. Treat both as coupled.

### `tsc` strict mode: unused vars and params fail the build

`noUnusedLocals: true` and `noUnusedParameters: true` mean every `import` and every function parameter is checked. This is the most common source of build failures after refactoring. Checklist:

- Removed a feature but left the import? Build fails.
- Renamed a variable but kept the old name? Build fails.
- Added a utility function parameter for future use? Prefix with `_` or build fails.
- Used `import { A, B }` but only referenced `A`? Remove `B` or build fails.

### Strength-phase, training-quality, and competition-priority colors are page-local, not in `catalog.ts`

Unlike `CATEGORY_COLORS` and `SPORT_COLORS`, which live in `src/data/catalog.ts` per the
CSS-variable/color convention in Section 4, `STRENGTH_PHASE_COLOR`, `QUALITY_COLOR` (added
with the Periodization plan builder), and `PRIORITY_COLOR` (added with competition
scheduling) are defined at the top of `src/pages/Periodization.tsx`. This was a deliberate
scoping choice since only that page uses them today. If you need these colors on another
page, move them to `catalog.ts` first rather than importing them from `Periodization.tsx`
or re-declaring a duplicate map.

### Chart chrome colors must be theme tokens, not hex literals

Since the Noir/Ivory theme system landed (`src/index.css`, `:root` vs.
`:root[data-theme="ivory"]`), every chart's non-identity chrome — grid lines, axis strokes,
tooltip background/border/text, the primary area/line series — is wired through CSS custom
properties consumed as `var(--token)` strings in Recharts JSX (see "Theme system" in Section
2). Copy-pasting an old chart snippet with a literal hex (`stroke="#243456"`) will silently
break in Ivory mode while looking correct in Noir, because Noir happens to still ship
similar-looking colors as its defaults. Always check `git grep "var(--chart"` for the
current token names before adding a new chart.

### `latestTests` is O(n) over all test results

`src/data/store.tsx` lines 103–115: `latestTests` iterates the full `testResults` array on every call. Pages call it inside `useMemo` chains so this is acceptable for 40 athletes × ~600 test records. If the dataset grows significantly (hundreds of athletes), this becomes a hot path and will need indexing.

### `today` is hardcoded in `generate.ts` and `format.ts`

`src/data/generate.ts` line 78: `const today = new Date("2026-06-21")`.
`src/lib/format.ts` line 3: `const REFERENCE_DATE = new Date("2026-06-21")`.

These are intentionally frozen to make the synthetic dataset reproducible and deterministic. Do not change them to `new Date()` — that would make the generated dataset shift every day and break date-based comparisons. If you need real-time "today" for a feature (e.g. "days since last test"), add a separate `now` parameter.

---

## 6. How to Add a Feature Safely

### a) Adding a new sport

1. Add a `Sport` object to the `SPORTS` array in `src/data/catalog.ts` with its `events`.
2. Add a color entry to `SPORT_COLORS` in the same file.
3. Decide which tests apply to the new sport. Update each relevant `TestType.sports` array. If a test should apply to all sports (including new ones), leave `sports: []`.
4. Add the new sport's battery to `SPORT_BATTERY` in `src/data/generate.ts` (`ref` and `mass` arrays).
5. Add a name lookup to `FIRST_M`/`FIRST_F`/`LAST` only if you want generated athletes for it — optional.
6. Add a weight to the `sportPick` thresholds in `generateDataset()` if you want generated athletes in this sport.
7. Run `localStorage.removeItem("metron.dataset.v1")` in the browser (or click "Regenerate sample data" on the Overview page) to regenerate the dataset with the new sport.
8. Check `commonTests()` output — if the new sport only partially shares the common battery, you'll see the shared test list shrink. This is correct behavior.
9. Run `npm run build` to verify no regressions.

### b) Adding a new test type

1. Add a `TestType` entry to `TEST_TYPES` in `src/data/catalog.ts`. Set `sports: []` for universal tests, or list explicit sport IDs.
2. Add a `REF` entry in `src/data/generate.ts` (reference value for male/female, and `better: "high" | "low"`). If the test scales with body mass, add it to `MASS_TESTS` instead.
3. Add the test ID to the appropriate sport battery in `SPORT_BATTERY`.
4. If it is a strength/mass test, add a ratio to `MASS_TESTS`.
5. Regenerate the dataset (see step 7 above).
6. Verify: the test appears in the Correlation page for the relevant sport(s), the Peer Comparison radar, and the Athlete Profile battery table.
7. If `sports: []`, verify it appears in `commonTests()` output and therefore in the Cross-Sport page.
8. Run `npm run build`.

### c) Adding a new page

1. Create `src/pages/MyPage.tsx`. Default export a React component. Open with `<PageHead title="..." />`.
2. Add a `<Route path="/my-path" element={<MyPage />} />` to `src/App.tsx`. Remember to import the component.
3. Add a nav item to the `NAV` array in `src/components/Layout.tsx`. Inline a minimal SVG icon (follow existing pattern: `viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"`).
4. State: only put user input in `useState`. Compute everything else with `useMemo`.
5. Empty states: return a `<div className="empty">...</div>` if there are no athletes or no data.
6. Run `npm run lint` (type check) before `npm run build`.

---

## 7. Quality Bar

Every change must clear all three gates before merging:

```bash
# Gate 1: TypeScript
npm run lint        # runs: tsc -b --noEmit

# Gate 2: Full build
npm run build       # runs: tsc -b && vite build

# Gate 3: Manual smoke test
npm run preview     # serves the production build locally
```

- `tsc --noEmit` MUST report zero errors. Unused imports and unused parameters are errors, not warnings.
- `npm run build` MUST succeed. A passing lint does not guarantee the bundle compiles (Vite can have issues the type checker misses).
- The Overview, Cross-Sport, Peer Comparison, and Athlete Profile pages are the highest-risk surfaces — spot-check them after any stats or catalog change.
- There are no automated tests. Manual verification is all there is.

---

## 8. Technical Debt and Open Risks

**Single-profile assumption.** The domain model supports multiple sport profiles per athlete but nearly every page reads `athlete.profiles[0]`. This is at odds with the data model's intent and would break silently if a multi-sport athlete were added. Files affected: `CrossSport.tsx` (lines 99, 396, 601), `AthleteProfile.tsx` (line 34). Risk: medium. Fix: add a helper `primaryProfile(athlete): AthleteProfile | undefined` in `store.tsx` and centralize the `[0]` access.

**No test suite.** There are no unit tests, integration tests, or visual regression tests. The stats functions (`percentileRank`, `pearson`, `linearRegression`) are pure and deterministic — they are ideal candidates for unit tests. A wrong sign in `percentileRank` (the `higherIsBetter` inversion) would silently rank athletes backwards. Risk: high for future refactors.

**`latestTests` is O(n) on every call.** With 40 athletes this is fine. With 400+ athletes and real data, pages that call `latestTests` inside loops (Peer Comparison builds the peer pool by calling it per peer) would become slow. Mitigation: index `testResults` by `athleteId → sportId → testTypeId` in the store.

**Hardcoded reference date.** `generate.ts` and `format.ts` use `new Date("2026-06-21")`. This means "experience years" and "age" calculations will drift if the app is used in a different year without regenerating data. For a production system, the reference date should be parameterized or use `Date.now()`.

**No input validation on mutations.** `addAthlete`, `addTestResult`, and `addCompetitionResult` in `store.tsx` accept data without validation. A test result with an unknown `testTypeId`, a negative value, or a future date would be silently stored and corrupt analytics.

**`localStorage` size limit.** The current dataset (~40 athletes × 13 sessions × ~12 tests ≈ 6,000+ records) is well within the 5 MB browser limit. Real-world usage with large squads and years of data will hit this limit with no graceful degradation.

**`Math.max(...arr)` spread calls on large arrays.** `Overview.tsx` and others use `Math.max(...competitionResults.map(...))`. This can cause a stack overflow for arrays with tens of thousands of elements (JavaScript's argument limit). Safer: use `arr.reduce((a, b) => Math.max(a, b), -Infinity)`.

**Filtering only on Cross-Sport.** Gender and age-band filters exist only on the Cross-Sport page. The Correlations and Peer Comparison pages use sport-only filtering. A female swimmer in a mixed-gender sport cohort on the Correlations page will be compared against male athletes, which distorts correlation matrices. This is called out in `docs/DEVELOPMENT_LOG.md` as an open follow-up.

**No CSV/export.** The only way to get data out is the browser's developer console. This is a usability gap for real coaching staff.

---

## Auto-Update Protocol for Future Sessions

### For Claude Code agents

At the start of every new session on this project, re-read this file, then spawn a fresh Engineering Mentor agent (using the Agent tool with subagent_type: "general-purpose") with this prompt:

> "You are the Engineering Mentor for Metron. Read docs/mentors/ENGINEERING_MENTOR.md to understand your role. Then audit recent changes since the last update (check git log --oneline -20 and diff vs the last date in this doc). If anything has changed architecturally — new pages, new patterns, new gotchas, new debt — update docs/mentors/ENGINEERING_MENTOR.md accordingly. Update the 'Last reviewed' date. Commit the updated file with message 'Update engineering mentorship doc'. Report what changed and what you updated."

Run this agent BEFORE starting new feature work so the mentorship doc stays current.
