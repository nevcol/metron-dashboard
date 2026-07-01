import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { PageHead } from "../components/Layout";
import { Avatar, Bar, Card } from "../components/ui";
import { SPORTS, SPORT_BY_ID, SPORT_COLORS, commonTests } from "../data/catalog";
import { useStore } from "../data/store";
import { ageBand, ageOn, genderLabel } from "../lib/format";
import { mean, percentileRank, round } from "../lib/stats";
import type { Athlete, Gender, TestResult } from "../types";

type Mode = "pct" | "raw";

/** Most recent value of a test for an athlete, across any sport they train. */
function latestValue(
  results: TestResult[],
  athleteId: string,
  testTypeId: string,
): number | null {
  let best: TestResult | null = null;
  for (const r of results) {
    if (r.athleteId !== athleteId || r.testTypeId !== testTypeId) continue;
    if (!best || r.date > best.date) best = r;
  }
  return best ? best.value : null;
}

export default function CrossSport() {
  const { athletes, testResults } = useStore();
  const tests = useMemo(() => commonTests(), []);
  const [mode, setMode] = useState<Mode>("pct");

  // ── Filters ──────────────────────────────────────────────────────────────
  const [genderFilter, setGenderFilter] = useState<"all" | Gender>("all");
  const [ageBandFilter, setAgeBandFilter] = useState<string>("all");

  const availableBands = useMemo(() => {
    const bands = new Set<string>();
    for (const a of athletes) bands.add(ageBand(ageOn(a.birthDate)));
    return [...bands].sort();
  }, [athletes]);

  const filteredAthletes = useMemo(() => {
    return athletes.filter((a) => {
      if (genderFilter !== "all" && a.gender !== genderFilter) return false;
      if (ageBandFilter !== "all" && ageBand(ageOn(a.birthDate)) !== ageBandFilter) return false;
      return true;
    });
  }, [athletes, genderFilter, ageBandFilter]);

  // ── Core statistics over the filtered pool ────────────────────────────────
  const { pctFor, rawFor, pool, composite } = useMemo(() => {
    const pool = new Map<string, number[]>();
    const values = new Map<string, Map<string, number>>();
    for (const a of filteredAthletes) {
      const m = new Map<string, number>();
      for (const t of tests) {
        const v = latestValue(testResults, a.id, t.id);
        if (v !== null) {
          m.set(t.id, v);
          if (!pool.has(t.id)) pool.set(t.id, []);
          pool.get(t.id)!.push(v);
        }
      }
      values.set(a.id, m);
    }
    const rawFor = (athleteId: string, testId: string): number | null =>
      values.get(athleteId)?.get(testId) ?? null;
    const pctFor = (athleteId: string, testId: string): number | null => {
      const v = values.get(athleteId)?.get(testId);
      if (v === undefined) return null;
      const t = tests.find((x) => x.id === testId)!;
      return percentileRank(v, pool.get(testId) ?? [], t.higherIsBetter);
    };
    const composite = new Map<string, number>();
    for (const a of filteredAthletes) {
      const pcts: number[] = [];
      for (const t of tests) {
        const p = pctFor(a.id, t.id);
        if (p !== null) pcts.push(p);
      }
      if (pcts.length) composite.set(a.id, mean(pcts));
    }
    return { pctFor, rawFor, pool, composite };
  }, [filteredAthletes, testResults, tests]);

  const sportAthletes = useMemo(() => {
    const m = new Map<string, Athlete[]>();
    for (const s of SPORTS) m.set(s.id, []);
    for (const a of filteredAthletes) {
      const sid = a.profiles[0]?.sportId;
      if (sid && m.has(sid)) m.get(sid)!.push(a);
    }
    return m;
  }, [filteredAthletes]);

  // Mean (percentile or raw) of a test for a sport's athletes.
  const sportMean = (sportId: string, testId: string, m: Mode): number | null => {
    const vals = (sportAthletes.get(sportId) ?? [])
      .map((a) => (m === "pct" ? pctFor(a.id, testId) : rawFor(a.id, testId)))
      .filter((v): v is number => v !== null);
    return vals.length ? mean(vals) : null;
  };

  const sportRadar = useMemo(
    () =>
      tests.map((t) => {
        const row: Record<string, number | string> = { test: t.shortName };
        for (const s of SPORTS) row[s.name] = round(sportMean(s.id, t.id, "pct") ?? 0, 0);
        return row;
      }),
    [tests, sportAthletes, pctFor],
  );

  const sportSummary = useMemo(
    () =>
      SPORTS.map((s) => {
        const roster = sportAthletes.get(s.id) ?? [];
        const comps = roster.map((a) => composite.get(a.id) ?? 0);
        const women = roster.filter((a) => a.gender === "F").length;
        return {
          sport: s,
          count: roster.length,
          women,
          men: roster.length - women,
          avgAge: roster.length ? round(mean(roster.map((a) => ageOn(a.birthDate))), 1) : 0,
          avgComposite: round(comps.length ? mean(comps) : 0, 0),
        };
      }),
    [sportAthletes, composite],
  );
  const maxComposite = Math.max(...sportSummary.map((s) => s.avgComposite), 1);

  const ranked = useMemo(
    () =>
      [...composite.entries()]
        .map(([id, score]) => ({ athlete: filteredAthletes.find((a) => a.id === id)!, score }))
        .filter((r) => r.athlete)
        .sort((a, b) => b.score - a.score),
    [composite, filteredAthletes],
  );

  // Ensure the selected athlete stays valid after filter changes.
  const [athleteId, setAthleteId] = useState(ranked[0]?.athlete.id ?? athletes[0]?.id ?? "");
  const effectiveAthleteId = ranked.some((r) => r.athlete.id === athleteId)
    ? athleteId
    : ranked[0]?.athlete.id ?? "";
  const athlete = filteredAthletes.find((a) => a.id === effectiveAthleteId);
  const rankIdx = ranked.findIndex((r) => r.athlete.id === effectiveAthleteId);

  // For raw mode, comparisons are per-test (units differ between tests).
  const [rawTestId, setRawTestId] = useState(tests[0]?.id ?? "");
  const rawTest = tests.find((t) => t.id === rawTestId) ?? tests[0];

  const athleteRadar = useMemo(() => {
    if (!athlete) return [];
    return tests
      .map((t) => {
        const p = pctFor(athlete.id, t.id);
        return p === null ? null : { test: t.shortName, percentile: round(p, 0) };
      })
      .filter(Boolean) as { test: string; percentile: number }[];
  }, [athlete, tests, pctFor]);

  // Raw leaderboard across filtered athletes for the selected test.
  const rawBoard = useMemo(() => {
    const rows = filteredAthletes
      .map((a) => {
        const v = rawFor(a.id, rawTestId);
        return v === null ? null : { athlete: a, value: v };
      })
      .filter((r): r is { athlete: Athlete; value: number } => r !== null);
    rows.sort((a, b) => (rawTest?.higherIsBetter ? b.value - a.value : a.value - b.value));
    return rows;
  }, [filteredAthletes, rawFor, rawTestId, rawTest]);

  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    if (genderFilter !== "all") parts.push(genderFilter === "M" ? "Men" : "Women");
    if (ageBandFilter !== "all") parts.push(`Age ${ageBandFilter}`);
    return parts.length ? parts.join(", ") : null;
  }, [genderFilter, ageBandFilter]);

  if (filteredAthletes.length === 0) {
    return (
      <>
        <PageHead
          title="Cross-Sport Comparison"
          actions={<FilterBar {...{ genderFilter, setGenderFilter, ageBandFilter, setAgeBandFilter, availableBands }} />}
        />
        <div className="empty">No athletes match the current filters.</div>
      </>
    );
  }

  if (!athlete) {
    return (
      <>
        <PageHead title="Cross-Sport Comparison" />
        <div className="empty">No athletes available.</div>
      </>
    );
  }

  const athleteSport = SPORT_BY_ID[athlete.profiles[0]?.sportId ?? ""];
  const rawRankIdx = rawBoard.findIndex((r) => r.athlete.id === effectiveAthleteId);

  return (
    <>
      <PageHead
        title="Cross-Sport Comparison"
        subtitle={
          mode === "pct"
            ? "Normalized mode: the shared test battery is converted to percentiles over the whole population so different events compare fairly. 50 = median, 100 = best overall."
            : "Raw mode: actual measured values compared side by side. Units differ between tests, so comparisons are shown per test rather than on a single scale."
        }
        actions={
          <div className="row" style={{ gap: 10 }}>
            <FilterBar
              genderFilter={genderFilter}
              setGenderFilter={setGenderFilter}
              ageBandFilter={ageBandFilter}
              setAgeBandFilter={setAgeBandFilter}
              availableBands={availableBands}
            />
            <div className="seg">
              <button className={mode === "pct" ? "active" : ""} onClick={() => setMode("pct")}>
                Percentile
              </button>
              <button className={mode === "raw" ? "active" : ""} onClick={() => setMode("raw")}>
                Raw values
              </button>
            </div>
          </div>
        }
      />

      {filterLabel && (
        <div className="row" style={{ marginBottom: 16, marginTop: -8 }}>
          <span className="pill accent">
            <span>Filtered:</span> {filterLabel}
          </span>
          <span className="faint" style={{ fontSize: 12.5 }}>
            {filteredAthletes.length} of {athletes.length} athletes
          </span>
          <button
            className="btn ghost"
            style={{ padding: "5px 10px", fontSize: 12 }}
            onClick={() => { setGenderFilter("all"); setAgeBandFilter("all"); }}
          >
            Clear
          </button>
        </div>
      )}

      <h2 className="section-title" style={{ marginTop: filterLabel ? 0 : 4 }}>
        Population by sport
      </h2>

      {mode === "pct" ? (
        <div className="grid cols-3">
          <div style={{ gridColumn: "span 2" }}>
            <Card title="Physical profile by sport" sub="Mean percentile per shared test, across the filtered pool">
              <ResponsiveContainer width="100%" height={330}>
                <RadarChart data={sportRadar} outerRadius={120}>
                  <PolarGrid stroke="#322c48" />
                  <PolarAngleAxis dataKey="test" tick={{ fill: "#a4b2d0", fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#6b7aa0", fontSize: 10 }} angle={90} />
                  {SPORTS.map((s) => (
                    <Radar
                      key={s.id}
                      name={s.name}
                      dataKey={s.name}
                      stroke={SPORT_COLORS[s.id]}
                      fill={SPORT_COLORS[s.id]}
                      fillOpacity={0.16}
                      strokeWidth={2}
                    />
                  ))}
                  <Tooltip
                    contentStyle={{ background: "#1c1726", border: "1px solid #322c48", borderRadius: 8, color: "#f1eef9" }}
                  />
                </RadarChart>
              </ResponsiveContainer>
              <div className="legend mt-8">
                {SPORTS.map((s) => (
                  <span className="item" key={s.id}>
                    <span className="dot" style={{ background: SPORT_COLORS[s.id] }} />
                    {s.name}
                    <span className="faint" style={{ fontSize: 11 }}>
                      ({sportAthletes.get(s.id)?.length ?? 0})
                    </span>
                  </span>
                ))}
              </div>
            </Card>
          </div>
          <SquadOverview sportSummary={sportSummary} maxComposite={maxComposite} />
        </div>
      ) : (
        <div className="grid cols-3">
          <div style={{ gridColumn: "span 2" }}>
            <Card title="Mean raw value by sport" sub="Average measured value per shared test — best per row highlighted">
              <table>
                <thead>
                  <tr>
                    <th>Test</th>
                    {SPORTS.map((s) => (
                      <th key={s.id} className="num">
                        {s.name}
                        <span className="faint" style={{ fontWeight: 400, marginLeft: 4 }}>
                          ({sportAthletes.get(s.id)?.length ?? 0})
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tests.map((t) => {
                    const means = SPORTS.map((s) => ({ id: s.id, v: sportMean(s.id, t.id, "raw") }));
                    const valid = means.filter((m) => m.v !== null) as { id: string; v: number }[];
                    const best = valid.length
                      ? valid.reduce((a, b) => (t.higherIsBetter ? (b.v > a.v ? b : a) : b.v < a.v ? b : a))
                      : null;
                    return (
                      <tr key={t.id}>
                        <td>
                          <span style={{ fontWeight: 600 }}>{t.name}</span>
                          <span className="faint" style={{ fontSize: 11.5 }}>
                            {" "}
                            {t.unit && `(${t.unit})`}
                          </span>
                        </td>
                        {means.map((m) => (
                          <td key={m.id} className={`num ${best && best.id === m.id ? "best-cell" : ""}`}>
                            {m.v === null ? "—" : round(m.v, t.unit === "kg" || t.unit === "cm" ? 1 : 2)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="faint" style={{ fontSize: 12, marginTop: 10 }}>
                Green = best squad average on that test (accounting for whether higher or lower is better).
              </p>
            </Card>
          </div>
          <SquadOverview sportSummary={sportSummary} maxComposite={maxComposite} />
        </div>
      )}

      <h2 className="section-title">Athlete vs entire population</h2>
      <div className="grid cols-3">
        <Card
          title={mode === "pct" ? "Percentile vs all athletes" : "Raw value vs all athletes"}
          sub="Across every sport, on the shared battery"
        >
          <select
            value={effectiveAthleteId}
            onChange={(e) => setAthleteId(e.target.value)}
            style={{ width: "100%", marginBottom: 12 }}
          >
            {ranked.map((r) => (
              <option key={r.athlete.id} value={r.athlete.id}>
                {r.athlete.name} — {SPORT_BY_ID[r.athlete.profiles[0]?.sportId ?? ""]?.name}
              </option>
            ))}
          </select>
          <div className="row" style={{ marginBottom: 8 }}>
            <Avatar name={athlete.name} size={40} />
            <div>
              <div style={{ fontWeight: 650 }}>{athlete.name}</div>
              <div className="faint" style={{ fontSize: 12 }}>
                {athleteSport?.name} · {genderLabel(athlete.gender)} · {ageOn(athlete.birthDate)} yrs
              </div>
            </div>
          </div>

          {mode === "pct" ? (
            <>
              <ResponsiveContainer width="100%" height={290}>
                <RadarChart data={athleteRadar} outerRadius={100}>
                  <PolarGrid stroke="#322c48" />
                  <PolarAngleAxis dataKey="test" tick={{ fill: "#a4b2d0", fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#6b7aa0", fontSize: 10 }} angle={90} />
                  <Radar
                    dataKey="percentile"
                    stroke={SPORT_COLORS[athlete.profiles[0]?.sportId ?? "tennis"]}
                    fill={SPORT_COLORS[athlete.profiles[0]?.sportId ?? "tennis"]}
                    fillOpacity={0.35}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1c1726", border: "1px solid #322c48", borderRadius: 8, color: "#f1eef9" }}
                  />
                </RadarChart>
              </ResponsiveContainer>
              <div className="row between mt-8">
                <span className="faint" style={{ fontSize: 12.5 }}>Overall athleticism rank</span>
                <span className="pill accent">
                  #{rankIdx + 1} of {ranked.length}
                </span>
              </div>
            </>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Test</th>
                  <th className="num">Athlete</th>
                  <th className="num">Pool avg</th>
                  <th className="num">Best</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => {
                  const v = rawFor(athlete.id, t.id);
                  const arr = pool.get(t.id) ?? [];
                  const popAvg = arr.length ? mean(arr) : null;
                  const best = arr.length ? (t.higherIsBetter ? Math.max(...arr) : Math.min(...arr)) : null;
                  const dec = t.unit === "kg" || t.unit === "cm" ? 1 : 2;
                  const beats = v !== null && popAvg !== null && (t.higherIsBetter ? v >= popAvg : v <= popAvg);
                  return (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.shortName}</td>
                      <td className="num" style={{ fontWeight: 700, color: beats ? "var(--good)" : "var(--bad)" }}>
                        {v === null ? "—" : round(v, dec)}
                      </td>
                      <td className="num muted">{popAvg === null ? "—" : round(popAvg, dec)}</td>
                      <td className="num faint">{best === null ? "—" : round(best, dec)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <div style={{ gridColumn: "span 2" }}>
          {mode === "pct" ? (
            <Card title="Overall athleticism leaderboard" sub="Ranked by composite index within the filtered pool">
              <RankTable
                rows={ranked.map((r) => ({ athlete: r.athlete, value: round(r.score, 0) }))}
                athleteId={effectiveAthleteId}
                selfRank={rankIdx}
                valueLabel="Index"
                valueMax={100}
              />
            </Card>
          ) : (
            <Card
              title="Raw leaderboard"
              sub={`${rawTest?.name} across the filtered pool`}
              actions={
                <select value={rawTestId} onChange={(e) => setRawTestId(e.target.value)}>
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.shortName}
                    </option>
                  ))}
                </select>
              }
            >
              <RankTable
                rows={rawBoard}
                athleteId={effectiveAthleteId}
                selfRank={rawRankIdx}
                valueLabel={rawTest?.unit || "value"}
                valueMax={Math.max(...rawBoard.map((r) => r.value), 1)}
                lowerIsBetter={!rawTest?.higherIsBetter}
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

// ── Filter bar sub-component ────────────────────────────────────────────────

function FilterBar({
  genderFilter,
  setGenderFilter,
  ageBandFilter,
  setAgeBandFilter,
  availableBands,
}: {
  genderFilter: "all" | Gender;
  setGenderFilter: (v: "all" | Gender) => void;
  ageBandFilter: string;
  setAgeBandFilter: (v: string) => void;
  availableBands: string[];
}) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <div className="field">
        <label>Gender</label>
        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value as "all" | Gender)}
          style={{ padding: "6px 10px", fontSize: 12.5 }}
        >
          <option value="all">All</option>
          <option value="M">Men</option>
          <option value="F">Women</option>
        </select>
      </div>
      <div className="field">
        <label>Age band</label>
        <select
          value={ageBandFilter}
          onChange={(e) => setAgeBandFilter(e.target.value)}
          style={{ padding: "6px 10px", fontSize: 12.5 }}
        >
          <option value="all">All ages</option>
          {availableBands.map((b) => (
            <option key={b} value={b}>
              {b} yrs
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Squad overview sub-component ────────────────────────────────────────────

function SquadOverview({
  sportSummary,
  maxComposite,
}: {
  sportSummary: {
    sport: { id: string; name: string };
    count: number;
    women: number;
    men: number;
    avgAge: number;
    avgComposite: number;
  }[];
  maxComposite: number;
}) {
  return (
    <Card title="Squad overview" sub="Composite athleticism index = mean percentile across shared tests">
      {sportSummary.map((s) => (
        <div key={s.sport.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="row" style={{ gap: 8 }}>
              <span className="dot" style={{ background: SPORT_COLORS[s.sport.id] }} />
              <span style={{ fontWeight: 650 }}>{s.sport.name}</span>
              {s.count === 0 && <span className="faint" style={{ fontSize: 11 }}>(no data)</span>}
            </span>
            <span style={{ fontWeight: 700 }}>{s.count > 0 ? s.avgComposite : "—"}</span>
          </div>
          {s.count > 0 && <Bar value={s.avgComposite} max={maxComposite} color={SPORT_COLORS[s.sport.id]} />}
          <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
            {s.count > 0
              ? `${s.count} athletes · ${s.men}M / ${s.women}F · avg age ${s.avgAge}`
              : "No athletes in this filter"}
          </div>
        </div>
      ))}
    </Card>
  );
}

// ── Rank table sub-component ────────────────────────────────────────────────

function RankTable({
  rows,
  athleteId,
  selfRank,
  valueLabel,
  valueMax,
  lowerIsBetter = false,
}: {
  rows: { athlete: Athlete; value: number }[];
  athleteId: string;
  selfRank: number;
  valueLabel: string;
  valueMax: number;
  lowerIsBetter?: boolean;
}) {
  const renderRow = (r: { athlete: Athlete; value: number }, i: number) => {
    const isSelf = r.athlete.id === athleteId;
    const sid = r.athlete.profiles[0]?.sportId ?? "";
    const barVal = lowerIsBetter ? valueMax - r.value + 0.0001 : r.value;
    return (
      <tr key={r.athlete.id}>
        <td style={{ fontWeight: 700, color: i < 3 ? "var(--accent)" : "var(--text-faint)" }}>{i + 1}</td>
        <td>
          <Link to={`/athletes/${r.athlete.id}`} className="row">
            <Avatar name={r.athlete.name} size={28} />
            <span style={{ fontWeight: isSelf ? 700 : 500 }}>
              {r.athlete.name}
              {isSelf && <span className="pill accent" style={{ marginLeft: 8 }}>selected</span>}
            </span>
          </Link>
        </td>
        <td>
          <span className="pill" style={{ color: SPORT_COLORS[sid] }}>
            {SPORT_BY_ID[sid]?.name}
          </span>
        </td>
        <td className="num" style={{ fontWeight: 700 }}>
          {r.value}
        </td>
        <td>
          <Bar value={barVal} max={valueMax} color={isSelf ? "var(--accent)" : SPORT_COLORS[sid]} />
        </td>
      </tr>
    );
  };
  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: 40 }}>#</th>
          <th>Athlete</th>
          <th>Sport</th>
          <th className="num">{valueLabel}</th>
          <th style={{ width: 200 }}></th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 12).map(renderRow)}
        {selfRank >= 12 && rows[selfRank] && renderRow(rows[selfRank], selfRank)}
      </tbody>
    </table>
  );
}
