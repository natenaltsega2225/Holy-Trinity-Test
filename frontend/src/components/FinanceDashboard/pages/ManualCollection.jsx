
// // frontend/src/components/FinanceDashboard/pages/ManualEntries.jsx

// import React, {
//   useState,
// } from "react";

// import FinanceTablePage from "../components/FinanceTablePage";

// import FinanceManualEntryModal from "../components/FinanceManualEntryModal";

// import FinanceBadge from "../../Shared/FinanceBadge";
// import CoverageDisplay from "../../Shared/CoverageDisplay";

// import {
//   money,
//   formatDate,
//   pretty,
//   categoryLabel,
//   paymentSource,
//   cardDisplay,
// } from "../../../utils/paymentFormatters";

// import "../../../styles/shared-payment-components.css";

// function EmailStatusBadge({
//   value,
// }) {

//   const status = String(
//     value || "pending"
//   ).toLowerCase();

//   if (status === "sent") {

//     return (
//       <FinanceBadge
//         label="Sent"
//         type="success"
//       />
//     );
//   }

//   if (status === "failed") {

//     return (
//       <FinanceBadge
//         label="Failed"
//         type="danger"
//       />
//     );
//   }

//   return (
//     <FinanceBadge
//       label={pretty(status)}
//       type="warning"
//     />
//   );
// }

// const columns = [

//   {
//     key: "received_at",

//     label: "Received",

//     render: (v) =>
//       formatDate(v),
//   },

//   {
//     key: "payment_number",

//     label: "Payment #",
//   },

//   {
//     key: "receipt_number",

//     label: "Receipt #",

//     render: (v) =>
//       v || "--",
//   },

//   {
//     key: "invoice_number",

//     label: "Invoice #",

//     render: (v) =>
//       v || "--",
//   },

//   {
//     key: "full_name",

//     label: "Member / Donor",

//     render: (
//       v,
//       r
//     ) =>
//       v ||
//       r.full_name_snapshot ||
//       "Guest / Unknown",
//   },

//   {
//     key: "entry_type",

//     label: "Type",

//     render: (v) => (

//       <FinanceBadge
//         label={pretty(v)}
//         type="primary"
//       />
//     ),
//   },

//   {
//     key: "category",

//     label: "Category",

//     render: (v) => (

//       <FinanceBadge
//         label={categoryLabel(v)}
//         type="primary"
//       />
//     ),
//   },

//   {
//     key: "sub_category",

//     label: "Details",

//     render: (
//       v,
//       r
//     ) =>
//       v ||
//       r.plan_name ||
//       r.description ||
//       "--",
//   },

//   {
//     key: "coverage_period",

//     label: "Coverage",

//     render: (
//       _v,
//       r
//     ) => (

//       <CoverageDisplay
//         row={r}
//         showMonths
//       />
//     ),
//   },

//   {
//     key: "amount",

//     label: "Amount",

//     render: (v) =>
//       money(v),
//   },

//   {
//     key: "method",

//     label: "Method",

//     render: (v) =>
//       pretty(v),
//   },

//   {
//     key: "payment_source",

//     label: "Source",

//     render: (
//       v,
//       r
//     ) =>
//       paymentSource(
//         v ||
//         r.provider ||
//         r.method
//       ),
//   },

//   {
//     key: "card_display",

//     label: "Card",

//     render: (
//       _v,
//       r
//     ) =>
//       cardDisplay(r),
//   },

//   {
//     key: "reference_no",

//     label: "Reference",

//     render: (v) =>
//       v || "--",
//   },

//   {
//     key: "status",

//     label: "Payment",

//     render: (
//       v,
//       _r,
//       h
//     ) => (

//       <h.FinanceStatusBadge
//         status={
//           String(
//             v || "pending"
//           )
//         }
//       />
//     ),
//   },

//   {
//     key: "email_status",

//     label: "Receipt Email",

//     render: (v) => (
//       <EmailStatusBadge
//         value={v}
//       />
//     ),
//   },
// ];

// export default function ManualEntries() {

//   const [
//     open,
//     setOpen,
//   ] = useState(false);

//   const [
//     reload,
//     setReload,
//   ] = useState(0);

//   const [
//     message,
//     setMessage,
//   ] = useState("");

//   return (
//     <>

//       {message ? (

//         <div className="
// finance-banner
// finance-banner-success
//         ">
//           {message}
//         </div>

//       ) : null}

//       <FinanceTablePage

//         key={reload}

//         title="
// Manual Collection
//         "

//         subtitle="
// Record cash, check, Zelle, bank deposit, membership dues, donations, school registrations, and trip payments. Each entry automatically creates payment, invoice, receipt, ledger, and optional receipt email.
//         "

//         endpoint="/finance/manual-entries"

//         pageSize={10}

//         defaultPeriod="all"

//         defaultSortKey="received_at"

//         defaultSortDirection="desc"

//         searchPlaceholder="
// Search name, email, payment number, receipt number, invoice number, Stripe reference, donation, trip, or school...
//         "

//         columns={columns}

//         actions={[

//           {
//             label:
//               "Add Manual Entry",

//             variant:
//               "primary",

//             onClick: () => {

//               setMessage("");

//               setOpen(true);
//             },
//           },
//         ]}

//         rowActions={[

//           {
//             label:
//               "View Receipt",

//             onClick: (
//               row
//             ) => {

//               if (
//                 !row.receipt_number
//               ) {
//                 return;
//               }

//               window.open(
//                 `/dash/finance/receipts/${encodeURIComponent(
//                   row.receipt_number
//                 )}`,
//                 "_blank"
//               );
//             },
//           },

//           {
//             label:
//               "Receipt PDF",

//             onClick: (
//               row
//             ) => {

//               if (
//                 !row.receipt_number
//               ) {
//                 return;
//               }

//               window.open(
//                 `/api/finance/receipts/${encodeURIComponent(
//                   row.receipt_number
//                 )}/pdf`,
//                 "_blank"
//               );
//             },
//           },

//           {
//             label:
//               "Invoice PDF",

//             onClick: (
//               row
//             ) => {

//               if (
//                 !row.invoice_id
//               ) {
//                 return;
//               }

//               window.open(
//                 `/api/finance/invoices/${row.invoice_id}/pdf`,
//                 "_blank"
//               );
//             },
//           },

//           {
//             label:
//               (row) =>

//                 String(
//                   row.email_status || ""
//                 ).toLowerCase() ===
//                 "sent"
//                   ? "Resend Receipt"
//                   : "Send Receipt",

//             endpoint:
//               (row) =>

//                 row.receipt_number
//                   ? `/finance/receipts/${encodeURIComponent(
//                       row.receipt_number
//                     )}/send`
//                   : null,

//             method:
//               "post",
//           },
//         ]}

//         summaryBuilder={(
//           rows,
//           meta,
//           formatMoney
//         ) => {

//           const total =
//             rows.reduce(
//               (
//                 sum,
//                 row
//               ) =>
//                 sum +
//                 Number(
//                   row.amount || 0
//                 ),
//               0
//             );

//           const sent =
//             rows.filter(
//               (row) =>
//                 String(
//                   row.email_status || ""
//                 ).toLowerCase() ===
//                 "sent"
//             ).length;

//           const pendingEmail =
//             rows.filter(
//               (row) =>
//                 String(
//                   row.email_status || ""
//                 ).toLowerCase() !==
//                 "sent"
//             ).length;

//           const membership =
//             rows.filter(
//               (r) =>
//                 String(
//                   r.category || ""
//                 ).toLowerCase() ===
//                 "membership"
//             ).length;

//           const donations =
//             rows.filter(
//               (r) =>
//                 String(
//                   r.category || ""
//                 ).toLowerCase() ===
//                 "donation"
//             ).length;

//           return [

//             {
//               label:
//                 "Manual Entries",

//               value:
//                 meta.total,
//             },

//             {
//               label:
//                 "Visible Total",

//               value:
//                 formatMoney(
//                   total
//                 ),

//               featured:
//                 true,
//             },

//             {
//               label:
//                 "Membership",

//               value:
//                 membership,
//             },

//             {
//               label:
//                 "Donations",

//               value:
//                 donations,
//             },

//             {
//               label:
//                 "Receipts Sent",

//               value:
//                 sent,
//             },

//             {
//               label:
//                 "Email Pending",

//               value:
//                 pendingEmail,
//             },
//           ];
//         }}
//       />

//       <FinanceManualEntryModal

//         open={open}

//         onClose={() =>
//           setOpen(false)
//         }

//         onSaved={() => {

//           setOpen(false);

//           setReload(
//             (x) => x + 1
//           );

//           setMessage(
//             `
// Manual entry recorded successfully.

// Payment, invoice, receipt, ledger, and optional receipt email were processed successfully.
//             `
//           );
//         }}
//       />

//     </>
//   );
// }

// frontend/src/components/FinanceDashboard/pages/ManualEntries.jsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import FinanceTablePage from "../components/FinanceTablePage";
import FinancePaymentModal from "../components/FinancePaymentModal";

import FinanceBadge from "../../Shared/FinanceBadge";
import CoverageDisplay from "../../Shared/CoverageDisplay";

import {
  money,
  formatDate,
  pretty,
  categoryLabel,
  paymentSource,
  cardDisplay,
} from "../../../utils/paymentFormatters";

import "../../../styles/shared-payment-components.css";

function EmailStatusBadge({ value }) {
  const status = String(value || "pending").toLowerCase();

  if (status === "sent") {
    return <FinanceBadge label="Sent" type="success" />;
  }

  if (status === "failed") {
    return <FinanceBadge label="Failed" type="danger" />;
  }

  return <FinanceBadge label={pretty(status)} type="warning" />;
}

const columns = [
  {
    key: "payment_date",
    label: "Date",
    render: (v, r) => formatDate(v || r.received_at || r.paid_at || r.created_at),
  },
  { key: "payment_number", label: "Payment #" },
  {
    key: "receipt_number",
    label: "Receipt #",
    render: (v) => v || "--",
  },
  {
    key: "invoice_number",
    label: "Invoice #",
    render: (v) => v || "--",
  },
  {
    key: "full_name",
    label: "Member / Donor",
    render: (v, r) =>
      v ||
      r.full_name_snapshot ||
      r.guest_name ||
      r.guest_full_name ||
      "Guest / Unknown",
  },
  {
    key: "member_no",
    label: "Member #",
    render: (v) => v || "--",
  },
  {
    key: "category",
    label: "Category",
    render: (v, r) => (
      <FinanceBadge
        label={categoryLabel(v || r.payment_type || r.entry_type)}
        type="primary"
      />
    ),
  },
  {
    key: "sub_category",
    label: "Details",
    render: (v, r) =>
      v ||
      r.donation_category ||
      r.plan_name ||
      r.program_title ||
      r.description ||
      "--",
  },
  {
    key: "coverage_period",
    label: "Coverage",
    render: (_v, r) => <CoverageDisplay row={r} showMonths />,
  },
  {
    key: "months_paid",
    label: "Months",
    render: (v) => (v ? `${v} Month${Number(v) > 1 ? "s" : ""}` : "--"),
  },
  {
    key: "amount",
    label: "Amount",
    render: (v) => money(v),
  },
  {
    key: "method",
    label: "Method",
    render: (v, r) => pretty(v || r.payment_method || "manual"),
  },
  {
    key: "payment_source",
    label: "Source",
    render: (v, r) => paymentSource(v || r.provider || r.method || "manual"),
  },
  {
    key: "card_display",
    label: "Card",
    render: (_v, r) => cardDisplay(r),
  },
  {
    key: "reference_no",
    label: "Reference",
    render: (v) => v || "--",
  },
  {
    key: "status",
    label: "Payment",
    render: (v, _r, h) => (
      <h.FinanceStatusBadge status={String(v || "paid")} />
    ),
  },
  {
    key: "email_status",
    label: "Receipt Email",
    render: (v) => <EmailStatusBadge value={v} />,
  },
];

export default function ManualEntries() {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [message, setMessage] = useState("");

  return (
    <>
      {message ? (
        <div className="finance-banner finance-banner-success">
          {message}
        </div>
      ) : null}

      <FinanceTablePage
        key={reload}
        title="In-Person Collections"
        subtitle="Finance front-desk payment center for member registration payments, membership dues, donations, school, trip, pledge, cash, check, Zelle, card, receipt, email, invoice, ledger, and membership coverage."
        endpoint="/finance/payments"
        pageSize={10}
        defaultPeriod="all"
        defaultSortKey="created_at"
        defaultSortDirection="desc"
        searchPlaceholder="Search member, donor, payment number, receipt number, invoice number, coverage, donation type, program, check, Zelle, or reference..."
        columns={columns}
        actions={[
          {
            label: "Register New Member",
            variant: "secondary",
            onClick: () => navigate("/dash/finance/members"),
          },
          {
            label: "Create Payment",
            variant: "primary",
            onClick: () => {
              setMessage("");
              setOpen(true);
            },
          },
        ]}
        rowActions={[
          {
            label: "View Receipt",
            onClick: (row) => {
              if (!row.receipt_number) return;
              window.open(
                `/dash/finance/receipts/${encodeURIComponent(row.receipt_number)}`,
                "_blank"
              );
            },
          },
          {
            label: "Receipt PDF",
            onClick: (row) => {
              if (!row.receipt_number) return;
              window.open(
                `/api/finance/receipts/${encodeURIComponent(row.receipt_number)}/pdf`,
                "_blank"
              );
            },
          },
          {
            label: "Invoice PDF",
            onClick: (row) => {
              if (!row.invoice_id) return;
              window.open(`/api/finance/invoices/${row.invoice_id}/pdf`, "_blank");
            },
          },
          {
            label: (row) =>
              String(row.email_status || "").toLowerCase() === "sent"
                ? "Resend Receipt"
                : "Send Receipt",
            endpoint: (row) =>
              row.receipt_number
                ? `/finance/receipts/${encodeURIComponent(row.receipt_number)}/send`
                : null,
            method: "post",
          },
        ]}
        summaryBuilder={(rows, meta, formatMoney) => {
          const total = rows.reduce(
            (sum, row) => sum + Number(row.amount || 0),
            0
          );

          const membership = rows.filter(
            (r) => String(r.category || r.payment_type).toLowerCase() === "membership"
          ).length;

          const donations = rows.filter(
            (r) => String(r.category || r.payment_type).toLowerCase() === "donation"
          ).length;

          const programs = rows.filter((r) =>
            ["school", "trip"].includes(
              String(r.category || r.payment_type).toLowerCase()
            )
          ).length;

          const sent = rows.filter(
            (row) => String(row.email_status || "").toLowerCase() === "sent"
          ).length;

          return [
            {
              label: "Records",
              value: meta.total,
            },
            {
              label: "Visible Total",
              value: formatMoney(total),
              featured: true,
            },
            {
              label: "Membership",
              value: membership,
            },
            {
              label: "Donations",
              value: donations,
            },
            {
              label: "School / Trip",
              value: programs,
            },
            {
              label: "Receipts Sent",
              value: sent,
            },
          ];
        }}
      />

      <FinancePaymentModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => {
          setOpen(false);
          setReload((x) => x + 1);
          setMessage(
            "Payment recorded successfully. Receipt, invoice, ledger, email, and membership coverage were processed."
          );
        }}
      />
    </>
  );
}