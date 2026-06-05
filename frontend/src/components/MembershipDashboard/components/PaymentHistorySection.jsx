
// frontend/src/components/MembershipDashboard/components/PaymentHistorySection.jsx

import React from "react";
import MemberTablePage from "./MemberTablePage";
import "../../../styles/membership-dashboard.css";

function formatDate(value) {
if (!value) return "--";

const d = new Date(value);

if (Number.isNaN(d.getTime())) {
return "--";
}

return d.toLocaleDateString("en-US");
}

function pretty(value) {
if (!value) return "--";

return String(value)
.replaceAll("_", " ")
.replace(/\b\w/g, (c) => c.toUpperCase());
}

function cardText(row) {
if (!row?.card_last4) {
return "--";
}

return `${pretty(row.card_brand || "Card")} •••• ${row.card_last4}`;
}

function detailText(row) {
const category = String(
row.category ||
row.payment_type ||
""
).toLowerCase();

if (category === "membership") {
return (
row.plan_name ||
row.plan_duration ||
row.sub_category ||
"Membership Dues"
);
}

if (category === "donation") {
return (
pretty(
row.donation_category ||
row.sub_category
)
);
}

if (
category === "school" ||
category === "trip"
) {
return (
row.program_title ||
row.program_name ||
row.sub_category ||
"Program"
);
}

if (category === "pledge") {
return (
row.campaign_name ||
row.sub_category ||
"Pledge"
);
}

return (
row.sub_category ||
row.description ||
"--"
);
}

function coverageText(row) {
return (
row.coverage_label ||
row.coverage_period ||
row.coverage_months ||
row.coverage_start_month &&
row.coverage_end_month
? `${row.coverage_start_month} → ${row.coverage_end_month}`
: "--"
);
}

const paymentColumns = [
{
key: "payment_date",
label: "Date",
render: (_value, row) =>
formatDate(
row.payment_date ||
row.paid_at ||
row.payment_created_at ||
row.created_at
),
},

{
key: "payment_number",
label: "Payment #",
render: (value) => value || "--",
},

{
key: "category",
label: "Type",
render: (_value, row) =>
pretty(
row.category ||
row.payment_type
),
},

{
key: "details",
label: "Details",
render: (_value, row) =>
detailText(row),
},

{
key: "coverage",
label: "Coverage",
render: (_value, row) =>
coverageText(row),
},

{
key: "months_paid",
label: "Months",
render: (_value, row) => {


  const months =
    Number(
      row.months_paid ||
      row.interval_count ||
      0
    );

  if (!months) {
    return "--";
  }

  return `${months} Month${months > 1 ? "s" : ""}`;
},


},

{
key: "amount",
label: "Amount",
money: true,
},

{
key: "method",
label: "Method",
render: (_value, row) =>
pretty(
row.method ||
row.payment_method
),
},

{
key: "provider",
label: "Source",
render: (_value, row) =>
pretty(
row.provider ||
row.payment_source ||
"System"
),
},

{
key: "card",
label: "Card",
render: (_value, row) =>
cardText(row),
},

{
key: "receipt_number",
label: "Receipt",
render: (_value, row) => {


  const receipt =
    row.receipt_number;

  if (!receipt) {
    return "--";
  }

  return (
    <button
      type="button"
      className="member-inline-link"
      onClick={() =>
        window.open(
          `/dash/membership/receipts/${encodeURIComponent(receipt)}`,
          "_blank"
        )
      }
    >
      {receipt}
    </button>
  );
},


},

{
key: "invoice_number",
label: "Invoice",
render: (_value, row) =>
row.invoice_number ||
"--",
},

{
key: "email_status",
label: "Email",
render: (_value, row) =>
pretty(
row.email_status ||
"pending"
),
},

{
key: "status",
label: "Status",
status: true,
},
];

export default function PaymentHistorySection() {
return ( <section className="payx-history">

```
  <div className="payx-section-head">

    <div>

      <h3 className="payx-section-title">
        Unified Payment History
      </h3>

      <p className="payx-section-subtitle">
        Stripe, finance office, cash,
        check, Zelle, membership dues,
        donations, school programs,
        trips, pledges, invoices,
        receipts, and coverage history.
      </p>

    </div>

  </div>

  <MemberTablePage
    endpoint="/member/payments"
    defaultSortKey="created_at"
    defaultSortDirection="desc"
    searchPlaceholder="Search payment, receipt, invoice, coverage, donation, member..."
    emptyTitle="No payment history found"
    emptyMessage="Completed payments will appear here."
    columns={paymentColumns.map(
      (column) => ({
        ...column,

        render:
          column.render ||

          ((value, row, helpers) => {

            if (column.status) {
              return (
                <helpers.MemberStatusBadge
                  status={
                    String(
                      value ||
                      row.status ||
                      "--"
                    )
                  }
                />
              );
            }

            if (column.money) {
              return helpers.formatMoney(
                value
              );
            }

            return value ?? "--";
          }),
      })
    )}
  />

</section>


);
}
