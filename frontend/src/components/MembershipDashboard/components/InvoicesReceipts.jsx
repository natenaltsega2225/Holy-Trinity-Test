// frontend/src/components/MembershipDashboard/components/InvoicesReceipts.jsx

import React, {
  useMemo,
  useState,
} from "react";

import MemberTablePage from "./MemberTablePage";

// import "../membership-dashboard.css";

/* =========================================================
   HELPERS
========================================================= */

function pretty(value) {
  if (!value) return "--";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) =>
      c.toUpperCase()
    );
}

function formatDate(value) {
  if (!value) return "--";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "--";
  }

  return d.toLocaleDateString("en-US");
}

/* =========================================================
   INVOICE COLUMNS
========================================================= */

const invoiceColumns = [
  {
    key: "invoice_number",
    label: "Invoice #",
    sortable: true,
  },

  {
    key: "category",
    label: "Type",
    sortable: true,

    render: (value, row) =>
      pretty(
        value ||
          row.invoice_type
      ),
  },

  {
    key: "sub_category",
    label: "Details",

    render: (value, row) =>
      value ||
      row.description ||
      "--",
  },

  {
    key: "total_amount",
    label: "Amount",
    money: true,
    sortable: true,
  },

  {
    key: "paid_amount",
    label: "Paid",
    money: true,
  },

  {
    key: "balance_due",
    label: "Balance",
    money: true,
  },

  {
    key: "status",
    label: "Status",
    status: true,
    sortable: true,
  },

  {
    key: "invoice_date",
    label: "Invoice Date",
    sortable: true,

    render: (value, row) =>
      formatDate(
        value ||
          row.issue_date ||
          row.created_at
      ),
  },

  {
    key: "__actions",
    label: "Actions",

    render: (_value, row) => (
      <div className="member-inline-actions">

        {row.invoice_pdf_url ? (

          <button
            type="button"
            className="member-link-btn"
            onClick={() =>
              window.open(
                row.invoice_pdf_url,
                "_blank"
              )
            }
          >
            PDF
          </button>

        ) : null}

        {row.invoice_number ? (

          <button
            type="button"
            className="member-link-btn"
            onClick={() =>
              window.open(
                `/dash/membership/invoices/${encodeURIComponent(
                  row.invoice_number
                )}`,
                "_blank"
              )
            }
          >
            View
          </button>

        ) : null}

      </div>
    ),
  },
];

/* =========================================================
   RECEIPT COLUMNS
========================================================= */

const receiptColumns = [
  {
    key: "receipt_number",
    label: "Receipt #",
    sortable: true,
  },

  {
    key: "category",
    label: "Type",
    sortable: true,

    render: (value, row) =>
      pretty(
        value ||
          row.payment_type
      ),
  },

  {
    key: "sub_category",
    label: "Details",

    render: (value, row) =>
      value ||
      row.description ||
      row.donation_category ||
      row.program_title ||
      "--",
  },

  {
    key: "amount",
    label: "Amount",
    money: true,
    sortable: true,
  },

  {
    key: "method",
    label: "Method",

    render: (value) =>
      pretty(value),
  },

  {
    key: "provider",
    label: "Source",

    render: (value) =>
      pretty(value),
  },

  {
    key: "email_status",
    label: "Email",
    status: true,
  },

  {
    key: "receipt_date",
    label: "Date",
    sortable: true,

    render: (value, row) =>
      formatDate(
        value ||
          row.created_at
      ),
  },

  {
    key: "__actions",
    label: "Actions",

    render: (_value, row) => (
      <div className="member-inline-actions">

        <button
          type="button"
          className="member-link-btn"
          onClick={() =>
            window.open(
              `/api/receipts/${row.id}/pdf`,
              "_blank"
            )
          }
        >
          PDF
        </button>

        <button
          type="button"
          className="member-link-btn"
          onClick={() =>
            window.open(
              `/dash/membership/receipts/${encodeURIComponent(
                row.receipt_number
              )}`,
              "_blank"
            )
          }
        >
          View
        </button>

      </div>
    ),
  },
];

/* =========================================================
   COMPONENT
========================================================= */

export default function InvoicesReceipts() {

  const [tab, setTab] =
    useState("invoices");

  const tabs = useMemo(
    () => [
      {
        key: "invoices",
        label: "Invoices",
      },

      {
        key: "receipts",
        label: "Receipts",
      },
    ],
    []
  );

  return (

    <section className="payx-history">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="payx-section-head">

        <div>

          <h3 className="payx-section-title">

            Invoices & Receipts

          </h3>

          <p className="payx-section-subtitle">

            Access invoices,
            receipts,
            downloadable PDFs,
            payment records,
            Stripe transactions,
            membership dues,
            donations,
            school/trip payments,
            and pledge payments.

          </p>

        </div>

      </div>

      {/* =====================================
          TABS
      ===================================== */}

      <div className="member-tabs">

        {tabs.map((t) => (

          <button
            key={t.key}
            className={
              tab === t.key
                ? "active"
                : ""
            }
            onClick={() =>
              setTab(t.key)
            }
          >

            {t.label}

          </button>

        ))}

      </div>

      {/* =====================================
          INVOICES
      ===================================== */}

      {tab === "invoices" ? (

        <MemberTablePage

          title="Invoice History"

          subtitle="Membership invoices, donations, school/trip billing, and pledge invoices."

          endpoint="/member/invoices"

          columns={invoiceColumns}

          pageSize={10}

          defaultSortKey="invoice_date"

          defaultSortDirection="desc"

          showSummary

          showFilters

          showExport

          searchPlaceholder="
Search invoice number, type, coverage, description...
          "

          emptyTitle="
No invoices found
          "

          emptyMessage="
Invoices generated from payments and billing activity will appear here.
          "
        />

      ) : null}

      {/* =====================================
          RECEIPTS
      ===================================== */}

      {tab === "receipts" ? (

        <MemberTablePage

          title="Receipt History"

          subtitle="Payment receipts, Stripe confirmations, downloadable PDFs, and emailed receipts."

          endpoint="/member/receipts"

          columns={receiptColumns}

          pageSize={10}

          defaultSortKey="receipt_date"

          defaultSortDirection="desc"

          showSummary

          showFilters

          showExport

          searchPlaceholder="
Search receipt number, donation, program, payment source...
          "

          emptyTitle="
No receipts found
          "

          emptyMessage="
Receipts generated from completed payments will appear here.
          "
        />

      ) : null}

    </section>
  );
}