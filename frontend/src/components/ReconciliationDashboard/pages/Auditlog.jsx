//frontend\src\components\ReconciliationDashboard\pages\Auditlog.jsx
import React, { useMemo, useState } from "react";
import FinanceTablePage from "../../FinanceDashboard/components/FinanceTablePage";

const ACTION_TYPES = [
  { value: "", label: "All Actions" },
  { value: "finance.manual_entry.created", label: "Manual Entry Created" },
  { value: "receipt.email.sent", label: "Receipt Email Sent" },
  { value: "receipt.email.failed", label: "Receipt Email Failed" },
  { value: "receipt.pdf.generated", label: "Receipt PDF Generated" },
  { value: "stripe.webhook.processed", label: "Stripe Webhook Processed" },
  { value: "payment.status.updated", label: "Payment Status Updated" },
  { value: "reconciliation.approved", label: "Reconciliation Approved" },
  { value: "reconciliation.bulk_match", label: "Bulk Match" },
  { value: "reconciliation.period_locked", label: "Period Locked" },
];

const ENTITY_TYPES = [
  { value: "", label: "All Entities" },
  { value: "finance_payment", label: "Finance Payment" },
  { value: "finance_receipt", label: "Finance Receipt" },
  { value: "finance_invoice", label: "Finance Invoice" },
  { value: "finance_report", label: "Finance Report" },
  { value: "stripe_webhook", label: "Stripe Webhook" },
  { value: "reconciliation_period", label: "Reconciliation Period" },
];

function formatDateTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pretty(value) {
  return value ? String(value).replaceAll("_", " ") : "--";
}

function RiskBadge({ value }) {
  const v = String(value || "normal").toLowerCase();

  const className =
    v === "high"
      ? "finance-badge-danger"
      : v === "medium"
      ? "finance-badge-warning"
      : "finance-badge-success";

  return <span className={`finance-badge ${className}`}>{pretty(v)}</span>;
}

export default function Auditlog() {
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (entity) params.set("entity", entity);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return `/reconciliation/audit-logs?${params.toString()}`;
  }, [action, entity, startDate, endDate]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (entity) params.set("entity", entity);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return `/api/reconciliation/audit-logs/export?${params.toString()}`;
  }, [action, entity, startDate, endDate]);

  const columns = [
    { key: "created_at", label: "Time" },
    { key: "actor_name", label: "Actor" },
    { key: "actor_role", label: "Role" },
    { key: "action", label: "Action" },
    { key: "entity", label: "Entity" },
    { key: "entity_id", label: "Entity ID" },
    { key: "risk_level", label: "Risk" },
    { key: "ip_address", label: "IP Address" },
    { key: "meta_summary", label: "Summary" },
  ];

  return (
    <FinanceTablePage
      title="Audit Logs"
      subtitle="Enterprise audit trail for receipts, manual entries, reports, Stripe webhooks, PDF generation, email delivery, and payment status changes."
      endpoint={endpoint}
      pageSize={10}
      searchPlaceholder="Search actor, action, entity, receipt, payment, invoice, IP address..."
      topContent={() => (
        <div className="finance-filter-bar">
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTION_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select value={entity} onChange={(e) => setEntity(e.target.value)}>
            {ENTITY_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      )}
      columns={columns.map((column) => ({
        ...column,
        render: (value) => {
          if (column.key === "created_at") return formatDateTime(value);
          if (column.key === "risk_level") return <RiskBadge value={value} />;

          if (
            column.key === "action" ||
            column.key === "entity" ||
            column.key === "actor_role"
          ) {
            return pretty(value);
          }

          return value || "--";
        },
      }))}
      actions={[
        {
          label: "Export Audit CSV",
          variant: "secondary",
          onClick: () => window.open(exportUrl),
        },
      ]}
      summaryBuilder={(rows, meta) => {
        const high = rows.filter(
          (row) => String(row.risk_level || "").toLowerCase() === "high"
        ).length;

        const emailEvents = rows.filter((row) =>
          String(row.action || "").includes("receipt.email")
        ).length;

        const pdfEvents = rows.filter((row) =>
          String(row.action || "").includes("pdf")
        ).length;

        const reconEvents = rows.filter((row) =>
          String(row.action || "").includes("reconciliation")
        ).length;

        return [
          { label: "Audit Records", value: meta.total },
          { label: "High Risk", value: high },
          { label: "Email Events", value: emailEvents },
          { label: "PDF Events", value: pdfEvents },
          { label: "Recon Events", value: reconEvents },
        ];
      }}
    />
  );
}