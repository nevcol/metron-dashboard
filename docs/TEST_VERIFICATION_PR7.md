# Test Plan & Verification: Glassmorphism Re-theme + Dual Themes (PR #7)

**Date:** 2026-07-01
**Feature:** Global visual re-theme — liquid-glass style; dark "Noir" (graphite/violet) and light "Ivory" (white/gold/grey) themes with a sidebar toggle
**Branch:** `claude/dashboard-glassmorphism-style-ecqupc`

## Third pass: premium dual-theme system (Noir + Ivory)

- `src/index.css` — all theme values behind CSS variables; new
  `:root[data-theme="ivory"]` override block (white/gold/grey), chart tokens
  (`--series-1`, `--chart-grid`, `--chart-axis`, `--chart-axis-strong`,
  `--tooltip-*`), `rgba(var(--glow), α)` glow pattern, `--head-grad`, `--ring`.
- `src/components/Layout.tsx` — Noir/Ivory `.seg` toggle at the sidebar foot;
  state mirrored to `document.documentElement.dataset.theme`, `theme-color`
  meta, and `localStorage["metron.theme"]`.
- `index.html` — pre-paint inline script applies the stored theme (no flash).
- Pages — remaining chart color literals converted to `var(...)` tokens
  (verified empirically that Chromium resolves `var()` in SVG presentation
  attributes before adopting). Categorical maps intentionally kept literal.

### Verified (headless Chromium, both themes via `localStorage` init)

- [x] `npm run build` clean; built bundle contains zero legacy hex literals for
      chart chrome (grep of `dist/assets/*.js`)
- [x] Noir: Overview / Cross-Sport / Periodization render identically to the
      previous pass (purple series `#9d7bf5`, glass panels, drifting orbs)
- [x] Ivory: warm ivory surfaces, gold gradients/glows, gold series color
      `#a17d1a`, white glass tooltips, warm-grey grid; sport/category/phase
      colors unchanged and distinct; nav-active text switches to ink (not white)
- [x] Theme toggle renders in the sidebar with the active theme highlighted;
      per-theme series colors validated for lightness band, chroma floor, and
      ≥ 3:1 contrast against each theme's card surface (not eyeballed)

## What changed

- `src/index.css` — brand variables (`--accent`, `--accent-2`, `--accent-3`,
  `--grad`, `--grad-soft`), surface variables (`--bg`, `--bg-2`, `--panel`,
  `--panel-solid`, `--panel-2`, `--panel-hover`, `--border`, `--border-strong`),
  and text variables (`--text`, `--text-dim`, `--text-faint`) all recast to a
  gray/purple scale. `.card` and `.sidebar` backdrop blur increased and given a
  subtle glass sheen (`saturate()` + inset highlight). Buttons, form focus rings,
  pills, scrollbars, and the body's ambient radial glow recolored to match.
- `index.html` — `theme-color` meta tag updated to match the new background.
- `src/pages/{Overview,Correlations,PeerComparison,CrossSport,Periodization,Results,AthleteProfile}.tsx`
  — Recharts chart chrome (grid lines, tooltip styling, axis strokes/ticks) and
  the single-series "primary" data color (trend lines, radar self-series,
  default scatter points) recolored from the old blue-led palette to the new
  gray/purple one.
- `README.md` — new "Glassmorphism UI" bullet under "What it does".
- `docs/DEVELOPMENT_LOG.md` — prepended entry for this change.

No changes to `src/data/catalog.ts` category/sport color maps, `PHASE_COLOR`,
`STRENGTH_PHASE_COLOR`, `QUALITY_COLOR` in `Periodization.tsx`, or
`AVATAR_COLORS` in `ui.tsx` — these are semantic/categorical color-coding, not
brand chrome, and were intentionally left alone.

## Follow-up: "liquid glass" refinement

A second styling pass (still `index.css`-only, plus this doc + the dev log)
deepened the effect toward an Apple-style liquid-glass look: reusable
`--glass-sheen` / `--glass-tint` / `--glass-edge` tokens, a `.card::before`
specular sheen with layered inset edge-lighting and stronger `backdrop-filter`,
a slow-drifting animated `body::before` orb layer (guarded by
`prefers-reduced-motion`), and glossier buttons / segmented control / inputs /
pills / nav-active states. Re-verified with `npm run build` and fresh Chromium
screenshots of the Dashboard (glossy stat cards, donut + area chart intact),
Cross-Sport, and Periodization — no layout regressions; charts render correctly
once their mount animation settles.

## Automated / static checks

- [x] `npm run build` succeeds (`tsc -b && vite build`), zero TypeScript errors
- [x] Production bundle emitted, same module/asset count as baseline
      (848 modules transformed)
- [x] `npm run lint` (`tsc -b --noEmit`) — pre-existing, unrelated failure
      (`tsconfig.json` project-reference `TS6310` error) confirmed present on
      the base branch before this change via `git stash`; not introduced by
      this PR

## Manual smoke test (headless browser, Playwright + Chromium)

Ran `npm run build && npm run preview` and drove the built app with the
pre-installed Chromium via Playwright, navigating by hash route (`#/...`) at
the preview server root (the `/metron-dashboard/` path prefix only applies to
the real GitHub Pages deployment, not local `vite preview`).

- [x] Dashboard (`#/`) — stat cards, testing-volume area chart, test-mix donut,
      squad composition, and latest results all render with the new
      gray/purple glass panels; sidebar nav active state shows the purple
      accent
- [x] Cross-Sport (`#/cross-sport`) — radar chart, squad overview bars, segmented
      Percentile/Raw toggle (purple active state), and the athleticism
      leaderboard all render correctly; sport badges (blue tennis / orange
      athletics / green swimming) remain visually distinct as intended
- [x] Periodization (`#/periodization`) — load-vs-test-progress chart (bars +
      purple trend line), phase breakdown table, and load→gains scatter render
      correctly; phase dot colors remain distinct
- [x] Correlations (`#/correlations`) — correlation-matrix heat cells (orange/
      blue directionality) remain legible against the new dark background;
      heat-cell text contrast checked
- [x] Roster (`#/athletes`) — table, search/filter controls, and per-athlete
      avatar colors (unchanged, for identification) render correctly
- [x] Empty state (`#/athletes/<unknown-id>`) — "Athlete not found" empty view
      and "Back to roster" ghost button render correctly with the new glass
      style

Screenshots were captured at 1440×900 during this session for each of the
above and visually reviewed; no layout breakage, contrast issues, or missing
styles were found.

## Known limitations & follow-ups

- Recharts colors are passed as literal hex props rather than CSS variables,
  so any future palette change will again require touching each page file
  (same constraint that existed before this PR).
- No automated visual regression testing exists for this project; verification
  here is manual/screenshot-based only, consistent with the project's current
  testing posture (see Engineering Mentor doc, Section 7).
