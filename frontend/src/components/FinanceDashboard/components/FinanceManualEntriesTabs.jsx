import React from "react";
import { NavLink } from "react-router-dom";
import {
  Banknote,
  CalendarDays,
  FileCheck2,
  Landmark,
  ListChecks,
  Send,
} from "lucide-react";

const tabs = [
  {
    to: "/dash/finance/manual-collection",
    label: "All Entries",
    desc: "Manual finance sources",
    icon: ListChecks,
    end: true,
  },
  {
    to: "/dash/finance/manual-collection/cash",
    label: "Cash",
    desc: "Individual and grouped cash",
    icon: Banknote,
  },
  {
    to: "/dash/finance/manual-collection/zelle",
    label: "Zelle",
    desc: "Verified transfer records",
    icon: Send,
  },
  {
    to: "/dash/finance/manual-collection/checks",
    label: "Checks",
    desc: "Deposit and clearance status",
    icon: FileCheck2,
  },
  {
    to: "/dash/finance/manual-collection/sunday-collections",
    label: "Sunday Collections",
    desc: "Weekly service totals",
    icon: CalendarDays,
  },
];

export default function FinanceManualEntriesTabs() {
  return (
    <nav
      className="finance-manual-tabs"
      aria-label="Manual finance entry sections"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon || Landmark;

        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `finance-manual-tab${isActive ? " active" : ""}`
            }
          >
            <span className="finance-manual-tab-icon" aria-hidden="true">
              <Icon size={18} strokeWidth={2.1} />
            </span>

            <span className="finance-manual-tab-copy">
              <span className="finance-manual-tab-title">{tab.label}</span>
              <span className="finance-manual-tab-desc">{tab.desc}</span>
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}