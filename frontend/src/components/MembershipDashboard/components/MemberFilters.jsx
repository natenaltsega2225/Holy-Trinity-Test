//frontend\src\components\MembershipDashoard\components\MemberFilters.jsx
// frontend/src/components/MembershipDashoard/components/MemberFilters.jsx
import React from "react";

const PERIODS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-Yearly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
  { value: "all", label: "All" },
];

export default function MemberFilters({
  search = "",
  onSearchChange,
  searchPlaceholder = "Search records...",
  period = "monthly",
  onPeriodChange,
  extraFilters = [],
  onApply,
}) {
  const safeExtraFilters = Array.isArray(extraFilters) ? extraFilters : [];

  return (
    <section className="member-card member-card-filters">
      <div className="member-filters-grid">
        <div className="member-filter-group member-filter-group-search">
          <label className="member-filter-label">Search</label>
          <input
            className="member-input"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>

        <div className="member-filter-group member-filter-group-period">
          <label className="member-filter-label">Period</label>
          <select
            className="member-select"
            value={period}
            onChange={(e) => onPeriodChange?.(e.target.value)}
          >
            {PERIODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {safeExtraFilters.length > 0 || onApply ? (
        <div className="member-filter-row">
          {safeExtraFilters.map((filter) => {
            const key = filter?.key || filter?.label || Math.random().toString();
            const label = filter?.label || filter?.key || "Filter";

            if (filter?.type === "date") {
              return (
                <div key={key} className="member-filter-group member-filter-field">
                  <label className="member-filter-label">{label}</label>
                  <input
                    type="date"
                    className="member-input"
                    value={filter?.value ?? ""}
                    onChange={(e) => filter?.onChange?.(e.target.value)}
                  />
                </div>
              );
            }

            return (
              <div key={key} className="member-filter-group member-filter-field">
                <label className="member-filter-label">{label}</label>
                <select
                  className="member-select"
                  value={filter?.value ?? ""}
                  onChange={(e) => filter?.onChange?.(e.target.value)}
                >
                  {(filter?.options || []).map((option) => (
                    <option key={String(option.value)} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

          {onApply ? (
            <div className="member-filter-actions">
              <button
                type="button"
                className="member-btn member-btn-primary"
                onClick={onApply}
              >
                Apply Filters
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}