// frontend/src/components/FinanceDashboard/components/FinanceManualEntryModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Landmark,
  Receipt,
  Save,
  Smartphone,
  X,
} from "lucide-react";

import api from "../../api";
import FinanceMemberLookup from "./FinanceMemberLookup.jsx";
import "../../../styles/finance-enterprise.css";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "check", label: "Check", icon: Landmark },
  { value: "zelle", label: "Zelle", icon: Smartphone },
];

const CATEGORY_OPTIONS = [
  { value: "membership", label: "Membership" },
  { value: "donation", label: "Donation" },
  { value: "pledge", label: "Pledge" },
  { value: "school", label: "School" },
  { value: "trip", label: "Trip" },
  { value: "general_collection", label: "General Collection" },
  { value: "special_fund_collection", label: "Special Fund Collection" },
  { value: "other", label: "Other" },
];

const DONATION_CATEGORIES = [
  { value: "plate_collection", label: "መባ - Plate Collection" },
  { value: "candle_sale", label: "ሻማ - Candle Sale" },
  { value: "general_donation", label: "ስጦታ - General Donation" },
  { value: "tithe", label: "አስራት - Tithe" },
  { value: "vows", label: "ስዕለት - Vows" },
  { value: "building_fund", label: "የቤተክርስቲያን ማሰሪያ - Building Fund" },
  { value: "charity_fund", label: "በጎ አድራጎት - Charity Fund" },
  { value: "auction", label: "ጨረታ - Auction" },
  { value: "other_fund", label: "ሌላ - Other Fund" },
];

function clean(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];

    if (value !== undefined && value !== null && clean(value) !== "") {
      return value;
    }
  }

  return fallback;
}

function defaultForm(method = "cash", category = "donation") {
  return {
    payer_type: "member",
    member_id: "",
    member_no: "",
    full_name: "",
    email: "",
    phone: "",

    payment_method: method,
    category,
    donation_category: "general_donation",

    amount: "",
    reference_no: "",
    check_number: "",
    bank_name: "",
    zelle_reference: "",
    received_date: new Date().toISOString().slice(0, 10),

    notes: "",
    create_invoice: true,
    send_invoice_email: true,
    generate_receipt: true,
    send_receipt_email: true,
    create_ledger_entry: true,
  };
}

async function postFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.post(endpoint, payload);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

export default function FinanceManualEntryModal({
  open,
  onClose,
  onSaved,
  defaultMethod = "cash",
  defaultCategory = "donation",
  donor = null,
  title = "Record Manual Payment",
}) {
  const [form, setForm] = useState(defaultForm(defaultMethod, defaultCategory));
  const [selectedMember, setSelectedMember] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedMethod = useMemo(
    () =>
      PAYMENT_METHODS.find((method) => method.value === form.payment_method) ||
      PAYMENT_METHODS[0],
    [form.payment_method]
  );

  const MethodIcon = selectedMethod.icon;

  const totalAmount = numberValue(form.amount);

  useEffect(() => {
    if (!open) return;

    const next = defaultForm(defaultMethod, defaultCategory);

    if (donor) {
      next.member_id = firstValue(donor, ["id", "member_id"], "");
      next.member_no = firstValue(donor, ["member_no", "member_number"], "");
      next.full_name = firstValue(
        donor,
        ["full_name", "payer_name", "donor_name", "name"],
        ""
      );
      next.email = firstValue(donor, ["email", "payer_email", "donor_email"], "");
      next.phone = firstValue(donor, ["phone", "payer_phone", "donor_phone"], "");
      next.payer_type = next.member_id || next.member_no ? "member" : "guest";
    }

    setForm(next);
    setSelectedMember(donor || null);
    setError("");
    setSuccess("");
    setSaving(false);
  }, [open, defaultMethod, defaultCategory, donor]);

  function setValue(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function close() {
    if (saving) return;
    onClose?.();
  }

  function handleMemberSelect(snapshot) {
    setSelectedMember(snapshot);

    if (!snapshot) {
      setForm((prev) => ({
        ...prev,
        member_id: "",
        member_no: "",
        full_name: "",
        email: "",
        phone: "",
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      payer_type: "member",
      member_id: snapshot.member_id || snapshot.id || "",
      member_no: snapshot.member_no || "",
      full_name: snapshot.full_name || "",
      email: snapshot.email || "",
      phone: snapshot.phone || "",
    }));
  }

  function handleGuestChange(snapshot) {
    setForm((prev) => ({
      ...prev,
      payer_type: "guest",
      member_id: "",
      member_no: "",
      full_name: snapshot.full_name || "",
      email: snapshot.email || "",
      phone: snapshot.phone || "",
    }));
  }

  function referenceForMethod() {
    if (form.payment_method === "check") {
      return clean(form.check_number) || clean(form.reference_no);
    }

    if (form.payment_method === "zelle") {
      return clean(form.zelle_reference) || clean(form.reference_no);
    }

    return clean(form.reference_no);
  }

  function validate() {
    if (!clean(form.full_name)) {
      setError("Payer name is required.");
      return false;
    }

    if (form.payer_type === "member" && !clean(form.member_no) && !clean(form.member_id)) {
      setError("Select a member or switch to non-member.");
      return false;
    }

    if (totalAmount <= 0) {
      setError("Enter a valid payment amount.");
      return false;
    }

    if (!form.received_date) {
      setError("Received date is required.");
      return false;
    }

    if (["check", "zelle"].includes(form.payment_method) && !referenceForMethod()) {
      setError(
        form.payment_method === "check"
          ? "Check number is required."
          : "Zelle reference is required."
      );
      return false;
    }

    if ((form.send_invoice_email || form.send_receipt_email) && !clean(form.email)) {
      setError("Email is required when sending invoice or receipt email.");
      return false;
    }

    return true;
  }

  function buildPayload() {
    const reference = referenceForMethod();
    const invoiceItem = {
      item_type: form.category,
      item_name:
        form.category === "donation"
          ? form.donation_category
          : form.category,
      description: clean(form.notes) || `${form.category} manual payment`,
      quantity: 1,
      unit_price: totalAmount,
      total_price: totalAmount,
    };

    return {
      payer_type: form.payer_type,
      donor_type: form.payer_type,

      member_id: clean(form.member_id) || null,
      member_no: clean(form.member_no) || null,

      full_name: clean(form.full_name),
      full_name_snapshot: clean(form.full_name),
      payer_name: clean(form.full_name),
      donor_name: clean(form.full_name),

      email: clean(form.email) || null,
      email_snapshot: clean(form.email) || null,
      payer_email: clean(form.email) || null,

      phone: clean(form.phone) || null,
      phone_snapshot: clean(form.phone) || null,

      category: form.category,
      payment_type: form.category,
      sub_category:
        form.category === "donation"
          ? form.donation_category
          : form.category,

      donation_category:
        form.category === "donation" ? form.donation_category : null,

      amount: totalAmount,
      payment_amount: totalAmount,
      total_amount: totalAmount,
      invoice_amount: totalAmount,
      invoice_total_amount: totalAmount,
      subtotal_amount: totalAmount,
      amount_due: 0,
      balance_due: 0,
      paid_amount: totalAmount,

      method: form.payment_method,
      payment_method: form.payment_method,
      provider: form.payment_method,

      reference_no: reference || null,
      reference_number: reference || null,
      transaction_reference: reference || null,

      check_number:
        form.payment_method === "check" ? clean(form.check_number) : null,
      bank_name:
        form.payment_method === "check" ? clean(form.bank_name) || null : null,

      zelle_reference:
        form.payment_method === "zelle" ? clean(form.zelle_reference) : null,

      received_date: form.received_date,
      received_at: form.received_date,
      paid_at: form.received_date,

      status: "paid",
      payment_status: "paid",
      manual_status: "verified",

      notes: clean(form.notes) || null,

      create_invoice: Boolean(form.create_invoice),
      generate_invoice: Boolean(form.create_invoice),
      send_invoice_email: Boolean(form.create_invoice && form.send_invoice_email),
      create_payment_link: false,
      public_payment_link: false,
      include_payment_link: false,
      send_payment_link: false,

      items: [invoiceItem],
      line_items: [invoiceItem],
      invoice_items: [invoiceItem],

      generate_receipt: Boolean(form.generate_receipt),
      create_receipt: Boolean(form.generate_receipt),
      send_receipt_email: Boolean(form.generate_receipt && form.send_receipt_email),

      create_ledger_entry: Boolean(form.create_ledger_entry),
      update_ledger: Boolean(form.create_ledger_entry),

      manual_entry: true,
      manual_payment: true,
      manual_entry_type: form.payment_method,
      source: "finance_manual_entry_modal",
    };
  }

  async function submit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!validate()) return;

    setSaving(true);

    try {
      const payload = buildPayload();

      const endpoints = [
        `/finance/${form.payment_method}`,
        "/finance/payments",
        "/finance/manual-entries",
      ];

      const response = await postFirst(endpoints, payload);

      setSuccess("Manual payment recorded successfully.");
      onSaved?.(response);
      close();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to record manual payment."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <form className="finance-modal finance-modal-wide" onSubmit={submit}>
        <div className="finance-modal-head">
          <div>
            <p className="finance-eyebrow">Manual Finance Entry</p>
            <h2>{title}</h2>
            <span>
              Record cash, check, or Zelle payments with invoice, receipt,
              email, ledger, and audit records.
            </span>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={close}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="finance-alert danger">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="finance-alert success">
            <CheckCircle2 size={16} />
            {success}
          </div>
        ) : null}

        <div className="finance-method-switcher">
          {PAYMENT_METHODS.map((method) => {
            const Icon = method.icon;

            return (
              <button
                key={method.value}
                type="button"
                className={form.payment_method === method.value ? "active" : ""}
                onClick={() => setValue("payment_method", method.value)}
              >
                <Icon size={16} />
                {method.label}
              </button>
            );
          })}
        </div>

        <FinanceMemberLookup
          value={selectedMember}
          payerType={form.payer_type}
          onPayerTypeChange={(value) => setValue("payer_type", value)}
          onSelect={handleMemberSelect}
          onGuestChange={handleGuestChange}
          required
        />

        <section className="finance-modal-section">
          <div className="finance-section-head">
            <div>
              <h3>
                <MethodIcon size={17} />
                Payment Details
              </h3>
              <p>
                Manual payments are stored with payer snapshot, reference,
                method, category, and staff audit metadata.
              </p>
            </div>

            <span className="finance-status-badge success">
              {money(totalAmount)}
            </span>
          </div>

          <div className="finance-form-grid three">
            <label>
              Category *
              <select
                value={form.category}
                onChange={(event) => setValue("category", event.target.value)}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {form.category === "donation" ? (
              <label>
                Donation Category
                <select
                  value={form.donation_category}
                  onChange={(event) =>
                    setValue("donation_category", event.target.value)
                  }
                >
                  {DONATION_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              Amount *
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => setValue("amount", event.target.value)}
                placeholder="0.00"
                required
              />
            </label>

            <label>
              Received Date *
              <input
                type="date"
                value={form.received_date}
                onChange={(event) => setValue("received_date", event.target.value)}
                required
              />
            </label>

            {form.payment_method === "check" ? (
              <>
                <label>
                  Check Number *
                  <input
                    value={form.check_number}
                    onChange={(event) =>
                      setValue("check_number", event.target.value)
                    }
                    placeholder="Check #"
                    required
                  />
                </label>

                <label>
                  Bank Name
                  <input
                    value={form.bank_name}
                    onChange={(event) => setValue("bank_name", event.target.value)}
                    placeholder="Bank name"
                  />
                </label>
              </>
            ) : null}

            {form.payment_method === "zelle" ? (
              <label>
                Zelle Reference *
                <input
                  value={form.zelle_reference}
                  onChange={(event) =>
                    setValue("zelle_reference", event.target.value)
                  }
                  placeholder="Zelle confirmation/reference"
                  required
                />
              </label>
            ) : null}

            {form.payment_method === "cash" ? (
              <label>
                Cash Reference
                <input
                  value={form.reference_no}
                  onChange={(event) => setValue("reference_no", event.target.value)}
                  placeholder="Optional receipt/batch reference"
                />
              </label>
            ) : null}
          </div>
        </section>

        <label className="finance-field-full">
          Notes
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) => setValue("notes", event.target.value)}
            placeholder="Optional internal note"
          />
        </label>

        <div className="finance-check-grid">
          <label>
            <input
              type="checkbox"
              checked={form.create_invoice}
              onChange={(event) => setValue("create_invoice", event.target.checked)}
            />
            Create invoice
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.send_invoice_email}
              onChange={(event) =>
                setValue("send_invoice_email", event.target.checked)
              }
            />
            Email invoice
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.generate_receipt}
              onChange={(event) =>
                setValue("generate_receipt", event.target.checked)
              }
            />
            Generate receipt
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.send_receipt_email}
              onChange={(event) =>
                setValue("send_receipt_email", event.target.checked)
              }
            />
            Email receipt
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.create_ledger_entry}
              onChange={(event) =>
                setValue("create_ledger_entry", event.target.checked)
              }
            />
            Post ledger
          </label>
        </div>

        <div className="finance-modal-actions">
          <button type="button" className="finance-btn ghost" onClick={close}>
            Cancel
          </button>

          <button type="submit" className="finance-btn primary" disabled={saving}>
            {form.generate_receipt ? <Receipt size={16} /> : <Save size={16} />}
            {saving ? "Saving..." : "Record Payment"}
          </button>
        </div>
      </form>
    </div>
  );
}
