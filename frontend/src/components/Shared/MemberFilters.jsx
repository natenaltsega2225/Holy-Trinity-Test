

//src/components/Shared/MemberFilters.jsx

import React from "react";

export default function MemberFilters({ value, onChange, pageSize = 25, onPageSize }) {
  const upd = (k, v) => onChange({ ...value, [k]: v });

  return (
    <div className="dash-toolbar" style={{ marginBottom: 10 }}>
      <div className="dash-toolbar-left">
        <input
          className="dash-input"
          style={{ width: 360, maxWidth: "70vw" }}
          placeholder="Search name/email"
          value={value.text || ""}
          onChange={(e) => upd("text", e.target.value)}
        />

        <select
          className="dash-select"
          style={{ width: 160, height: 38 }}
          value={value.status || "active"}
          onChange={(e) => upd("status", e.target.value)}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="delinquent">Delinquent</option>
        </select>

        <select
          className="dash-select"
          style={{ width: 160, height: 38 }}
          value={value.plan || ""}
          onChange={(e) => upd("plan", e.target.value)}
        >
          <option value="">All plans</option>
          <option value="1">Monthly</option>
          <option value="6">6 Months</option>
          <option value="12">12 Months</option>
        </select>
      </div>

      {onPageSize ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="badge">Page size</span>
          <select
            className="dash-select"
            style={{ width: 120, height: 38 }}
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
