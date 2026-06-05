import React, { useEffect, useState } from "react";
import api from "../../api";

export default function LedgerMatch() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/reconciliation/ledger");
      setRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
    } catch (err) {
      console.error("Failed to load ledger matches:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="recon-page">
      <h2>Ledger Match</h2>
      <p className="recon-subtitle">
        Verify ledger entries against invoices, payments, and reconciliation results.
      </p>

      {loading ? (
        <div className="recon-card">Loading...</div>
      ) : (
        <table className="recon-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Member</th>
              <th>Reference</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.record_date || r.date || "--"}</td>
                  <td>{r.full_name || "--"}</td>
                  <td>{r.reference_no || r.payment_number || r.invoice_number || "--"}</td>
                  <td>${Number(r.debit_amount || 0).toFixed(2)}</td>
                  <td>${Number(r.credit_amount || 0).toFixed(2)}</td>
                  <td>${Number(r.running_balance || 0).toFixed(2)}</td>
                  <td>{r.matched ? "Matched" : r.status || "--"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7">No ledger match records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}