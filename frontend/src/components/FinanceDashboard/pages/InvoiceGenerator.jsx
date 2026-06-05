// frontend/src/components/FinanceDashboard/pages/InvoiceGenerator.jsx

import React from "react";

import FinanceTablePage from "../components/FinanceTablePage";

import FinanceBadge from "../../Shared/FinanceBadge";
import CoverageDisplay from "../../Shared/CoverageDisplay";

import {
  money,
  formatDate,
  pretty,
  categoryLabel,
} from "../../../utils/paymentFormatters";

import "../../../styles/shared-payment-components.css";

export default function InvoiceGenerator() {
  return (
    <FinanceTablePage
      title="Invoice Generator"

      subtitle="
Enterprise invoice generation and billing management for membership dues, donations, school programs, trips, manual invoices, and Stripe billing.
      "

      endpoint="/finance/invoices"

      defaultSortKey="created_at"

      defaultSortDirection="desc"

      searchPlaceholder="
Search invoice, payment, receipt, member, donor, coverage, category, or billing reference...
      "

      columns={[
        {
          key: "created_at",

          label: "Created",

          render: (
            v,
            r
          ) =>
            formatDate(
              v ||
                r.invoice_date
            ),
        },

        {
          key: "invoice_number",

          label: "Invoice #",
        },

        {
          key: "payment_number",

          label: "Payment #",

          render: (v) =>
            v || "--",
        },

        {
          key: "receipt_number",

          label: "Receipt #",

          render: (v) =>
            v || "--",
        },

        {
          key: "full_name",

          label:
            "Member / Payer",

          render: (
            v,
            r
          ) =>
            v ||
            r.full_name_snapshot ||
            "Guest / Unknown",
        },

        {
          key: "member_no",

          label: "Member #",

          render: (v) =>
            v || "--",
        },

        {
          key: "category",

          label: "Category",

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
          key: "sub_category",

          label: "Details",

          render: (
            v,
            r
          ) =>
            v ||
            r.plan_name ||
            r.description ||
            "--",
        },

        {
          key: "coverage_period",

          label: "Coverage",

          render: (
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
          key: "total_amount",

          label: "Amount",

          render: (
            v,
            r
          ) =>
            money(
              v ||
                r.amount
            ),
        },

        {
          key: "balance_due",

          label: "Balance",

          render: (
            v
          ) =>
            money(v),
        },

        {
          key: "status",

          label: "Status",

          render: (
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
          key: "due_date",

          label: "Due Date",

          render: (v) =>
            formatDate(v),
        },
      ]}

      rowActions={[
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
              `/api/finance/invoices/${row.id}/pdf`,
              "_blank"
            );
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
              `/api/finance/receipts/${row.receipt_number}/pdf`,
              "_blank"
            );
          },
        },
      ]}

      actions={[
        {
          label:
            "Generate Batch",
        },

        {
          label:
            "Create Manual Invoice",
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
            (r) =>
              String(
                r.status ||
                  ""
              ).toLowerCase() ===
              "paid"
          ).length;

        const pending =
          rows.filter(
            (r) =>
              String(
                r.status ||
                  ""
              ).toLowerCase() ===
              "pending"
          ).length;

        const overdue =
          rows.filter(
            (r) =>
              String(
                r.status ||
                  ""
              ).toLowerCase() ===
              "overdue"
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
              "Overdue",

            value:
              overdue,

            sub:
              "Past due invoices",
          },
        ];
      }}
    />
  );
}