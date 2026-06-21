import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

const NAV = [
  {
    label: "Overview",
    items: [{ to: "/", icon: "◎", text: "Dashboard", end: true }],
  },
  {
    label: "Athletes",
    items: [
      { to: "/athletes", icon: "👥", text: "Roster" },
      { to: "/testing", icon: "⏱", text: "Testing Log" },
      { to: "/results", icon: "🏆", text: "Results" },
    ],
  },
  {
    label: "Analysis",
    items: [
      { to: "/correlations", icon: "🔗", text: "Correlations" },
      { to: "/peers", icon: "📊", text: "Peer Comparison" },
      { to: "/periodization", icon: "📆", text: "Periodization" },
    ],
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="/metron.svg" alt="Metron" />
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
