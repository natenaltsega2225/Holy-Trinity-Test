// frontend/src/components/FinanceDashboard/pages/FinanceInvoices.jsx

import React, {
  useMemo,
  useState,
} from "react";

import FinanceTablePage from "../components/FinanceTablePage";

import FinanceBadge from "../../Shared/FinanceBadge";
import CoverageDisplay from "../../Shared/CoverageDisplay";

import FinanceInvoiceDrawer from "../components/FinanceInvoiceDrawer";

import {
  money,
  formatDate,
  pretty,
  categoryLabel,
  paymentSource,
} from "../../../utils/paymentFormatters";

import "../../../styles/shared-payment-components.css";

export default function FinanceInvoices() {

  const [
    selectedInvoice,
    setSelectedInvoice,
  ] = useState(null);

  const [
    drawerOpen,
    setDrawerOpen,
  ] = useState(false);

  /* =====================================================
     OPEN DRAWER
  ===================================================== */

  function openDrawer(row) {

    setSelectedInvoice(
      row
    );

    setDrawerOpen(true);
  }

  /* =====================================================
     CLOSE DRAWER
  ===================================================== */

  function closeDrawer() {

    setDrawerOpen(false);

    setTimeout(() => {

      setSelectedInvoice(
        null
      );

    }, 250);
  }

  /* =====================================================
     ACTIONS
  ===================================================== */

  const rowActions =
    useMemo(
      () => [

        {
          label:
            "Open Invoice",

          onClick: (
            row
          ) =>
            openDrawer(
              row
            ),
        },

        {
          label:
            "Invoice PDF",

          onClick: (
            row
          ) => {

            if (
              !row.id
            ) {
              return;
            }

            window.open(
              `/api/invoices/${row.id}/pdf`,
              "_blank"
            );
          },
        },

        {
          label:
            "Generate PDF",

          onClick:
            async (
              row
            ) => {

              if (
                !row.id
              ) {
                return;
              }

              try {

                await fetch(
                  `/api/invoices/${row.id}/generate-pdf`,
                  {
                    method:
                      "POST",

                    credentials:
                      "include",
                  }
                );

                window.open(
                  `/api/invoices/${row.id}/pdf`,
                  "_blank"
                );

              } catch (
                err
              ) {

                console.error(
                  err
                );
              }
            },
        },

        {
          label:
            "Send Invoice Email",

          onClick:
            async (
              row
            ) => {

              if (
                !row.id
              ) {
                return;
              }

              try {

                await fetch(
                  `/api/invoices/${row.id}/send-email`,
                  {
                    method:
                      "POST",

                    credentials:
                      "include",

                    headers:
                      {
                        "Content-Type":
                          "application/json",
                      },

                    body: JSON.stringify(
                      {}
                    ),
                  }
                );

                alert(
                  "Invoice email sent."
                );

              } catch (
                err
              ) {

                console.error(
                  err
                );
              }
            },
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
              !row.receipt_number
            ) {
              return;
            }

            window.open(
              `/api/receipts/number/${row.receipt_number}/pdf`,
              "_blank"
            );
          },
        },

        {
          label:
            "Mark Paid",

          onClick:
            async (
              row
            ) => {

              if (
                !row.id
              ) {
                return;
              }

              try {

                await fetch(
                  `/api/invoices/${row.id}/mark-paid`,
                  {
                    method:
                      "POST",

                    credentials:
                      "include",

                    headers:
                      {
                        "Content-Type":
                          "application/json",
                      },

                    body: JSON.stringify(
                      {
                        amount:
                          row.balance_due ||
                          row.total_amount ||
                          row.amount,
                      }
                    ),
                  }
                );

                window.location.reload();

              } catch (
                err
              ) {

                console.error(
                  err
                );
              }
            },
        },

        {
          label:
            "Cancel Invoice",

          danger:
            true,

          onClick:
            async (
              row
            ) => {

              if (
                !row.id
              ) {
                return;
              }

              const ok =
                window.confirm(
                  "Cancel this invoice?"
                );

              if (
                !ok
              ) {
                return;
              }

              try {

                await fetch(
                  `/api/invoices/${row.id}/cancel`,
                  {
                    method:
                      "POST",

                    credentials:
                      "include",
                  }
                );

                window.location.reload();

              } catch (
                err
              ) {

                console.error(
                  err
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
Finance Invoices
        "

        subtitle="
Enterprise invoice management across membership dues, donations, pledges, school programs, trips, Stripe billing, manual invoices, reconciliation, and audit tracking.
        "

        endpoint="
/finance/invoices
        "

        defaultSortKey="
created_at
        "

        defaultSortDirection="
desc
        "

        searchPlaceholder="
Search invoice, payment, receipt, member, donor, coverage, pledge, category, Stripe invoice, or billing reference...
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
                    r.invoice_date
                ),
          },

          {
            key:
              "invoice_number",

            label:
              "Invoice #",
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
              "receipt_number",

            label:
              "Receipt #",

            render:
              (
                v
              ) =>
                v ||
                "--",
          },

          {
            key:
              "full_name",

            label:
              "Member / Payer",

            render:
              (
                v,
                r
              ) =>
                v ||
                r.full_name_snapshot ||
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

            render:
              (
                v,
                r
              ) =>
                v ||
                r.plan_name ||
                r.description ||
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
              "total_amount",

            label:
              "Amount",

            render:
              (
                v,
                r
              ) =>
                money(
                  v ||
                    r.amount
                ),
          },

          {
            key:
              "paid_amount",

            label:
              "Paid",

            render:
              (
                v
              ) =>
                money(v),
          },

          {
            key:
              "balance_due",

            label:
              "Balance",

            render:
              (
                v
              ) =>
                money(v),
          },

          {
            key:
              "status",

            label:
              "Status",

            render:
              (
                v,
                _r,
                h
              ) => (

                <h.FinanceStatusBadge
                  status={
                    v ||
                    "paid"
                  }
                />

              ),
          },

          {
            key:
              "payment_method",

            label:
              "Method",

            render:
              (
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
              "payment_source",

            label:
              "Source",

            render:
              (
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
              "due_date",

            label:
              "Due Date",

            render:
              (
                v
              ) =>
                formatDate(v),
          },

        ]}

        rowActions={
          rowActions
        }

        actions={[

          {
            label:
              "Generate Batch",
          },

          {
            label:
              "Create Invoice",
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
                  row.total_amount ||
                    row.amount ||
                    0
                ),
              0
            );

          const paid =
            rows.filter(
              (
                r
              ) =>
                String(
                  r.status ||
                    ""
                ).toLowerCase() ===
                "paid"
            ).length;

          const pending =
            rows.filter(
              (
                r
              ) =>
                String(
                  r.status ||
                    ""
                ).toLowerCase() ===
                "pending"
            ).length;

          const overdue =
            rows.filter(
              (
                r
              ) =>
                String(
                  r.status ||
                    ""
                ).toLowerCase() ===
                "overdue"
            ).length;

          const partial =
            rows.filter(
              (
                r
              ) =>
                String(
                  r.status ||
                    ""
                ).toLowerCase() ===
                "partial"
            ).length;

          return [

            {
              label:
                "Invoices",

              value:
                meta.total,

              sub:
                "Visible invoice rows",
            },

            {
              label:
                "Visible Amount",

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
                "Paid",

              value:
                paid,

              sub:
                "Completed invoices",
            },

            {
              label:
                "Pending",

              value:
                pending,

              sub:
                "Awaiting payment",
            },

            {
              label:
                "Partial",

              value:
                partial,

              sub:
                "Partially paid",
            },

            {
              label:
                "Overdue",

              value:
                overdue,

              sub:
                "Past due invoices",
            },

          ];
        }}
      />

      {/* =====================================
          DRAWER
      ===================================== */}

      <FinanceInvoiceDrawer
        open={
          drawerOpen
        }
        onClose={
          closeDrawer
        }
        invoice={
          selectedInvoice
        }
      />

    </>
  );
}