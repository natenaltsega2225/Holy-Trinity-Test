// frontend/src/components/FinanceDashboard/components/FinanceLedgerEntryDrawer.jsx

import React from "react";

import {
  X,
  Receipt,
  CreditCard,
  FileText,
  Landmark,
  Calendar,
  User,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

import FinanceBadge from "../../Shared/FinanceBadge";

import "../../../styles/shared-payment-components.css";
// import "../finance-dashboard.css";

function money(value) {

  return Number(
    value || 0
  ).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  );
}

function pretty(
  value
) {

  return String(
    value || ""
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(/\b\w/g, (m) =>
      m.toUpperCase()
    );
}

function formatDate(
  value
) {

  if (!value)
    return "--";

  return new Date(
    value
  ).toLocaleString();
}

function StatusBadge({
  value,
}) {

  const status =
    String(
      value || ""
    ).toLowerCase();

  let type =
    "primary";

  if (
    [
      "posted",
      "matched",
      "paid",
    ].includes(status)
  ) {
    type = "success";
  }

  if (
    [
      "pending",
      "draft",
    ].includes(status)
  ) {
    type = "warning";
  }

  if (
    [
      "reversed",
      "failed",
      "void",
    ].includes(status)
  ) {
    type = "danger";
  }

  return (
    <FinanceBadge
      label={pretty(
        value
      )}
      type={type}
    />
  );
}

export default function FinanceLedgerEntryDrawer({
  open,
  onClose,
  entry,
}) {

  if (
    !open ||
    !entry
  )
    return null;

  return (
    <div className="finance-drawer-overlay">

      <div className="finance-drawer finance-drawer-xl">

        <div className="finance-drawer-header">

          <div>

            <h2>
              Ledger Entry
            </h2>

            <p>
              Enterprise
              accounting
              visibility,
              reconciliation,
              linked payment
              records,
              invoices,
              receipts,
              and audit
              tracking.
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

        <div className="finance-drawer-body">

          <div className="finance-detail-grid">

            <div className="finance-detail-card">

              <div className="finance-detail-card-title">
                <Landmark size={16} />
                <span>
                  Ledger
                  Information
                </span>
              </div>

              <div className="finance-detail-list">

                <div className="finance-detail-row">
                  <span>
                    Ledger #
                  </span>

                  <strong>
                    {entry.ledger_uuid ||
                      entry.ledger_number ||
                      "--"}
                  </strong>
                </div>

                <div className="finance-detail-row">
                  <span>
                    Entry Type
                  </span>

                  <strong>
                    {pretty(
                      entry.entry_type ||
                      entry.record_type
                    )}
                  </strong>
                </div>

                <div className="finance-detail-row">
                  <span>
                    Status
                  </span>

                  <StatusBadge
                    value={
                      entry.status ||
                      entry.ledger_status
                    }
                  />
                </div>

                <div className="finance-detail-row">
                  <span>
                    Reconciliation
                  </span>

                  <StatusBadge
                    value={
                      entry.reconciliation_status
                    }
                  />
                </div>

              </div>

            </div>

            <div className="finance-detail-card">

              <div className="finance-detail-card-title">
                <User size={16} />
                <span>
                  Member /
                  Payer
                </span>
              </div>

              <div className="finance-detail-list">

                <div className="finance-detail-row">
                  <span>
                    Full Name
                  </span>

                  <strong>
                    {entry.full_name_snapshot ||
                      "--"}
                  </strong>
                </div>

                <div className="finance-detail-row">
                  <span>
                    Member #
                  </span>

                  <strong>
                    {entry.member_no ||
                      "--"}
                  </strong>
                </div>

                <div className="finance-detail-row">
                  <span>
                    Member ID
                  </span>

                  <strong>
                    {entry.member_id ||
                      "--"}
                  </strong>
                </div>

              </div>

            </div>

          </div>

          <div className="finance-summary-grid">

            <div className="finance-summary-card">
              <span>
                Debit
              </span>

              <strong>
                {money(
                  entry.debit_amount
                )}
              </strong>
            </div>

            <div className="finance-summary-card finance-summary-card-success">
              <span>
                Credit
              </span>

              <strong>
                {money(
                  entry.credit_amount
                )}
              </strong>
            </div>

            <div className="finance-summary-card finance-summary-card-primary">
              <span>
                Running
                Balance
              </span>

              <strong>
                {money(
                  entry.running_balance
                )}
              </strong>
            </div>

          </div>

          <div className="finance-detail-grid">

            <div className="finance-detail-card">

              <div className="finance-detail-card-title">
                <CreditCard
                  size={16}
                />
                <span>
                  Payment
                  Linkage
                </span>
              </div>

              <div className="finance-detail-list">

                <div className="finance-detail-row">
                  <span>
                    Payment #
                  </span>

                  <strong>
                    {entry.payment_number ||
                      "--"}
                  </strong>
                </div>

                <div className="finance-detail-row">
                  <span>
                    Payment ID
                  </span>

                  <strong>
                    {entry.payment_id ||
                      "--"}
                  </strong>
                </div>

              </div>

            </div>

            <div className="finance-detail-card">

              <div className="finance-detail-card-title">
                <FileText
                  size={16}
                />
                <span>
                  Invoice
                  Linkage
                </span>
              </div>

              <div className="finance-detail-list">

                <div className="finance-detail-row">
                  <span>
                    Invoice #
                  </span>

                  <strong>
                    {entry.invoice_number ||
                      "--"}
                  </strong>
                </div>

                <div className="finance-detail-row">
                  <span>
                    Invoice ID
                  </span>

                  <strong>
                    {entry.invoice_id ||
                      "--"}
                  </strong>
                </div>

              </div>

            </div>

            <div className="finance-detail-card">

              <div className="finance-detail-card-title">
                <Receipt
                  size={16}
                />
                <span>
                  Receipt
                  Linkage
                </span>
              </div>

              <div className="finance-detail-list">

                <div className="finance-detail-row">
                  <span>
                    Receipt #
                  </span>

                  <strong>
                    {entry.receipt_number ||
                      "--"}
                  </strong>
                </div>

                <div className="finance-detail-row">
                  <span>
                    Receipt ID
                  </span>

                  <strong>
                    {entry.receipt_id ||
                      "--"}
                  </strong>
                </div>

              </div>

            </div>

          </div>

          <div className="finance-detail-grid">

            <div className="finance-detail-card">

              <div className="finance-detail-card-title">
                <Calendar
                  size={16}
                />
                <span>
                  Timeline
                </span>
              </div>

              <div className="finance-detail-list">

                <div className="finance-detail-row">
                  <span>
                    Record Date
                  </span>

                  <strong>
                    {formatDate(
                      entry.record_date
                    )}
                  </strong>
                </div>

                <div className="finance-detail-row">
                  <span>
                    Posted At
                  </span>

                  <strong>
                    {formatDate(
                      entry.posted_at
                    )}
                  </strong>
                </div>

                <div className="finance-detail-row">
                  <span>
                    Created At
                  </span>

                  <strong>
                    {formatDate(
                      entry.created_at
                    )}
                  </strong>
                </div>

              </div>

            </div>

            <div className="finance-detail-card">

              <div className="finance-detail-card-title">
                <ShieldCheck
                  size={16}
                />
                <span>
                  Audit
                  Information
                </span>
              </div>

              <div className="finance-detail-list">

                <div className="finance-detail-row">
                  <span>
                    Source
                  </span>

                  <strong>
                    {pretty(
                      entry.source
                    )}
                  </strong>
                </div>

                <div className="finance-detail-row">
                  <span>
                    Reference
                  </span>

                  <strong>
                    {entry.source_reference ||
                      "--"}
                  </strong>
                </div>

                <div className="finance-detail-row">
                  <span>
                    Created By
                  </span>

                  <strong>
                    {entry.created_by ||
                      "--"}
                  </strong>
                </div>

              </div>

            </div>

            <div className="finance-detail-card">

              <div className="finance-detail-card-title">
                <RotateCcw
                  size={16}
                />
                <span>
                  Reversal
                </span>
              </div>

              <div className="finance-detail-list">

                <div className="finance-detail-row">
                  <span>
                    Reversal ID
                  </span>

                  <strong>
                    {entry.reversal_entry_id ||
                      "--"}
                  </strong>
                </div>

                <div className="finance-detail-row">
                  <span>
                    Reversed At
                  </span>

                  <strong>
                    {formatDate(
                      entry.reversed_at
                    )}
                  </strong>
                </div>

                <div className="finance-detail-row">
                  <span>
                    Reason
                  </span>

                  <strong>
                    {entry.reversal_reason ||
                      "--"}
                  </strong>
                </div>

              </div>

            </div>

          </div>

          <div className="finance-detail-card">

            <div className="finance-detail-card-title">
              <FileText
                size={16}
              />
              <span>
                Description &
                Notes
              </span>
            </div>

            <div className="finance-detail-description">

              <p>
                {entry.description ||
                  "--"}
              </p>

              <hr />

              <p>
                {entry.notes ||
                  "No notes available."}
              </p>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}