// frontend/src/components/MembershipDashboard/MemberLayout.jsx

import React from "react";
import {
  BookOpen,
  ClipboardList,
  CreditCard,
  FileText,
  FolderOpen,
  HeartHandshake,
  Home,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import DashboardLayout from "../Shared/DashboardLayout";
import "../../styles/member-dashboard.css";

function navIcon(Icon) {
  return <Icon size={18} strokeWidth={2.1} aria-hidden="true" />;
}

export default function MemberLayout() {
  const nav = [
    {
      to: "/dash/membership/overview",
      fullPath: "/dash/membership/overview",
      label: "Overview",
      icon: navIcon(Home),
    },
    {
      to: "/dash/membership/my-payments/make-payment",
      fullPath: "/dash/membership/my-payments",
      label: "My Payments",
      icon: navIcon(CreditCard),
    },
    {
      to: "/dash/membership/donations",
      fullPath: "/dash/membership/donations",
      label: "Donations",
      icon: navIcon(HeartHandshake),
    },
    {
      to: "/dash/membership/membership-coverage",
      fullPath: "/dash/membership/membership-coverage",
      label: "Membership Coverage",
      icon: navIcon(ShieldCheck),
    },
    {
      to: "/dash/membership/membership-renewal",
      fullPath: "/dash/membership/membership-renewal",
      label: "Renewal / Auto Pay",
      icon: navIcon(RefreshCcw),
    },
    // {
    //   to: "/dash/membership/my-ledger",
    //   fullPath: "/dash/membership/my-ledger",
    //   label: "My Ledger",
    //   icon: navIcon(BookOpen),
    // },
    {
      to: "/dash/membership/invoices-receipts",
      fullPath: "/dash/membership/invoices-receipts",
      label: "Invoices & Receipts",
      icon: navIcon(ReceiptText),
    },
    // {
    //   to: "/dash/membership/giving-statements",
    //   fullPath: "/dash/membership/giving-statements",
    //   label: "Giving Statements",
    //   icon: navIcon(FileText),
    // },
    {
      to: "/dash/membership/family",
      fullPath: "/dash/membership/family",
      label: "Family / Dependents",
      icon: navIcon(Users),
    },
    {
      to: "/dash/membership/documents",
      fullPath: "/dash/membership/documents",
      label: "Documents",
      icon: navIcon(FolderOpen),
    },
    {
      to: "/dash/membership/myrequests",
      fullPath: "/dash/membership/myrequests",
      label: "My Requests",
      icon: navIcon(ClipboardList),
    },
    {
      to: "/dash/membership/my-profile",
      fullPath: "/dash/membership/my-profile",
      label: "My Profile",
      icon: navIcon(UserRound),
    },
  ];

  return (
    <DashboardLayout
      variant="member"
      appName="Holy Trinity EOTC"
      roleTitle="Member"
      nav={nav}
    />
  );
}