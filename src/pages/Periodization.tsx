import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { PageHead } from "../components/Layout";
import { Card } from "../components/ui";
import { SPORTS, TEST_BY_ID, testsForSport } from "../data/catalog";
import { athleteTrainingWeeks, useStore } from "../data/store";
import { formatMonth } from "../lib/format";
import { correlationStrength, linearRegression, round } from "../lib/stats";
import type { PeriodizationPhase, TestResult } from "../types";

const PHASE_COLOR: Record<PeriodizationPhase, string> = {
  Preparation: "#0ea5e9",
  "Pre-Competition": "#8b5cf6",
  Competition: "#f97316",
  Transition: "#22c55e",
};

export default function Periodization() {
  const { athletes, testResults, trainingWeeks } = useStore();
  const [sportId, setSportId] = useState(SPORTS[0].id);
  const sportAthletes = useMemo(
    () => athletes.filter((a) => a.profiles.some((p) => p.sportId === sportId)),
    [athletes, sportId],
  );
  const [athleteId, setAthleteId] = useState(sportAthletes[0]?.id ?? "");
  const athlete = sportAthletes.find((a) => a.id === athleteId) ?? sportAthletes[0];
  const [testId, setTestId] = useState("cmj");
  const testType = TEST_BY_ID[testId];

  // Monthly load + test value series for the selected athlete.
  const monthly = useMemo(() => {
    if (!athlete) return [];
    const weeks = athleteTrainingWeeks(trainingWeeks, athlete.id, sportId);
    const loadByMonth = new Map<string, { sum: number; n: number; phase: PeriodizationPhase }>();
    for (const w of weeks) {
      const key = w.weekStart.slice(0, 7);
      const cur = loadByMonth.get(key) ?? { sum: 0, n: 0, phase: w.phase };
      cur.sum += w.actualLoad;
      cur.n += 1;
      cur.phase = w.phase;
      loadByMonth.set(key, cur);
    }
    const testByMonth = new Map<string, number>();
    for (const r of testResults) {
      if (r.athleteId !== athlete.id || r.sportId !== sportId || r.testTypeId !== testId)
        continue;
      testByMonth.set(r.date.slice(0, 7), r.value);
    }
    return [...loadByMonth.entries()]
      .sort()
      .slice(-18)
      .map(([key, v]) => ({
        month: formatMonth(key + "-01"),
        load: Math.round(v.sum / v.n),
        phase: v.phase,
        test: testByMonth.get(key) ?? null,
      }));
  }, [athlete, trainingWeeks, testResults, sportId, testId]);

  // Phase summary table for the selected athlete.
  const phaseSummary = useMemo(() => {
    if (!athlete) return [];
    const weeks = athleteTrainingWeeks(trainingWeeks, athlete.id, sportId);
    const agg = new Map<PeriodizationPhase, { planned: number; actual: number; n: number }>();
    for (const w of weeks) {
      const cur = agg.get(w.phase) ?? { planned: 0, actual: 0, n: 0 };
      cur.planned += w.plannedLoad;
      cur.actual += w.actualLoad;
      cur.n += 1;
      agg.set(w.phase, cur);
    }
    const order: PeriodizationPhase[] = [
      "Preparation",
      "Pre-Competition",
      "Competition",
      "Transition",
    ];
    return order
      .filter((p) => agg.has(p))
      .map((p) => {
        const a = agg.get(p)!;
        return {
          phase: p,
          weeks: a.n,
          avgPlanned: Math.round(a.planned / a.n),
          avgActual: Math.round(a.actual / a.n),
          adherence: round((a.actual / a.planned) * 100, 0),
        };
      });
  }, [athlete, trainingWeeks, sportId]);

  // Squad-level: does higher training load relate to bigger test gains?
  const loadVsGain = useMemo(() => {
    const pts: { x: number; y: number; name: string }[] = [];
    for (const a of sportAthletes) {
      const series = testResults
        .filter((r: TestResult) => r.athleteId === a.id && r.sportId === sportId && r.testTypeId === testId)
        .sort((m, n) => m.date.localeCompare(n.date));
      if (series.length < 2) continue;
      const first = series[0].value;
      const last = series[series.length - 1].value;
      // Oriented improvement: positive = better.
      const gainPct = ((last - first) / first) * 100 * (testType?.higherIsBetter ? 1 : -1);
      const weeks = athleteTrainingWeeks(trainingWeeks, a.id, sportId);
      if (weeks.length === 0) continue;
      const avgLoad =
        weeks.reduce((s, w) => s + w.actualLoad, 0) / weeks.length;
      pts.push({ x: Math.round(avgLoad), y: round(gainPct, 1), name: a.name });
    }
    const fit = linearRegression(
      pts.map((p) => p.x),
      pts.map((p) => p.y),
    );
    const xs = pts.map((p) => p.x);
    const line =
      xs.length > 0
        ? [
            { x: Math.min(...xs), y: fit.predict(Math.min(...xs)) },
            { x: Math.max(...xs), y: fit.predict(Math.max(...xs)) },
          ]
        : [];
    return { pts, fit, line };
  }, [sportAthletes, testResults, trainingWeeks, sportId, testId, testType]);

  if (!athlete) {
    return (
      <>
        <PageHead title="Periodization" />
        <div className="empty">No athletes in this sport.</div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Periodization & Load"
        subtitle="The training plan in context: weekly load through the macrocycle phases, and how that load tracks against test progress and squad-wide gains."
        actions={
          <div className="row">
            <select value={sportId} onChange={(e) => setSportId(e.target.value)}>
              {SPORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
              {sportAthletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <Card
        title="Load vs test progress"
        sub={`Monthly average training load (bars) against ${testType?.name} (${testType?.unit || "index"}, line) for ${athlete.name}`}
        actions={
          <select value={testId} onChange={(e) => setTestId(e.target.value)}>
            {testsForSport(sportId).map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortName}
              </option>
            ))}
          </select>
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={monthly} margin={{ left: -12, right: 4, top: 8 }}>
            <CartesianGrid stroke="#243456" vertical={false} />
            <XAxis dataKey="month" stroke="#6b7da0" fontSize={11} tickLine={false} />
            <YAxis yAxisId="load" stroke="#6b7da0" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="test"
              orientation="right"
              stroke="#6b7da0"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#15203a",
                border: "1px solid #243456",
                borderRadius: 8,
                color: "#e8eefc",
              }}
            />
            <Bar yAxisId="load" dataKey="load" radius={[3, 3, 0, 0]} fill="#243456" />
            <Line
              yAxisId="test"
              type="monotone"
              dataKey="test"
              stroke="#0ea5e9"
              strokeWidth={2.5}
              connectNulls
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="legend mt-8">
          <span className="item">
            <span className="dot" style={{ background: "#243456" }} /> Monthly load
          </span>
          <span className="item">
            <span className="dot" style={{ background: "#0ea5e9" }} /> {testType?.shortName}
          </span>
        </div>
      </Card>

      <div className="grid cols-3 mt-16">
        <div style={{ gridColumn: "span 2" }}>
          <Card title="Phase breakdown" sub={`Macrocycle structure for ${athlete.name}`}>
            <table>
              <thead>
                <tr>
                  <th>Phase</th>
                  <th className="num">Weeks</th>
                  <th className="num">Avg planned</th>
                  <th className="num">Avg actual</th>
                  <th className="num">Adherence</th>
                </tr>
              </thead>
              <tbody>
                {phaseSummary.map((p) => (
                  <tr key={p.phase}>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <span className="dot" style={{ background: PHASE_COLOR[p.phase] }} />
                        <span style={{ fontWeight: 600 }}>{p.phase}</span>
                      </span>
                    </td>
                    <td className="num">{p.weeks}</td>
                    <td className="num">{p.avgPlanned}</td>
                    <td className="num">{p.avgActual}</td>
                    <td className="num" style={{ color: p.adherence >= 90 ? "var(--good)" : "var(--warn)" }}>
                      {p.adherence}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <Card title="Load → gains" sub="Squad: avg load vs test change">
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>r = {round(loadVsGain.fit.r, 2)}</span>
            <span className="faint" style={{ fontSize: 12, marginLeft: 8 }}>
              {correlationStrength(loadVsGain.fit.r)}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <ScatterChart margin={{ left: -10, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid stroke="#243456" />
              <XAxis
                type="number"
                dataKey="x"
                name="Avg load"
                stroke="#6b7da0"
                fontSize={10}
                domain={["auto", "auto"]}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Gain %"
                stroke="#6b7da0"
                fontSize={10}
                domain={["auto", "auto"]}
              />
              <ZAxis range={[50, 50]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  background: "#15203a",
                  border: "1px solid #243456",
                  borderRadius: 8,
                  color: "#e8eefc",
                }}
                formatter={(v: number) => round(v, 1)}
              />
              <Scatter data={loadVsGain.line} line={{ stroke: "#f97316", strokeWidth: 2 }} shape={() => <g />} />
              <Scatter data={loadVsGain.pts} fill="#22c55e" />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>
            Each point is an athlete: mean weekly load vs % change in {testType?.shortName}.
          </p>
        </Card>
      </div>
    </>
  );
}
