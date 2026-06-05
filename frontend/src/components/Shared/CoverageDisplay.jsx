// src/components/shared/CoverageDisplay.jsx

import React from "react";

import {
  coverageDisplay,
  buildCoverageMonths,
} from "../../utils/paymentFormatters";

export default function CoverageDisplay({
  row,
  showMonths = false,
}) {
  const months = buildCoverageMonths(row);

  return (
    <div className="coverage-display-wrap">
      <div className="coverage-display-label">
        {coverageDisplay(row)}
      </div>

      {showMonths && months.length ? (
        <div className="coverage-display-months">
          {months.map((month) => (
            <span
              key={month}
              className="coverage-display-chip"
            >
              ✓ {month}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}