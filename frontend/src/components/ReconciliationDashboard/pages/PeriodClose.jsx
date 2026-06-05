import React, { useState } from "react";
import api from "../../api";

export default function PeriodClose() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function lockPeriod() {
    await api.post("/reconciliation/lock", {
      startDate,
      endDate,
    });
    alert("Period locked");
  }

  return (
    <div className="recon-page">
      <h2>Period Close</h2>

      <div className="recon-filters">
        <input type="date" onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" onChange={(e) => setEndDate(e.target.value)} />
        <button onClick={lockPeriod}>Lock Period</button>
      </div>
    </div>
  );
}