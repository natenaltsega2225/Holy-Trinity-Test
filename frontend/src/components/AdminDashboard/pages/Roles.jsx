// src/components/AdminDashboard/pages/Roles.jsx

import React from "react";
import UsersTable from "../../Shared/UsersTable";
import "../../../styles/admin-members-roles.css";

export default function Roles() {
  return (
    <div className="mr-page mr-roles-page">
      <section className="mr-page-hero">
        <div>
          <h1>Access & Role Management</h1>

          <p>
            Manage admin, finance, reconciliation, and elevated portal access.
            Reset passwords, assign permissions, and control account security.
          </p>
        </div>
      </section>

      <section className="mr-card mr-roles-card">
        <div className="mr-roles-table-shell">
          <div className="mr-roles-users-table">
            <UsersTable
              mode="roles"
              canCreate={true}
              canEditRole={true}
              canDelete={true}
              stickyHeader={true}
            />
          </div>
        </div>
      </section>
    </div>
  );
}