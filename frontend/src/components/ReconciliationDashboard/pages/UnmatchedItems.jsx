import React, { useEffect, useState } from "react";
import api from "../../api";

export default function Unmatched() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api.get("/reconciliation/unmatched");
    setRows(res.data.rows);
  }

  return (
    <div className="recon-page">
      <h2>Unmatched Transactions</h2>

      <table className="recon-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Amount</th>
            <th>Source</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.full_name}</td>
              <td>${r.amount}</td>
              <td>{r.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}