// frontend/src/components/FinanceDashboard/pages/FinanceSettings.jsx

import React, {
  useEffect,
  useState,
} from "react";

import {
  Save,
  RefreshCcw,
  CreditCard,
  Receipt,
  Bell,
  Settings,
  Mail,
  Hash,
  Landmark,
} from "lucide-react";

import "../../../styles/shared-payment-components.css";
// import "../finance-dashboard.css";

const DEFAULTS = {

  stripe_publishable_key: "",
  stripe_secret_configured: false,

  currency: "USD",

  receipt_prefix: "RCPT",
  invoice_prefix: "INV",
  payment_prefix: "PAY",

  enable_receipt_emails: true,
  enable_invoice_emails: true,
  enable_payment_notifications: true,

  default_reconciliation_status:
    "pending",

  organization_name:
    "Holy Trinity Ethiopian Orthodox Church",

  finance_email:
    "",

  support_email:
    "",

  default_due_grace_days:
    7,
};

export default function FinanceSettings() {

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [form, setForm] =
    useState(DEFAULTS);

  async function loadSettings() {

    try {

      setLoading(true);

      const res =
        await fetch(
          "/api/finance/settings",
          {
            credentials:
              "include",
          }
        );

      const data =
        await res.json();

      if (res.ok && data.settings) {

        setForm({
          ...DEFAULTS,
          ...data.settings,
        });
      }

    } catch (err) {

      console.error(err);

    } finally {

      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function update(
    key,
    value
  ) {

    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSave() {

    try {

      setSaving(true);

      const res =
        await fetch(
          "/api/finance/settings",
          {
            method: "PUT",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                form
              ),
          }
        );

      const data =
        await res.json();

      if (!res.ok) {

        throw new Error(
          data.error ||
          "Failed to save settings."
        );
      }

      alert(
        "Finance settings saved successfully."
      );

    } catch (err) {

      console.error(err);

      alert(
        err.message
      );

    } finally {

      setSaving(false);
    }
  }

  return (
    <div className="finance-enterprise-page">

      <div className="finance-page-header">

        <div>

          <h1>
            Finance Settings
          </h1>

          <p>
            Enterprise
            finance configuration,
            Stripe setup,
            receipt settings,
            invoice settings,
            email preferences,
            and accounting defaults.
          </p>

        </div>

        <div className="finance-header-actions">

          <button
            className="finance-btn finance-btn-secondary"
            onClick={
              loadSettings
            }
          >
            <RefreshCcw size={16} />
            Refresh
          </button>

          <button
            className="finance-btn finance-btn-primary"
            onClick={
              handleSave
            }
            disabled={
              saving
            }
          >
            <Save size={16} />

            {saving
              ? "Saving..."
              : "Save Settings"}
          </button>

        </div>

      </div>

      {loading && (
        <div className="finance-loading-overlay">
          Loading settings...
        </div>
      )}

      <div className="finance-grid finance-grid-2">

        <div className="finance-section-card">

          <div className="finance-section-title">

            <CreditCard size={16} />

            <span>
              Stripe Configuration
            </span>

          </div>

          <div className="finance-field">

            <label>
              Stripe Publishable Key
            </label>

            <input
              value={
                form.stripe_publishable_key
              }
              onChange={(e) =>
                update(
                  "stripe_publishable_key",
                  e.target.value
                )
              }
            />

          </div>

          <div className="finance-check-row">

            <input
              type="checkbox"
              checked={
                form.stripe_secret_configured
              }
              readOnly
            />

            <label>
              Stripe Secret Configured
            </label>

          </div>

        </div>

        <div className="finance-section-card">

          <div className="finance-section-title">

            <Landmark size={16} />

            <span>
              Finance Defaults
            </span>

          </div>

          <div className="finance-field">

            <label>
              Currency
            </label>

            <select
              value={
                form.currency
              }
              onChange={(e) =>
                update(
                  "currency",
                  e.target.value
                )
              }
            >
              <option value="USD">
                USD
              </option>

              <option value="CAD">
                CAD
              </option>

              <option value="EUR">
                EUR
              </option>

            </select>

          </div>

          <div className="finance-field">

            <label>
              Default Grace Days
            </label>

            <input
              type="number"
              value={
                form.default_due_grace_days
              }
              onChange={(e) =>
                update(
                  "default_due_grace_days",
                  e.target.value
                )
              }
            />

          </div>

          <div className="finance-field">

            <label>
              Default Reconciliation
            </label>

            <select
              value={
                form.default_reconciliation_status
              }
              onChange={(e) =>
                update(
                  "default_reconciliation_status",
                  e.target.value
                )
              }
            >
              <option value="pending">
                Pending
              </option>

              <option value="matched">
                Matched
              </option>

            </select>

          </div>

        </div>

      </div>

      <div className="finance-grid finance-grid-3">

        <div className="finance-section-card">

          <div className="finance-section-title">

            <Hash size={16} />

            <span>
              Receipt Settings
            </span>

          </div>

          <div className="finance-field">

            <label>
              Receipt Prefix
            </label>

            <input
              value={
                form.receipt_prefix
              }
              onChange={(e) =>
                update(
                  "receipt_prefix",
                  e.target.value
                )
              }
            />

          </div>

        </div>

        <div className="finance-section-card">

          <div className="finance-section-title">

            <Receipt size={16} />

            <span>
              Invoice Settings
            </span>

          </div>

          <div className="finance-field">

            <label>
              Invoice Prefix
            </label>

            <input
              value={
                form.invoice_prefix
              }
              onChange={(e) =>
                update(
                  "invoice_prefix",
                  e.target.value
                )
              }
            />

          </div>

        </div>

        <div className="finance-section-card">

          <div className="finance-section-title">

            <Settings size={16} />

            <span>
              Payment Settings
            </span>

          </div>

          <div className="finance-field">

            <label>
              Payment Prefix
            </label>

            <input
              value={
                form.payment_prefix
              }
              onChange={(e) =>
                update(
                  "payment_prefix",
                  e.target.value
                )
              }
            />

          </div>

        </div>

      </div>

      <div className="finance-grid finance-grid-2">

        <div className="finance-section-card">

          <div className="finance-section-title">

            <Mail size={16} />

            <span>
              Email Configuration
            </span>

          </div>

          <div className="finance-field">

            <label>
              Finance Email
            </label>

            <input
              value={
                form.finance_email
              }
              onChange={(e) =>
                update(
                  "finance_email",
                  e.target.value
                )
              }
            />

          </div>

          <div className="finance-field">

            <label>
              Support Email
            </label>

            <input
              value={
                form.support_email
              }
              onChange={(e) =>
                update(
                  "support_email",
                  e.target.value
                )
              }
            />

          </div>

        </div>

        <div className="finance-section-card">

          <div className="finance-section-title">

            <Bell size={16} />

            <span>
              Notification Settings
            </span>

          </div>

          <div className="finance-check-row">

            <input
              type="checkbox"
              checked={
                form.enable_receipt_emails
              }
              onChange={(e) =>
                update(
                  "enable_receipt_emails",
                  e.target.checked
                )
              }
            />

            <label>
              Enable Receipt Emails
            </label>

          </div>

          <div className="finance-check-row">

            <input
              type="checkbox"
              checked={
                form.enable_invoice_emails
              }
              onChange={(e) =>
                update(
                  "enable_invoice_emails",
                  e.target.checked
                )
              }
            />

            <label>
              Enable Invoice Emails
            </label>

          </div>

          <div className="finance-check-row">

            <input
              type="checkbox"
              checked={
                form.enable_payment_notifications
              }
              onChange={(e) =>
                update(
                  "enable_payment_notifications",
                  e.target.checked
                )
              }
            />

            <label>
              Enable Payment Notifications
            </label>

          </div>

        </div>

      </div>

    </div>
  );
}