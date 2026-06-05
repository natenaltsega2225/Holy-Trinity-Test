import React, { useEffect, useState } from "react";
import api from "../../api";

export default function Overview() {
  const [data, setData] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api.get("/reconciliation/summary");
    setData(res.data);
  }

  return (
    <div className="recon-page">
      <h2>Reconciliation Overview</h2>

      <div className="recon-cards">
        <Card title="Total Transactions" value={data.total} />
        <Card title="Matched" value={data.matched} />
        <Card title="Unmatched" value={data.unmatched} />
        <Card title="Match Rate" value={`${data.match_rate || 0}%`} />
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="recon-card">
      <h4>{title}</h4>
      <p>{value}</p>
    </div>
  );
}