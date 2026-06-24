import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Filter,
  PieChart,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const REPORT_TYPES = [
  { value: "executive_summary", label: "Executive Summary" },
  { value: "payments", label: "Payments" },
  { value: "membership", label: "Membership Revenue" },
  { value: "donations", label: "Donations" },
  { value: "pledges", label: "Pledges" },
  { value: "invoices", label: "Invoices" },
  { value: "receipts", label: "Receipts" },
  { value: "programs", label: "School / Trip Programs" },
  { value: "restricted_funds", label: "Restricted Funds" },
  { value: "reconciliation", label: "Reconciliation" },
  { value: "audit", label: "Audit Trail" },
];

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom" },
  { value: "all", label: "All Time" },
];

const EXPORT_FORMATS = [
  { value: "pdf", label: "PDF", icon: FileText },
  { value: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { value: "csv", label: "CSV", icon: FileSpreadsheet },
  { value: "json", label: "JSON", icon: FileJson },
];

const METHOD_OPTIONS = [
  { value: "", label: "All Methods" },
  { value: "card", label: "Card" },
  { value: "ach", label: "ACH" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
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

function monthStartIso() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function quarterStartIso() {
  const date = new Date();
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
  date.setMonth(quarterMonth, 1);
  return date.toISOString().slice(0, 10);
}

function yearStartIso() {
  const date = new Date();
  date.setMonth(0, 1);
  return date.toISOString().slice(0, 10);
}

function periodDates(period) {
  if (period === "today") {
    return { from: todayIso(), to: todayIso() };
  }

  if (period === "month") {
    return { from: monthStartIso(), to: todayIso() };
  }

  if (period === "quarter") {
    return { from: quarterStartIso(), to: todayIso() };
  }

  if (period === "year") {
    return { from: yearStartIso(), to: todayIso() };
  }

  if (period === "all") {
    return { from: "", to: "" };
  }

  return { from: monthStartIso(), to: todayIso() };
}

function formatDate(value) {
  if (!value) return "--";

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) return `${match[2]}/${match[3]}/${match[1]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function responseData(response) {
  return response?.data || response || {};
}

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.report_rows)) return data.report_rows;
  if (Array.isArray(data.payments)) return data.payments;
  if (Array.isArray(data.invoices)) return data.invoices;
  if (Array.isArray(data.receipts)) return data.receipts;
  if (Array.isArray(data.pledges)) return data.pledges;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function breakdownFrom(data, keys = []) {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  if (Array.isArray(data?.breakdown)) return data.breakdown;
  if (Array.isArray(data?.breakdowns)) return data.breakdowns;
  return [];
}

function summaryFrom(data, rows) {
  const source =
    data.summary ||
    data.totals ||
    data.kpis ||
    data.dashboard?.summary ||
    data.dashboard ||
    {};

  return {
    revenue: numberValue(
      source.revenue ||
        source.total_revenue ||
        source.total_amount ||
        rows.reduce((sum, row) => sum + numberValue(row.amount || row.total_amount), 0)
    ),
    payments: numberValue(source.payments || source.payment_count || source.transactions),
    invoices: numberValue(source.invoices || source.invoice_count),
    receipts: numberValue(source.receipts || source.receipt_count),
    pledges: numberValue(source.pledges || source.pledge_count),
    outstanding_invoices: numberValue(
      source.outstanding_invoices || source.invoice_balance || source.balance_due
    ),
    outstanding_pledges: numberValue(
      source.outstanding_pledges || source.pledge_balance || source.remaining_pledges
    ),
    cash: numberValue(source.cash || source.cash_total),
    check: numberValue(source.check || source.check_total),
    zelle: numberValue(source.zelle || source.zelle_total),
    card: numberValue(source.card || source.card_total),
    ach: numberValue(source.ach || source.ach_total),
  };
}

function rowLabel(row) {
  return clean(
    row.label ||
      row.name ||
      row.category ||
      row.report_category ||
      row.payment_type ||
      row.status ||
      row.month ||
      row.date
  );
}

function rowAmount(row) {
  return numberValue(
    row.amount ||
      row.total_amount ||
      row.revenue ||
      row.paid_amount ||
      row.balance_due ||
      row.remaining_amount
  );
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function exportCsv(rows, filename) {
  const headers = [
    "Label",
    "Category",
    "Status",
    "Count",
    "Amount",
    "Paid",
    "Balance",
    "Method",
    "Date",
  ];

  const body = rows.map((row) => [
    rowLabel(row),
    pretty(row.category || row.payment_type || row.type),
    pretty(row.status || row.invoice_status || row.payment_status),
    numberValue(row.count || row.records || row.transactions),
    rowAmount(row).toFixed(2),
    numberValue(row.paid_amount || row.total_paid).toFixed(2),
    numberValue(row.balance_due || row.remaining_amount).toFixed(2),
    pretty(row.method || row.payment_method),
    formatDate(row.date || row.created_at || row.paid_at),
  ]);

  const csv = [headers, ...body]
    .map((line) => line.map(csvEscape).join(","))
    .join("\n");

  downloadBlob(
    new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    }),
    filename
  );
}

function exportJson(payload, filename) {
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8;",
    }),
    filename
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

  throw lastError || new Error("Treasury report endpoint is not available.");
}

async function postFirst(paths, payload = {}, config = {}) {
  let lastError = null;

  for (const path of paths.filter(Boolean)) {
    try {
      const response = await api.post(path, payload, config);

      return {
        endpoint: path,
        response,
        data: responseData(response),
      };
    } catch (err) {
      lastError = err;

      if ([404, 405].includes(err?.response?.status)) continue;

      throw err;
    }
  }

  throw lastError || new Error("Treasury export endpoint is not available.");
}

function BarRow({ label, amount, max }) {
  const width = max > 0 ? Math.min(100, Math.max(0, (numberValue(amount) / max) * 100)) : 0;

  return (
    <div className="finance-bar-row">
      <div>
        <span>{label}</span>
        <strong>{money(amount)}</strong>
      </div>

      <div className="finance-bar-track">
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function FinanceTreasuryReportsPanel({
  compact = false,
  defaultReportType = "executive_summary",
  initialFilters = {},
  onGenerated,
  onExported,
}) {
  const initialDates = periodDates(initialFilters.period || "month");

  const [filters, setFilters] = useState({
    report_type: defaultReportType,
    period: "month",
    from: initialDates.from,
    to: initialDates.to,
    method: "",
    category: "",
    status: "",
    search: "",
    ...initialFilters,
  });

  const [summary, setSummary] = useState(summaryFrom({}, []));
  const [rows, setRows] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [methodBreakdown, setMethodBreakdown] = useState([]);
  const [trendRows, setTrendRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyExport, setBusyExport] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const visibleRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    if (!search) return rows;

    return rows.filter((row) => {
      const haystack = [
        rowLabel(row),
        row.category,
        row.payment_type,
        row.status,
        row.method,
        row.payment_method,
        row.member_no,
        row.full_name,
        row.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [rows, filters.search]);

  const maxCategoryAmount = useMemo(
    () =>
      Math.max(
        0,
        ...categoryBreakdown.map((row) =>
          numberValue(row.amount || row.total_amount || row.revenue)
        )
      ),
    [categoryBreakdown]
  );

  const maxMethodAmount = useMemo(
    () =>
      Math.max(
        0,
        ...methodBreakdown.map((row) =>
          numberValue(row.amount || row.total_amount || row.revenue)
        )
      ),
    [methodBreakdown]
  );

  async function loadReport() {
    setLoading(true);
    setError("");
    setSuccess("");

    const params = {
      report_type: filters.report_type,
      type: filters.report_type,
      period: filters.period,
      from: filters.from,
      to: filters.to,
      date_from: filters.from,
      date_to: filters.to,
      method: filters.method,
      category: filters.category,
      status: filters.status,
      limit: compact ? 25 : 250,
    };

    try {
      const result = await getFirst(
        [
          "/finance/reports/treasury",
          "/finance/reports/executive",
          "/finance/reports/dashboard",
          "/finance/reports",
          "/finance/dashboard",
        ],
        { params }
      );

      const data = result.data?.dashboard || result.data;
      const nextRows = rowsFrom(data);

      setRows(nextRows);
      setSummary(summaryFrom(data, nextRows));
      setCategoryBreakdown(
        breakdownFrom(data, [
          "revenue_by_category",
          "category_breakdown",
          "categories",
          "report_revenue_by_category",
        ])
      );
      setMethodBreakdown(
        breakdownFrom(data, [
          "payment_methods",
          "revenue_by_method",
          "method_breakdown",
          "report_payment_methods",
        ])
      );
      setTrendRows(
        breakdownFrom(data, [
          "monthly_revenue",
          "daily_revenue",
          "trends",
          "revenue_trend",
        ])
      );

      setSuccess("Treasury report refreshed.");

      onGenerated?.({
        endpoint: result.endpoint,
        data,
        rows: nextRows,
      });
    } catch (err) {
      setRows([]);
      setSummary(summaryFrom({}, []));
      setCategoryBreakdown([]);
      setMethodBreakdown([]);
      setTrendRows([]);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load treasury report."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      if (key === "period") {
        const dates = periodDates(value);
        next.from = dates.from;
        next.to = dates.to;
      }

      if ((key === "from" || key === "to") && value) {
        next.period = "custom";
      }

      return next;
    });
  }

  function exportPayload(format) {
    return {
      report_type: filters.report_type,
      type: filters.report_type,
      format,
      period: filters.period,
      from: filters.from,
      to: filters.to,
      date_from: filters.from,
      date_to: filters.to,
      method: filters.method,
      category: filters.category,
      status: filters.status,
      summary,
      rows: visibleRows,
      category_breakdown: categoryBreakdown,
      method_breakdown: methodBreakdown,
      trends: trendRows,
      source: "finance_treasury_reports_panel",
    };
  }

  async function handleExport(format) {
    const filename = `treasury-${filters.report_type}-${filters.from || "all"}-${filters.to || "all"}.${format}`;

    setBusyExport(format);
    setError("");
    setSuccess("");

    try {
      if (format === "csv") {
        exportCsv(visibleRows, filename);
        setSuccess("CSV report exported.");
        onExported?.({ format, rows: visibleRows.length });
        return;
      }

      if (format === "json") {
        exportJson(exportPayload(format), filename);
        setSuccess("JSON report exported.");
        onExported?.({ format, rows: visibleRows.length });
        return;
      }

      const result = await postFirst(
        [
          "/finance/reports/treasury/export",
          "/finance/reports/export",
          `/finance/reports/${filters.report_type}/export`,
          "/finance/reports/pdf",
        ],
        exportPayload(format),
        {
          responseType: "blob",
        }
      );

      const blob =
        result.response?.data instanceof Blob
          ? result.response.data
          : new Blob([result.response?.data], {
              type:
                format === "pdf"
                  ? "application/pdf"
                  : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });

      downloadBlob(blob, filename);
      setSuccess(`${format.toUpperCase()} report exported.`);

      onExported?.({
        endpoint: result.endpoint,
        format,
        rows: visibleRows.length,
      });
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          `Failed to export ${format.toUpperCase()} report.`
      );
    } finally {
      setBusyExport("");
    }
  }

  return (
    <section className={`finance-panel ${compact ? "compact" : ""}`}>
      <div className="finance-page-head">
        <div>
          <span className="finance-kicker">Treasury Reports</span>
          <h1>Enterprise Treasury Reporting</h1>
          <p>
            Generate executive finance reports for revenue, payments, invoices,
            receipts, pledges, programs, restricted funds, and audit review.
          </p>
        </div>

        <div className="finance-page-actions">
          {EXPORT_FORMATS.map((format) => {
            const Icon = format.icon;

            return (
              <button
                key={format.value}
                type="button"
                className="finance-btn"
                onClick={() => handleExport(format.value)}
                disabled={Boolean(busyExport)}
              >
                <Icon size={16} />
                {busyExport === format.value ? "Exporting..." : format.label}
              </button>
            );
          })}

          <button
            type="button"
            className="finance-btn"
            onClick={() => window.print()}
          >
            <Printer size={16} />
            Print
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={loadReport}
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
          <span>Total Revenue</span>
          <strong>{money(summary.revenue)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Payments</span>
          <strong>{summary.payments}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Invoices</span>
          <strong>{summary.invoices}</strong>
          <small>Open {money(summary.outstanding_invoices)}</small>
        </div>

        <div className="finance-summary-card">
          <span>Receipts</span>
          <strong>{summary.receipts}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Pledges</span>
          <strong>{summary.pledges}</strong>
          <small>Open {money(summary.outstanding_pledges)}</small>
        </div>

        <div className="finance-summary-card">
          <span>Card / ACH</span>
          <strong>{money(summary.card + summary.ach)}</strong>
        </div>
      </div>

      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <Filter size={16} />

          <label>
            Report
            <select
              value={filters.report_type}
              onChange={(event) => updateFilter("report_type", event.target.value)}
            >
              {REPORT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Period
            <select
              value={filters.period}
              onChange={(event) => updateFilter("period", event.target.value)}
            >
              {PERIOD_OPTIONS.map((option) => (
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

          <label>
            Method
            <select
              value={filters.method}
              onChange={(event) => updateFilter("method", event.target.value)}
            >
              {METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="finance-btn primary"
            onClick={loadReport}
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
            placeholder="Search report rows..."
          />
        </div>
      </div>

      <div className="finance-grid two">
        <div className="finance-section">
          <div className="finance-section-title">
            <PieChart size={18} />
            <h3>Revenue by Category</h3>
          </div>

          {!categoryBreakdown.length ? (
            <div className="finance-audit-empty">
              No category breakdown available.
            </div>
          ) : (
            <div className="finance-bar-list">
              {categoryBreakdown.map((row, index) => (
                <BarRow
                  key={row.category || row.label || index}
                  label={pretty(row.category || row.label || row.name)}
                  amount={row.amount || row.total_amount || row.revenue}
                  max={maxCategoryAmount}
                />
              ))}
            </div>
          )}
        </div>

        <div className="finance-section">
          <div className="finance-section-title">
            <BarChart3 size={18} />
            <h3>Payment Methods</h3>
          </div>

          {!methodBreakdown.length ? (
            <div className="finance-audit-empty">
              No payment method breakdown available.
            </div>
          ) : (
            <div className="finance-bar-list">
              {methodBreakdown.map((row, index) => (
                <BarRow
                  key={row.method || row.label || index}
                  label={pretty(row.method || row.payment_method || row.label)}
                  amount={row.amount || row.total_amount || row.revenue}
                  max={maxMethodAmount}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="finance-section">
        <div className="finance-section-title">
          <TrendingUp size={18} />
          <h3>Report Rows</h3>
        </div>

        <div className="finance-table-shell">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Category</th>
                <th>Status</th>
                <th className="text-right">Count</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Balance</th>
                <th>Method</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9}>
                    <div className="finance-audit-empty">
                      Loading treasury report...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && !visibleRows.length ? (
                <tr>
                  <td colSpan={9}>
                    <div className="finance-audit-empty">
                      No report rows found for this filter.
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading &&
                visibleRows.map((row, index) => (
                  <tr key={row.id || row.label || row.category || index}>
                    <td>{rowLabel(row)}</td>
                    <td>{pretty(row.category || row.payment_type || row.type)}</td>
                    <td>{pretty(row.status || row.invoice_status || row.payment_status)}</td>
                    <td className="text-right">
                      <strong>
                        {numberValue(row.count || row.records || row.transactions)}
                      </strong>
                    </td>
                    <td className="text-right">
                      <strong>{money(rowAmount(row))}</strong>
                    </td>
                    <td className="text-right">
                      <strong>{money(row.paid_amount || row.total_paid)}</strong>
                    </td>
                    <td className="text-right">
                      <strong>{money(row.balance_due || row.remaining_amount)}</strong>
                    </td>
                    <td>{pretty(row.method || row.payment_method)}</td>
                    <td>{formatDate(row.date || row.created_at || row.paid_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="finance-audit-empty">
        <ShieldCheck size={15} />
        Treasury reports should reconcile with payments, invoices, receipts,
        pledge schedules, membership coverage, restricted funds, and audit logs.
      </div>
    </section>
  );
}