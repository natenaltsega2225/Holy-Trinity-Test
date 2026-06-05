// //frontend\src\components\FinanceDashboard\pages\CashEntries.jsx

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

function prettifyCategory(value) {
  const map = {
    individual: "Individual",
    individual_cash: "Individual",
    general_collection: "General Collection",
    sunday_cash_collection: "Sunday Cash Collection",
    special_fund_collection: "Special Fund Collection",
    event_fund_collection: "Event Fund Collection",
    pledge_fund_collection: "Pledge Fund Collection",
  };
  return (
    map[String(value || "").toLowerCase()] ||
    String(value || "--").replaceAll("_", " ")
  );
}

const columns = [
  { key: "full_name", label: "Full Name" },
  { key: "cash_mode", label: "Entry Type" },
  { key: "category", label: "Category" },
  { key: "reference_no", label: "Reference" },
  { key: "amount", label: "Amount", money: true },
  { key: "added_by", label: "Added By" },
  { key: "received_at", label: "Received At", date: true },
  { key: "status", label: "Status", status: true },
];

export default function CashEntries() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState("");

  const extraFilters = useMemo(
    () => [
      { key: "startDate", value: startDate, onChange: setStartDate },
      { key: "endDate", value: endDate, onChange: setEndDate },
      {
        key: "category",
        label: "Category",
        value: category,
        onChange: setCategory,
        options: [
          { value: "", label: "All Categories" },
          { value: "individual", label: "Individual" },
          { value: "general_collection", label: "General Collection" },
          { value: "sunday_cash_collection", label: "Sunday Cash Collection" },
          {
            value: "special_fund_collection",
            label: "Special Fund Collection",
          },
          { value: "event_fund_collection", label: "Event Fund Collection" },
          { value: "pledge_fund_collection", label: "Pledge Fund Collection" },
        ],
      },
    ],
    [startDate, endDate, category],
  );

  return (
    <FinanceTablePage
      title="Cash Collection"
      subtitle="Track individual cash donations and grouped church cash collections with category visibility."
      endpoint="/finance/cash"
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
          if (column.key === "category") return prettifyCategory(value);
          if (column.key === "cash_mode") {
            return String(value || "--").toLowerCase() === "collection"
              ? "Collection"
              : "Individual";
          }
          return value ?? "--";
        },
      }))}
      extraFilters={extraFilters}
      actions={[]}
      searchPlaceholder="Search by full name, category, reference, or finance user..."
    />
  );
}
