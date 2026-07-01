import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
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
import { SPORT_BY_ID, SPORTS, testsForSport } from "../data/catalog";
import { latestTests, useStore } from "../data/store";
import { ageOn, yearsBetween } from "../lib/format";
import { correlationStrength, linearRegression, pearson, round } from "../lib/stats";
import type { Athlete, TestResult } from "../types";

interface Variable {
  key: string;
  label: string;
  get: (a: Athlete, latest: Map<string, TestResult>) => number | null;
}

function buildVariables(sportId: string): Variable[] {
  const vars: Variable[] = [
    { key: "age", label: "Age", get: (a) => ageOn(a.birthDate) },
    {
      key: "exp",
      label: "Experience (yrs)",
      get: (a) => {
        const p = a.profiles.find((x) => x.sportId === sportId);
        return p ? round(yearsBetween(p.startedOn), 1) : null;
      },
    },
    { key: "mass", label: "Body mass (kg)", get: (a) => a.massKg },
  ];
  for (const t of testsForSport(sportId)) {
    vars.push({
      key: `t:${t.id}`,
      label: t.shortName,
      // Orient so that a higher number is always a better performance.
      get: (_a, latest) => {
        const r = latest.get(t.id);
        if (!r) return null;
        return t.higherIsBetter ? r.value : -r.value;
      },
    });
  }
  return vars;
}

function heatColor(r: number): string {
  // Blue (negative) → grey (0) → orange (positive).
  const a = Math.min(1, Math.abs(r));
  if (r >= 0) {
    return `rgba(249, 115, 22, ${0.12 + a * 0.8})`;
  }
  return `rgba(14, 165, 233, ${0.12 + a * 0.8})`;
}

export default function Correlations() {
  const { athletes, testResults } = useStore();
  const [sportId, setSportId] = useState(SPORTS[0].id);

  const records = useMemo(() => {
    const sportAthletes = athletes.filter((a) =>
      a.profiles.some((p) => p.sportId === sportId),
    );
    return sportAthletes.map((a) => ({
      athlete: a,
      latest: latestTests(testResults, a.id, sportId),
    }));
  }, [athletes, testResults, sportId]);

  const variables = useMemo(() => buildVariables(sportId), [sportId]);

  // Pairwise correlation matrix.
  const matrix = useMemo(() => {
    return variables.map((row) =>
      variables.map((col) => {
        const xs: number[] = [];
        const ys: number[] = [];
        for (const rec of records) {
          const x = row.get(rec.athlete, rec.latest);
          const y = col.get(rec.athlete, rec.latest);
          if (x === null || y === null) continue;
          xs.push(x);
          ys.push(y);
        }
        return { r: xs.length >= 4 ? pearson(xs, ys) : NaN, n: xs.length };
      }),
    );
  }, [variables, records]);

  // Strongest off-diagonal correlations for the insights panel.
  const insights = useMemo(() => {
    const seen = new Set<string>();
    const out: { a: string; b: string; r: number }[] = [];
    for (let i = 0; i < variables.length; i++) {
      for (let j = i + 1; j < variables.length; j++) {
        const cell = matrix[i][j];
        if (Number.isNaN(cell.r)) continue;
        const k = `${i}-${j}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ a: variables[i].label, b: variables[j].label, r: cell.r });
      }
    }
    return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, 6);
  }, [matrix, variables]);

  // Scatter explorer.
  const [xKey, setXKey] = useState("t:cmj");
  const [yKey, setYKey] = useState("t:serveVel");

  // Keep the chosen axes valid when the sport (and its test list) changes.
  useEffect(() => {
    const keys = new Set(variables.map((v) => v.key));
    if (!keys.has(xKey) || !keys.has(yKey)) {
      const tests = variables.filter((v) => v.key.startsWith("t:"));
      setXKey(tests[0]?.key ?? variables[0].key);
      setYKey(tests[1]?.key ?? variables[1]?.key ?? variables[0].key);
    }
  }, [variables, xKey, yKey]);

  const xVar = variables.find((v) => v.key === xKey) ?? variables[0];
  const yVar = variables.find((v) => v.key === yKey) ?? variables[1];

  const scatter = useMemo(() => {
    const pts: { x: number; y: number; name: string }[] = [];
    for (const rec of records) {
      const x = xVar.get(rec.athlete, rec.latest);
      const y = yVar.get(rec.athlete, rec.latest);
      if (x === null || y === null) continue;
      pts.push({ x, y, name: rec.athlete.name });
    }
    const fit = linearRegression(
      pts.map((p) => p.x),
      pts.map((p) => p.y),
    );
    const xsVals = pts.map((p) => p.x);
    const minX = Math.min(...xsVals);
    const maxX = Math.max(...xsVals);
    const line = [
      { x: minX, y: fit.predict(minX) },
      { x: maxX, y: fit.predict(maxX) },
    ];
    return { pts, fit, line };
  }, [records, xVar, yVar]);

  return (
    <>
      <PageHead
        title="Correlation Analysis"
        subtitle="How do physical qualities relate to each other and to age, experience and body mass? Tests are oriented so a higher score is always a better performance — orange means qualities rise together, blue means one rises as the other falls."
        actions={
          <select value={sportId} onChange={(e) => setSportId(e.target.value)}>
            {SPORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        }
      />

      <Card
        title="Correlation matrix"
        sub={`Pearson r across ${records.length} ${SPORT_BY_ID[sportId]?.name} athletes (pairwise, n ≥ 4 required)`}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th></th>
                {variables.map((v) => (
                  <th key={v.key} className="num" style={{ fontSize: 10.5 }}>
                    {v.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variables.map((row, i) => (
                <tr key={row.key}>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{row.label}</td>
                  {variables.map((col, j) => {
                    const cell = matrix[i][j];
                    if (i === j)
                      return (
                        <td key={col.key} style={{ textAlign: "center", color: "var(--text-faint)" }}>
                          —
                        </td>
                      );
                    if (Number.isNaN(cell.r))
                      return (
                        <td key={col.key} style={{ textAlign: "center", color: "var(--text-faint)" }}>
                          ·
                        </td>
                      );
                    return (
                      <td key={col.key} style={{ padding: 4 }}>
                        <div className="heat-cell" style={{ background: heatColor(cell.r) }}>
                          {round(cell.r, 2)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid cols-3 mt-16">
        <div style={{ gridColumn: "span 2" }}>
          <Card title="Scatter explorer" sub="Pick any two variables to see their relationship and best-fit line">
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <div className="field">
                <label>X axis</label>
                <select value={xKey} onChange={(e) => setXKey(e.target.value)}>
                  {variables.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Y axis</label>
                <select value={yKey} onChange={(e) => setYKey(e.target.value)}>
                  {variables.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="spacer" />
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>r = {round(scatter.fit.r, 2)}</div>
                <div className="faint" style={{ fontSize: 12 }}>
                  R² = {round(scatter.fit.r2, 2)} · {correlationStrength(scatter.fit.r)}
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ left: -8, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={xVar.label}
                  stroke="var(--chart-axis)"
                  fontSize={11}
                  domain={["auto", "auto"]}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={yVar.label}
                  stroke="var(--chart-axis)"
                  fontSize={11}
                  domain={["auto", "auto"]}
                />
                <ZAxis range={[60, 60]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "var(--tooltip-bg)",
                    border: "1px solid var(--tooltip-border)",
                    borderRadius: 8,
                    color: "var(--tooltip-text)",
                  }}
                  formatter={(v: number) => round(v, 2)}
                />
                <Scatter data={scatter.line} line={{ stroke: "#f97316", strokeWidth: 2 }} shape={() => <g />} />
                <Scatter data={scatter.pts} fill="var(--series-1)" />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="faint" style={{ fontSize: 12.5, marginTop: 8 }}>
              {xVar.label} vs {yVar.label}. Each point is an athlete; the orange line is the
              least-squares fit.
            </p>
          </Card>
        </div>

        <Card title="Key relationships" sub="Strongest correlations found">
          {insights.map((ins, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div className="row between">
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {ins.a} ↔ {ins.b}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    color: ins.r >= 0 ? "#f97316" : "var(--series-1)",
                  }}
                >
                  {round(ins.r, 2)}
                </span>
              </div>
              <div className="faint" style={{ fontSize: 12 }}>
                {correlationStrength(ins.r)} {ins.r >= 0 ? "positive" : "negative"} correlation
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
