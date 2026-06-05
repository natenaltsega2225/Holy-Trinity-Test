import React from "react";

export default function FinanceSummaryCards({ items = [] }) {
  if (!items.length) return null;

  return (
    <section className="finance-summary-grid">
      {items.map((item, index) => (
        <article
          key={`${item.label}-${index}`}
          className={`finance-summary-card ${
            item.featured ? "finance-summary-card-featured" : ""
          }`}
        >
          <div className="finance-summary-label">{item.label}</div>
          <div className="finance-summary-value">{item.value}</div>
          {item.sub ? <div className="finance-summary-sub">{item.sub}</div> : null}
        </article>
      ))}
    </section>
  );
}