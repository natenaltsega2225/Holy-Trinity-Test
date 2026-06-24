// frontend/src/components/FinanceDashboard/components/FinanceStatusBadge.jsx

import React from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  MailCheck,
  RefreshCcw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import "../../../styles/finance-enterprise.css";

const STATUS_TONES = {
  success: [
    "active",
    "approved",
    "cleared",
    "complete",
    "completed",
    "deposited",
    "emailed",
    "issued",
    "paid",
    "posted",
    "reconciled",
    "sent",
    "settled",
    "succeeded",
    "success",
    "verified",
  ],

  warning: [
    "draft",
    "due",
    "open",
    "partial",
    "partially_paid",
    "pending",
    "pending_payment",
    "processing",
    "queued",
    "received",
    "review",
    "unpaid",
  ],

  danger: [
    "cancelled",
    "canceled",
    "declined",
    "deleted",
    "expired",
    "failed",
    "inactive",
    "overdue",
    "past_due",
    "rejected",
    "returned",
    "void",
    "voided",
  ],

  info: [
    "ach",
    "card",
    "cash",
    "check",
    "invoice",
    "membership",
    "pledge",
    "receipt",
    "refunded",
    "zelle",
  ],
};

function clean(value) {
  return String(value ?? "").trim();
}

export function normalizeStatus(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");
}

export function prettyStatus(value) {
  const text = clean(value);

  if (!text) return "--";

  return text
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function statusTone(value) {
  const normalized = normalizeStatus(value);

  if (!normalized) return "neutral";

  for (const [tone, statuses] of Object.entries(STATUS_TONES)) {
    if (statuses.includes(normalized)) {
      return tone;
    }
  }

  if (normalized.includes("paid") && !normalized.includes("unpaid")) {
    return "success";
  }

  if (normalized.includes("overdue") || normalized.includes("fail")) {
    return "danger";
  }

  if (normalized.includes("pending") || normalized.includes("open")) {
    return "warning";
  }

  return "neutral";
}

function statusIcon(value, tone) {
  const normalized = normalizeStatus(value);

  if (["sent", "emailed", "queued"].includes(normalized)) return Send;
  if (["issued", "receipt"].includes(normalized)) return MailCheck;
  if (["invoice", "draft", "open"].includes(normalized)) return FileText;
  if (["verified", "reconciled", "approved"].includes(normalized)) return ShieldCheck;
  if (["processing", "pending", "pending_payment", "received"].includes(normalized)) {
    return Clock3;
  }
  if (["refunded", "returned"].includes(normalized)) return RefreshCcw;
  if (["void", "voided", "cancelled", "canceled"].includes(normalized)) return Ban;

  if (tone === "success") return CheckCircle2;
  if (tone === "warning") return AlertTriangle;
  if (tone === "danger") return XCircle;

  return Circle;
}

export default function FinanceStatusBadge({
  status,
  label,
  size = "sm",
  showIcon = true,
  className = "",
  title,
}) {
  const display = label || prettyStatus(status);
  const tone = statusTone(status);
  const Icon = statusIcon(status, tone);

  return (
    <span
      className={[
        "finance-status-badge",
        tone,
        `finance-status-${tone}`,
        `finance-status-${size}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={title || display}
    >
      {showIcon ? <Icon size={13} aria-hidden="true" /> : null}
      <span>{display}</span>
    </span>
  );
}