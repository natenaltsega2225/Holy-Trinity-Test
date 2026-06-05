//frontend\src\components\FinanceDashboard\components\FinanceManualEntriesTabs.jsx
import React from "react";
import { NavLink } from "react-router-dom";


const tabs = [
  {
    to: "/dash/finance/manual-entries",
    label: "Manual Entries",
    desc: "All manual entry sources",
    end: true,
  },
  {
    to: "/dash/finance/manual-entries/cash",
    label: "Cash Collection",
    desc: "Individual and grouped cash",
  },
  {
    to: "/dash/finance/manual-entries/zelle",
    label: "Zelle Entries",
    desc: "Verified Zelle records",
  },
  {
    to: "/dash/finance/manual-entries/checks",
    label: "Check Entries",
    desc: "Check tracking and status",
  },
  {
    to: "/dash/finance/manual-entries/sunday-collections",
    label: "Sunday Collections",
    desc: "Weekly church collection totals",
  },
];

export default function FinanceManualEntriesTabs() {
  return (
    <div className="finance-manual-tabs">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `finance-manual-tab ${isActive ? "active" : ""}`
          }
        >
          <span className="finance-manual-tab-title">{tab.label}</span>
          <span className="finance-manual-tab-desc">{tab.desc}</span>
        </NavLink>
      ))}
    </div>
  );
}