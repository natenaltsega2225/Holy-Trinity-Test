import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  Edit3,
  Filter,
  Mail,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCcw,
  Repeat,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  User,
  X,
} from "lucide-react";
import api from "../../api";
import "../../../styles/finance-enterprise.css";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
  { value: "failed", label: "Failed" },
  { value: "past_due", label: "Past Due" },
];

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every Two Weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

const CATEGORY_OPTIONS = [
  { value: "general_donation", label: "General Donation" },
  { value: "tithe", label: "Tithe" },
  { value: "building_fund", label: "Building Fund" },
  { value: "charity_fund", label: "Charity Fund" },
  { value: "pledge", label: "Pledge" },
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
  if (Array.isArray(data.recurring_donations)) return data.recurring_donations;
  if (Array.isArray(data.subscriptions)) return data.subscriptions;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function subscriptionId(row) {
  return row?.id || row?.subscription_id || row?.recurring_donation_id || "";
}

function donorName(row) {
  return clean(
    row?.full_name ||
      row?.full_name_snapshot ||
      row?.donor_name ||
      row?.member_name ||
      row?.name,
    "Guest Donor"
  );
}

function donorEmail(row) {
  return clean(row?.email || row?.email_snapshot || row?.donor_email || row?.member_email, "");
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();

  if (["active", "paid", "succeeded"].includes(status)) return "success";
  if (["paused", "pending", "past_due"].includes(status)) return "warning";
  if (["cancelled", "failed", "expired"].includes(status)) return "danger";

  return "neutral";
}

function summaryFrom(rows) {
  return rows.reduce(
    (acc, row) => {
      acc.records += 1;

      const amount = numberValue(row.amount || row.recurring_amount || row.total_amount);
      acc.monthly_estimate +=
        row.frequency === "weekly"
          ? amount * 4
          : row.frequency === "biweekly"
            ? amount * 2
            : row.frequency === "quarterly"
              ? amount / 3
              : row.frequency === "annually"
                ? amount / 12
                : amount;

      if (String(row.status || "").toLowerCase() === "active") acc.active += 1;
      if (String(row.status || "").toLowerCase() === "failed") acc.failed += 1;
      if (String(row.status || "").toLowerCase() === "past_due") acc.past_due += 1;

      return acc;
    },
    {
      records: 0,
      active: 0,
      failed: 0,
      past_due: 0,
      monthly_estimate: 0,
    }
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

  throw lastError || new Error("Recurring donation endpoint is not available.");
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

      if ([404, 405].includes(err?.response?.status)) continue;

      throw err;
    }
  }

  throw lastError || new Error("Recurring donation action endpoint is not available.");
}

function exportCsv(rows) {
  const headers = [
    "Donor",
    "Member #",
    "Email",
    "Category",
    "Amount",
    "Frequency",
    "Status",
    "Next Charge",
    "Last Charge",
    "Payment Method",
    "Provider Subscription",
  ];

  const body = rows.map((row) => [
    donorName(row),
    clean(row.member_no || row.member_number),
    donorEmail(row),
    pretty(row.category || row.donation_category),
    numberValue(row.amount || row.recurring_amount).toFixed(2),
    pretty(row.frequency || row.interval),
    pretty(row.status),
    formatDate(row.next_charge_at || row.next_payment_at || row.next_run_at),
    formatDate(row.last_charge_at || row.last_payment_at),
    clean(row.payment_method_label || row.payment_method || row.method),
    clean(row.stripe_subscription_id || row.provider_subscription_id),
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
  link.download = `recurring-donations-${todayIso()}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

function emptyForm() {
  return {
    member_id: "",
    member_no: "",
    full_name: "",
    email: "",
    phone: "",
    category: "general_donation",
    campaign_id: "",
    amount: "",
    frequency: "monthly",
    start_date: todayIso(),
    end_date: "",
    payment_method: "card",
    notes: "",
    send_confirmation_email: true,
  };
}

function formFromRow(row) {
  return {
    member_id: row.member_id || "",
    member_no: row.member_no || "",
    full_name: donorName(row),
    email: donorEmail(row),
    phone: row.phone || row.phone_snapshot || "",
    category: row.category || row.donation_category || "general_donation",
    campaign_id: row.campaign_id || "",
    amount: String(row.amount || row.recurring_amount || ""),
    frequency: row.frequency || row.interval || "monthly",
    start_date: row.start_date ? String(row.start_date).slice(0, 10) : todayIso(),
    end_date: row.end_date ? String(row.end_date).slice(0, 10) : "",
    payment_method: row.payment_method || row.method || "card",
    notes: row.notes || "",
    send_confirmation_email: false,
  };
}

export default function FinanceRecurringDonationManager({
  compact = false,
  onOpenDonor,
  onOpenPayment,
  onOpenInvoice,
  onUpdated,
}) {
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    category: "",
  });

  const [rows, setRows] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const visibleRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return rows.filter((row) => {
      const haystack = [
        donorName(row),
        donorEmail(row),
        row.member_no,
        row.category,
        row.donation_category,
        row.frequency,
        row.status,
        row.stripe_subscription_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || haystack.includes(search);

      const matchesStatus =
        !filters.status ||
        String(row.status || "").toLowerCase() === filters.status.toLowerCase();

      const matchesCategory =
        !filters.category ||
        String(row.category || row.donation_category || "").toLowerCase() ===
          filters.category.toLowerCase();

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [rows, filters]);

  const summary = useMemo(() => summaryFrom(visibleRows), [visibleRows]);

  async function loadRecurringDonations() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await getFirst(
        [
          "/finance/recurring-donations",
          "/finance/recurring",
          "/finance/donations/recurring",
          "/finance/subscriptions/donations",
        ],
        {
          params: {
            search: filters.search,
            status: filters.status,
            category: filters.category,
            limit: compact ? 25 : 250,
          },
        }
      );

      setRows(rowsFrom(result.data));
    } catch (err) {
      setRows([]);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load recurring donations."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecurringDonations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openCreate() {
    setEditingRow(null);
    setForm(emptyForm());
    setModalOpen(true);
    setError("");
    setSuccess("");
  }

  function openEdit(row) {
    setEditingRow(row);
    setForm(formFromRow(row));
    setModalOpen(true);
    setError("");
    setSuccess("");
  }

  function closeModal() {
    setEditingRow(null);
    setForm(emptyForm());
    setModalOpen(false);
  }

  function updateForm(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveRecurring(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.full_name.trim()) {
      setError("Donor name is required.");
      return;
    }

    if (!form.email.trim()) {
      setError("Email is required for recurring donation communication.");
      return;
    }

    if (numberValue(form.amount) <= 0) {
      setError("Recurring amount must be greater than zero.");
      return;
    }

    const id = editingRow ? subscriptionId(editingRow) : "";

    const payload = {
      id: id || null,
      recurring_donation_id: id || null,
      subscription_id: id || null,

      member_id: form.member_id || null,
      member_no: form.member_no || null,
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,

      category: form.category,
      donation_category: form.category,
      campaign_id: form.campaign_id || null,

      amount: numberValue(form.amount),
      recurring_amount: numberValue(form.amount),
      frequency: form.frequency,
      interval: form.frequency,

      start_date: form.start_date,
      end_date: form.end_date || null,
      payment_method: form.payment_method,
      method: form.payment_method,

      notes: form.notes.trim() || null,
      send_confirmation_email: form.send_confirmation_email,

      source: "finance_recurring_donation_manager",
    };

    try {
      setBusyAction("save");

      const result = await postFirst(
        id
          ? [
              `/finance/recurring-donations/${id}`,
              `/finance/recurring/${id}`,
              "/finance/recurring-donations/save",
            ]
          : [
              "/finance/recurring-donations",
              "/finance/recurring",
              "/finance/donations/recurring",
            ],
        payload
      );

      setSuccess("Recurring donation saved.");
      closeModal();
      onUpdated?.(result.data);
      await loadRecurringDonations();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save recurring donation."
      );
    } finally {
      setBusyAction("");
    }
  }

  async function runAction(row, action) {
    const id = subscriptionId(row);

    if (!id) {
      setError("Recurring donation id is missing.");
      return;
    }

    if (
      action === "cancel" &&
      !window.confirm("Are you sure you want to cancel this recurring donation?")
    ) {
      return;
    }

    setBusyAction(`${action}:${id}`);
    setError("");
    setSuccess("");

    try {
      const result = await postFirst(
        [
          `/finance/recurring-donations/${id}/${action}`,
          `/finance/recurring/${id}/${action}`,
          `/finance/donations/recurring/${id}/${action}`,
        ],
        {
          id,
          recurring_donation_id: id,
          subscription_id: id,
          action,
          source: "finance_recurring_donation_manager",
        }
      );

      setSuccess(`${pretty(action)} completed.`);
      onUpdated?.(result.data);
      await loadRecurringDonations();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          `Failed to ${pretty(action).toLowerCase()} recurring donation.`
      );
    } finally {
      setBusyAction("");
    }
  }

  return (
    <section className={`finance-panel ${compact ? "compact" : ""}`}>
      <div className="finance-page-head">
        <div>
          <span className="finance-kicker">Recurring Giving</span>
          <h1>Recurring Donation Manager</h1>
          <p>
            Manage donor recurring gifts for card/ACH payments, pledge campaigns,
            donation categories, confirmation emails, and status changes.
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
            onClick={loadRecurringDonations}
            disabled={loading}
          >
            <RefreshCcw size={16} />
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button type="button" className="finance-btn primary" onClick={openCreate}>
            <Plus size={16} />
            Recurring Gift
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
          <span>Recurring Records</span>
          <strong>{summary.records}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Active</span>
          <strong>{summary.active}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Monthly Estimate</span>
          <strong>{money(summary.monthly_estimate)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Past Due</span>
          <strong>{summary.past_due}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Failed</span>
          <strong>{summary.failed}</strong>
        </div>
      </div>

      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <Filter size={16} />

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

          <label>
            Category
            <select
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
            >
              <option value="">All Categories</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="finance-btn primary"
            onClick={loadRecurringDonations}
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
            placeholder="Search donor, email, member id, category, subscription..."
          />
        </div>
      </div>

      <div className="finance-table-shell">
        <table className="finance-table">
          <thead>
            <tr>
              <th>Donor</th>
              <th>Category</th>
              <th className="text-right">Amount</th>
              <th>Frequency</th>
              <th>Payment Method</th>
              <th>Status</th>
              <th>Next Charge</th>
              <th>Last Charge</th>
              <th>Provider</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10}>
                  <div className="finance-audit-empty">
                    Loading recurring donations...
                  </div>
                </td>
              </tr>
            ) : null}

            {!loading && !visibleRows.length ? (
              <tr>
                <td colSpan={10}>
                  <div className="finance-audit-empty">
                    No recurring donations found.
                  </div>
                </td>
              </tr>
            ) : null}

            {!loading &&
              visibleRows.map((row) => {
                const id = subscriptionId(row);
                const status = String(row.status || "").toLowerCase();

                return (
                  <tr key={id || donorEmail(row)}>
                    <td>
                      <button
                        type="button"
                        className="finance-link-button"
                        onClick={() => onOpenDonor?.(row)}
                      >
                        {donorName(row)}
                      </button>
                      <small>
                        <User size={12} />
                        {clean(row.member_no || donorEmail(row))}
                      </small>
                    </td>

                    <td>{pretty(row.category || row.donation_category)}</td>

                    <td className="text-right">
                      <strong>{money(row.amount || row.recurring_amount)}</strong>
                    </td>

                    <td>{pretty(row.frequency || row.interval)}</td>

                    <td>
                      <span className="finance-chip">
                        <CreditCard size={14} />
                        {clean(row.payment_method_label || row.payment_method || row.method)}
                      </span>
                    </td>

                    <td>
                      <span className={`finance-status ${statusClass(row.status)}`}>
                        {pretty(row.status)}
                      </span>
                    </td>

                    <td>{formatDate(row.next_charge_at || row.next_payment_at || row.next_run_at)}</td>

                    <td>{formatDate(row.last_charge_at || row.last_payment_at)}</td>

                    <td>
                      <span className="finance-mono">
                        {clean(row.stripe_subscription_id || row.provider_subscription_id)}
                      </span>
                    </td>

                    <td>
                      <div className="finance-row-actions">
                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => openEdit(row)}
                        >
                          <Edit3 size={13} />
                          Edit
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => onOpenPayment?.(row)}
                        >
                          <BadgeDollarSign size={13} />
                          Payments
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => onOpenInvoice?.(row)}
                        >
                          <ShieldCheck size={13} />
                          Invoice
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => runAction(row, "send_email")}
                          disabled={Boolean(busyAction)}
                        >
                          <Send size={13} />
                          Email
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => runAction(row, status === "paused" ? "resume" : "pause")}
                          disabled={Boolean(busyAction)}
                        >
                          {status === "paused" ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                          {status === "paused" ? "Resume" : "Pause"}
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn danger"
                          onClick={() => runAction(row, "cancel")}
                          disabled={Boolean(busyAction)}
                        >
                          <Trash2 size={13} />
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div className="finance-modal-backdrop" role="presentation">
          <div
            className="finance-modal finance-modal-wide"
            role="dialog"
            aria-modal="true"
            aria-label="Recurring donation form"
          >
            <div className="finance-modal-head">
              <div>
                <span className="finance-kicker">Recurring Gift</span>
                <h2>{editingRow ? "Edit Recurring Donation" : "Create Recurring Donation"}</h2>
                <p>
                  Configure recurring giving details and communication preferences.
                  Provider setup is completed by backend checkout or saved payment flow.
                </p>
              </div>

              <button
                type="button"
                className="finance-icon-button"
                onClick={closeModal}
                aria-label="Close recurring donation modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveRecurring}>
              <div className="finance-form-grid three">
                <label>
                  Donor Name
                  <input
                    value={form.full_name}
                    onChange={(event) => updateForm("full_name", event.target.value)}
                    placeholder="Full name"
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                    placeholder="donor@example.com"
                  />
                </label>

                <label>
                  Phone
                  <input
                    value={form.phone}
                    onChange={(event) => updateForm("phone", event.target.value)}
                    placeholder="Phone"
                  />
                </label>

                <label>
                  Member ID
                  <input
                    value={form.member_no}
                    onChange={(event) => updateForm("member_no", event.target.value)}
                    placeholder="Optional member number"
                  />
                </label>

                <label>
                  Category
                  <select
                    value={form.category}
                    onChange={(event) => updateForm("category", event.target.value)}
                  >
                    {CATEGORY_OPTIONS.map((option) => (
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
                    placeholder="Optional"
                  />
                </label>

                <label>
                  Amount
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => updateForm("amount", event.target.value)}
                  />
                </label>

                <label>
                  Frequency
                  <select
                    value={form.frequency}
                    onChange={(event) => updateForm("frequency", event.target.value)}
                  >
                    {FREQUENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Payment Method
                  <select
                    value={form.payment_method}
                    onChange={(event) => updateForm("payment_method", event.target.value)}
                  >
                    <option value="card">Card</option>
                    <option value="ach">ACH</option>
                  </select>
                </label>

                <label>
                  Start Date
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(event) => updateForm("start_date", event.target.value)}
                  />
                </label>

                <label>
                  End Date
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(event) => updateForm("end_date", event.target.value)}
                  />
                </label>

                <label className="finance-field-full">
                  Notes
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) => updateForm("notes", event.target.value)}
                    placeholder="Internal notes..."
                  />
                </label>
              </div>

              <div className="finance-check-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={form.send_confirmation_email}
                    onChange={(event) =>
                      updateForm("send_confirmation_email", event.target.checked)
                    }
                  />
                  <span>
                    <Mail size={15} />
                    Send confirmation email
                  </span>
                </label>
              </div>

              <div className="finance-audit-empty">
                Recurring donations should use a provider tokenized card or ACH
                mandate. Never store full card or bank details in the frontend.
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
                  <CheckCircle2 size={16} />
                  {busyAction === "save" ? "Saving..." : "Save Recurring Gift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}