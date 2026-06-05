// frontend/src/components/FinanceDashboard/components/FinanceLedgerAdjustmentModal.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  X,
  Save,
  AlertTriangle,
  CreditCard,
  Receipt,
  FileText,
  User,
  Landmark,
} from "lucide-react";

import "../../../styles/shared-payment-components.css";
// import "../finance-dashboard.css";

const ENTRY_TYPES = [
  "adjustment",
  "payment",
  "refund",
  "membership",
  "donation",
  "pledge",
  "expense",
  "reimbursement",
  "invoice",
  "receipt",
];

const ADJUSTMENT_TYPES = [
  "credit_adjustment",
  "debit_adjustment",
  "correction",
  "write_off",
  "reversal",
];

const EMPTY_FORM = {
  member_id: "",
  member_no: "",
  full_name_snapshot: "",

  entry_type: "adjustment",
  adjustment_type: "credit_adjustment",

  debit: "",
  credit: "",
  amount: "",

  description: "",
  notes: "",

  payment_id: "",
  invoice_id: "",
  receipt_id: "",

  source_reference: "",

  reconciliation_status: "pending",
};

function money(value) {
  return Number(value || 0).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  );
}

export default function FinanceLedgerAdjustmentModal({
  open,
  onClose,
  onSaved,
  initialValues = {},
}) {

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {

    if (!open) return;

    setForm({
      ...EMPTY_FORM,
      ...initialValues,
    });

    setError("");

  }, [
    open,
    initialValues,
  ]);

  const debit =
    Number(form.debit || 0);

  const credit =
    Number(form.credit || 0);

  const net =
    credit - debit;

  const previewType =
    useMemo(() => {

      if (credit > debit)
        return "Credit Increase";

      if (debit > credit)
        return "Debit Increase";

      return "Balanced";

    }, [
      debit,
      credit,
    ]);

  function update(
    key,
    value
  ) {

    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSubmit(
    e
  ) {

    e.preventDefault();

    try {

      setSaving(true);
      setError("");

      const payload = {

        ...form,

        debit:
          Number(
            form.debit || 0
          ),

        credit:
          Number(
            form.credit || 0
          ),

        amount:
          Number(
            form.amount ||
            Math.max(
              form.debit || 0,
              form.credit || 0
            )
          ),
      };

      const endpoint =
        form.adjustment_type
          ? "/api/finance/ledger/adjustment"
          : "/api/finance/ledger/manual-entry";

      const res =
        await fetch(
          endpoint,
          {
            method: "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        await res.json();

      if (!res.ok) {

        throw new Error(
          data.error ||
          "Failed to save adjustment."
        );
      }

      onSaved?.(
        data
      );

      onClose?.();

    } catch (err) {

      console.error(err);

      setError(
        err.message
      );

    } finally {

      setSaving(false);
    }
  }

  if (!open)
    return null;

  return (
    <div className="finance-modal-overlay">

      <div className="finance-modal finance-modal-xl">

        <div className="finance-modal-header">

          <div>

            <h2>
              Ledger Adjustment
            </h2>

            <p>
              Create enterprise
              accounting
              adjustments,
              debit/credit
              corrections,
              and audit-safe
              finance entries.
            </p>

          </div>

          <button
            type="button"
            className="finance-icon-btn"
            onClick={onClose}
          >
            <X size={18} />
          </button>

        </div>

        <form
          onSubmit={
            handleSubmit
          }
          className="finance-modal-body"
        >

          {error && (
            <div className="finance-alert finance-alert-danger">
              <AlertTriangle
                size={16}
              />
              <span>
                {error}
              </span>
            </div>
          )}

          <div className="finance-grid finance-grid-3">

            <div className="finance-field">
              <label>
                Entry Type
              </label>

              <select
                value={
                  form.entry_type
                }
                onChange={(e) =>
                  update(
                    "entry_type",
                    e.target.value
                  )
                }
              >
                {ENTRY_TYPES.map(
                  (
                    type
                  ) => (
                    <option
                      key={
                        type
                      }
                      value={
                        type
                      }
                    >
                      {type}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="finance-field">
              <label>
                Adjustment Type
              </label>

              <select
                value={
                  form.adjustment_type
                }
                onChange={(e) =>
                  update(
                    "adjustment_type",
                    e.target.value
                  )
                }
              >
                {ADJUSTMENT_TYPES.map(
                  (
                    type
                  ) => (
                    <option
                      key={
                        type
                      }
                      value={
                        type
                      }
                    >
                      {type}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="finance-field">
              <label>
                Reconciliation
              </label>

              <select
                value={
                  form.reconciliation_status
                }
                onChange={(e) =>
                  update(
                    "reconciliation_status",
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

          <div className="finance-section-card">

            <div className="finance-section-title">

              <User size={16} />

              <span>
                Member /
                Payer
                Information
              </span>

            </div>

            <div className="finance-grid finance-grid-3">

              <div className="finance-field">
                <label>
                  Member ID
                </label>

                <input
                  type="number"
                  value={
                    form.member_id
                  }
                  onChange={(e) =>
                    update(
                      "member_id",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="finance-field">
                <label>
                  Member #
                </label>

                <input
                  value={
                    form.member_no
                  }
                  onChange={(e) =>
                    update(
                      "member_no",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="finance-field">
                <label>
                  Full Name
                </label>

                <input
                  value={
                    form.full_name_snapshot
                  }
                  onChange={(e) =>
                    update(
                      "full_name_snapshot",
                      e.target.value
                    )
                  }
                />
              </div>

            </div>

          </div>

          <div className="finance-section-card">

            <div className="finance-section-title">

              <Landmark size={16} />

              <span>
                Accounting
                Values
              </span>

            </div>

            <div className="finance-grid finance-grid-3">

              <div className="finance-field">
                <label>
                  Debit
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={
                    form.debit
                  }
                  onChange={(e) =>
                    update(
                      "debit",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="finance-field">
                <label>
                  Credit
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={
                    form.credit
                  }
                  onChange={(e) =>
                    update(
                      "credit",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="finance-field">
                <label>
                  Amount
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={
                    form.amount
                  }
                  onChange={(e) =>
                    update(
                      "amount",
                      e.target.value
                    )
                  }
                />
              </div>

            </div>

            <div className="finance-summary-inline">

              <div className="finance-summary-chip">
                <span>
                  Debit
                </span>

                <strong>
                  {money(
                    debit
                  )}
                </strong>
              </div>

              <div className="finance-summary-chip">
                <span>
                  Credit
                </span>

                <strong>
                  {money(
                    credit
                  )}
                </strong>
              </div>

              <div className="finance-summary-chip finance-summary-chip-primary">
                <span>
                  Net
                </span>

                <strong>
                  {money(net)}
                </strong>
              </div>

              <div className="finance-summary-chip">
                <span>
                  Preview
                </span>

                <strong>
                  {
                    previewType
                  }
                </strong>
              </div>

            </div>

          </div>

          <div className="finance-section-card">

            <div className="finance-section-title">

              <CreditCard
                size={16}
              />

              <span>
                Linked
                Financial
                Records
              </span>

            </div>

            <div className="finance-grid finance-grid-3">

              <div className="finance-field">
                <label>
                  Payment ID
                </label>

                <input
                  value={
                    form.payment_id
                  }
                  onChange={(e) =>
                    update(
                      "payment_id",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="finance-field">
                <label>
                  Invoice ID
                </label>

                <input
                  value={
                    form.invoice_id
                  }
                  onChange={(e) =>
                    update(
                      "invoice_id",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="finance-field">
                <label>
                  Receipt ID
                </label>

                <input
                  value={
                    form.receipt_id
                  }
                  onChange={(e) =>
                    update(
                      "receipt_id",
                      e.target.value
                    )
                  }
                />
              </div>

            </div>

          </div>

          <div className="finance-section-card">

            <div className="finance-section-title">

              <FileText
                size={16}
              />

              <span>
                Audit &
                Notes
              </span>

            </div>

            <div className="finance-grid finance-grid-2">

              <div className="finance-field">
                <label>
                  Source
                  Reference
                </label>

                <input
                  value={
                    form.source_reference
                  }
                  onChange={(e) =>
                    update(
                      "source_reference",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="finance-field">
                <label>
                  Description
                </label>

                <input
                  value={
                    form.description
                  }
                  onChange={(e) =>
                    update(
                      "description",
                      e.target.value
                    )
                  }
                />
              </div>

            </div>

            <div className="finance-field">
              <label>
                Audit Notes
              </label>

              <textarea
                rows={4}
                value={
                  form.notes
                }
                onChange={(e) =>
                  update(
                    "notes",
                    e.target.value
                  )
                }
              />
            </div>

          </div>

          <div className="finance-modal-footer">

            <button
              type="button"
              className="finance-btn finance-btn-secondary"
              onClick={
                onClose
              }
            >
              Cancel
            </button>

            <button
              type="submit"
              className="finance-btn finance-btn-primary"
              disabled={
                saving
              }
            >
              <Save size={16} />

              <span>
                {saving
                  ? "Saving..."
                  : "Create Ledger Entry"}
              </span>

            </button>

          </div>

        </form>

      </div>

    </div>
  );
}