
// // frontend/src/components/FinanceDashboard/pages/MemberLedger.jsx
// import React, { useMemo, useState } from "react";
// import FinanceTablePage from "../components/FinanceTablePage";

// function formatDateUS(value) {
//   if (!value) return "--";
//   const d = new Date(value);
//   if (Number.isNaN(d.getTime())) return value;
//   return d.toLocaleDateString("en-US", {
//     month: "2-digit",
//     day: "2-digit",
//     year: "numeric",
//   });
// }

// export default function MemberLedger() {
//   const [entryType, setEntryType] = useState("");
//   const [paymentStatus, setPaymentStatus] = useState("");
//   const [ledgerStatus, setLedgerStatus] = useState("");
//   const [memberStatus, setMemberStatus] = useState("");
//   const [startDate, setStartDate] = useState("");
//   const [endDate, setEndDate] = useState("");

//   const extraFilters = useMemo(
//     () => [
//       {
//         key: "entryType",
//         value: entryType,
//         onChange: setEntryType,
//         options: [
//           { value: "", label: "All entry types" },
//           { value: "invoice", label: "Invoice" },
//           { value: "payment", label: "Payment" },
//           { value: "manual_entry", label: "Manual Entry" },
//           { value: "adjustment", label: "Adjustment" },
//           { value: "credit", label: "Credit" },
//           { value: "debit", label: "Debit" },
//           { value: "refund", label: "Refund" },
//           { value: "plan_change", label: "Plan Change" },
//           { value: "renewal", label: "Renewal" },
//         ],
//       },
//       {
//         key: "paymentStatus",
//         value: paymentStatus,
//         onChange: setPaymentStatus,
//         options: [
//           { value: "", label: "All payment statuses" },
//           { value: "successful", label: "Successful" },
//           { value: "open", label: "Open / Overdue" },
//           { value: "pending", label: "Pending" },
//           { value: "approved", label: "Approved" },
//           { value: "paid", label: "Paid" },
//           { value: "completed", label: "Completed" },
//           { value: "failed", label: "Failed" },
//           { value: "voided", label: "Voided" },
//           { value: "refunded", label: "Refunded" },
//         ],
//       },
//       {
//         key: "ledgerStatus",
//         value: ledgerStatus,
//         onChange: setLedgerStatus,
//         options: [
//           { value: "", label: "All ledger statuses" },
//           { value: "successful", label: "Successful" },
//           { value: "posted", label: "Posted" },
//           { value: "pending", label: "Pending" },
//           { value: "reversed", label: "Reversed" },
//           { value: "voided", label: "Voided" },
//           { value: "active", label: "Active" },
//         ],
//       },
//       {
//         key: "memberStatus",
//         value: memberStatus,
//         onChange: setMemberStatus,
//         options: [
//           { value: "", label: "All member statuses" },
//           { value: "active", label: "Active" },
//           { value: "pending", label: "Pending" },
//           { value: "inactive", label: "Inactive" },
//           { value: "suspended", label: "Suspended" },
//           { value: "cancelled", label: "Cancelled" },
//           { value: "expired", label: "Expired" },
//         ],
//       },
//       {
//         key: "startDate",
//         value: startDate,
//         onChange: setStartDate,
//         type: "date",
//         label: "From Date",
//       },
//       {
//         key: "endDate",
//         value: endDate,
//         onChange: setEndDate,
//         type: "date",
//         label: "To Date",
//       },
//     ],
//     [entryType, paymentStatus, ledgerStatus, memberStatus, startDate, endDate]
//   );

//   const columns = [
//     { key: "created_at", label: "Date" },
//     { key: "member_no", label: "Member No" },
//     { key: "member_name", label: "Member" },
//     {
//       key: "member_status",
//       label: "Member Status",
//       render: (value, row, helpers) =>
//         value ? (
//           <helpers.FinanceStatusBadge status={String(value)} />
//         ) : (
//           "--"
//         ),
//     },
//     { key: "entry_type", label: "Entry Type" },
//     { key: "source_type", label: "Source" },
//     { key: "plan_type", label: "Plan Type" },
//     { key: "months_paid", label: "Months Paid" },
//     { key: "renewal_status", label: "Renewal Status" },
//     { key: "reference_no", label: "Reference" },
//     { key: "invoice_number", label: "Invoice" },
//     { key: "payment_number", label: "Payment #" },
//     {
//       key: "debit",
//       label: "Debit",
//       render: (value, row, helpers) => helpers.formatMoney(value),
//     },
//     {
//       key: "credit",
//       label: "Credit",
//       render: (value, row, helpers) => helpers.formatMoney(value),
//     },
//     {
//       key: "balance",
//       label: "Balance",
//       render: (value, row, helpers) => helpers.formatMoney(value),
//     },
//     {
//       key: "payment_status",
//       label: "Payment Status",
//       render: (value, row, helpers) =>
//         value ? (
//           <helpers.FinanceStatusBadge status={String(value)} />
//         ) : (
//           "--"
//         ),
//     },
//     {
//       key: "ledger_status",
//       label: "Ledger Status",
//       render: (value, row, helpers) => (
//         <helpers.FinanceStatusBadge status={String(value ?? "--")} />
//       ),
//     },
//   ];

//   return (
//     <FinanceTablePage
//       title="Member Ledger"
//       subtitle="View fully traceable member account history including payments, refunds, adjustments, plan changes, renewal status, member status, months paid, payment status, ledger status, and running balances."
//       endpoint="/finance/member-ledger"
//       columns={columns.map((column) => ({
//         ...column,
//         render:
//           column.render ||
//           ((value) => {
//             if (column.key === "created_at") {
//               return formatDateUS(value);
//             }

//             if (
//               column.key === "entry_type" ||
//               column.key === "source_type" ||
//               column.key === "plan_type" ||
//               column.key === "renewal_status"
//             ) {
//               return value ? String(value).replaceAll("_", " ") : "--";
//             }

//             if (column.key === "months_paid") {
//               return Number(value || 0);
//             }

//             return value ?? "--";
//           }),
//       }))}
//       extraFilters={extraFilters}
//       pageSize={10}
//       defaultPeriod="monthly"
//       emptyTitle="No ledger records found"
//       emptyMessage="Ledger records appear here after invoices, payments, donations, refunds, plan changes, and manual entries are posted."
//       searchPlaceholder="Search by member, invoice, payment, ledger reference, source, plan, or member status..."
//       summaryBuilder={(rows, meta, formatMoney) => {
//         const debits = rows.reduce(
//           (sum, row) => sum + Number(row.debit || 0),
//           0
//         );
//         const credits = rows.reduce(
//           (sum, row) => sum + Number(row.credit || 0),
//           0
//         );
//         const successful = rows.filter((row) =>
//           ["posted", "approved", "paid", "completed", "active"].includes(
//             String(row.payment_status || row.ledger_status || "").toLowerCase()
//           )
//         ).length;
//         const payments = rows.filter(
//           (row) => String(row.entry_type || "").toLowerCase() === "payment"
//         ).length;
//         const monthsPaidTotal = rows.reduce(
//           (sum, row) => sum + Number(row.months_paid || 0),
//           0
//         );

//         return [
//           {
//             label: "Records",
//             value: meta.total,
//             sub: "Returned from current query",
//           },
//           {
//             label: "Debits / Credits",
//             value: `${formatMoney(debits)} / ${formatMoney(credits)}`,
//             sub: "Current page totals",
//           },
//           {
//             label: "Successful / Payments",
//             value: `${successful} / ${payments}`,
//             sub: "Successful rows / payment rows",
//           },
//           {
//             label: "Months Paid",
//             value: monthsPaidTotal,
//             sub: "Current page total months",
//           },
//         ];
//       }}
//     />
//   );
// }

// frontend/src/components/FinanceDashboard/pages/FinanceLedger.jsx

import React, { useMemo, useState } from "react";

import FinanceTablePage from "../components/FinanceTablePage";
import FinanceBadge from "../../Shared/FinanceBadge";

import {
  money,
  formatDate,
  pretty,
} from "../../../utils/paymentFormatters";

import "../../../styles/shared-payment-components.css";
import "../../../styles/finance-dashboard.css";

function badgeType(status) {
  const s = String(status || "").toLowerCase();

  if (["posted", "matched", "paid"].includes(s)) return "success";
  if (["pending", "draft"].includes(s)) return "warning";
  if (["reversed", "void", "failed"].includes(s)) return "danger";

  return "primary";
}

function EntryTypeBadge({ value }) {
  return (
    <FinanceBadge
      label={pretty(value || "entry")}
      type="primary"
    />
  );
}

function ReconcileBadge({ value }) {
  const status = value || "pending";

  return (
    <FinanceBadge
      label={pretty(status)}
      type={String(status).toLowerCase() === "matched" ? "success" : "warning"}
    />
  );
}

export default function FinanceLedger() {
  const [filters, setFilters] = useState({
    entry_type: "",
    status: "",
    reconciliation_status: "",
    member_id: "",
    date_from: "",
    date_to: "",
    search: "",
  });

  const rowActions = useMemo(
    () => [
      {
        label: "Reconcile",
        onClick: async (row) => {
          if (!row.id) return;

          const batch = window.prompt("Reconciliation batch/reference:");
          if (batch === null) return;

          await fetch(`/api/finance/ledger/${row.id}/reconcile`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reconciliation_batch: batch }),
          });

          window.location.reload();
        },
      },
      {
        label: "Unreconcile",
        onClick: async (row) => {
          if (!row.id) return;

          await fetch(`/api/finance/ledger/${row.id}/unreconcile`, {
            method: "POST",
            credentials: "include",
          });

          window.location.reload();
        },
      },
      {
        label: "Reverse Entry",
        danger: true,
        onClick: async (row) => {
          if (!row.id) return;

          const reason = window.prompt("Reason for reversal:");
          if (reason === null) return;

          await fetch(`/api/finance/ledger/${row.id}/reverse`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          });

          window.location.reload();
        },
      },
    ],
    []
  );

  return (
    <div className="finance-enterprise-page">
      <FinanceTablePage
        title="Finance Ledger"
        subtitle="Enterprise accounting ledger with debit, credit, running balance, payment linkage, invoice linkage, receipts, reconciliation, reversals, and audit visibility."
        endpoint="/finance/ledger"
        filters={filters}
        defaultSortKey="record_date"
        defaultSortDirection="desc"
        searchPlaceholder="Search ledger, member, payment, invoice, receipt, description, reference..."
        actions={[
          {
            label: "Manual Adjustment",
            variant: "primary",
            onClick: () => {
              window.alert("Use /api/finance/ledger/adjustment or connect this action to your adjustment modal.");
            },
          },
          {
            label: "Export Ledger",
            onClick: () => {
              window.open("/api/finance/ledger/export", "_blank");
            },
          },
        ]}
        columns={[
          {
            key: "record_date",
            label: "Date",
            render: (v, r) => formatDate(v || r.posted_at || r.created_at),
          },
          {
            key: "ledger_uuid",
            label: "Ledger #",
            render: (v, r) => v || r.ledger_number || "--",
          },
          {
            key: "record_type",
            label: "Type",
            render: (v, r) => <EntryTypeBadge value={v || r.entry_type} />,
          },
          {
            key: "full_name_snapshot",
            label: "Member / Payer",
            render: (v) => v || "--",
          },
          {
            key: "member_no",
            label: "Member #",
            render: (v) => v || "--",
          },
          {
            key: "description",
            label: "Description",
            render: (v) => v || "--",
          },
          {
            key: "payment_number",
            label: "Payment #",
            render: (v, r) => v || r.related_document_number || "--",
          },
          {
            key: "invoice_number",
            label: "Invoice #",
            render: (v) => v || "--",
          },
          {
            key: "receipt_number",
            label: "Receipt #",
            render: (v) => v || "--",
          },
          {
            key: "debit_amount",
            label: "Debit",
            render: (v) => money(v || 0),
          },
          {
            key: "credit_amount",
            label: "Credit",
            render: (v) => money(v || 0),
          },
          {
            key: "running_balance",
            label: "Balance",
            render: (v) => money(v || 0),
          },
          {
            key: "source",
            label: "Source",
            render: (v) => pretty(v || "--"),
          },
          {
            key: "reconciliation_status",
            label: "Reconciliation",
            render: (v) => <ReconcileBadge value={v} />,
          },
          {
            key: "status",
            label: "Status",
            render: (v, r) => (
              <FinanceBadge
                label={pretty(v || r.ledger_status || "posted")}
                type={badgeType(v || r.ledger_status)}
              />
            ),
          },
        ]}
        rowActions={rowActions}
        summaryBuilder={(rows, meta, formatMoney) => {
          const debits = rows.reduce(
            (sum, row) => sum + Number(row.debit_amount || 0),
            0
          );

          const credits = rows.reduce(
            (sum, row) => sum + Number(row.credit_amount || 0),
            0
          );

          const matched = rows.filter(
            (row) =>
              String(row.reconciliation_status || "").toLowerCase() === "matched"
          ).length;

          const reversed = rows.filter(
            (row) =>
              String(row.status || row.ledger_status || "").toLowerCase() ===
              "reversed"
          ).length;

          return [
            {
              label: "Ledger Entries",
              value: meta.total,
              sub: "Visible rows",
            },
            {
              label: "Credits",
              value: formatMoney(credits),
              sub: "Current page credits",
              featured: true,
            },
            {
              label: "Debits",
              value: formatMoney(debits),
              sub: "Current page debits",
            },
            {
              label: "Net",
              value: formatMoney(credits - debits),
              sub: "Credits minus debits",
            },
            {
              label: "Matched",
              value: matched,
              sub: "Reconciled entries",
            },
            {
              label: "Reversed",
              value: reversed,
              sub: "Reversal entries",
            },
          ];
        }}
      />
    </div>
  );
}