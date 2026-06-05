import React, { useEffect, useState } from "react";
import api from "../../api";

export default function CashMatch() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api.get("/reconciliation/cash");
    setRows(res.data.rows);
  }

  return (
    <div className="recon-page">
      <h2>Cash Matching</h2>

      <table className="recon-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.full_name}</td>
              <td>${r.amount}</td>
              <td>{r.reconciled ? "Matched" : "Pending"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}