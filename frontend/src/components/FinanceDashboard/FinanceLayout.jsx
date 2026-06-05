// src/components/FinanceDashboard/FinanceLayout.jsx

import React from "react";
import DashboardLayout from "../Shared/DashboardLayout";
import "../../styles/finance-enterprise.css";

export default function FinanceLayout() {
  const nav = [
    {
      to: "/dash/finance/overview",
      fullPath: "/dash/finance/overview",
      label: "Overview",
      icon: "📊",
    },
    {
      to: "/dash/finance/members",
      fullPath: "/dash/finance/members",
      label: "Members",
      icon: "👥",
    },
    {
      to: "/dash/finance/member-ledger",
      fullPath: "/dash/finance/member-ledger",
      label: "Member Ledger",
      icon: "📘",
    },
    {
      to: "/dash/finance/payments",
      fullPath: "/dash/finance/payments",
      label: "Payments",
      icon: "💳",
    },
    {
      to: "/dash/finance/Manual-Collection",
      fullPath: "/dash/finance/Manual-Collection",
      label: "Manual Collection",
      icon: "🧮",
    },
    {
      to: "/dash/finance/invoices",
      fullPath: "/dash/finance/invoices",
      label: "Invoices",
      icon: "🧾",
    },
    {
      to: "/dash/finance/receipts",
      fullPath: "/dash/finance/receipts",
      label: "Receipts",
      icon: "📄",
    },
    {
      to: "/dash/finance/expenses",
      fullPath: "/dash/finance/expenses",
      label: "Expenses",
      icon: "💸",
    },
    {
      to: "/dash/finance/dues-plans",
      fullPath: "/dash/finance/dues-plans",
      label: "Dues Plans",
      icon: "📋",
    },
    {
      to: "/dash/finance/reports",
      fullPath: "/dash/finance/reports",
      label: "Reports",
      icon: "📈",
    },
   
    {
      to: "/dash/finance/settings",
      fullPath: "/dash/finance/settings",
      label: "Settings",
      icon: "⚙️",
    }
   
  ];

  return (
    <DashboardLayout
      variant="finance"
      appName="Holy Trinity EOTC"
      roleTitle="Finance"
      nav={nav}
    />
  );

}
