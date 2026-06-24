import React, { useMemo, useState } from "react";

import {
  Download,
  FileText,
  RefreshCcw,
} from "lucide-react";

import FinanceTablePage from "../components/FinanceTablePage";
import FinanceInvoiceDrawer from "../components/FinanceInvoiceDrawer";
import FinanceActionMenu from "../components/FinanceActionMenu";
import api from "../../api";

import "../../../styles/finance-enterprise.css";

const DEFAULT_FILTERS = {
  status: "",
  category: "",
  payment_method: "",
  email_status: "",
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
    return raw || "--";
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
    invoice: "Invoice",
    registration: "Registration",
  };

  return map[key] || pretty(value || "Finance");
}

function invoiceId(row = {}) {
  return firstValue(row, ["id", "invoice_id", "finance_invoice_id"], "");
}

function invoiceNumber(row = {}) {
  return firstValue(row, ["invoice_number", "invoice_no", "number"], "");
}

function paymentNumber(row = {}) {
  return firstValue(row, ["payment_number", "payment_no"], "");
}

function receiptId(row = {}) {
  return firstValue(row, ["receipt_id", "finance_receipt_id"], "");
}

function receiptNumber(row = {}) {
  return firstValue(row, ["receipt_number", "receipt_no"], "");
}

function invoiceStatus(row = {}) {
  return firstValue(row, ["status", "invoice_status"], "open");
}

function emailStatus(row = {}) {
  return firstValue(
    row,
    ["email_status", "invoice_email_status", "last_email_status"],
    "not_sent"
  );
}

function totalAmount(row = {}) {
  return numberValue(
    firstValue(row, ["total_amount", "invoice_amount", "amount", "subtotal"], 0)
  );
}

function paidAmount(row = {}) {
  const total = totalAmount(row);
  const paid = numberValue(firstValue(row, ["paid_amount", "amount_paid"], 0));

  if (paid <= 0) return 0;
  if (total <= 0) return paid;

  return Math.min(paid, total);
}

function balanceDue(row = {}) {
  const explicitBalance = firstValue(
    row,
    ["balance_due", "remaining_amount", "outstanding_amount"],
    null
  );

  if (explicitBalance !== null && explicitBalance !== "--") {
    return Math.max(0, Math.min(numberValue(explicitBalance), totalAmount(row)));
  }

  return Math.max(totalAmount(row) - paidAmount(row), 0);
}

function invoicePdfUrl(row = {}) {
  const id = invoiceId(row);
  const number = invoiceNumber(row);

  if (id) return `/api/invoices/${encodeURIComponent(id)}/pdf`;
  if (number) return `/api/invoices/number/${encodeURIComponent(number)}/pdf`;

  return "";
}

function receiptPdfUrl(row = {}) {
  const id = receiptId(row);
  const number = receiptNumber(row);

  if (id) return `/api/receipts/${encodeURIComponent(id)}/pdf`;
  if (number) return `/api/receipts/number/${encodeURIComponent(number)}/pdf`;

  return "";
}

function existingPaymentLink(row = {}) {
  return firstValue(
    row,
    [
      "payment_link",
      "payment_url",
      "checkout_url",
      "public_payment_url",
      "public_invoice_url",
      "secure_payment_url",
    ],
    ""
  );
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

function canCollectPayment(row = {}) {
  const status = String(invoiceStatus(row)).toLowerCase();

  return !["paid", "cancelled", "canceled", "void", "refunded"].includes(status);
}

function canCancel(row = {}) {
  const status = String(invoiceStatus(row)).toLowerCase();

  return !["paid", "cancelled", "canceled", "void", "refunded"].includes(status);
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

  const from = firstValue(row, ["coverage_from", "period_from"], "");
  const to = firstValue(row, ["coverage_to", "period_to"], "");

  if (from || to) {
    return (
      <span className="coverage-display-label">
        {from ? formatDate(from) : "--"} - {to ? formatDate(to) : "--"}
      </span>
    );
  }

  const months = firstValue(row, ["months_paid", "duration_months"], "");
  const year = firstValue(row, ["coverage_year", "membership_year"], "");

  if (months || year) {
    return (
      <span className="coverage-display-label">
        {months ? `${months} month(s)` : "Coverage"} {year}
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

async function postInvoiceAction(row, paths, payload = {}) {
  const id = invoiceId(row);
  const number = invoiceNumber(row);
  let lastError = null;

  for (const buildPath of paths) {
    try {
      const path = buildPath({ id, number, row });
      return await api.post(path, payload);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

export default function FinanceInvoices() {
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  function openDrawer(row) {
    setSelectedInvoice(row || null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);

    window.setTimeout(() => {
      setSelectedInvoice(null);
    }, 180);
  }

  async function generatePdf(row) {
    try {
      if (!invoiceId(row)) {
        window.alert("Invoice not found.");
        return;
      }

      await postInvoiceAction(row, [
        ({ id }) => `/invoices/${id}/generate-pdf`,
        ({ id }) => `/finance/invoices/${id}/generate-pdf`,
      ]);

      openWindow(invoicePdfUrl(row));
      refresh();
    } catch (err) {
      console.error("Generate invoice PDF failed:", err);

      window.alert(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to generate invoice PDF."
      );
    }
  }

  async function sendInvoiceEmail(row) {
    try {
      if (!invoiceId(row)) {
        window.alert("Invoice not found.");
        return;
      }

      await postInvoiceAction(row, [
        ({ id }) => `/invoices/${id}/send-email`,
        ({ id }) => `/finance/invoices/${id}/send-email`,
        ({ id }) => `/invoices/${id}/email`,
        ({ id }) => `/finance/invoices/${id}/email`,
      ]);

      window.alert("Invoice email sent successfully.");
      refresh();
    } catch (err) {
      console.error("Send invoice email failed:", err);

      window.alert(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to send invoice email."
      );
    }
  }

  async function openPaymentLink(row) {
    try {
      const existing = existingPaymentLink(row);

      if (existing) {
        openWindow(existing);
        return;
      }

      if (!invoiceId(row)) {
        window.alert("Invoice not found.");
        return;
      }

      const response = await postInvoiceAction(row, [
        ({ id }) => `/invoices/${id}/payment-link`,
        ({ id }) => `/finance/invoices/${id}/payment-link`,
        ({ id }) => `/invoices/${id}/checkout-link`,
        ({ id }) => `/finance/invoices/${id}/checkout-link`,
      ]);

      const data = response?.data || {};
      const url =
        data.payment_link ||
        data.payment_url ||
        data.checkout_url ||
        data.url ||
        data.link;

      if (!url) {
        window.alert("Payment link was not returned by the server.");
        return;
      }

      try {
        await navigator.clipboard?.writeText?.(url);
      } catch (_err) {
        // Clipboard can fail on non-HTTPS deployments. Opening still works.
      }

      openWindow(url);
    } catch (err) {
      console.error("Payment link failed:", err);

      window.alert(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to create or open payment link."
      );
    }
  }

  async function markInvoicePaid(row) {
    try {
      if (!invoiceId(row)) {
        window.alert("Invoice not found.");
        return;
      }

      const defaultAmount = balanceDue(row) || totalAmount(row);
      const rawAmount = window.prompt(
        "Enter paid amount",
        String(defaultAmount.toFixed(2))
      );

      if (rawAmount === null) return;

      const amount = numberValue(rawAmount);

      if (amount <= 0) {
        window.alert("Paid amount must be greater than zero.");
        return;
      }

      await postInvoiceAction(
        row,
        [
          ({ id }) => `/invoices/${id}/mark-paid`,
          ({ id }) => `/finance/invoices/${id}/mark-paid`,
          ({ id }) => `/invoices/${id}/payments/manual`,
          ({ id }) => `/finance/invoices/${id}/payments/manual`,
        ],
        {
          amount,
          payment_method: "manual",
          method: "manual",
        }
      );

      window.alert("Invoice marked paid.");
      refresh();
    } catch (err) {
      console.error("Mark invoice paid failed:", err);

      window.alert(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to mark invoice paid."
      );
    }
  }

  async function cancelInvoice(row) {
    try {
      if (!invoiceId(row)) {
        window.alert("Invoice not found.");
        return;
      }

      const confirmed = window.confirm(
        "Cancel or void this invoice? This should only be used when the invoice should no longer be collectible."
      );

      if (!confirmed) return;

      await postInvoiceAction(row, [
        ({ id }) => `/invoices/${id}/cancel`,
        ({ id }) => `/finance/invoices/${id}/cancel`,
        ({ id }) => `/invoices/${id}/void`,
        ({ id }) => `/finance/invoices/${id}/void`,
      ]);

      window.alert("Invoice cancelled.");
      refresh();
    } catch (err) {
      console.error("Cancel invoice failed:", err);

      window.alert(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to cancel invoice."
      );
    }
  }

  async function refundInvoice(row) {
    try {
      if (!invoiceId(row)) {
        window.alert("Invoice not found.");
        return;
      }

      const confirmed = window.confirm(
        "Start refund workflow for this invoice payment?"
      );

      if (!confirmed) return;

      await postInvoiceAction(row, [
        ({ id }) => `/invoices/${id}/refund`,
        ({ id }) => `/finance/invoices/${id}/refund`,
      ]);

      window.alert("Refund request submitted.");
      refresh();
    } catch (err) {
      console.error("Refund invoice failed:", err);

      window.alert(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to submit refund."
      );
    }
  }


  function exportInvoices() {
    const query = buildQuery(filters);
    openWindow(`/api/finance/invoices/export${query ? `?${query}` : ""}`);
  }

  const extraFilters = useMemo(
    () => [
      {
        key: "status",
        label: "Status",
        value: filters.status,
        onChange: (value) => setFilters((prev) => ({ ...prev, status: value })),
        options: [
          { value: "", label: "All Statuses" },
          { value: "open", label: "Open" },
          { value: "pending", label: "Pending" },
          { value: "partial", label: "Partial" },
          { value: "paid", label: "Paid" },
          { value: "overdue", label: "Overdue" },
          { value: "cancelled", label: "Cancelled" },
          { value: "void", label: "Void" },
          { value: "refunded", label: "Refunded" },
        ],
      },
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
        key: "payment_method",
        label: "Method",
        value: filters.payment_method,
        onChange: (value) =>
          setFilters((prev) => ({ ...prev, payment_method: value })),
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
        label: "Create Invoice",
        variant: "primary",
        icon: <FileText size={15} strokeWidth={2.1} />,
        onClick: () => openWindow("/dash/finance/invoice-generator"),
      },
      {
        label: "Refresh",
        icon: <RefreshCcw size={15} strokeWidth={2.1} />,
        onClick: refresh,
      },
      {
        label: "Export",
        icon: <Download size={15} strokeWidth={2.1} />,
        onClick: exportInvoices,
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
      key: "openInvoice",
      label: "Open Invoice",
      onClick: openDrawer,
    },
    {
      key: "viewPdf",
      label: "View PDF",
      visible: (row) => Boolean(invoicePdfUrl(row)),
      onClick: (row) => openWindow(invoicePdfUrl(row)),
    },
    {
      key: "generatePdf",
      label: "Generate PDF",
      visible: (row) => Boolean(invoiceId(row)),
      onClick: generatePdf,
    },
    {
      key: "sendEmail",
      label: "Send Email",
      visible: (row) => Boolean(invoiceId(row)),
      onClick: sendInvoiceEmail,
    },
    {
      key: "paymentLink",
      label: "Payment Link",
      visible: (row) => canCollectPayment(row),
      onClick: openPaymentLink,
    },
    {
      key: "markPaid",
      label: "Mark Paid",
      visible: (row) => canCollectPayment(row),
      onClick: markInvoicePaid,
    },
    {
      key: "receipt",
      label: "Receipt",
      visible: (row) => Boolean(receiptNumber(row)),
      onClick: (row) =>
        openWindow(`/dash/finance/receipts/${encodeURIComponent(receiptNumber(row))}`),
    },
    {
      key: "receiptPdf",
      label: "Receipt PDF",
      visible: (row) => Boolean(receiptPdfUrl(row)),
      onClick: (row) => openWindow(receiptPdfUrl(row)),
    },
    {
      key: "refund",
      label: "Refund",
      tone: "danger",
      danger: true,
      visible: (row) => String(invoiceStatus(row)).toLowerCase() === "paid",
      onClick: refundInvoice,
    },
    {
      key: "cancelVoid",
      label: "Cancel / Void",
      tone: "danger",
      danger: true,
      visible: (row) => canCancel(row),
      onClick: cancelInvoice,
    },
  ],
  []
);

const columns = useMemo(
  () => [
    {
      key: "created_at",
      label: "Created",
      render: (value, row) =>
        formatDate(value || row.invoice_date || row.issued_at),
    },
    {
      key: "invoice_number",
      label: "Invoice #",
      render: (value, row) => value || invoiceNumber(row) || "--",
    },
    {
      key: "payment_number",
      label: "Payment #",
      render: (value, row) => value || paymentNumber(row) || "--",
    },
    {
      key: "receipt_number",
      label: "Receipt #",
      render: (value, row) => value || receiptNumber(row) || "--",
    },
    {
      key: "full_name",
      label: "Member / Payer",
      render: (value, row) =>
        value ||
        row.full_name_snapshot ||
        row.bill_to ||
        row.payer_name ||
        row.donor_name ||
        row.customer_name ||
        "Guest / Non-member",
    },
    {
      key: "member_no",
      label: "Member #",
      render: (value) => value || "--",
    },
    {
      key: "category",
      label: "Category",
      render: (value, row) =>
        categoryLabel(
          value ||
            row.payment_type ||
            row.invoice_type ||
            row.donation_category ||
            row.type
        ),
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
      key: "coverage_period",
      label: "Coverage",
      render: (_value, row) => <CoverageDisplay row={row} />,
    },
    {
      key: "total_amount",
      label: "Amount",
      render: (_value, row) => formatMoney(totalAmount(row)),
    },
    {
      key: "paid_amount",
      label: "Paid",
      render: (_value, row) => formatMoney(paidAmount(row)),
    },
    {
      key: "balance_due",
      label: "Balance",
      render: (_value, row) => formatMoney(balanceDue(row)),
    },
    {
      key: "status",
      label: "Status",
      render: (_value, row, helpers) => (
        <helpers.FinanceStatusBadge status={invoiceStatus(row)} />
      ),
    },
    {
      key: "email_status",
      label: "Email",
      render: (_value, row) => <EmailStatusBadge value={emailStatus(row)} />,
    },
    {
      key: "payment_method",
      label: "Method",
      render: (value, row) => pretty(value || row.method || "--"),
    },
    {
      key: "due_date",
      label: "Due Date",
      render: (value) => formatDate(value),
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
      title="Finance Invoices"
      subtitle="Enterprise invoice management across membership dues, donations, pledges, school programs, trips, Stripe billing, manual invoices, reconciliation, and audit tracking."
      endpoint="/finance/invoices"
      filters={filters}
      extraFilters={extraFilters}
      defaultSortKey="created_at"
      defaultSortDirection="desc"
      searchPlaceholder="Search invoice, payment, receipt, member, donor, coverage, pledge, category, Stripe invoice, or billing reference..."
      actions={actions}
      columns={columns}
      summaryBuilder={(rows, meta, helperMoney) => {
        const total = rows.reduce((sum, row) => sum + totalAmount(row), 0);
        const paidTotal = rows.reduce((sum, row) => sum + paidAmount(row), 0);
        const balanceTotal = rows.reduce((sum, row) => sum + balanceDue(row), 0);

        const paidCount = rows.filter(
          (row) => String(invoiceStatus(row)).toLowerCase() === "paid"
        ).length;

        const openCount = rows.filter((row) =>
          ["open", "pending", "partial", "overdue"].includes(
            String(invoiceStatus(row)).toLowerCase()
          )
        ).length;

        const money = helperMoney || formatMoney;

        return [
          {
            label: "Invoices",
            value: meta?.total ?? rows.length,
            sub: "Matched invoice rows",
          },
          {
            label: "Visible Amount",
            value: money(total),
            sub: "Current page total",
            featured: true,
          },
          {
            label: "Paid",
            value: money(paidTotal),
            sub: `${paidCount} completed invoice(s)`,
          },
          {
            label: "Open Balance",
            value: money(balanceTotal),
            sub: `${openCount} collectible invoice(s)`,
          },
        ];
      }}
    />

    {drawerOpen ? (
      <FinanceInvoiceDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        invoice={selectedInvoice}
        onRefresh={refresh}
      />
    ) : null}
  </div>
);


}

function ReceiptIcon() {
  return <Send size={14} strokeWidth={2.1} />;
}