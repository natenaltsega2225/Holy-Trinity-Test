// frontend/src/components/FinanceDashboard/pages/FinanceAuditLogs.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  RefreshCcw,
  Search,
  ShieldCheck,
} from "lucide-react";

// import "../../../styles/shared-payment-components.css";
// import "../../../styles/finance-dashboard.css";
import "../../../styles/finance-enterprise.css";
const PAGE_SIZE = 25;

function readAuthToken() {
  const tokenKeys = [
    "ht_token",
    "access_token",
    "accessToken",
    "auth_token",
    "authToken",
    "token",
    "jwt",
    "jwtToken",
    "id_token",
    "holy_token",
    "holy_access_token",
  ];

  const objectKeys = [
    "ht_auth",
    "auth",
    "holy_auth",
    "ht_user",
    "user",
    "authUser",
    "currentUser",
  ];

  const stores = [window.localStorage, window.sessionStorage].filter(Boolean);

  for (const store of stores) {
    for (const key of tokenKeys) {
      const value = store.getItem(key);
      if (value && !["undefined", "null"].includes(value)) {
        return String(value).replace(/^Bearer\s+/i, "");
      }
    }

    for (const key of objectKeys) {
      const raw = store.getItem(key);
      if (!raw) continue;

      try {
        const value = JSON.parse(raw);
        const token =
          value?.accessToken ||
          value?.access_token ||
          value?.token ||
          value?.jwt ||
          value?.auth?.token;

        if (token) {
          return String(token).replace(/^Bearer\s+/i, "");
        }
      } catch (_err) {}
    }
  }

  return "";
}

async function apiFetch(path, options = {}) {
  const token = readAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers,
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch (_err) {
    data = { raw: text };
  }

  if (response.status === 401) {
    throw new Error("Your finance session expired. Please sign in again.");
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || data.message || `Request failed (${response.status}).`);
  }

  return data;
}

function formatDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function pretty(value) {
  const text = String(value || "--").replaceAll("_", " ");
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeRows(data) {
  return data.rows || data.audit_logs || data.logs || data.data || [];
}

function statusClass(value) {
  const text = String(value || "").toLowerCase();
  if (["success", "completed", "recorded", "info"].includes(text)) return "success";
  if (["warning", "pending", "review"].includes(text)) return "warning";
  if (["error", "failed", "danger", "critical"].includes(text)) return "danger";
  return "neutral";
}

function exportCsv(rows) {
  const headers = [
    "Created At",
    "Actor",
    "Email",
    "Action",
    "Entity",
    "Entity ID",
    "Reference",
    "IP Address",
    "Description",
  ];

  const body = rows.map((row) => [
    formatDate(row.created_at),
    row.actor_name || "--",
    row.actor_email || "--",
    row.action || "--",
    row.entity || row.entity_type || "--",
    row.entity_id || "--",
    row.reference_no || "--",
    row.ip_address || "--",
    row.description || "--",
  ]);

  const csv = [headers, ...body]
    .map((line) =>
      line
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `finance-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function FinanceAuditLogs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const stats = useMemo(() => {
    const dangerous = rows.filter((row) =>
      ["error", "failed", "danger", "critical"].includes(
        String(row.severity || row.status || "").toLowerCase()
      )
    ).length;

    return {
      records: total || rows.length,
      users: new Set(rows.map((row) => row.actor_email).filter(Boolean)).size,
      entities: new Set(rows.map((row) => row.entity || row.entity_type).filter(Boolean)).size,
      alerts: dangerous,
    };
  }, [rows, total]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (search.trim()) params.set("search", search.trim());
      if (action) params.set("action", action);
      if (entity) params.set("entity", entity);

      const data = await apiFetch(`/api/finance/audit-logs?${params.toString()}`);

      setRows(normalizeRows(data));
      setTotal(Number(data.total || normalizeRows(data).length || 0));
    } catch (err) {
      setError(err.message || "Failed to load finance audit logs.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function submitSearch(e) {
    e.preventDefault();
    setPage(1);
    load();
  }

  return (
    <div className="finance-page">
      <section className="finance-hero">
        <div>
          <p className="finance-eyebrow">Finance Audit</p>
          <h1>Audit Logs</h1>
          <p>
            Review finance activity, security events, document actions, payment activity,
            and system changes from one controlled audit view.
          </p>
        </div>

        <div className="finance-actions">
          <button type="button" className="finance-btn" onClick={load} disabled={loading}>
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button
            type="button"
            className="finance-btn"
            onClick={() => exportCsv(rows)}
            disabled={!rows.length}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </section>

      {error ? (
        <div className="finance-alert finance-alert-danger">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}

      <section className="finance-summary-grid">
        <div className="finance-summary-card">
          <span>Records</span>
          <strong>{stats.records}</strong>
          <small>Total matched logs</small>
        </div>
        <div className="finance-summary-card">
          <span>Actors</span>
          <strong>{stats.users}</strong>
          <small>Visible users</small>
        </div>
        <div className="finance-summary-card">
          <span>Entities</span>
          <strong>{stats.entities}</strong>
          <small>Finance areas touched</small>
        </div>
        <div className="finance-summary-card">
          <span>Alerts</span>
          <strong>{stats.alerts}</strong>
          <small>Warning or failed events</small>
        </div>
      </section>

      <section className="finance-panel">
        <form className="finance-filter-bar" onSubmit={submitSearch}>
          <label className="finance-search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actor, email, action, entity, IP, reference..."
            />
          </label>

          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All Actions</option>
            <option value="login_success">Login Success</option>
            <option value="member_updated">Member Updated</option>
            <option value="invoice_created">Invoice Created</option>
            <option value="invoice_emailed">Invoice Emailed</option>
            <option value="payment_created">Payment Created</option>
            <option value="receipt_created">Receipt Created</option>
            <option value="expense_created">Expense Created</option>
          </select>

          <select value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">All Entities</option>
            <option value="auth">Auth</option>
            <option value="member">Member</option>
            <option value="invoice">Invoice</option>
            <option value="payment">Payment</option>
            <option value="receipt">Receipt</option>
            <option value="expense">Expense</option>
            <option value="settings">Settings</option>
          </select>

          {/* <button type="submit" className="finance-btn finance-btn-primary">
            Search
          </button> */}
          
        </form>

        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Reference</th>
                <th>IP</th>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.created_at)}</td>
                  <td>
                    <strong>{row.actor_name || "--"}</strong>
                    <small>{row.actor_email || "--"}</small>
                  </td>
                  <td>{pretty(row.action || row.event_type)}</td>
                  <td>
                    <strong>{pretty(row.entity || row.entity_type)}</strong>
                    <small>{row.entity_id || "--"}</small>
                  </td>
                  <td>{row.reference_no || "--"}</td>
                  <td>{row.ip_address || "--"}</td>
                  <td>
                    <span className={`finance-badge finance-badge-${statusClass(row.severity || row.status)}`}>
                      {pretty(row.severity || row.status || "recorded")}
                    </span>
                  </td>
                  <td>{row.description || "--"}</td>
                </tr>
              ))}

              {!rows.length ? (
                <tr>
                  <td colSpan="8">
                    <div className="finance-empty-state">
                      <ShieldCheck size={28} />
                      <strong>{loading ? "Loading audit logs..." : "No audit activity found."}</strong>
                      <span>Audit records will appear here after finance activity is recorded.</span>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="finance-pagination-row">
          <button
            type="button"
            className="finance-btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.max(1, Math.ceil((total || rows.length || 1) / PAGE_SIZE))}
          </span>
          <button
            type="button"
            className="finance-btn"
            disabled={loading || page >= Math.ceil((total || rows.length || 1) / PAGE_SIZE)}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
