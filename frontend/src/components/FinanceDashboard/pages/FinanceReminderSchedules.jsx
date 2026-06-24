
// frontend/src/components/FinanceDashboard/pages/FinanceReminderSchedules.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Edit,
  PauseCircle,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

function readAuthToken() {
  const keys = ["ht_token", "access_token", "accessToken", "auth_token", "token"];

  for (const key of keys) {
    const value = localStorage.getItem(key);

    if (value && value !== "undefined" && value !== "null") {
      return value.replace(/^Bearer\s+/i, "");
    }
  }

  return "";
}

async function apiFetch(path, options = {}) {
  const token = readAuthToken();

  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch (_err) {
    data = { raw: text };
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || data.message || `Request failed (${response.status}).`);
  }

  return data;
}

const emptyForm = {
  schedule_name: "",
  frequency: "weekly",
  start_date: "",
  end_date: "",
  email_subject: "",
  email_template: "",
};

function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function prettyFrequency(value) {
  return String(value || "")
    .replace("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function FinanceReminderSchedules({ onSaved }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
const [historyOpen, setHistoryOpen] =
  useState(false);

const [historyRows, setHistoryRows] =
  useState([]);

  const activeCount = useMemo(
    () => rows.filter((row) => Number(row.active) === 1).length,
    [rows]
  );

  function updateField(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setMessage("");
  }

  async function loadSchedules() {
    try {
      setLoading(true);
      setError("");

    const data = await apiFetch(
  "/api/finance/reminder-schedules"
);

console.log(
  "Reminder schedules:",
  data
);

const schedules =
  Array.isArray(data.rows)
    ? data.rows
    : Array.isArray(data.schedules)
    ? data.schedules
    : [];

setRows(schedules);
    } catch (err) {
      setError(err.message || "Failed to load reminder schedules.");
    } finally {
      setLoading(false);
    }
  }


  async function saveSchedule(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (editingId) {
        await apiFetch(`/api/finance/reminder-schedules/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });

        setMessage("Reminder schedule updated successfully.");
      } else {
        await apiFetch("/api/finance/reminder-schedules", {
          method: "POST",
          body: JSON.stringify(form),
        });

        setMessage("Reminder schedule created successfully.");
      }

   const wasEditing = Boolean(editingId);

resetForm();

await loadSchedules();

setMessage(
  wasEditing
    ? "Reminder schedule updated successfully."
    : "Reminder schedule created successfully."
);

onSaved?.();

    } catch (err) {
      setError(err.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  }

  function editRow(row) {
    setEditingId(row.id);

    setForm({
      schedule_name: row.schedule_name || "",
      frequency: row.frequency || "weekly",
      start_date: dateOnly(row.start_date),
      end_date: dateOnly(row.end_date),
      email_subject: row.email_subject || "",
      email_template: row.email_template || "",
    });

    setError("");
    setMessage("");
  }

  async function toggleStatus(row) {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      await apiFetch(`/api/finance/reminder-schedules/${row.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          active: Number(row.active) === 1 ? 0 : 1,
        }),
      });

      setMessage(Number(row.active) === 1 ? "Schedule paused." : "Schedule resumed.");

      await loadSchedules();
    } catch (err) {
      setError(err.message || "Failed to update schedule status.");
    } finally {
      setSaving(false);
    }
  }

  async function runNow(row) {
    if (
      !window.confirm(
        `Send this scheduled reminder now?\n\n${row.schedule_name || "Reminder Schedule"}`
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const data = await apiFetch(`/api/finance/reminder-schedules/${row.id}/run`, {
        method: "POST",
        body: JSON.stringify({
          force: true,
        }),
      });

      setMessage(
        data.message ||
          `Schedule executed. Emails queued/sent: ${Number(data.sent || data.count || 0)}.`
      );

      await loadSchedules();
    } catch (err) {
      setError(err.message || "Failed to run schedule.");
    } finally {
      setSaving(false);
    }
  }
async function openRunHistory(scheduleId) {
  try {
    setError("");

    const data = await apiFetch(
      `/api/finance/reminder-schedules/${scheduleId}/history`
    );

    setHistoryRows(
      Array.isArray(data.rows)
        ? data.rows
        : []
    );

    setHistoryOpen(true);
  } catch (err) {
    setError(
      err.message ||
      "Failed loading reminder history."
    );
  }
}
  async function deleteSchedule(row) {
    if (
      !window.confirm(
        `Delete this reminder schedule?\n\n${row.schedule_name || "Reminder Schedule"}`
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      await apiFetch(`/api/finance/reminder-schedules/${row.id}`, {
        method: "DELETE",
      });

      if (Number(editingId) === Number(row.id)) {
        resetForm();
      }

      setMessage("Schedule deleted successfully.");

      await loadSchedules();
    } catch (err) {
      setError(err.message || "Failed to delete schedule.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadSchedules();
  }, []);

  return (
    <div className="finance-enterprise-page">
      <div className="finance-page-hero">
        <div>
          <h1>Reminder Schedules</h1>
          <p>
            Create, edit, pause, resend, and delete automated pledge reminder
            campaigns for members and non-members with outstanding pledge invoices.
          </p>
        </div>

        <button
          type="button"
          className="finance-btn"
          onClick={loadSchedules}
          disabled={loading || saving}
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

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

      <section className="finance-panel">
        <div className="finance-section-title">
          <Calendar size={18} />
          <h2>{editingId ? "Edit Reminder Schedule" : "Create Reminder Schedule"}</h2>
        </div>

        <form onSubmit={saveSchedule}>
          <div className="finance-form-grid">
            <label>
              Schedule Name
              <input
                value={form.schedule_name}
                onChange={(e) => updateField("schedule_name", e.target.value)}
                placeholder="Weekly Pledge Reminder"
                required
              />
            </label>

            <label>
              Frequency
              <select
                value={form.frequency}
                onChange={(e) => updateField("frequency", e.target.value)}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>

            <label>
              Start Date
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => updateField("start_date", e.target.value)}
                required
              />
            </label>

            <label>
              End Date
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => updateField("end_date", e.target.value)}
              />
            </label>

            <label className="finance-form-span-2">
              Email Subject
              <input
                value={form.email_subject}
                onChange={(e) => updateField("email_subject", e.target.value)}
                placeholder="Pledge Reminder"
                required
              />
            </label>

            <label className="finance-form-span-2">
              Email Template
              <textarea
                rows={8}
                value={form.email_template}
                onChange={(e) => updateField("email_template", e.target.value)}
                placeholder="Write the reminder message..."
                required
              />
            </label>
          </div>

          <div className="finance-form-actions">
            {editingId ? (
              <button
                type="button"
                className="finance-btn"
                onClick={resetForm}
                disabled={saving}
              >
                <X size={16} />
                Cancel Edit
              </button>
            ) : null}

            <button
              type="submit"
              className="finance-btn finance-btn-primary"
              disabled={saving}
            >
              <Plus size={16} />
              {editingId ? "Update Schedule" : "Submit Schedule"}
            </button>
          </div>
        </form>
      </section>

<section
  className="finance-panel"
  style={{
    marginTop: 24,
    width: "100%",
    overflow: "hidden",
  }}
>
  <div className="finance-section-title">
    <Calendar size={18} />
    <h2>Scheduled Campaigns</h2>
  </div>

  <p
    style={{
      marginTop: -6,
      marginBottom: 18,
      color: "#64748b",
      fontSize: 13,
    }}
  >
    {rows.length} total schedule(s),
    {" "}
    {activeCount} active.
  </p>

  <div
    className="finance-table-wrap"
    style={{
      overflowX: "auto",
      overflowY: "visible",
      border: "1px solid #e2e8f0",
      borderRadius: 12,
      background: "#fff",
    }}
  >
    <table
      className="finance-table"
      style={{
        minWidth: "1650px",
        width: "100%",
      }}
    >
      <thead>
        <tr>
          <th>Name</th>
          <th>Frequency</th>
          <th>Start Date</th>
          <th>End Date</th>
          <th>Status</th>
          
          <th>Last Run</th>
          <th>Next Run</th>
          <th>Total Sent</th>
          <th>Failed</th>
          <th>Runs</th>

```
      <th
        style={{
          minWidth: 420,
          position: "sticky",
          right: 0,
          background: "#fff",
          zIndex: 20,
        }}
      >
        Actions
      </th>
    </tr>
  </thead>

  <tbody>
    {rows.map((row) => {
      const active =
        Number(row.active) === 1;

      return (
        <tr key={row.id}>
          <td>
            <strong>
              {row.schedule_name ||
                "--"}
            </strong>

            <br />

            <small
              style={{
                color: "#64748b",
              }}
            >
              {row.email_subject ||
                "--"}
            </small>
          </td>

          <td>
            {prettyFrequency(
              row.frequency
            )}
          </td>

          <td>
            {dateOnly(
              row.start_date
            ) || "--"}
          </td>

          <td>
            {dateOnly(
              row.end_date
            ) || "--"}
          </td>

          <td>
            <span
              className={
                active
                  ? "finance-badge finance-badge-success"
                  : "finance-badge finance-badge-warning"
              }
            >
              {active
                ? "Active"
                : "Paused"}
            </span>
          </td>

          <td>
            {row.last_run_at
              ? new Date(
                  row.last_run_at
                ).toLocaleString()
              : "--"}
          </td>

          <td>
            {row.next_run_at
              ? new Date(
                  row.next_run_at
                ).toLocaleDateString()
              : "--"}
          </td>

          <td>
            {Number(
              row.total_emails_sent || 0
            ).toLocaleString()}
          </td>

          <td>
            {Number(
              row.total_emails_failed || 0
            ).toLocaleString()}
          </td>

          <td>
            {Number(
              row.total_runs || 0
            ).toLocaleString()}
          </td>

          <td
            style={{
              position: "sticky",
              right: 0,
              background: "#fff",
              zIndex: 10,
              minWidth: 420,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "nowrap",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                className="finance-btn finance-btn-sm"
                onClick={() =>
                  editRow(row)
                }
                disabled={saving}
              >
                <Edit size={14} />
                Edit
              </button>

              <button
                type="button"
                className="finance-btn finance-btn-sm"
                onClick={() =>
                  openRunHistory(
                    row.id
                  )
                }
              >
                History
              </button>

              <button
                type="button"
                className="finance-btn finance-btn-success finance-btn-sm"
                onClick={() =>
                  runNow(row)
                }
                disabled={saving}
              >
                <RotateCcw size={14} />
                Run Now
              </button>

              <button
                type="button"
                className="finance-btn finance-btn-warning finance-btn-sm"
                onClick={() =>
                  toggleStatus(row)
                }
                disabled={saving}
              >
                {active ? (
                  <>
                    <PauseCircle size={14} />
                    Pause
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Resume
                  </>
                )}
              </button>

              <button
                type="button"
                className="finance-btn finance-btn-danger finance-btn-sm"
                onClick={() =>
                  deleteSchedule(row)
                }
                disabled={saving}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </td>
        </tr>
      );
    })}

    {rows.length === 0 && (
      <tr>
        <td
          colSpan={11}
          style={{
            textAlign: "center",
            padding: 40,
            color: "#64748b",
          }}
        >
          No reminder schedules found.
        </td>
      </tr>
    )}
  </tbody>
</table>
```

  </div>
</section>




      {historyOpen && (
  <div className="finance-modal-overlay">
    <div className="finance-modal">
      <div className="finance-modal-header">
        <h3>Reminder Run History</h3>

        <button
          type="button"
          className="finance-btn"
          onClick={() =>
            setHistoryOpen(false)
          }
        >
          Close
        </button>
      </div>

      <table className="finance-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Recipients</th>
            <th>Sent</th>
            <th>Failed</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {historyRows.map((row) => (
            <tr key={row.id}>
              <td>
                {new Date(
                  row.run_date
                ).toLocaleString()}
              </td>

              <td>
                {row.recipients}
              </td>

              <td>
                {row.emails_sent}
              </td>

              <td>
                {row.emails_failed}
              </td>

              <td>
                {row.status}
              </td>
            </tr>
          ))}

          {!historyRows.length && (
            <tr>
              <td colSpan="5">
                No run history found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
)}
    </div>
  );

}