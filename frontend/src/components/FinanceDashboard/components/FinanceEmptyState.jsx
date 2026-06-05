import React from "react";

export default function FinanceEmptyState({
  title = "No records found",
  description = "Try adjusting your search or filters.",
}) {
  return (
    <section className="finance-empty">
      <div className="finance-empty-icon">📂</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </section>
  );
}
