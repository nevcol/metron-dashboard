# Test Plan & Verification: Cross-Sport Filters (PR #3)

**Date:** 2026-06-22  
**Feature:** Gender & age-band filters for Cross-Sport Comparison page  
**Branch:** `claude/intersport-comparison`

## Test cases

### 1. Type checking
- [x] `tsc --noEmit` passes with no errors
- [x] `npm run build` succeeds with no TypeScript errors
- [x] Production bundle built cleanly (dist/assets/index-*.js, index-*.css)

### 2. UI rendering
- [x] Filter controls render in PageHead actions
- [x] Filter bar contains two `<select>` elements (Gender, Age band)
- [x] Gender dropdown options: All, Men, Women
- [x] Age band dropdown populated from actual athlete data (5-year bands)
- [x] Segmented control for Percentile/Raw modes still present

### 3. Filter application

#### Gender filter
- [ ] Select "Women" → radar, table, leaderboard update with female athletes only
- [ ] Select "Men" → stats recalculate for male athletes
- [ ] Select "All" → returns to full population

#### Age band filter
- [ ] Select an age band (e.g. "20-24") → filters applied
- [ ] Age band combines with gender filter (e.g. "Women aged 20-24")
- [ ] All statistics (percentiles, sport means, composite index) recompute

### 4. Graceful empty states
- [ ] Apply a filter that results in zero athletes → "No athletes match filters" message
- [ ] Apply a filter that excludes a sport entirely → sport sub-panel shows "(no data)"
- [ ] Apply a filter that removes the selected athlete → athlete selector auto-falls-back to top-ranked in pool

### 5. Active filter UI
- [ ] When a filter is active, a dismissable banner appears
- [ ] Banner shows "Filtered: <label>" (e.g. "Filtered: Women, Age 20-24")
- [ ] Banner shows "N of M athletes" (e.g. "12 of 40 athletes")
- [ ] "Clear" button on banner resets both filters in one click

### 6. Mode interaction (Percentile ↔ Raw)
- [ ] Percentile mode respects filters
- [ ] Raw mode respects filters
- [ ] Mode toggle doesn't reset filters
- [ ] Switching modes keeps the selected athlete (if still in pool)

### 7. Navigation & persistence
- [ ] Athlete selector dropdown only shows athletes in the filtered pool
- [ ] Links to `/athletes/{id}` from leaderboard still work
- [ ] Clearing filters and reapplying same filters gives same population

## Verification results

✓ **TypeScript:** Build clean, no TS errors  
✓ **Production build:** All assets created, no warnings or errors  
✓ **Code review:** Filters logic isolated to CrossSport.tsx, no side effects to other pages  
✓ **git status:** Only `src/pages/CrossSport.tsx` and `README.md` modified

## Manual smoke test (when browser available)

```bash
npm run dev                    # Start dev server
# Open http://localhost:5173/#/cross-sport in browser
# 1. Verify filter controls present in header
# 2. Select "Women" → chart updates
# 3. Select "20-24" → further filtered
# 4. Verify "Filtered:" banner and athlete count
# 5. Click "Clear" → returns to full pool
# 6. Toggle Percentile ↔ Raw → mode switches, filters persist
```

## Known limitations & future work

- No gender/age-band filters yet on Correlations or Peer Comparison pages (just Cross-Sport for now)
- Browser-based manual testing deferred (no headless browser in CI environment)
- CSV export of filtered tables not yet implemented
