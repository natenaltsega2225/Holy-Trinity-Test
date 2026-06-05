import React from "react";

export default function ReconciliationSummaryCards({ summary = {} }) {
  const cards = [
    {
      label: "Total Transactions",
      value: summary.total ?? 0,
      sub: "All reconciliation rows",
    },
    {
      label: "Matched %",
      value: `${summary.match_rate ?? 0}%`,
      sub: "Approved and matched rows",
    },
    {
      label: "Unmatched Amount",
      value: `$${Number(summary.unmatched_amount || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      sub: "Amount still requiring review",
    },
    {
      label: "Discrepancies",
      value: summary.discrepancy_count ?? 0,
      sub: "Rows flagged for investigation",
    },
  ];

  return (
    <section className="recon-summary-grid">
      {cards.map((card) => (
        <article key={card.label} className="recon-summary-card">
          <span className="recon-summary-label">{card.label}</span>
          <strong className="recon-summary-value">{card.value}</strong>
          <p className="recon-summary-sub">{card.sub}</p>
        </article>
      ))}
    </section>
  );
}