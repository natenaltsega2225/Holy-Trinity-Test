// frontend/src/components/FinanceDashboard/components/FinancePaymentKPIs.jsx

import React, { useMemo } from "react";
import "../../../styles/finance-dashboard.css";

/* =========================================================
   HELPERS
========================================================= */

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function safeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isToday(value) {
  const d = safeDate(value);
  if (!d) return false;

  const today = new Date();

  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function isCurrentMonth(value) {
  const d = safeDate(value);
  if (!d) return false;

  const now = new Date();

  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth()
  );
}

function rowDate(row) {
  return row.payment_date || row.paid_at || row.created_at;
}

function rowMethod(row) {
  return String(row.method || row.payment_method || "").toLowerCase();
}

function rowCategory(row) {
  return String(row.category || row.payment_type || "").toLowerCase();
}

function isPaid(row) {
  const s = String(row.status || row.payment_status || "paid").toLowerCase();

  return ["paid", "completed", "succeeded", "success"].includes(s);
}

function sumRows(rows) {
  return rows.reduce((sum, row) => sum + Number(row.amount || row.total_amount || 0), 0);
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinancePaymentKPIs({
  rows = [],
  unpaidMembers = 0,
  pendingInvoices = 0,
}) {
  const paidRows = useMemo(() => rows.filter(isPaid), [rows]);

  const todayTotal = useMemo(() => {
    return sumRows(paidRows.filter((r) => isToday(rowDate(r))));
  }, [paidRows]);

  const monthTotal = useMemo(() => {
    return sumRows(paidRows.filter((r) => isCurrentMonth(rowDate(r))));
  }, [paidRows]);

  const membershipRevenue = useMemo(() => {
    return sumRows(paidRows.filter((r) => rowCategory(r) === "membership"));
  }, [paidRows]);

  const donationRevenue = useMemo(() => {
    return sumRows(paidRows.filter((r) => rowCategory(r) === "donation"));
  }, [paidRows]);

  const programRevenue = useMemo(() => {
    return sumRows(
      paidRows.filter((r) => ["school", "trip"].includes(rowCategory(r)))
    );
  }, [paidRows]);

  const cardRevenue = useMemo(() => {
    return sumRows(paidRows.filter((r) => rowMethod(r) === "card"));
  }, [paidRows]);

  const achRevenue = useMemo(() => {
    return sumRows(paidRows.filter((r) => rowMethod(r) === "ach"));
  }, [paidRows]);

  const zelleRevenue = useMemo(() => {
    return sumRows(paidRows.filter((r) => rowMethod(r) === "zelle"));
  }, [paidRows]);

  const cashRevenue = useMemo(() => {
    return sumRows(paidRows.filter((r) => rowMethod(r) === "cash"));
  }, [paidRows]);

  const checkRevenue = useMemo(() => {
    return sumRows(paidRows.filter((r) => rowMethod(r) === "check"));
  }, [paidRows]);

  const cards = [
    {
      label: "Today",
      value: money(todayTotal),
    },
    {
      label: "This Month",
      value: money(monthTotal),
    },
    {
      label: "Membership",
      value: money(membershipRevenue),
    },
    {
      label: "Donations",
      value: money(donationRevenue),
    },
    {
      label: "Programs",
      value: money(programRevenue),
    },
    {
      label: "Card",
      value: money(cardRevenue),
    },
    {
      label: "ACH",
      value: money(achRevenue),
    },
    {
      label: "Zelle",
      value: money(zelleRevenue),
    },
    {
      label: "Cash",
      value: money(cashRevenue),
    },
    {
      label: "Check",
      value: money(checkRevenue),
    },
    {
      label: "Pending Invoices",
      value: pendingInvoices,
    },
    {
      label: "Unpaid Members",
      value: unpaidMembers,
    },
  ];

  return (
    <div className="finance-kpi-grid">
      {cards.map((card) => (
        <div key={card.label} className="finance-kpi-card">
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </div>
      ))}
    </div>
  );
}