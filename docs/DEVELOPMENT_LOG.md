# Metron — Development Log

A chronological record of what was built, in what order, and why. Newest first.

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
