import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  Mail,
  Megaphone,
  Repeat,
  Save,
  ShieldCheck,
  Target,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const CAMPAIGN_TYPES = [
  { value: "pledge", label: "Pledge Campaign" },
  { value: "building_fund", label: "Building Fund" },
  { value: "charity_fund", label: "Charity Fund" },
  { value: "general_donation", label: "General Donation" },
  { value: "school", label: "School Program" },
  { value: "trip", label: "Trip Program" },
  { value: "special_fund", label: "Special Fund" },
  { value: "other_fund", label: "Other Fund" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "inactive", label: "Inactive" },
];

const REMINDER_FREQUENCY = [
  { value: "none", label: "No Automatic Reminders" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every Two Weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
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

function clean(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addMonthsIso(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function campaignId(campaign) {
  return campaign?.id || campaign?.campaign_id || "";
}

function responseData(response) {
  return response?.data || response || {};
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

  throw lastError || new Error("Campaign save endpoint is not available.");
}

function emptyForm() {
  return {
    title: "",
    campaign_type: "pledge",
    category: "pledge",
    status: "active",

    goal_amount: "",
    start_date: todayIso(),
    end_date: addMonthsIso(6),
    default_due_date: addMonthsIso(1),

    fund_code: "",
    fund_name: "",
    campaign_code: "",

    description: "",
    public_description: "",
    notes: "",

    allow_pledges: true,
    allow_one_time_payments: true,
    allow_partial_payments: true,
    allow_recurring_payments: true,
    public_enabled: true,
    donor_portal_enabled: true,

    reminder_enabled: true,
    reminder_frequency: "monthly",
    reminder_days_before_due: "7",

    send_launch_email: false,
    email_subject: "",
    email_message: "",
  };
}

function mapCampaignToForm(campaign = {}) {
  const next = emptyForm();

  return {
    ...next,
    title: campaign.title || campaign.campaign_name || campaign.name || "",
    campaign_type: campaign.campaign_type || campaign.type || campaign.category || "pledge",
    category: campaign.category || campaign.donation_category || campaign.campaign_type || "pledge",
    status: campaign.status || "active",

    goal_amount: String(campaign.goal_amount || campaign.goal || campaign.target_amount || ""),
    start_date: campaign.start_date ? String(campaign.start_date).slice(0, 10) : next.start_date,
    end_date: campaign.end_date ? String(campaign.end_date).slice(0, 10) : next.end_date,
    default_due_date: campaign.default_due_date
      ? String(campaign.default_due_date).slice(0, 10)
      : next.default_due_date,

    fund_code: campaign.fund_code || "",
    fund_name: campaign.fund_name || "",
    campaign_code: campaign.campaign_code || campaign.code || "",

    description: campaign.description || "",
    public_description: campaign.public_description || campaign.short_description || "",
    notes: campaign.notes || "",

    allow_pledges: Number(campaign.allow_pledges ?? 1) === 1,
    allow_one_time_payments: Number(campaign.allow_one_time_payments ?? 1) === 1,
    allow_partial_payments: Number(campaign.allow_partial_payments ?? 1) === 1,
    allow_recurring_payments: Number(campaign.allow_recurring_payments ?? 1) === 1,
    public_enabled: Number(campaign.public_enabled ?? campaign.is_public ?? 1) === 1,
    donor_portal_enabled: Number(campaign.donor_portal_enabled ?? 1) === 1,

    reminder_enabled: Number(campaign.reminder_enabled ?? 1) === 1,
    reminder_frequency: campaign.reminder_frequency || "monthly",
    reminder_days_before_due: String(campaign.reminder_days_before_due ?? 7),

    send_launch_email: false,
    email_subject: campaign.email_subject || "",
    email_message: campaign.email_message || "",
  };
}

export default function FinanceCampaignModal({
  open = false,
  campaign = null,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const editing = Boolean(campaignId(campaign));

  const validationError = useMemo(() => {
    if (!form.title.trim()) {
      return "Campaign title is required.";
    }

    if (!form.campaign_type) {
      return "Campaign type is required.";
    }

    if (numberValue(form.goal_amount) <= 0) {
      return "Campaign goal must be greater than zero.";
    }

    if (!form.start_date) {
      return "Start date is required.";
    }

    if (!form.end_date) {
      return "End date is required.";
    }

    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      return "Start date cannot be after end date.";
    }

    if (form.reminder_enabled && form.reminder_frequency === "none") {
      return "Choose a reminder frequency or disable reminders.";
    }

    return "";
  }, [form]);

  useEffect(() => {
    if (!open) return;

    setForm(campaign ? mapCampaignToForm(campaign) : emptyForm());
    setSubmitting(false);
    setError("");
    setSuccess("");
  }, [open, campaign]);

  if (!open) {
    return null;
  }

  function updateField(key, value) {
    setForm((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      if (key === "campaign_type") {
        next.category = value;
        next.allow_pledges = value === "pledge" || value === "building_fund";
      }

      if (key === "reminder_enabled" && !value) {
        next.reminder_frequency = "none";
      }

      if (key === "reminder_enabled" && value && current.reminder_frequency === "none") {
        next.reminder_frequency = "monthly";
      }

      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (validationError) {
      setError(validationError);
      return;
    }

    const id = campaignId(campaign);

    const payload = {
      id: id || null,
      campaign_id: id || null,

      title: form.title.trim(),
      campaign_name: form.title.trim(),
      campaign_type: form.campaign_type,
      type: form.campaign_type,
      category: form.category,
      donation_category: form.category,
      status: form.status,

      goal_amount: numberValue(form.goal_amount),
      goal: numberValue(form.goal_amount),
      target_amount: numberValue(form.goal_amount),

      start_date: form.start_date,
      end_date: form.end_date,
      default_due_date: form.default_due_date || null,

      fund_code: form.fund_code.trim() || null,
      fund_name: form.fund_name.trim() || null,
      campaign_code: form.campaign_code.trim() || null,

      description: form.description.trim() || null,
      public_description: form.public_description.trim() || null,
      notes: form.notes.trim() || null,

      allow_pledges: form.allow_pledges,
      allow_one_time_payments: form.allow_one_time_payments,
      allow_partial_payments: form.allow_partial_payments,
      allow_recurring_payments: form.allow_recurring_payments,
      public_enabled: form.public_enabled,
      donor_portal_enabled: form.donor_portal_enabled,

      reminder_enabled: form.reminder_enabled,
      reminder_frequency: form.reminder_enabled ? form.reminder_frequency : "none",
      reminder_days_before_due: numberValue(form.reminder_days_before_due),

      send_launch_email: form.send_launch_email,
      email_subject: form.email_subject.trim() || null,
      email_message: form.email_message.trim() || null,

      source: "finance_campaign_modal",
    };

    try {
      setSubmitting(true);

      const result = await postFirst(
        editing
          ? [
              `/finance/campaigns/${id}`,
              `/finance/pledges/campaigns/${id}`,
              "/finance/campaigns/save",
              "/finance/pledges/campaigns/save",
            ]
          : [
              "/finance/campaigns",
              "/finance/pledges/campaigns",
              "/finance/campaigns/create",
              "/finance/campaigns/save",
            ],
        payload
      );

      setSuccess("Campaign saved successfully.");

      onSaved?.({
        ...result.data,
        endpoint: result.endpoint,
        payload,
      });

      window.setTimeout(() => onClose?.(), 700);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save campaign."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <div
        className="finance-modal finance-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Campaign form"
      >
        <div className="finance-modal-head">
          <div>
            <span className="finance-kicker">Campaign Setup</span>
            <h2>{editing ? "Edit Campaign" : "Create Campaign"}</h2>
            <p>
              Configure goals, pledge settings, public donor portal availability,
              reminder automation, and fund accounting details.
            </p>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={onClose}
            aria-label="Close campaign modal"
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
            <span>Goal</span>
            <strong>{money(form.goal_amount)}</strong>
          </div>

          <div className="finance-summary-card">
            <span>Status</span>
            <strong>{STATUS_OPTIONS.find((item) => item.value === form.status)?.label}</strong>
          </div>

          <div className="finance-summary-card">
            <span>Start</span>
            <strong>{form.start_date || "--"}</strong>
          </div>

          <div className="finance-summary-card">
            <span>End</span>
            <strong>{form.end_date || "--"}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="finance-section">
            <div className="finance-section-title">
              <Megaphone size={18} />
              <h3>Campaign Information</h3>
            </div>

            <div className="finance-form-grid three">
              <label className="finance-field-full">
                Campaign Title
                <input
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  placeholder="Building Fund 2026, Charity Fund, Annual Pledge..."
                  disabled={submitting}
                />
              </label>

              <label>
                Campaign Type
                <select
                  value={form.campaign_type}
                  onChange={(event) =>
                    updateField("campaign_type", event.target.value)
                  }
                  disabled={submitting}
                >
                  {CAMPAIGN_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) => updateField("status", event.target.value)}
                  disabled={submitting}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Goal Amount
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.goal_amount}
                  onChange={(event) =>
                    updateField("goal_amount", event.target.value)
                  }
                  disabled={submitting}
                />
              </label>

              <label>
                Start Date
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(event) => updateField("start_date", event.target.value)}
                  disabled={submitting}
                />
              </label>

              <label>
                End Date
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(event) => updateField("end_date", event.target.value)}
                  disabled={submitting}
                />
              </label>

              <label>
                Default Pledge Due Date
                <input
                  type="date"
                  value={form.default_due_date}
                  onChange={(event) =>
                    updateField("default_due_date", event.target.value)
                  }
                  disabled={submitting}
                />
              </label>

              <label>
                Fund Code
                <input
                  value={form.fund_code}
                  onChange={(event) => updateField("fund_code", event.target.value)}
                  placeholder="Optional accounting fund code"
                  disabled={submitting}
                />
              </label>

              <label>
                Fund Name
                <input
                  value={form.fund_name}
                  onChange={(event) => updateField("fund_name", event.target.value)}
                  placeholder="Optional fund name"
                  disabled={submitting}
                />
              </label>

              <label className="finance-field-full">
                Description
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  placeholder="Internal campaign description..."
                  disabled={submitting}
                />
              </label>

              <label className="finance-field-full">
                Public Description
                <textarea
                  rows={3}
                  value={form.public_description}
                  onChange={(event) =>
                    updateField("public_description", event.target.value)
                  }
                  placeholder="Donor-facing campaign description..."
                  disabled={submitting}
                />
              </label>
            </div>
          </div>

          <div className="finance-section">
            <div className="finance-section-title">
              <DollarSign size={18} />
              <h3>Payment & Pledge Controls</h3>
            </div>

            <div className="finance-check-grid">
              <label>
                <input
                  type="checkbox"
                  checked={form.allow_pledges}
                  onChange={(event) =>
                    updateField("allow_pledges", event.target.checked)
                  }
                  disabled={submitting}
                />
                <span>
                  <Target size={15} />
                  Allow pledges
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={form.allow_one_time_payments}
                  onChange={(event) =>
                    updateField("allow_one_time_payments", event.target.checked)
                  }
                  disabled={submitting}
                />
                <span>Allow one-time payments</span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={form.allow_partial_payments}
                  onChange={(event) =>
                    updateField("allow_partial_payments", event.target.checked)
                  }
                  disabled={submitting}
                />
                <span>Allow partial payments</span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={form.allow_recurring_payments}
                  onChange={(event) =>
                    updateField("allow_recurring_payments", event.target.checked)
                  }
                  disabled={submitting}
                />
                <span>
                  <Repeat size={15} />
                  Allow recurring payments
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={form.public_enabled}
                  onChange={(event) =>
                    updateField("public_enabled", event.target.checked)
                  }
                  disabled={submitting}
                />
                <span>
                  {form.public_enabled ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                  Public campaign enabled
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={form.donor_portal_enabled}
                  onChange={(event) =>
                    updateField("donor_portal_enabled", event.target.checked)
                  }
                  disabled={submitting}
                />
                <span>Show in donor portal</span>
              </label>
            </div>
          </div>

          <div className="finance-section">
            <div className="finance-section-title">
              <Mail size={18} />
              <h3>Reminder Automation</h3>
            </div>

            <div className="finance-form-grid three">
              <label>
                Reminder Frequency
                <select
                  value={form.reminder_frequency}
                  onChange={(event) =>
                    updateField("reminder_frequency", event.target.value)
                  }
                  disabled={submitting || !form.reminder_enabled}
                >
                  {REMINDER_FREQUENCY.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Days Before Due
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={form.reminder_days_before_due}
                  onChange={(event) =>
                    updateField("reminder_days_before_due", event.target.value)
                  }
                  disabled={submitting || !form.reminder_enabled}
                />
              </label>

              <label>
                Campaign Code
                <input
                  value={form.campaign_code}
                  onChange={(event) =>
                    updateField("campaign_code", event.target.value)
                  }
                  placeholder="Optional campaign code"
                  disabled={submitting}
                />
              </label>

              <label className="finance-field-full">
                Email Subject
                <input
                  value={form.email_subject}
                  onChange={(event) =>
                    updateField("email_subject", event.target.value)
                  }
                  placeholder="Optional custom campaign email subject"
                  disabled={submitting}
                />
              </label>

              <label className="finance-field-full">
                Email Message
                <textarea
                  rows={4}
                  value={form.email_message}
                  onChange={(event) =>
                    updateField("email_message", event.target.value)
                  }
                  placeholder="Optional donor reminder message..."
                  disabled={submitting}
                />
              </label>
            </div>

            <div className="finance-check-grid">
              <label>
                <input
                  type="checkbox"
                  checked={form.reminder_enabled}
                  onChange={(event) =>
                    updateField("reminder_enabled", event.target.checked)
                  }
                  disabled={submitting}
                />
                <span>Enable automatic reminders</span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={form.send_launch_email}
                  onChange={(event) =>
                    updateField("send_launch_email", event.target.checked)
                  }
                  disabled={submitting}
                />
                <span>Send launch email after saving</span>
              </label>
            </div>
          </div>

          <div className="finance-section">
            <div className="finance-section-title">
              <ShieldCheck size={18} />
              <h3>Finance Notes</h3>
            </div>

            <label className="finance-field-full">
              Notes
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Internal finance notes, restrictions, or board approval details..."
                disabled={submitting}
              />
            </label>
          </div>

          <div className="finance-audit-empty">
            Campaign records should reconcile with pledge schedules, invoices,
            receipt categories, fund accounting, and ledger reporting.
          </div>

          <div className="finance-modal-actions">
            <button
              type="button"
              className="finance-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="finance-btn primary"
              disabled={submitting || Boolean(validationError)}
              title={validationError || "Save campaign"}
            >
              <Save size={16} />
              {submitting ? "Saving..." : "Save Campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}