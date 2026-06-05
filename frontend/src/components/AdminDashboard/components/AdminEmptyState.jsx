import React from "react";

export default function AdminEmptyState({
  title = "No records found",
  subtitle = "Try adjusting your search or filters.",
}) {
  return (
    <section className="card" style={{ textAlign: "center", padding: 32 }}>
      <h3 style={{ margin: 0, fontSize: 22 }}>{title}</h3>
      <p style={{ marginTop: 10, color: "var(--dash-muted)" }}>{subtitle}</p>
    </section>
  );
}