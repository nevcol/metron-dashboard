import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { PageHead } from "../components/Layout";
import { Bar as LoadBar, Card } from "../components/ui";
import {
  ALL_QUALITIES,
  PHASE_COLOR,
  PHASE_ORDER,
  PRIORITY_COLOR,
  PRIORITY_ORDER,
  QUALITY_COLOR,
  QUALITY_GROUPS,
  SPORTS,
  STRENGTH_PHASE_COLOR,
  STRENGTH_PHASE_ORDER,
  TEST_BY_ID,
  testsForSport,
} from "../data/catalog";
import { athleteTrainingWeeks, useStore } from "../data/store";
import { formatDate, formatMonth } from "../lib/format";
import { correlationStrength, linearRegression, mean, round } from "../lib/stats";
import type {
  Athlete,
  CompetitionPriority,
  PeriodizationPhase,
  StrengthPhase,
  TestResult,
  TrainingQuality,
} from "../types";

// ── Plan-generation defaults (page-local: only the builder needs a default
// strength phase / quality per macrocycle phase) ───────────────────────────────

const PHASE_DEFAULT_STRENGTH: Record<PeriodizationPhase, StrengthPhase> = {
  Preparation: "Accumulation",
  "Pre-Competition": "Intensification",
  Competition: "Realization",
  Transition: "Transition",
};

const PHASE_DEFAULT_QUALITY: Record<PeriodizationPhase, TrainingQuality> = {
  Preparation: "Max Strength",
  "Pre-Competition": "Power",
  Competition: "Speed",
  Transition: "Recovery",
};

// ── Page modes ────────────────────────────────────────────────────────────────

type Mode = "analyze" | "build";
type WeekView = "calendar" | "list";

// ── Page component ────────────────────────────────────────────────────────────

export default function Periodization() {
  const { athletes, testResults, trainingWeeks } = useStore();
  // Deep-link support: the Athlete Profile's Schedule tab links here with
  // ?athlete=<id>&mode=build so "edit" jumps straight to that athlete's plan.
  const [searchParams] = useSearchParams();
  const presetAthlete = athletes.find((a) => a.id === searchParams.get("athlete"));
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "build" ? "build" : "analyze",
  );
  const [sportId, setSportId] = useState(presetAthlete?.profiles[0]?.sportId ?? SPORTS[0].id);
  const sportAthletes = useMemo(
    () => athletes.filter((a) => a.profiles.some((p) => p.sportId === sportId)),
    [athletes, sportId],
  );
  const [athleteId, setAthleteId] = useState(presetAthlete?.id ?? sportAthletes[0]?.id ?? "");
  const athlete = sportAthletes.find((a) => a.id === athleteId) ?? sportAthletes[0];
  const [testId, setTestId] = useState("cmj");
  const testType = TEST_BY_ID[testId];

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
    return PHASE_ORDER.filter((p) => agg.has(p)).map((p) => {
      const a = agg.get(p)!;
      return {
        phase: p,
        weeks: a.n,
        avgPlanned: Math.round(a.planned / a.n),
        avgActual: Math.round(a.actual / a.n),
        adherence: a.planned ? round((a.actual / a.planned) * 100, 0) : 0,
      };
    });
  }, [athlete, trainingWeeks, sportId]);

  const loadVsGain = useMemo(() => {
    const pts: { x: number; y: number; name: string }[] = [];
    for (const a of sportAthletes) {
      const series = testResults
        .filter(
          (r: TestResult) =>
            r.athleteId === a.id && r.sportId === sportId && r.testTypeId === testId,
        )
        .sort((m, n) => m.date.localeCompare(n.date));
      if (series.length < 2) continue;
      const first = series[0].value;
      const last = series[series.length - 1].value;
      const gainPct =
        ((last - first) / first) * 100 * (testType?.higherIsBetter ? 1 : -1);
      const weeks = athleteTrainingWeeks(trainingWeeks, a.id, sportId);
      if (weeks.length === 0) continue;
      const avgLoad = weeks.reduce((s, w) => s + w.actualLoad, 0) / weeks.length;
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
        subtitle={
          mode === "analyze"
            ? "The training plan in context: weekly load through the macrocycle phases, and how that load tracks against test progress and squad-wide gains."
            : "Build a macrocycle: assign strength phases and training qualities per week, auto-shape a periodized load curve, then fine-tune and save."
        }
        actions={
          <div className="row" style={{ gap: 10 }}>
            <div className="seg">
              <button
                className={mode === "analyze" ? "active" : ""}
                onClick={() => setMode("analyze")}
              >
                Analyze
              </button>
              <button
                className={mode === "build" ? "active" : ""}
                onClick={() => setMode("build")}
              >
                Build plan
              </button>
            </div>
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

      {mode === "build" ? (
        <PlanBuilder key={`${athlete.id}-${sportId}`} athlete={athlete} sportId={sportId} />
      ) : (
        <>
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
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--chart-axis)" fontSize={11} tickLine={false} />
                <YAxis
                  yAxisId="load"
                  stroke="var(--chart-axis)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="test"
                  orientation="right"
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
                <Bar yAxisId="load" dataKey="load" radius={[3, 3, 0, 0]} fill="var(--chart-grid)" />
                <Line
                  yAxisId="test"
                  type="monotone"
                  dataKey="test"
                  stroke="var(--series-1)"
                  strokeWidth={2.5}
                  connectNulls
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="legend mt-8">
              <span className="item">
                <span className="dot" style={{ background: "var(--chart-grid)" }} /> Monthly load
              </span>
              <span className="item">
                <span className="dot" style={{ background: "var(--series-1)" }} /> {testType?.shortName}
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
                            <span
                              className="dot"
                              style={{ background: PHASE_COLOR[p.phase] }}
                            />
                            <span style={{ fontWeight: 600 }}>{p.phase}</span>
                          </span>
                        </td>
                        <td className="num">{p.weeks}</td>
                        <td className="num">{p.avgPlanned}</td>
                        <td className="num">{p.avgActual}</td>
                        <td
                          className="num"
                          style={{
                            color:
                              p.adherence >= 90 ? "var(--good)" : "var(--warn)",
                          }}
                        >
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
                <span style={{ fontSize: 22, fontWeight: 700 }}>
                  r = {round(loadVsGain.fit.r, 2)}
                </span>
                <span className="faint" style={{ fontSize: 12, marginLeft: 8 }}>
                  {correlationStrength(loadVsGain.fit.r)}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <ScatterChart margin={{ left: -10, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid stroke="var(--chart-grid)" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Avg load"
                    stroke="var(--chart-axis)"
                    fontSize={10}
                    domain={["auto", "auto"]}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Gain %"
                    stroke="var(--chart-axis)"
                    fontSize={10}
                    domain={["auto", "auto"]}
                  />
                  <ZAxis range={[50, 50]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "var(--tooltip-bg)",
                      border: "1px solid var(--tooltip-border)",
                      borderRadius: 8,
                      color: "var(--tooltip-text)",
                    }}
                    formatter={(v: number) => round(v, 1)}
                  />
                  <Scatter
                    data={loadVsGain.line}
                    line={{ stroke: "#f97316", strokeWidth: 2 }}
                    shape={() => <g />}
                  />
                  <Scatter data={loadVsGain.pts} fill="#22c55e" />
                </ScatterChart>
              </ResponsiveContainer>
              <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>
                Each point is an athlete: mean weekly load vs % change in{" "}
                {testType?.shortName}.
              </p>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

// ── Plan builder ──────────────────────────────────────────────────────────────

type DraftWeek = {
  weekStart: string;
  phase: PeriodizationPhase;
  plannedLoad: number;
  strengthPhase: StrengthPhase;
  primaryQuality: TrainingQuality;
  secondaryQualities: TrainingQuality[];
};

type DraftComp = {
  key: string;
  date: string;
  name: string;
  priority: CompetitionPriority;
};

interface PlanSettings {
  startDate: string;
  lengths: Record<PeriodizationPhase, number>;
  peakLoad: number;
  deload: boolean;
  phaseQualities: Record<PeriodizationPhase, TrainingQuality>;
}

const PHASE_SHAPE: Record<PeriodizationPhase, [number, number]> = {
  Preparation: [0.75, 1.0],
  "Pre-Competition": [0.95, 0.82],
  Competition: [0.7, 0.62],
  Transition: [0.38, 0.34],
};

function mondayOnOrAfter(d: Date): string {
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  u.setUTCDate(u.getUTCDate() + ((8 - u.getUTCDay()) % 7));
  return u.toISOString().slice(0, 10);
}

function isoWeek(start: string, i: number): string {
  const d = new Date(start + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + i * 7);
  return d.toISOString().slice(0, 10);
}

function isoDayOffset(start: string, days: number): string {
  const d = new Date(start + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Competitions whose date falls inside the 7-day week beginning at weekStart. */
function compsInWeek(comps: DraftComp[], weekStart: string): DraftComp[] {
  const end = isoDayOffset(weekStart, 6);
  return comps.filter((c) => c.date && c.date >= weekStart && c.date <= end);
}

function generatePlan(s: PlanSettings): DraftWeek[] {
  const weeks: DraftWeek[] = [];
  let idx = 0;
  for (const phase of PHASE_ORDER) {
    const n = Math.max(0, Math.round(s.lengths[phase]));
    const [a, b] = PHASE_SHAPE[phase];
    for (let k = 0; k < n; k++) {
      const t = n <= 1 ? 0 : k / (n - 1);
      let frac = a + (b - a) * t;
      const isDeload =
        s.deload &&
        (idx + 1) % 4 === 0 &&
        (phase === "Preparation" || phase === "Pre-Competition");
      if (isDeload) frac *= 0.82;
      weeks.push({
        weekStart: isoWeek(s.startDate, idx),
        phase,
        plannedLoad: Math.max(0, Math.round(s.peakLoad * frac)),
        strengthPhase: isDeload ? "Deload" : PHASE_DEFAULT_STRENGTH[phase],
        primaryQuality: s.phaseQualities[phase],
        secondaryQualities: [],
      });
      idx++;
    }
  }
  return weeks;
}

const DEFAULT_SETTINGS: PlanSettings = {
  startDate: mondayOnOrAfter(new Date()),
  lengths: { Preparation: 8, "Pre-Competition": 4, Competition: 4, Transition: 2 },
  peakLoad: 650,
  deload: true,
  phaseQualities: { ...PHASE_DEFAULT_QUALITY },
};

function QualitySelect({
  value,
  onChange,
  style,
}: {
  value: TrainingQuality;
  onChange: (q: TrainingQuality) => void;
  style?: React.CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TrainingQuality)}
      style={{ fontSize: 11, padding: "3px 6px", ...style }}
    >
      {QUALITY_GROUPS.map(({ label, qualities }) => (
        <optgroup key={label} label={label}>
          {qualities.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function PlanBuilder({ athlete, sportId }: { athlete: Athlete; sportId: string }) {
  const { saveTrainingPlan, savePlannedCompetitions, plannedCompetitions } = useStore();
  const [settings, setSettings] = useState<PlanSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<DraftWeek[]>(() => generatePlan(DEFAULT_SETTINGS));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [weekView, setWeekView] = useState<WeekView>("calendar");
  // Seed from any previously saved schedule for this athlete+sport (component is
  // keyed by both, so this initializer re-runs on switch).
  const [comps, setComps] = useState<DraftComp[]>(() =>
    plannedCompetitions
      .filter((c) => c.athleteId === athlete.id && c.sportId === sportId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((c) => ({ key: c.id, date: c.date, name: c.name, priority: c.priority })),
  );

  const peakInDraft = draft.reduce((m, w) => Math.max(m, w.plannedLoad), 1);

  const regenerate = (next: PlanSettings) => {
    setSettings(next);
    setDraft(generatePlan(next));
    setSavedAt(null);
  };
  const setLength = (phase: PeriodizationPhase, raw: string) => {
    const v = Math.max(0, Math.min(52, Math.round(Number(raw) || 0)));
    regenerate({ ...settings, lengths: { ...settings.lengths, [phase]: v } });
  };
  const editWeek = (i: number, patch: Partial<DraftWeek>) => {
    setDraft((d) => d.map((w, j) => (j === i ? { ...w, ...patch } : w)));
    setSavedAt(null);
  };
  const addComp = () => {
    // Default a new competition to the start of the Competition phase.
    const defaultDate =
      draft.find((w) => w.phase === "Competition")?.weekStart ?? settings.startDate;
    setComps((c) => [
      ...c,
      { key: `dc-${Date.now()}-${c.length}`, date: defaultDate, name: "", priority: "A" },
    ]);
    setSavedAt(null);
  };
  const editComp = (key: string, patch: Partial<DraftComp>) => {
    setComps((c) => c.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    setSavedAt(null);
  };
  const removeComp = (key: string) => {
    setComps((c) => c.filter((x) => x.key !== key));
    setSavedAt(null);
  };
  const toggleSecondary = (i: number, q: TrainingQuality) => {
    setDraft((d) =>
      d.map((w, j) => {
        if (j !== i) return w;
        const secs = w.secondaryQualities.includes(q)
          ? w.secondaryQualities.filter((x) => x !== q)
          : [...w.secondaryQualities, q];
        return { ...w, secondaryQualities: secs };
      }),
    );
    setSavedAt(null);
  };

  const summary = useMemo(() => {
    const byPhase = PHASE_ORDER.map((p) => {
      const ws = draft.filter((w) => w.phase === p);
      return {
        phase: p,
        weeks: ws.length,
        avg: ws.length ? Math.round(mean(ws.map((w) => w.plannedLoad))) : 0,
      };
    });
    const range =
      draft.length > 0
        ? `${formatDate(draft[0].weekStart)} → ${formatDate(draft[draft.length - 1].weekStart)}`
        : "—";
    return { byPhase, range, total: draft.length };
  }, [draft]);

  const preview = draft.map((w, i) => ({
    label: `W${i + 1}`,
    week: formatDate(w.weekStart),
    load: w.plannedLoad,
    phase: w.phase,
  }));

  // Competitions positioned on the plan's week axis for the chart overlay.
  const compMarkers = useMemo(
    () =>
      comps
        .filter((c) => c.date)
        .map((c) => ({
          ...c,
          idx: draft.findIndex(
            (w) => c.date >= w.weekStart && c.date <= isoDayOffset(w.weekStart, 6),
          ),
        }))
        .filter((c) => c.idx >= 0),
    [comps, draft],
  );

  const saveDraft = () => {
    saveTrainingPlan(athlete.id, sportId, draft);
    savePlannedCompetitions(
      athlete.id,
      sportId,
      comps
        .filter((c) => c.date)
        .map((c) => ({ date: c.date, name: c.name.trim() || "Competition", priority: c.priority })),
    );
    setSavedAt(
      new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    );
  };

  return (
    <div className="grid cols-3" style={{ alignItems: "start" }}>
      {/* ── Setup card ── */}
      <Card
        title="Plan setup"
        sub="Guided generator — set the shape and focus, then fine-tune per week"
      >
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Start (week of)</label>
          <input
            type="date"
            value={settings.startDate}
            onChange={(e) => regenerate({ ...settings, startDate: e.target.value })}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="faint" style={{ fontSize: 12, fontWeight: 600 }}>
            Phase lengths (weeks)
          </label>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            {PHASE_ORDER.map((p) => (
              <div className="row between" key={p}>
                <span className="row" style={{ gap: 8 }}>
                  <span className="dot" style={{ background: PHASE_COLOR[p] }} />
                  <span style={{ fontSize: 13 }}>{p}</span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={52}
                  value={settings.lengths[p]}
                  onChange={(e) => setLength(p, e.target.value)}
                  style={{ width: 64, textAlign: "right" }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="faint" style={{ fontSize: 12, fontWeight: 600 }}>
            Primary focus per phase
          </label>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7 }}>
            {PHASE_ORDER.map((p) => (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="row" style={{ gap: 6, flex: "0 0 auto", width: 115 }}>
                  <span className="dot" style={{ background: PHASE_COLOR[p] }} />
                  <span style={{ fontSize: 12 }}>{p === "Pre-Competition" ? "Pre-Comp" : p}</span>
                </span>
                <QualitySelect
                  value={settings.phaseQualities[p]}
                  onChange={(q) =>
                    regenerate({
                      ...settings,
                      phaseQualities: { ...settings.phaseQualities, [p]: q },
                    })
                  }
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label>Peak weekly load</label>
          <input
            type="number"
            min={0}
            value={settings.peakLoad}
            onChange={(e) =>
              regenerate({
                ...settings,
                peakLoad: Math.max(0, Math.round(Number(e.target.value) || 0)),
              })
            }
            style={{ width: "100%" }}
          />
        </div>

        <label
          className="row"
          style={{ gap: 8, marginBottom: 14, cursor: "pointer", fontSize: 13 }}
        >
          <input
            type="checkbox"
            checked={settings.deload}
            onChange={(e) => regenerate({ ...settings, deload: e.target.checked })}
          />
          Deload every 4th build week
        </label>

        <button className="btn" style={{ width: "100%" }} onClick={() => regenerate(settings)}>
          Regenerate curve
        </button>

        <div
          style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}
        >
          <div className="row between" style={{ marginBottom: 8 }}>
            <label className="faint" style={{ fontSize: 12, fontWeight: 600 }}>
              Competitions
            </label>
            <button
              className="btn"
              style={{ fontSize: 11, padding: "3px 10px" }}
              onClick={addComp}
            >
              + Add
            </button>
          </div>
          {comps.length === 0 ? (
            <p className="faint" style={{ fontSize: 11.5, margin: 0 }}>
              No competitions scheduled. Add key dates to see them on the plan.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {comps.map((c) => {
                const inPlan =
                  !c.date ||
                  draft.some(
                    (w) => c.date >= w.weekStart && c.date <= isoDayOffset(w.weekStart, 6),
                  );
                return (
                  <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      <span
                        className="dot"
                        style={{ background: PRIORITY_COLOR[c.priority], flex: "0 0 auto" }}
                      />
                      <input
                        type="text"
                        placeholder="Competition name"
                        value={c.name}
                        onChange={(e) => editComp(c.key, { name: e.target.value })}
                        style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "4px 8px" }}
                      />
                      <select
                        value={c.priority}
                        onChange={(e) =>
                          editComp(c.key, { priority: e.target.value as CompetitionPriority })
                        }
                        title="Priority: A = key comp, B = important, C = training"
                        style={{ fontSize: 12, padding: "4px 6px" }}
                      >
                        {PRIORITY_ORDER.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeComp(c.key)}
                        title="Remove"
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text-faint)",
                          cursor: "pointer",
                          fontSize: 14,
                          padding: "0 2px",
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", paddingLeft: 13 }}>
                      <input
                        type="date"
                        value={c.date}
                        onChange={(e) => editComp(c.key, { date: e.target.value })}
                        style={{ flex: 1, fontSize: 12, padding: "4px 8px" }}
                      />
                      {!inPlan && (
                        <span
                          title="This date falls outside the planned weeks"
                          style={{ fontSize: 11, color: "var(--warn, #fbbf24)" }}
                        >
                          outside plan
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}
        >
          <div className="row between" style={{ fontSize: 12.5 }}>
            <span className="faint">Total</span>
            <span style={{ fontWeight: 600 }}>{summary.total} weeks</span>
          </div>
          <div className="row between" style={{ fontSize: 11.5, marginTop: 4 }}>
            <span className="faint">Range</span>
            <span>{summary.range}</span>
          </div>
          {summary.byPhase
            .filter((b) => b.weeks > 0)
            .map((b) => (
              <div
                className="row between"
                key={b.phase}
                style={{ fontSize: 12.5, marginTop: 6 }}
              >
                <span className="row" style={{ gap: 8 }}>
                  <span className="dot" style={{ background: PHASE_COLOR[b.phase] }} />
                  {b.phase}
                </span>
                <span className="faint">
                  {b.weeks} wk · avg {b.avg}
                </span>
              </div>
            ))}
        </div>
      </Card>

      {/* ── Right column ── */}
      <div style={{ gridColumn: "span 2" }}>
        <Card
          title="Planned load curve"
          sub={`Macrocycle for ${athlete.name} — bars coloured by phase`}
          actions={
            <button className="btn" disabled={draft.length === 0} onClick={saveDraft}>
              Save plan
            </button>
          }
        >
          {draft.length === 0 ? (
            <div className="empty">Set phase lengths above to generate a plan.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={preview} margin={{ left: -12, right: 4, top: 20 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--chart-axis)"
                    fontSize={10}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--tooltip-bg)",
                      border: "1px solid var(--tooltip-border)",
                      borderRadius: 8,
                      color: "var(--tooltip-text)",
                    }}
                    formatter={(v: number) => [v, "Load"]}
                    labelFormatter={(l: string, p: any[]) => {
                      const row = p?.[0]?.payload as
                        | { week: string; phase: string }
                        | undefined;
                      return row ? `${l} · ${row.week} · ${row.phase}` : l;
                    }}
                  />
                  <Bar dataKey="load" radius={[3, 3, 0, 0]}>
                    {preview.map((row, i) => (
                      <Cell key={i} fill={PHASE_COLOR[row.phase]} />
                    ))}
                  </Bar>
                  {compMarkers.map((c) => (
                    <ReferenceLine
                      key={c.key}
                      x={`W${c.idx + 1}`}
                      stroke={PRIORITY_COLOR[c.priority]}
                      strokeDasharray="4 3"
                      label={{
                        value: c.name.trim() || "Comp",
                        position: "top",
                        fill: PRIORITY_COLOR[c.priority],
                        fontSize: 10,
                      }}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
              <div className="legend mt-8">
                {PHASE_ORDER.map((p) => (
                  <span className="item" key={p}>
                    <span className="dot" style={{ background: PHASE_COLOR[p] }} />
                    {p}
                  </span>
                ))}
                {compMarkers.length > 0 &&
                  PRIORITY_ORDER.filter((p) => compMarkers.some((c) => c.priority === p)).map(
                    (p) => (
                      <span className="item" key={p}>
                        <span className="dot" style={{ background: PRIORITY_COLOR[p] }} />
                        {p}-comp
                      </span>
                    ),
                  )}
              </div>
              {savedAt && (
                <div className="row" style={{ marginTop: 10, gap: 10 }}>
                  <span className="pill accent">Saved at {savedAt}</span>
                  <span className="faint" style={{ fontSize: 12 }}>
                    Plan and competition schedule written to {athlete.name}. Switch to
                    Analyze to see it against test progress.
                  </span>
                </div>
              )}
            </>
          )}
        </Card>

        {draft.length > 0 && (
          <div className="mt-16">
            <Card
              title="Weekly plan"
              sub={
                weekView === "calendar"
                  ? "Click ▼ edit on any card to set strength phase, primary and secondary qualities, and load"
                  : "Fine-tune phase, strength focus, quality, and load per week"
              }
              actions={
                <div className="seg">
                  <button
                    className={weekView === "calendar" ? "active" : ""}
                    onClick={() => setWeekView("calendar")}
                  >
                    Calendar
                  </button>
                  <button
                    className={weekView === "list" ? "active" : ""}
                    onClick={() => setWeekView("list")}
                  >
                    List
                  </button>
                </div>
              }
            >
              {weekView === "calendar" ? (
                <CalendarView
                  draft={draft}
                  comps={comps}
                  peakLoad={peakInDraft}
                  onEditWeek={editWeek}
                  onToggleSecondary={toggleSecondary}
                />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>Wk</th>
                        <th>Start</th>
                        <th>Phase</th>
                        <th>Strength</th>
                        <th>Quality</th>
                        <th className="num">Load</th>
                        <th style={{ width: 140 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.map((w, i) => (
                        <tr key={w.weekStart}>
                          <td
                            style={{
                              fontWeight: 700,
                              color: "var(--text-faint)",
                              fontSize: 12,
                            }}
                          >
                            {i + 1}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {formatDate(w.weekStart)}
                            {compsInWeek(comps, w.weekStart).map((c) => (
                              <span
                                key={c.key}
                                title={`${c.name.trim() || "Competition"} · ${c.priority} · ${formatDate(c.date)}`}
                                style={{ marginLeft: 6, cursor: "default" }}
                              >
                                🏆
                              </span>
                            ))}
                          </td>
                          <td>
                            <select
                              value={w.phase}
                              onChange={(e) =>
                                editWeek(i, { phase: e.target.value as PeriodizationPhase })
                              }
                              style={{ padding: "3px 6px", fontSize: 11 }}
                            >
                              {PHASE_ORDER.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              value={w.strengthPhase}
                              onChange={(e) =>
                                editWeek(i, {
                                  strengthPhase: e.target.value as StrengthPhase,
                                })
                              }
                              style={{ padding: "3px 6px", fontSize: 11 }}
                            >
                              {STRENGTH_PHASE_ORDER.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <QualitySelect
                              value={w.primaryQuality}
                              onChange={(q) => editWeek(i, { primaryQuality: q })}
                            />
                          </td>
                          <td className="num">
                            <input
                              type="number"
                              min={0}
                              value={w.plannedLoad}
                              onChange={(e) =>
                                editWeek(i, {
                                  plannedLoad: Math.max(
                                    0,
                                    Math.round(Number(e.target.value) || 0),
                                  ),
                                })
                              }
                              style={{ width: 72, textAlign: "right" }}
                            />
                          </td>
                          <td>
                            <LoadBar
                              value={w.plannedLoad}
                              max={peakInDraft}
                              color={PHASE_COLOR[w.phase]}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar view ─────────────────────────────────────────────────────────────

function CalendarView({
  draft,
  comps,
  peakLoad,
  onEditWeek,
  onToggleSecondary,
}: {
  draft: DraftWeek[];
  comps: DraftComp[];
  peakLoad: number;
  onEditWeek: (i: number, patch: Partial<DraftWeek>) => void;
  onToggleSecondary: (i: number, q: TrainingQuality) => void;
}) {
  const months = useMemo(() => {
    const map = new Map<
      string,
      { key: string; entries: { week: DraftWeek; idx: number }[] }
    >();
    draft.forEach((week, idx) => {
      const key = week.weekStart.slice(0, 7);
      if (!map.has(key)) map.set(key, { key, entries: [] });
      map.get(key)!.entries.push({ week, idx });
    });
    return [...map.values()];
  }, [draft]);

  if (months.length === 0)
    return <div className="empty">Set phase lengths above to generate a plan.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {months.map(({ key, entries }) => (
        <div key={key}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-faint)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            {new Date(key + "-02").toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: 8,
            }}
          >
            {entries.map(({ week, idx }) => (
              <WeekCard
                key={week.weekStart}
                week={week}
                weekComps={compsInWeek(comps, week.weekStart)}
                weekNum={idx + 1}
                peakLoad={peakLoad}
                onEdit={(patch) => onEditWeek(idx, patch)}
                onToggleSecondary={(q) => onToggleSecondary(idx, q)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Week card (calendar cell) ─────────────────────────────────────────────────

function WeekCard({
  week,
  weekComps,
  weekNum,
  peakLoad,
  onEdit,
  onToggleSecondary,
}: {
  week: DraftWeek;
  weekComps: DraftComp[];
  weekNum: number;
  peakLoad: number;
  onEdit: (patch: Partial<DraftWeek>) => void;
  onToggleSecondary: (q: TrainingQuality) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        borderLeft: `4px solid ${PHASE_COLOR[week.phase]}`,
        borderTop: "1px solid var(--border)",
        borderRight: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 12px",
        background: "rgba(15,23,42,0.6)",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <div className="row between" style={{ marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)" }}>
          W{weekNum}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
          {formatDate(week.weekStart)}
        </span>
      </div>

      {weekComps.map((c) => (
        <div
          key={c.key}
          title={`${c.priority}-priority competition · ${formatDate(c.date)}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10.5,
            fontWeight: 700,
            color: PRIORITY_COLOR[c.priority],
            background: PRIORITY_COLOR[c.priority] + "18",
            border: `1px solid ${PRIORITY_COLOR[c.priority]}44`,
            borderRadius: 6,
            padding: "3px 7px",
          }}
        >
          <span>🏆</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.name.trim() || "Competition"}
          </span>
          <span style={{ marginLeft: "auto", opacity: 0.8 }}>{c.priority}</span>
        </div>
      ))}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        <span
          className="pill"
          style={{
            fontSize: 10,
            background: STRENGTH_PHASE_COLOR[week.strengthPhase] + "22",
            color: STRENGTH_PHASE_COLOR[week.strengthPhase],
          }}
        >
          {week.strengthPhase}
        </span>
        <span
          className="pill"
          style={{
            fontSize: 10,
            background: QUALITY_COLOR[week.primaryQuality] + "22",
            color: QUALITY_COLOR[week.primaryQuality],
          }}
        >
          {week.primaryQuality}
        </span>
      </div>

      {week.secondaryQualities.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {week.secondaryQualities.map((q) => (
            <span
              key={q}
              className="pill"
              style={{
                fontSize: 9,
                background: QUALITY_COLOR[q] + "15",
                color: QUALITY_COLOR[q],
                opacity: 0.85,
              }}
            >
              {q}
            </span>
          ))}
        </div>
      )}

      <div className="row between" style={{ fontSize: 12, marginTop: 2 }}>
        <span className="faint">Load</span>
        <span style={{ fontWeight: 700 }}>{week.plannedLoad}</span>
      </div>
      <LoadBar value={week.plannedLoad} max={Math.max(1, peakLoad)} color={PHASE_COLOR[week.phase]} />

      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-faint)",
          fontSize: 10,
          cursor: "pointer",
          padding: "2px 0",
          textAlign: "center",
        }}
      >
        {expanded ? "▲ collapse" : "▼ edit"}
      </button>

      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          <select
            value={week.phase}
            onChange={(e) => onEdit({ phase: e.target.value as PeriodizationPhase })}
            style={{ fontSize: 11 }}
          >
            {PHASE_ORDER.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={week.strengthPhase}
            onChange={(e) => onEdit({ strengthPhase: e.target.value as StrengthPhase })}
            style={{ fontSize: 11 }}
          >
            {STRENGTH_PHASE_ORDER.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <QualitySelect
            value={week.primaryQuality}
            onChange={(q) => onEdit({ primaryQuality: q })}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label
              style={{ fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap" }}
            >
              Load
            </label>
            <input
              type="number"
              min={0}
              value={week.plannedLoad}
              onChange={(e) =>
                onEdit({
                  plannedLoad: Math.max(0, Math.round(Number(e.target.value) || 0)),
                })
              }
              style={{ fontSize: 11, width: "100%" }}
            />
          </div>

          <div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 4 }}>
              + Secondary qualities
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {ALL_QUALITIES.filter((q) => q !== week.primaryQuality).map((q) => {
                const on = week.secondaryQualities.includes(q);
                return (
                  <button
                    key={q}
                    onClick={() => onToggleSecondary(q)}
                    style={{
                      fontSize: 9,
                      padding: "2px 5px",
                      borderRadius: 4,
                      border: `1px solid ${on ? QUALITY_COLOR[q] : "var(--border)"}`,
                      background: on ? QUALITY_COLOR[q] + "22" : "transparent",
                      color: on ? QUALITY_COLOR[q] : "var(--text-faint)",
                      cursor: "pointer",
                    }}
                  >
                    {q}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
