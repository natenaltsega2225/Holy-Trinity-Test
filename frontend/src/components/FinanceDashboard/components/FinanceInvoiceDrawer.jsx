// frontend/src/components/FinanceDashboard/components/FinanceInvoiceDrawer.jsx

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
  AlertTriangle,
  CheckCircle2,
  FileText,
  User,
  Calendar,
  Wallet,
  BadgeDollarSign,
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

  if (s === "paid") {
    return "success";
  }

  if (
    s === "partial"
  ) {
    return "warning";
  }

  if (
    s === "overdue"
  ) {
    return "danger";
  }

  if (
    s === "cancelled"
  ) {
    return "muted";
  }

  return "primary";
}

function DetailItem({
  label,
  value,
}) {
  return (
    <div className="finance-detail-item">
      <span>{label}</span>

      <strong>
        {value || "--"}
      </strong>
    </div>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceInvoiceDrawer({
  open,
  onClose,
  invoice,
}) {

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    invoiceData,
    setInvoiceData,
  ] = useState(null);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    markingPaid,
    setMarkingPaid,
  ] = useState(false);

  const [
    cancelling,
    setCancelling,
  ] = useState(false);

  /* =====================================================
     LOAD INVOICE
  ===================================================== */

  useEffect(() => {

    if (
      !open ||
      !invoice?.id
    ) {
      return;
    }

    loadInvoice();

  }, [
    open,
    invoice?.id,
  ]);

  async function loadInvoice() {

    try {

      setLoading(true);

      const {
        data,
      } = await api.get(
        `/invoices/${invoice.id}`
      );

      setInvoiceData(
        data?.invoice ||
          null
      );

    } catch (err) {

      console.error(err);

    } finally {

      setLoading(false);
    }
  }

  /* =====================================================
     ACTIVE INVOICE
  ===================================================== */

  const row =
    invoiceData ||
    invoice;

  /* =====================================================
     SUMMARY
  ===================================================== */

  const financialSummary =
    useMemo(
      () => {

        const total =
          Number(
            row?.total_amount ||
              row?.amount ||
              0
          );

        const paid =
          Number(
            row?.paid_amount ||
              0
          );

        const balance =
          Number(
            row?.balance_due ||
              0
          );

        return {
          total,
          paid,
          balance,
        };

      },
      [row]
    );

  /* =====================================================
     GENERATE PDF
  ===================================================== */

  async function handleGeneratePdf() {

    if (
      !row?.id
    ) {
      return;
    }

    try {

      setGenerating(
        true
      );

      await api.post(
        `/invoices/${row.id}/generate-pdf`
      );

      window.open(
        `/api/invoices/${row.id}/pdf`,
        "_blank"
      );

      await loadInvoice();

    } catch (err) {

      console.error(err);

      alert(
        "Failed to generate invoice PDF."
      );

    } finally {

      setGenerating(
        false
      );
    }
  }

  /* =====================================================
     SEND EMAIL
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
        `/invoices/${row.id}/send-email`,
        {}
      );

      alert(
        "Invoice email sent."
      );

      await loadInvoice();

    } catch (err) {

      console.error(err);

      alert(
        err?.response?.data
          ?.error ||
          "Failed to send invoice email."
      );

    } finally {

      setSending(
        false
      );
    }
  }

  /* =====================================================
     MARK PAID
  ===================================================== */

  async function handleMarkPaid() {

    if (
      !row?.id
    ) {
      return;
    }

    const ok =
      window.confirm(
        "Mark this invoice fully paid?"
      );

    if (!ok) {
      return;
    }

    try {

      setMarkingPaid(
        true
      );

      await api.post(
        `/invoices/${row.id}/mark-paid`,
        {
          amount:
            row.balance_due ||
            row.total_amount,
        }
      );

      await loadInvoice();

    } catch (err) {

      console.error(err);

      alert(
        err?.response?.data
          ?.error ||
          "Failed to mark invoice paid."
      );

    } finally {

      setMarkingPaid(
        false
      );
    }
  }

  /* =====================================================
     CANCEL
  ===================================================== */

  async function handleCancelInvoice() {

    if (
      !row?.id
    ) {
      return;
    }

    const ok =
      window.confirm(
        "Cancel this invoice?"
      );

    if (!ok) {
      return;
    }

    try {

      setCancelling(
        true
      );

      await api.post(
        `/invoices/${row.id}/cancel`
      );

      await loadInvoice();

    } catch (err) {

      console.error(err);

      alert(
        err?.response?.data
          ?.error ||
          "Failed to cancel invoice."
      );

    } finally {

      setCancelling(
        false
      );
    }
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

              FINANCE INVOICE

            </div>

            <h2>

              {
                row?.invoice_number ||
                "Invoice"
              }

            </h2>

            <p>

              Enterprise invoice management,
              payment tracking,
              PDF generation,
              email delivery,
              reconciliation,
              and audit visibility.

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
            ACTIONS
        ===================================== */}

        <div className="finance-toolbar">

          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={
              handleGeneratePdf
            }
            disabled={
              generating
            }
          >

            <Download size={16} />

            {generating
              ? "Generating..."
              : "Generate PDF"}

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

          <button
            type="button"
            className="finance-btn finance-btn-success"
            onClick={
              handleMarkPaid
            }
            disabled={
              markingPaid ||
              String(
                row?.status
              ).toLowerCase() ===
                "paid"
            }
          >

            <CheckCircle2
              size={16}
            />

            {markingPaid
              ? "Updating..."
              : "Mark Paid"}

          </button>

          <button
            type="button"
            className="finance-btn finance-btn-danger"
            onClick={
              handleCancelInvoice
            }
            disabled={
              cancelling ||
              String(
                row?.status
              ).toLowerCase() ===
                "cancelled"
            }
          >

            <AlertTriangle
              size={16}
            />

            {cancelling
              ? "Cancelling..."
              : "Cancel"}

          </button>

        </div>

        {/* =====================================
            LOADING
        ===================================== */}

        {loading ? (

          <div className="finance-loading-card">

            Loading invoice...

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

              <div className="finance-summary-card">

                <span>
                  Invoice Total
                </span>

                <h3>

                  {money(
                    financialSummary.total
                  )}

                </h3>

                <small>
                  Total invoice value
                </small>

              </div>

              <div className="finance-summary-card">

                <span>
                  Paid Amount
                </span>

                <h3>

                  {money(
                    financialSummary.paid
                  )}

                </h3>

                <small>
                  Posted payments
                </small>

              </div>

              <div className="finance-summary-card featured">

                <span>
                  Balance Due
                </span>

                <h3>

                  {money(
                    financialSummary.balance
                  )}

                </h3>

                <small>
                  Outstanding balance
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
                  Invoice lifecycle
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

                <div className="finance-card">

                  <div className="finance-card-header">

                    <h3>

                      <FileText
                        size={18}
                      />

                      Invoice Information

                    </h3>

                  </div>

                  <div className="finance-detail-list">

                    <DetailItem
                      label="Invoice #"
                      value={
                        row.invoice_number
                      }
                    />

                    <DetailItem
                      label="Payment #"
                      value={
                        row.payment_number
                      }
                    />

                    <DetailItem
                      label="Receipt #"
                      value={
                        row.receipt_number
                      }
                    />

                    <DetailItem
                      label="Invoice Type"
                      value={pretty(
                        row.invoice_type ||
                          row.category
                      )}
                    />

                    <DetailItem
                      label="Category"
                      value={categoryLabel(
                        row.category
                      )}
                    />

                    <DetailItem
                      label="Details"
                      value={
                        row.sub_category ||
                        row.description
                      }
                    />

                    <DetailItem
                      label="Created"
                      value={formatDate(
                        row.created_at
                      )}
                    />

                    <DetailItem
                      label="Invoice Date"
                      value={formatDate(
                        row.invoice_date
                      )}
                    />

                    <DetailItem
                      label="Due Date"
                      value={formatDate(
                        row.due_date
                      )}
                    />

                    <DetailItem
                      label="Paid Date"
                      value={formatDate(
                        row.paid_at
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
                        row.full_name ||
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
                          row.payment_source
                      )}
                    />

                    <DetailItem
                      label="Reference"
                      value={
                        row.reference_no
                      }
                    />

                    <DetailItem
                      label="Stripe Invoice"
                      value={
                        row.stripe_invoice_id
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
                    FINANCIALS
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

                    <div className="finance-financial-row">

                      <span>

                        Invoice Total

                      </span>

                      <strong>

                        {money(
                          row.total_amount
                        )}

                      </strong>

                    </div>

                    <div className="finance-financial-row">

                      <span>

                        Paid Amount

                      </span>

                      <strong>

                        {money(
                          row.paid_amount
                        )}

                      </strong>

                    </div>

                    <div className="finance-financial-row total">

                      <span>

                        Balance Due

                      </span>

                      <strong>

                        {money(
                          row.balance_due
                        )}

                      </strong>

                    </div>

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
                          type={
                            row.email_status ===
                            "sent"
                              ? "success"
                              : row.email_status ===
                                "failed"
                              ? "danger"
                              : "warning"
                          }
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
                      label="Error"
                      value={
                        row.email_error
                      }
                    />

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
                onClick={() => {

                  if (
                    row?.id
                  ) {

                    window.open(
                      `/api/invoices/${row.id}/pdf`,
                      "_blank"
                    );
                  }
                }}
              >

                <Receipt
                  size={16}
                />

                Open PDF

              </button>

            </div>

          </div>

        ) : null}

      </div>

    </div>
  );
}