# Metron — Claude Code Session Guide

This file is read automatically at the start of every Claude Code session.

---

## Session Start Protocol

**Run this at the beginning of every session before touching any code:**

### Step 1 — Orient yourself

```bash
git status
git log --oneline -10
git branch -a
npm run build   # confirm baseline is clean
```

Key branches:
- `main` — live demo source; never push here directly
- `claude/intersport-comparison` — all cross-sport feature work (PRs #2, #3); ahead of main
- `claude/athlete-testing-dashboard-ommj6u` — **STALE, do not use**

### Step 2 — Read the mentorship docs

Read both before writing any code:

- [`docs/mentors/ENGINEERING_MENTOR.md`](docs/mentors/ENGINEERING_MENTOR.md) — architecture, patterns, gotchas, how to extend safely
- [`docs/mentors/PROCESS_MENTOR.md`](docs/mentors/PROCESS_MENTOR.md) — workflow, CI/CD, definition of done, product north star

### Step 3 — Spawn mentor agents to update the docs

Spawn both agents **in parallel** (single message, two Agent tool calls):

**Engineering Mentor agent prompt:**
> You are the Engineering Mentor for Metron. Read `/home/user/metron-dashboard/docs/mentors/ENGINEERING_MENTOR.md` to understand your role. Then run `git log --oneline -20` and check what has changed since the 'Last reviewed' date at the top of that file. If there are new pages, new test types, new patterns, new gotchas, or resolved debt items — update the doc in place. Update the 'Last reviewed' date and commit range. Commit with message `chore: update engineering mentorship doc` and push. Report what changed.

**Process Mentor agent prompt:**
> You are the Process Mentor for Metron. Read `/home/user/metron-dashboard/docs/mentors/PROCESS_MENTOR.md` to understand your role. Then check: (1) `git log --oneline -10` for new commits since last update; (2) any new docs in `docs/`; (3) any new branches; (4) open PRs. If the process, deployment pipeline, roadmap, or working norms have changed — update the doc in place. Update the 'Last reviewed' date. Commit with message `chore: update process mentorship doc` and push. Report what changed.

If agent spawning is rate-limited, read both docs manually (they are self-contained).

---

## Hard Rules (always enforce)

- **Never push to `main` directly** — feature branches + draft PR + CI green + merge
- **`npm run build` must pass** before marking any work done
- **TypeScript strict mode** — `noUnusedLocals` and `noUnusedParameters` fail the build; run `npm run lint` early
- **Documentation trio** — every feature PR touches: `docs/DEVELOPMENT_LOG.md` (prepend), `docs/TEST_VERIFICATION_PR<N>.md` (new), `README.md` (feature bullet if user-facing)
- **No destructive git ops** without explicit user confirmation
- **Percentile-first** — never average raw values across tests with different units
- **filteredAthletes** is always the root for every derived memo on CrossSport.tsx — not the raw `athletes` array

---

## Quick reference

```bash
npm run dev      # dev server at http://localhost:5173
npm run build    # tsc -b + vite build (this is what CI runs)
npm run lint     # tsc -b --noEmit (type-check only)
npm run preview  # preview the production build
```

Live demo: https://nevcol.github.io/metron-dashboard/

---

## Where things live

| What | Where |
|---|---|
| Domain model | `src/types.ts` |
| Test catalogue + sports | `src/data/catalog.ts` |
| Synthetic generator | `src/data/generate.ts` |
| Store + localStorage | `src/data/store.tsx` |
| Stats library | `src/lib/stats.ts` |
| Formatting helpers | `src/lib/format.ts` |
| Cross-sport page (most complex) | `src/pages/CrossSport.tsx` |
| Nav + PageHead | `src/components/Layout.tsx` |
| Shared UI primitives | `src/components/ui.tsx` |
| CI/CD pipeline | `.github/workflows/deploy.yml` |
| Engineering mentorship | `docs/mentors/ENGINEERING_MENTOR.md` |
| Process mentorship | `docs/mentors/PROCESS_MENTOR.md` |
| Architecture reference | `docs/ARCHITECTURE.md` |
| Feature history + rationale | `docs/DEVELOPMENT_LOG.md` |
