import React from "react";

export default function ReconciliationTable({
  rows = [],
  selected = [],
  setSelected,
  onCompare,
}) {
  function toggle(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (selected.length === rows.length) {
      setSelected([]);
    } else {
      setSelected(rows.map((r) => r.id));
    }
  }

  return (
    <section className="recon-table-card">
      <div className="recon-table-wrap">
        <table className="recon-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selected.length === rows.length}
                  onChange={toggleAll}
                />
              </th>
              <th>Payment #</th>
              <th>Name</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Provider</th>
              <th>Reconciliation</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={() => toggle(row.id)}
                  />
                </td>
                <td>{row.payment_number || "--"}</td>
                <td>{row.full_name || "--"}</td>
                <td>${Number(row.amount || 0).toFixed(2)}</td>
                <td>{row.method || "--"}</td>
                <td>{row.provider || "--"}</td>
                <td>{row.reconciliation_status || (Number(row.reconciled) ? "matched" : "unmatched")}</td>
                <td>{row.created_at ? new Date(row.created_at).toLocaleDateString("en-US") : "--"}</td>
                <td>
                  <button
                    type="button"
                    className="recon-btn recon-btn-secondary"
                    onClick={() => onCompare?.(row)}
                  >
                    Compare
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}