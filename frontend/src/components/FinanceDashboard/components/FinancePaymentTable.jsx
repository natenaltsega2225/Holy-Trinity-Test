
// frontend/src/components/FinanceDashboard/components/FinancePaymentTable.jsx

import React from "react";

/* =========================================================
   HELPERS
========================================================= */

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "--";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "--";

  return d.toLocaleDateString("en-US");
}

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusClass(status) {
  const s = String(status || "").toLowerCase();

  if (["paid", "completed", "succeeded", "success"].includes(s)) {
    return "success";
  }

  if (["pending", "processing", "open"].includes(s)) {
    return "warning";
  }

  if (["failed", "refunded", "cancelled", "void"].includes(s)) {
    return "danger";
  }

  return "neutral";
}

function cardSummary(row = {}) {
  const brand =
    row.card_brand ||
    row.brand ||
    row.payment_brand ||
    "";

  const last4 =
    row.card_last4 ||
    row.last4 ||
    row.payment_last4 ||
    "";

  const expMonth =
    row.card_exp_month ||
    row.exp_month ||
    row.payment_exp_month ||
    "";

  const expYear =
    row.card_exp_year ||
    row.exp_year ||
    row.payment_exp_year ||
    "";

  if (!last4) {
    if (
      String(row.method || row.payment_method || "").toLowerCase() === "ach"
    ) {
      return "ACH / Bank";
    }

    return "--";
  }

  const exp =
    expMonth && expYear
      ? `Exp ${String(expMonth).padStart(2, "0")}/${String(expYear).slice(-2)}`
      : "Exp --";

  return `${pretty(brand)} •••• ${last4} · ${exp}`;
}

function methodLabel(row = {}) {
  const method = String(row.method || row.payment_method || "").toLowerCase();

  if (method === "card") return "Card";
  if (method === "ach") return "ACH";
  if (method === "bank_deposit") return "Bank Deposit";

  return pretty(method || row.provider || "--");
}

function payerName(row = {}) {
  return (
    row.full_name_snapshot ||
    row.member_name ||
    row.full_name ||
    row.guest_name ||
    row.donor_name ||
    "Guest"
  );
}

function payerSub(row = {}) {
  return (
    row.member_no ||
    row.email_snapshot ||
    row.email ||
    row.phone_snapshot ||
    row.phone ||
    "--"
  );
}

function coverageText(row = {}) {
  if (row.coverage_label) return row.coverage_label;

  if (row.category !== "membership" && row.payment_type !== "membership") {
    return "--";
  }

  const start =
    row.coverage_start_month ||
    row.coverage_start ||
    "--";

  const end =
    row.coverage_end_month ||
    row.coverage_end ||
    "--";

  return `${pretty(start)} - ${pretty(end)} ${row.coverage_year || ""}`;
}

function detailText(row = {}) {
  const category = String(row.category || row.payment_type || "").toLowerCase();

  if (category === "donation") {
    return pretty(row.donation_category || row.sub_category);
  }

  if (category === "school" || category === "trip") {
    return row.program_title || row.program_name || row.sub_category || "--";
  }

  if (category === "membership") {
    return row.plan_name || row.sub_category || "Membership";
  }

  return row.sub_category || row.description || "--";
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinancePaymentTable({
  rows = [],
  loading = false,

  onView,
  onEdit,
  onRefund,
  onViewReceipt,
  onDownloadReceipt,
  onViewInvoice,
  onViewLedger,
  onViewMember,
}) {
  if (loading) {
    return <div className="finance-table-loading">Loading payments...</div>;
  }

  if (!rows.length) {
    return <div className="finance-table-empty">No payments found.</div>;
  }

  return (
    <div className="finance-payment-table-wrap">
      <table className="finance-payment-table">
        <thead>
          <tr>
            <th>Payment #</th>
            <th>Member / Donor</th>
            <th>Category</th>
            <th>Details</th>
            <th>Coverage</th>
            <th>Method</th>
            <th>Card / ACH</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Receipt</th>
            <th>Invoice</th>
            <th>Date</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row.payment_id || row.payment_number}>
              <td>
                <strong>{row.payment_number || "--"}</strong>
                <small>
                  {row.stripe_checkout_session_id ||
                    row.stripe_payment_intent_id ||
                    row.reference_no ||
                    ""}
                </small>
              </td>

              <td>
                <div className="finance-member-cell">
                  <strong>{payerName(row)}</strong>
                  <span>{payerSub(row)}</span>
                </div>
              </td>

              <td>
                <span className="finance-category-badge">
                  {pretty(row.category || row.payment_type)}
                </span>
              </td>

              <td>
                <div className="finance-detail-cell">
                  <strong>{detailText(row)}</strong>
                  <span>{row.reference_no || row.description || "--"}</span>
                </div>
              </td>

              <td>
                <span className="finance-coverage-cell">
                  {coverageText(row)}
                </span>
              </td>

              <td>
                <span className="finance-method-badge">
                  {methodLabel(row)}
                </span>
              </td>

              <td>
                <span className="finance-card-summary">
                  {cardSummary(row)}
                </span>
              </td>

              <td>
                <strong>{money(row.amount || row.total_amount)}</strong>
              </td>

              <td>
                <span
                  className={`finance-status-badge ${statusClass(
                    row.status || row.payment_status
                  )}`}
                >
                  {pretty(row.status || row.payment_status || "paid")}
                </span>
              </td>

              <td>
                {row.receipt_number ? (
                  <button
                    type="button"
                    className="finance-inline-btn"
                    onClick={() => onViewReceipt?.(row)}
                  >
                    {row.receipt_number}
                  </button>
                ) : (
                  "--"
                )}
              </td>

              <td>
                {row.invoice_number ? (
                  <button
                    type="button"
                    className="finance-inline-btn"
                    onClick={() => onViewInvoice?.(row)}
                  >
                    {row.invoice_number}
                  </button>
                ) : (
                  "--"
                )}
              </td>

              <td>{formatDate(row.payment_date || row.paid_at || row.created_at)}</td>

              <td>
                <div className="finance-kebab-wrap">
                  <button type="button" className="finance-kebab-btn">
                    ⋮
                  </button>

                  <div className="finance-kebab-menu">
                    <button type="button" onClick={() => onView?.(row)}>
                      View
                    </button>

                    <button type="button" onClick={() => onEdit?.(row)}>
                      Edit
                    </button>

                    <button type="button" onClick={() => onViewMember?.(row)}>
                      Member Profile
                    </button>

                    <button type="button" onClick={() => onViewLedger?.(row)}>
                      View Ledger
                    </button>

                    <button type="button" onClick={() => onViewReceipt?.(row)}>
                      Receipt
                    </button>

                    <button
                      type="button"
                      onClick={() => onDownloadReceipt?.(row)}
                    >
                      Download PDF
                    </button>

                    <button
                      type="button"
                      onClick={() => onRefund?.(row)}
                      className="danger"
                    >
                      Refund
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}