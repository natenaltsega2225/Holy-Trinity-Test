
// frontend/src/components/FinanceDashboard/pages/MemberManagement.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  FileText,
  Mail,
  Plus,
  RefreshCcw,
  Search,
  Target,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";
import FinanceActionMenu from "../components/FinanceActionMenu"

const STATUS_OPTIONS = [
  { value: "", label: "All Membership" },
  { value: "active", label: "Active" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "inactive", label: "Inactive" },
  { value: "overdue", label: "Overdue" },
];

const ACCOUNT_OPTIONS = [
  { value: "", label: "All Accounts" },
  { value: "active", label: "Active Account" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "pending_password_change", label: "Password Change Required" },
  { value: "inactive", label: "Inactive Account" },
  { value: "locked", label: "Locked" },
];

const HOUSEHOLD_OPTIONS = [
  { value: "", label: "All Household Types" },
  { value: "family", label: "Family" },
  { value: "individual", label: "Individual" },
  { value: "single", label: "Single" },
  { value: "household", label: "Household" },
];

function clean(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return `$${numberValue(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function firstValue(source = {}, keys = [], fallback = "") {
  for (const key of keys) {
    const value = source?.[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
}

function formatDate(value) {
  if (!value) return "--";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return String(value);
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(value) {
  const status = String(value || "").toLowerCase();

  if (["active", "paid", "completed", "current"].includes(status)) {
    return "success";
  }

  if (["pending", "pending_payment", "open", "partial", "pending_password_change"].includes(status)) {
    return "warning";
  }

  if (["inactive", "overdue", "failed", "locked", "cancelled"].includes(status)) {
    return "danger";
  }

  return "neutral";
}

function StatusBadge({ value }) {
  return (
    <span className={`finance-status-badge ${statusTone(value)}`}>
      {pretty(value)}
    </span>
  );
}

function normalizeRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.members)) return data.members;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;
  if (Array.isArray(data?.data?.members)) return data.data.members;

  return [];
}

function normalizeMeta(data, fallbackLimit) {
  const meta = data?.pagination || data?.meta || data?.data?.pagination || data?.data?.meta || {};

  return {
    page: Number(meta.page || data?.page || 1),
    limit: Number(meta.limit || meta.pageSize || fallbackLimit),
    total: Number(meta.total || data?.total || data?.count || 0),
    totalPages: Number(meta.totalPages || meta.total_pages || 1),
  };
}

function memberId(row = {}) {
  return firstValue(row, ["id", "member_id"], "");
}

function memberNo(row = {}) {
  return firstValue(row, ["member_no", "member_number", "membership_id"], "--");
}

function fullName(row = {}) {
  return firstValue(
    row,
    ["full_name", "full_name_snapshot", "name"],
    `${firstValue(row, ["first_name"], "")} ${firstValue(row, ["last_name"], "")}`.trim() || "--"
  );
}

function memberEmail(row = {}) {
  return firstValue(row, ["email", "email_snapshot", "primary_email"], "--");
}

function memberPhone(row = {}) {
  return firstValue(row, ["phone", "phone_snapshot", "primary_phone"], "--");
}

function memberBalance(row = {}) {
  return numberValue(
    firstValue(
      row,
      [
        "balance",
        "balance_due",
        "outstanding_balance",
        "membership_balance",
        "open_balance",
      ],
      0
    )
  );
}

function totalPaid(row = {}) {
  return numberValue(
    firstValue(row, ["total_paid", "paid_total", "amount_paid", "lifetime_total"], 0)
  );
}

async function postFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      return await api.post(endpoint, payload);
    } catch (err) {
      lastError = err;

      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) {
        throw err;
      }
    }
  }

  throw lastError || new Error("No endpoint is available.");
}

export default function MemberManagement() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [householdType, setHouseholdType] = useState("");

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");

  const loadMembers = useCallback(
    async (nextPage = meta.page) => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();

        params.set("q", search);
        params.set("search", search);
        params.set("period", "all");
        params.set("page", String(nextPage));
        params.set("limit", String(meta.limit));
        params.set("pageSize", String(meta.limit));
        params.set("status", status);
        params.set("accountStatus", accountStatus);
        params.set("householdType", householdType);

        const res = await api.get(`/finance/members?${params.toString()}`);
        const data = res.data || {};

        setRows(normalizeRows(data));
        setMeta(normalizeMeta(data, meta.limit));
      } catch (err) {
        setError(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load members."
        );
      } finally {
        setLoading(false);
      }
    },
    [search, status, accountStatus, householdType, meta.page, meta.limit]
  );

  useEffect(() => {
    loadMembers(1);
  }, [search, status, accountStatus, householdType]);

  const summary = useMemo(() => {
    const visibleTotalPaid = rows.reduce((sum, row) => sum + totalPaid(row), 0);
    const visibleBalance = rows.reduce((sum, row) => sum + memberBalance(row), 0);

    const active = rows.filter((row) =>
      String(firstValue(row, ["membership_status", "status"], "")).toLowerCase() === "active"
    ).length;

    const pendingPayment = rows.filter((row) =>
      String(firstValue(row, ["membership_status", "status", "payment_status"], "")).toLowerCase()
        .includes("pending")
    ).length;

    return {
      records: meta.total || rows.length,
      active,
      pendingPayment,
      visibleTotalPaid,
      visibleBalance,
    };
  }, [rows, meta.total]);

  async function sendWelcomeEmail(row) {
    const id = memberId(row);

    if (!id) return;

    setActionLoading(`welcome-${id}`);
    setError("");
    setSuccessText("");

    try {
      await postFirst(
        [
          `/finance/members/${id}/welcome-email`,
          `/finance/registration/${id}/welcome-email`,
          `/members/${id}/welcome-email`,
        ],
        {
          member_id: id,
          member_no: memberNo(row),
          email: memberEmail(row),
          send_welcome_email: true,
        }
      );

      setSuccessText(`Welcome email sent to ${fullName(row)}.`);
      await loadMembers(meta.page);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to send welcome email."
      );
    } finally {
      setActionLoading("");
    }
  }

  function goProfile(row, tab = "overview") {
    const id = memberId(row);

    if (!id) return;

    navigate(`/dash/finance/members/${id}/${tab}`);
  }

  function goPayment(row) {
    const id = memberId(row);

    navigate(
      `/dash/finance/payments?member_id=${encodeURIComponent(id)}&member_no=${encodeURIComponent(
        memberNo(row)
      )}`
    );
  }

  function goInvoice(row) {
    const id = memberId(row);

    navigate(
      `/dash/finance/invoice-generator?member_id=${encodeURIComponent(
        id
      )}&member_no=${encodeURIComponent(memberNo(row))}`
    );
  }

  function goPledge(row) {
    const id = memberId(row);

    navigate(
      `/dash/finance/pledges?member_id=${encodeURIComponent(id)}&member_no=${encodeURIComponent(
        memberNo(row)
      )}`
    );
  }

  function changePage(nextPage) {
    const safePage = Math.min(Math.max(1, nextPage), Math.max(1, meta.totalPages || 1));
    setMeta((current) => ({ ...current, page: safePage }));
    loadMembers(safePage);
  }

  return (

    <div className="finance-page finance-members-page">
      
      <div className="finance-page-header">
        <div>
          <p className="finance-eyebrow">Finance Members</p>
          <h1>Member Management</h1>
          <p className="finance-page-subtitle">
            Search members, review balances, open profiles, add dependents, collect payments,
            create invoices, and start pledge workflows.
          </p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={() => loadMembers(meta.page)}
            disabled={loading}
          >
            <RefreshCcw size={16} className={loading ? "finance-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={() => navigate("/dash/finance/registration")}
          >
            <UserPlus size={16} />
            New Member
          </button>
        </div>
      </div>

      {error ? (
        <div className="finance-alert finance-alert-danger">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      {successText ? (
        <div className="finance-alert finance-alert-success">
          <CheckCircle2 size={17} />
          <span>{successText}</span>
        </div>
      ) : null}

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <span>Records</span>
          <strong>{summary.records.toLocaleString()}</strong>
          <small>Total matched members</small>
        </div>

        <div className="finance-summary-card">
          <span>Active</span>
          <strong>{summary.active.toLocaleString()}</strong>
          <small>Visible active members</small>
        </div>

        <div className="finance-summary-card">
          <span>Pending Payment</span>
          <strong>{summary.pendingPayment.toLocaleString()}</strong>
          <small>Visible pending rows</small>
        </div>

        <div className="finance-summary-card">
          <span>Visible Paid</span>
          <strong>{money(summary.visibleTotalPaid)}</strong>
          <small>Current page total</small>
        </div>

        <div className="finance-summary-card">
          <span>Visible Balance</span>
          <strong>{money(summary.visibleBalance)}</strong>
          <small>Current page balance</small>
        </div>
      </div>

      <section className="finance-panel">
        
        <div className="finance-toolbar">
          <label className="finance-search-field">
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by member ID, name, email, phone, or address..."
            />
          </label>

          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={accountStatus}
            onChange={(event) => setAccountStatus(event.target.value)}
          >
            {ACCOUNT_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={householdType}
            onChange={(event) => setHouseholdType(event.target.value)}
          >
            {HOUSEHOLD_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="finance-table-wrap">
          <table className="finance-table finance-members-table">
            <thead>
              <tr>
  <th>Member ID</th>
  <th>Member</th>
  <th>Email</th>
  <th>Phone</th>
  <th>Membership</th>
  <th>Account</th>
  <th>Dependents</th>
  <th>Balance</th>
  <th>Total Paid</th>
  <th>Registered</th>
  <th>Actions</th>
</tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11}>
                    <div className="finance-table-loading">
                      <RefreshCcw size={17} className="finance-spin" />
                      Loading members...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && !rows.length ? (
                <tr>
                  <td colSpan={11}>
                    <div className="finance-empty-state">No members found.</div>
                  </td>
                </tr>
              ) : null}

              {!loading
                ? rows.map((row) => {
                    const id = memberId(row);
                    const welcomeLoading = actionLoading === `welcome-${id}`;

                    return (
                      <tr key={id || memberNo(row)}>
  <td>{memberNo(row)}</td>

  <td>
    <strong>{row.full_name || "--"}</strong>
    <small>{row.household_type || ""}</small>
  </td>

  <td>{memberEmail(row)}</td>

<td>{memberPhone(row)}</td>
  <td>
    <span className="finance-badge finance-badge-success">
      {row.membership_status || "Active"}
    </span>
  </td>

  <td>{row.account_status || "--"}</td>

  <td>{row.dependents_count || 0}</td>

  <td>{money(row.balance)}</td>

  <td>{money(row.total_paid)}</td>

  <td>{formatDate(row.created_at || row.registered_at)}</td>

  <td className="finance-action-cell">
    <FinanceActionMenu
      row={row}
      
      actions={[
  {
    key: "edit",
    label: "Edit Member",
    onClick: () =>
      navigate(
        `/dash/finance/members/${memberId(row)}/edit`
      ),
  },

  {
    key: "profile",
    onClick: () => goProfile(row),
  },

  {
    key: "pay",
    onClick: () => goPayment(row),
  },

  {
    key: "invoice",
    onClick: () => goInvoice(row),
  },

  {
    key: "pledge",
    onClick: () => goPledge(row),
  },

  {
    key: "family",
    onClick: () => goProfile(row, "dependents"),
  },

  {
    key: "email",
    onClick: () => sendWelcomeEmail(row),
    disabled: welcomeLoading,
  },
]}

    />
  </td>
</tr>

                    );
                  })
                : null}
            </tbody>
          </table>
        </div>

        <div className="finance-pagination-bar">
          <span>
            Page {meta.page} of {Math.max(1, meta.totalPages || 1)}
            {meta.total ? ` · ${meta.total.toLocaleString()} records` : ""}
          </span>

          <div>
            <button
              type="button"
              className="finance-btn finance-btn-light"
              onClick={() => changePage(meta.page - 1)}
              disabled={loading || meta.page <= 1}
            >
              Previous
            </button>

            <button
              type="button"
              className="finance-btn finance-btn-light"
              onClick={() => changePage(meta.page + 1)}
              disabled={loading || meta.page >= Math.max(1, meta.totalPages || 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}