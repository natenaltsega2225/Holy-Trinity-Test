import React from "react";

export default function ReconciliationFilters({
  search = "",
  onSearchChange,
  status = "",
  onStatusChange,
  pageSize = 25,
  onPageSizeChange,
}) {
  return (
    <section className="recon-filter-card">
      <div className="recon-filter-grid">
        <input
          className="recon-input"
          placeholder="Search name, payment number, stripe reference..."
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />

        <select
          className="recon-input"
          value={status}
          onChange={(e) => onStatusChange?.(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="matched">Matched</option>
          <option value="unmatched">Unmatched</option>
          <option value="mismatch">Mismatch</option>
          <option value="duplicate">Duplicate</option>
        </select>

        <select
          className="recon-input"
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
        >
          {[25, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}