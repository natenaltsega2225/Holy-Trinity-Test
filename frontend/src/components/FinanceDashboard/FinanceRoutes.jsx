import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import FinanceLayout from "./FinanceLayout";
import DashboardProfile from "../../pages/DashboardProfile";
import ReceiptViewPage from "../../pages/ReceiptViewPage";

import Overview from "./pages/Overview";
import MemberManagement from "./pages/MemberManagement";
import FinanceMemberProfile from "./pages/FinanceMemberProfile";
import FinanceLedger from "./pages/FinanceLedger";
import FinancePayments from "./pages/FinancePayments";
import ManualCollection from "./pages/ManualCollection";
import CashEntries from "./pages/CashEntries";
import SundayCollections from "./pages/SundayCollections";
import FinanceInvoices from "./pages/FinanceInvoices";
import InvoiceGenerator from "./pages/InvoiceGenerator";
import FinanceReceipts from "./pages/FinanceReceipts";
import Checks from "./pages/Checks";
import CheckManagement from "./pages/CheckManagement";
import ZelleEntries from "./pages/ZelleEntries";
import ExpenseTracking from "./pages/ExpenseTracking";
import DuesPlans from "./pages/DuesPlans";
import FinanceReports from "./pages/FinanceReports";
import FinanceAuditLogs from "./pages/FinanceAuditLogs";
import FinanceNotifications from "./pages/FinanceNotifications";
import FinanceSettings from "./pages/FinanceSettings";

export default function FinanceRoutes() {
  return (
    <Routes>
      <Route element={<FinanceLayout />}>
        <Route index element={<Navigate to="overview" replace />} />

        <Route path="overview" element={<Overview />} />

        <Route path="members" element={<MemberManagement />} />
        <Route path="members/:id" element={<FinanceMemberProfile />} />
        <Route path="members/:id/:tab" element={<FinanceMemberProfile />} />

        <Route path="profile" element={<DashboardProfile />} />

        <Route path="member-ledger" element={<FinanceLedger />} />
        <Route path="payments" element={<FinancePayments />} />

        <Route path="manual-collection" element={<ManualCollection />} />
        <Route path="Manual-Collection" element={<Navigate to="/dash/finance/manual-collection" replace />} />
        <Route path="manual-collection/cash" element={<CashEntries />} />
        <Route path="manual-collection/zelle" element={<ZelleEntries />} />
        <Route path="manual-collection/checks" element={<Checks />} />
        <Route path="manual-collection/sunday-collections" element={<SundayCollections />} />

        <Route path="cash" element={<Navigate to="/dash/finance/manual-collection/cash" replace />} />
        <Route path="zelle" element={<Navigate to="/dash/finance/manual-collection/zelle" replace />} />
        <Route path="checks" element={<Navigate to="/dash/finance/manual-collection/checks" replace />} />
        <Route path="sunday-collections" element={<Navigate to="/dash/finance/manual-collection/sunday-collections" replace />} />

        <Route path="invoices" element={<FinanceInvoices />} />
        <Route path="invoice-generator" element={<InvoiceGenerator />} />

        <Route path="receipts" element={<FinanceReceipts />} />
        <Route path="receipts/:receiptNo" element={<ReceiptViewPage />} />

        <Route path="check-management" element={<CheckManagement />} />
        <Route path="expenses" element={<ExpenseTracking />} />
        <Route path="dues-plans" element={<DuesPlans />} />
        <Route path="reports" element={<FinanceReports />} />
        <Route path="audit-logs" element={<FinanceAuditLogs />} />
        <Route path="notifications" element={<FinanceNotifications />} />
        <Route path="settings" element={<FinanceSettings />} />

        <Route path="*" element={<Navigate to="/dash/finance/overview" replace />} />
      </Route>
    </Routes>
  );
}