// frontend/src/components/FinanceDashboard/pages/ZelleEntries.jsx
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
  { key: "full_name", label: "Full Name" },
  { key: "zelle_reference", label: "Reference" },
  { key: "amount", label: "Amount", money: true },
  { key: "added_by", label: "Added By" },
  { key: "received_at", label: "Received At", date: true },
  { key: "status", label: "Status", status: true },
];

export default function ZelleEntries() {
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
      title="Zelle Entries"
      subtitle="Manage manually verified Zelle donations and reference tracking."
      endpoint="/finance/zelle"
      topContent={<FinanceManualEntriesTabs />}
      columns={columns.map((column) => ({
        ...column,
        render: (value, row, helpers) => {
          if (column.status) {
            return (
              <helpers.FinanceStatusBadge
                status={String(value ?? row.status ?? "--")}
              />
            );
          }
          if (column.money) return helpers.formatMoney(value);
          if (column.date) return fmtDate(value);
          return value ?? "--";
        },
      }))}
      extraFilters={extraFilters}
      actions={[]}
      searchPlaceholder="Search by donor, reference, email, phone, or finance user..."
    />
  );
}
