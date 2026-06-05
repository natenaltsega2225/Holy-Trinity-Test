// frontend/src/components/FinanceDashboard/components/FinanceInvoicePreview.jsx

import React from "react";

import {
  FileText,
  User,
  Calendar,
  CreditCard,
  Download,
  Printer,
  Mail,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

// import "../finance-dashboard.css";

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

  const d =
    new Date(value);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {

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

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceInvoicePreview({

  open,

  invoice,

  onClose,

  onDownload,

  onPrint,

  onEmail,

  onMarkPaid,

  onAddPayment,
}) {

  if (
    !open ||
    !invoice
  ) {

    return null;
  }

  const totalPaid =
    Number(
      invoice.total_paid || 0
    );

  const totalAmount =
    Number(
      invoice.total_amount || 0
    );

  const balance =
    totalAmount -
    totalPaid;

  const paid =
    balance <= 0;

  return (

    <div className="finance-modal-overlay">

      <div className="finance-invoice-preview">

        {/* =====================================
            HEADER
        ===================================== */}

        <div className="finance-invoice-head">

          <div className="finance-invoice-head-left">

            <div className="finance-invoice-icon">

              <FileText size={18} />

            </div>

            <div>

              <h2>
                Invoice Preview
              </h2>

              <p>

                Enterprise accounts
                receivable and
                billing preview.

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
            SUMMARY
        ===================================== */}

        <div className="finance-invoice-summary">

          <div className="finance-summary-box">

            <span>
              Invoice #
            </span>

            <strong>

              {
                invoice.invoice_number
              }

            </strong>

          </div>

          <div className="finance-summary-box">

            <span>
              Status
            </span>

            <strong>

              {pretty(
                invoice.status
              )}

            </strong>

          </div>

          <div className="finance-summary-box">

            <span>
              Due Date
            </span>

            <strong>

              {formatDate(
                invoice.due_date
              )}

            </strong>

          </div>

          <div className="finance-summary-box finance-summary-highlight">

            <span>
              Balance
            </span>

            <strong>

              {money(balance)}

            </strong>

          </div>

        </div>

        {/* =====================================
            BODY
        ===================================== */}

        <div className="finance-invoice-body">

          {/* MEMBER */}

          <div className="finance-invoice-section">

            <div className="finance-invoice-section-title">

              <User size={16} />

              <span>
                Member / Household
              </span>

            </div>

            <div className="finance-grid-2">

              <div>

                <label>
                  Full Name
                </label>

                <strong>

                  {invoice.full_name ||
                    "--"}

                </strong>

              </div>

              <div>

                <label>
                  Member #
                </label>

                <strong>

                  {invoice.member_no ||
                    "--"}

                </strong>

              </div>

              <div>

                <label>
                  Email
                </label>

                <strong>

                  {invoice.email ||
                    "--"}

                </strong>

              </div>

              <div>

                <label>
                  Household
                </label>

                <strong>

                  {invoice.household_name ||
                    "--"}

                </strong>

              </div>

            </div>

          </div>

          {/* BILLING */}

          <div className="finance-invoice-section">

            <div className="finance-invoice-section-title">

              <CreditCard size={16} />

              <span>
                Billing Items
              </span>

            </div>

            <table className="finance-invoice-table">

              <thead>

                <tr>

                  <th>
                    Description
                  </th>

                  <th>
                    Qty
                  </th>

                  <th>
                    Unit
                  </th>

                  <th>
                    Total
                  </th>

                </tr>

              </thead>

              <tbody>

                {(invoice.items || []).map(
                  (
                    item,
                    index
                  ) => (

                    <tr
                      key={index}
                    >

                      <td>

                        <div className="finance-line-item">

                          <strong>

                            {pretty(
                              item.category
                            )}

                          </strong>

                          <span>

                            {item.description ||
                              item.coverage ||
                              "--"}

                          </span>

                        </div>

                      </td>

                      <td>

                        {
                          item.quantity
                        }

                      </td>

                      <td>

                        {money(
                          item.unit_amount
                        )}

                      </td>

                      <td>

                        {money(
                          item.total
                        )}

                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>

          {/* PAYMENTS */}

          <div className="finance-invoice-section">

            <div className="finance-invoice-section-title">

              <CheckCircle2 size={16} />

              <span>
                Payments Applied
              </span>

            </div>

            {(invoice.payments || [])
              .length ? (

              <table className="finance-invoice-payment-table">

                <thead>

                  <tr>

                    <th>
                      Payment #
                    </th>

                    <th>
                      Date
                    </th>

                    <th>
                      Amount
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {invoice.payments.map(
                    (
                      payment,
                      index
                    ) => (

                      <tr
                        key={index}
                      >

                        <td>

                          {
                            payment.payment_number
                          }

                        </td>

                        <td>

                          {formatDate(
                            payment.payment_date
                          )}

                        </td>

                        <td>

                          {money(
                            payment.amount
                          )}

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            ) : (

              <div className="finance-empty-state">

                No payments applied.

              </div>

            )}

          </div>

          {/* TOTALS */}

          <div className="finance-invoice-totals">

            <div>

              <label>
                Total Amount
              </label>

              <strong>

                {money(
                  totalAmount
                )}

              </strong>

            </div>

            <div>

              <label>
                Total Paid
              </label>

              <strong>

                {money(
                  totalPaid
                )}

              </strong>

            </div>

            <div className={`
              ${
                paid
                  ? "paid"
                  : "unpaid"
              }
            `}>

              <label>
                Remaining Balance
              </label>

              <strong>

                {money(
                  balance
                )}

              </strong>

            </div>

          </div>

          {/* STATUS */}

          <div className="finance-invoice-status">

            {paid ? (

              <div className="finance-status-paid">

                <CheckCircle2 size={18} />

                Invoice Fully Paid

              </div>

            ) : (

              <div className="finance-status-unpaid">

                <AlertTriangle size={18} />

                Outstanding Balance

              </div>

            )}

          </div>

        </div>

        {/* =====================================
            FOOTER
        ===================================== */}

        <div className="finance-invoice-actions">

          <button
            className="finance-btn secondary"
            onClick={onClose}
          >

            Close

          </button>

          <button
            className="finance-btn secondary"
            onClick={() =>
              onPrint?.(
                invoice
              )
            }
          >

            <Printer size={16} />

            Print

          </button>

          <button
            className="finance-btn secondary"
            onClick={() =>
              onEmail?.(
                invoice
              )
            }
          >

            <Mail size={16} />

            Email Invoice

          </button>

          <button
            className="finance-btn secondary"
            onClick={() =>
              onDownload?.(
                invoice
              )
            }
          >

            <Download size={16} />

            PDF

          </button>

          {!paid ? (

            <>
              <button
                className="finance-btn secondary"
                onClick={() =>
                  onAddPayment?.(
                    invoice
                  )
                }
              >

                Add Payment

              </button>

              <button
                className="finance-btn primary"
                onClick={() =>
                  onMarkPaid?.(
                    invoice
                  )
                }
              >

                Mark Paid

              </button>
            </>
          ) : null}

        </div>

      </div>

    </div>
  );
}