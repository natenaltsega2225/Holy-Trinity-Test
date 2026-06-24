import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  LockKeyhole,
  RefreshCcw,
  Save,
  ShieldCheck,
  UnlockKeyhole,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const PERIOD_TYPES = [
  { value: "month", label: "Monthly Close" },
  { value: "quarter", label: "Quarterly Close" },
  { value: "year", label: "Annual Close" },
  { value: "custom", label: "Custom Period" },
];

const CHECKLIST = [
  {
    key: "payments_reconciled",
    label: "All payments reconciled",
    desc: "Card, ACH, cash, check, and Zelle payments have been reviewed.",
  },
  {
    key: "receipts_issued",
    label: "Receipts issued",
    desc: "Receipts are generated, emailed when needed, and attached to payments.",
  },
  {
    key: "invoices_reviewed",
    label: "Invoices reviewed",
    desc: "Open, partial, paid, cancelled, and void invoices are accurate.",
  },
  {
    key: "pledges_reviewed",
    label: "Pledges reviewed",
    desc: "Outstanding pledges, reminders, and pledge payments are current.",
  },
  {
    key: "membership_coverage_reviewed",
    label: "Membership coverage reviewed",
    desc: "Membership coverage months and dues balances are accurate.",
  },
  {
    key: "manual_entries_verified",
    label: "Manual entries verified",
    desc: "Cash, check, Zelle, and Sunday collections have finance verification.",
  },
  {
    key: "restricted_funds_reviewed",
    label: "Restricted funds reviewed",
    desc: "Restricted and designated fund balances reconcile to receipts and ledger.",
  },
  {
    key: "ledger_balanced",
    label: "Ledger balanced",
    desc: "Debits and credits have no unexplained variance.",
  },
  {
    key: "reports_exported",
    label: "Reports exported",
    desc: "Finance summary, payment, receipt, invoice, pledge, and audit reports are saved.",
  },
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function monthEndIso() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
}

function quarterStartIso() {
  const date = new Date();
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
  date.setMonth(quarterMonth, 1);
  return date.toISOString().slice(0, 10);
}

function quarterEndIso() {
  const date = new Date();
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3 + 2;
  date.setMonth(quarterMonth + 1, 0);
  return date.toISOString().slice(0, 10);
}

function yearStartIso() {
  const date = new Date();
  date.setMonth(0, 1);
  return date.toISOString().slice(0, 10);
}

function yearEndIso() {
  const date = new Date();
  date.setMonth(11, 31);
  return date.toISOString().slice(0, 10);
}

function datesForType(type) {
  if (type === "quarter") {
    return {
      from: quarterStartIso(),
      to: quarterEndIso(),
    };
  }

  if (type === "year") {
    return {
      from: yearStartIso(),
      to: yearEndIso(),
    };
  }

  if (type === "custom") {
    return {
      from: monthStartIso(),
      to: todayIso(),
    };
  }

  return {
    from: monthStartIso(),
    to: monthEndIso(),
  };
}

function responseData(response) {
  return response?.data || response || {};
}

function closeSummary(data = {}) {
  const source = data.summary || data.totals || data.dashboard || data;

  return {
    payments: numberValue(source.payments || source.payment_count),
    receipts: numberValue(source.receipts || source.receipt_count),
    invoices: numberValue(source.invoices || source.invoice_count),
    pledges: numberValue(source.pledges || source.pledge_count),
    revenue: numberValue(source.revenue || source.total_revenue || source.payment_total),
    outstanding_invoices: numberValue(source.outstanding_invoices || source.invoice_balance),
    outstanding_pledges: numberValue(source.outstanding_pledges || source.pledge_balance),
    ledger_variance: numberValue(source.ledger_variance),
    unreconciled_count: numberValue(source.unreconciled_count || source.unmatched_count),
    exception_count: numberValue(source.exception_count),
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

      if ([404, 405].includes(err?.response?.status)) continue;

      throw err;
    }
  }

  throw lastError || new Error("Period close preview endpoint is not available.");
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

  throw lastError || new Error("Period close action endpoint is not available.");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export default function FinancePeriodCloseModal({
  open = false,
  onClose,
  onClosed,
  onUnlocked,
}) {
  const initialDates = datesForType("month");

  const [form, setForm] = useState({
    period_type: "month",
    period_name: "",
    from: initialDates.from,
    to: initialDates.to,
    notes: "",
    approval_note: "",
    locked: true,
    export_reports: true,
    notify_admins: true,
  });

  const [checklist, setChecklist] = useState(
    CHECKLIST.reduce((acc, item) => {
      acc[item.key] = false;
      return acc;
    }, {})
  );

  const [summary, setSummary] = useState(closeSummary({}));
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const checklistComplete = useMemo(
    () => CHECKLIST.every((item) => checklist[item.key]),
    [checklist]
  );

  const hasBlockingExceptions = useMemo(() => {
    return (
      summary.ledger_variance !== 0 ||
      summary.unreconciled_count > 0 ||
      summary.exception_count > 0
    );
  }, [summary]);

  const validationError = useMemo(() => {
    if (!form.period_type) {
      return "Period type is required.";
    }

    if (!form.from || !form.to) {
      return "Period date range is required.";
    }

    if (form.from > form.to) {
      return "From date cannot be after To date.";
    }

    if (!checklistComplete) {
      return "Complete the finance close checklist before closing the period.";
    }

    if (!form.approval_note.trim()) {
      return "Approval note is required.";
    }

    return "";
  }, [form, checklistComplete]);

  useEffect(() => {
    if (!open) return;

    const dates = datesForType("month");

    setForm({
      period_type: "month",
      period_name: "",
      from: dates.from,
      to: dates.to,
      notes: "",
      approval_note: "",
      locked: true,
      export_reports: true,
      notify_admins: true,
    });

    setChecklist(
      CHECKLIST.reduce((acc, item) => {
        acc[item.key] = false;
        return acc;
      }, {})
    );

    setSummary(closeSummary({}));
    setError("");
    setSuccess("");
    setBusyAction("");
    setLoadingPreview(false);
  }, [open]);

  if (!open) {
    return null;
  }

  function updateField(key, value) {
    setForm((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      if (key === "period_type") {
        const dates = datesForType(value);

        next.from = dates.from;
        next.to = dates.to;
      }

      if ((key === "from" || key === "to") && value) {
        next.period_type = "custom";
      }

      return next;
    });
  }

  function toggleChecklist(key, checked) {
    setChecklist((current) => ({
      ...current,
      [key]: checked,
    }));
  }

  function payload() {
    return {
      period_type: form.period_type,
      period_name: form.period_name.trim() || null,
      from: form.from,
      to: form.to,
      date_from: form.from,
      date_to: form.to,
      notes: form.notes.trim() || null,
      approval_note: form.approval_note.trim() || null,
      locked: form.locked,
      export_reports: form.export_reports,
      notify_admins: form.notify_admins,
      checklist,
      summary,
      source: "finance_period_close_modal",
    };
  }

  async function loadPreview() {
    setLoadingPreview(true);
    setError("");
    setSuccess("");

    try {
      const result = await getFirst(
        [
          "/finance/period-close/preview",
          "/finance/reports/period-close/preview",
          "/finance/close/preview",
          "/finance/reports/dashboard",
        ],
        {
          params: {
            period_type: form.period_type,
            from: form.from,
            to: form.to,
            date_from: form.from,
            date_to: form.to,
          },
        }
      );

      setSummary(closeSummary(result.data));
      setSuccess("Period close preview loaded.");
    } catch (err) {
      setSummary(closeSummary({}));
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load period close preview."
      );
    } finally {
      setLoadingPreview(false);
    }
  }

  async function closePeriod(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (validationError) {
      setError(validationError);
      return;
    }

    if (
      hasBlockingExceptions &&
      !window.confirm(
        "This period has ledger variance, unreconciled items, or exceptions. Continue with period close?"
      )
    ) {
      return;
    }

    try {
      setBusyAction("close");

      const result = await postFirst(
        [
          "/finance/period-close",
          "/finance/period-close/close",
          "/finance/reports/period-close",
          "/finance/close",
        ],
        payload()
      );

      setSuccess("Finance period closed successfully.");

      onClosed?.({
        endpoint: result.endpoint,
        data: result.data,
        payload: payload(),
      });

      window.setTimeout(() => onClose?.(), 800);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to close finance period."
      );
    } finally {
      setBusyAction("");
    }
  }

  async function unlockPeriod() {
    if (
      !window.confirm(
        "Unlocking a closed period should be limited to authorized corrections. Continue?"
      )
    ) {
      return;
    }

    setBusyAction("unlock");
    setError("");
    setSuccess("");

    try {
      const result = await postFirst(
        [
          "/finance/period-close/unlock",
          "/finance/reports/period-close/unlock",
          "/finance/close/unlock",
        ],
        payload()
      );

      setSuccess("Finance period unlock requested.");
      onUnlocked?.({
        endpoint: result.endpoint,
        data: result.data,
        payload: payload(),
      });
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to unlock finance period."
      );
    } finally {
      setBusyAction("");
    }
  }

  async function downloadReport() {
    setBusyAction("report");
    setError("");
    setSuccess("");

    try {
      const result = await postFirst(
        [
          "/finance/period-close/report",
          "/finance/reports/period-close/pdf",
          "/finance/close/report",
        ],
        payload(),
        {
          responseType: "blob",
        }
      );

      const blob =
        result.response?.data instanceof Blob
          ? result.response.data
          : new Blob([result.response?.data], {
              type: "application/pdf",
            });

      downloadBlob(blob, `finance-period-close-${form.from}-${form.to}.pdf`);
      setSuccess("Period close report downloaded.");
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to download period close report."
      );
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <div
        className="finance-modal finance-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Finance period close"
      >
        <div className="finance-modal-head">
          <div>
            <span className="finance-kicker">Period Close</span>
            <h2>Finance Period Close</h2>
            <p>
              Lock a finance period after reconciliation, reports, invoices,
              receipts, pledges, manual entries, and ledger review are complete.
            </p>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={onClose}
            aria-label="Close period close modal"
          >
            <X size={18} />
          </button>
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
            <span>Revenue</span>
            <strong>{money(summary.revenue)}</strong>
          </div>

          <div className="finance-summary-card">
            <span>Payments</span>
            <strong>{summary.payments}</strong>
          </div>

          <div className="finance-summary-card">
            <span>Receipts</span>
            <strong>{summary.receipts}</strong>
          </div>

          <div className="finance-summary-card">
            <span>Open Invoices</span>
            <strong>{money(summary.outstanding_invoices)}</strong>
          </div>

          <div className="finance-summary-card">
            <span>Open Pledges</span>
            <strong>{money(summary.outstanding_pledges)}</strong>
          </div>

          <div className="finance-summary-card">
            <span>Ledger Variance</span>
            <strong
              className={summary.ledger_variance !== 0 ? "text-danger" : "text-success"}
            >
              {money(summary.ledger_variance)}
            </strong>
          </div>
        </div>

        <form onSubmit={closePeriod}>
          <div className="finance-section">
            <div className="finance-section-title">
              <CalendarDays size={18} />
              <h3>Period</h3>
            </div>

            <div className="finance-form-grid three">
              <label>
                Period Type
                <select
                  value={form.period_type}
                  onChange={(event) =>
                    updateField("period_type", event.target.value)
                  }
                  disabled={busyAction === "close"}
                >
                  {PERIOD_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Period Name
                <input
                  value={form.period_name}
                  onChange={(event) =>
                    updateField("period_name", event.target.value)
                  }
                  placeholder="June 2026 Close"
                  disabled={busyAction === "close"}
                />
              </label>

              <label>
                From
                <input
                  type="date"
                  value={form.from}
                  onChange={(event) => updateField("from", event.target.value)}
                  disabled={busyAction === "close"}
                />
              </label>

              <label>
                To
                <input
                  type="date"
                  value={form.to}
                  onChange={(event) => updateField("to", event.target.value)}
                  disabled={busyAction === "close"}
                />
              </label>
            </div>
          </div>

          <div className="finance-section">
            <div className="finance-section-title">
              <ClipboardCheck size={18} />
              <h3>Close Checklist</h3>
            </div>

            <div className="finance-checklist">
              {CHECKLIST.map((item) => (
                <label
                  key={item.key}
                  className={`finance-checklist-item ${
                    checklist[item.key] ? "complete" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(checklist[item.key])}
                    onChange={(event) =>
                      toggleChecklist(item.key, event.target.checked)
                    }
                    disabled={busyAction === "close"}
                  />

                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.desc}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="finance-section">
            <div className="finance-section-title">
              <ShieldCheck size={18} />
              <h3>Approval</h3>
            </div>

            <div className="finance-form-grid">
              <label className="finance-field-full">
                Approval Note
                <textarea
                  rows={3}
                  value={form.approval_note}
                  onChange={(event) =>
                    updateField("approval_note", event.target.value)
                  }
                  placeholder="Required: identify who reviewed and approved the period close."
                  disabled={busyAction === "close"}
                />
              </label>

              <label className="finance-field-full">
                Notes
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  placeholder="Optional finance close notes, exceptions, or follow-up."
                  disabled={busyAction === "close"}
                />
              </label>
            </div>

            <div className="finance-check-grid">
              <label>
                <input
                  type="checkbox"
                  checked={form.locked}
                  onChange={(event) => updateField("locked", event.target.checked)}
                  disabled={busyAction === "close"}
                />
                <span>
                  <LockKeyhole size={15} />
                  Lock period after close
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={form.export_reports}
                  onChange={(event) =>
                    updateField("export_reports", event.target.checked)
                  }
                  disabled={busyAction === "close"}
                />
                <span>Generate close reports</span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={form.notify_admins}
                  onChange={(event) =>
                    updateField("notify_admins", event.target.checked)
                  }
                  disabled={busyAction === "close"}
                />
                <span>Notify finance/admin users</span>
              </label>
            </div>
          </div>

          {hasBlockingExceptions ? (
            <div className="finance-alert danger">
              <AlertTriangle size={17} />
              <span>
                This period has unreconciled items, exceptions, or ledger variance.
                Review before closing unless this is an approved exception.
              </span>
            </div>
          ) : null}

          <div className="finance-modal-actions">
            <button
              type="button"
              className="finance-btn"
              onClick={onClose}
              disabled={busyAction === "close"}
            >
              Cancel
            </button>

            <button
              type="button"
              className="finance-btn"
              onClick={loadPreview}
              disabled={loadingPreview || busyAction === "close"}
            >
              <RefreshCcw size={16} />
              {loadingPreview ? "Previewing..." : "Preview"}
            </button>

            <button
              type="button"
              className="finance-btn"
              onClick={downloadReport}
              disabled={busyAction === "report"}
            >
              <Download size={16} />
              Report
            </button>

            <button
              type="button"
              className="finance-btn"
              onClick={unlockPeriod}
              disabled={busyAction === "unlock"}
            >
              <UnlockKeyhole size={16} />
              Unlock
            </button>

            <button
              type="submit"
              className="finance-btn primary"
              disabled={busyAction === "close" || Boolean(validationError)}
              title={validationError || "Close period"}
            >
              <Save size={16} />
              {busyAction === "close" ? "Closing..." : "Close Period"}
            </button>
          </div>
        </form>

        <div className="finance-audit-empty">
          <BadgeCheck size={15} />
          Period close should create an immutable audit record, preserve the
          checklist, lock the period when requested, and export close reports.
        </div>
      </div>
    </div>
  );
}