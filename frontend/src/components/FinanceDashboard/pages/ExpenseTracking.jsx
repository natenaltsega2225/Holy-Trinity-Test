// frontend/src/components/FinanceDashboard/pages/ExpenseTracking.jsx
import React from "react";
import FinanceTablePage from "../components/FinanceTablePage";

const columns = [
  { key: "category", label: "Category" },
  { key: "vendor_name", label: "Vendor" },
  { key: "amount", label: "Amount", money: true },
  { key: "payment_method", label: "Method" },
  { key: "approval_status", label: "Approval", status: true },
  { key: "expense_date", label: "Expense Date", date: true },
];

export default function ExpenseTracking() {
  return (
    <FinanceTablePage
      title="Expenses"
      subtitle="Track reimbursement payouts and outgoing expense records."
      endpoint="/finance/expenses"
      columns={columns.map((column) => ({
        ...column,
        render: (value, row, helpers) => {
          if (column.status) {
            return (
              <helpers.FinanceStatusBadge
                status={String(value ?? row.approval_status ?? "--")}
              />
            );
          }

          if (column.money) {
            return helpers.formatMoney(value ?? row.amount ?? 0);
          }

          if (column.date) {
            return helpers.formatDate?.(value ?? row.expense_date) ??
              value ??
              row.expense_date ??
              "--";
          }

          if (column.key === "vendor_name") {
            return value ?? row.vendor_name ?? "--";
          }

          return value ?? "--";
        },
      }))}
      actions={[]}
    />
  );
}