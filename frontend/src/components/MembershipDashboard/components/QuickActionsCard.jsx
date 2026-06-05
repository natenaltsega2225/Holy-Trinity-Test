// frontend/src/components/MembershipDashboard/components/QuickActionsCard.jsx

import React from "react";

import {
  CreditCard,
  RefreshCw,
  FileText,
  Receipt,
  BookOpen,
  Phone,
  Printer,
} from "lucide-react";

// import "../membership-dashboard.css";

/* =========================================================
   COMPONENT
========================================================= */

export default function QuickActionsCard({

  onMakePayment,

  onRenewMembership,

  onDownloadStatement,

  onViewReceipts,

  onViewLedger,

  onContactFinance,

  onPrintBilling,
}) {

  const actions = [

    {
      label:
        "Make Payment",

      icon: CreditCard,

      action:
        onMakePayment,
    },

    {
      label:
        "Renew Membership",

      icon: RefreshCw,

      action:
        onRenewMembership,
    },

    {
      label:
        "Download Statement",

      icon: FileText,

      action:
        onDownloadStatement,
    },

    {
      label:
        "View Receipts",

      icon: Receipt,

      action:
        onViewReceipts,
    },

    {
      label:
        "View Ledger",

      icon: BookOpen,

      action:
        onViewLedger,
    },

    {
      label:
        "Contact Finance",

      icon: Phone,

      action:
        onContactFinance,
    },

    {
      label:
        "Print Billing",

      icon: Printer,

      action:
        onPrintBilling,
    },
  ];

  return (

    <div className="quick-actions-card">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="quick-actions-head">

        <div>

          <span className="quick-actions-label">
            Billing
          </span>

          <h3 className="quick-actions-title">

            Quick Actions

          </h3>

        </div>

      </div>

      {/* =====================================
          GRID
      ===================================== */}

      <div className="quick-actions-grid">

        {actions.map(
          (item) => {

            const Icon =
              item.icon;

            return (

              <button
                key={item.label}
                type="button"
                className="quick-action-btn"
                onClick={() =>
                  item.action?.()
                }
              >

                <div className="quick-action-icon">

                  <Icon size={18} />

                </div>

                <span>

                  {item.label}

                </span>

              </button>
            );
          }
        )}

      </div>

    </div>
  );
}