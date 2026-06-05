//frontend\src\components\ReconciliationDashboard\ReconciliationRoutes.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ReconciliationLayout from "./ReconciliationLayout";
import DashboardProfile from "../../pages/DashboardProfile";
import Overview from "./pages/Overview";
import BankMatch from "./pages/BankMatch";
import StripeMatch from "./pages/StripeMatch";
import ZelleMatch from "./pages/ZelleMatch";
import CashMatch from "./pages/CashMatch";
import DonationsMatch from "./pages/DonationsMatch";
import InvoiceMatch from "./pages/InvoiceMatch";
import LedgerMatch from "./pages/LedgerMatch";
import UnmatchedItems from "./pages/UnmatchedItems";
import Discrepancies from "./pages/Discrepancies";
import Adjustments from "./pages/Adjustments";
import Reports from "./pages/Reports";
import PeriodClose from "./pages/PeriodClose";
import Settings from "./pages/Settings";
import Auditlog from "./pages/Auditlog";
export default function ReconciliationRoutes() {
  return (
    <Routes>
      <Route element={<ReconciliationLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="bank-match" element={<BankMatch />} />
        <Route path="stripe-match" element={<StripeMatch />} />
        <Route path="zelle-match" element={<ZelleMatch />} />
        <Route path="cash-match" element={<CashMatch />} />
        <Route path="donations-match" element={<DonationsMatch />} />
        <Route path="invoice-match" element={<InvoiceMatch />} />
        <Route path="ledger-match" element={<LedgerMatch />} />
        <Route path="unmatched-items" element={<UnmatchedItems />} />
        <Route path="discrepancies" element={<Discrepancies />} />
        <Route path="adjustments" element={<Adjustments />} />
        <Route path="reports" element={<Reports />} />
        <Route path="period-close" element={<PeriodClose />} />
        <Route path="profile" element={<DashboardProfile />} />
          <Route path="Auditlog" element={<Auditlog />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Route>
    </Routes>
  );
}