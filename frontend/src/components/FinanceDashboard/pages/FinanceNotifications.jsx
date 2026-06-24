// frontend/src/components/FinanceDashboard/pages/FinanceNotifications.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Mail,
  Play,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  Users,
} from "lucide-react";

import FinanceReminderSchedules from "./FinanceReminderSchedules";
import "../../../styles/finance-enterprise.css";
function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
      const value = store.getItem(key);
      if (!value || ["undefined", "null"].includes(value)) continue;

      try {
        const parsed = JSON.parse(value);
        const token =
          parsed.token ||
          parsed.access_token ||
          parsed.accessToken ||
          parsed.jwt ||
          parsed.id_token;

        if (token) return String(token).replace(/^Bearer\s+/i, "");
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

  if (token) headers.Authorization = `Bearer ${token}`;

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

function statusBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (["sent", "delivered"].includes(normalized)) {
    return "finance-badge finance-badge-success";
  }
  if (["failed", "error"].includes(normalized)) {
    return "finance-badge finance-badge-danger";
  }
  if (["sending", "queued", "pending"].includes(normalized)) {
    return "finance-badge finance-badge-warning";
  }
  return "finance-badge finance-badge-neutral";
}

const defaultCompose = {
  notification_type: "announcement",
  audience: "members",
  subject: "",
  message: "",
  send_now: true,
};

const pageStyles = `
.finance-enterprise-page {
  width: 100%;
  max-width: 1520px;
  margin: 0 auto;
  padding: 24px;
  color: #0f172a;
}

.finance-page-hero,
.finance-panel,
.finance-summary-card {
  background: #ffffff;
  border: 1px solid #cfe0f1;
  border-radius: 8px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.finance-page-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 28px;
  margin-bottom: 18px;
}

.finance-eyebrow {
  margin: 0 0 8px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.finance-page-hero h1 {
  margin: 0;
  font-size: 32px;
  line-height: 1.15;
  letter-spacing: 0;
}

.finance-page-hero p:not(.finance-eyebrow) {
  margin: 12px 0 0;
  max-width: 860px;
  color: #334155;
  font-size: 15px;
  line-height: 1.6;
}

.finance-actions,
.finance-form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.finance-btn {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid #c8d8eb;
  border-radius: 8px;
  background: #ffffff;
  color: #0f172a;
  font-weight: 800;
  cursor: pointer;
}

.finance-btn-sm {
  min-height: 34px;
  padding: 0 10px;
  font-size: 12px;
}

.finance-btn:hover {
  border-color: #2563eb;
  color: #1d4ed8;
}

.finance-btn:disabled {
  opacity: 0.62;
  cursor: not-allowed;
}

.finance-btn-primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.18);
}

.finance-btn-primary:hover {
  color: #ffffff;
  background: #1d4ed8;
}

.finance-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  margin: 0 0 18px;
  border-radius: 8px;
  font-weight: 800;
}

.finance-alert-danger {
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #be123c;
}

.finance-alert-success {
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  color: #047857;
}

.finance-summary-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.finance-summary-card {
  min-height: 126px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.finance-summary-card span {
  color: #334155;
  font-size: 14px;
}

.finance-summary-card strong {
  font-size: 28px;
  line-height: 1.1;
  letter-spacing: 0;
}

.finance-summary-card small {
  color: #64748b;
  font-size: 12px;
}

.finance-report-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
  gap: 18px;
  align-items: start;
  margin-bottom: 18px;
}

.finance-panel {
  padding: 18px;
  margin-bottom: 18px;
}

.finance-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.finance-section-title h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0;
}

.finance-form-grid,
.finance-filter-bar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.finance-form-span-2 {
  grid-column: 1 / -1;
}

.finance-form-grid label,
.finance-filter-bar label {
  display: grid;
  gap: 6px;
  color: #475569;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.finance-form-grid input,
.finance-form-grid select,
.finance-form-grid textarea,
.finance-filter-bar input,
.finance-filter-bar select {
  width: 100%;
  min-width: 0;
  border: 1px solid #c8d8eb;
  border-radius: 8px;
  background: #ffffff;
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
}

.finance-form-grid input,
.finance-form-grid select,
.finance-filter-bar input,
.finance-filter-bar select {
  height: 44px;
  padding: 0 12px;
}

.finance-form-grid textarea {
  min-height: 144px;
  padding: 12px;
  line-height: 1.5;
  resize: vertical;
}

.finance-check-row {
  min-height: 44px;
  display: flex !important;
  align-items: center;
  gap: 10px !important;
  padding: 10px 12px;
  border: 1px solid #c8d8eb;
  border-radius: 8px;
  background: #f8fafc;
  text-transform: none !important;
}

.finance-check-row input {
  width: 16px;
  height: 16px;
}

.finance-form-actions {
  margin-top: 14px;
}

.finance-metric-list {
  display: grid;
  gap: 10px;
  margin-bottom: 16px;
}

.finance-metric-list > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.finance-metric-list span {
  color: #64748b;
  font-weight: 800;
}

.finance-metric-list strong {
  font-size: 20px;
}

.finance-filter-bar {
  grid-template-columns: minmax(260px, 1fr) 170px 150px auto;
  align-items: center;
  margin-bottom: 16px;
}

.finance-search-field {
  min-width: 0;
  display: flex !important;
  align-items: center;
  gap: 8px !important;
  height: 44px;
  padding: 0 12px;
  border: 1px solid #c8d8eb;
  border-radius: 8px;
  background: #ffffff;
  text-transform: none !important;
}

.finance-search-field input {
  height: auto;
  padding: 0;
  border: 0;
  outline: 0;
}

.finance-table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid #dbe7f3;
  border-radius: 8px;
}

.finance-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  background: #ffffff;
}

.finance-table th {
  padding: 13px 14px;
  background: #f4f7fb;
  color: #475569;
  text-align: left;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.finance-table td {
  padding: 14px;
  border-top: 1px solid #e6edf5;
  color: #0f172a;
  vertical-align: top;
}

.finance-table td small {
  display: block;
  margin-top: 4px;
  color: #64748b;
}

@media (max-width: 1180px) {
  .finance-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .finance-report-grid,
  .finance-filter-bar {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .finance-enterprise-page {
    padding: 14px;
  }

  .finance-page-hero {
    flex-direction: column;
    padding: 20px;
  }

  .finance-page-hero h1 {
    font-size: 26px;
  }

  .finance-actions,
  .finance-form-actions {
    width: 100%;
    justify-content: stretch;
  }

  .finance-actions .finance-btn,
  .finance-form-actions .finance-btn {
    flex: 1 1 140px;
  }

  .finance-summary-grid,
  .finance-form-grid {
    grid-template-columns: 1fr;
  }
}
`;

export default function FinanceNotifications() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    queued: 0,
    sent: 0,
    failed: 0,
    pledge_reminders: 0,
  });
  const [filters, setFilters] = useState({
    search: "",
    type: "",
    status: "",
  });
  const [compose, setCompose] = useState(defaultCompose);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
const [showScheduleModal, setShowScheduleModal] =
  useState(false);
  const cards = useMemo(
    () => [
      {
        label: "Records",
        value: summary.total,
        note: "Matched notifications",
        icon: Bell,
      },
      {
        label: "Queued",
        value: summary.queued,
        note: "Waiting to send",
        icon: Clock3,
      },
      {
        label: "Sent",
        value: summary.sent,
        note: "Delivered or sent",
        icon: CheckCircle2,
      },
      {
        label: "Failed",
        value: summary.failed,
        note: "Needs retry",
        icon: AlertTriangle,
      },
      {
        label: "Pledge Reminders",
        value: summary.pledge_reminders,
        note: "Visible pledge follow-ups",
        icon: Users,
      },
    ],
    [summary]
  );

  function updateFilter(key, value) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateCompose(key, value) {
    setCompose((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.type) params.set("type", filters.type);
      if (filters.status) params.set("status", filters.status);
      params.set("page", "1");
      params.set("limit", "100");

      const data = await apiFetch(`/api/finance/notifications?${params.toString()}`);
      setRows(data.rows || data.notifications || []);
      setSummary({
        total: Number(data.summary?.total || data.total || 0),
        queued: Number(data.summary?.queued || 0),
        sent: Number(data.summary?.sent || 0),
        failed: Number(data.summary?.failed || 0),
        pledge_reminders: Number(data.summary?.pledge_reminders || 0),
      });
    } catch (err) {
      setError(err.message || "Failed to load notifications.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function sendNotification(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await apiFetch("/api/finance/notifications/send", {
        method: "POST",
        body: JSON.stringify(compose),
      });

      setMessage(
        data.message ||
          `Notification ${compose.send_now ? "sent" : "queued"} successfully.`
      );
      setCompose(defaultCompose);
      await load();
    } catch (err) {
      setError(err.message || "Unable to send notification.");
    } finally {
      setSaving(false);
    }
  }

  async function runQueue() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await apiFetch("/api/finance/notifications/run", {
        method: "POST",
        body: JSON.stringify({ limit: 100 }),
      });

      setMessage(
        `Queue processed: ${data.sent || 0} sent, ${data.failed || 0} failed.`
      );
      await load();
    } catch (err) {
      setError(err.message || "Unable to run notification queue.");
    } finally {
      setSaving(false);
    }
  }

  async function retry(id) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiFetch(`/api/finance/notifications/${id}/retry`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      setMessage("Notification retry completed.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to retry notification.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="finance-enterprise-page">
      <style>{pageStyles}</style>

      <section className="finance-page-hero">
        <div>
          <p className="finance-eyebrow">Notification Center</p>
          <h1>Finance Notifications</h1>
          <p>
            Send church-wide announcements, targeted finance messages, invoice
            follow-ups, pledge reminders, and program updates.
          </p>
        </div>

        <div className="finance-actions">
          <button
            type="button"
            className="finance-btn"
            onClick={load}
            disabled={loading || saving}
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={runQueue}
            disabled={loading || saving}
          >
            <Play size={16} />
            Run Queue
          </button>
        </div>
      </section>

      {error ? (
        <div className="finance-alert finance-alert-danger">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="finance-alert finance-alert-success">
          <CheckCircle2 size={16} />
          {message}
        </div>
      ) : null}

      <section className="finance-summary-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div className="finance-summary-card" key={card.label}>
              <Icon size={18} />
              <span>{card.label}</span>
              <strong>{Number(card.value || 0).toLocaleString("en-US")}</strong>
              <small>{card.note}</small>
            </div>
          );
        })}
      </section>
<section className="finance-report-grid">

  {/* =========================================
      COMPOSE NOTIFICATION
  ========================================== */}
  <form
    className="finance-panel"
    onSubmit={sendNotification}
  >
    <div className="finance-section-title">
      <Send size={18} />
      <h2>Compose Notification</h2>
    </div>

    <div className="finance-form-grid">

      <label>
        Type
        <select
          value={compose.notification_type}
          onChange={(event) => {
            const type = event.target.value;

            setCompose((prev) => ({
              ...prev,
              notification_type: type,
              audience:
                type === "pledge_reminder"
                  ? "pledge_promises"
                  : prev.audience,
            }));
          }}
        >
          <option value="new_member">
            New Member Welcome
          </option>

          <option value="holiday">
            Holiday Notification
          </option>

          <option value="event">
            Event Announcement
          </option>

          <option value="announcement">
            Church Announcement
          </option>

          <option value="program_update">
            Program Update
          </option>

          <option value="pledge_reminder">
            Pledge Reminder
          </option>

          <option value="invoice_follow_up">
            Invoice Follow-Up
          </option>
        </select>
      </label>

      <label>
        Audience
        <select
          value={compose.audience}
          onChange={(event) =>
            updateCompose(
              "audience",
              event.target.value
            )
          }
        >
          <option value="members">
            All Members
          </option>

          <option value="active_members">
            Active Members
          </option>

          <option value="finance_team">
            Finance Team
          </option>

          <option value="admins">
            Administrators
          </option>

          <option value="pledge_promises">
            Outstanding Pledges
          </option>

          <option value="pledge_invoice_recipients">
            Open Pledge Invoices
          </option>
        </select>
      </label>

      <label className="finance-form-span-2">
        Subject
        <input
          required
          value={compose.subject}
          placeholder="Notification Subject"
          onChange={(event) =>
            updateCompose(
              "subject",
              event.target.value
            )
          }
        />
      </label>

      <label className="finance-form-span-2">
        Message
        <textarea
          required
          rows={8}
          value={compose.message}
          placeholder="Enter message..."
          onChange={(event) =>
            updateCompose(
              "message",
              event.target.value
            )
          }
        />
      </label>

      <label className="finance-check-row finance-form-span-2">
        <input
          type="checkbox"
          checked={compose.send_now}
          onChange={(event) =>
            updateCompose(
              "send_now",
              event.target.checked
            )
          }
        />
        Send immediately
      </label>

    </div>

    <div className="finance-form-actions">

      <button
        type="button"
        className="finance-btn"
        onClick={() =>
          setShowScheduleModal(true)
        }
      >
        <Clock3 size={16} />
        Schedule Campaign
      </button>

      <button
        type="button"
        className="finance-btn"
        onClick={() =>
          setCompose(defaultCompose)
        }
        disabled={saving}
      >
        Reset
      </button>

      <button
        type="submit"
        className="finance-btn finance-btn-primary"
        disabled={saving}
      >
        <Mail size={16} />
        {compose.send_now
          ? "Send Notification"
          : "Queue Notification"}
      </button>

    </div>
  </form>

  {/* =========================================
      DELIVERY CONTROLS
  ========================================== */}
  <section className="finance-panel">

    <div className="finance-section-title">
      <Bell size={18} />
      <h2>Delivery Controls</h2>
    </div>

    <div className="finance-metric-list">

      <div>
        <span>Queued</span>
        <strong>{summary.queued}</strong>
      </div>

      <div>
        <span>Sent</span>
        <strong>{summary.sent}</strong>
      </div>

      <div>
        <span>Failed</span>
        <strong>{summary.failed}</strong>
      </div>

      <div>
        <span>Pledge Reminders</span>
        <strong>
          {summary.pledge_reminders}
        </strong>
      </div>

    </div>

    <button
      type="button"
      className="finance-btn finance-btn-primary"
      onClick={runQueue}
      disabled={saving}
    >
      <Play size={16} />
      Send Queued Notifications
    </button>

    <div
      style={{
        marginTop: 18,
        padding: 14,
        background: "#f8fafc",
        borderRadius: 8,
        border: "1px solid #dbeafe",
      }}
    >
      <strong>
        Automated Reminder Campaigns
      </strong>

      <p
        style={{
          marginTop: 8,
          color: "#475569",
          fontSize: 13,
          lineHeight: 1.7,
        }}
      >
        Finance teams can create
        weekly, biweekly, and monthly
        pledge reminder campaigns that
        automatically send emails to
        members and external donors with
        outstanding balances.
      </p>

      <button
        type="button"
        className="finance-btn"
        onClick={() =>
          setShowScheduleModal(true)
        }
      >
        Manage Schedules
      </button>
    </div>

  </section>

</section>

{/* 
      <section className="finance-report-grid">
        <form className="finance-panel" onSubmit={sendNotification}>
          <div className="finance-section-title">
            <Send size={18} />
            <h2>Compose Notification</h2>
          </div>

          <div className="finance-form-grid">
            <label>
              Type
              <select
                value={compose.notification_type}
                // onChange={(event) =>
                //   updateCompose("notification_type", event.target.value)
                // }
                onChange={(event) => {
  const type = event.target.value;

  setCompose((prev) => ({
    ...prev,
    notification_type: type,
    audience:
      type === "pledge_reminder"
        ? "pledge_promises"
        : prev.audience,
  }));
}}
              >
                <option value="new_member">New Member Welcome</option>
                <option value="holiday">Holiday Notification</option>
                <option value="event">Event Announcement</option>
                <option value="announcement">Church Announcement</option>
                <option value="program_update">Program Update</option>
                <option value="pledge_reminder">Pledge Reminder</option>
                <option value="invoice_follow_up">Invoice Follow-Up</option>
              </select>
            </label>

            <label>
              Audience
              <select
                value={compose.audience}
                onChange={(event) => updateCompose("audience", event.target.value)}
              >
                <option value="members">All Members</option>
                <option value="active_members">Active Members</option>
                <option value="finance_team">Finance Team</option>
                <option value="admins">Admins</option>
                <option value="pledge_promises">Members With Outstanding Pledges</option>
                <option value="pledge_invoice_recipients">Open Pledge Invoices</option>
              </select>
            </label>

            <label className="finance-form-span-2">
              Subject
              <input
                value={compose.subject}
                onChange={(event) => updateCompose("subject", event.target.value)}
                placeholder="Subject"
                required
              />
            </label>

            <label className="finance-form-span-2">
              Message
              <textarea
                value={compose.message}
                onChange={(event) => updateCompose("message", event.target.value)}
                placeholder="Write the message to send..."
                rows={8}
                required
              />
            </label>

            <label className="finance-check-row finance-form-span-2">
              <input
                type="checkbox"
                checked={compose.send_now}
                onChange={(event) => updateCompose("send_now", event.target.checked)}
              />
              Send immediately
            </label>
          </div>

          <div className="finance-form-actions">
            <button
              type="button"
              className="finance-btn"
              onClick={() => setCompose(defaultCompose)}
              disabled={saving}
            >
              Reset
            </button>
            <button
              type="submit"
              className="finance-btn finance-btn-primary"
              disabled={saving}
            >
              <Mail size={16} />
              {compose.send_now ? "Send Notification" : "Queue Notification"}
            </button>
          </div>

        </form>

        <section className="finance-panel">
          <div className="finance-section-title">
            <Bell size={18} />
            <h2>Delivery Controls</h2>
          </div>

          <div className="finance-metric-list">
            <div>
              <span>Queued</span>
              <strong>{summary.queued}</strong>
            </div>
            <div>
              <span>Sent</span>
              <strong>{summary.sent}</strong>
            </div>
            <div>
              <span>Failed</span>
              <strong>{summary.failed}</strong>
            </div>
          </div>

          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={runQueue}
            disabled={saving}
          >
            <Play size={16} />
            Send Queued Notifications
          </button>
        </section>
      </section> */}

      <section className="finance-panel">
        <div className="finance-filter-bar">
          <label className="finance-search-field">
            <Search size={18} />
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search recipient, email, subject, reference..."
            />
          </label>

          <select
            value={filters.type}
            onChange={(event) => updateFilter("type", event.target.value)}
          >
            <option value="">All Types</option>
            <option value="new_member">New Member</option>
            <option value="holiday">Holiday</option>
            <option value="event">Event</option>
            <option value="announcement">Announcement</option>
            <option value="program_update">Program Update</option>
            <option value="pledge_reminder">Pledge</option>
            <option value="invoice_follow_up">Invoice</option>
          </select>

          <select
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>

          <button type="button" className="finance-btn" onClick={load}>
            Search
          </button>
        </div>

        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Type</th>
                <th>Recipient</th>
                <th>Email</th>
                <th>Subject</th>
                <th>Related</th>
                <th>Status</th>
                <th>Last Attempt</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.created_at)}</td>
                  <td>
                    <Mail size={14} />
                    {pretty(row.notification_type || row.type)}
                  </td>
                  <td>{row.recipient_name || "--"}</td>
                  <td>{row.recipient_email || row.email || "--"}</td>
                  <td>{row.subject || "--"}</td>
                  <td>
                    {row.related_number || row.related_id || "--"}
                    {row.related_entity ? <small>{pretty(row.related_entity)}</small> : null}
                  </td>
                  <td>
                    <span className={statusBadge(row.status)}>
                      {pretty(row.status)}
                    </span>
                  </td>
                  <td>{formatDate(row.last_attempt_at || row.sent_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="finance-btn finance-btn-sm"
                      onClick={() => retry(row.id)}
                      disabled={saving}
                    >
                      <RotateCcw size={14} />
                      Retry
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan="9">No notification records found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
     {showScheduleModal && (
  <div className="finance-modal-backdrop">

    <div
      className="finance-modal-card"
      style={{
        width: "95vw",
        maxWidth: "1800px",
        height: "92vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: 24,
      }}
    >

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 16,
          marginBottom: 16,
          borderBottom: "1px solid #e2e8f0",
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          Reminder Campaign Scheduler
        </h2>

        <button
          type="button"
          className="finance-btn"
          onClick={() =>
            setShowScheduleModal(false)
          }
        >
          Close
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          paddingRight: 6,
        }}
      >
        <FinanceReminderSchedules
          onSaved={() => {
            load?.();
          }}
        />
      </div>

    </div>

  </div>
)}
    </div>
  );
}

