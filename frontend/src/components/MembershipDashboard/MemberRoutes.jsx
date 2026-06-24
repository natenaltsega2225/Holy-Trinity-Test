// frontend/src/components/MembershipDashboard/MemberRoutes.jsx

import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import MemberLayout from "./MemberLayout";

import DashboardHome from "./pages/DashboardHome";
import Documents from "./pages/Documents";
import Donations from "./pages/Donations";
import FamilyDependents from "./pages/FamilyDependents";
// import GivingStatements from "./pages/GivingStatements";
import InvoicesReceipts from "./pages/InvoicesReceipts";
import MembershipRenewal from "./pages/MembershipRenewal";
// import MyLedger from "./pages/MyLedger";
import MyMembershipCoverage from "./pages/MyMembershipCoverage";
import MyPayments from "./pages/MyPayments";
import MyRequests from "./pages/MyRequests";

function MemberProfileFallback() {
  return <DashboardHome />;
}

export default function MemberRoutes() {
  return (
    <Routes>
      <Route element={<MemberLayout />}>
        <Route index element={<Navigate to="overview" replace />} />

        <Route path="overview" element={<DashboardHome />} />

        <Route path="my-payments">
          <Route index element={<Navigate to="make-payment" replace />} />
          <Route path="make-payment" element={<MyPayments />} />
        </Route>

        <Route path="payments" element={<MyPayments />} />
        <Route path="make-payment" element={<MyPayments />} />

        <Route path="membership-coverage" element={<MyMembershipCoverage />} />
        <Route path="coverage" element={<MyMembershipCoverage />} />

        <Route path="membership-renewal" element={<MembershipRenewal />} />
        <Route path="renewal" element={<MembershipRenewal />} />
        <Route path="auto-pay" element={<MembershipRenewal />} />
        <Route path="subscription" element={<MembershipRenewal />} />

        <Route path="donations" element={<Donations />} />
        <Route path="donate" element={<Donations />} />

        {/* <Route path="giving-statements" element={<GivingStatements />} />
        <Route path="statements" element={<GivingStatements />} /> */}

        {/* <Route path="my-ledger" element={<MyLedger />} />
        <Route path="ledger" element={<MyLedger />} /> */}

        <Route path="invoices-receipts" element={<InvoicesReceipts />} />
        <Route path="invoices" element={<InvoicesReceipts />} />
        <Route path="receipts" element={<InvoicesReceipts />} />

        <Route path="family" element={<FamilyDependents />} />
        <Route path="family-dependents" element={<FamilyDependents />} />

        <Route path="documents" element={<Documents />} />

        <Route path="myrequests" element={<MyRequests />} />
        <Route path="my-requests" element={<MyRequests />} />
        <Route path="requests" element={<MyRequests />} />

        <Route path="my-profile" element={<MemberProfileFallback />} />
        <Route path="profile" element={<MemberProfileFallback />} />

        <Route path="*" element={<Navigate to="overview" replace />} />
      </Route>
    </Routes>
  );
}