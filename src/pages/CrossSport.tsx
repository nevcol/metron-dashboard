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
import { ageOn, genderLabel } from "../lib/format";
import { percentileRank, round } from "../lib/stats";
import type { Athlete, TestResult } from "../types";

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

  // Population pool per common test (latest value for every athlete) and a
  // helper that returns an athlete's percentile within the whole population.
  const { pctFor, composite } = useMemo(() => {
    const pool = new Map<string, number[]>();
    const values = new Map<string, Map<string, number>>(); // athleteId -> testId -> value
    for (const a of athletes) {
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
    const pctFor = (athleteId: string, testId: string): number | null => {
      const v = values.get(athleteId)?.get(testId);
      if (v === undefined) return null;
      const t = tests.find((x) => x.id === testId)!;
      return percentileRank(v, pool.get(testId) ?? [], t.higherIsBetter);
    };
    // Composite athleticism index = mean percentile across common tests.
    const composite = new Map<string, number>();
    for (const a of athletes) {
      const pcts: number[] = [];
      for (const t of tests) {
        const p = pctFor(a.id, t.id);
        if (p !== null) pcts.push(p);
      }
      if (pcts.length) composite.set(a.id, pcts.reduce((s, x) => s + x, 0) / pcts.length);
    }
    return { pctFor, composite };
  }, [athletes, testResults, tests]);

  // ---- Part A: sport population profiles ----
  const sportAthletes = useMemo(() => {
    const m = new Map<string, Athlete[]>();
    for (const s of SPORTS) m.set(s.id, []);
    for (const a of athletes) {
      const sid = a.profiles[0]?.sportId;
      if (sid && m.has(sid)) m.get(sid)!.push(a);
    }
    return m;
  }, [athletes]);

  // Radar: one axis per common test, one series per sport (mean percentile).
  const sportRadar = useMemo(() => {
    return tests.map((t) => {
      const row: Record<string, number | string> = { test: t.shortName };
      for (const s of SPORTS) {
        const pcts = (sportAthletes.get(s.id) ?? [])
          .map((a) => pctFor(a.id, t.id))
          .filter((p): p is number => p !== null);
        row[s.name] = pcts.length ? round(pcts.reduce((x, y) => x + y, 0) / pcts.length, 0) : 0;
      }
      return row;
    });
  }, [tests, sportAthletes, pctFor]);

  const sportSummary = useMemo(() => {
    return SPORTS.map((s) => {
      const roster = sportAthletes.get(s.id) ?? [];
      const comps = roster.map((a) => composite.get(a.id) ?? 0);
      const women = roster.filter((a) => a.gender === "F").length;
      const avgComposite = comps.length ? comps.reduce((x, y) => x + y, 0) / comps.length : 0;
      const avgAge = roster.length
        ? roster.reduce((x, a) => x + ageOn(a.birthDate), 0) / roster.length
        : 0;
      return {
        sport: s,
        count: roster.length,
        women,
        men: roster.length - women,
        avgAge: round(avgAge, 1),
        avgComposite: round(avgComposite, 0),
      };
    });
  }, [sportAthletes, composite]);

  const maxComposite = Math.max(...sportSummary.map((s) => s.avgComposite), 1);

  // ---- Part B: one athlete vs the entire population ----
  const ranked = useMemo(
    () =>
      [...composite.entries()]
        .map(([id, score]) => ({ athlete: athletes.find((a) => a.id === id)!, score }))
        .sort((a, b) => b.score - a.score),
    [composite, athletes],
  );

  const [athleteId, setAthleteId] = useState(ranked[0]?.athlete.id ?? athletes[0]?.id ?? "");
  const athlete = athletes.find((a) => a.id === athleteId);
  const rankIdx = ranked.findIndex((r) => r.athlete.id === athleteId);

  const athleteRadar = useMemo(() => {
    if (!athlete) return [];
    return tests
      .map((t) => {
        const p = pctFor(athlete.id, t.id);
        return p === null ? null : { test: t.shortName, percentile: round(p, 0) };
      })
      .filter(Boolean) as { test: string; percentile: number }[];
  }, [athlete, tests, pctFor]);

  if (!athlete) {
    return (
      <>
        <PageHead title="Cross-Sport Comparison" />
        <div className="empty">No athletes available.</div>
      </>
    );
  }

  const athleteSport = SPORT_BY_ID[athlete.profiles[0]?.sportId ?? ""];

  return (
    <>
      <PageHead
        title="Cross-Sport Comparison"
        subtitle="Benchmarking across sports on the test battery every sport shares, normalized to percentiles over the whole athlete population so different events compare fairly. 50 = population median; 100 = best overall."
      />

      <h2 className="section-title" style={{ marginTop: 4 }}>
        Population by sport
      </h2>
      <div className="grid cols-3">
        <div style={{ gridColumn: "span 2" }}>
          <Card title="Physical profile by sport" sub="Mean percentile per shared test, across the whole population">
            <ResponsiveContainer width="100%" height={330}>
              <RadarChart data={sportRadar} outerRadius={120}>
                <PolarGrid stroke="#243456" />
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
                  contentStyle={{
                    background: "#15203a",
                    border: "1px solid #243456",
                    borderRadius: 8,
                    color: "#e8eefc",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
            <div className="legend mt-8">
              {SPORTS.map((s) => (
                <span className="item" key={s.id}>
                  <span className="dot" style={{ background: SPORT_COLORS[s.id] }} />
                  {s.name}
                </span>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Squad overview" sub="Composite athleticism index = mean percentile across shared tests">
          {sportSummary.map((s) => (
            <div key={s.sport.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span className="row" style={{ gap: 8 }}>
                  <span className="dot" style={{ background: SPORT_COLORS[s.sport.id] }} />
                  <span style={{ fontWeight: 650 }}>{s.sport.name}</span>
                </span>
                <span style={{ fontWeight: 700 }}>{s.avgComposite}</span>
              </div>
              <Bar value={s.avgComposite} max={maxComposite} color={SPORT_COLORS[s.sport.id]} />
              <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
                {s.count} athletes · {s.men}M / {s.women}F · avg age {s.avgAge}
              </div>
            </div>
          ))}
        </Card>
      </div>

      <h2 className="section-title">Athlete vs entire population</h2>
      <div className="grid cols-3">
        <Card title="Percentile vs all athletes" sub="Across every sport, on the shared battery">
          <select
            value={athleteId}
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
          <ResponsiveContainer width="100%" height={290}>
            <RadarChart data={athleteRadar} outerRadius={100}>
              <PolarGrid stroke="#243456" />
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
                contentStyle={{
                  background: "#15203a",
                  border: "1px solid #243456",
                  borderRadius: 8,
                  color: "#e8eefc",
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div className="row between mt-8">
            <span className="faint" style={{ fontSize: 12.5 }}>Overall athleticism rank</span>
            <span className="pill accent">
              #{rankIdx + 1} of {ranked.length}
            </span>
          </div>
        </Card>

        <div style={{ gridColumn: "span 2" }}>
          <Card title="Overall athleticism leaderboard" sub="Every athlete ranked by composite index, regardless of sport">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Athlete</th>
                  <th>Sport</th>
                  <th className="num">Index</th>
                  <th style={{ width: 200 }}></th>
                </tr>
              </thead>
              <tbody>
                {ranked.slice(0, 12).map((r, i) => {
                  const isSelf = r.athlete.id === athleteId;
                  const sid = r.athlete.profiles[0]?.sportId ?? "";
                  return (
                    <tr key={r.athlete.id}>
                      <td style={{ fontWeight: 700, color: i < 3 ? "var(--accent)" : "var(--text-faint)" }}>
                        {i + 1}
                      </td>
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
                        {round(r.score, 0)}
                      </td>
                      <td>
                        <Bar value={r.score} max={100} color={isSelf ? "var(--accent)" : SPORT_COLORS[sid]} />
                      </td>
                    </tr>
                  );
                })}
                {rankIdx >= 12 && (
                  <tr>
                    <td style={{ fontWeight: 700, color: "var(--accent)" }}>{rankIdx + 1}</td>
                    <td>
                      <Link to={`/athletes/${athlete.id}`} className="row">
                        <Avatar name={athlete.name} size={28} />
                        <span style={{ fontWeight: 700 }}>
                          {athlete.name}
                          <span className="pill accent" style={{ marginLeft: 8 }}>selected</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="pill" style={{ color: SPORT_COLORS[athlete.profiles[0]?.sportId ?? ""] }}>
                        {athleteSport?.name}
                      </span>
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {round(ranked[rankIdx].score, 0)}
                    </td>
                    <td>
                      <Bar value={ranked[rankIdx].score} max={100} color="var(--accent)" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </>
  );
}
