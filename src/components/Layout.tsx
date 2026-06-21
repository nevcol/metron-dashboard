import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

/** Minimal inline line-icons (stroke = currentColor). */
const I = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  roster: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-3-4.9" />
    </svg>
  ),
  testing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13V9M12 5V3M10 3h4" />
    </svg>
  ),
  results: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 19h6M10 15.5V19M14 15.5V19" />
    </svg>
  ),
  correlations: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20 20 4" />
      <circle cx="6.5" cy="17.5" r="1.6" />
      <circle cx="11" cy="14" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="18" cy="7" r="1.6" />
    </svg>
  ),
  peers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  periodization: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4M7 14h3M13 17h4" />
    </svg>
  ),
};

const NAV = [
  {
    label: "Overview",
    items: [{ to: "/", icon: I.dashboard, text: "Dashboard", end: true }],
  },
  {
    label: "Athletes",
    items: [
      { to: "/athletes", icon: I.roster, text: "Roster" },
      { to: "/testing", icon: I.testing, text: "Testing Log" },
      { to: "/results", icon: I.results, text: "Results" },
    ],
  },
  {
    label: "Analysis",
    items: [
      { to: "/correlations", icon: I.correlations, text: "Correlations" },
      { to: "/peers", icon: I.peers, text: "Peer Comparison" },
      { to: "/periodization", icon: I.periodization, text: "Periodization" },
    ],
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M7 22V10l5 7 5-7v12" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M21 10v12M25 14v8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <div className="name">Metron</div>
            <div className="tag">Testing Lab</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="label">{group.label}</div>
              {group.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={"end" in it ? (it.end as boolean) : false}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  <span className="ico">{it.icon}</span>
                  {it.text}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}
