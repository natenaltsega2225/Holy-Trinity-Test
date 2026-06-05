// frontend/src/components/FinanceDashboard/pages/Overview.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";

import FinancePageHeader from "../components/FinancePageHeader";
import FinanceSummaryCards from "../components/FinanceSummaryCards";
import FinanceEmptyState from "../components/FinanceEmptyState";
import FinanceStatusBadge from "../components/FinanceStatusBadge";
import FinanceManualEntryModal from "../components/FinanceManualEntryModal";
import FinanceOverviewCharts from "../components/FinanceOverviewCharts";
import FinanceFilters from "../components/FinanceFilters";

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function Overview() {
  const nav = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
  });

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");

  const [drillOpen, setDrillOpen] = useState(false);
  const [drillData, setDrillData] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        const res = await api.get("/finance/dashboard", {
          params: filters,
        });

        if (!mounted) return;
        setData(res.data?.data || null);
      } catch (err) {
        console.error(err);
        setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => (mounted = false);
  }, [reloadKey]);

  const summaryCards = useMemo(() => {
    const c = data?.cfo || {};
    return [
      { label: "Total Revenue", value: formatMoney(c.total_revenue), featured: true },
      { label: "Membership", value: formatMoney(c.membership_revenue) },
      { label: "Donations", value: formatMoney(c.donation_revenue) },
      { label: "Programs", value: formatMoney(c.program_revenue) },
      { label: "Receivable", value: formatMoney(c.receivable_total) },
      { label: "Expenses", value: formatMoney(c.total_expense) },
    ];
  }, [data]);

  function handleDateChange(key, value) {
    setFilters((p) => ({ ...p, [key]: value }));
  }

  function applyFilters() {
    setReloadKey((k) => k + 1);
  }

  function exportCSV() {
    const rows = data?.monthly || [];

    const csv = [
      ["Month", "Total", "Membership", "Donation", "Programs"],
      ...rows.map((r) => [
        `${r.month}/${r.year}`,
        r.total_amount,
        r.membership,
        r.donation,
        r.programs,
      ]),
    ]
      .map((e) => e.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "finance-report.csv";
    a.click();
  }

  return (
    <>
      <div className="finance-page-shell">
        <FinancePageHeader
          title="Finance Dashboard"
          subtitle="Enterprise-level finance analytics"
        />

        {/* 🔥 FILTERS */}
        <FinanceFilters
          search={search}
          onSearchChange={setSearch}
          period={period}
          onPeriodChange={setPeriod}
          dateFrom={filters.from}
          dateTo={filters.to}
          onDateChange={handleDateChange}
          onApply={applyFilters}
          onExport={exportCSV}
        />

        {loading ? (
          <div className="finance-card">Loading...</div>
        ) : !data ? (
          <FinanceEmptyState title="No data" />
        ) : (
          <>
            <FinanceSummaryCards items={summaryCards} />

            <FinanceOverviewCharts
              data={data.monthly}
              onDrill={(rows) => {
                setDrillData(rows);
                setDrillOpen(true);
              }}
            />
          </>
        )}
      </div>

      {/* 🔍 DRILL DOWN MODAL */}
      {drillOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Detailed Monthly Data</h3>

            <table className="finance-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Total</th>
                  <th>Membership</th>
                  <th>Donation</th>
                  <th>Programs</th>
                </tr>
              </thead>

              <tbody>
                {drillData.map((r, i) => (
                  <tr key={i}>
                    <td>{r.month}/{r.year}</td>
                    <td>{formatMoney(r.total)}</td>
                    <td>{formatMoney(r.membership)}</td>
                    <td>{formatMoney(r.donation)}</td>
                    <td>{formatMoney(r.programs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button onClick={() => setDrillOpen(false)}>Close</button>
          </div>
        </div>
      )}

      <FinanceManualEntryModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
      />
    </>
  );
}