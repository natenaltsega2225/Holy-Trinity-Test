
// frontend/src/components/AdminDashboard/pages/AuditLogs.jsx
import React, { useMemo, useState } from "react";
import AdminTablePage from "../components/AdminTablePage";

function formatDateOnly(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";

  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${mm}/${dd}/${yyyy}`;
}

function displayText(value) {
  const text = String(value ?? "").trim();
  return text || "--";
}

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

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
          { value: "login_failed", label: "Login Failed" },
          { value: "logout", label: "Logout" },
          { value: "logout_success", label: "Logout Success" },
          { value: "register_success", label: "Register Success" },
          { value: "password_reset_requested", label: "Password Reset Requested" },
          { value: "password_reset_success", label: "Password Reset Success" },
          { value: "linked_account_created", label: "Linked Account Created" },
          { value: "linked_account_status_changed", label: "Linked Account Status Changed" },
          { value: "member_created", label: "Member Created" },
          { value: "member_updated", label: "Member Updated" },
          { value: "member_deactivated", label: "Member Deactivated" },
          { value: "member_register_new", label: "Member Register New" },
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
          { value: "user_account", label: "User Account" },
          { value: "finance_entry", label: "Finance Entry" },
        ],
      },
    ],
    [action, entity]
  );

  const columns = [
    {
      key: "created_at",
      label: "Created At",
      render: (value) => formatDateOnly(value),
    },
    {
      key: "user_name",
      label: "User",
      render: (value, row) => displayText(value ?? row.user_name),
    },
    {
      key: "user_email",
      label: "Email",
      render: (value, row) => displayText(value ?? row.user_email),
    },
    {
      key: "action",
      label: "Action",
      render: (value, row, helpers) => (
        <helpers.AdminStatusBadge status={String(value ?? row.action ?? "--")} />
      ),
    },
    {
      key: "duration_seconds",
      label: "Duration",
      render: (value, row) => formatDuration(value ?? row.duration_seconds),
    },
    {
      key: "entity",
      label: "Entity",
      render: (value, row) => displayText(value ?? row.entity),
    },
    {
      key: "entity_id",
      label: "Entity ID",
      render: (value, row) => displayText(value ?? row.entity_id),
    },
    {
      key: "ip_address",
      label: "IP Address",
      render: (value, row) => displayText(value ?? row.ip_address),
    },
  ];

  return (
    <AdminTablePage
      title="Audit Logs"
      subtitle="Review user actions, affected records, and traceability details across the admin system."
      endpoint="/admin/audit"
      hidePeriod={true}
      extraFilters={extraFilters}
      columns={columns}
      actions={[]}
      searchPlaceholder="Search action, entity, user, email, IP, or entity ID..."
    />
  );
}