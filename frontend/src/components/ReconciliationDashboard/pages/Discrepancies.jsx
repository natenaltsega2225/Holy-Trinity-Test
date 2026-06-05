import React, { useEffect, useState } from "react";
import api from "../../api";

export default function Discrepancies() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api.get("/reconciliation/discrepancies");
    setRows(res.data.rows);
  }

  return (
    <div className="recon-page">
      <h2>Discrepancies</h2>

      <table className="recon-table">
        <thead>
          <tr>
            <th>Issue</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.issue}</td>
              <td>${r.amount}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}