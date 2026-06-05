// frontend/src/components/FinanceDashboard/pages/SundayCollections.jsx
import React, { useMemo, useState } from "react";
import FinanceTablePage from "../components/FinanceTablePage";
import FinanceManualEntriesTabs from "../components/FinanceManualEntriesTabs.jsx";

function fmtDate(value) {
  if (!value) return "--";
  const raw = String(value).trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US");
}

const columns = [
  { key: "service_date", label: "Service Date" },
  { key: "cash_total", label: "Cash", money: true },
  { key: "check_total", label: "Check", money: true },
  { key: "zelle_total", label: "Zelle", money: true },
  { key: "grand_total", label: "Grand Total", money: true },
  { key: "deposit_status", label: "Deposit Status", status: true },
];

export default function SundayCollections() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const extraFilters = useMemo(
    () => [
      { key: "startDate", value: startDate, onChange: setStartDate },
      { key: "endDate", value: endDate, onChange: setEndDate },
    ],
    [startDate, endDate],
  );

  return (
    <FinanceTablePage
      title="Sunday Collections"
      subtitle="Review weekly collection totals, verification, and deposit progress."
      endpoint="/finance/sunday-collections"
      topContent={<FinanceManualEntriesTabs />}
      columns={columns.map((column) => ({
        ...column,
        render: (value, row, helpers) => {
          if (column.status) {
            return (
              <helpers.FinanceStatusBadge
                status={String(value ?? row.deposit_status ?? "--")}
              />
            );
          }
          if (column.money) return helpers.formatMoney(value);
          if (column.key === "service_date") return fmtDate(value);
          return value ?? "--";
        },
      }))}
      extraFilters={extraFilters}
      actions={[]}
      searchPlaceholder="Search Sunday collection totals..."
    />
  );
}
