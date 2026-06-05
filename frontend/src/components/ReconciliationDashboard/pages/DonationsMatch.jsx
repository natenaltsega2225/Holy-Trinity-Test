import React, { useEffect, useState } from "react";
import api from "../../api";

export default function DonationsMatch() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/reconciliation/donations");
      setRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
    } catch (err) {
      console.error("Failed to load donation matches:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="recon-page">
      <h2>Donations Match</h2>
      <p className="recon-subtitle">
        Review donation records against finance and external payment sources.
      </p>

      {loading ? (
        <div className="recon-card">Loading...</div>
      ) : (
        <table className="recon-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Donor</th>
              <th>Fund</th>
              <th>Amount</th>
              <th>Source</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.date || "--"}</td>
                  <td>{r.full_name || r.donor_name || "--"}</td>
                  <td>{r.fund || r.category || "--"}</td>
                  <td>${Number(r.amount || 0).toFixed(2)}</td>
                  <td>{r.source || "--"}</td>
                  <td>{r.matched ? "Matched" : r.status || "Pending"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6">No donation match records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}