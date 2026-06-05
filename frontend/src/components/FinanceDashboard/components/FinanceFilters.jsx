
// frontend/src/components/FinanceDashboard/components/FinanceFilters.jsx
import React from "react";

function getFilterLabel(filter) {
  if (filter?.label) return filter.label;

  const key = String(filter?.key || "")
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .trim();

  if (!key) return "Filter";

  return key.charAt(0).toUpperCase() + key.slice(1);
}

function renderExtraFilter(filter) {
  const label = getFilterLabel(filter);
  const value = filter?.value ?? "";
  const handleChange = (nextValue) => {
    if (typeof filter?.onChange === "function") {
      filter.onChange(nextValue);
    }
  };

  if (Array.isArray(filter?.options)) {
    return (
      <div key={filter.key} className="finance-filter-group">
        <label className="finance-filter-label">{label}</label>
        <select
          className="finance-input"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
        >
          {filter.options.map((option) => (
            <option key={`${filter.key}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (filter?.type === "date") {
    return (
      <div key={filter.key} className="finance-filter-group">
        <label className="finance-filter-label">{label}</label>
        <input
          type="date"
          className="finance-input"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div key={filter.key} className="finance-filter-group">
      <label className="finance-filter-label">{label}</label>
      <input
        type="text"
        className="finance-input"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
}

export default function FinanceFilters({
  search,
  onSearchChange,
  period,
  onPeriodChange,
  extraFilters = [],
  pageSize = 10,
  onPageSizeChange,
  showPeriodFilter = true,
  searchPlaceholder = "Search...",

  // 🔥 NEW
  dateFrom,
  dateTo,
  onDateChange,
  onApply,
  onExport,
}) {
  const isCustom = period === "custom";

  return (
    <section className="finance-filters-card">
      <div className="finance-filters-top">

        {/* 🔍 SEARCH */}
        <div className="finance-filter-group">
          <label className="finance-filter-label">Search</label>
          <input
            type="text"
            className="finance-input finance-search-input"
            placeholder={searchPlaceholder}
            value={search || ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>

        {/* 📅 PERIOD */}
        {showPeriodFilter && (
          <div className="finance-filter-group">
            <label className="finance-filter-label">Period</label>
            <select
              className="finance-input"
              value={period || "all"}
              onChange={(e) => onPeriodChange?.(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="yearly">This Year</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        )}

        {/* 🔥 DATE RANGE (ONLY FOR CUSTOM) */}
        {isCustom && (
          <>
            <div className="finance-filter-group">
              <label className="finance-filter-label">From</label>
              <input
                type="date"
                className="finance-input"
                value={dateFrom || ""}
                onChange={(e) => onDateChange?.("from", e.target.value)}
              />
            </div>

            <div className="finance-filter-group">
              <label className="finance-filter-label">To</label>
              <input
                type="date"
                className="finance-input"
                value={dateTo || ""}
                onChange={(e) => onDateChange?.("to", e.target.value)}
              />
            </div>
          </>
        )}

        {/* 📄 PAGE SIZE */}
        <div className="finance-filter-group">
          <label className="finance-filter-label">Page Size</label>
          <select
            className="finance-input finance-page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>

        {/* EXTRA FILTERS */}
        {extraFilters.map((filter) => renderExtraFilter(filter))}

        {/* 🚀 ACTION BUTTONS */}
        <div className="finance-filter-actions">
          <button
            className="btn-primary"
            onClick={onApply}
          >
            Apply
          </button>

          <button
            className="btn-secondary"
            onClick={onExport}
          >
            Export CSV
          </button>
        </div>
      </div>
    </section>
  );
}