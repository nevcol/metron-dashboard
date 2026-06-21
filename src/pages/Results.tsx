import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { Avatar, Card } from "../components/ui";
import { SPORTS, SPORT_BY_ID } from "../data/catalog";
import { useStore } from "../data/store";
import { formatMonth } from "../lib/format";
import { round } from "../lib/stats";
import type { Athlete } from "../types";

export default function Results() {
  const { athletes, competitionResults } = useStore();
  const [sportId, setSportId] = useState(SPORTS[0].id);
  const sport = SPORT_BY_ID[sportId];
  const [eventId, setEventId] = useState(sport.events[0].id);
  const event = sport.events.find((e) => e.id === eventId) ?? sport.events[0];

  const athleteById = useMemo(
    () => new Map(athletes.map((a) => [a.id, a])),
    [athletes],
  );

  // Season-best leaderboard for the event.
  const leaderboard = useMemo(() => {
    const best = new Map<string, number>();
    for (const c of competitionResults) {
      if (c.sportId !== sportId || c.eventId !== eventId) continue;
      const cur = best.get(c.athleteId);
      if (cur === undefined || (event.higherIsBetter ? c.mark > cur : c.mark < cur)) {
        best.set(c.athleteId, c.mark);
      }
    }
    const rows = [...best.entries()].map(([aid, mark]) => ({
      athlete: athleteById.get(aid)!,
      mark,
    }));
    rows.sort((a, b) => (event.higherIsBetter ? b.mark - a.mark : a.mark - b.mark));
    return rows;
  }, [competitionResults, sportId, eventId, event, athleteById]);

  // Progression of the top athlete in this event (or first selectable).
  const [focusAthlete, setFocusAthlete] = useState<string | null>(null);
  const focusId = focusAthlete ?? leaderboard[0]?.athlete.id ?? null;

  const progression = useMemo(() => {
    if (!focusId) return [];
    return competitionResults
      .filter((c) => c.athleteId === focusId && c.eventId === eventId && c.sportId === sportId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((c) => ({ month: formatMonth(c.date), mark: c.mark }));
  }, [competitionResults, focusId, eventId, sportId]);

  const focus: Athlete | undefined = focusId ? athleteById.get(focusId) : undefined;

  const trend = useMemo(() => {
    if (progression.length < 2) return null;
    const first = progression[0].mark;
    const last = progression[progression.length - 1].mark;
    const diff = last - first;
    const improved = event.higherIsBetter ? diff > 0 : diff < 0;
    const pct = round((Math.abs(diff) / first) * 100, 1);
    return { improved, pct, diff: round(diff, 2) };
  }, [progression, event]);

  return (
    <>
      <PageHead
        title="Results Tracking"
        subtitle="Competition output by event: season-best rankings and the progression of marks over the season for each athlete."
        actions={
          <select
            value={sportId}
            onChange={(e) => {
              setSportId(e.target.value);
              setEventId(SPORT_BY_ID[e.target.value].events[0].id);
              setFocusAthlete(null);
            }}
          >
            {SPORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="toolbar">
        <div className="field">
          <label>Event</label>
          <select
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setFocusAthlete(null);
            }}
          >
            {sport.events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>
        <div className="spacer" />
        <span className="pill">{leaderboard.length} athletes ranked</span>
      </div>

      <div className="grid cols-3">
        <div style={{ gridColumn: "span 2" }}>
          <Card title={`Season bests — ${event.name}`} sub="Best legal mark per athlete this period">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Athlete</th>
                  <th className="num">Best ({event.unit})</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.athlete.id}>
                    <td style={{ fontWeight: 700, color: i < 3 ? "var(--accent)" : "var(--text-faint)" }}>
                      {i + 1}
                    </td>
                    <td>
                      <Link to={`/athletes/${row.athlete.id}`} className="row">
                        <Avatar name={row.athlete.name} size={28} />
                        <span style={{ fontWeight: 600 }}>{row.athlete.name}</span>
                      </Link>
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {row.mark}
                    </td>
                    <td>
                      <button
                        className="btn ghost"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        onClick={() => setFocusAthlete(row.athlete.id)}
                      >
                        Progression
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leaderboard.length === 0 && <div className="empty">No results for this event.</div>}
          </Card>
        </div>

        <Card
          title="Mark progression"
          sub={focus ? `${focus.name} · ${event.name}` : "Select an athlete"}
        >
          {trend && (
            <div className="stat" style={{ marginBottom: 8 }}>
              <div className="value" style={{ fontSize: 22 }}>
                {trend.diff > 0 ? "+" : ""}
                {trend.diff} {event.unit}
              </div>
              <div className={`delta ${trend.improved ? "up" : "down"}`}>
                {trend.improved ? "▲ improving" : "▼ regressing"} · {trend.pct}% over season
              </div>
            </div>
          )}
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={progression} margin={{ left: -14, right: 8, top: 6 }}>
              <CartesianGrid stroke="#243456" vertical={false} />
              <XAxis dataKey="month" stroke="#6b7da0" fontSize={11} tickLine={false} />
              <YAxis
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
              <Line
                type="monotone"
                dataKey="mark"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
          {progression.length === 0 && <div className="empty">No marks to plot.</div>}
        </Card>
      </div>
    </>
  );
}
