// frontend/src/components/FinanceDashboard/components/FinancePaymentDrawer.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  X,
  Receipt,
  FileText,
  CreditCard,
  Calendar,
  Mail,
  User,
  Landmark,
  Clock3,
  Download,
  Send,
  Wallet,
  BadgeDollarSign,
  CheckCircle2,
  AlertTriangle,
  RefreshCcw,
} from "lucide-react";

import api from "../../api";

import FinanceBadge from "../../Shared/FinanceBadge";
import CoverageDisplay from "../../Shared/CoverageDisplay";

import {
  money,
  pretty,
  formatDate,
  categoryLabel,
  paymentSource,
  cardDisplay,
} from "../../../utils/paymentFormatters";

import "../../../styles/finance-enterprise.css";

/* =========================================================
   HELPERS
========================================================= */

function statusTone(status) {

  const s = String(
    status || ""
  ).toLowerCase();

  if (
    s === "paid" ||
    s === "completed" ||
    s === "success"
  ) {
    return "success";
  }

  if (
    s === "pending"
  ) {
    return "warning";
  }

  if (
    s === "failed" ||
    s === "cancelled" ||
    s === "refunded"
  ) {
    return "danger";
  }

  return "primary";
}

function DetailItem({
  label,
  value,
}) {

  return (

    <div className="finance-detail-item">

      <span>
        {label}
      </span>

      <strong>
        {value || "--"}
      </strong>

    </div>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinancePaymentDrawer({
  open,
  payment,
  onClose,
}) {

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    paymentData,
    setPaymentData,
  ] = useState(null);

  const [
    sending,
    setSending,
  ] = useState(false);

  /* =====================================================
     LOAD
  ===================================================== */

  useEffect(() => {

    if (
      !open ||
      !payment?.id
    ) {
      return;
    }

    loadPayment();

  }, [
    open,
    payment?.id,
  ]);

  async function loadPayment() {

    try {

      setLoading(true);

      const {
        data,
      } = await api.get(
        `/payments/${payment.id}`
      );

      setPaymentData(
        data?.payment ||
          null
      );

    } catch (err) {

      console.error(err);

    } finally {

      setLoading(false);
    }
  }

  /* =====================================================
     ACTIVE ROW
  ===================================================== */

  const row =
    paymentData ||
    payment;

  /* =====================================================
     SUMMARY
  ===================================================== */

  const financialSummary =
    useMemo(
      () => {

        return {

          amount:
            Number(
              row?.amount ||
                0
            ),

          refunded:
            Number(
              row?.refunded_amount ||
                0
            ),

          net:
            Number(
              row?.amount ||
                0
            ) -
            Number(
              row?.refunded_amount ||
                0
            ),

        };

      },
      [row]
    );

  /* =====================================================
     RESEND RECEIPT
  ===================================================== */

  async function handleResendReceipt() {

    try {

      setSending(
        true
      );

      await api.post(
        `/receipts/payment/${
          row.payment_id ||
          row.id
        }/resend`
      );

      alert(
        "Receipt resent."
      );

      await loadPayment();

    } catch (err) {

      console.error(err);

      alert(
        err?.response?.data
          ?.error ||
          "Failed to resend receipt."
      );

    } finally {

      setSending(
        false
      );
    }
  }

  /* =====================================================
     PDF
  ===================================================== */

  function openReceiptPdf() {

    if (
      !row?.receipt_id
    ) {
      return;
    }

    window.open(
      `/api/receipts/${row.receipt_id}/pdf`,
      "_blank"
    );
  }

  function openInvoicePdf() {

    if (
      !row?.invoice_id
    ) {
      return;
    }

    window.open(
      `/api/invoices/${row.invoice_id}/pdf`,
      "_blank"
    );
  }

  /* =====================================================
     CLOSE
  ===================================================== */

  if (!open) {
    return null;
  }

  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="finance-drawer-overlay">

      <div className="finance-drawer finance-drawer-xl">

        {/* =====================================
            HEADER
        ===================================== */}

        <div className="finance-drawer-header">

          <div>

            <div className="finance-drawer-eyebrow">

              FINANCE PAYMENT

            </div>

            <h2>

              {
                row?.payment_number ||
                "Payment"
              }

            </h2>

            <p>

              Enterprise payment audit,
              membership coverage,
              Stripe visibility,
              invoice linkage,
              receipt tracking,
              reconciliation,
              and financial compliance operations.

            </p>

          </div>

          <button
            type="button"
            className="finance-drawer-close"
            onClick={onClose}
          >

            <X size={18} />

          </button>

        </div>

        {/* =====================================
            TOOLBAR
        ===================================== */}

        <div className="finance-toolbar">

          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={
              openReceiptPdf
            }
          >

            <Receipt size={16} />

            Receipt PDF

          </button>

          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={
              openInvoicePdf
            }
          >

            <FileText size={16} />

            Invoice PDF

          </button>

          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={
              handleResendReceipt
            }
            disabled={
              sending
            }
          >

            <Send size={16} />

            {sending
              ? "Sending..."
              : "Resend Receipt"}

          </button>

        </div>

        {/* =====================================
            LOADING
        ===================================== */}

        {loading ? (

          <div className="finance-loading-card">

            Loading payment...

          </div>

        ) : null}

        {/* =====================================
            CONTENT
        ===================================== */}

        {!loading &&
        row ? (

          <div className="finance-drawer-body">

            {/* =====================================
                SUMMARY CARDS
            ===================================== */}

            <div className="finance-summary-grid">

              <div className="finance-summary-card featured">

                <span>
                  Payment Amount
                </span>

                <h3>

                  {money(
                    financialSummary.amount
                  )}

                </h3>

                <small>
                  Gross payment total
                </small>

              </div>

              <div className="finance-summary-card">

                <span>
                  Refunded
                </span>

                <h3>

                  {money(
                    financialSummary.refunded
                  )}

                </h3>

                <small>
                  Refund adjustments
                </small>

              </div>

              <div className="finance-summary-card">

                <span>
                  Net Amount
                </span>

                <h3>

                  {money(
                    financialSummary.net
                  )}

                </h3>

                <small>
                  Net treasury impact
                </small>

              </div>

              <div className="finance-summary-card">

                <span>
                  Status
                </span>

                <h3>

                  <FinanceBadge
                    label={pretty(
                      row.status
                    )}
                    type={statusTone(
                      row.status
                    )}
                  />

                </h3>

                <small>
                  Payment lifecycle
                </small>

              </div>

            </div>

            {/* =====================================
                MAIN GRID
            ===================================== */}

            <div className="finance-detail-grid">

              {/* =====================================
                  LEFT
              ===================================== */}

              <div className="finance-detail-column">

                {/* PAYMENT */}

                <div className="finance-card">

                  <div className="finance-card-header">

                    <h3>

                      <CreditCard
                        size={18}
                      />

                      Payment Details

                    </h3>

                  </div>

                  <div className="finance-detail-list">

                    <DetailItem
                      label="Payment #"
                      value={
                        row.payment_number
                      }
                    />

                    <DetailItem
                      label="Category"
                      value={categoryLabel(
                        row.category ||
                          row.payment_type
                      )}
                    />

                    <DetailItem
                      label="Details"
                      value={
                        row.sub_category ||
                        row.plan_name ||
                        row.program_title ||
                        row.description ||
                        row.donation_category
                      }
                    />

                    <DetailItem
                      label="Method"
                      value={pretty(
                        row.method
                      )}
                    />

                    <DetailItem
                      label="Provider"
                      value={paymentSource(
                        row.provider
                      )}
                    />

                    <DetailItem
                      label="Reference #"
                      value={
                        row.reference_no
                      }
                    />

                    <DetailItem
                      label="Stripe Payment"
                      value={
                        row.stripe_payment_intent
                      }
                    />

                    <DetailItem
                      label="Stripe Invoice"
                      value={
                        row.stripe_invoice_id
                      }
                    />

                    <DetailItem
                      label="Created"
                      value={formatDate(
                        row.created_at
                      )}
                    />

                    <DetailItem
                      label="Paid Date"
                      value={formatDate(
                        row.payment_date ||
                          row.paid_at
                      )}
                    />

                  </div>

                </div>

                {/* COVERAGE */}

                <div className="finance-card">

                  <div className="finance-card-header">

                    <h3>

                      <Calendar
                        size={18}
                      />

                      Membership Coverage

                    </h3>

                  </div>

                  <CoverageDisplay
                    row={row}
                    showMonths
                    large
                  />

                </div>

                {/* RECONCILIATION */}

                <div className="finance-card">

                  <div className="finance-card-header">

                    <h3>

                      <RefreshCcw
                        size={18}
                      />

                      Reconciliation

                    </h3>

                  </div>

                  <div className="finance-detail-list">

                    <DetailItem
                      label="Reconciliation Status"
                      value={
                        <FinanceBadge
                          label={pretty(
                            row.reconciliation_status ||
                              "pending"
                          )}
                          type={
                            String(
                              row.reconciliation_status ||
                                ""
                            ).toLowerCase() ===
                            "matched"
                              ? "success"
                              : "warning"
                          }
                        />
                      }
                    />

                    <DetailItem
                      label="Matched Batch"
                      value={
                        row.reconciliation_batch
                      }
                    />

                    <DetailItem
                      label="Matched At"
                      value={formatDate(
                        row.reconciled_at
                      )}
                    />

                  </div>

                </div>

              </div>

              {/* =====================================
                  RIGHT
              ===================================== */}

              <div className="finance-detail-column">

                {/* MEMBER */}

                <div className="finance-card">

                  <div className="finance-card-header">

                    <h3>

                      <User
                        size={18}
                      />

                      Member / Payer

                    </h3>

                  </div>

                  <div className="finance-detail-list">

                    <DetailItem
                      label="Full Name"
                      value={
                        row.full_name ||
                        row.full_name_snapshot ||
                        row.guest_name
                      }
                    />

                    <DetailItem
                      label="Member #"
                      value={
                        row.member_no
                      }
                    />

                    <DetailItem
                      label="Email"
                      value={
                        row.email ||
                        row.email_snapshot
                      }
                    />

                    <DetailItem
                      label="Phone"
                      value={
                        row.phone ||
                        row.phone_snapshot
                      }
                    />

                  </div>

                </div>

                {/* RECEIPT + INVOICE */}

                <div className="finance-card">

                  <div className="finance-card-header">

                    <h3>

                      <Receipt
                        size={18}
                      />

                      Receipt / Invoice

                    </h3>

                  </div>

                  <div className="finance-detail-list">

                    <DetailItem
                      label="Receipt #"
                      value={
                        row.receipt_number
                      }
                    />

                    <DetailItem
                      label="Invoice #"
                      value={
                        row.invoice_number
                      }
                    />

                    <DetailItem
                      label="Receipt Email"
                      value={
                        <FinanceBadge
                          label={pretty(
                            row.email_status ||
                              "pending"
                          )}
                          type={statusTone(
                            row.email_status
                          )}
                        />
                      }
                    />

                    <DetailItem
                      label="Emailed At"
                      value={formatDate(
                        row.emailed_at
                      )}
                    />

                    <DetailItem
                      label="Email Error"
                      value={
                        row.email_error
                      }
                    />

                  </div>

                </div>

                {/* CARD */}

                <div className="finance-card">

                  <div className="finance-card-header">

                    <h3>

                      <Wallet
                        size={18}
                      />

                      Card Information

                    </h3>

                  </div>

                  <div className="finance-detail-list">

                    <DetailItem
                      label="Card"
                      value={cardDisplay(
                        row
                      )}
                    />

                    <DetailItem
                      label="Brand"
                      value={
                        row.card_brand
                      }
                    />

                    <DetailItem
                      label="Last 4"
                      value={
                        row.card_last4
                      }
                    />

                    <DetailItem
                      label="Expiry"
                      value={
                        row.card_expiry
                      }
                    />

                  </div>

                </div>

                {/* TIMELINE */}

                <div className="finance-card">

                  <div className="finance-card-header">

                    <h3>

                      <Clock3
                        size={18}
                      />

                      Timeline

                    </h3>

                  </div>

                  <div className="finance-timeline">

                    <div className="finance-timeline-item">

                      <span>
                        Payment Created
                      </span>

                      <strong>

                        {formatDate(
                          row.created_at
                        )}

                      </strong>

                    </div>

                    <div className="finance-timeline-item">

                      <span>
                        Payment Posted
                      </span>

                      <strong>

                        {formatDate(
                          row.payment_date
                        )}

                      </strong>

                    </div>

                    <div className="finance-timeline-item">

                      <span>
                        Receipt Sent
                      </span>

                      <strong>

                        {formatDate(
                          row.emailed_at
                        )}

                      </strong>

                    </div>

                  </div>

                </div>

                {/* NOTES */}

                {row.notes ? (

                  <div className="finance-card">

                    <div className="finance-card-header">

                      <h3>

                        <BadgeDollarSign
                          size={18}
                        />

                        Notes

                      </h3>

                    </div>

                    <div className="finance-notes-box">

                      {row.notes}

                    </div>

                  </div>

                ) : null}

              </div>

            </div>

            {/* =====================================
                FOOTER
            ===================================== */}

            <div className="finance-drawer-footer">

              <button
                type="button"
                className="finance-btn finance-btn-secondary"
                onClick={
                  onClose
                }
              >

                Close

              </button>

              <button
                type="button"
                className="finance-btn finance-btn-primary"
                onClick={
                  openReceiptPdf
                }
              >

                <Download
                  size={16}
                />

                Receipt PDF

              </button>

            </div>

          </div>

        ) : null}

      </div>

    </div>
  );
}