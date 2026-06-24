// frontend/src/components/FinanceDashboard/components/FinanceFilters.jsx

import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import "../../../styles/finance-enterprise.css";

const PERIOD_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

function clean(value) {
  return String(value ?? "").trim();
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return clean(value) !== "";
}

function filterValue(filter, values = {}) {
  if (filter.value !== undefined) return filter.value;
  if (filter.key) return values[filter.key] ?? "";
  return "";
}

function renderFilter(filter, values, onFilterChange) {
  const value = filterValue(filter, values);

  const handleChange = (nextValue) => {
    if (typeof filter.onChange === "function") {
      filter.onChange(nextValue);
      return;
    }

    if (typeof onFilterChange === "function" && filter.key) {
      onFilterChange(filter.key, nextValue);
    }
  };

  if (filter.hidden) return null;

  if (filter.render && typeof filter.render === "function") {
    return (
      <div key={filter.key || filter.label} className="finance-filter-control">
        {filter.render({
          value,
          onChange: handleChange,
          filter,
        })}
      </div>
    );
  }

  if (Array.isArray(filter.options)) {
    return (
      <label key={filter.key || filter.label} className="finance-filter-control">
        {filter.label ? <span>{filter.label}</span> : null}
        <select
          value={value}
          disabled={filter.disabled}
          onChange={(event) => handleChange(event.target.value)}
        >
          {filter.options.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (filter.type === "checkbox") {
    return (
      <label
        key={filter.key || filter.label}
        className="finance-filter-check"
      >
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={filter.disabled}
          onChange={(event) => handleChange(event.target.checked)}
        />
        <span>{filter.label}</span>
      </label>
    );
  }

  return (
    <label key={filter.key || filter.label} className="finance-filter-control">
      {filter.label ? <span>{filter.label}</span> : null}
      <input
        type={filter.type || "text"}
        value={value}
        disabled={filter.disabled}
        placeholder={filter.placeholder || filter.label || filter.key}
        min={filter.min}
        max={filter.max}
        step={filter.step}
        onChange={(event) => handleChange(event.target.value)}
      />
    </label>
  );
}

export default function FinanceFilters({
  search = "",
  onSearchChange,
  searchPlaceholder = "Search finance records...",

  period = "all",
  onPeriodChange,
  showPeriod = true,
  periodOptions = PERIOD_OPTIONS,

  dateFrom = "",
  dateTo = "",
  onDateFromChange,
  onDateToChange,

  filters = [],
  values = {},
  onFilterChange,

  onClear,
  onRefresh,
  onExport,
  exportDisabled = false,
  refreshDisabled = false,

  compact = false,
  collapsible = true,
  defaultExpanded = true,
  children,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const activeCount = useMemo(() => {
    let count = 0;

    if (hasValue(search)) count += 1;
    if (period && period !== "all") count += 1;
    if (hasValue(dateFrom)) count += 1;
    if (hasValue(dateTo)) count += 1;

    filters.forEach((filter) => {
      if (filter.hidden) return;

      const value = filterValue(filter, values);

      if (hasValue(value)) count += 1;
    });

    return count;
  }, [search, period, dateFrom, dateTo, filters, values]);

  const showCustomDates =
    period === "custom" ||
    hasValue(dateFrom) ||
    hasValue(dateTo) ||
    onDateFromChange ||
    onDateToChange;

  return (
    <section className={cx("finance-filters", compact ? "compact" : "")}>
      <div className="finance-filters-primary">
        {typeof onSearchChange === "function" ? (
          <label className="finance-search-field">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </label>
        ) : null}

        {showPeriod && typeof onPeriodChange === "function" ? (
          <label className="finance-filter-control">
            <span>Period</span>
            <select
              value={period}
              onChange={(event) => onPeriodChange(event.target.value)}
            >
              {periodOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {collapsible ? (
          <button
            type="button"
            className={cx("finance-btn ghost", expanded ? "active" : "")}
            onClick={() => setExpanded((prev) => !prev)}
          >
            <SlidersHorizontal size={16} />
            Filters
            {activeCount ? (
              <span className="finance-filter-count">{activeCount}</span>
            ) : null}
          </button>
        ) : null}

        <div className="finance-filter-actions">
          {onRefresh ? (
            <button
              type="button"
              className="finance-btn ghost"
              onClick={onRefresh}
              disabled={refreshDisabled}
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
          ) : null}

          {onExport ? (
            <button
              type="button"
              className="finance-btn ghost"
              onClick={onExport}
              disabled={exportDisabled}
            >
              <Download size={16} />
              Export
            </button>
          ) : null}

          {onClear ? (
            <button
              type="button"
              className="finance-btn ghost"
              onClick={onClear}
              disabled={!activeCount}
            >
              <X size={16} />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {expanded || !collapsible ? (
        <div className="finance-filters-secondary">
          {showCustomDates ? (
            <div className="finance-date-filter-group">
              <CalendarDays size={16} />
              <label>
                From
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => onDateFromChange?.(event.target.value)}
                />
              </label>

              <label>
                To
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => onDateToChange?.(event.target.value)}
                />
              </label>
            </div>
          ) : null}

          {filters.map((filter) => renderFilter(filter, values, onFilterChange))}

          {children}
        </div>
      ) : null}
    </section>
  );
}

export { PERIOD_OPTIONS };