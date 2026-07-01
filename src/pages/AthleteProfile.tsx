import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHead } from "../components/Layout";
import { Avatar, Bar, Card } from "../components/ui";
import {
  CATEGORY_COLORS,
  SPORT_BY_ID,
  TEST_BY_ID,
  testsForSport,
} from "../data/catalog";
import { athleteTrainingWeeks, latestTests, useStore } from "../data/store";
import {
  ageBand,
  ageOn,
  formatMonth,
  genderLabel,
  yearsBetween,
} from "../lib/format";
import { percentileRank, round } from "../lib/stats";

export default function AthleteProfile() {
  const { id } = useParams();
  const { athletes, testResults, competitionResults, trainingWeeks } = useStore();
  const athlete = athletes.find((a) => a.id === id);
  const [sportId, setSportId] = useState(athlete?.profiles[0]?.sportId ?? "");

  const age = athlete ? ageOn(athlete.birthDate) : 0;

  // Peer pool: same gender + same five-year age band + same sport.
  const peerLatest = useMemo(() => {
    if (!athlete) return new Map<string, number[]>();
    const peers = athletes.filter(
      (a) =>
        a.gender === athlete.gender &&
        ageBand(ageOn(a.birthDate)) === ageBand(age) &&
        a.profiles.some((p) => p.sportId === sportId),
    );
    const pool = new Map<string, number[]>();
    for (const peer of peers) {
      const lt = latestTests(testResults, peer.id, sportId);
      for (const [tid, r] of lt) {
        if (!pool.has(tid)) pool.set(tid, []);
        pool.get(tid)!.push(r.value);
      }
    }
    return pool;
  }, [athlete, athletes, testResults, sportId, age]);

  if (!athlete) {
    return (
      <>
        <PageHead title="Athlete not found" />
        <Link to="/athletes" className="btn ghost">
          ← Back to roster
        </Link>
      </>
    );
  }

  const profile = athlete.profiles.find((p) => p.sportId === sportId) ?? athlete.profiles[0];
  const sport = SPORT_BY_ID[sportId];
  const own = latestTests(testResults, athlete.id, sportId);
  const tests = testsForSport(sportId);

  // Test progression series for a chosen highlighted test.
  const [focusTest, setFocusTest] = useState("cmj");
  const progression = testResults
    .filter(
      (r) =>
        r.athleteId === athlete.id &&
        r.sportId === sportId &&
        r.testTypeId === focusTest,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ month: formatMonth(r.date), value: r.value }));

  // Training load (last 26 weeks) vs the progression visually aligned by month.
  const weeks = athleteTrainingWeeks(trainingWeeks, athlete.id, sportId).slice(-26);
  const loadSeries = weeks.map((w) => ({
    week: w.weekStart.slice(5),
    actual: w.actualLoad,
    planned: w.plannedLoad,
  }));

  const comps = competitionResults
    .filter((c) => c.athleteId === athlete.id && c.sportId === sportId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const focusType = TEST_BY_ID[focusTest];

  return (
    <>
      <PageHead
        title={athlete.name}
        subtitle={`${genderLabel(athlete.gender)} · ${age} yrs · ${athlete.heightCm} cm · ${athlete.massKg} kg`}
        actions={
          athlete.profiles.length > 1 ? (
            <select value={sportId} onChange={(e) => setSportId(e.target.value)}>
              {athlete.profiles.map((p) => (
                <option key={p.sportId} value={p.sportId}>
                  {SPORT_BY_ID[p.sportId]?.name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      <div className="grid cols-4">
        <Card>
          <div className="row">
            <Avatar name={athlete.name} size={52} />
            <div>
              <div style={{ fontWeight: 650 }}>{sport?.name}</div>
              <div className="faint" style={{ fontSize: 12.5 }}>
                {Math.round(yearsBetween(profile.startedOn))} yrs experience
              </div>
            </div>
          </div>
          <div className="mt-16 row wrap" style={{ gap: 6 }}>
            {profile.eventIds.map((eid) => (
              <span className="pill accent" key={eid}>
                {sport?.events.find((e) => e.id === eid)?.name}
              </span>
            ))}
          </div>
        </Card>
        <Card>
          <div className="stat">
            <div className="value">{age}</div>
            <div className="label">Age · band {ageBand(age)}</div>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <div className="value">{own.size}</div>
            <div className="label">Tests in battery</div>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <div className="value">{comps.length}</div>
            <div className="label">Competition marks</div>
          </div>
        </Card>
      </div>

      <h2 className="section-title">Test battery vs peers</h2>
      <p className="faint" style={{ marginTop: -8, marginBottom: 14, fontSize: 13 }}>
        Percentile within {genderLabel(athlete.gender).toLowerCase()} aged {ageBand(age)} in{" "}
        {sport?.name}. 100 = best in peer group.
      </p>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Test</th>
              <th>Quality</th>
              <th className="num">Latest</th>
              <th className="num">Percentile</th>
              <th style={{ width: 220 }}>Standing</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => {
              const r = own.get(t.id);
              if (!r) return null;
              const pool = peerLatest.get(t.id) ?? [];
              const pct = round(percentileRank(r.value, pool, t.higherIsBetter), 0);
              const color =
                pct >= 75 ? "var(--good)" : pct >= 40 ? "var(--warn)" : "var(--bad)";
              return (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td>
                    <span className="pill" style={{ color: CATEGORY_COLORS[t.category] }}>
                      {t.category}
                    </span>
                  </td>
                  <td className="num">
                    {r.value} {t.unit}
                  </td>
                  <td className="num" style={{ color, fontWeight: 700 }}>
                    {pct}
                  </td>
                  <td>
                    <Bar value={pct} max={100} color={color} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid cols-2 mt-16">
        <Card
          title="Test progression"
          sub={`${focusType?.name} over time (${focusType?.unit || "index"})`}
          actions={
            <select value={focusTest} onChange={(e) => setFocusTest(e.target.value)}>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.shortName}
                </option>
              ))}
            </select>
          }
        >
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={progression} margin={{ left: -16, right: 8, top: 6 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--chart-axis)" fontSize={11} tickLine={false} />
              <YAxis
                stroke="var(--chart-axis)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--tooltip-bg)",
                  border: "1px solid var(--tooltip-border)",
                  borderRadius: 8,
                  color: "var(--tooltip-text)",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={CATEGORY_COLORS[focusType?.category ?? "Speed"]}
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Training load" sub="Planned vs actual weekly load (last 26 weeks)">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={loadSeries} margin={{ left: -16, right: 8, top: 6 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="week" stroke="var(--chart-axis)" fontSize={10} tickLine={false} />
              <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--tooltip-bg)",
                  border: "1px solid var(--tooltip-border)",
                  borderRadius: 8,
                  color: "var(--tooltip-text)",
                }}
              />
              <Line type="monotone" dataKey="planned" stroke="var(--chart-axis)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
              <Line type="monotone" dataKey="actual" stroke="#22c55e" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="legend mt-8">
            <span className="item">
              <span className="dot" style={{ background: "#22c55e" }} /> Actual
            </span>
            <span className="item">
              <span className="dot" style={{ background: "var(--chart-axis)" }} /> Planned
            </span>
          </div>
        </Card>
      </div>

      <h2 className="section-title">Competition results</h2>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Competition</th>
              <th className="num">Mark</th>
              <th className="num">Place</th>
            </tr>
          </thead>
          <tbody>
            {comps.slice(0, 12).map((c) => {
              const ev = sport?.events.find((e) => e.id === c.eventId);
              return (
                <tr key={c.id}>
                  <td className="muted">{formatMonth(c.date)}</td>
                  <td style={{ fontWeight: 600 }}>{ev?.name}</td>
                  <td className="muted">{c.competition}</td>
                  <td className="num">
                    {c.mark} {ev?.unit}
                  </td>
                  <td className="num">{c.placing}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {comps.length === 0 && <div className="empty">No competition results logged.</div>}
      </div>
    </>
  );
}
