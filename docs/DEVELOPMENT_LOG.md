# Metron — Development Log

A chronological record of what was built, in what order, and why. Newest first.

---

## 2026-07-01 — Dual themes: premium "Noir" + white/gold/grey "Ivory" (branch `claude/dashboard-glassmorphism-style-ecqupc`)

**What:** Introduced a two-theme system on top of the liquid-glass restyle. The
dark graphite/violet look is now the "Noir" theme; a new "Ivory" theme delivers
a white/gold/grey luxury variant. A Noir/Ivory segmented toggle lives at the
bottom of the sidebar, persisted to `localStorage` under `metron.theme` (a UI
preference key, deliberately separate from the dataset store — the "mutations go
through the store" rule applies to athlete data, not chrome preferences).

**Mechanism:**
- `index.html` sets `data-theme` on `<html>` from `localStorage` in an inline
  script before first paint (no flash of wrong theme). `Layout.tsx` owns the
  toggle state, mirrors it to `document.documentElement.dataset.theme`, keeps
  the `theme-color` meta in sync, and persists it.
- All theming is CSS-variable-driven. `:root` holds Noir; a
  `:root[data-theme="ivory"]` block overrides surfaces, text, brand accents
  (gold `#a17d1a` scale), gradients, glass sheen/edge tokens, glows, shadows,
  and semantic status colors. A handful of component rules that hardcoded
  white-on-gradient text or purple-tinted tracks get explicit ivory overrides.
- **Charts are themed through CSS variables passed directly to Recharts props**
  (`stroke="var(--chart-grid)"`, `fill="var(--series-1)"`, tooltip
  `contentStyle` vars). Chromium/Firefox resolve `var()` in SVG presentation
  attributes — verified empirically in this session before adopting the
  approach. New chart tokens: `--series-1`, `--chart-grid`, `--chart-axis`,
  `--chart-axis-strong`, `--tooltip-bg/border/text`.
- Glow shadows use an `rgba(var(--glow), α)` triplet pattern so one variable
  re-colours every glow per theme.

**Color discipline:** The primary series colors were validated (lightness band,
chroma floor, contrast ≥ 3:1 vs the card surface) rather than eyeballed —
Noir's purple snapped to `#9d7bf5`, Ivory's gold to `#a17d1a`. Categorical maps
(`SPORT_COLORS`, `CATEGORY_COLORS`, `PHASE_COLOR`, `STRENGTH_PHASE_COLOR`,
`QUALITY_COLOR`, `AVATAR_COLORS`) remain fixed hex values in both themes —
identity colors must not change when the theme does.

**Why:** Requested premium/high-end elevation plus a white/gold/grey option.
Doing it as a variable-driven theme system (rather than a palette swap) means
future themes are an override block, not another sweep through seven pages.

---

## 2026-07-01 — Glassmorphism gray/purple re-theme (branch `claude/dashboard-glassmorphism-style-ecqupc`)

**What:** Re-skinned the entire dashboard's visual theme from the blue/indigo/purple
brand palette to a gray/purple glassmorphism look. This is a chrome-only change —
no components, routes, data flow, or page structure were touched.

**Theme (`src/index.css`):**
- Brand variables shifted from blue-led (`--accent: #38bdf8` sky blue) to a
  violet-to-slate scale (`--accent: #a78bfa`, `--accent-2: #8b5cf6`,
  `--accent-3: #64748b`). `--grad` now sweeps violet → slate gray instead of
  blue → indigo → purple.
- Surfaces (`--bg`, `--panel`, `--panel-2`, `--border`, text hierarchy) recast as
  dark, purple-tinted grays instead of navy/blue-black.
- `.card` and `.sidebar` blur increased (16px → 22px, 14px → 20px) with added
  `saturate()` and a subtle inset top highlight for a stronger glass sheen.
- Buttons, focus rings, pills, scrollbars, and the body's ambient radial glows
  all recolored to match.

**Charts and per-page literals:** Recharts components pass color as literal
props (not CSS vars), so the same shift was applied by hand across
`Overview.tsx`, `Correlations.tsx`, `PeerComparison.tsx`, `CrossSport.tsx`,
`Periodization.tsx`, `Results.tsx`, `AthleteProfile.tsx`:
- Chart chrome (grid lines, tooltip background/border/text, axis strokes/ticks)
  moved from blue-slate hex literals to the same gray-purple family.
- The single-series "primary" data color used for trend lines, radar self-series,
  and default scatter points moved from the old blue accent to the new purple
  accent (`#a78bfa`).

**Deliberately left unchanged:** `CATEGORY_COLORS`, `SPORT_COLORS`,
`PHASE_COLOR`, `STRENGTH_PHASE_COLOR`, `QUALITY_COLOR`, and the `AVATAR_COLORS`
palette in `src/data/catalog.ts` / `src/pages/Periodization.tsx` /
`src/components/ui.tsx`. These are categorical/semantic color-coding (they
distinguish sports, test categories, phases, or individual athletes from one
another) rather than brand chrome, and the Engineering Mentor doc explicitly
warns against duplicating or destabilizing these maps.

**Why:** Requested visual refresh to a gray/purple glassmorphism style. Scoped
to theme chrome and shared chart styling so the change is purely cosmetic and
carries zero risk to the stats/derived-state architecture.

**Follow-up — "liquid glass" pass:** Pushed the frosted look further toward an
Apple-style liquid-glass aesthetic, still `index.css`-only:
- New reusable tokens: `--glass-sheen` (diagonal specular streak),
  `--glass-tint` (corner violet light), `--glass-edge` (layered inset
  edge-lighting box-shadow).
- `.card` gains `position: relative; isolation: isolate`, deeper
  `backdrop-filter: blur(30px) saturate(185%)`, the `--glass-edge` inset
  lighting, and a `::before` (z-index -1, `pointer-events: none`) painting the
  sheen + tint on the glass surface beneath content. Hover lifts 1px.
- A fixed, slow-drifting `body::before` layer with three soft violet/slate orbs
  (`liquidDrift` keyframes, 28s) gives the background a subtle living motion;
  gated behind `prefers-reduced-motion: reduce`.
- Glossier interactive glass: buttons get a top-half `::before` highlight + white
  text on the gradient; the `.seg` control and its active tab, `select`/`input`,
  `.stat-ico`, `.pill.accent`, and the active nav link all pick up blur and/or
  inset top-highlights.
- Panels made a touch more translucent (lower alpha) so more of the drifting
  backdrop refracts through the glass.

---

## 2026-06-23 — Periodization plan builder (branch `claude/periodization-builder`)

**What:** Turned the Periodization page from a read-only analytics view into a
macrocycle **plan builder**. An Analyze / Build-plan `seg` toggle in the header
switches between the existing charts and the new builder.

**Build mode:**
- **Guided generator** (`generatePlan`): pick a start week, per-phase lengths
  (Preparation / Pre-Competition / Competition / Transition), a peak weekly load,
  and an optional "deload every 4th build week" toggle. The generator interpolates
  a fraction-of-peak ramp per phase (`PHASE_SHAPE`) — high-volume Preparation peak,
  intensify then taper into Competition, recover in Transition — mirroring the
  philosophy of the synthetic dataset's load values.
- **Manual edits:** every generated week is editable in a grid (change its phase
  or planned load); a phase-coloured bar chart previews the load curve live.
- **Persistence:** a new `saveTrainingPlan(athleteId, sportId, weeks)` store
  mutation **upserts by `weekStart`** — it updates the weeks the plan covers
  (preserving any logged `actualLoad`) and appends new weeks, leaving the rest of
  the athlete's history untouched. So building a forward plan never erases the two
  years of seeded training history that the Analyze view depends on.

**Why:** Metron could measure and analyse load but not *prescribe* it. This is the
first step toward authoring training programs on the platform; saved plans flow
straight back into the planned-vs-actual adherence table and the load-vs-progress
chart.

**Verification:** `tsc -b` clean; `npm run build` succeeds; generator output
checked numerically (correct Monday alignment, exact 7-day stepping, sensible
periodized curve with visible deloads). See `docs/TEST_VERIFICATION_PR5.md`.

---

## 2026-06-22 — Fix Pages deploy: one workflow, self-healing (branch `claude/fix-pages-deploy`)

**What:** After PR #3 merged to `main`, the GitHub Pages deploy failed. Two
separate workflows (`deploy.yml` and the leftover `jekyll-gh-pages.yml`) were
both publishing to the `github-pages` environment on every push and racing each
other; both also reported `Not Found` because the repo's Pages site had become
disabled.

**Fix:**
- Deleted the two stray workflows `.github/workflows/blank.yml` (a no-op
  "Hello, world!" template) and `.github/workflows/jekyll-gh-pages.yml` (a
  Jekyll publisher that conflicted with our Vite build). `deploy.yml` is now the
  single source of truth for CI and deployment.
- Hardened `deploy.yml`: added `actions/configure-pages@v5` with
  `enablement: true` to the build job so a disabled Pages site is re-enabled
  automatically instead of hard-failing, and trimmed the stale
  `claude/athlete-testing-dashboard-ommj6u` push trigger.
- Repo owner re-enabled Pages with source "GitHub Actions" (one-time manual
  setting that only the owner can change).

**Why:** A single deploy path removes the race condition, and the self-heal step
means an accidentally-disabled Pages site no longer blocks releases.

---

## 2026-06-22 — Cross-sport: gender & age-band filters (PR #3, branch `claude/intersport-comparison`)

**What:** Added **Gender** (All / Men / Women) and **Age band** (5-year bands)
filter selectors to the Cross-Sport page header. The filtered subset drives
every statistic on the page in real time.

**Details:**
- New `FilterBar` sub-component renders two `<select>`s in the page header
  alongside the existing Percentile/Raw `seg` toggle.
- `filteredAthletes` is derived via `useMemo` from `genderFilter` +
  `ageBandFilter`; all downstream memos (`pool`, `pctFor`, `rawFor`,
  `composite`, `sportAthletes`, `ranked`, `rawBoard`) now key off the filtered
  set instead of the full roster.
- **Percentiles recompute over the filtered pool** — a percentile is always
  relative to whoever is currently in scope (e.g. "top 10% _among women 20–24_").
- A dismissable banner shows `Filtered: <label>` + `N of M athletes` with a
  one-click **Clear** button when any filter is active.
- Graceful empty states: sport sub-panels show "No athletes in this filter";
  the whole page shows an empty state if no athlete matches.
- **Selected-athlete fallback:** `effectiveAthleteId` falls back to the
  top-ranked athlete in the filtered pool when the previously selected athlete
  is filtered out, so the athlete-vs-all section never breaks.
- Sample-size labels added to the radar legend and raw-table headers (e.g.
  "Tennis (12)").
- `availableBands` is computed from the actual roster so the dropdown only
  offers bands that contain athletes.

**Verification:** `tsc --noEmit` clean; `npm run build` succeeds.

**Why this feature:** Extends the cross-sport comparison so staff can scope the
pool to a fair like-for-like cohort (e.g. compare only women aged 20–24 across
sports) rather than always comparing against the entire mixed population.

---

## Earlier — Cross-sport raw-value mode (PR #2, merged)

Added a Percentile / Raw segmented toggle to the Cross-Sport page.

- **Percentile mode** normalizes the shared battery to percentiles over the
  whole population for fair cross-event comparison.
- **Raw mode** shows actual measured values. Because units differ between tests,
  raw comparisons are **per-test** rather than forced onto one axis:
  - Population view → mean-raw-value-per-sport table, best per row highlighted.
  - Athlete view → athlete value vs pool avg / best per test, plus a per-test
    raw leaderboard with a test selector.

---

## Earlier — Cross-sport comparison page (PR #2)

New `/cross-sport` page with two parts:

- **Part A — Population by sport:** radar of mean percentile per shared test;
  squad overview with a composite athleticism index (mean percentile across
  shared tests) per sport.
- **Part B — Athlete vs everyone:** percentile radar + overall-athleticism rank,
  and a composite-index leaderboard across all athletes regardless of sport.

`commonTests()` added to `catalog.ts` to derive the fair shared battery
dynamically. Added a Cross-Sport nav item + icon.

---

## Earlier — Modern UI redesign & live deployment (PR #1 follow-ups)

- Rebuilt `index.css` as a full glassmorphism dark design system (CSS variables,
  `.card` with `backdrop-filter`, gradient brand, `.seg` segmented control,
  animated page entrance, custom scrollbars).
- Rebuilt `Layout.tsx` with SVG line-icons, gradient logo badge, active nav
  accent bar.
- Set up GitHub Pages deployment via GitHub Actions; switched to `HashRouter`
  and `base: "./"` for static hosting.

---

## Earlier — Initial build (PR #1)

Built the core dashboard: domain model, synthetic generator (40 athletes,
~50% tennis / 32% athletics / 18% swimming), localStorage store, and the
Overview, Athletes, Athlete profile, Testing, Results, Correlations, Peer
comparison and Periodization pages. Tennis is the primary sport with UTR as the
competition metric.

---

## Open follow-up ideas

- CSV export of cross-sport comparison tables.
- Gender/age-band filtering on the Correlations and Peer pages too (currently
  only Cross-Sport).
- Normative external reference tables (not just internal peers).
- Real backend / multi-user entry / auth.
