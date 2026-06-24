//frontend\src\components\FinanceDashboard\pages\CheckManagement.jsx
import React, { useMemo, useState } from "react";
import FinanceTablePage from "../components/FinanceTablePage";
import FinanceActionMenu from "../components/FinanceActionMenu"
function fmtDate(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US");
}

export default function CheckManagement() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const extraFilters = useMemo(
    () => [
      { key: "startDate", value: startDate, onChange: setStartDate },
      { key: "endDate", value: endDate, onChange: setEndDate },
    ],
    [startDate, endDate]
  );

  const columns = [
    { key: "check_number", label: "Check #" },
    { key: "full_name", label: "Full Name" },
    { key: "amount", label: "Amount", money: true },
    { key: "added_by", label: "Added By" },
    { key: "deposited_at", label: "Deposited At", date: true },
    { key: "cleared_at", label: "Cleared At", date: true },
    { key: "status", label: "Status", status: true },
  ];

  return (
    <FinanceTablePage
      title="Check Management"
      subtitle="Operational workspace for verification, deposit, and clearance of check entries."
      endpoint="/finance/checks"
      columns={columns.map((column) => ({
        ...column,
        render: (value, row, helpers) => {
          if (column.status) {
            return <helpers.FinanceStatusBadge status={String(value ?? row.status ?? "--")} />;
          }
          if (column.money) return helpers.formatMoney(value);
          if (column.date) return fmtDate(value);
          return value ?? "--";
        },
      }))}
      extraFilters={extraFilters}
      searchPlaceholder="Search by member, check number, bank, phone, or finance user..."
      rowActions={[
        {
          label: "Mark Deposited",
          visible: (row) => ["received"].includes(String(row.status || "").toLowerCase()),
          endpoint: (row) => `/finance/checks/${row.id}/status`,
          method: "patch",
          payload: () => ({ status: "deposited" }),
        },
        {
          label: "Mark Cleared",
          visible: (row) => ["deposited"].includes(String(row.status || "").toLowerCase()),
          endpoint: (row) => `/finance/checks/${row.id}/status`,
          method: "patch",
          payload: () => ({ status: "cleared" }),
        },
      ]}
    />
  );
}