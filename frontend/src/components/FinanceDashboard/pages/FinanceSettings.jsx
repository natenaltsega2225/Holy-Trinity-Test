// frontend/src/components/FinanceDashboard/pages/FinanceSettings.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Building2,
  CreditCard,
  FileText,
  Mail,
  RefreshCcw,
  Save,
  ShieldCheck,
} from "lucide-react";

// import "../../../styles/shared-payment-components.css";
// import "../../../styles/finance-dashboard.css";
import "../../../styles/finance-enterprise.css";
const DEFAULT_SETTINGS = {
  organization_name: "Holy Trinity Ethiopian Orthodox Church",
  platform_name: "Holy Trinity Finance & Membership Platform",
  finance_email: "",
  support_email: "",
  currency: "USD",
  timezone: "America/Chicago",
  invoice_prefix: "INV",
  receipt_prefix: "RCPT",
  payment_prefix: "PAY",
  pledge_prefix: "PLG",
  enable_invoice_emails: true,
  enable_receipt_emails: true,
  enable_payment_links: true,
  attach_invoice_pdf: true,
  attach_receipt_pdf: true,
  enable_notifications: true,
  enable_pledge_reminders: true,
  enable_membership_reminders: true,
  default_due_grace_days: 7,
  reimbursement_requires_person_info: true,
  expense_approval_required: true,
  audit_mode: "strict",
};

const SECTIONS = [
  { key: "organization", label: "Organization", icon: Building2 },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "email", label: "Email", icon: Mail },
  { key: "automation", label: "Automation", icon: Bell },
  { key: "controls", label: "Controls", icon: ShieldCheck },
];

function asBool(value) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

async function fetchJson(path, options = {}) {
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
    throw new Error(data.error || data.message || "Request failed.");
  }

  return data;
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

function TextField({ label, value, onChange, type = "text" }) {
  return (
    <label className="finance-field">
      <span>{label}</span>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function ToggleField({ label, checked, onChange, hint }) {
  return (
    <label className="finance-toggle-row">
      <input
        type="checkbox"
        checked={asBool(checked)}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}

export default function FinanceSettings() {
  const [active, setActive] = useState("organization");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const stats = useMemo(
    () => [
      {
        label: "Document PDFs",
        value:
          settings.attach_invoice_pdf || settings.attach_receipt_pdf ? "On" : "Off",
        note: "Invoice and receipt attachments",
      },
      {
        label: "Payment Links",
        value: settings.enable_payment_links ? "On" : "Off",
        note: "Public invoice checkout links",
      },
      {
        label: "Automation",
        value:
          Number(Boolean(settings.enable_pledge_reminders)) +
          Number(Boolean(settings.enable_membership_reminders)),
        note: "Reminder workflows enabled",
      },
      {
        label: "Audit Controls",
        value: settings.audit_mode === "strict" ? "Strict" : "Standard",
        note: "Operational control mode",
      },
    ],
    [settings]
  );

  function update(key, value) {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function loadSettings() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await fetchJson("/api/finance/settings");

      setSettings({
        ...DEFAULT_SETTINGS,
        ...(data.settings || data.finance || data.data || {}),
      });
    } catch (err) {
      setError(err.message || "Failed to load finance settings.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const body = JSON.stringify({ settings });

      const data = await fetchJson("/api/finance/settings", {
        method: "PUT",
        body,
      });

      setSettings({
        ...DEFAULT_SETTINGS,
        ...(data.settings || settings),
      });
      setMessage("Finance settings saved successfully.");
    } catch (err) {
      setError(err.message || "Failed to save finance settings.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const ActiveIcon = SECTIONS.find((item) => item.key === active)?.icon || Building2;

  return (
    <div className="finance-enterprise-page">
      <section className="finance-page-hero">
        <div>
          <p className="finance-eyebrow">Finance Administration</p>
          <h1>Finance Settings</h1>
          <p>
            Configure document delivery, payment links, notifications,
            reimbursement controls, and enterprise finance defaults.
          </p>
        </div>
        <div className="finance-page-actions">
          <button className="finance-btn finance-btn-secondary" onClick={loadSettings} disabled={loading}>
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button className="finance-btn finance-btn-primary" onClick={saveSettings} disabled={saving}>
            <Save size={16} />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </section>

      {error ? <div className="finance-alert finance-alert-danger">{error}</div> : null}
      {message ? <div className="finance-alert finance-alert-success">{message}</div> : null}

      <section className="finance-summary-grid">
        {stats.map((item) => (
          <article className="finance-summary-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </article>
        ))}
      </section>

      <section className="finance-settings-shell">
        <nav className="finance-settings-tabs" aria-label="Finance settings sections">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={active === item.key ? "active" : ""}
                type="button"
                onClick={() => setActive(item.key)}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="finance-settings-panel">
          <div className="finance-section-title">
            <ActiveIcon size={18} />
            <h2>{SECTIONS.find((item) => item.key === active)?.label}</h2>
          </div>

          {active === "organization" ? (
            <div className="finance-form-grid">
              <TextField label="Church Legal Name" value={settings.organization_name} onChange={(v) => update("organization_name", v)} />
              <TextField label="Platform Name" value={settings.platform_name} onChange={(v) => update("platform_name", v)} />
              <TextField label="Finance Email" value={settings.finance_email} onChange={(v) => update("finance_email", v)} />
              <TextField label="Support Email" value={settings.support_email} onChange={(v) => update("support_email", v)} />
              <TextField label="Timezone" value={settings.timezone} onChange={(v) => update("timezone", v)} />
              <label className="finance-field">
                <span>Currency</span>
                <select value={settings.currency} onChange={(e) => update("currency", e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="CAD">CAD</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
            </div>
          ) : null}

          {active === "documents" ? (
            <div className="finance-form-grid">
              <TextField label="Invoice Prefix" value={settings.invoice_prefix} onChange={(v) => update("invoice_prefix", v)} />
              <TextField label="Receipt Prefix" value={settings.receipt_prefix} onChange={(v) => update("receipt_prefix", v)} />
              <TextField label="Payment Prefix" value={settings.payment_prefix} onChange={(v) => update("payment_prefix", v)} />
              <TextField label="Pledge Prefix" value={settings.pledge_prefix} onChange={(v) => update("pledge_prefix", v)} />
              <ToggleField label="Attach Invoice PDF" checked={settings.attach_invoice_pdf} onChange={(v) => update("attach_invoice_pdf", v)} />
              <ToggleField label="Attach Receipt PDF" checked={settings.attach_receipt_pdf} onChange={(v) => update("attach_receipt_pdf", v)} />
            </div>
          ) : null}

          {active === "payments" ? (
            <div className="finance-form-grid">
              <ToggleField label="Enable Payment Links" checked={settings.enable_payment_links} onChange={(v) => update("enable_payment_links", v)} hint="Required for public invoice checkout." />
              <ToggleField label="Expense Approval Required" checked={settings.expense_approval_required} onChange={(v) => update("expense_approval_required", v)} />
              <ToggleField label="Reimbursements Require Full Person Info" checked={settings.reimbursement_requires_person_info} onChange={(v) => update("reimbursement_requires_person_info", v)} />
              <TextField label="Default Due Grace Days" type="number" value={settings.default_due_grace_days} onChange={(v) => update("default_due_grace_days", Number(v || 0))} />
            </div>
          ) : null}

          {active === "email" ? (
            <div className="finance-form-grid">
              <ToggleField label="Invoice Emails" checked={settings.enable_invoice_emails} onChange={(v) => update("enable_invoice_emails", v)} />
              <ToggleField label="Receipt Emails" checked={settings.enable_receipt_emails} onChange={(v) => update("enable_receipt_emails", v)} />
              <ToggleField label="Finance Notifications" checked={settings.enable_notifications} onChange={(v) => update("enable_notifications", v)} />
            </div>
          ) : null}

          {active === "automation" ? (
            <div className="finance-form-grid">
              <ToggleField label="Pledge Reminders" checked={settings.enable_pledge_reminders} onChange={(v) => update("enable_pledge_reminders", v)} />
              <ToggleField label="Membership Reminders" checked={settings.enable_membership_reminders} onChange={(v) => update("enable_membership_reminders", v)} />
            </div>
          ) : null}

          {active === "controls" ? (
            <div className="finance-form-grid">
              <label className="finance-field">
                <span>Audit Mode</span>
                <select value={settings.audit_mode} onChange={(e) => update("audit_mode", e.target.value)}>
                  <option value="strict">Strict</option>
                  <option value="standard">Standard</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
