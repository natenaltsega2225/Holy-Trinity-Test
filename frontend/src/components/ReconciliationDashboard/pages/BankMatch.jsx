import React, { useEffect, useState } from "react";
import api from "../../api";

export default function BankMatch() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api.get("/reconciliation/bank");
    setRows(res.data.rows);
  }

  return (
    <div className="recon-page">
      <h2>Bank Matching</h2>

      <table className="recon-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.date}</td>
              <td>{r.description}</td>
              <td>${r.amount}</td>
              <td>{r.matched ? "Matched" : "Pending"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}