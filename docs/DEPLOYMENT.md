# Metron — Deployment Guide

## Overview

Metron is deployed as a static site to GitHub Pages, published automatically by
GitHub Actions on every merge to the `main` branch. The live site is at:

**https://nevcol.github.io/metron-dashboard/**

## CI/CD pipeline

### Workflow: `.github/workflows/deploy.yml`

**Trigger:** Every push and pull request (both branches have jobs)

1. **`build` job** (runs on all events)
   - Runs on `ubuntu-latest`
   - Installs npm dependencies
   - Runs `npm run build` (TypeScript check + Vite bundling)
   - Uploads the `dist/` artifact
   - Always completes (no early exit on PR vs main)

2. **`deploy` job** (runs only after `build`, only on non-PR events)
   - Depends on `build` job
   - Only runs when: `github.event_name != 'pull_request'`
   - Downloads the `dist/` artifact
   - Deploys to the `github-pages` environment via `actions/deploy-pages@v4`
   - The deploy environment is configured to publish from GitHub Actions

### Why this structure

- **PR branches:** Build is checked, but deployment is blocked (no merge to main).
- **Main branch:** After merge, build is checked and then deployed automatically.
- **Artifact:** Separate upload/download ensures the deploy job runs the **exact
  same build** that was tested, avoiding any "works locally" failures.

## GitHub Pages setup

1. **Repository must be public** — GitHub Pages on private repos requires a paid plan.
2. **Pages source:** Set to "GitHub Actions" (visible in repo Settings → Pages).
3. **Custom domain (optional):** Currently uses the default `<owner>.github.io/<repo>/`
   path. Subdomains like `metron.example.com` can be configured in Pages settings.

## Local development

```bash
npm install                 # Install dependencies
npm run dev                 # Start dev server (http://localhost:5173)
npm run build               # Production build
npm run preview             # Preview the production build locally
```

## Troubleshooting

### Deploy job fails with "Not Found"

**Symptom:** Deploy job fails despite build succeeding.

**Cause:** The deploy `github-pages` environment only accepts deployments from
the repository's default branch (`main`). Feature branches cannot deploy.

**Solution:** Merge the PR to `main` to trigger deploy.

### Pages shows stale content

**Symptom:** Live site doesn't reflect the latest push.

**Cause:** GitHub Pages cache, or the workflow didn't run.

**Steps:**
1. Check the Actions tab — look for the latest `deploy.yml` run and verify it
   succeeded.
2. Hard-refresh the browser (`Ctrl+F5` or `Cmd+Shift+R`).
3. Check the repository's default branch — Pages always deploys from `main`.

### Build fails but was working locally

**Symptom:** `npm run build` passes locally but fails in CI.

**Cause:** Environment differences (Node version, dependency versions, cache).

**Steps:**
1. Run `npm ci` instead of `npm install` locally (installs exact versions from
   lock file).
2. Clear local `node_modules/` and `.next/` / `dist/` caches.
3. Check the CI log for the exact error.

## Adding a new page

1. Create a new page component in `src/pages/NewPage.tsx`.
2. Add a route to `src/App.tsx`.
3. Add a nav item to `Layout.tsx` (in the `NAV` array).
4. Deploy: merge to `main` and the workflow will automatically build and publish.

## Environment variables

Currently, there are no build-time environment variables. All configuration
(sports, tests, colors) is in `src/data/catalog.ts`. To add env-based config:

1. Create `.env.local` (git-ignored) for local overrides.
2. Use `import.meta.env.VITE_*` in the code (Vite's convention).
3. Document the vars in a `.env.example` file.

## Performance notes

- **Bundle size:** ~670 KB minified, ~189 KB gzipped. This is larger than typical
  due to Recharts dependencies. Consider code-splitting with dynamic imports if
  the bundle grows further.
- **Data:** All data is generated synthetically and stored in localStorage.
  There is no network latency; the app is fully functional offline.
- **No CDN:** Static hosting on GitHub Pages uses GitHub's CDN for free.

## Rollback

If a broken build gets deployed, the quickest rollback is:

```bash
git revert <bad-commit>      # Create a revert commit
git push                     # Workflow auto-deploys the revert
```

Alternatively, manually deploy an older build:

```bash
git checkout <good-commit>
npm run build
# Then manually upload dist/ to Pages via GitHub's interface
```
