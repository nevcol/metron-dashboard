import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHead } from "../components/Layout";
import { Avatar, Bar, Card } from "../components/ui";
import {
  CATEGORY_COLORS,
  PHASE_COLOR,
  PHASE_ORDER,
  PRIORITY_COLOR,
  QUALITY_COLOR,
  SPORT_BY_ID,
  STRENGTH_PHASE_COLOR,
  TEST_BY_ID,
  testsForSport,
} from "../data/catalog";
import { athleteTrainingWeeks, latestTests, useStore } from "../data/store";
import {
  ageBand,
  ageOn,
  formatDate,
  formatMonth,
  genderLabel,
  yearsBetween,
} from "../lib/format";
import { percentileRank, round } from "../lib/stats";
import type {
  Athlete,
  CompetitionResult,
  PeriodizationPhase,
  PlannedCompetition,
  TestResult,
  TestType,
  TrainingWeek,
} from "../types";

type ProfileTab = "overview" | "schedule" | "calendar" | "testing";

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "schedule", label: "Schedule" },
  { id: "calendar", label: "Calendar" },
  { id: "testing", label: "Testing" },
];

export default function AthleteProfile() {
  const { id } = useParams();
  const {
    athletes,
    testResults,
    competitionResults,
    trainingWeeks,
    plannedCompetitions,
  } = useStore();
  const athlete = athletes.find((a) => a.id === id);
  const [sportId, setSportId] = useState(athlete?.profiles[0]?.sportId ?? "");
  const [tab, setTab] = useState<ProfileTab>("overview");

  const age = athlete ? ageOn(athlete.birthDate) : 0;

  // Peer pool: same gender + same five-year age band + same sport.
  const peerPool = useMemo(() => {
    if (!athlete) return { peers: [] as Athlete[], pool: new Map<string, number[]>() };
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
    return { peers, pool };
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
  const weeks = athleteTrainingWeeks(trainingWeeks, athlete.id, sportId);
  const comps = competitionResults
    .filter((c) => c.athleteId === athlete.id && c.sportId === sportId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const scheduled = plannedCompetitions
    .filter((c) => c.athleteId === athlete.id && c.sportId === sportId)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <PageHead
        title={athlete.name}
        subtitle={`${genderLabel(athlete.gender)} · ${age} yrs · ${athlete.heightCm} cm · ${athlete.massKg} kg`}
        actions={
          <div className="row" style={{ gap: 10 }}>
            <div className="seg">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={tab === t.id ? "active" : ""}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {athlete.profiles.length > 1 && (
              <select value={sportId} onChange={(e) => setSportId(e.target.value)}>
                {athlete.profiles.map((p) => (
                  <option key={p.sportId} value={p.sportId}>
                    {SPORT_BY_ID[p.sportId]?.name}
                  </option>
                ))}
              </select>
            )}
          </div>
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

      {tab === "overview" && (
        <OverviewTab athlete={athlete} sportId={sportId} weeks={weeks} comps={comps} tests={tests} allTestResults={testResults} />
      )}
      {tab === "schedule" && (
        <ScheduleTab key={`${athlete.id}-${sportId}`} athlete={athlete} weeks={weeks} scheduled={scheduled} />
      )}
      {tab === "calendar" && (
        <CalendarTab
          key={`${athlete.id}-${sportId}`}
          athleteId={athlete.id}
          sportId={sportId}
          weeks={weeks}
          testResults={testResults}
          competitionResults={competitionResults}
          plannedCompetitions={plannedCompetitions}
        />
      )}
      {tab === "testing" && (
        <TestingTab
          athlete={athlete}
          age={age}
          sport={sport?.name ?? ""}
          tests={tests}
          own={own}
          peerPool={peerPool}
        />
      )}
    </>
  );
}

// ── Overview tab: historical data ───────────────────────────────────────────────

function OverviewTab({
  athlete,
  sportId,
  weeks,
  comps,
  tests,
  allTestResults,
}: {
  athlete: Athlete;
  sportId: string;
  weeks: TrainingWeek[];
  comps: CompetitionResult[];
  tests: TestType[];
  allTestResults: TestResult[];
}) {
  const [focusTest, setFocusTest] = useState("cmj");
  const progression = allTestResults
    .filter(
      (r) =>
        r.athleteId === athlete.id && r.sportId === sportId && r.testTypeId === focusTest,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ month: formatMonth(r.date), value: r.value }));

  const loadSeries = weeks.slice(-26).map((w) => ({
    week: w.weekStart.slice(5),
    actual: w.actualLoad,
    planned: w.plannedLoad,
  }));

  const focusType = TEST_BY_ID[focusTest];
  const sport = SPORT_BY_ID[sportId];

  return (
    <>
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

// ── Schedule tab: periodization phases + upcoming competitions ─────────────────

function ScheduleTab({
  athlete,
  weeks,
  scheduled,
}: {
  athlete: Athlete;
  weeks: TrainingWeek[];
  scheduled: PlannedCompetition[];
}) {
  const phaseSummary = useMemo(() => {
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
  }, [weeks]);

  const range =
    weeks.length > 0
      ? `${formatDate(weeks[0].weekStart)} → ${formatDate(weeks[weeks.length - 1].weekStart)}`
      : null;

  if (weeks.length === 0 && scheduled.length === 0) {
    return (
      <div className="card empty mt-16">
        No periodization plan yet for {athlete.name}.{" "}
        <Link to={`/periodization?athlete=${athlete.id}&mode=build`}>
          Build one in the Periodization tool →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid cols-3 mt-16">
      <div style={{ gridColumn: "span 2" }}>
        <Card
          title="Periodization phases"
          sub={range ? `Macrocycle structure · ${range}` : "Macrocycle structure"}
          actions={
            <Link to={`/periodization?athlete=${athlete.id}&mode=build`} className="btn ghost">
              Edit plan →
            </Link>
          }
        >
          {phaseSummary.length === 0 ? (
            <div className="empty">No training weeks logged yet.</div>
          ) : (
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
                    <td
                      className="num"
                      style={{ color: p.adherence >= 90 ? "var(--good)" : "var(--warn)" }}
                    >
                      {p.adherence}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Scheduled competitions" sub="Upcoming and recently logged plan dates">
        {scheduled.length === 0 ? (
          <p className="faint" style={{ fontSize: 12.5 }}>
            No competitions scheduled on the plan yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {scheduled.map((c) => (
              <div
                key={c.id}
                className="row between"
                style={{
                  fontSize: 12.5,
                  padding: "6px 8px",
                  borderRadius: 8,
                  background: PRIORITY_COLOR[c.priority] + "12",
                  border: `1px solid ${PRIORITY_COLOR[c.priority]}33`,
                }}
              >
                <span className="row" style={{ gap: 7 }}>
                  <span className="dot" style={{ background: PRIORITY_COLOR[c.priority] }} />
                  {c.name}
                </span>
                <span className="faint">{formatDate(c.date)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Calendar tab: unified planning + testing + competitions view ───────────────

const WINDOW_WEEKS = 12;

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

interface CalEntry {
  weekStart: string;
  trainingWeek?: TrainingWeek;
  tests: TestResult[];
  pastComps: CompetitionResult[];
  futureComps: PlannedCompetition[];
}

function CalendarTab({
  athleteId,
  sportId,
  weeks,
  testResults,
  competitionResults,
  plannedCompetitions,
}: {
  athleteId: string;
  sportId: string;
  weeks: TrainingWeek[];
  testResults: TestResult[];
  competitionResults: CompetitionResult[];
  plannedCompetitions: PlannedCompetition[];
}) {
  const athleteTests = useMemo(
    () => testResults.filter((r) => r.athleteId === athleteId && r.sportId === sportId),
    [testResults, athleteId, sportId],
  );
  const pastComps = useMemo(
    () => competitionResults.filter((c) => c.athleteId === athleteId && c.sportId === sportId),
    [competitionResults, athleteId, sportId],
  );
  const futureComps = useMemo(
    () => plannedCompetitions.filter((c) => c.athleteId === athleteId && c.sportId === sportId),
    [plannedCompetitions, athleteId, sportId],
  );

  const latestKnownDate = useMemo(() => {
    const all = [
      ...weeks.map((w) => w.weekStart),
      ...athleteTests.map((r) => r.date),
      ...pastComps.map((c) => c.date),
    ];
    if (all.length === 0) return new Date().toISOString().slice(0, 10);
    const sorted = [...all].sort();
    return sorted[sorted.length - 1];
  }, [weeks, athleteTests, pastComps]);

  const [anchor, setAnchor] = useState(() => addDays(mondayOf(latestKnownDate), -28));

  const calWeeks = useMemo(() => {
    const list: CalEntry[] = [];
    for (let i = 0; i < WINDOW_WEEKS; i++) {
      const ws = addDays(anchor, i * 7);
      const we = addDays(ws, 6);
      list.push({
        weekStart: ws,
        trainingWeek: weeks.find((w) => w.weekStart === ws),
        tests: athleteTests.filter((r) => r.date >= ws && r.date <= we),
        pastComps: pastComps.filter((c) => c.date >= ws && c.date <= we),
        futureComps: futureComps.filter((c) => c.date >= ws && c.date <= we),
      });
    }
    return list;
  }, [anchor, weeks, athleteTests, pastComps, futureComps]);

  const months = useMemo(() => {
    const map = new Map<string, CalEntry[]>();
    for (const e of calWeeks) {
      const key = e.weekStart.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [calWeeks]);

  const windowEnd = addDays(anchor, WINDOW_WEEKS * 7 - 1);

  return (
    <Card
      title="Planning, testing & competitions"
      sub="One calendar for the training plan, logged tests, and competitions — past and scheduled."
      actions={
        <div className="row" style={{ gap: 10 }}>
          <button className="btn ghost" onClick={() => setAnchor((a) => addDays(a, -WINDOW_WEEKS * 7))}>
            ← Earlier
          </button>
          <span className="faint" style={{ fontSize: 12 }}>
            {formatDate(anchor)} – {formatDate(windowEnd)}
          </span>
          <button className="btn ghost" onClick={() => setAnchor((a) => addDays(a, WINDOW_WEEKS * 7))}>
            Later →
          </button>
        </div>
      }
    >
      <div className="mt-16" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {months.map(([key, entries]) => (
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
              {new Date(key + "-02").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                gap: 8,
              }}
            >
              {entries.map((entry) => (
                <CalWeekCard key={entry.weekStart} entry={entry} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="legend mt-16">
        {PHASE_ORDER.map((p) => (
          <span className="item" key={p}>
            <span className="dot" style={{ background: PHASE_COLOR[p] }} /> {p}
          </span>
        ))}
        <span className="item">🏆 Scheduled competition</span>
        <span className="item">🏅 Logged result</span>
        <span className="item">🧪 Test logged</span>
      </div>
    </Card>
  );
}

function CalWeekCard({ entry }: { entry: CalEntry }) {
  const { trainingWeek, tests, pastComps, futureComps } = entry;
  const hasData = trainingWeek || tests.length > 0 || pastComps.length > 0 || futureComps.length > 0;

  return (
    <div
      style={{
        borderLeft: `4px solid ${trainingWeek ? PHASE_COLOR[trainingWeek.phase] : "var(--border)"}`,
        borderTop: "1px solid var(--border)",
        borderRight: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 12px",
        opacity: hasData ? 1 : 0.55,
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{formatDate(entry.weekStart)}</span>

      {trainingWeek && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          <span
            className="pill"
            style={{ fontSize: 10, background: PHASE_COLOR[trainingWeek.phase] + "22", color: PHASE_COLOR[trainingWeek.phase] }}
          >
            {trainingWeek.phase}
          </span>
          {trainingWeek.strengthPhase && (
            <span
              className="pill"
              style={{
                fontSize: 10,
                background: STRENGTH_PHASE_COLOR[trainingWeek.strengthPhase] + "22",
                color: STRENGTH_PHASE_COLOR[trainingWeek.strengthPhase],
              }}
            >
              {trainingWeek.strengthPhase}
            </span>
          )}
          {trainingWeek.primaryQuality && (
            <span
              className="pill"
              style={{
                fontSize: 10,
                background: QUALITY_COLOR[trainingWeek.primaryQuality] + "22",
                color: QUALITY_COLOR[trainingWeek.primaryQuality],
              }}
            >
              {trainingWeek.primaryQuality}
            </span>
          )}
        </div>
      )}

      {trainingWeek && (
        <div className="row between" style={{ fontSize: 11.5 }}>
          <span className="faint">Load</span>
          <span style={{ fontWeight: 700 }}>
            {trainingWeek.actualLoad}
            <span className="faint" style={{ fontWeight: 400 }}> / {trainingWeek.plannedLoad}</span>
          </span>
        </div>
      )}

      {tests.map((t) => {
        const type = TEST_BY_ID[t.testTypeId];
        return (
          <div key={t.id} style={{ fontSize: 10.5, color: "var(--text-dim)" }}>
            🧪 {type?.shortName ?? t.testTypeId}: {t.value} {type?.unit}
          </div>
        );
      })}

      {pastComps.map((c) => (
        <div
          key={c.id}
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: "var(--text)",
            background: "var(--panel-2)",
            borderRadius: 6,
            padding: "3px 7px",
          }}
        >
          🏅 {c.competition} · #{c.placing}
        </div>
      ))}

      {futureComps.map((c) => (
        <div
          key={c.id}
          title={`${c.priority}-priority`}
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: PRIORITY_COLOR[c.priority],
            background: PRIORITY_COLOR[c.priority] + "18",
            border: `1px solid ${PRIORITY_COLOR[c.priority]}44`,
            borderRadius: 6,
            padding: "3px 7px",
          }}
        >
          🏆 {c.name} · {c.priority}
        </div>
      ))}
    </div>
  );
}

// ── Testing tab: battery, percentiles, and peer comparison ──────────────────────

function TestingTab({
  athlete,
  age,
  sport,
  tests,
  own,
  peerPool,
}: {
  athlete: Athlete;
  age: number;
  sport: string;
  tests: TestType[];
  own: Map<string, TestResult>;
  peerPool: { peers: Athlete[]; pool: Map<string, number[]> };
}) {
  const radarData = tests
    .map((t) => {
      const r = own.get(t.id);
      if (!r) return null;
      const pct = percentileRank(r.value, peerPool.pool.get(t.id) ?? [], t.higherIsBetter);
      return { test: t.shortName, percentile: round(pct, 0) };
    })
    .filter(Boolean) as { test: string; percentile: number }[];

  return (
    <>
      <div className="grid cols-3 mt-16">
        <Card
          title="Percentile radar"
          sub={`vs ${peerPool.peers.length} peers · ${genderLabel(athlete.gender).toLowerCase()} aged ${ageBand(age)}`}
        >
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} outerRadius={95}>
              <PolarGrid stroke="var(--chart-grid)" />
              <PolarAngleAxis dataKey="test" tick={{ fill: "var(--chart-axis-strong)", fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "var(--chart-axis)", fontSize: 10 }} angle={90} />
              <Radar dataKey="percentile" stroke="var(--series-1)" fill="var(--series-1)" fillOpacity={0.35} strokeWidth={2} />
              <Tooltip
                contentStyle={{
                  background: "var(--tooltip-bg)",
                  border: "1px solid var(--tooltip-border)",
                  borderRadius: 8,
                  color: "var(--tooltip-text)",
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        <div style={{ gridColumn: "span 2" }}>
          <Card
            title="Test battery vs peers"
            sub={`Percentile within ${genderLabel(athlete.gender).toLowerCase()} aged ${ageBand(age)} in ${sport}. 100 = best in peer group.`}
            actions={
              <Link to="/peers" className="btn ghost">
                Full peer comparison →
              </Link>
            }
          >
            <table>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Quality</th>
                  <th className="num">Latest</th>
                  <th className="num">Percentile</th>
                  <th style={{ width: 200 }}>Standing</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => {
                  const r = own.get(t.id);
                  if (!r) return null;
                  const pool = peerPool.pool.get(t.id) ?? [];
                  const pct = round(percentileRank(r.value, pool, t.higherIsBetter), 0);
                  const color = pct >= 75 ? "var(--good)" : pct >= 40 ? "var(--warn)" : "var(--bad)";
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
            {own.size === 0 && <div className="empty">No test results logged for this sport.</div>}
          </Card>
        </div>
      </div>
    </>
  );
}
