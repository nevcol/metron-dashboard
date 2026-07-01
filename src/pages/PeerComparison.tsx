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
import { SPORTS, TEST_BY_ID, testsForSport } from "../data/catalog";
import { latestTests, useStore } from "../data/store";
import { ageBand, ageOn, genderLabel } from "../lib/format";
import { percentileRank, round } from "../lib/stats";
import type { Athlete } from "../types";

export default function PeerComparison() {
  const { athletes, testResults } = useStore();
  const [sportId, setSportId] = useState(SPORTS[0].id);

  const sportAthletes = useMemo(
    () => athletes.filter((a) => a.profiles.some((p) => p.sportId === sportId)),
    [athletes, sportId],
  );

  const [athleteId, setAthleteId] = useState(sportAthletes[0]?.id ?? "");
  const athlete =
    sportAthletes.find((a) => a.id === athleteId) ?? sportAthletes[0];

  const tests = testsForSport(sportId);

  // Peer group: same gender, same age band, same sport.
  const peerPool = useMemo(() => {
    if (!athlete) return { peers: [] as Athlete[], pool: new Map<string, number[]>() };
    const band = ageBand(ageOn(athlete.birthDate));
    const peers = sportAthletes.filter(
      (a) => a.gender === athlete.gender && ageBand(ageOn(a.birthDate)) === band,
    );
    const pool = new Map<string, number[]>();
    for (const p of peers) {
      const lt = latestTests(testResults, p.id, sportId);
      for (const [tid, r] of lt) {
        if (!pool.has(tid)) pool.set(tid, []);
        pool.get(tid)!.push(r.value);
      }
    }
    return { peers, pool };
  }, [athlete, sportAthletes, testResults, sportId]);

  const own = athlete ? latestTests(testResults, athlete.id, sportId) : new Map();

  const radarData = tests
    .map((t) => {
      const r = own.get(t.id);
      if (!r) return null;
      const pct = percentileRank(r.value, peerPool.pool.get(t.id) ?? [], t.higherIsBetter);
      return { test: t.shortName, percentile: round(pct, 0) };
    })
    .filter(Boolean) as { test: string; percentile: number }[];

  // Leaderboard for a chosen test within the peer group.
  const [boardTest, setBoardTest] = useState("cmj");
  const boardType = TEST_BY_ID[boardTest];
  const leaderboard = useMemo(() => {
    const rows = peerPool.peers
      .map((p) => {
        const r = latestTests(testResults, p.id, sportId).get(boardTest);
        return r ? { athlete: p, value: r.value } : null;
      })
      .filter(Boolean) as { athlete: Athlete; value: number }[];
    rows.sort((a, b) =>
      boardType?.higherIsBetter ? b.value - a.value : a.value - b.value,
    );
    return rows;
  }, [peerPool.peers, testResults, sportId, boardTest, boardType]);

  const maxVal = Math.max(...leaderboard.map((r) => r.value), 1);

  if (!athlete) {
    return (
      <>
        <PageHead title="Peer Comparison" />
        <div className="empty">No athletes in this sport.</div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Peer Comparison"
        subtitle="Where an athlete stands against peers of the same gender and age band. The radar shows percentile rank per test; 50 is the peer median."
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

      <div className="grid cols-3">
        <Card title="Athlete profile" sub="Percentile across the test battery">
          <select
            value={athleteId}
            onChange={(e) => setAthleteId(e.target.value)}
            style={{ width: "100%", marginBottom: 12 }}
          >
            {sportAthletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="row" style={{ marginBottom: 12 }}>
            <Avatar name={athlete.name} size={40} />
            <div>
              <div style={{ fontWeight: 650 }}>{athlete.name}</div>
              <div className="faint" style={{ fontSize: 12 }}>
                {genderLabel(athlete.gender)} · {ageBand(ageOn(athlete.birthDate))} ·{" "}
                {peerPool.peers.length} peers
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} outerRadius={100}>
              <PolarGrid stroke="var(--chart-grid)" />
              <PolarAngleAxis dataKey="test" tick={{ fill: "var(--chart-axis-strong)", fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "var(--chart-axis)", fontSize: 10 }} angle={90} />
              <Radar
                dataKey="percentile"
                stroke="var(--series-1)"
                fill="var(--series-1)"
                fillOpacity={0.35}
                strokeWidth={2}
              />
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
            title="Peer leaderboard"
            sub={`${boardType?.name} · ${genderLabel(athlete.gender)} aged ${ageBand(ageOn(athlete.birthDate))}`}
            actions={
              <select value={boardTest} onChange={(e) => setBoardTest(e.target.value)}>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName}
                  </option>
                ))}
              </select>
            }
          >
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Athlete</th>
                  <th className="num">{boardType?.unit || "index"}</th>
                  <th style={{ width: 260 }}></th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => {
                  const isSelf = row.athlete.id === athlete.id;
                  return (
                    <tr key={row.athlete.id}>
                      <td style={{ fontWeight: 700, color: i < 3 ? "var(--accent)" : "var(--text-faint)" }}>
                        {i + 1}
                      </td>
                      <td>
                        <Link to={`/athletes/${row.athlete.id}`} className="row">
                          <Avatar name={row.athlete.name} size={28} />
                          <span style={{ fontWeight: isSelf ? 700 : 500 }}>
                            {row.athlete.name}
                            {isSelf && <span className="pill accent" style={{ marginLeft: 8 }}>selected</span>}
                          </span>
                        </Link>
                      </td>
                      <td className="num">{row.value}</td>
                      <td>
                        <Bar
                          value={boardType?.higherIsBetter ? row.value : maxVal - row.value + 1}
                          max={boardType?.higherIsBetter ? maxVal : maxVal}
                          color={isSelf ? "var(--accent)" : "var(--panel-2)"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {leaderboard.length === 0 && <div className="empty">No peer data for this test.</div>}
          </Card>
        </div>
      </div>
    </>
  );
}
