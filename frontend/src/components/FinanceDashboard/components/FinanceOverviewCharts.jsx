import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  LineChart,
  PieChart,
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const RANGE_OPTIONS = [
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "90 Days" },
  { value: "365", label: "Year" },
];

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numberValue(value));
}

function clean(value, fallback = "--") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function pretty(value) {
  return clean(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days) {
  const date = new Date();
  date.setDate(date.getDate() - Number(days || 30));
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "--";

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) return `${match[2]}/${match[3]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}

function responseData(response) {
  return response?.data || response || {};
}

function rowsFrom(source, keys = []) {
  for (const key of keys) {
    if (Array.isArray(source?.[key])) return source[key];
  }

  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.rows)) return source.rows;
  if (Array.isArray(source?.data)) return source.data;
  return [];
}

function dashboardFrom(data) {
  return data.dashboard || data.data?.dashboard || data.data || data || {};
}

function breakdownsFrom(dashboard) {
  const breakdowns = dashboard.breakdowns || dashboard || {};

  return {
    categories: rowsFrom(breakdowns, [
      "revenue_by_category",
      "report_revenue_by_category",
      "category_breakdown",
      "categories",
    ]),
    methods: rowsFrom(breakdowns, [
      "payment_methods",
      "revenue_by_method",
      "method_breakdown",
      "report_payment_methods",
    ]),
    programs: rowsFrom(breakdowns, [
      "program_revenue",
      "revenue_by_program",
      "programs",
      "report_program_revenue",
    ]),
  };
}

function trendsFrom(dashboard) {
  const trends = dashboard.trends || dashboard || {};

  return {
    daily: rowsFrom(trends, ["daily_revenue", "daily", "days"]),
    monthly: rowsFrom(trends, ["monthly_revenue", "monthly", "months"]),
  };
}

function summaryFrom(dashboard) {
  const summary = dashboard.summary || dashboard.kpis || dashboard.cards || {};
  const revenue = summary.revenue || dashboard.revenue || {};
  const invoices = summary.invoices || dashboard.invoices || {};
  const pledges = summary.pledges || dashboard.pledges || {};
  const members = summary.members || dashboard.members || {};

  return {
    today: numberValue(revenue.today || revenue.today_revenue),
    month: numberValue(revenue.month || revenue.month_revenue),
    year: numberValue(revenue.year || revenue.year_revenue),
    total: numberValue(revenue.total || revenue.total_revenue),
    outstanding_invoices: numberValue(
      invoices.outstanding || invoices.outstanding_amount || invoices.balance_due
    ),
    outstanding_pledges: numberValue(
      pledges.outstanding || pledges.outstanding_amount || pledges.remaining_amount
    ),
    active_members: numberValue(members.active || members.active_count),
    unpaid_members: numberValue(members.unpaid || members.unpaid_count),
  };
}

function amountFrom(row) {
  return numberValue(
    row.amount ||
      row.total_amount ||
      row.revenue ||
      row.total ||
      row.value ||
      row.raised_amount
  );
}

function countFrom(row) {
  return numberValue(row.count || row.records || row.transactions || row.total_count);
}

function labelFrom(row) {
  return clean(
    row.label ||
      row.name ||
      row.category ||
      row.method ||
      row.payment_method ||
      row.month ||
      row.day ||
      row.date
  );
}

async function getFirst(paths, config = {}) {
  let lastError = null;

  for (const path of paths.filter(Boolean)) {
    try {
      const response = await api.get(path, config);

      return {
        endpoint: path,
        data: responseData(response),
      };
    } catch (err) {
      lastError = err;

      if ([404, 405].includes(err?.response?.status)) continue;

      throw err;
    }
  }

  throw lastError || new Error("Finance chart endpoint is not available.");
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportCsv(data, filename) {
  const rows = [
    ["Section", "Label", "Amount", "Count"],
    ...data.categories.map((row) => [
      "Category",
      labelFrom(row),
      amountFrom(row).toFixed(2),
      countFrom(row),
    ]),
    ...data.methods.map((row) => [
      "Method",
      labelFrom(row),
      amountFrom(row).toFixed(2),
      countFrom(row),
    ]),
    ...data.daily.map((row) => [
      "Daily Trend",
      labelFrom(row),
      amountFrom(row).toFixed(2),
      countFrom(row),
    ]),
    ...data.monthly.map((row) => [
      "Monthly Trend",
      labelFrom(row),
      amountFrom(row).toFixed(2),
      countFrom(row),
    ]),
    ...data.programs.map((row) => [
      "Program",
      labelFrom(row),
      amountFrom(row).toFixed(2),
      countFrom(row),
    ]),
  ];

  const csv = rows.map((line) => line.map(csvEscape).join(",")).join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function BarRow({ label, amount, count, max, tone = "primary" }) {
  const width = max > 0 ? Math.min(100, Math.max(0, (amount / max) * 100)) : 0;

  return (
    <div className="finance-bar-row">
      <div>
        <span>{label}</span>
        <strong>{money(amount)}</strong>
        {count ? <small>{count} record(s)</small> : null}
      </div>

      <div className={`finance-bar-track ${tone}`}>
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function MiniTrend({ rows, title }) {
  const max = Math.max(0, ...rows.map(amountFrom));

  return (
    <div className="finance-mini-trend">
      <div className="finance-mini-trend-head">
        <strong>{title}</strong>
        <span>{rows.length} point(s)</span>
      </div>

      <div className="finance-mini-bars">
        {rows.map((row, index) => {
          const amount = amountFrom(row);
          const height = max > 0 ? Math.max(8, (amount / max) * 100) : 8;

          return (
            <div
              key={row.day || row.month || row.date || index}
              className="finance-mini-bar"
              title={`${labelFrom(row)}: ${money(amount)}`}
            >
              <span style={{ height: `${height}%` }} />
              <small>{formatDate(row.day || row.month || row.date)}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FinanceOverviewCharts({
  dashboardData = null,
  compact = false,
  autoLoad = true,
  onLoaded,
}) {
  const [filters, setFilters] = useState({
    days: "30",
    from: daysAgoIso(30),
    to: todayIso(),
    search: "",
  });

  const [dashboard, setDashboard] = useState(dashboardData || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const breakdowns = useMemo(() => breakdownsFrom(dashboard), [dashboard]);
  const trends = useMemo(() => trendsFrom(dashboard), [dashboard]);
  const summary = useMemo(() => summaryFrom(dashboard), [dashboard]);

  const chartData = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    function filterRows(rows) {
      if (!search) return rows;

      return rows.filter((row) => {
        return [labelFrom(row), row.category, row.method, row.payment_method, row.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search);
      });
    }

    return {
      categories: filterRows(breakdowns.categories),
      methods: filterRows(breakdowns.methods),
      programs: filterRows(breakdowns.programs),
      daily: filterRows(trends.daily),
      monthly: filterRows(trends.monthly),
    };
  }, [breakdowns, trends, filters.search]);

  const maxCategory = useMemo(
    () => Math.max(0, ...chartData.categories.map(amountFrom)),
    [chartData.categories]
  );

  const maxMethod = useMemo(
    () => Math.max(0, ...chartData.methods.map(amountFrom)),
    [chartData.methods]
  );

  const maxProgram = useMemo(
    () => Math.max(0, ...chartData.programs.map(amountFrom)),
    [chartData.programs]
  );

  async function loadCharts() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await getFirst(
        [
          "/finance/dashboard",
          "/finance/dashboard/trends",
          "/finance/reports/dashboard",
          "/finance/reports/treasury",
        ],
        {
          params: {
            days: filters.days,
            from: filters.from,
            to: filters.to,
            date_from: filters.from,
            date_to: filters.to,
          },
        }
      );

      const nextDashboard = dashboardFrom(result.data);

      setDashboard(nextDashboard);
      setSuccess("Finance charts refreshed.");
      onLoaded?.({
        endpoint: result.endpoint,
        dashboard: nextDashboard,
      });
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load finance overview charts."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (dashboardData) {
      setDashboard(dashboardData);
      return;
    }

    if (autoLoad) {
      loadCharts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardData, autoLoad]);

  function updateFilter(key, value) {
    setFilters((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      if (key === "days") {
        next.from = daysAgoIso(value);
        next.to = todayIso();
      }

      return next;
    });
  }

  return (
    <section className={`finance-panel ${compact ? "compact" : ""}`}>
      <div className="finance-page-head">
        <div>
          <span className="finance-kicker">Finance Analytics</span>
          <h1>Overview Charts</h1>
          <p>
            Revenue movement, payment method mix, category performance, program
            revenue, and outstanding finance workload.
          </p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn"
            onClick={() =>
              exportCsv(
                chartData,
                `finance-overview-charts-${filters.from || "all"}-${filters.to || "all"}.csv`
              )
            }
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={loadCharts}
            disabled={loading}
          >
            <RefreshCcw size={16} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="finance-alert danger">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="finance-alert success">
          <CheckCircle2 size={17} />
          <span>{success}</span>
        </div>
      ) : null}

      <div className="finance-summary-grid compact">
        <div className="finance-summary-card">
          <span>Today</span>
          <strong>{money(summary.today)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Month</span>
          <strong>{money(summary.month)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Year</span>
          <strong>{money(summary.year)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Open Invoices</span>
          <strong>{money(summary.outstanding_invoices)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Open Pledges</span>
          <strong>{money(summary.outstanding_pledges)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Unpaid Members</span>
          <strong>{summary.unpaid_members}</strong>
        </div>
      </div>

      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <CalendarDays size={16} />

          <label>
            Range
            <select
              value={filters.days}
              onChange={(event) => updateFilter("days", event.target.value)}
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            From
            <input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
            />
          </label>

          <label>
            To
            <input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
            />
          </label>

          <button
            type="button"
            className="finance-btn primary"
            onClick={loadCharts}
            disabled={loading}
          >
            Apply
          </button>
        </div>

        <div className="finance-search">
          <Search size={16} />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search chart labels..."
          />
        </div>
      </div>

      <div className="finance-grid two">
        <div className="finance-section">
          <div className="finance-section-title">
            <PieChart size={18} />
            <h3>Revenue by Category</h3>
          </div>

          {!chartData.categories.length ? (
            <div className="finance-audit-empty">No category data available.</div>
          ) : (
            <div className="finance-bar-list">
              {chartData.categories.map((row, index) => (
                <BarRow
                  key={row.category || row.label || index}
                  label={pretty(labelFrom(row))}
                  amount={amountFrom(row)}
                  count={countFrom(row)}
                  max={maxCategory}
                />
              ))}
            </div>
          )}
        </div>

        <div className="finance-section">
          <div className="finance-section-title">
            <BarChart3 size={18} />
            <h3>Payment Method Mix</h3>
          </div>

          {!chartData.methods.length ? (
            <div className="finance-audit-empty">No payment method data available.</div>
          ) : (
            <div className="finance-bar-list">
              {chartData.methods.map((row, index) => (
                <BarRow
                  key={row.method || row.payment_method || row.label || index}
                  label={pretty(labelFrom(row))}
                  amount={amountFrom(row)}
                  count={countFrom(row)}
                  max={maxMethod}
                  tone="success"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="finance-grid two">
        <div className="finance-section">
          <div className="finance-section-title">
            <LineChart size={18} />
            <h3>Daily Revenue Trend</h3>
          </div>

          {!chartData.daily.length ? (
            <div className="finance-audit-empty">No daily trend available.</div>
          ) : (
            <MiniTrend rows={chartData.daily} title="Daily Revenue" />
          )}
        </div>

        <div className="finance-section">
          <div className="finance-section-title">
            <TrendingUp size={18} />
            <h3>Monthly Revenue Trend</h3>
          </div>

          {!chartData.monthly.length ? (
            <div className="finance-audit-empty">No monthly trend available.</div>
          ) : (
            <MiniTrend rows={chartData.monthly} title="Monthly Revenue" />
          )}
        </div>
      </div>

      <div className="finance-section">
        <div className="finance-section-title">
          <BarChart3 size={18} />
          <h3>Program Revenue</h3>
        </div>

        {!chartData.programs.length ? (
          <div className="finance-audit-empty">No program revenue data available.</div>
        ) : (
          <div className="finance-bar-list">
            {chartData.programs.map((row, index) => (
              <BarRow
                key={row.program_name || row.category || row.label || index}
                label={pretty(labelFrom(row))}
                amount={amountFrom(row)}
                count={countFrom(row)}
                max={maxProgram}
              />
            ))}
          </div>
        )}
      </div>

      <div className="finance-audit-empty">
        <ShieldCheck size={15} />
        Overview charts summarize posted finance activity. Reconcile with
        payments, invoices, receipts, pledges, membership coverage, and ledger
        reports before month-end close.
      </div>
    </section>
  );
}