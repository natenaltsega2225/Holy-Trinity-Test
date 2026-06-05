// frontend/src/components/FinanceDashboard/components/FinanceLedgerSummaryCards.jsx

import React from "react";

import {
  Landmark,
  ArrowDownCircle,
  ArrowUpCircle,
  Scale,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

import "../../../styles/shared-payment-components.css";
// import "../finance-dashboard.css";

function money(value) {

  return Number(
    value || 0
  ).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  );
}

function Card({
  icon,
  label,
  value,
  sub,
  variant = "default",
}) {

  return (
    <div
      className={`finance-summary-card finance-summary-card-${variant}`}
    >

      <div className="finance-summary-card-top">

        <div className="finance-summary-icon">
          {icon}
        </div>

        <span>
          {label}
        </span>

      </div>

      <strong>
        {value}
      </strong>

      {sub && (
        <small>
          {sub}
        </small>
      )}

    </div>
  );
}

export default function FinanceLedgerSummaryCards({
  rows = [],
  stats = {},
}) {

  const totalEntries =
    Number(
      stats.total_entries ||
      rows.length ||
      0
    );

  const totalCredits =
    Number(
      stats.total_credits ||
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          Number(
            row.credit_amount || 0
          ),
        0
      )
    );

  const totalDebits =
    Number(
      stats.total_debits ||
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          Number(
            row.debit_amount || 0
          ),
        0
      )
    );

  const netBalance =
    Number(
      stats.net_balance ||
      totalCredits -
        totalDebits
    );

  const matched =
    Number(
      stats.matched_entries ||
      rows.filter(
        (r) =>
          String(
            r.reconciliation_status || ""
          ).toLowerCase() ===
          "matched"
      ).length
    );

  const unmatched =
    Number(
      stats.unmatched_entries ||
      rows.filter(
        (r) =>
          String(
            r.reconciliation_status || ""
          ).toLowerCase() !==
          "matched"
      ).length
    );

  const reversed =
    Number(
      stats.reversed_entries ||
      rows.filter(
        (r) =>
          String(
            r.status ||
            r.ledger_status ||
            ""
          ).toLowerCase() ===
          "reversed"
      ).length
    );

  return (
    <div className="finance-summary-grid">

      <Card
        icon={
          <Landmark size={18} />
        }
        label="Ledger Entries"
        value={totalEntries}
        sub="Accounting records"
        variant="primary"
      />

      <Card
        icon={
          <ArrowUpCircle
            size={18}
          />
        }
        label="Credits"
        value={money(
          totalCredits
        )}
        sub="Incoming value"
        variant="success"
      />

      <Card
        icon={
          <ArrowDownCircle
            size={18}
          />
        }
        label="Debits"
        value={money(
          totalDebits
        )}
        sub="Outgoing value"
        variant="warning"
      />

      <Card
        icon={
          <Scale size={18} />
        }
        label="Net Balance"
        value={money(
          netBalance
        )}
        sub="Credits - Debits"
        variant="primary"
      />

      <Card
        icon={
          <CheckCircle2
            size={18}
          />
        }
        label="Matched"
        value={matched}
        sub="Reconciled entries"
        variant="success"
      />

      <Card
        icon={
          <AlertTriangle
            size={18}
          />
        }
        label="Unmatched"
        value={unmatched}
        sub="Pending reconciliation"
        variant="warning"
      />

      <Card
        icon={
          <RotateCcw
            size={18}
          />
        }
        label="Reversed"
        value={reversed}
        sub="Reversal entries"
        variant="danger"
      />

    </div>
  );
}