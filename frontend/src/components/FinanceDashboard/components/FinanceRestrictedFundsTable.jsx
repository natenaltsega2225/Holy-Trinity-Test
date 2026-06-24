import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  BookOpen,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  Filter,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  UnlockKeyhole,
  X,
} from "lucide-react";
import api from "../../api";
import "../../../styles/finance-enterprise.css";

const RESTRICTION_TYPES = [
  { value: "", label: "All Restrictions" },
  { value: "restricted", label: "Restricted" },
  { value: "temporarily_restricted", label: "Temporarily Restricted" },
  { value: "designated", label: "Board Designated" },
  { value: "building_fund", label: "Building Fund" },
  { value: "charity_fund", label: "Charity Fund" },
  { value: "pledge_campaign", label: "Pledge Campaign" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "review", label: "Review" },
  { value: "released", label: "Released" },
  { value: "closed", label: "Closed" },
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

function formatDate(value) {
  if (!value) return "--";

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) return `${match[2]}/${match[3]}/${match[1]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("en-US");
}

function responseData(response) {
  return response?.data || response || {};
}

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.funds)) return data.funds;
  if (Array.isArray(data.restricted_funds)) return data.restricted_funds;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function fundId(row) {
  return row?.id || row?.fund_id || row?.restricted_fund_id || "";
}

function fundName(row) {
  return clean(row?.fund_name || row?.name || row?.title || row?.category_name);
}

function receivedAmount(row) {
  return numberValue(row?.received_amount || row?.total_received || row?.income_total);
}

function releasedAmount(row) {
  return numberValue(
    row?.released_amount || row?.spent_amount || row?.total_spent || row?.expense_total
  );
}

function availableBalance(row) {
  const explicit = row?.available_balance ?? row?.current_balance ?? row?.balance;

  if (explicit !== undefined && explicit !== null) {
    return numberValue(explicit);
  }

  return numberValue(row?.opening_balance) + receivedAmount(row) - releasedAmount(row);
}

function percentReleased(row) {
  const received = receivedAmount(row);
  if (!received) return 0;
  return Math.min(100, Math.max(0, (releasedAmount(row) / received) * 100));
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();

  if (["active", "approved", "available", "open"].includes(status)) return "success";
  if (["review", "pending", "inactive"].includes(status)) return "warning";
  if (["closed", "released", "void", "cancelled", "overdrawn"].includes(status)) return "danger";

  return "neutral";
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

  throw lastError || new Error("Restricted funds endpoint is not available.");
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

  throw lastError || new Error("Restricted fund action endpoint is not available.");
}

function exportCsv(rows) {
  const headers = [
    "Fund",
    "Restriction Type",
    "Category",
    "Campaign",
    "Restriction Note",
    "Received",
    "Released",
    "Available",
    "Released %",
    "Status",
    "Last Activity",
  ];

  const body = rows.map((row) => [
    fundName(row),
    pretty(row.restriction_type || row.fund_type),
    pretty(row.category || row.donation_category),
    clean(row.campaign_name || row.campaign_title),
    clean(row.restriction_note || row.restriction || row.notes),
    receivedAmount(row).toFixed(2),
    releasedAmount(row).toFixed(2),
    availableBalance(row).toFixed(2),
    percentReleased(row).toFixed(2),
    pretty(row.status || "active"),
    formatDate(row.last_activity_at || row.updated_at || row.created_at),
  ]);

  const csv = [headers, ...body]
    .map((line) =>
      line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `restricted-funds-${todayIso()}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

function emptyReleaseForm(row = null) {
  return {
    release_date: todayIso(),
    amount: row ? String(availableBalance(row).toFixed(2)) : "",
    purpose: "",
    approved_by: "",
    notes: "",
    create_ledger_entry: true,
    mark_reviewed: true,
  };
}

export default function FinanceRestrictedFundsTable({
  rows = null,
  autoLoad = true,
  compact = false,
  onEdit,
  onOpenFund,
  onOpenLedger,
  onReleaseComplete,
  onRowsLoaded,
}) {
  const [internalRows, setInternalRows] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    restriction_type: "",
    status: "",
  });

  const [selected, setSelected] = useState({});
  const [releaseFund, setReleaseFund] = useState(null);
  const [releaseForm, setReleaseForm] = useState(emptyReleaseForm());
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sourceRows = Array.isArray(rows) ? rows : internalRows;

  const visibleRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return sourceRows.filter((row) => {
      const haystack = [
        row.fund_name,
        row.name,
        row.title,
        row.category,
        row.donation_category,
        row.campaign_name,
        row.campaign_title,
        row.restriction_note,
        row.restriction,
        row.notes,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || haystack.includes(search);

      const matchesRestriction =
        !filters.restriction_type ||
        String(row.restriction_type || row.fund_type || "").toLowerCase() ===
          filters.restriction_type.toLowerCase();

      const matchesStatus =
        !filters.status ||
        String(row.status || "active").toLowerCase() === filters.status.toLowerCase();

      return matchesSearch && matchesRestriction && matchesStatus;
    });
  }, [sourceRows, filters]);

  const selectedRows = useMemo(
    () => sourceRows.filter((row) => selected[fundId(row)]),
    [sourceRows, selected]
  );

  const summary = useMemo(() => {
    return visibleRows.reduce(
      (acc, row) => {
        acc.records += 1;
        acc.received += receivedAmount(row);
        acc.released += releasedAmount(row);
        acc.available += availableBalance(row);

        if (String(row.restriction_type || row.fund_type || "").includes("restricted")) {
          acc.restricted += 1;
        }

        if (availableBalance(row) < 0) {
          acc.overdrawn += 1;
        }

        return acc;
      },
      {
        records: 0,
        restricted: 0,
        overdrawn: 0,
        received: 0,
        released: 0,
        available: 0,
      }
    );
  }, [visibleRows]);

  async function loadRestrictedFunds() {
    if (Array.isArray(rows)) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await getFirst(
        [
          "/finance/funds/restricted",
          "/finance/restricted-funds",
          "/finance/fund-accounting/restricted",
          "/finance/reports/restricted-funds",
        ],
        {
          params: {
            search: filters.search,
            restriction_type: filters.restriction_type,
            status: filters.status,
            limit: compact ? 25 : 250,
          },
        }
      );

      const nextRows = rowsFrom(result.data);
      setInternalRows(nextRows);
      setSelected({});
      onRowsLoaded?.(nextRows);
    } catch (err) {
      setInternalRows([]);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load restricted funds."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoLoad) return;
    loadRestrictedFunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleRow(row, checked) {
    const id = fundId(row);
    if (!id) return;

    setSelected((current) => ({
      ...current,
      [id]: checked,
    }));
  }

  function toggleAll(checked) {
    if (!checked) {
      setSelected({});
      return;
    }

    const next = {};
    visibleRows.forEach((row) => {
      const id = fundId(row);
      if (id) next[id] = true;
    });

    setSelected(next);
  }

  function openRelease(row) {
    setReleaseFund(row);
    setReleaseForm(emptyReleaseForm(row));
    setError("");
    setSuccess("");
  }

  function closeRelease() {
    setReleaseFund(null);
    setReleaseForm(emptyReleaseForm());
  }

  function updateRelease(key, value) {
    setReleaseForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveRelease(event) {
    event.preventDefault();

    if (!releaseFund) return;

    const id = fundId(releaseFund);
    const amount = numberValue(releaseForm.amount);

    setError("");
    setSuccess("");

    if (!id) {
      setError("Fund id is missing.");
      return;
    }

    if (amount <= 0) {
      setError("Release amount must be greater than zero.");
      return;
    }

    if (amount > availableBalance(releaseFund)) {
      setError("Release amount cannot exceed the available restricted balance.");
      return;
    }

    if (!releaseForm.purpose.trim()) {
      setError("Release purpose is required.");
      return;
    }

    const payload = {
      fund_id: id,
      restricted_fund_id: id,
      release_date: releaseForm.release_date,
      amount,
      purpose: releaseForm.purpose.trim(),
      approved_by: releaseForm.approved_by.trim() || null,
      notes: releaseForm.notes.trim() || null,
      create_ledger_entry: releaseForm.create_ledger_entry,
      mark_reviewed: releaseForm.mark_reviewed,
      source: "finance_restricted_funds_table",
    };

    try {
      setBusyAction("release");

      const result = await postFirst(
        [
          `/finance/funds/${id}/release`,
          `/finance/restricted-funds/${id}/release`,
          `/finance/fund-accounting/${id}/release`,
          "/finance/funds/release",
          "/finance/restricted-funds/release",
        ],
        payload
      );

      setSuccess("Restricted funds released successfully.");
      closeRelease();
      onReleaseComplete?.(result.data);
      await loadRestrictedFunds();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to release restricted funds."
      );
    } finally {
      setBusyAction("");
    }
  }

  async function runReview(row) {
    const id = fundId(row);

    if (!id) {
      setError("Fund id is missing.");
      return;
    }

    setBusyAction(`review:${id}`);
    setError("");
    setSuccess("");

    try {
      await postFirst(
        [
          `/finance/funds/${id}/review`,
          `/finance/restricted-funds/${id}/review`,
          `/finance/fund-accounting/${id}/review`,
        ],
        {
          fund_id: id,
          source: "finance_restricted_funds_table",
        }
      );

      setSuccess("Fund marked for finance review.");
      await loadRestrictedFunds();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to mark fund for review."
      );
    } finally {
      setBusyAction("");
    }
  }

  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((row) => selected[fundId(row)]);

  return (
    <section className={`finance-panel ${compact ? "compact" : ""}`}>
      <div className="finance-page-head">
        <div>
          <span className="finance-kicker">Restricted Funds</span>
          <h1>Restricted Fund Balances</h1>
          <p>
            Review donor-restricted, board-designated, building, charity, pledge,
            and campaign funds with release controls.
          </p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn"
            onClick={() => exportCsv(visibleRows)}
            disabled={!visibleRows.length}
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            className="finance-btn"
            onClick={loadRestrictedFunds}
            disabled={loading || Array.isArray(rows)}
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
          <span>Funds</span>
          <strong>{summary.records}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Restricted</span>
          <strong>{summary.restricted}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Total Received</span>
          <strong>{money(summary.received)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Total Released</span>
          <strong>{money(summary.released)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Available</span>
          <strong>{money(summary.available)}</strong>
        </div>
      </div>

      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <Filter size={16} />

          <label>
            Restriction
            <select
              value={filters.restriction_type}
              onChange={(event) =>
                updateFilter("restriction_type", event.target.value)
              }
            >
              {RESTRICTION_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="finance-btn primary"
            onClick={loadRestrictedFunds}
            disabled={loading || Array.isArray(rows)}
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
            placeholder="Search fund, category, campaign, restriction, notes..."
          />
        </div>
      </div>

      {selectedRows.length ? (
        <div className="finance-bulk-bar">
          <div>
            <strong>{selectedRows.length}</strong> selected
            <span>{money(selectedRows.reduce((sum, row) => sum + availableBalance(row), 0))}</span>
          </div>

          <div>
            <button
              type="button"
              className="finance-btn"
              onClick={() => setSelected({})}
            >
              Clear
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
                  aria-label="Select all restricted funds"
                />
              </th>
              <th>Fund</th>
              <th>Restriction</th>
              <th>Category / Campaign</th>
              <th>Purpose</th>
              <th className="text-right">Received</th>
              <th className="text-right">Released</th>
              <th className="text-right">Available</th>
              <th>Release Progress</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11}>
                  <div className="finance-audit-empty">
                    Loading restricted funds...
                  </div>
                </td>
              </tr>
            ) : null}

            {!loading && !visibleRows.length ? (
              <tr>
                <td colSpan={11}>
                  <div className="finance-audit-empty">
                    No restricted funds found.
                  </div>
                </td>
              </tr>
            ) : null}

            {!loading &&
              visibleRows.map((row) => {
                const id = fundId(row);
                const progress = percentReleased(row);

                return (
                  <tr key={id || fundName(row)}>
                    <td className="finance-check-col">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[id])}
                        onChange={(event) => toggleRow(row, event.target.checked)}
                        aria-label={`Select ${fundName(row)}`}
                      />
                    </td>

                    <td>
                      <button
                        type="button"
                        className="finance-link-button"
                        onClick={() => onOpenFund?.(row)}
                      >
                        {fundName(row)}
                      </button>
                      <small>
                        <BookOpen size={12} />
                        {clean(row.fund_number || row.code || id)}
                      </small>
                    </td>

                    <td>
                      <strong>{pretty(row.restriction_type || row.fund_type)}</strong>
                      <small>{formatDate(row.created_at)}</small>
                    </td>

                    <td>
                      <div className="finance-cell-stack">
                        <strong>{pretty(row.category || row.donation_category)}</strong>
                        <small>{clean(row.campaign_name || row.campaign_title)}</small>
                      </div>
                    </td>

                    <td>
                      <span title={clean(row.restriction_note || row.restriction || row.notes)}>
                        {clean(row.restriction_note || row.restriction || row.notes)}
                      </span>
                    </td>

                    <td className="text-right">
                      <strong>{money(receivedAmount(row))}</strong>
                    </td>

                    <td className="text-right">
                      <strong>{money(releasedAmount(row))}</strong>
                    </td>

                    <td className="text-right">
                      <strong>{money(availableBalance(row))}</strong>
                    </td>

                    <td>
                      <div className="finance-progress-cell">
                        <div className="finance-progress-track">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                        <small>{progress.toFixed(0)}% released</small>
                      </div>
                    </td>

                    <td>
                      <span className={`finance-status ${statusClass(row.status || "active")}`}>
                        {pretty(row.status || "active")}
                      </span>
                    </td>

                    <td>
                      <div className="finance-row-actions">
                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => onEdit?.(row)}
                        >
                          <Edit3 size={13} />
                          Edit
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => onOpenLedger?.(row)}
                        >
                          <FileText size={13} />
                          Ledger
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => openRelease(row)}
                          disabled={availableBalance(row) <= 0}
                        >
                          <UnlockKeyhole size={13} />
                          Release
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => runReview(row)}
                          disabled={Boolean(busyAction)}
                        >
                          <ShieldCheck size={13} />
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {releaseFund ? (
        <div className="finance-modal-backdrop" role="presentation">
          <div
            className="finance-modal finance-modal-wide"
            role="dialog"
            aria-modal="true"
            aria-label="Release restricted funds"
          >
            <div className="finance-modal-head">
              <div>
                <span className="finance-kicker">Restricted Release</span>
                <h2>Release Funds</h2>
                <p>
                  Release restricted money for approved purpose and create the
                  accounting trail for finance review.
                </p>
              </div>

              <button
                type="button"
                className="finance-icon-button"
                onClick={closeRelease}
                aria-label="Close release modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="finance-summary-grid compact">
              <div className="finance-summary-card">
                <span>Fund</span>
                <strong>{fundName(releaseFund)}</strong>
              </div>

              <div className="finance-summary-card">
                <span>Available</span>
                <strong>{money(availableBalance(releaseFund))}</strong>
              </div>

              <div className="finance-summary-card">
                <span>Already Released</span>
                <strong>{money(releasedAmount(releaseFund))}</strong>
              </div>
            </div>

            <form onSubmit={saveRelease}>
              <div className="finance-form-grid three">
                <label>
                  Release Date
                  <input
                    type="date"
                    value={releaseForm.release_date}
                    onChange={(event) =>
                      updateRelease("release_date", event.target.value)
                    }
                  />
                </label>

                <label>
                  Release Amount
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={releaseForm.amount}
                    onChange={(event) => updateRelease("amount", event.target.value)}
                  />
                </label>

                <label>
                  Approved By
                  <input
                    value={releaseForm.approved_by}
                    onChange={(event) =>
                      updateRelease("approved_by", event.target.value)
                    }
                    placeholder="Finance/admin approver"
                  />
                </label>

                <label className="finance-field-full">
                  Purpose
                  <textarea
                    rows={3}
                    value={releaseForm.purpose}
                    onChange={(event) => updateRelease("purpose", event.target.value)}
                    placeholder="Required: describe the approved use of restricted funds."
                  />
                </label>

                <label className="finance-field-full">
                  Notes
                  <textarea
                    rows={3}
                    value={releaseForm.notes}
                    onChange={(event) => updateRelease("notes", event.target.value)}
                    placeholder="Internal finance notes..."
                  />
                </label>
              </div>

              <div className="finance-check-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={releaseForm.create_ledger_entry}
                    onChange={(event) =>
                      updateRelease("create_ledger_entry", event.target.checked)
                    }
                  />
                  <span>Create ledger release entry</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={releaseForm.mark_reviewed}
                    onChange={(event) =>
                      updateRelease("mark_reviewed", event.target.checked)
                    }
                  />
                  <span>Mark fund reviewed</span>
                </label>
              </div>

              <div className="finance-modal-actions">
                <button type="button" className="finance-btn" onClick={closeRelease}>
                  Cancel
                </button>

                <button
                  type="submit"
                  className="finance-btn primary"
                  disabled={busyAction === "release"}
                >
                  <Save size={16} />
                  {busyAction === "release" ? "Releasing..." : "Release Funds"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}