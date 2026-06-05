// frontend/src/components/FinanceDashboard/pages/FinanceReceipts.jsx

import React, {
  useMemo,
  useState,
} from "react";

import FinanceTablePage from "../components/FinanceTablePage";

import FinanceBadge from "../../Shared/FinanceBadge";
import CoverageDisplay from "../../Shared/CoverageDisplay";

import FinanceReceiptDrawer from "../components/FinanceReceiptDrawer";

import {
  money,
  formatDate,
  pretty,
  categoryLabel,
  paymentSource,
} from "../../../utils/paymentFormatters";

import "../../../styles/shared-payment-components.css";

export default function FinanceReceipts() {

  const [
    selectedReceipt,
    setSelectedReceipt,
  ] = useState(null);

  const [
    drawerOpen,
    setDrawerOpen,
  ] = useState(false);

  /* =====================================================
     OPEN DRAWER
  ===================================================== */

  function openDrawer(row) {

    setSelectedReceipt(
      row
    );

    setDrawerOpen(true);
  }

  /* =====================================================
     CLOSE
  ===================================================== */

  function closeDrawer() {

    setDrawerOpen(false);

    setTimeout(() => {

      setSelectedReceipt(
        null
      );

    }, 250);
  }

  /* =====================================================
     ROW ACTIONS
  ===================================================== */

  const rowActions =
    useMemo(
      () => [

        {
          label:
            "Open Receipt",

          onClick: (
            row
          ) =>
            openDrawer(
              row
            ),
        },

        {
          label:
            "Receipt PDF",

          onClick: (
            row
          ) => {

            if (
              !row.id
            ) {
              return;
            }

           window.open(`/api/finance/receipts/${row.id}/pdf`, "_blank");
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
            "Resend Email",

          onClick:
            async (
              row
            ) => {

              try {

                if (
                  !row.payment_id
                ) {
                  return;
                }

               await fetch(
  `/api/finance/receipts/payment/${row.payment_id}/resend`,
                  {
                    method:
                      "POST",

                    credentials:
                      "include",
                  }
                );

                alert(
                  "Receipt email resent."
                );

              } catch (
                err
              ) {

                console.error(
                  err
                );

                alert(
                  "Failed to resend receipt email."
                );
              }
            },
        },

      ],
      []
    );

  return (
    <>

      <FinanceTablePage

        title="
Finance Receipts
        "

        subtitle="
Enterprise receipt management across membership dues, donations, pledges, school programs, trips, Stripe transactions, emailed receipts, reconciliation, and financial audit tracking.
        "
endpoint="/finance/receipts"

        defaultSortKey="
created_at
        "

        defaultSortDirection="
desc
        "

        searchPlaceholder="
Search receipt, payment, invoice, member, donor, coverage, Stripe payment, category, or receipt reference...
        "

        columns={[

          {
            key:
              "created_at",

            label:
              "Created",

            render:
              (
                v,
                r
              ) =>
                formatDate(
                  v ||
                    r.receipt_date
                ),
          },

          {
            key:
              "receipt_number",

            label:
              "Receipt #",
          },

          {
            key:
              "payment_number",

            label:
              "Payment #",

            render:
              (
                v
              ) =>
                v ||
                "--",
          },

          {
            key:
              "invoice_number",

            label:
              "Invoice #",

            render:
              (
                v
              ) =>
                v ||
                "--",
          },

          {
            key:
              "full_name_snapshot",

            label:
              "Member / Payer",

            render:
              (
                v
              ) =>
                v ||
                "Guest / Unknown",
          },

          {
            key:
              "member_no",

            label:
              "Member #",

            render:
              (
                v
              ) =>
                v ||
                "--",
          },

          {
            key:
              "category",

            label:
              "Category",

            render:
              (
                v,
                r
              ) => (

                <FinanceBadge
                  label={categoryLabel(
                    v ||
                      r.payment_category
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

            render:
              (
                v,
                r
              ) =>
                v ||
                r.description ||
                r.plan_name ||
                r.program_title ||
                r.donation_category ||
                "--",
          },

          {
            key:
              "coverage_period",

            label:
              "Coverage",

            render:
              (
                _v,
                r
              ) => (

                <CoverageDisplay
                  row={r}
                  showMonths
                />

              ),
          },

          {
            key:
              "amount",

            label:
              "Amount",

            render:
              (
                v
              ) =>
                money(v),
          },

          {
            key:
              "method",

            label:
              "Method",

            render:
              (
                v,
                r
              ) =>
                pretty(
                  v ||
                    r.payment_method
                ),
          },

          {
            key:
              "provider",

            label:
              "Source",

            render:
              (
                v,
                r
              ) =>
                paymentSource(
                  v ||
                    r.payment_provider ||
                    "stripe"
                ),
          },

          {
            key:
              "email_status",

            label:
              "Email Status",

            render:
              (
                v
              ) => (

                <FinanceBadge
                  label={pretty(
                    v ||
                      "pending"
                  )}
                  type={
                    v ===
                    "sent"
                      ? "success"
                      : v ===
                        "failed"
                      ? "danger"
                      : "warning"
                  }
                />

              ),
          },

          {
            key:
              "emailed_at",

            label:
              "Email Date",

            render:
              (
                v
              ) =>
                formatDate(v),
          },

          {
            key:
              "status",

            label:
              "Receipt Status",

            render:
              (
                v,
                _r,
                h
              ) => (

                <h.FinanceStatusBadge
                  status={
                    v ||
                    "issued"
                  }
                />

              ),
          },

        ]}

        rowActions={
          rowActions
        }

        actions={[

          {
            label:
              "Export Receipts",
          },

          {
            label:
              "Email Queue",
          },

        ]}

        summaryBuilder={(
          rows,
          meta,
          formatMoney
        ) => {

          const total =
            rows.reduce(
              (
                sum,
                row
              ) =>
                sum +
                Number(
                  row.amount ||
                    0
                ),
              0
            );

          const emailed =
            rows.filter(
              (
                r
              ) =>
                String(
                  r.email_status ||
                    ""
                ).toLowerCase() ===
                "sent"
            ).length;

          const pending =
            rows.filter(
              (
                r
              ) =>
                String(
                  r.email_status ||
                    ""
                ).toLowerCase() ===
                "pending"
            ).length;

          const failed =
            rows.filter(
              (
                r
              ) =>
                String(
                  r.email_status ||
                    ""
                ).toLowerCase() ===
                "failed"
            ).length;

          return [

            {
              label:
                "Receipts",

              value:
                meta.total,

              sub:
                "Visible receipt rows",
            },

            {
              label:
                "Receipt Total",

              value:
                formatMoney(
                  total
                ),

              sub:
                "Current page total",

              featured:
                true,
            },

            {
              label:
                "Emails Sent",

              value:
                emailed,

              sub:
                "Delivered receipts",
            },

            {
              label:
                "Pending",

              value:
                pending,

              sub:
                "Waiting delivery",
            },

            {
              label:
                "Failed",

              value:
                failed,

              sub:
                "Email delivery failures",
            },

          ];
        }}
      />

      {/* =====================================
          RECEIPT DRAWER
      ===================================== */}

      <FinanceReceiptDrawer
        open={
          drawerOpen
        }
        onClose={
          closeDrawer
        }
        receipt={
          selectedReceipt
        }
      />

    </>
  );
}