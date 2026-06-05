//frontend\src\components\ReconciliationDashboard\ReconciliationLayout.jsx
import React from "react";
import DashboardLayout from "../Shared/DashboardLayout";
import "../../styles/Reconciliation-dashboard.css";

export default function ReconciliationLayout() {
  const nav = [
    {
      to: "/dash/reconciliation/overview",
      fullPath: "/dash/reconciliation/overview",
      label: "Overview",
      icon: "📊",
    },
    {
      to: "/dash/reconciliation/bank-match",
      fullPath: "/dash/reconciliation/bank-match",
      label: "Bank Match",
      icon: "🏦",
    },
    {
      to: "/dash/reconciliation/stripe-match",
      fullPath: "/dash/reconciliation/stripe-match",
      label: "Stripe Match",
      icon: "💳",
    },
    {
      to: "/dash/reconciliation/zelle-match",
      fullPath: "/dash/reconciliation/zelle-match",
      label: "Zelle Match",
      icon: "💠",
    },
    {
      to: "/dash/reconciliation/cash-match",
      fullPath: "/dash/reconciliation/cash-match",
      label: "Cash Match",
      icon: "💵",
    },
    {
      to: "/dash/reconciliation/donations-match",
      fullPath: "/dash/reconciliation/donations-match",
      label: "Donations Match",
      icon: "🎁",
    },
    {
      to: "/dash/reconciliation/invoice-match",
      fullPath: "/dash/reconciliation/invoice-match",
      label: "Invoice Match",
      icon: "🧾",
    },
    {
      to: "/dash/reconciliation/ledger-match",
      fullPath: "/dash/reconciliation/ledger-match",
      label: "Ledger Match",
      icon: "📘",
    },
    {
      to: "/dash/reconciliation/unmatched-items",
      fullPath: "/dash/reconciliation/unmatched-items",
      label: "Unmatched Items",
      icon: "❌",
    },
    {
      to: "/dash/reconciliation/discrepancies",
      fullPath: "/dash/reconciliation/discrepancies",
      label: "Discrepancies",
      icon: "⚠️",
    },
    {
      to: "/dash/reconciliation/adjustments",
      fullPath: "/dash/reconciliation/adjustments",
      label: "Adjustments",
      icon: "🛠️",
    },
    {
      to: "/dash/reconciliation/reports",
      fullPath: "/dash/reconciliation/reports",
      label: "Reports",
      icon: "📈",
    },
    {
      to: "/dash/reconciliation/period-close",
      fullPath: "/dash/reconciliation/period-close",
      label: "Period Close",
      icon: "🔒",
    },
     {
      to: "/dash/reconciliation/Auditlog",
      fullPath: "/dash/reconciliation/Auditlog",
      label: "Auditlo",
      icon: "⚙️",
    },
    {
      to: "/dash/reconciliation/settings",
      fullPath: "/dash/reconciliation/settings",
      label: "Settings",
      icon: "⚙️",
    },
  ];

  return (
    <DashboardLayout
      variant="Reconciliation"
      appName="Holy Trinity EOTC"
      roleTitle="Reconciliation"
      nav={nav}
    />
  );
}
