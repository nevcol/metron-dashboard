import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHead } from "../components/Layout";
import { Avatar, Card, StatCard } from "../components/ui";
import { CATEGORY_COLORS, SPORT_BY_ID, TEST_BY_ID } from "../data/catalog";
import { useStore } from "../data/store";
import { ageOn, formatMonth } from "../lib/format";
import { round } from "../lib/stats";

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const IconUsers = () => (
  <svg {...svgProps}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-3-4.9" />
  </svg>
);
const IconPulse = () => (
  <svg {...svgProps}>
    <path d="M3 12h4l2 6 4-14 2 8h6" />
  </svg>
);
const IconTrophy = () => (
  <svg {...svgProps}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 19h6M10 15.5V19M14 15.5V19" />
  </svg>
);
const IconClock = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export default function Overview() {
  const { athletes, testResults, competitionResults, resetData } = useStore();

  const totalTests = testResults.length;
  const avgAge = round(
    athletes.reduce((a, x) => a + ageOn(x.birthDate), 0) / athletes.length,
    1,
  );

  // Tests per month over the last 12 months.
  const byMonth = new Map<string, number>();
  for (const r of testResults) {
    const key = r.date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const monthSeries = [...byMonth.entries()]
    .sort()
    .slice(-12)
    .map(([k, v]) => ({ month: formatMonth(k + "-01"), tests: v }));

  // Category distribution.
  const byCat = new Map<string, number>();
  for (const r of testResults) {
    const cat = TEST_BY_ID[r.testTypeId]?.category;
    if (cat) byCat.set(cat, (byCat.get(cat) ?? 0) + 1);
  }
  const catData = [...byCat.entries()].map(([name, value]) => ({ name, value }));

  // Most recent competition results.
  const recentComps = [...competitionResults]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  const sportCounts = new Map<string, number>();
  for (const a of athletes)
    for (const p of a.profiles)
      sportCounts.set(p.sportId, (sportCounts.get(p.sportId) ?? 0) + 1);

  return (
    <>
      <PageHead
        title="Performance Overview"
        subtitle="Cross-squad snapshot of testing volume, athlete demographics and recent competition output. Metron links physical testing to training load and results."
        actions={
          <button className="btn ghost" onClick={resetData}>
            Regenerate sample data
          </button>
        }
      />

      <div className="grid cols-4">
        <StatCard label="Athletes tracked" value={athletes.length} icon={<IconUsers />} />
        <StatCard label="Test records" value={totalTests} icon={<IconPulse />} />
        <StatCard label="Competition results" value={competitionResults.length} icon={<IconTrophy />} />
        <StatCard label="Average age" value={avgAge} unit="yrs" icon={<IconClock />} />
      </div>

      <div className="grid cols-3 mt-16">
        <div style={{ gridColumn: "span 2" }}>
          <Card title="Testing volume" sub="Monthly test records across all athletes (last 12 months)">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthSeries} margin={{ left: -18, right: 8, top: 6 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#243456" vertical={false} />
                <XAxis dataKey="month" stroke="#6b7da0" fontSize={11} tickLine={false} />
                <YAxis stroke="#6b7da0" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#15203a",
                    border: "1px solid #243456",
                    borderRadius: 8,
                    color: "#e8eefc",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tests"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fill="url(#g1)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card title="Test mix" sub="By physical quality">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={catData}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={86}
                paddingAngle={2}
              >
                {catData.map((d) => (
                  <Cell key={d.name} fill={CATEGORY_COLORS[d.name]} stroke="#0b1120" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#15203a",
                  border: "1px solid #243456",
                  borderRadius: 8,
                  color: "#e8eefc",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend mt-8">
            {catData.map((d) => (
              <span className="item" key={d.name}>
                <span className="dot" style={{ background: CATEGORY_COLORS[d.name] }} />
                {d.name}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid cols-2 mt-16">
        <Card title="Squad composition" sub="Athletes enrolled per sport">
          {[...sportCounts.entries()].map(([sid, count]) => (
            <div className="row between" key={sid} style={{ padding: "8px 0" }}>
              <span>{SPORT_BY_ID[sid]?.name ?? sid}</span>
              <span className="pill accent">{count} athletes</span>
            </div>
          ))}
          <Link to="/athletes" className="btn ghost mt-8" style={{ display: "inline-block" }}>
            View roster →
          </Link>
        </Card>

        <Card title="Latest competition results" sub="Most recent marks logged">
          <table>
            <tbody>
              {recentComps.map((c) => {
                const ath = athletes.find((a) => a.id === c.athleteId);
                const ev = SPORT_BY_ID[c.sportId]?.events.find((e) => e.id === c.eventId);
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="row">
                        <Avatar name={ath?.name ?? "?"} size={28} />
                        <span>{ath?.name}</span>
                      </div>
                    </td>
                    <td className="muted">{ev?.name}</td>
                    <td className="num">
                      {c.mark}
                      {ev?.unit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
