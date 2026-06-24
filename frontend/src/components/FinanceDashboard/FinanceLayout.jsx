//frontend\src\components\FinanceDashboard\FinanceLayout.jsx
import React from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Calculator,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";

import DashboardLayout from "../Shared/DashboardLayout";
import "../../styles/finance-enterprise.css";

function navIcon(Icon) {
  return <Icon size={18} strokeWidth={2.1} aria-hidden="true" />;
}

export default function FinanceLayout() {
  const nav = [
    {
      to: "/dash/finance/overview",
      fullPath: "/dash/finance/overview",
      label: "Overview",
      icon: navIcon(LayoutDashboard),
    },
    {
      to: "/dash/finance/registration",
      fullPath: "/dash/finance/registration",
      label: "Registration",
      icon: navIcon(UserPlus),
    },
    {
      to: "/dash/finance/members",
      fullPath: "/dash/finance/members",
      label: "Members",
      icon: navIcon(Users),
    },
    {
      to: "/dash/finance/member-ledger",
      fullPath: "/dash/finance/member-ledger",
      label: "Member Ledger",
      icon: navIcon(BookOpen),
    },
    {
      to: "/dash/finance/payments",
      fullPath: "/dash/finance/payments",
      label: "Payments",
      icon: navIcon(CreditCard),
    },
    {
      to: "/dash/finance/manual-collection",
      fullPath: "/dash/finance/manual-collection",
      label: "Manual Collection",
      icon: navIcon(Calculator),
    },
    {
      to: "/dash/finance/invoices",
      fullPath: "/dash/finance/invoices",
      label: "Invoices",
      icon: navIcon(ReceiptText),
    },
    {
      to: "/dash/finance/receipts",
      fullPath: "/dash/finance/receipts",
      label: "Receipts",
      icon: navIcon(FileText),
    },
    {
      to: "/dash/finance/expenses",
      fullPath: "/dash/finance/expenses",
      label: "Expenses",
      icon: navIcon(WalletCards),
    },
    {
      to: "/dash/finance/dues-plans",
      fullPath: "/dash/finance/dues-plans",
      label: "Dues Plans",
      icon: navIcon(ClipboardList),
    },
    {
      to: "/dash/finance/reports",
      fullPath: "/dash/finance/reports",
      label: "Reports",
      icon: navIcon(BarChart3),
    },
    {
      to: "/dash/finance/audit-logs",
      fullPath: "/dash/finance/audit-logs",
      label: "Audit Logs",
      icon: navIcon(ShieldCheck),
    },
    {
      to: "/dash/finance/notifications",
      fullPath: "/dash/finance/notifications",
      label: "Notifications",
      icon: navIcon(Bell),
    },
    {
      to: "/dash/finance/settings",
      fullPath: "/dash/finance/settings",
      label: "Settings",
      icon: navIcon(Settings),
    },
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