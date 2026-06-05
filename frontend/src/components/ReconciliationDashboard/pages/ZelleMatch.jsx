import React, { useEffect, useState } from "react";
import api from "../../api";

export default function ZelleMatch() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/reconciliation/zelle");
      setRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
    } catch (err) {
      console.error("Failed to load Zelle matches:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="recon-page">
      <h2>Zelle Match</h2>
      <p className="recon-subtitle">
        Review Zelle transactions and compare them against recorded finance entries.
      </p>

      {loading ? (
        <div className="recon-card">Loading...</div>
      ) : (
        <table className="recon-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Sender</th>
              <th>Reference</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.date || r.received_at || "--"}</td>
                  <td>{r.full_name || r.sender_name || "--"}</td>
                  <td>{r.zelle_reference || r.reference || "--"}</td>
                  <td>${Number(r.amount || 0).toFixed(2)}</td>
                  <td>{r.matched ? "Matched" : r.status || "Pending"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5">No Zelle match records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}