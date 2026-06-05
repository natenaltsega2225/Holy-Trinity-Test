import React from "react";

export default function AdminSummaryCards({ items = [] }) {
  if (!items.length) return null;

  return (
    <section className="dash-kpi-grid dash-kpi-grid--4" style={{ marginBottom: 16 }}>
      {items.map((item) => (
        <div
          key={item.label}
          className={`dash-kpi-card ${item.featured ? "dash-kpi-card--featured" : ""}`}
        >
          <div className="dash-kpi-label">{item.label}</div>
          <div className="dash-kpi-value">{item.value}</div>
          {item.sub ? <div className="dash-kpi-sub">{item.sub}</div> : null}
        </div>
      ))}
    </section>
  );
}