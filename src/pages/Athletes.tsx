import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "../components/Layout";
import { Avatar } from "../components/ui";
import { SPORT_BY_ID } from "../data/catalog";
import { useStore } from "../data/store";
import { ageOn, genderLabel, yearsBetween } from "../lib/format";

export default function Athletes() {
  const { athletes, testResults } = useStore();
  const [sport, setSport] = useState("all");
  const [gender, setGender] = useState("all");
  const [query, setQuery] = useState("");

  const testCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of testResults) m.set(r.athleteId, (m.get(r.athleteId) ?? 0) + 1);
    return m;
  }, [testResults]);

  const rows = athletes.filter((a) => {
    if (gender !== "all" && a.gender !== gender) return false;
    if (sport !== "all" && !a.profiles.some((p) => p.sportId === sport)) return false;
    if (query && !a.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <PageHead
        title="Athlete Roster"
        subtitle="Each athlete carries one profile per sport. Open a profile to see their testing history, peer standing and training plan."
      />

      <div className="toolbar">
        <div className="field">
          <label>Search</label>
          <input
            placeholder="Name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Sport</label>
          <select value={sport} onChange={(e) => setSport(e.target.value)}>
            <option value="all">All sports</option>
            {Object.values(SPORT_BY_ID).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Gender</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="all">All</option>
            <option value="M">Men</option>
            <option value="F">Women</option>
          </select>
        </div>
        <div className="spacer" />
        <span className="pill">{rows.length} athletes</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Athlete</th>
              <th>Sport · Events</th>
              <th>Gender</th>
              <th className="num">Age</th>
              <th className="num">Experience</th>
              <th className="num">Tests</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const prof = a.profiles[0];
              const sportObj = SPORT_BY_ID[prof.sportId];
              const events = prof.eventIds
                .map((id) => sportObj?.events.find((e) => e.id === id)?.name)
                .filter(Boolean)
                .join(", ");
              return (
                <tr key={a.id}>
                  <td>
                    <Link to={`/athletes/${a.id}`} className="row">
                      <Avatar name={a.name} size={34} />
                      <span style={{ fontWeight: 600 }}>{a.name}</span>
                    </Link>
                  </td>
                  <td>
                    <div>{sportObj?.name}</div>
                    <div className="faint" style={{ fontSize: 12 }}>
                      {events}
                    </div>
                  </td>
                  <td className="muted">{genderLabel(a.gender)}</td>
                  <td className="num">{ageOn(a.birthDate)}</td>
                  <td className="num">
                    {Math.round(yearsBetween(prof.startedOn))} yr
                  </td>
                  <td className="num">{testCounts.get(a.id) ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">No athletes match these filters.</div>}
      </div>
    </>
  );
}
