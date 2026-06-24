import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import FinanceLayout from "./FinanceLayout";

const DashboardProfile = lazy(() => import("../../pages/DashboardProfile"));
const ReceiptViewPage = lazy(() => import("../../pages/ReceiptViewPage"));

const FinanceRegistration = lazy(() => import("./pages/FinanceRegistration"));
const Overview = lazy(() => import("./pages/Overview"));
const MemberManagement = lazy(() => import("./pages/MemberManagement"));
const FinanceMemberProfile = lazy(() => import("./pages/FinanceMemberProfile"));
const FinanceLedger = lazy(() => import("./pages/FinanceLedger"));
const FinancePayments = lazy(() => import("./pages/FinancePayments"));
const ManualCollection = lazy(() => import("./pages/ManualCollection"));
const CashEntries = lazy(() => import("./pages/CashEntries"));
const SundayCollections = lazy(() => import("./pages/SundayCollections"));
const FinanceInvoices = lazy(() => import("./pages/FinanceInvoices"));
const InvoiceGenerator = lazy(() => import("./pages/InvoiceGenerator"));
const FinanceReceipts = lazy(() => import("./pages/FinanceReceipts"));
const Checks = lazy(() => import("./pages/Checks"));
const CheckManagement = lazy(() => import("./pages/CheckManagement"));
const ZelleEntries = lazy(() => import("./pages/ZelleEntries"));
const ExpenseTracking = lazy(() => import("./pages/ExpenseTracking"));
const DuesPlans = lazy(() => import("./pages/DuesPlans"));
const FinanceReports = lazy(() => import("./pages/FinanceReports"));
const FinanceAuditLogs = lazy(() => import("./pages/FinanceAuditLogs"));
const FinanceNotifications = lazy(() => import("./pages/FinanceNotifications"));
const FinanceSettings = lazy(() => import("./pages/FinanceSettings"));

function FinanceRouteFallback() {
  return (
    <div className="finance-page-shell">
      <div className="finance-panel">
        <strong>Loading finance module...</strong>
      </div>
    </div>
  );
}

class FinanceRouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Finance module failed to load.",
    };
  }

  componentDidCatch(error, info) {
    console.error("Finance route render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="finance-page-shell">
          <div className="finance-alert finance-alert-danger">
            <strong>Finance page failed to load.</strong>
            <span>{this.state.message}</span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Page({ children }) {
  return (
    <FinanceRouteErrorBoundary>
      <Suspense fallback={<FinanceRouteFallback />}>{children}</Suspense>
    </FinanceRouteErrorBoundary>
  );
}

export default function FinanceRoutes() {
  return (
    <Routes>
      <Route element={<FinanceLayout />}>
        <Route index element={<Navigate to="overview" replace />} />

        <Route path="overview" element={<Page><Overview /></Page>} />
        <Route path="registration" element={<Page><FinanceRegistration /></Page>} />

        <Route path="members" element={<Page><MemberManagement /></Page>} />
        <Route path="members/:id" element={<Page><FinanceMemberProfile /></Page>} />
        <Route path="members/:id/:tab" element={<Page><FinanceMemberProfile /></Page>} />

        <Route path="profile" element={<Page><DashboardProfile /></Page>} />

        <Route path="member-ledger" element={<Page><FinanceLedger /></Page>} />
        <Route path="payments" element={<Page><FinancePayments /></Page>} />

        <Route path="manual-collection" element={<Page><ManualCollection /></Page>} />
        <Route path="Manual-Collection" element={<Navigate to="/dash/finance/manual-collection" replace />} />
        <Route path="manual-collection/cash" element={<Page><CashEntries /></Page>} />
        <Route path="manual-collection/zelle" element={<Page><ZelleEntries /></Page>} />
        <Route path="manual-collection/checks" element={<Page><Checks /></Page>} />
        <Route path="manual-collection/sunday-collections" element={<Page><SundayCollections /></Page>} />

        <Route path="cash" element={<Navigate to="/dash/finance/manual-collection/cash" replace />} />
        <Route path="zelle" element={<Navigate to="/dash/finance/manual-collection/zelle" replace />} />
        <Route path="checks" element={<Navigate to="/dash/finance/manual-collection/checks" replace />} />
        <Route path="sunday-collections" element={<Navigate to="/dash/finance/manual-collection/sunday-collections" replace />} />

        <Route path="invoices" element={<Page><FinanceInvoices /></Page>} />
        <Route path="invoice-generator" element={<Page><InvoiceGenerator /></Page>} />

        <Route path="receipts" element={<Page><FinanceReceipts /></Page>} />
        <Route path="receipts/:receiptNo" element={<Page><ReceiptViewPage /></Page>} />

        <Route path="check-management" element={<Page><CheckManagement /></Page>} />
        <Route path="expenses" element={<Page><ExpenseTracking /></Page>} />
        <Route path="dues-plans" element={<Page><DuesPlans /></Page>} />
        <Route path="reports" element={<Page><FinanceReports /></Page>} />
        <Route path="audit-logs" element={<Page><FinanceAuditLogs /></Page>} />
        <Route path="notifications" element={<Page><FinanceNotifications /></Page>} />
        <Route path="settings" element={<Page><FinanceSettings /></Page>} />

        <Route path="*" element={<Navigate to="/dash/finance/overview" replace />} />
      </Route>
    </Routes>
  );
}