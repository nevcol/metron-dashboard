import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "../components/Layout";
import { Avatar, Card } from "../components/ui";
import { SPORTS, SPORT_BY_ID } from "../data/catalog";
import { useStore } from "../data/store";
import { ageOn, genderLabel, yearsBetween } from "../lib/format";
import type { Gender } from "../types";

export default function Athletes() {
  const { athletes, testResults, addAthlete } = useStore();
  const [sport, setSport] = useState("all");
  const [gender, setGender] = useState("all");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

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

  const [form, setForm] = useState({
    name: "",
    gender: "F" as Gender,
    birthDate: "2008-01-01",
    sportId: "tennis",
    eventId: SPORT_BY_ID["tennis"].events[0].id,
    experienceYears: "3",
    heightCm: "175",
    massKg: "68",
  });

  const formSport = SPORT_BY_ID[form.sportId];

  function submit() {
    if (!form.name.trim()) return;
    const started = new Date("2026-06-21");
    started.setFullYear(started.getFullYear() - (parseInt(form.experienceYears) || 0));
    addAthlete({
      name: form.name.trim(),
      gender: form.gender,
      birthDate: form.birthDate,
      heightCm: parseInt(form.heightCm) || 175,
      massKg: parseInt(form.massKg) || 68,
      profile: {
        sportId: form.sportId,
        eventIds: [form.eventId],
        startedOn: started.toISOString().slice(0, 10),
      },
    });
    setForm((f) => ({ ...f, name: "" }));
    setShowForm(false);
  }

  return (
    <>
      <PageHead
        title="Athlete Roster"
        subtitle="Each athlete carries one profile per sport. Open a profile to see their testing history, peer standing and training plan."
        actions={
          <button className="btn" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Close" : "+ Add athlete"}
          </button>
        }
      />

      {showForm && (
        <Card title="Add an athlete" sub="New athletes start with an empty test battery — log results from the Testing page as they are tested.">
          <div className="toolbar" style={{ marginBottom: 0, alignItems: "flex-end" }}>
            <div className="field">
              <label>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="field">
              <label>Gender</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}
              >
                <option value="F">Women</option>
                <option value="M">Men</option>
              </select>
            </div>
            <div className="field">
              <label>Birth date</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Sport</label>
              <select
                value={form.sportId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sportId: e.target.value,
                    eventId: SPORT_BY_ID[e.target.value].events[0].id,
                  })
                }
              >
                {SPORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Primary event</label>
              <select
                value={form.eventId}
                onChange={(e) => setForm({ ...form, eventId: e.target.value })}
              >
                {formSport.events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Exp (yrs)</label>
              <input
                type="number"
                value={form.experienceYears}
                onChange={(e) => setForm({ ...form, experienceYears: e.target.value })}
                style={{ width: 70 }}
              />
            </div>
            <div className="field">
              <label>Height (cm)</label>
              <input
                type="number"
                value={form.heightCm}
                onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
                style={{ width: 80 }}
              />
            </div>
            <div className="field">
              <label>Mass (kg)</label>
              <input
                type="number"
                value={form.massKg}
                onChange={(e) => setForm({ ...form, massKg: e.target.value })}
                style={{ width: 80 }}
              />
            </div>
            <button className="btn" onClick={submit}>
              Save athlete
            </button>
          </div>
        </Card>
      )}

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
