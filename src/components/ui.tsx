import type { ReactNode } from "react";
import { initials } from "../lib/format";

const AVATAR_COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#f97316",
  "#22c55e",
  "#ec4899",
  "#14b8a6",
  "#eab308",
  "#6366f1",
];

export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const idx =
    name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  const bg = AVATAR_COLORS[idx];
  return (
    <span
      className="avatar"
      style={{
        background: `linear-gradient(135deg, ${bg}, ${bg}aa)`,
        width: size,
        height: size,
        fontSize: size * 0.34,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function StatCard({
  label,
  value,
  unit,
  delta,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { text: string; dir: "up" | "down" | "flat" };
}) {
  return (
    <div className="card stat">
      <div className="value">
        {value}
        {unit && <span style={{ fontSize: 16, color: "var(--text-dim)" }}> {unit}</span>}
      </div>
      <div className="label">{label}</div>
      {delta && <div className={`delta ${delta.dir}`}>{delta.text}</div>}
    </div>
  );
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.max(2, Math.min(100, (value / max) * 100));
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Card({
  title,
  sub,
  children,
  actions,
}: {
  title?: string;
  sub?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card">
      {(title || actions) && (
        <div className="row between" style={{ marginBottom: sub ? 2 : 12 }}>
          {title && <h3>{title}</h3>}
          {actions}
        </div>
      )}
      {sub && <div className="sub">{sub}</div>}
      {children}
    </div>
  );
}
