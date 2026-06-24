import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  BookOpen,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  Filter,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const FUND_TYPES = [
  { value: "", label: "All Fund Types" },
  { value: "unrestricted", label: "Unrestricted" },
  { value: "restricted", label: "Restricted" },
  { value: "temporarily_restricted", label: "Temporarily Restricted" },
  { value: "designated", label: "Board Designated" },
];

const FUND_STATUS = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "closed", label: "Closed" },
  { value: "review", label: "Review" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "general_donation", label: "General Donation" },
  { value: "plate_collection", label: "Plate Collection" },
  { value: "tithe", label: "Tithe" },
  { value: "building_fund", label: "Building Fund" },
  { value: "charity_fund", label: "Charity Fund" },
  { value: "pledge", label: "Pledge" },
  { value: "school", label: "School" },
  { value: "trip", label: "Trip" },
  { value: "other_fund", label: "Other Fund" },
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

function responseData(response) {
  return response?.data || response || {};
}

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.funds)) return data.funds;
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

function fundBalance(row) {
  const explicit = row?.balance ?? row?.current_balance ?? row?.available_balance;

  if (explicit !== undefined && explicit !== null) {
    return numberValue(explicit);
  }

  return (
    numberValue(row?.opening_balance) +
    numberValue(row?.received_amount || row?.total_received) -
    numberValue(row?.released_amount || row?.spent_amount || row?.total_spent)
  );
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();

  if (["active", "open", "available", "approved"].includes(status)) {
    return "success";
  }

  if (["review", "pending", "inactive"].includes(status)) {
    return "warning";
  }

  if (["closed", "void", "cancelled", "overdrawn"].includes(status)) {
    return "danger";
  }

  return "neutral";
}

function summaryFrom(data, rows) {
  const source = data.summary || data.totals || {};

  return {
    funds: source.funds ?? source.count ?? rows.length,
    restricted:
      source.restricted_count ??
      rows.filter((row) =>
        String(row.fund_type || row.restriction_type || "").includes("restricted")
      ).length,
    unrestricted:
      source.unrestricted_count ??
      rows.filter((row) =>
        ["unrestricted", ""].includes(
          String(row.fund_type || row.restriction_type || "").toLowerCase()
        )
      ).length,
    received:
      source.received_amount ??
      rows.reduce(
        (sum, row) =>
          sum + numberValue(row.received_amount || row.total_received),
        0
      ),
    released:
      source.released_amount ??
      rows.reduce(
        (sum, row) =>
          sum +
          numberValue(row.released_amount || row.spent_amount || row.total_spent),
        0
      ),
    balance:
      source.balance ??
      source.available_balance ??
      rows.reduce((sum, row) => sum + fundBalance(row), 0),
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

  throw lastError || new Error("Fund accounting endpoint is not available.");
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

  throw lastError || new Error("Fund accounting action endpoint is not available.");
}

function exportCsv(rows) {
  const headers = [
    "Fund",
    "Type",
    "Category",
    "Campaign",
    "Opening Balance",
    "Received",
    "Released",
    "Available Balance",
    "Status",
    "Restriction",
  ];

  const body = rows.map((row) => [
    fundName(row),
    pretty(row.fund_type || row.restriction_type),
    pretty(row.category || row.donation_category),
    clean(row.campaign_name || row.campaign_title),
    numberValue(row.opening_balance).toFixed(2),
    numberValue(row.received_amount || row.total_received).toFixed(2),
    numberValue(row.released_amount || row.spent_amount || row.total_spent).toFixed(2),
    fundBalance(row).toFixed(2),
    pretty(row.status || "active"),
    clean(row.restriction_note || row.restriction || row.notes),
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
  link.download = `fund-accounting-${todayIso()}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

function emptyFundForm() {
  return {
    fund_name: "",
    fund_type: "unrestricted",
    category: "general_donation",
    campaign_id: "",
    opening_balance: "",
    restriction_note: "",
    status: "active",
    notes: "",
  };
}

export default function FinanceFundAccountingPanel({
  compact = false,
  initialFilters = {},
  onOpenLedger,
  onOpenCampaign,
  onUpdated,
}) {
  const [filters, setFilters] = useState({
    search: "",
    fund_type: "",
    category: "",
    status: "",
    ...initialFilters,
  });

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(summaryFrom({}, []));
  const [selectedFund, setSelectedFund] = useState(null);
  const [form, setForm] = useState(emptyFundForm());
  const [modalMode, setModalMode] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const visibleRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !search ||
        [
          row.fund_name,
          row.name,
          row.title,
          row.category,
          row.donation_category,
          row.campaign_name,
          row.campaign_title,
          row.restriction_note,
          row.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search);

      const matchesType =
        !filters.fund_type ||
        String(row.fund_type || row.restriction_type || "").toLowerCase() ===
          filters.fund_type.toLowerCase();

      const matchesCategory =
        !filters.category ||
        String(row.category || row.donation_category || "").toLowerCase() ===
          filters.category.toLowerCase();

      const matchesStatus =
        !filters.status ||
        String(row.status || "active").toLowerCase() === filters.status.toLowerCase();

      return matchesSearch && matchesType && matchesCategory && matchesStatus;
    });
  }, [rows, filters]);

  async function loadFunds() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await getFirst(
        [
          "/finance/funds",
          "/finance/fund-accounting",
          "/finance/reports/funds",
          "/finance/reports/fund-accounting",
        ],
        {
          params: {
            search: filters.search,
            fund_type: filters.fund_type,
            category: filters.category,
            status: filters.status,
            limit: compact ? 25 : 250,
          },
        }
      );

      const data = result.data;
      const nextRows = rowsFrom(data);

      setRows(nextRows);
      setSummary(summaryFrom(data, nextRows));
    } catch (err) {
      setRows([]);
      setSummary(summaryFrom({}, []));
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load fund accounting records."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openCreateModal() {
    setSelectedFund(null);
    setForm(emptyFundForm());
    setModalMode("create");
    setError("");
    setSuccess("");
  }

  function openEditModal(row) {
    setSelectedFund(row);
    setForm({
      fund_name: fundName(row),
      fund_type: row.fund_type || row.restriction_type || "unrestricted",
      category: row.category || row.donation_category || "general_donation",
      campaign_id: row.campaign_id || "",
      opening_balance: String(numberValue(row.opening_balance || fundBalance(row))),
      restriction_note: row.restriction_note || row.restriction || "",
      status: row.status || "active",
      notes: row.notes || "",
    });
    setModalMode("edit");
    setError("");
    setSuccess("");
  }

  function closeModal() {
    setSelectedFund(null);
    setForm(emptyFundForm());
    setModalMode("");
  }

  function updateForm(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveFund(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.fund_name.trim()) {
      setError("Fund name is required.");
      return;
    }

    if (!form.fund_type) {
      setError("Fund type is required.");
      return;
    }

    const payload = {
      ...form,
      id: selectedFund ? fundId(selectedFund) : null,
      fund_id: selectedFund ? fundId(selectedFund) : null,
      opening_balance: numberValue(form.opening_balance),
      source: "finance_fund_accounting_panel",
    };

    const id = selectedFund ? fundId(selectedFund) : "";

    try {
      setBusyAction("save");

      const result = await postFirst(
        modalMode === "edit"
          ? [
              `/finance/funds/${id}`,
              `/finance/fund-accounting/${id}`,
              "/finance/funds/save",
              "/finance/fund-accounting/save",
            ]
          : [
              "/finance/funds",
              "/finance/fund-accounting",
              "/finance/funds/save",
              "/finance/fund-accounting/save",
            ],
        payload
      );

      setSuccess("Fund saved successfully.");
      closeModal();
      onUpdated?.(result.data);
      await loadFunds();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save fund."
      );
    } finally {
      setBusyAction("");
    }
  }

  async function runAction(row, action) {
    const id = fundId(row);

    if (!id) {
      setError("Fund id is missing.");
      return;
    }

    setBusyAction(`${action}:${id}`);
    setError("");
    setSuccess("");

    try {
      const result = await postFirst(
        [
          `/finance/funds/${id}/${action}`,
          `/finance/fund-accounting/${id}/${action}`,
          "/finance/funds/action",
          "/finance/fund-accounting/action",
        ],
        {
          id,
          fund_id: id,
          action,
          source: "finance_fund_accounting_panel",
        }
      );

      setSuccess(`${pretty(action)} completed.`);
      onUpdated?.(result.data);
      await loadFunds();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          `Failed to ${pretty(action).toLowerCase()} fund.`
      );
    } finally {
      setBusyAction("");
    }
  }

  return (
    <section className={`finance-panel ${compact ? "compact" : ""}`}>
      <div className="finance-page-head">
        <div>
          <span className="finance-kicker">Fund Accounting</span>
          <h1>Restricted & Designated Funds</h1>
          <p>
            Track donation categories, restricted balances, campaign funds,
            releases, adjustments, and finance audit readiness.
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
            onClick={loadFunds}
            disabled={loading}
          >
            <RefreshCcw size={16} />
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button type="button" className="finance-btn primary" onClick={openCreateModal}>
            <Plus size={16} />
            Fund
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
          <span>Total Funds</span>
          <strong>{summary.funds}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Restricted</span>
          <strong>{summary.restricted}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Received</span>
          <strong>{money(summary.received)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Released</span>
          <strong>{money(summary.released)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Available Balance</span>
          <strong>{money(summary.balance)}</strong>
        </div>
      </div>

      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <Filter size={16} />

          <label>
            Type
            <select
              value={filters.fund_type}
              onChange={(event) => updateFilter("fund_type", event.target.value)}
            >
              {FUND_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Category
            <select
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
            >
              {CATEGORY_OPTIONS.map((option) => (
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
              {FUND_STATUS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="finance-btn primary" onClick={loadFunds}>
            Apply
          </button>
        </div>

        <div className="finance-search">
          <Search size={16} />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search fund, campaign, category, restriction..."
          />
        </div>
      </div>

      <div className="finance-table-shell">
        <table className="finance-table">
          <thead>
            <tr>
              <th>Fund</th>
              <th>Type</th>
              <th>Category</th>
              <th>Campaign</th>
              <th className="text-right">Received</th>
              <th className="text-right">Released</th>
              <th className="text-right">Balance</th>
              <th>Status</th>
              <th>Restriction</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10}>
                  <div className="finance-audit-empty">Loading fund accounting...</div>
                </td>
              </tr>
            ) : null}

            {!loading && !visibleRows.length ? (
              <tr>
                <td colSpan={10}>
                  <div className="finance-audit-empty">
                    No fund accounting records found.
                  </div>
                </td>
              </tr>
            ) : null}

            {!loading &&
              visibleRows.map((row) => {
                const id = fundId(row);

                return (
                  <tr key={id || fundName(row)}>
                    <td>
                      <div className="finance-cell-stack">
                        <strong>{fundName(row)}</strong>
                        <small>
                          <BookOpen size={12} />
                          {clean(row.fund_number || row.code || id)}
                        </small>
                      </div>
                    </td>

                    <td>{pretty(row.fund_type || row.restriction_type)}</td>

                    <td>{pretty(row.category || row.donation_category)}</td>

                    <td>
                      {row.campaign_id || row.campaign_name ? (
                        <button
                          type="button"
                          className="finance-link-button"
                          onClick={() => onOpenCampaign?.(row)}
                        >
                          {clean(row.campaign_name || row.campaign_title || row.campaign_id)}
                        </button>
                      ) : (
                        "--"
                      )}
                    </td>

                    <td className="text-right">
                      <strong>{money(row.received_amount || row.total_received)}</strong>
                    </td>

                    <td className="text-right">
                      <strong>
                        {money(row.released_amount || row.spent_amount || row.total_spent)}
                      </strong>
                    </td>

                    <td className="text-right">
                      <strong>{money(fundBalance(row))}</strong>
                    </td>

                    <td>
                      <span className={`finance-status ${statusClass(row.status || "active")}`}>
                        {pretty(row.status || "active")}
                      </span>
                    </td>

                    <td>
                      <span title={clean(row.restriction_note || row.restriction || row.notes)}>
                        {clean(row.restriction_note || row.restriction || row.notes)}
                      </span>
                    </td>

                    <td>
                      <div className="finance-row-actions">
                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => openEditModal(row)}
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
                          onClick={() => runAction(row, "release")}
                          disabled={Boolean(busyAction)}
                        >
                          <BadgeDollarSign size={13} />
                          Release
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => runAction(row, "review")}
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

      {modalMode ? (
        <div className="finance-modal-backdrop" role="presentation">
          <div
            className="finance-modal finance-modal-wide"
            role="dialog"
            aria-modal="true"
            aria-label="Fund accounting form"
          >
            <div className="finance-modal-head">
              <div>
                <span className="finance-kicker">Fund Setup</span>
                <h2>{modalMode === "edit" ? "Edit Fund" : "Create Fund"}</h2>
                <p>
                  Define fund restrictions, donation category mapping, campaign
                  relationship, opening balance, and finance status.
                </p>
              </div>

              <button
                type="button"
                className="finance-icon-button"
                onClick={closeModal}
                aria-label="Close fund modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveFund}>
              <div className="finance-form-grid three">
                <label>
                  Fund Name
                  <input
                    value={form.fund_name}
                    onChange={(event) => updateForm("fund_name", event.target.value)}
                    placeholder="Building Fund, Charity Fund, General Offering..."
                  />
                </label>

                <label>
                  Fund Type
                  <select
                    value={form.fund_type}
                    onChange={(event) => updateForm("fund_type", event.target.value)}
                  >
                    {FUND_TYPES.filter((option) => option.value).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Category
                  <select
                    value={form.category}
                    onChange={(event) => updateForm("category", event.target.value)}
                  >
                    {CATEGORY_OPTIONS.filter((option) => option.value).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Campaign ID
                  <input
                    value={form.campaign_id}
                    onChange={(event) => updateForm("campaign_id", event.target.value)}
                    placeholder="Optional campaign id"
                  />
                </label>

                <label>
                  Opening Balance
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.opening_balance}
                    onChange={(event) =>
                      updateForm("opening_balance", event.target.value)
                    }
                  />
                </label>

                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={(event) => updateForm("status", event.target.value)}
                  >
                    {FUND_STATUS.filter((option) => option.value).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="finance-field-full">
                  Restriction Note
                  <textarea
                    rows={3}
                    value={form.restriction_note}
                    onChange={(event) =>
                      updateForm("restriction_note", event.target.value)
                    }
                    placeholder="Describe donor restriction, board designation, release condition, or intended use."
                  />
                </label>

                <label className="finance-field-full">
                  Notes
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) => updateForm("notes", event.target.value)}
                    placeholder="Internal finance notes..."
                  />
                </label>
              </div>

              <div className="finance-audit-empty">
                Fund changes should preserve donor restrictions and provide a clear
                audit path from receipt category to fund balance.
              </div>

              <div className="finance-modal-actions">
                <button type="button" className="finance-btn" onClick={closeModal}>
                  Cancel
                </button>

                <button
                  type="submit"
                  className="finance-btn primary"
                  disabled={busyAction === "save"}
                >
                  <Save size={16} />
                  {busyAction === "save" ? "Saving..." : "Save Fund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}