

// src/components/AdminDashboard/pages/Roles.jsx

import React, { useEffect, useState } from "react";
import api from "../../api";
import UsersTable from "../../Shared/UsersTable";

import "../../../styles/admin-enterprise.css";
import "../../../styles/admin-table.css";

export default function Roles() {
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSecuritySummary();
  }, []);

  async function loadSecuritySummary() {
    try {
      setLoading(true);

      const { data } = await api.get(
        "/admin/access-users/security-summary"
      );

      setSummary(data?.summary || {});
      setError("");
    } catch (err) {
      console.error(err);
      setError("Unable to load security metrics.");
    } finally {
      setLoading(false);
    }
  }

 return (
  <div className="admin-page">

    {/* PAGE HEADER */}
    <section className="admin-page-header">
      <div>
        <h1>Access & Role Management</h1>
        <p>
          Manage user roles, permissions, MFA,
          password resets, privileged access,
          and account security controls.
        </p>
      </div>

      <button
        className="admin-btn admin-btn-primary"
        onClick={() =>
          navigate("/dash/admin/security-audit")
        }
      >
        Security Audit
      </button>
    </section>

    {/* ERROR */}
    {error && (
      <div className="admin-alert admin-alert-danger">
        {error}
      </div>
    )}

    {/* KPI CARDS */}
    <div className="admin-kpi-grid">

      <div className="admin-kpi-card">
        <span>Total Users</span>
        <strong>
          {loading
            ? "..."
            : summary?.total_users || 0}
        </strong>
      </div>

      <div className="admin-kpi-card">
        <span>MFA Enabled</span>
        <strong>
          {loading
            ? "..."
            : summary?.mfa_enabled_users || 0}
        </strong>
      </div>

      <div className="admin-kpi-card">
        <span>Locked Accounts</span>
        <strong>
          {loading
            ? "..."
            : summary?.locked_users || 0}
        </strong>
      </div>

      <div className="admin-kpi-card">
        <span>Disabled Accounts</span>
        <strong>
          {loading
            ? "..."
            : summary?.disabled_users || 0}
        </strong>
      </div>

      <div className="admin-kpi-card">
        <span>Active Accounts</span>
        <strong>
          {loading
            ? "..."
            : summary?.active_users || 0}
        </strong>
      </div>

      <div className="admin-kpi-card">
        <span>Privileged Accounts</span>
        <strong>
          {loading
            ? "..."
            : (
                Number(summary?.admin_count || 0) +
                Number(summary?.super_admin_count || 0) +
                Number(summary?.it_admin_count || 0)
              )}
        </strong>
      </div>

    </div>

    {/* USERS TABLE */}
    <section className="admin-card">

      <div className="admin-card-header">
        <div>
          <h2>User Access Directory</h2>
          <p>
            Manage account access, password resets,
            role assignments, and privileged users.
          </p>
        </div>
      </div>

      <div className="admin-table-card">
        <UsersTable
          mode="roles"
          canCreate={false}
          canDelete={false}
          canEditRole={true}
          canDisable={true}
          canResetPassword={true}
          showAccountStatus={true}
          showLastLogin={true}
          showMfaStatus={true}
          showAuditHistory={true}
          stickyHeader={true}
        />
      </div>

    </section>

  </div>
);
}

function SecurityCard({ title, value }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-label">
        {title}
      </div>

      <div className="admin-stat-value">
        {value}
      </div>
    </div>
  );
}