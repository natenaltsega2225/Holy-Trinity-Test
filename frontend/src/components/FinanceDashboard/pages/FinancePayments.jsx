//frontend\src\components\FinanceDashboard\pages\FinancePayments.jsx
import React, { useMemo, useState } from "react";

import {
  Download,
  Plus,
  RefreshCcw,
} from "lucide-react";

import FinanceTablePage from "../components/FinanceTablePage";
import FinancePaymentDrawer from "../components/FinancePaymentDrawer";
import FinancePaymentModal from "../components/FinancePaymentModal";
import FinanceActionMenu from "../components/FinanceActionMenu";
import api from "../../api";

import "../../../styles/finance-enterprise.css";

const DEFAULT_FILTERS = {
  payment_type: "",
  category: "",
  method: "",
  status: "",
  source: "",
  donation_category: "",
  coverage_year: "",
  date_from: "",
  date_to: "",
};

function firstValue(row = {}, keys = [], fallback = "--") {
  for (const key of keys) {
    const value = row?.[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value) {
  if (!value) return "--";

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return `${match[2]}/${match[3]}/${match[1]}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleDateString("en-US");
}

function pretty(value) {
  const text = String(value || "--")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .trim();

  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function categoryLabel(value) {
  const key = String(value || "").toLowerCase();

  const map = {
    membership: "Membership",
    membership_registration: "Membership",
    dues: "Membership",
    donation: "Donation",
    pledge: "Pledge",
    school: "School",
    kids: "School",
    trip: "Trip",
    registration: "Registration",
    invoice: "Invoice",
  };

  return map[key] || pretty(value || "Payment");
}

function sourceLabel(row = {}) {
  const provider = firstValue(row, ["provider", "payment_provider", "source"], "");
  const method = firstValue(row, ["payment_method", "method"], "");

  if (String(provider).toLowerCase() === "stripe") {
    return "Stripe";
  }

  if (method) {
    return pretty(method);
  }

  return pretty(provider || "Manual");
}

function statusText(row = {}) {
  return firstValue(row, ["status", "payment_status"], "paid");
}

function paymentId(row = {}) {
  return firstValue(row, ["id", "payment_id"], "");
}

function receiptId(row = {}) {
  return firstValue(row, ["receipt_id", "finance_receipt_id"], "");
}

function receiptNumber(row = {}) {
  return firstValue(row, ["receipt_number", "receipt_no"], "");
}

function invoiceId(row = {}) {
  return firstValue(row, ["invoice_id", "finance_invoice_id"], "");
}

function invoiceNumber(row = {}) {
  return firstValue(row, ["invoice_number", "invoice_no"], "");
}

function openWindow(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function buildQuery(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, value);
    }
  });

  return params.toString();
}

function CardAchDisplay({ row = {} }) {
  const method = String(firstValue(row, ["payment_method", "method"], "")).toLowerCase();
  const brand = firstValue(row, ["card_brand", "brand"], "");
  const last4 = firstValue(row, ["card_last4", "card_last_4", "last4"], "");
  const bankLast4 = firstValue(row, ["bank_last4", "ach_last4", "account_last4"], "");
  const bankName = firstValue(row, ["bank_name", "ach_bank_name"], "");

  if (brand || last4) {
    return `${pretty(brand || "Card")} ${last4 ? `**** ${last4}` : ""}`.trim();
  }

  if (method === "ach" || method === "us_bank_account" || bankLast4 || bankName) {
    return `${bankName || "ACH"} ${bankLast4 ? `**** ${bankLast4}` : ""}`.trim();
  }

  return "--";
}

function CoverageDisplay({ row = {} }) {
  const label = firstValue(
    row,
    ["coverage_label", "membership_coverage_label", "coverage_period"],
    ""
  );

  if (label) {
    return <span className="coverage-display-label">{label}</span>;
  }

  const year = firstValue(row, ["coverage_year", "membership_year"], "");
  const monthsPaid = firstValue(row, ["months_paid", "duration_months"], "");

  if (year || monthsPaid) {
    return (
      <span className="coverage-display-label">
        {monthsPaid ? `${monthsPaid} month(s)` : "Coverage"} {year}
      </span>
    );
  }

  return <span className="coverage-display-label">--</span>;
}

function EmailStatusBadge({ value }) {
  const status = String(value || "not_sent").toLowerCase();

  let className = "finance-badge-neutral";
  let label = pretty(status);

  if (["sent", "delivered", "emailed"].includes(status)) {
    className = "finance-badge-success";
    label = "Sent";
  } else if (["failed", "bounced", "error"].includes(status)) {
    className = "finance-badge-danger";
    label = "Failed";
  } else if (["queued", "sending", "pending"].includes(status)) {
    className = "finance-badge-warning";
    label = pretty(status);
  }

  return <span className={`finance-badge ${className}`}>{label}</span>;
}

export default function FinancePayments() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  function openDrawer(row) {
    setSelectedPayment(row || null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);

    window.setTimeout(() => {
      setSelectedPayment(null);
    }, 180);
  }

  async function resendReceipt(row) {
    try {
      const id = paymentId(row);

      if (!id) {
        window.alert("Payment not found.");
        return;
      }

      await api.post(`/finance/receipts/payment/${id}/resend`).catch(() =>
        api.post(`/receipts/payment/${id}/resend`)
      );

      window.alert("Receipt email sent successfully.");
      refresh();
    } catch (err) {
      console.error("Receipt resend failed:", err);

      window.alert(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to resend receipt."
      );
    }
  }

  function exportPayments() {
    const query = buildQuery(filters);
    openWindow(`/api/finance/payments/export${query ? `?${query}` : ""}`);
  }

  const extraFilters = useMemo(
    () => [
      {
        key: "category",
        label: "Category",
        value: filters.category,
        onChange: (value) => setFilters((prev) => ({ ...prev, category: value })),
        options: [
          { value: "", label: "All Categories" },
          { value: "membership", label: "Membership" },
          { value: "donation", label: "Donation" },
          { value: "pledge", label: "Pledge" },
          { value: "school", label: "School" },
          { value: "trip", label: "Trip" },
        ],
      },
      {
        key: "method",
        label: "Method",
        value: filters.method,
        onChange: (value) => setFilters((prev) => ({ ...prev, method: value })),
        options: [
          { value: "", label: "All Methods" },
          { value: "card", label: "Card" },
          { value: "ach", label: "ACH" },
          { value: "cash", label: "Cash" },
          { value: "check", label: "Check" },
          { value: "zelle", label: "Zelle" },
        ],
      },
      {
        key: "status",
        label: "Status",
        value: filters.status,
        onChange: (value) => setFilters((prev) => ({ ...prev, status: value })),
        options: [
          { value: "", label: "All Statuses" },
          { value: "paid", label: "Paid" },
          { value: "pending", label: "Pending" },
          { value: "failed", label: "Failed" },
          { value: "refunded", label: "Refunded" },
          { value: "void", label: "Void" },
        ],
      },
      {
        key: "date_from",
        label: "From",
        value: filters.date_from,
        onChange: (value) => setFilters((prev) => ({ ...prev, date_from: value })),
        type: "date",
      },
      {
        key: "date_to",
        label: "To",
        value: filters.date_to,
        onChange: (value) => setFilters((prev) => ({ ...prev, date_to: value })),
        type: "date",
      },
    ],
    [filters]
  );

  const actions = useMemo(
    () => [
      {
        label: "Create Payment",
        variant: "primary",
        icon: <Plus size={15} strokeWidth={2.1} />,
        onClick: () => setShowPaymentModal(true),
      },
      {
        label: "Refresh",
        icon: <RefreshCcw size={15} strokeWidth={2.1} />,
        onClick: refresh,
      },
      {
        label: "Export",
        icon: <Download size={15} strokeWidth={2.1} />,
        onClick: exportPayments,
      },
      {
        label: "Reset Filters",
        onClick: resetFilters,
      },
    ],
    [filters]
  );

  const rowActions = useMemo(
  () => [
    {
      key: "openPayment",
      label: "Open Payment",
      onClick: openDrawer,
    },
    {
      key: "viewReceipt",
      label: "View Receipt",
      visible: (row) => Boolean(receiptNumber(row)),
      onClick: (row) =>
        openWindow(`/dash/finance/receipts/${encodeURIComponent(receiptNumber(row))}`),
    },
    {
      key: "receiptPdf",
      label: "Receipt PDF",
      visible: (row) => Boolean(receiptId(row) || receiptNumber(row)),
      onClick: (row) => {
        if (receiptId(row)) {
          openWindow(`/api/receipts/${receiptId(row)}/pdf`);
          return;
        }

        openWindow(`/api/receipts/number/${encodeURIComponent(receiptNumber(row))}/pdf`);
      },
    },
    {
      key: "invoicePdf",
      label: "Invoice PDF",
      visible: (row) => Boolean(invoiceId(row) || invoiceNumber(row)),
      onClick: (row) => {
        if (invoiceId(row)) {
          openWindow(`/api/invoices/${invoiceId(row)}/pdf`);
          return;
        }

        openWindow(`/api/invoices/number/${encodeURIComponent(invoiceNumber(row))}/pdf`);
      },
    },
    {
      key: "resendReceipt",
      label: "Resend Receipt",
      visible: (row) => Boolean(paymentId(row)),
      onClick: resendReceipt,
    },
  ],
  []
);

const columns = useMemo(
  () => [
    {
      key: "payment_date",
      label: "Date",
      render: (value, row) =>
        formatDate(value || row.paid_at || row.received_at || row.created_at),
    },
    {
      key: "payment_number",
      label: "Payment #",
      render: (value) => value || "--",
    },
    {
      key: "member_no",
      label: "Member #",
      render: (value) => value || "--",
    },
    {
      key: "full_name_snapshot",
      label: "Member / Payer",
      render: (value, row) =>
        value ||
        row.full_name ||
        row.payer_name ||
        row.guest_name ||
        row.donor_name ||
        "Guest / Non-member",
    },
    {
      key: "category",
      label: "Category",
      render: (value, row) => categoryLabel(value || row.payment_type || row.type),
    },
    {
      key: "sub_category",
      label: "Details",
      render: (value, row) =>
        value ||
        row.plan_name ||
        row.program_name ||
        row.program_title ||
        row.campaign_name ||
        row.donation_category ||
        row.description ||
        "--",
    },
    {
      key: "coverage",
      label: "Coverage",
      render: (_value, row) => <CoverageDisplay row={row} />,
    },
    {
      key: "amount",
      label: "Amount",
      render: (value, row) => formatMoney(value ?? row.total_amount ?? 0),
    },
    {
      key: "payment_method",
      label: "Method",
      render: (value, row) => pretty(value || row.method || "--"),
    },
    {
      key: "provider",
      label: "Source",
      render: (_value, row) => sourceLabel(row),
    },
    {
      key: "card",
      label: "Card / ACH",
      render: (_value, row) => <CardAchDisplay row={row} />,
    },
    {
      key: "status",
      label: "Status",
      render: (_value, row, helpers) => (
        <helpers.FinanceStatusBadge status={statusText(row)} />
      ),
    },
    {
      key: "receipt_number",
      label: "Receipt #",
      render: (value) => value || "--",
    },
    {
      key: "invoice_number",
      label: "Invoice #",
      render: (value) => value || "--",
    },
    {
      key: "email_status",
      label: "Receipt Email",
      render: (value, row) => (
        <EmailStatusBadge value={value || row.receipt_email_status} />
      ),
    },
    {
      key: "reference_no",
      label: "Reference",
      render: (value, row) =>
        value ||
        row.reference_number ||
        row.transaction_reference ||
        row.stripe_payment_intent_id ||
        row.check_number ||
        row.zelle_reference ||
        "--",
    },
    {
      key: "actions",
      label: "Actions",
      render: (_value, row) => (
        <div className="finance-action-cell">
          <FinanceActionMenu row={row} actions={rowActions} />
        </div>
      ),
    },
  ],
  [rowActions]
);

return (
  
  <div className="finance-enterprise-page">
    <FinanceTablePage
      key={refreshKey}
      title="Finance Payments"
      subtitle="Unified payment operations for card, ACH, cash, check, Zelle, membership dues, donations, programs, pledges, invoices, receipts, reconciliation, and ledger tracking."
      endpoint="/finance/payments"
      filters={filters}
      extraFilters={extraFilters}
      defaultSortKey="created_at"
      defaultSortDirection="desc"
      searchPlaceholder="Search payment number, invoice, receipt, member ID, payer, email, reference, card, ACH, program, pledge, or ledger..."
      actions={actions}
      columns={columns}
      summaryBuilder={(rows, meta, helperMoney) => {
        const total = rows.reduce(
          (sum, row) => sum + numberValue(row.amount ?? row.total_amount),
          0
        );

        const paid = rows.filter(
          (row) => String(statusText(row)).toLowerCase() === "paid"
        ).length;

        return [
          {
            label: "Payments",
            value: meta?.total ?? rows.length,
            sub: "Matched payment rows",
          },
          {
            label: "Visible Amount",
            value: helperMoney ? helperMoney(total) : formatMoney(total),
            sub: "Current page total",
            featured: true,
          },
          {
            label: "Paid",
            value: paid,
            sub: "Completed payments",
          },
          {
            label: "Manual",
            value: rows.filter((row) =>
              ["cash", "check", "zelle"].includes(
                String(row.method || row.payment_method || "").toLowerCase()
              )
            ).length,
            sub: "Cash, check, and Zelle",
          },
        ];
      }}
    />

    {showPaymentModal ? (
      <FinancePaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          setShowPaymentModal(false);
          refresh();
        }}
        onSaved={() => {
          setShowPaymentModal(false);
          refresh();
        }}
      />
    ) : null}

    {drawerOpen ? (
      <FinancePaymentDrawer
        open={drawerOpen}
        payment={selectedPayment}
        onClose={closeDrawer}
      />
    ) : null}
  </div>
);



}