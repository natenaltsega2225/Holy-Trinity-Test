// src/components/shared/FinanceBadge.jsx

import React from "react";

export default function FinanceBadge({
  label,
  type = "neutral",
}) {
  return (
    <span className={`finance-badge finance-badge-${type}`}>
      {label || "--"}
    </span>
  );
}