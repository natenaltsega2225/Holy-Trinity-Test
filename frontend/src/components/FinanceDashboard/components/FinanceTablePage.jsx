// frontend/src/components/FinanceDashboard/components/FinanceTablePage.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCcw,
  Search,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

function clean(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value) {
  if (!value) return "--";

  const raw = clean(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) return `${match[2]}/${match[3]}/${match[1]}`;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return raw;

  return d.toLocaleDateString("en-US");
}

function pretty(value) {
  const text = clean(value);
  if (!text) return "--";

  return text
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status) {
  const value = clean(status).toLowerCase();

  if (["paid", "active", "approved", "completed", "posted", "verified", "sent"].includes(value)) {
    return "success";
  }

  if (["failed", "inactive", "cancelled", "void", "rejected", "overdue"].includes(value)) {
    return "danger";
  }

  if (["pending", "draft", "partial", "processing", "received", "open"].includes(value)) {
    return "warning";
  }

  return "neutral";
}

function FinanceStatusBadge({ status }) {
  return (
    <span className={`finance-status-badge ${statusTone(status)}`}>
      {pretty(status)}
    </span>
  );
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.rows,
    payload?.data,
    payload?.items,
    payload?.results,
    payload?.records,
    payload?.payments,
    payload?.receipts,
    payload?.invoices,
    payload?.data?.rows,
    payload?.data?.items,
    payload?.data?.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function normalizeMeta(payload, rows, page, limit) {
  const meta =
    payload?.meta ||
    payload?.pagination ||
    payload?.data?.meta ||
    payload?.data?.pagination ||
    {};

  const total = Number(
    meta.total ||
      meta.totalRows ||
      meta.total_records ||
      payload?.total ||
      payload?.count ||
      rows.length
  );

  const currentPage = Number(meta.page || meta.current_page || page);
  const pageSize = Number(meta.limit || meta.pageSize || meta.page_size || limit);
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  return {
    total,
    page: currentPage,
    limit: pageSize,
    totalPages,
  };
}

function valueFor(row, column) {
  if (typeof column.accessor === "function") return column.accessor(row);
  return row?.[column.key];
}

function exportCsv(rows, columns, title = "finance-export") {
  const visibleColumns = columns.filter((column) => column.export !== false);

  const headers = visibleColumns.map((column) => column.label || column.key);

  const lines = rows.map((row) =>
    visibleColumns
      .map((column) => {
        const value = valueFor(row, column);

        if (column.money) return formatMoney(value);
        if (column.date) return formatDate(value);
        if (column.status) return pretty(value);

        return clean(value);
      })
      .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
      .join(",")
  );

  const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${new Date().toISOString().slice(0, 10)}.csv`;

  a.click();
  URL.revokeObjectURL(url);
}

function buildActionPayload(action, row) {
  if (!action) return {};

  if (typeof action.payload === "function") return action.payload(row);
  if (action.payload && typeof action.payload === "object") return action.payload;

  return {};
}

function buildEndpoint(action, row) {
  if (!action) return "";

  if (typeof action.endpoint === "function") return action.endpoint(row);
  return action.endpoint || "";
}

async function runActionRequest(action, row) {
  const endpoint = buildEndpoint(action, row);
  const method = clean(action.method || "post").toLowerCase();
  const payload = buildActionPayload(action, row);

  if (!endpoint) {
    throw new Error("Action endpoint is missing.");
  }

  if (method === "get") return api.get(endpoint, { params: payload });
  if (method === "patch") return api.patch(endpoint, payload);
  if (method === "put") return api.put(endpoint, payload);
  if (method === "delete") return api.delete(endpoint, { data: payload });

  return api.post(endpoint, payload);
}

export default function FinanceTablePage({
  title,
  subtitle,
  endpoint,
  columns = [],
  extraFilters = [],
  actions = [],
  rowActions = [],
  topContent = null,

  pageSize = 25,
  defaultPeriod = "all",
  showPeriodFilter = true,
  searchPlaceholder = "Search records...",
  emptyText = "No records found.",
  exportFileName,

  transformRows,
  transformPayload,
  buildParams,
}) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: pageSize,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState(defaultPeriod || "all");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filterParams = useMemo(() => {
    const params = {
      q: search,
      search,
      period,
      page,
      limit: pageSize,
      pageSize,
    };

    for (const filter of extraFilters) {
      if (!filter?.key) continue;

      params[filter.key] = filter.value ?? "";
    }

    if (typeof buildParams === "function") {
      return {
        ...params,
        ...buildParams({
          search,
          period,
          page,
          pageSize,
          extraFilters,
        }),
      };
    }

    return params;
  }, [search, period, page, pageSize, extraFilters, buildParams]);

  const loadRows = useCallback(async () => {
    if (!endpoint) return;

    setLoading(true);
    setError("");

    try {
      const response = await api.get(endpoint, {
        params: filterParams,
      });

      const payload =
        typeof transformPayload === "function"
          ? transformPayload(response.data)
          : response.data;

      let nextRows = normalizeRows(payload);

      if (typeof transformRows === "function") {
        nextRows = transformRows(nextRows, payload);
      }

      setRows(nextRows);
      setMeta(normalizeMeta(payload, nextRows, page, pageSize));
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load finance records."
      );
    } finally {
      setLoading(false);
    }
  }, [endpoint, filterParams, page, pageSize, transformPayload, transformRows]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const helpers = useMemo(
    () => ({
      formatMoney,
      formatDate,
      pretty,
      FinanceStatusBadge,
      refresh: loadRows,
    }),
    [loadRows]
  );

  const localFilteredRows = useMemo(() => {
    const q = clean(search).toLowerCase();

    if (!q) return rows;

    return rows.filter((row) => {
      const haystack = columns
        .map((column) => valueFor(row, column))
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, columns, search]);

  async function runRowAction(action, row, index) {
    if (typeof action.onClick === "function") {
      action.onClick(row, helpers);
      return;
    }

    const key = `${action.label || "action"}:${row?.id || index}`;

    setActionLoading(key);
    setError("");
    setSuccess("");

    try {
      await runActionRequest(action, row);

      setSuccess(action.successMessage || `${action.label || "Action"} completed.`);
      await loadRows();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          `${action.label || "Action"} failed.`
      );
    } finally {
      setActionLoading("");
    }
  }

  function resetFilters() {
    setSearch("");
    setPeriod(defaultPeriod || "all");
    setPage(1);

    extraFilters.forEach((filter) => {
      if (typeof filter.onChange === "function") {
        filter.onChange("");
      }
    });
  }

  return (
    <div className="finance-page">
      <div className="finance-page-header">
        <div>
          <p className="finance-eyebrow">Finance Dashboard</p>
          <h1>{title}</h1>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn ghost"
            onClick={loadRows}
            disabled={loading}
          >
            <RefreshCcw size={16} />
            Refresh
          </button>

          <button
            type="button"
            className="finance-btn ghost"
            onClick={() => exportCsv(localFilteredRows, columns, exportFileName || title)}
            disabled={!localFilteredRows.length}
          >
            <Download size={16} />
            Export
          </button>

          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`finance-btn ${action.variant || "primary"}`}
              onClick={() => action.onClick?.(helpers)}
              disabled={action.disabled}
            >
              {action.icon || null}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {topContent}

      {error ? (
        <div className="finance-alert danger">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="finance-alert success">
          <CheckCircle2 size={16} />
          {success}
        </div>
      ) : null}

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <span>Records</span>
          <strong>{meta.total || localFilteredRows.length}</strong>
          <small>Returned from current query</small>
        </div>

        <div className="finance-summary-card">
          <span>Visible Rows</span>
          <strong>{localFilteredRows.length}</strong>
          <small>Rows displayed on this page</small>
        </div>

        <div className="finance-summary-card">
          <span>Page</span>
          <strong>
            {meta.page} / {meta.totalPages}
          </strong>
          <small>Current pagination</small>
        </div>

        <div className="finance-summary-card">
          <span>Period</span>
          <strong>{pretty(period)}</strong>
          <small>Current date filter</small>
        </div>
      </div>

      <div className="finance-panel">
        <div className="finance-toolbar">
          <label className="finance-search-field">
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
            />
          </label>

          {showPeriodFilter ? (
            <select
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          ) : null}

          {extraFilters.map((filter) => {
            if (filter.hidden) return null;

            if (Array.isArray(filter.options)) {
              return (
                <select
                  key={filter.key}
                  value={filter.value ?? ""}
                  onChange={(event) => {
                    filter.onChange?.(event.target.value);
                    setPage(1);
                  }}
                >
                  {filter.options.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              );
            }

            const type =
              filter.type ||
              (filter.key?.toLowerCase().includes("date") ? "date" : "text");

            return (
              <input
                key={filter.key}
                type={type}
                value={filter.value ?? ""}
                placeholder={filter.label || filter.key}
                onChange={(event) => {
                  filter.onChange?.(event.target.value);
                  setPage(1);
                }}
              />
            );
          })}

          <button type="button" className="finance-btn ghost" onClick={resetFilters}>
            Clear
          </button>
        </div>

        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key || column.label}>{column.label || column.key}</th>
                ))}

                {rowActions.length ? (
                  <th className="finance-actions-col">Actions</th>
                ) : null}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length + (rowActions.length ? 1 : 0)}
                    className="finance-empty-cell"
                  >
                    Loading records...
                  </td>
                </tr>
              ) : null}

              {!loading && !localFilteredRows.length ? (
                <tr>
                  <td
                    colSpan={columns.length + (rowActions.length ? 1 : 0)}
                    className="finance-empty-cell"
                  >
                    {emptyText}
                  </td>
                </tr>
              ) : null}

              {!loading &&
                localFilteredRows.map((row, rowIndex) => (
                  <tr key={row.id || row.uuid || rowIndex}>
                    {columns.map((column) => {
                      const rawValue = valueFor(row, column);

                      let rendered = rawValue ?? "--";

                      if (typeof column.render === "function") {
                        rendered = column.render(rawValue, row, helpers);
                      } else if (column.money) {
                        rendered = formatMoney(rawValue);
                      } else if (column.date) {
                        rendered = formatDate(rawValue);
                      } else if (column.status) {
                        rendered = <FinanceStatusBadge status={rawValue} />;
                      }

                      return (
                        <td key={column.key || column.label}>
                          {rendered}
                        </td>
                      );
                    })}

                    {rowActions.length ? (
                      <td>
                        <div className="finance-row-actions">
                          {rowActions
                            .filter((action) =>
                              typeof action.visible === "function"
                                ? action.visible(row)
                                : action.visible !== false
                            )
                            .map((action) => {
                              const loadingKey = `${action.label || "action"}:${
                                row?.id || rowIndex
                              }`;

                              return (
                                <button
                                  key={action.label}
                                  type="button"
                                  className={`finance-mini-button ${
                                    action.variant || ""
                                  }`}
                                  disabled={
                                    Boolean(actionLoading) ||
                                    (typeof action.disabled === "function"
                                      ? action.disabled(row)
                                      : action.disabled)
                                  }
                                  onClick={() => runRowAction(action, row, rowIndex)}
                                >
                                  {action.icon || null}
                                  {actionLoading === loadingKey
                                    ? "Working..."
                                    : action.label}
                                </button>
                              );
                            })}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="finance-pagination-bar">
          <span>
            Showing page {meta.page} of {meta.totalPages}
          </span>

          <div className="finance-row-actions">
            <button
              type="button"
              className="finance-mini-button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              <ChevronLeft size={14} />
              Previous
            </button>

            <button
              type="button"
              className="finance-mini-button"
              disabled={page >= meta.totalPages || loading}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { FinanceStatusBadge, formatMoney, formatDate, pretty };