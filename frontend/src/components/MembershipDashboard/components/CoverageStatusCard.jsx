// frontend/src/components/MembershipDashboard/components/CoverageStatusCard.jsx
import React, { useMemo } from "react";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function getMonthNumber(row = {}) {
  const direct = Number(row.month_number || row.month || 0);
  if (direct >= 1 && direct <= 12) return direct;

  const raw = String(row.coverage_month || row.coverage_key || "").trim();

  if (/^\d{4}-\d{2}$/.test(raw)) {
    return Number(raw.slice(5, 7));
  }

  const short = String(row.month_short || row.month_name || "").slice(0, 3);
  const index = MONTHS.findIndex(
    (m) => m.toLowerCase() === short.toLowerCase()
  );

  return index >= 0 ? index + 1 : null;
}

export default function CoverageStatusCard({ rows = [] }) {
  const paidMonths = useMemo(() => {
    const set = new Set();

    rows.forEach((row) => {
      const status = String(row.status || row.coverage_status || "").toLowerCase();
      const paid =
        row.paid === true ||
        ["paid", "completed", "posted"].includes(status);

      const monthNumber = getMonthNumber(row);

      if (paid && monthNumber >= 1 && monthNumber <= 12) {
        set.add(monthNumber);
      }
    });

    return set;
  }, [rows]);

  const paidCount = paidMonths.size;
  const unpaidCount = Math.max(0, 12 - paidCount);
  const progress = Math.min(100, Math.round((paidCount / 12) * 100));

  const status =
    paidCount >= 12
      ? "Fully Covered"
      : paidCount >= 6
      ? "Partially Covered"
      : "Renewal Needed";

  return (
    <div className="coverage-card">
      <div className="coverage-card-head">
        <div>
          <span className="coverage-card-label">Membership Coverage</span>
          <h3 className="coverage-card-title">{new Date().getFullYear()}</h3>
        </div>

        <div
          className={`coverage-status ${
            paidCount >= 12 ? "full" : paidCount >= 6 ? "partial" : "warning"
          }`}
        >
          {status}
        </div>
      </div>

      <div className="coverage-progress-wrap">
        <div className="coverage-progress-bar">
          <div
            className="coverage-progress-fill"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className="coverage-progress-meta">
          <span>{paidCount} of 12 months paid</span>
          <strong>{progress}%</strong>
        </div>
      </div>

      <div className="coverage-month-grid">
        {MONTHS.map((month, index) => {
          const paid = paidMonths.has(index + 1);

          return (
            <div
              key={month}
              className={`coverage-month ${paid ? "paid" : "unpaid"}`}
            >
              <span>{month}</span>
              <strong>{paid ? "✓" : "—"}</strong>
            </div>
          );
        })}
      </div>

      <div className="coverage-footer">
        <div className="coverage-footer-item">
          <span>Paid Months</span>
          <strong>{paidCount}</strong>
        </div>

        <div className="coverage-footer-item">
          <span>Remaining</span>
          <strong>{unpaidCount}</strong>
        </div>
      </div>
    </div>
  );
}