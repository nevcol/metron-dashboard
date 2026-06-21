import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "../components/Layout";
import { Avatar, Card } from "../components/ui";
import {
  CATEGORY_COLORS,
  SPORT_BY_ID,
  TEST_BY_ID,
  TEST_TYPES,
  testsForSport,
} from "../data/catalog";
import { useStore } from "../data/store";
import { formatDate } from "../lib/format";

export default function Testing() {
  const { athletes, testResults, addTestResult } = useStore();
  const [testFilter, setTestFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);

  const athleteById = useMemo(
    () => new Map(athletes.map((a) => [a.id, a])),
    [athletes],
  );

  const rows = useMemo(
    () =>
      [...testResults]
        .filter((r) => testFilter === "all" || r.testTypeId === testFilter)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 120),
    [testResults, testFilter],
  );

  // Add-test form state
  const [form, setForm] = useState({
    athleteId: athletes[0]?.id ?? "",
    testTypeId: "cmj",
    value: "",
    date: "2026-06-21",
  });

  const formAthlete = athleteById.get(form.athleteId);
  const formSport = formAthlete?.profiles[0]?.sportId ?? "athletics";

  function submit() {
    const value = parseFloat(form.value);
    if (!form.athleteId || !value) return;
    addTestResult({
      athleteId: form.athleteId,
      sportId: formSport,
      testTypeId: form.testTypeId,
      date: form.date,
      value,
    });
    setForm((f) => ({ ...f, value: "" }));
    setShowForm(false);
  }

  return (
    <>
      <PageHead
        title="Testing Log"
        subtitle="Every physical test recorded across the squad. Filter by test type or add a new measurement."
        actions={
          <button className="btn" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Close" : "+ Record test"}
          </button>
        }
      />

      {showForm && (
        <Card title="Record a test result">
          <div className="toolbar" style={{ marginBottom: 0, alignItems: "flex-end" }}>
            <div className="field">
              <label>Athlete</label>
              <select
                value={form.athleteId}
                onChange={(e) => setForm({ ...form, athleteId: e.target.value })}
              >
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Test</label>
              <select
                value={form.testTypeId}
                onChange={(e) => setForm({ ...form, testTypeId: e.target.value })}
              >
                {testsForSport(formSport).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.unit || "index"})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Value</label>
              <input
                type="number"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0.00"
                style={{ width: 100 }}
              />
            </div>
            <div className="field">
              <label>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <button className="btn" onClick={submit}>
              Save
            </button>
          </div>
        </Card>
      )}

      <div className="toolbar mt-16">
        <div className="field">
          <label>Test type</label>
          <select value={testFilter} onChange={(e) => setTestFilter(e.target.value)}>
            <option value="all">All tests</option>
            {TEST_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="spacer" />
        <span className="pill">{rows.length} most recent</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Athlete</th>
              <th>Test</th>
              <th>Quality</th>
              <th>Sport</th>
              <th className="num">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = athleteById.get(r.athleteId);
              const t = TEST_BY_ID[r.testTypeId];
              return (
                <tr key={r.id}>
                  <td className="muted">{formatDate(r.date)}</td>
                  <td>
                    <Link to={`/athletes/${r.athleteId}`} className="row">
                      <Avatar name={a?.name ?? "?"} size={28} />
                      <span>{a?.name}</span>
                    </Link>
                  </td>
                  <td style={{ fontWeight: 600 }}>{t?.name}</td>
                  <td>
                    <span className="pill" style={{ color: CATEGORY_COLORS[t?.category ?? "Speed"] }}>
                      {t?.category}
                    </span>
                  </td>
                  <td className="muted">{SPORT_BY_ID[r.sportId]?.name}</td>
                  <td className="num">
                    {r.value} {t?.unit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
