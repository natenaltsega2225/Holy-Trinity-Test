

// frontend/src/components/FinanceDashboard/pages/AuditLogs.jsx
import React, { useMemo, useState } from "react";
import FinanceTablePage from "../components/FinanceTablePage";

export default function AuditLogs() {
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");

  const extraFilters = useMemo(
    () => [
      {
        key: "action",
        value: action,
        onChange: setAction,
        options: [
          { value: "", label: "All actions" },
          { value: "login_success", label: "Login Success" },
          { value: "password_reset_requested", label: "Password Reset Requested" },
          { value: "password_reset_success", label: "Password Reset Success" },
          { value: "member_updated", label: "Member Updated" },
          { value: "finance_entry_created", label: "Finance Entry Created" },
          { value: "check_status_changed", label: "Check Status Changed" },
        ],
      },
      {
        key: "entity",
        value: entity,
        onChange: setEntity,
        options: [
          { value: "", label: "All entities" },
          { value: "auth", label: "Auth" },
          { value: "member", label: "Member" },
          { value: "finance_entry", label: "Finance Entry" },
          { value: "check_entry", label: "Check Entry" },
        ],
      },
    ],
    [action, entity]
  );

  const columns = [
    { key: "created_at", label: "Created At" },
    { key: "user_name", label: "User" },
    { key: "user_email", label: "Email" },
    {
      key: "action",
      label: "Action",
      render: (value, row, helpers) => (
        <helpers.FinanceStatusBadge status={String(value ?? row.action ?? "--")} />
      ),
    },
    { key: "entity", label: "Entity" },
    { key: "entity_id", label: "Entity ID" },
    { key: "ip_address", label: "IP Address" },
  ];

  return (
    <FinanceTablePage
      title="Audit Logs"
      subtitle="Review finance and authentication activity for operational traceability."
      endpoint="/admin/audit"
      columns={columns}
      extraFilters={extraFilters}
      pageSize={10}
      defaultPeriod="all"
      showPeriodFilter={false}
      searchPlaceholder="Search by user, action, entity, id, or IP..."
    />
  );
}