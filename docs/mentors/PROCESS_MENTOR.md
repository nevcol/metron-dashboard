# Metron — Process & Product Mentorship Guide

_Last reviewed: 2026-07-01_

This document is for future contributors and AI sessions. It covers **how work happens** and **why the product is shaped the way it is**. For technical architecture, see `docs/ARCHITECTURE.md`.

---

## 1. READ ME FIRST

Five things to know before touching anything:

1. **Never push to `main` directly.** All work goes on a feature branch, gets a draft PR, CI must go green, then merge. The deploy job runs only after merge to `main` — that is the only way the live demo updates.
2. **`npm run build` is the gate.** It runs `tsc -b` then `vite build`. If either fails, the work is not done. Run it locally before declaring anything complete.
3. **Documentation is mandatory, not optional.** Every PR needs: a prepended entry in `docs/DEVELOPMENT_LOG.md` (newest first), a per-PR verification doc in `docs/`, and updated README feature bullets if you added something user-facing.
4. **HashRouter + `base: "./"` are not negotiable.** GitHub Pages serves the app under `/metron-dashboard/` with no server-side routing. Switching to BrowserRouter or changing the Vite base will break the live site.
5. **The synthetic dataset is the product's spine.** It is reproducible by design and encodes real athletic relationships. Do not replace it with random data; that would break every correlation, peer comparison, and periodization view.

---

## 2. How Work Flows

### Branching model

```
feature branch → draft PR → CI green (build job) → merge to main → deploy job → live site
```

- Every feature branch is a separate branch named descriptively (e.g. `claude/intersport-comparison`).
- PRs are opened as **drafts** while work is in progress.
- CI runs `npm run build` (tsc + Vite) on every push and PR. This is the required gate.
- Merge to `main` triggers the deploy job automatically.

### Current branches (as of 2026-07-01)

| Branch | State | Notes |
|---|---|---|
| `main` | Live | Up to date through PR #6. Contains the initial build (PR #1), cross-sport comparison + filters (PRs #2/#3), the Pages deploy fix (PR #4), the periodization plan builder (PR #5), and strength phases/training qualities/calendar view (PR #6). |
| `claude/dashboard-glassmorphism-style-ecqupc` | Active (current session branch) | Currently identical to `main` (0 commits ahead/behind) — no feature work committed on it yet this session. |
| `claude/intersport-comparison` | **Merged, historical** | Its 3 commits (cross-sport page, raw-value mode, gender/age filters) landed via PRs #2 and #3 and are now part of `main`. No longer ahead of main; safe to delete, but not urgent. |
| `claude/athlete-testing-dashboard-ommj6u` | **STALE — do not use** | Pre-dates the main PR #1 merge. Only 4 commits (initial setup + early UI iteration). Has no `docs/` folder. Contains none of the cross-sport features. Safe to ignore; do not branch from it. |

### What is ahead of main right now

Nothing — as of 2026-07-01, `main` and the current session branch
(`claude/dashboard-glassmorphism-style-ecqupc`) point at the same commit
(`eeb8af6`). All previously-pending work (cross-sport filters, the Pages
deploy fix, the periodization plan builder, and the strength-phase/training-
quality/calendar work) has merged. The CLAUDE.md session-start protocol still
references `claude/intersport-comparison` as "ahead of main" — that is now
stale; the branch's work has shipped. New feature work should start from a
fresh branch off current `main`.

**Documentation-trio gap to note:** PR #6 (`eeb8af6`, strength phases /
training qualities / calendar view) shipped without a
`docs/TEST_VERIFICATION_PR6.md`. Only `TEST_VERIFICATION_PR3.md` and
`TEST_VERIFICATION_PR5.md` exist. The Development Log entry for PR #6 also
doesn't cite a verification doc, unlike the PR #3 and #5 entries. Future
sessions should backfill `TEST_VERIFICATION_PR6.md` or treat this as a
process debt item.

---

## 3. The Deployment Pipeline & Constraints

### Workflow: `.github/workflows/deploy.yml`

Triggers: every push, every PR, manual dispatch.

**`build` job** (runs on every event):
- `ubuntu-latest`, Node 20, `npm ci`
- `npm run build` = `tsc -b && vite build`
- Uploads `dist/` as a Pages artifact
- Runs on PRs too — this is the CI gate that must be green before merge

**`deploy` job** (runs only on non-PR events, after `build`):
- `if: github.event_name != 'pull_request'`
- Depends on `build` job completing successfully
- Deploys to the `github-pages` environment
- Serialized with `concurrency: group: pages` so concurrent runs don't clobber each other

### Hard constraints

- **Feature branches cannot deploy.** The `github-pages` environment only accepts deployments from `main`. If the deploy job fails with "Not Found" on a feature branch, this is expected — merge to `main` to deploy.
- **`base: "./"` in `vite.config.ts`** makes all asset URLs relative so the app works under `/metron-dashboard/` on GitHub Pages. Do not change it to `/` or an absolute path.
- **`HashRouter` in `src/main.tsx`** handles deep links (e.g. `/#/athletes/123`) on static hosting where there is no server to handle URL rewrites. BrowserRouter would produce 404s for any direct navigation to a sub-route.
- `npm run build` produces `dist/` — this is the artifact the Actions workflow uploads and deploys.

### One workflow, deliberately

`deploy.yml` is the **only** workflow, and that is a hard rule. Two starter
templates used to live alongside it and both deployed to the `github-pages`
environment:
- `blank.yml` — a "Hello, world!" CI template (no-op).
- `jekyll-gh-pages.yml` — a Jekyll template that tried to build the repo as a
  Jekyll site and publish *that* to Pages.

On every push to `main` all three ran, and the two Pages deployers raced for the
same environment. This caused the deploy to fail and could have published the
wrong artifact. Both stray files were deleted on 2026-06-22; `deploy.yml` now
also calls `actions/configure-pages@v5` with `enablement: true` so a
disabled Pages site self-heals instead of hard-failing.

**Never add a second workflow that deploys to `github-pages`.** Extend
`deploy.yml` instead.

---

## 4. Definition of Done

A feature is **done** when all of these are true:

- [ ] `tsc --noEmit` (or `npm run lint`) is clean — zero TypeScript errors
- [ ] `npm run build` succeeds — production bundle builds without warnings that matter
- [ ] `docs/DEVELOPMENT_LOG.md` has a new entry **prepended at the top** (newest first)
- [ ] A per-PR verification doc exists in `docs/` (e.g. `docs/TEST_VERIFICATION_PR3.md`)
- [ ] `README.md` feature list is updated if the change is user-facing
- [ ] PR is created (can start as draft), CI passes on the build job
- [ ] PR is merged to `main`
- [ ] Deploy job completes and the live demo at `https://nevcol.github.io/metron-dashboard/` reflects the change

---

## 5. Documentation Discipline

The project maintains three living documents plus per-PR verification docs. All are tracked in git alongside code.

| Document | Purpose | Update rule |
|---|---|---|
| `docs/DEVELOPMENT_LOG.md` | Chronological feature history with rationale | **Prepend** new entries at the top. Newest first, always. |
| `docs/ARCHITECTURE.md` | Canonical technical reference | Update whenever stack, data model, or key patterns change. |
| `docs/DEPLOYMENT.md` | CI/CD pipeline and GitHub Pages specifics | Update if the deployment topology changes. |
| `docs/TEST_VERIFICATION_PR*.md` | Per-PR test evidence | Create one per PR. Include type-check status, build status, code review notes, and a manual smoke-test checklist. |
| `README.md` | User-facing feature list + getting started | Add a bullet to "What it does" when a new user-visible feature ships. |

**The development log is a key product artefact.** It documents not just what was built but why — rationale for decisions, trade-offs acknowledged, open ideas carried forward. Future maintainers and AI sessions will read it to understand intent.

---

## 6. Product North Star & Principles

### What Metron IS

- **Testing-centric:** The core is physical test data — sprints, jumps, strength, aerobic, mobility. Everything else (results, periodization, peer comparison) radiates from tests.
- **Fairness via normalization:** Comparing athletes across tests (different units) or across sports requires converting raw values to percentiles. Raw numbers are never aggregated across tests; percentiles are.
- **Coaching insight over raw numbers:** The product's value is revealing relationships — how jump power correlates with sprint speed, how training load predicts test gains, how one athlete compares to true like-for-like peers.
- **Cohort comparisons:** Peer comparison and cross-sport filtering scope to same-gender, same-age-band cohorts to avoid conflating biological differences with athletic differences.

### What Metron is NOT

- Not a real backend system — no server, no database, no authentication.
- Not a multi-user data entry platform (yet — this is a roadmap item).
- Not a raw-numbers tool — showing raw values without context (percentile, cohort) is a secondary mode, not the primary framing.
- Not a one-sport dashboard — multi-sport is architecturally first-class even though tennis is the lead sport in the dataset.

### Synthetic reproducible dataset

The dataset (~40 athletes, ~50% tennis / ~32% athletics / ~18% swimming) is generated by `src/data/generate.ts` and seeded into `localStorage` on first load.

It is **reproducible by design** — the generator uses a fixed seed so every fresh load produces the same athletes with the same scores. This is not a shortcut; it is a deliberate product decision:

- Demo and development work with **meaningful signal** (correlations are real, trends are visible) not noise.
- The generator deliberately embeds real athletic relationships: jump power correlates with sprint speed; strength correlates with power; training load predicts test improvement; test gains predict competition results.
- QA and documentation screenshots are stable across sessions.
- Users can always reset via "Regenerate sample data" on the Overview page.

### Percentile fairness philosophy

A test result in seconds (sprint) cannot be averaged with one in centimetres (jump height). The solution is `percentileRank()` in `src/lib/stats.ts`, which:
- Converts any value to a 0–100 score within the comparison pool.
- Honours `higherIsBetter` — for time-based tests, a faster time gets a higher percentile.
- Means 50 = median of the pool, 100 = best in the pool.

Cross-sport comparison, peer radar, and the composite athleticism index all run on percentiles, never raw aggregates.

### No server constraint

The app is client-side only, hosted on GitHub Pages. localStorage is the only persistence layer. This is a deliberate scope constraint that enables free hosting and zero operational overhead. It is a trade-off, not an oversight — the roadmap acknowledges a real backend as a future milestone.

---

## 7. Key Product Decisions & Rationale

### HashRouter (not BrowserRouter)

GitHub Pages is static hosting. There is no server to handle `/athletes/42` — a direct navigation to that URL would return a 404. `HashRouter` encodes the route in the URL hash (`/#/athletes/42`), which never reaches the server. `BrowserRouter` would require a server with URL rewriting configured, which GitHub Pages does not provide.

### `base: "./"` in Vite config

The live site is served under `/metron-dashboard/` (not `/`). With an absolute base, all asset URLs would start with `/`, which would break under the repo-name sub-path. Relative base (`"./"`) makes every asset URL relative to the HTML file, which works regardless of sub-path depth.

### Reproducible synthetic dataset

See Section 6. The key insight: a random dataset would produce different correlations each load, making it impossible to document features, write stable test cases, or do a demo that looks the same twice. Reproducibility is a product requirement for a demo/dev tool.

### Percentile normalization for cross-sport

Sports use different test batteries with different units. Even within the shared battery, a 40 cm broad jump and a 3.2 s sprint are incommensurable. The only fair aggregate is "how does this athlete rank within their cohort on this test?" — a percentile. `commonTests()` in `catalog.ts` derives the fair shared battery dynamically (tests all sports use), and the Cross-Sport page normalizes everything to percentiles before computing composite scores.

### Per-sport profiles per athlete

The `Athlete` type holds an array of `AthleteProfile`s, one per sport. This makes the data model first-class multi-sport from day one — an athlete who competes in athletics and swimming can carry both profiles with their respective events, experience, and test results scoped correctly. The current dataset assigns one sport per athlete, but the architecture supports multi-sport athletes without schema changes.

### `commonTests()` for fair shared battery

Hard-coding which tests to compare across sports would require code changes every time a sport is added. Instead, `commonTests()` in `catalog.ts` derives the shared battery dynamically: it returns tests whose `sports` array is empty (meaning all sports) or explicitly includes every sport in the system. Adding a new sport automatically narrows the shared battery to only the tests that sport also uses — no code changes needed in the Cross-Sport page.

---

## 8. Roadmap & Open Follow-Up Work

From `README.md` roadmap and `DEVELOPMENT_LOG.md` open ideas:

### Actively tracked open items

- **CSV export** — Cross-sport comparison tables (filtered or full) should be exportable. The filtered leaderboard and raw table are the first candidates.
- **Filter other pages** — Gender and age-band filters are implemented only on Cross-Sport. The Correlations and Peer Comparison pages should get the same treatment so staff can scope any analysis to a cohort.
- **External normative references** — Currently peer comparison is internal (within the squad). Normative reference tables (e.g. published benchmarks for elite youth sprinters) would let staff compare athletes against external standards, not just internal peers.

### Longer-horizon roadmap items

- **Real backend / multi-user entry / auth** — The localStorage model is the single biggest architectural constraint. A real backend would enable multi-device sync, multi-coach entry, and audit trails.
- **Configurable test catalogue** — Currently tests and sports are hard-coded in `catalog.ts`. Organisations should be able to define custom test types and event categories.
- **Injury/availability tracking** — Layer athlete availability onto the periodization view so load planning accounts for injured athletes.
- **PDF athlete reports** — Exportable per-athlete summary (test battery, percentile radar, progression charts).

---

## 9. Working Norms for Future AI Sessions

When you are an AI contributor on this project:

### Before starting work
- Read `docs/DEVELOPMENT_LOG.md` to understand what has been built and why.
- Read `docs/ARCHITECTURE.md` to understand the technical structure.
- Confirm which branch you are on. Feature work goes on a named branch, not `main`.
- Run `npm run build` to confirm the baseline is clean before you change anything.

### During work
- Develop on a designated feature branch. Name it descriptively (e.g. `claude/csv-export`).
- Commit clearly — one logical change per commit, message explains the why, not just the what.
- Push after each meaningful commit so work is not lost.
- Create a **draft PR** early, before the work is complete. This makes the branch visible and CI starts running.

### Before declaring done
- `npm run lint` (or `tsc --noEmit`) must be clean.
- `npm run build` must succeed.
- Write a prepended entry in `docs/DEVELOPMENT_LOG.md`.
- Write a per-PR verification doc in `docs/TEST_VERIFICATION_PR<N>.md`.
- Update `README.md` if you added a user-facing feature.
- Mark the PR ready for review (not draft) and confirm CI is green.

### Hard rules
- **Never push directly to `main`.** Not even a "small fix."
- **Never run destructive git operations** (`reset --hard`, `push --force`, `branch -D`) without explicit user confirmation.
- **Never skip `npm run build`** before marking work done. TypeScript errors that only appear in strict mode will be caught here.
- **Ask before deleting or restructuring existing files.** The docs and test verification files are product artefacts, not clutter.
- If the CI build fails on your branch, fix it before asking for review.

### Documentation trio rule
Every PR touches three things if it adds a feature:
1. `docs/DEVELOPMENT_LOG.md` — prepended entry (newest first)
2. `docs/TEST_VERIFICATION_PR<N>.md` — new verification doc
3. `README.md` — updated feature bullet (if user-facing)

---

## 🤖 AUTO-UPDATE PROTOCOL FOR FUTURE SESSIONS

> **For Claude Code agents:** At the start of every new session on this project, re-read this file, then spawn a fresh Process Mentor agent (using the Agent tool with subagent_type: "general-purpose") with this prompt:
>
> "You are the Process Mentor for Metron. Read docs/mentors/PROCESS_MENTOR.md to understand your role. Then check: (1) git log --oneline -10 for new commits since last update; (2) any new docs in docs/; (3) any new branches. If the process, deployment pipeline, roadmap, or product decisions have changed, update docs/mentors/PROCESS_MENTOR.md accordingly. Update the 'Last reviewed' date. Commit the updated file with message 'Update process mentorship doc'. Report what changed."
>
> Run this agent BEFORE starting new feature work so the mentorship doc stays current.
