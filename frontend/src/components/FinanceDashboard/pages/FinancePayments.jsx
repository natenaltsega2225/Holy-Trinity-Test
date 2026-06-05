// frontend/src/components/FinanceDashboard/pages/FinancePayments.jsx
// frontend/src/components/FinanceDashboard/pages/FinancePayments.jsx

import React, {
  useMemo,
  useState,
} from "react";

import FinanceTablePage
from "../components/FinanceTablePage";

import FinanceBadge
from "../../Shared/FinanceBadge";

import CoverageDisplay
from "../../Shared/CoverageDisplay";

import FinancePaymentKPIs
from "../components/FinancePaymentKPIs";

import FinancePaymentFilters
from "../components/FinancePaymentFilters";

import FinancePaymentModal
from "../components/FinancePaymentModal";

import FinancePaymentDrawer
from "../components/FinancePaymentDrawer";

import {
  money,
  formatDate,
  pretty,
  paymentSource,
  cardDisplay,
  categoryLabel,
} from "../../../utils/paymentFormatters";

import api from "../../api";

import "../../../styles/shared-payment-components.css";

/* =========================================================
   EMAIL STATUS BADGE
========================================================= */

function EmailStatusBadge({
  value,
}) {
  const status = String(
    value || "pending"
  ).toLowerCase();

  if (status === "sent") {
    return (
      <FinanceBadge
        label="Sent"
        type="success"
      />
    );
  }

  if (status === "failed") {
    return (
      <FinanceBadge
        label="Failed"
        type="danger"
      />
    );
  }

  return (
    <FinanceBadge
      label={pretty(status)}
      type="warning"
    />
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinancePayments() {
  const [
    showPaymentModal,
    setShowPaymentModal,
  ] = useState(false);

  const [
    selectedPayment,
    setSelectedPayment,
  ] = useState(null);

  const [
    drawerOpen,
    setDrawerOpen,
  ] = useState(false);

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);

  const [
    filters,
    setFilters,
  ] = useState({
    payment_type: "",
    method: "",
    status: "",
    source: "",
    donation_category: "",
    coverage_year: "",
    search: "",
    date_from: "",
    date_to: "",
  });

  /* =====================================================
     DRAWER
  ===================================================== */

  function openDrawer(row) {
    setSelectedPayment(row);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);

    setTimeout(() => {
      setSelectedPayment(null);
    }, 200);
  }

  /* =====================================================
     RESEND RECEIPT
  ===================================================== */

  async function resendReceipt(
    row
  ) {
    try {
      const paymentId =
        row.payment_id ||
        row.id;

      if (!paymentId) {
        alert(
          "Payment not found."
        );
        return;
      }

      await api.post(
        `/receipts/payment/${paymentId}/resend`
      );

      alert(
        "Receipt email sent successfully."
      );
    } catch (err) {
      console.error(err);

      alert(
        err?.response?.data?.error ||
          "Failed to resend receipt."
      );
    }
  }

  /* =====================================================
     ROW ACTIONS
  ===================================================== */

  const rowActions =
    useMemo(
      () => [
        {
          label:
            "Open Payment",

          onClick: (
            row
          ) =>
            openDrawer(
              row
            ),
        },

        {
          label:
            "View Receipt",

          onClick: (
            row
          ) => {
            if (
              !row.receipt_number
            ) {
              return;
            }

            window.open(
              `/dash/finance/receipts/${row.receipt_number}`,
              "_blank"
            );
          },
        },

        {
          label:
            "Receipt PDF",

          onClick: (
            row
          ) => {
            if (
              !row.receipt_id
            ) {
              return;
            }

            window.open(
              `/api/receipts/${row.receipt_id}/pdf`,
              "_blank"
            );
          },
        },

        {
          label:
            "View Invoice",

          onClick: (
            row
          ) => {
            if (
              !row.invoice_number
            ) {
              return;
            }

            window.open(
              `/dash/finance/invoices/${row.invoice_number}`,
              "_blank"
            );
          },
        },

        {
          label:
            "Invoice PDF",

          onClick: (
            row
          ) => {
            if (
              !row.invoice_id
            ) {
              return;
            }

            window.open(
              `/api/invoices/${row.invoice_id}/pdf`,
              "_blank"
            );
          },
        },

        {
          label:
            "Resend Receipt",

          onClick: (
            row
          ) =>
            resendReceipt(
              row
            ),
        },
      ],
      []
    );

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div className="finance-enterprise-page">

      {/* =====================================
          KPI
      ===================================== */}

      <FinancePaymentKPIs />

      {/* =====================================
          FILTERS
      ===================================== */}

      <FinancePaymentFilters
        filters={filters}
        onChange={setFilters}
        onReset={() =>
          setFilters({
            payment_type: "",
            method: "",
            status: "",
            source: "",
            donation_category: "",
            coverage_year: "",
            search: "",
            date_from: "",
            date_to: "",
          })
        }
      />

      {/* =====================================
          TABLE
      ===================================== */}

      <FinanceTablePage
        key={refreshKey}

        title="Finance Payments"

        subtitle="
Enterprise unified finance management for Stripe card, ACH, membership dues, donations, programs, pledges, invoices, receipts, reconciliation, and ledger tracking.
        "

        endpoint="/finance/payments"

        filters={filters}

        defaultSortKey="created_at"

        defaultSortDirection="desc"

        searchPlaceholder="
Search payment number, invoice, receipt, member ID, payer, email, donation, card, Stripe reference, ACH, program, or ledger...
        "

        actions={[
          {
            label:
              "Create Payment",

            variant:
              "primary",

            onClick:
              () =>
                setShowPaymentModal(
                  true
                ),
          },

          {
            label:
              "Refresh",

            onClick:
              () =>
                setRefreshKey(
                  (v) => v + 1
                ),
          },

          {
            label:
              "Export",
          },
        ]}

        columns={[
          {
            key:
              "payment_date",

            label:
              "Date",

            render: (
              v,
              r
            ) =>
              formatDate(
                v ||
                  r.paid_at ||
                  r.created_at
              ),
          },

          {
            key:
              "payment_number",

            label:
              "Payment #",
          },

          {
            key:
              "member_no",

            label:
              "Member #",

            render: (v) =>
              v || "--",
          },

          {
            key:
              "full_name_snapshot",

            label:
              "Member / Payer",

            render: (
              v,
              r
            ) =>
              v ||
              r.full_name ||
              "Guest",
          },

          {
            key:
              "category",

            label:
              "Category",

            render: (
              v,
              r
            ) => (
              <FinanceBadge
                label={categoryLabel(
                  v ||
                    r.payment_type
                )}
                type="primary"
              />
            ),
          },

          {
            key:
              "sub_category",

            label:
              "Details",

            render: (
              v,
              r
            ) =>
              v ||
              r.plan_name ||
              r.program_name ||
              r.description ||
              "--",
          },

         {
  key: "coverage",
  label: "Coverage",
  render: (_v, r) => (
    <CoverageDisplay
      row={r}
      showMonths={false}
    />
  ),
},

          {
            key:
              "amount",

            label:
              "Amount",

            render: (v) =>
              money(v),
          },

          {
            key:
              "payment_method",

            label:
              "Method",

            render: (
              v,
              r
            ) =>
              pretty(
                v ||
                  r.method ||
                  "card"
              ),
          },

          {
            key:
              "provider",

            label:
              "Provider",

            render: (
              v,
              r
            ) =>
              paymentSource(
                v ||
                  r.provider ||
                  "stripe"
              ),
          },

          {
            key:
              "card",

            label:
              "Card",

            render: (
              _v,
              r
            ) =>
              cardDisplay(r),
          },

          {
            key:
              "status",

            label:
              "Status",

            render: (
              v,
              _r,
              h
            ) => (
              <h.FinanceStatusBadge
                status={
                  v || "paid"
                }
              />
            ),
          },

          {
            key:
              "receipt_number",

            label:
              "Receipt #",

            render: (v) =>
              v || "--",
          },

          {
            key:
              "invoice_number",

            label:
              "Invoice #",

            render: (v) =>
              v || "--",
          },

          {
            key:
              "email_status",

            label:
              "Receipt Email",

            render: (v) => (
              <EmailStatusBadge
                value={v}
              />
            ),
          },

          {
            key:
              "reference_no",

            label:
              "Reference",

            render: (v) =>
              v || "--",
          },
        ]}

        rowActions={
          rowActions
        }
      />

      {/* =====================================
          CREATE PAYMENT MODAL
      ===================================== */}

      <FinancePaymentModal
        open={
          showPaymentModal
        }
        onClose={() =>
          setShowPaymentModal(
            false
          )
        }
        onSaved={() => {
          setShowPaymentModal(
            false
          );

          setRefreshKey(
            (v) => v + 1
          );
        }}
      />

      {/* =====================================
          PAYMENT DRAWER
      ===================================== */}

      <FinancePaymentDrawer
        open={drawerOpen}
        payment={
          selectedPayment
        }
        onClose={closeDrawer}
      />

    </div>
  );
}