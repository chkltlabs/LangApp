import { Link, Outlet } from "react-router-dom";

const nav = [
  ["/", "Chat"],
  ["/voice", "Voice"],
  ["/srs", "Vocabulary"],
  ["/exercises", "Exercises"],
  ["/pronounce", "Pronunciation"],
] as const;

export function Layout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 180,
          padding: "1rem",
          background: "#1a1d26",
          borderRight: "1px solid #2a3142",
        }}
      >
        <h1 style={{ fontSize: "1.1rem", margin: "0 0 1rem" }}>LangApp</h1>
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {nav.map(([to, label]) => (
            <Link key={to} to={to} style={{ textDecoration: "none" }}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main style={{ flex: 1, padding: "1.25rem", maxWidth: 900 }}>
        <Outlet />
      </main>
    </div>
  );
}
