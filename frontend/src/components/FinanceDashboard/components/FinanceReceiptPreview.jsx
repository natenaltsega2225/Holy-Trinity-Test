// frontend/src/components/FinanceDashboard/components/FinanceReceiptPreview.jsx

import React from "react";

import {
  Download,
  Mail,
  Printer,
  Receipt,
  CreditCard,
  Calendar,
  User,
  Landmark,
} from "lucide-react";


import "../../../styles/finance-dashboard.css";


/* =========================================================
   HELPERS
========================================================= */

function money(value) {
  return `$${Number(
    value || 0
  ).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) =>
      c.toUpperCase()
    );
}

function formatDate(value) {
  if (!value) {
    return "--";
  }

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "--";
  }

  return d.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

function buildCoverage(row) {
  if (
    String(
      row?.category ||
        row?.payment_type
    ).toLowerCase() !==
    "membership"
  ) {
    return "--";
  }

  const start =
    row.coverage_start_month_name ||
    row.coverage_start_month ||
    "--";

  const end =
    row.coverage_end_month_name ||
    row.coverage_end_month ||
    "--";

  const year =
    row.coverage_year || "";

  return `${start} → ${end} ${year}`;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceReceiptPreview({
  row = {},

  onClose,

  onDownload,

  onPrint,

  onResend,
}) {
  const category =
    row.category ||
    row.payment_type;

  const detail =
    category === "donation"
      ? row.donation_category ||
        row.sub_category
      : category === "school" ||
        category === "trip"
      ? row.program_title ||
        row.sub_category
      : row.plan_name ||
        "--";

  return (
    <div className="finance-modal-overlay">

      <div className="finance-receipt-preview">

        {/* =====================================
            HEADER
        ===================================== */}

        <div className="finance-receipt-head">

          <div className="finance-receipt-head-left">

            <div className="finance-receipt-icon">

              <Receipt size={20} />

            </div>

            <div>

              <h2>
                Receipt Preview
              </h2>

              <p>
                Enterprise finance
                receipt verification
                and delivery.
              </p>

            </div>

          </div>

          <button
            className="finance-modal-close"
            onClick={onClose}
          >
            ×
          </button>

        </div>

        {/* =====================================
            RECEIPT BODY
        ===================================== */}

        <div className="finance-receipt-body">

          {/* =================================
              TOP SUMMARY
          ================================= */}

          <div className="finance-receipt-summary">

            <div className="finance-summary-box">

              <span>
                Receipt #
              </span>

              <strong>

                {row.receipt_number ||
                  "--"}

              </strong>

            </div>

            <div className="finance-summary-box">

              <span>
                Invoice #
              </span>

              <strong>

                {row.invoice_number ||
                  "--"}

              </strong>

            </div>

            <div className="finance-summary-box">

              <span>
                Payment #
              </span>

              <strong>

                {row.payment_number ||
                  "--"}

              </strong>

            </div>

            <div className="finance-summary-box finance-summary-highlight">

              <span>
                Amount
              </span>

              <strong>

                {money(
                  row.amount
                )}

              </strong>

            </div>

          </div>

          {/* =================================
              MEMBER INFO
          ================================= */}

          <div className="finance-receipt-section">

            <div className="finance-receipt-section-title">

              <User size={16} />

              <span>
                Member / Payer
              </span>

            </div>

            <div className="finance-grid-2">

              <div className="finance-detail-item">

                <label>
                  Full Name
                </label>

                <strong>

                  {row.full_name ||
                    row.member_name ||
                    row.guest_name ||
                    "Guest"}

                </strong>

              </div>

              <div className="finance-detail-item">

                <label>
                  Member #
                </label>

                <strong>

                  {row.member_no ||
                    "--"}

                </strong>

              </div>

              <div className="finance-detail-item">

                <label>
                  Email
                </label>

                <strong>

                  {row.email ||
                    "--"}

                </strong>

              </div>

              <div className="finance-detail-item">

                <label>
                  Phone
                </label>

                <strong>

                  {row.phone ||
                    "--"}

                </strong>

              </div>

            </div>

          </div>

          {/* =================================
              PAYMENT INFO
          ================================= */}

          <div className="finance-receipt-section">

            <div className="finance-receipt-section-title">

              <CreditCard size={16} />

              <span>
                Payment Information
              </span>

            </div>

            <div className="finance-grid-2">

              <div className="finance-detail-item">

                <label>
                  Category
                </label>

                <strong>

                  {pretty(
                    category
                  )}

                </strong>

              </div>

              <div className="finance-detail-item">

                <label>
                  Details
                </label>

                <strong>

                  {pretty(
                    detail
                  )}

                </strong>

              </div>

              <div className="finance-detail-item">

                <label>
                  Payment Method
                </label>

                <strong>

                  {pretty(
                    row.method
                  )}

                </strong>

              </div>

              <div className="finance-detail-item">

                <label>
                  Source
                </label>

                <strong>

                  {pretty(
                    row.provider ||
                      row.source
                  )}

                </strong>

              </div>

              <div className="finance-detail-item">

                <label>
                  Reference #
                </label>

                <strong>

                  {row.reference_no ||
                    "--"}

                </strong>

              </div>

              <div className="finance-detail-item">

                <label>
                  Status
                </label>

                <strong>

                  {pretty(
                    row.status
                  )}

                </strong>

              </div>

            </div>

          </div>

          {/* =================================
              COVERAGE
          ================================= */}

          <div className="finance-receipt-section">

            <div className="finance-receipt-section-title">

              <Calendar size={16} />

              <span>
                Membership Coverage
              </span>

            </div>

            <div className="finance-grid-2">

              <div className="finance-detail-item">

                <label>
                  Coverage Period
                </label>

                <strong>

                  {buildCoverage(
                    row
                  )}

                </strong>

              </div>

              <div className="finance-detail-item">

                <label>
                  Months Paid
                </label>

                <strong>

                  {row.months_paid ||
                    "--"}

                </strong>

              </div>

            </div>

            {/* MONTHS */}

            {row.coverage_months ? (

              <div className="finance-coverage-months">

                {String(
                  row.coverage_months
                )
                  .split(",")
                  .map((m) => (

                    <span
                      key={m}
                      className="finance-coverage-pill"
                    >

                      {m}

                    </span>
                  ))}

              </div>

            ) : null}

          </div>

          {/* =================================
              NOTES
          ================================= */}

          {row.notes ? (

            <div className="finance-receipt-section">

              <div className="finance-receipt-section-title">

                <Landmark size={16} />

                <span>
                  Notes
                </span>

              </div>

              <div className="finance-receipt-notes">

                {row.notes}

              </div>

            </div>

          ) : null}

          {/* =================================
              FOOTER INFO
          ================================= */}

          <div className="finance-receipt-footer-info">

            <div>

              <label>
                Payment Date
              </label>

              <strong>

                {formatDate(
                  row.payment_date ||
                    row.created_at
                )}

              </strong>

            </div>

            <div>

              <label>
                Processed By
              </label>

              <strong>

                {row.created_by_name ||
                  row.processed_by ||
                  "--"}

              </strong>

            </div>

          </div>

        </div>

        {/* =====================================
            FOOTER ACTIONS
        ===================================== */}

        <div className="finance-receipt-actions">

          <button
            type="button"
            className="finance-btn secondary"
            onClick={onClose}
          >

            Close

          </button>

          <button
            type="button"
            className="finance-btn secondary"
            onClick={() =>
              onPrint?.(row)
            }
          >

            <Printer size={16} />

            Print

          </button>

          <button
            type="button"
            className="finance-btn secondary"
            onClick={() =>
              onResend?.(row)
            }
          >

            <Mail size={16} />

            Resend Receipt

          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={() =>
              onDownload?.(row)
            }
          >

            <Download size={16} />

            Download PDF

          </button>

        </div>

      </div>

    </div>
  );
}