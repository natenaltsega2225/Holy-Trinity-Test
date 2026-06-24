// frontend/src/components/FinanceDashboard/components/FinancePaymentAuditTimeline.jsx
import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Mail,
  Pencil,
  Receipt,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

function formatDate(value) {
  if (!value) return "--";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function clean(value, fallback = "--") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function eventType(row = {}) {
  return clean(
    row.event_type ||
      row.action ||
      row.audit_action ||
      row.activity_type ||
      row.type,
    "activity"
  );
}

function eventMessage(row = {}) {
  return clean(
    row.message ||
      row.notes ||
      row.description ||
      row.details ||
      row.audit_details ||
      row.metadata_summary,
    "Finance activity recorded."
  );
}

function actorName(row = {}) {
  return clean(
    row.actor_name ||
      row.user_name ||
      row.created_by_name ||
      row.staff_name ||
      row.recorded_by_name ||
      row.email ||
      row.user_email,
    "System"
  );
}

function referenceNumber(row = {}) {
  return clean(
    row.reference_no ||
      row.reference_number ||
      row.payment_number ||
      row.receipt_number ||
      row.invoice_number ||
      row.entity_id,
    ""
  );
}

function resolveIcon(type) {
  const value = String(type || "").toLowerCase();

  if (value.includes("receipt")) return Receipt;
  if (value.includes("invoice")) return FileText;
  if (value.includes("email") || value.includes("reminder")) return Mail;
  if (value.includes("refund") || value.includes("reverse")) return RotateCcw;
  if (value.includes("edit") || value.includes("update")) return Pencil;
  if (value.includes("audit") || value.includes("approve")) return ShieldCheck;
  if (value.includes("member") || value.includes("payer")) return UserCheck;
  if (value.includes("fail") || value.includes("error")) return AlertTriangle;
  if (value.includes("paid") || value.includes("complete")) return CheckCircle2;
  if (value.includes("sync") || value.includes("reconcile")) return RefreshCcw;

  return CreditCard;
}

function eventTone(type) {
  const value = String(type || "").toLowerCase();

  if (
    value.includes("paid") ||
    value.includes("sent") ||
    value.includes("complete") ||
    value.includes("approved")
  ) {
    return "success";
  }

  if (
    value.includes("failed") ||
    value.includes("error") ||
    value.includes("void") ||
    value.includes("cancel")
  ) {
    return "danger";
  }

  if (
    value.includes("pending") ||
    value.includes("reminder") ||
    value.includes("queued")
  ) {
    return "warning";
  }

  return "default";
}

function normalizedRows(rows = []) {
  return Array.isArray(rows)
    ? rows
        .filter(Boolean)
        .slice()
        .sort((a, b) => {
          const ad = new Date(a.created_at || a.event_at || a.date || 0).getTime();
          const bd = new Date(b.created_at || b.event_at || b.date || 0).getTime();
          return bd - ad;
        })
    : [];
}

export default function FinancePaymentAuditTimeline({ rows = [], title = "Audit Timeline" }) {
  const events = normalizedRows(rows);

  return (
    <section className="finance-audit-timeline" aria-label={title}>
      <div className="finance-audit-head">
        <span className="finance-audit-head-icon" aria-hidden="true">
          <Clock3 size={18} strokeWidth={2.1} />
        </span>

        <div>
          <h3>{title}</h3>
          <p>Payment, receipt, invoice, email, reconciliation, and staff activity.</p>
        </div>
      </div>

      {!events.length ? (
        <div className="finance-audit-empty">
          <ShieldCheck size={18} strokeWidth={2.1} />
          <span>No audit activity found.</span>
        </div>
      ) : (
        <div className="finance-audit-list">
          {events.map((item, index) => {
            const type = eventType(item);
            const Icon = resolveIcon(type);
            const tone = eventTone(type);
            const reference = referenceNumber(item);

            return (
              <article
                key={item.id || item.audit_id || `${type}-${index}`}
                className={`finance-audit-item ${tone}`}
              >
                <div className="finance-audit-rail" aria-hidden="true">
                  <span className="finance-audit-line" />
                  <span className="finance-audit-icon">
                    <Icon size={15} strokeWidth={2.1} />
                  </span>
                </div>

                <div className="finance-audit-content">
                  <div className="finance-audit-top">
                    <strong>{pretty(type)}</strong>
                    <time dateTime={item.created_at || item.event_at || ""}>
                      {formatDate(item.created_at || item.event_at || item.date)}
                    </time>
                  </div>

                  <p>{eventMessage(item)}</p>

                  <div className="finance-audit-meta">
                    <span>By {actorName(item)}</span>

                    {reference ? <span>Ref {reference}</span> : null}

                    {item.ip_address ? <span>IP {item.ip_address}</span> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

