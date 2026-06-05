import React, { useEffect, useState } from "react";
import api from "../../api";
import ReconciliationSummaryCards from "./ReconciliationSummaryCards";
import ReconciliationFilters from "./ReconciliationFilters";
import ReconciliationTable from "./ReconciliationTable";
import BulkActions from "./BulkActions";
import MatchModal from "./MatchModal";

export default function ReconciliationDashboardPage({ title, subtitle, mode = "all" }) {
  const [summary, setSummary] = useState({});
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [modalRow, setModalRow] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [pageSize, setPageSize] = useState(25);

  async function load() {
    const summaryRes = await api.get("/reconciliation/summary");
    const itemsRes = await api.get("/reconciliation/items", {
      params: {
        search,
        status,
        limit: pageSize,
        mode,
      },
    });

    let nextRows = itemsRes?.data?.rows || [];

    if (mode === "discrepancies") {
      const d = await api.get("/reconciliation/discrepancies");
      nextRows = d?.data?.rows || [];
    }

    setSummary(summaryRes.data || {});
    setRows(nextRows);
    setSelected([]);
  }

  useEffect(() => {
    load();
  }, [search, status, pageSize, mode]);

  return (
    <div className="recon-page-shell">
      <section className="recon-header-card">
        <p className="recon-header-eyebrow">Reconciliation Dashboard</p>
        <h1 className="recon-header-title">{title}</h1>
        <p className="recon-header-subtitle">{subtitle}</p>
      </section>

      <ReconciliationSummaryCards summary={summary} />

      <BulkActions selected={selected} reload={load} />

      <ReconciliationFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />

      <ReconciliationTable
        rows={rows}
        selected={selected}
        setSelected={setSelected}
        onCompare={setModalRow}
      />

      <MatchModal row={modalRow} onClose={() => setModalRow(null)} reload={load} />
    </div>
  );
}