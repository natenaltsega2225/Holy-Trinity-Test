
//frontend\src\components\AdminDashboard\components\AdminFilters.jsx
import React from "react";

const PERIODS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half-yearly", label: "Half-Yearly" },
  { value: "yearly", label: "Yearly" },
];

export default function AdminFilters({
  search = "",
  onSearchChange,
  period = "monthly",
  onPeriodChange,
  extraFilters = [],
  hidePeriod = false,
}) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: hidePeriod
            ? "minmax(220px, 1fr)"
            : "minmax(220px, 1.5fr) minmax(180px, 0.8fr)",
          gap: 12,
          alignItems: "center",
        }}
      >
        <input
          className="dash-search-input"
          placeholder="Search records..."
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />

        {!hidePeriod ? (
          <select
            className="dash-inline-input"
            value={period}
            onChange={(e) => onPeriodChange?.(e.target.value)}
          >
            {PERIODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {extraFilters.length > 0 ? (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {extraFilters.map((filter) => (
            <select
              key={filter.key}
              className="dash-inline-input"
              value={filter.value ?? ""}
              onChange={(e) => filter.onChange?.(e.target.value)}
              style={{ minWidth: 180 }}
            >
              {(filter.options || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      ) : null}
    </section>
  );
}