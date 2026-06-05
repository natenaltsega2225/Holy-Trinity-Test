import React from "react";

export default function AdminPageHeader({
  title,
  subtitle,
  actions = [],
}) {
  return (
    <section
      className="card"
      style={{
        marginBottom: 16,
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{title}</h2>
        {subtitle ? (
          <p style={{ margin: "8px 0 0", color: "var(--dash-muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>

      {actions.length ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`btn ${action.variant === "primary" ? "btn-primary" : ""}`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}