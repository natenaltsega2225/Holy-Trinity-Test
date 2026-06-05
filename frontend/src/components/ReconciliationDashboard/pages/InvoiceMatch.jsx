import React, { useEffect, useState } from "react";
import api from "../../api";

export default function InvoiceMatch() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/reconciliation/invoices");
      setRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
    } catch (err) {
      console.error("Failed to load invoice matches:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="recon-page">
      <h2>Invoice Match</h2>
      <p className="recon-subtitle">
        Compare invoices against posted payments and detect missing or partial matches.
      </p>

      {loading ? (
        <div className="recon-card">Loading...</div>
      ) : (
        <table className="recon-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Member</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.invoice_number || "--"}</td>
                  <td>{r.full_name || "--"}</td>
                  <td>${Number(r.total_amount || 0).toFixed(2)}</td>
                  <td>${Number(r.paid_amount || 0).toFixed(2)}</td>
                  <td>${Number(r.balance_due || 0).toFixed(2)}</td>
                  <td>{r.matched ? "Matched" : r.status || "--"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6">No invoice match records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}