// frontend/src/components/MembershipDashboard/components/BillingOverviewLayout.jsx

import React from "react";

import BillingKPISection
from "./BillingKPISection";

import CoverageStatusCard
from "./CoverageStatusCard";

import RecentReceiptsCard
from "./RecentReceiptsCard";

import QuickActionsCard
from "./QuickActionsCard";

import UpcomingPaymentsCard
from "./UpcomingPaymentsCard";

// import "../membership-dashboard.css";

/* =========================================================
   COMPONENT
========================================================= */

export default function BillingOverviewLayout({

  payments = [],

  invoices = [],

  coverageRows = [],

  receiptRows = [],

  unpaidMonths = [],

  upcomingPrograms = [],

  activePlan = "--",

  onDownloadReceipt,

  onGoTab,

  onContactFinance,
}) {

  return (

    <div className="billing-overview-layout">

      {/* =====================================
          KPI SECTION
      ===================================== */}

      <BillingKPISection
        payments={payments}
        invoices={invoices}
        coverageRows={coverageRows}
        activePlan={activePlan}
      />

      {/* =====================================
          MAIN GRID
      ===================================== */}

      <div className="billing-overview-grid">

        {/* ===============================
            LEFT
        =============================== */}

        <div className="billing-overview-left">

          {/* COVERAGE */}

          <CoverageStatusCard
            rows={coverageRows}
          />

          {/* ALERTS */}

          <UpcomingPaymentsCard
            pendingInvoices={invoices.filter(
              (i) =>
                String(
                  i.status || ""
                ).toLowerCase() !==
                "paid"
            )}
            unpaidMonths={
              unpaidMonths
            }
            upcomingPrograms={
              upcomingPrograms
            }
            onPayNow={() =>
              onGoTab?.(
                "make-payment"
              )
            }
          />

        </div>

        {/* ===============================
            RIGHT
        =============================== */}

        <div className="billing-overview-right">

          {/* RECEIPTS */}

          <RecentReceiptsCard
            receipts={receiptRows}
            onDownload={
              onDownloadReceipt
            }
          />

          {/* QUICK ACTIONS */}

          <QuickActionsCard
            onMakePayment={() =>
              onGoTab?.(
                "make-payment"
              )
            }
            onRenewMembership={() =>
              onGoTab?.(
                "renewal"
              )
            }
            onDownloadStatement={() =>
              onGoTab?.(
                "giving"
              )
            }
            onViewReceipts={() =>
              onGoTab?.(
                "invoices"
              )
            }
            onViewLedger={() =>
              onGoTab?.(
                "ledger"
              )
            }
            onContactFinance={
              onContactFinance
            }
            onPrintBilling={() =>
              window.print()
            }
          />

        </div>

      </div>

    </div>
  );
}