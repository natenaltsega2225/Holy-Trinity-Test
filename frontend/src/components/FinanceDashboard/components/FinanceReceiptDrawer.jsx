// frontend/src/components/FinanceDashboard/components/FinanceReceiptDrawer.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  X,
  Download,
  Mail,
  Receipt,
  CreditCard,
  FileText,
  User,
  Calendar,
  Wallet,
  BadgeDollarSign,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import api from "../../api";

import FinanceBadge from "../../Shared/FinanceBadge";
import CoverageDisplay from "../../Shared/CoverageDisplay";

import {
  money,
  formatDate,
  pretty,
  categoryLabel,
  paymentSource,
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
    s === "sent" ||
    s === "paid" ||
    s === "issued"
  ) {
    return "success";
  }

  if (
    s === "pending"
  ) {
    return "warning";
  }

  if (
    s === "failed"
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

export default function FinanceReceiptDrawer({
  open,
  onClose,
  receipt,
}) {

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    receiptData,
    setReceiptData,
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
      !receipt?.id
    ) {
      return;
    }

    loadReceipt();

  }, [
    open,
    receipt?.id,
  ]);

  async function loadReceipt() {

    try {

      setLoading(true);

      const {
        data,
      } = await api.get(
        `/receipts/${receipt.id}`
      );

      setReceiptData(
        data?.receipt ||
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
    receiptData ||
    receipt;

  /* =====================================================
     SUMMARY
  ===================================================== */

  const summary =
    useMemo(
      () => {

        return {

          amount:
            Number(
              row?.amount ||
                0
            ),

        };

      },
      [row]
    );

  /* =====================================================
     RESEND EMAIL
  ===================================================== */

  async function handleSendEmail() {

    if (
      !row?.id
    ) {
      return;
    }

    try {

      setSending(
        true
      );

      await api.post(
        `/receipts/${row.id}/send-email`
      );

      alert(
        "Receipt email sent."
      );

      await loadReceipt();

    } catch (err) {

      console.error(err);

      alert(
        err?.response?.data
          ?.error ||
          "Failed to send receipt email."
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

  function handlePdf() {

    if (
      !row?.id
    ) {
      return;
    }

    window.open(
      `/api/receipts/${row.id}/pdf`,
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

              FINANCE RECEIPT

            </div>

            <h2>

              {
                row?.receipt_number ||
                "Receipt"
              }

            </h2>

            <p>

              Enterprise receipt management,
              email delivery,
              Stripe audit tracking,
              downloadable PDFs,
              membership coverage,
              and reconciliation visibility.

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
              handlePdf
            }
          >

            <Download size={16} />

            Open PDF

          </button>

          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={
              handleSendEmail
            }
            disabled={
              sending
            }
          >

            <Mail size={16} />

            {sending
              ? "Sending..."
              : "Send Email"}

          </button>

        </div>

        {/* =====================================
            LOADING
        ===================================== */}

        {loading ? (

          <div className="finance-loading-card">

            Loading receipt...

          </div>

        ) : null}

        {/* =====================================
            CONTENT
        ===================================== */}

        {!loading &&
        row ? (

          <div className="finance-drawer-body">

            {/* =====================================
                SUMMARY
            ===================================== */}

            <div className="finance-summary-grid">

              <div className="finance-summary-card featured">

                <span>
                  Receipt Amount
                </span>

                <h3>

                  {money(
                    summary.amount
                  )}

                </h3>

                <small>
                  Receipt payment total
                </small>

              </div>

              <div className="finance-summary-card">

                <span>
                  Email Status
                </span>

                <h3>

                  <FinanceBadge
                    label={pretty(
                      row.email_status ||
                        "pending"
                    )}
                    type={statusTone(
                      row.email_status
                    )}
                  />

                </h3>

                <small>
                  Delivery lifecycle
                </small>

              </div>

              <div className="finance-summary-card">

                <span>
                  Payment Method
                </span>

                <h3>

                  {pretty(
                    row.method ||
                      row.payment_method
                  )}

                </h3>

                <small>
                  Receipt source
                </small>

              </div>

              <div className="finance-summary-card">

                <span>
                  Provider
                </span>

                <h3>

                  {paymentSource(
                    row.provider ||
                      row.payment_provider
                  )}

                </h3>

                <small>
                  Payment processor
                </small>

              </div>

            </div>

            {/* =====================================
                GRID
            ===================================== */}

            <div className="finance-detail-grid">

              {/* =====================================
                  LEFT
              ===================================== */}

              <div className="finance-detail-column">

                {/* =====================================
                    RECEIPT
                ===================================== */}

                <div className="finance-card">

                  <div className="finance-card-header">

                    <h3>

                      <Receipt
                        size={18}
                      />

                      Receipt Information

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
                      label="Payment #"
                      value={
                        row.payment_number
                      }
                    />

                    <DetailItem
                      label="Invoice #"
                      value={
                        row.invoice_number
                      }
                    />

                    <DetailItem
                      label="Category"
                      value={categoryLabel(
                        row.category ||
                          row.payment_category
                      )}
                    />

                    <DetailItem
                      label="Details"
                      value={
                        row.sub_category ||
                        row.description ||
                        row.plan_name ||
                        row.program_title ||
                        row.donation_category
                      }
                    />

                    <DetailItem
                      label="Created"
                      value={formatDate(
                        row.created_at
                      )}
                    />

                    <DetailItem
                      label="Receipt Date"
                      value={formatDate(
                        row.receipt_date
                      )}
                    />

                    <DetailItem
                      label="Paid Date"
                      value={formatDate(
                        row.payment_date
                      )}
                    />

                  </div>

                </div>

                {/* =====================================
                    COVERAGE
                ===================================== */}

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

              </div>

              {/* =====================================
                  RIGHT
              ===================================== */}

              <div className="finance-detail-column">

                {/* =====================================
                    MEMBER
                ===================================== */}

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
                        row.full_name_snapshot
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
                        row.email_snapshot
                      }
                    />

                    <DetailItem
                      label="Phone"
                      value={
                        row.phone_snapshot
                      }
                    />

                  </div>

                </div>

                {/* =====================================
                    PAYMENT
                ===================================== */}

                <div className="finance-card">

                  <div className="finance-card-header">

                    <h3>

                      <CreditCard
                        size={18}
                      />

                      Payment Information

                    </h3>

                  </div>

                  <div className="finance-detail-list">

                    <DetailItem
                      label="Method"
                      value={pretty(
                        row.method ||
                          row.payment_method
                      )}
                    />

                    <DetailItem
                      label="Provider"
                      value={paymentSource(
                        row.provider ||
                          row.payment_provider
                      )}
                    />

                    <DetailItem
                      label="Reference"
                      value={
                        row.reference_no
                      }
                    />

                    <DetailItem
                      label="Card Brand"
                      value={
                        row.card_brand
                      }
                    />

                    <DetailItem
                      label="Card Last4"
                      value={
                        row.card_last4
                      }
                    />

                    <DetailItem
                      label="Stripe Payment"
                      value={
                        row.stripe_payment_intent
                      }
                    />

                  </div>

                </div>

                {/* =====================================
                    EMAIL STATUS
                ===================================== */}

                <div className="finance-card">

                  <div className="finance-card-header">

                    <h3>

                      <Mail
                        size={18}
                      />

                      Email Delivery

                    </h3>

                  </div>

                  <div className="finance-detail-list">

                    <DetailItem
                      label="Email Status"
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
                      label="Sent To"
                      value={
                        row.emailed_to
                      }
                    />

                    <DetailItem
                      label="Sent At"
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

                {/* =====================================
                    AMOUNT
                ===================================== */}

                <div className="finance-card">

                  <div className="finance-card-header">

                    <h3>

                      <Wallet
                        size={18}
                      />

                      Financial Summary

                    </h3>

                  </div>

                  <div className="finance-financial-list">

                    <div className="finance-financial-row total">

                      <span>

                        Receipt Amount

                      </span>

                      <strong>

                        {money(
                          row.amount
                        )}

                      </strong>

                    </div>

                  </div>

                </div>

                {/* =====================================
                    NOTES
                ===================================== */}

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
                  handlePdf
                }
              >

                <FileText
                  size={16}
                />

                Open Receipt PDF

              </button>

            </div>

          </div>

        ) : null}

      </div>

    </div>
  );
}