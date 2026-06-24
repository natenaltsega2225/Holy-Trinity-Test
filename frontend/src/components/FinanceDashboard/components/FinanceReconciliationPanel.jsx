import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Link2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Unlink,
  XCircle,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

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
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const raw = String(value);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[2]}/${match[3]}/${match[1]}` : raw;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function responseData(response) {
  return response?.data || response || {};
}

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.reconciliation_items)) return data.reconciliation_items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function summaryFrom(data, rows) {
  const source = data.summary || data.totals || data.dashboard || {};

  const totalAmount =
    source.total_amount ??
    source.amount ??
    rows.reduce((sum, row) => sum + numberValue(row.amount), 0);

  const matchedAmount =
    source.matched_amount ??
    rows
      .filter((row) => String(row.reconciliation_status || row.status || "").toLowerCase() === "matched")
      .reduce((sum, row) => sum + numberValue(row.amount), 0);

  const reconciledAmount =
    source.reconciled_amount ??
    rows
      .filter((row) => String(row.reconciliation_status || row.status || "").toLowerCase() === "reconciled")
      .reduce((sum, row) => sum + numberValue(row.amount), 0);

  const exceptionAmount =
    source.exception_amount ??
    rows
      .filter((row) =>
        ["exception", "unmatched", "failed", "returned"].includes(
          String(row.reconciliation_status || row.status || "").toLowerCase()
        )
      )
      .reduce((sum, row) => sum + numberValue(row.amount), 0);

  return {
    records: source.records ?? source.count ?? rows.length,
    total_amount: totalAmount,
    matched_amount: matchedAmount,
    reconciled_amount: reconciledAmount,
    exception_amount: exceptionAmount,
    matched_count:
      source.matched_count ??
      rows.filter((row) => String(row.reconciliation_status || row.status || "").toLowerCase() === "matched").length,
    reconciled_count:
      source.reconciled_count ??
      rows.filter((row) => String(row.reconciliation_status || row.status || "").toLowerCase() === "reconciled")
        .length,
    exception_count:
      source.exception_count ??
      rows.filter((row) =>
        ["exception", "unmatched", "failed", "returned"].includes(
          String(row.reconciliation_status || row.status || "").toLowerCase()
        )
      ).length,
  };
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

      if ([404, 405].includes(err?.response?.status)) {
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("Reconciliation endpoint is not available.");
}

async function postFirst(paths, payload = {}) {
  let lastError = null;

  for (const path of paths.filter(Boolean)) {
    try {
      const response = await api.post(path, payload);
      return {
        endpoint: path,
        data: responseData(response),
      };
    } catch (err) {
      lastError = err;

      if ([404, 405].includes(err?.response?.status)) {
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("Reconciliation action endpoint is not available.");
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();

  if (["reconciled", "matched", "cleared", "posted", "paid"].includes(status)) {
    return "success";
  }

  if (["pending", "review", "needs_review", "open"].includes(status)) {
    return "warning";
  }

  if (["exception", "unmatched", "failed", "returned", "void"].includes(status)) {
    return "danger";
  }

  return "neutral";
}

function itemId(row) {
  return row?.id || row?.reconciliation_item_id || row?.payment_id || row?.reference_no || "";
}

function itemPaymentNumber(row) {
  return clean(row?.payment_number || row?.payment_no || row?.transaction_number);
}

function itemReference(row) {
  return clean(
    row?.reference_no ||
      row?.reference_number ||
      row?.transaction_reference ||
      row?.stripe_payment_intent_id ||
      row?.check_number ||
      row?.zelle_reference
  );
}

export default function FinanceReconciliationPanel({
  title = "Reconciliation",
  subtitle = "Match bank activity, Stripe deposits, manual cash, check, Zelle, invoices, receipts, and ledger entries.",
  onOpenPayment,
  onOpenInvoice,
  onOpenReceipt,
}) {
  const [filters, setFilters] = useState({
    from: monthStartIso(),
    to: todayIso(),
    method: "",
    status: "",
    source: "",
    search: "",
  });

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(summaryFrom({}, []));
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedIds = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, checked]) => checked)
        .map(([id]) => id),
    [selected]
  );

  const selectedRows = useMemo(
    () => rows.filter((row) => selected[itemId(row)]),
    [rows, selected]
  );

  const selectedTotal = useMemo(
    () => selectedRows.reduce((sum, row) => sum + numberValue(row.amount), 0),
    [selectedRows]
  );

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    if (!search) return rows;

    return rows.filter((row) => {
      const haystack = [
        row.payment_number,
        row.invoice_number,
        row.receipt_number,
        row.member_no,
        row.full_name_snapshot,
        row.payer_name,
        row.email_snapshot,
        row.reference_no,
        row.transaction_reference,
        row.check_number,
        row.zelle_reference,
        row.method,
        row.status,
        row.reconciliation_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [rows, filters.search]);

  async function loadReconciliation() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const params = {
        from: filters.from,
        to: filters.to,
        date_from: filters.from,
        date_to: filters.to,
        method: filters.method,
        status: filters.status,
        source: filters.source,
        limit: 250,
      };

      const result = await getFirst(
        [
          "/finance/reconciliation/items",
          "/finance/reconciliations/items",
          "/finance/reconciliation",
          "/reconciliation/items",
          "/reconciliation",
        ],
        { params }
      );

      const data = result.data;
      const nextRows = rowsFrom(data);

      setRows(nextRows);
      setSummary(summaryFrom(data, nextRows));
      setSelected({});
    } catch (err) {
      setRows([]);
      setSummary(summaryFrom({}, []));
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load reconciliation records."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReconciliation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleAll(checked) {
    if (!checked) {
      setSelected({});
      return;
    }

    const next = {};

    filteredRows.forEach((row) => {
      const id = itemId(row);
      if (id) next[id] = true;
    });

    setSelected(next);
  }

  function toggleRow(row, checked) {
    const id = itemId(row);

    if (!id) return;

    setSelected((current) => ({
      ...current,
      [id]: checked,
    }));
  }

  async function runBulkAction(action) {
    if (!selectedIds.length) {
      setError("Select at least one reconciliation item.");
      return;
    }

    setBusyAction(action);
    setError("");
    setSuccess("");

    const payload = {
      action,
      item_ids: selectedIds,
      items: selectedRows,
      from: filters.from,
      to: filters.to,
      source: "finance_reconciliation_panel",
    };

    try {
      await postFirst(
        [
          `/finance/reconciliation/${action}`,
          `/finance/reconciliations/${action}`,
          `/reconciliation/${action}`,
          "/reconciliation/actions",
        ],
        payload
      );

      setSuccess(`${pretty(action)} completed for ${selectedIds.length} item(s).`);
      await loadReconciliation();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          `Failed to ${pretty(action).toLowerCase()}.`
      );
    } finally {
      setBusyAction("");
    }
  }

  async function runRowAction(row, action) {
    const id = itemId(row);

    if (!id) {
      setError("This row does not have an action id.");
      return;
    }

    setBusyAction(`${action}:${id}`);
    setError("");
    setSuccess("");

    try {
      await postFirst(
        [
          `/finance/reconciliation/items/${id}/${action}`,
          `/finance/reconciliations/items/${id}/${action}`,
          `/reconciliation/items/${id}/${action}`,
          `/reconciliation/${id}/${action}`,
        ],
        {
          id,
          item_id: id,
          payment_id: row.payment_id || null,
          invoice_id: row.invoice_id || null,
          receipt_id: row.receipt_id || null,
          reference_no: itemReference(row),
          source: "finance_reconciliation_panel",
        }
      );

      setSuccess(`${pretty(action)} completed.`);
      await loadReconciliation();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          `Failed to ${pretty(action).toLowerCase()}.`
      );
    } finally {
      setBusyAction("");
    }
  }

  function exportCsv() {
    const headers = [
      "Date",
      "Payment #",
      "Invoice #",
      "Receipt #",
      "Payer",
      "Method",
      "Reference",
      "Amount",
      "Status",
      "Reconciliation Status",
    ];

    const body = filteredRows.map((row) => [
      formatDate(row.paid_at || row.created_at || row.transaction_date),
      itemPaymentNumber(row),
      clean(row.invoice_number),
      clean(row.receipt_number),
      clean(row.full_name_snapshot || row.payer_name || row.donor_name),
      pretty(row.method || row.payment_method),
      itemReference(row),
      numberValue(row.amount).toFixed(2),
      pretty(row.status),
      pretty(row.reconciliation_status || row.match_status || row.status),
    ]);

    const csv = [headers, ...body]
      .map((line) =>
        line
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `finance-reconciliation-${filters.from || "all"}-${filters.to || "all"}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  const allVisibleSelected =
    filteredRows.length > 0 &&
    filteredRows.every((row) => selected[itemId(row)]);

  return (
    <section className="finance-panel">
      <div className="finance-page-head">
        <div>
          <span className="finance-kicker">Treasury Control</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn"
            onClick={exportCsv}
            disabled={!filteredRows.length}
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={loadReconciliation}
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
          <span>Records</span>
          <strong>{summary.records}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Total Amount</span>
          <strong>{money(summary.total_amount)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Matched</span>
          <strong>{money(summary.matched_amount)}</strong>
          <small>{summary.matched_count} item(s)</small>
        </div>

        <div className="finance-summary-card">
          <span>Reconciled</span>
          <strong>{money(summary.reconciled_amount)}</strong>
          <small>{summary.reconciled_count} item(s)</small>
        </div>

        <div className="finance-summary-card">
          <span>Exceptions</span>
          <strong>{money(summary.exception_amount)}</strong>
          <small>{summary.exception_count} item(s)</small>
        </div>
      </div>

      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <Filter size={16} />
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
              <option value="">All Methods</option>
              <option value="card">Card</option>
              <option value="ach">ACH</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="zelle">Zelle</option>
            </select>
          </label>

          <label>
            Status
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="unmatched">Unmatched</option>
              <option value="matched">Matched</option>
              <option value="reconciled">Reconciled</option>
              <option value="exception">Exception</option>
              <option value="returned">Returned</option>
            </select>
          </label>

          <label>
            Source
            <select
              value={filters.source}
              onChange={(event) => updateFilter("source", event.target.value)}
            >
              <option value="">All Sources</option>
              <option value="stripe">Stripe</option>
              <option value="manual">Manual</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="zelle">Zelle</option>
              <option value="ledger">Ledger</option>
            </select>
          </label>

          <button
            type="button"
            className="finance-btn primary"
            onClick={loadReconciliation}
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
            placeholder="Search payment, invoice, receipt, member, reference..."
          />
        </div>
      </div>

      {selectedIds.length ? (
        <div className="finance-bulk-bar">
          <div>
            <strong>{selectedIds.length}</strong> selected
            <span>{money(selectedTotal)}</span>
          </div>

          <div>
            <button
              type="button"
              className="finance-btn"
              onClick={() => runBulkAction("match")}
              disabled={Boolean(busyAction)}
            >
              <Link2 size={15} />
              Match
            </button>

            <button
              type="button"
              className="finance-btn success"
              onClick={() => runBulkAction("reconcile")}
              disabled={Boolean(busyAction)}
            >
              <BadgeCheck size={15} />
              Reconcile
            </button>

            <button
              type="button"
              className="finance-btn danger"
              onClick={() => runBulkAction("exception")}
              disabled={Boolean(busyAction)}
            >
              <XCircle size={15} />
              Exception
            </button>
          </div>
        </div>
      ) : null}

      <div className="finance-table-shell">
        <table className="finance-table">
          <thead>
            <tr>
              <th className="finance-check-col">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                  aria-label="Select all reconciliation rows"
                />
              </th>
              <th>Date</th>
              <th>Payment</th>
              <th>Payer</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Invoice / Receipt</th>
              <th className="text-right">Amount</th>
              <th>Status</th>
              <th>Reconciliation</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11}>
                  <div className="finance-audit-empty">Loading reconciliation records...</div>
                </td>
              </tr>
            ) : null}

            {!loading && !filteredRows.length ? (
              <tr>
                <td colSpan={11}>
                  <div className="finance-audit-empty">
                    No reconciliation records found for the selected filters.
                  </div>
                </td>
              </tr>
            ) : null}

            {!loading &&
              filteredRows.map((row) => {
                const id = itemId(row);
                const reconStatus =
                  row.reconciliation_status || row.match_status || row.status || "open";

                return (
                  <tr key={id || `${row.payment_number}-${row.reference_no}`}>
                    <td className="finance-check-col">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[id])}
                        onChange={(event) => toggleRow(row, event.target.checked)}
                        aria-label={`Select ${itemPaymentNumber(row)}`}
                      />
                    </td>

                    <td>
                      <div className="finance-cell-main">
                        <CalendarDays size={14} />
                        {formatDate(row.paid_at || row.created_at || row.transaction_date)}
                      </div>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="finance-link-button"
                        onClick={() => onOpenPayment?.(row)}
                      >
                        {itemPaymentNumber(row)}
                      </button>
                      <small>{pretty(row.category || row.payment_type)}</small>
                    </td>

                    <td>
                      <strong>
                        {clean(
                          row.full_name_snapshot ||
                            row.payer_name ||
                            row.member_name ||
                            row.donor_name
                        )}
                      </strong>
                      <small>{clean(row.member_no || row.email_snapshot || row.email)}</small>
                    </td>

                    <td>
                      <span className="finance-chip">
                        <Banknote size={14} />
                        {pretty(row.method || row.payment_method)}
                      </span>
                    </td>

                    <td>
                      <span className="finance-mono">{itemReference(row)}</span>
                    </td>

                    <td>
                      <div className="finance-inline-actions">
                        {row.invoice_number ? (
                          <button
                            type="button"
                            className="finance-mini-btn"
                            onClick={() => onOpenInvoice?.(row)}
                          >
                            <FileText size={13} />
                            {row.invoice_number}
                          </button>
                        ) : null}

                        {row.receipt_number ? (
                          <button
                            type="button"
                            className="finance-mini-btn"
                            onClick={() => onOpenReceipt?.(row)}
                          >
                            <ShieldCheck size={13} />
                            {row.receipt_number}
                          </button>
                        ) : null}

                        {!row.invoice_number && !row.receipt_number ? "--" : null}
                      </div>
                    </td>

                    <td className="text-right">
                      <strong>{money(row.amount)}</strong>
                    </td>

                    <td>
                      <span className={`finance-status ${statusClass(row.status)}`}>
                        {pretty(row.status)}
                      </span>
                    </td>

                    <td>
                      <span className={`finance-status ${statusClass(reconStatus)}`}>
                        {pretty(reconStatus)}
                      </span>
                    </td>

                    <td>
                      <div className="finance-row-actions">
                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => runRowAction(row, "match")}
                          disabled={Boolean(busyAction)}
                        >
                          <Link2 size={13} />
                          Match
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => runRowAction(row, "reconcile")}
                          disabled={Boolean(busyAction)}
                        >
                          <BadgeCheck size={13} />
                          Reconcile
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn danger"
                          onClick={() => runRowAction(row, "unmatch")}
                          disabled={Boolean(busyAction)}
                        >
                          <Unlink size={13} />
                          Unmatch
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}