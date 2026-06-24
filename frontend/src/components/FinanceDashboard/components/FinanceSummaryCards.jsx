// frontend/src/components/FinanceDashboard/components/FinanceSummaryCards.jsx

import React from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";

import "../../../styles/finance-enterprise.css";

function clean(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatFinanceMoney(value) {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function formatFinanceNumber(value) {
  return numberValue(value).toLocaleString("en-US");
}

function pretty(value) {
  const text = clean(value);
  if (!text) return "--";

  return text
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function defaultIconForKey(key = "", tone = "") {
  const value = clean(key).toLowerCase();

  if (value.includes("member") || value.includes("donor")) return Users;
  if (value.includes("invoice")) return FileText;
  if (value.includes("receipt")) return Receipt;
  if (value.includes("pending") || value.includes("open")) return Clock3;
  if (value.includes("failed") || value.includes("overdue")) return AlertTriangle;
  if (value.includes("paid") || value.includes("success")) return CheckCircle2;
  if (value.includes("revenue") || value.includes("amount") || value.includes("total")) {
    return CircleDollarSign;
  }

  if (tone === "success") return CheckCircle2;
  if (tone === "warning") return Clock3;
  if (tone === "danger") return AlertTriangle;

  return BarChart3;
}

function toneForCard(card = {}) {
  const tone = clean(card.tone).toLowerCase();

  if (["success", "warning", "danger", "info", "neutral"].includes(tone)) {
    return tone;
  }

  const key = clean(card.key || card.label || card.title).toLowerCase();

  if (key.includes("failed") || key.includes("overdue") || key.includes("unpaid")) {
    return "danger";
  }

  if (key.includes("pending") || key.includes("open") || key.includes("partial")) {
    return "warning";
  }

  if (key.includes("paid") || key.includes("complete") || key.includes("success")) {
    return "success";
  }

  return "neutral";
}

function valueForCard(card = {}) {
  const value = card.value ?? card.amount ?? card.count ?? 0;

  if (card.money || card.type === "money" || card.format === "money") {
    return formatFinanceMoney(value);
  }

  if (card.percent || card.type === "percent" || card.format === "percent") {
    return `${numberValue(value).toFixed(card.decimals ?? 0)}%`;
  }

  if (card.number || card.type === "number" || card.format === "number") {
    return formatFinanceNumber(value);
  }

  return clean(value) || "0";
}

function Trend({ card }) {
  const raw = card.trend ?? card.delta ?? card.change;
  const value = Number(raw);

  if (!Number.isFinite(value) || value === 0) {
    return card.trendLabel || card.deltaLabel ? (
      <span className="finance-card-trend neutral">
        {card.trendLabel || card.deltaLabel}
      </span>
    ) : null;
  }

  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={`finance-card-trend ${up ? "up" : "down"}`}>
      <Icon size={14} />
      {Math.abs(value).toFixed(card.trendDecimals ?? 0)}%
    </span>
  );
}

function FinanceSummaryCard({ card = {}, compact = false }) {
  const tone = toneForCard(card);
  const Icon = card.icon || defaultIconForKey(card.key || card.title || card.label, tone);

  return (
    <article
      className={[
        "finance-summary-card",
        `finance-summary-${tone}`,
        compact ? "compact" : "",
        card.className || "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="finance-summary-card-top">
        <span>{card.label || card.title || pretty(card.key)}</span>

        <div className="finance-summary-icon">
          <Icon size={18} />
        </div>
      </div>

      <strong>{valueForCard(card)}</strong>

      <div className="finance-summary-card-foot">
        <small>{card.subtitle || card.description || card.helpText || "\u00A0"}</small>
        <Trend card={card} />
      </div>
    </article>
  );
}

export default function FinanceSummaryCards({
  cards = [],
  loading = false,
  columns = 5,
  compact = false,
  emptyText = "No summary data available.",
}) {
  if (loading) {
    return (
      <div
        className="finance-summary-grid"
        style={{ "--finance-summary-columns": columns }}
      >
        {Array.from({ length: Math.min(5, columns || 5) }).map((_, index) => (
          <article key={index} className="finance-summary-card loading">
            <div className="finance-skeleton-line short" />
            <div className="finance-skeleton-line large" />
            <div className="finance-skeleton-line" />
          </article>
        ))}
      </div>
    );
  }

  if (!Array.isArray(cards) || !cards.length) {
    return (
      <div className="finance-panel finance-empty-panel">
        <TrendingUp size={22} />
        <span>{emptyText}</span>
      </div>
    );
  }

  return (
    <div
      className="finance-summary-grid"
      style={{ "--finance-summary-columns": columns }}
    >
      {cards.map((card, index) => (
        <FinanceSummaryCard
          key={card.key || card.label || card.title || index}
          card={card}
          compact={compact}
        />
      ))}
    </div>
  );
}

export { FinanceSummaryCard };