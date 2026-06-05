//frontend\src\components\FinanceDashboard\components\FinanceOverviewCharts.jsx
import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

function formatMoney(v) {
  return `$${Number(v || 0).toLocaleString()}`;
}

export default function FinanceOverviewCharts({ data = [], onDrill }) {
  const monthlyData = useMemo(() => {
    return (data || []).map((d) => ({
      name: `${d.month}/${d.year}`,
      month: d.month,
      year: d.year,
      total: Number(d.total_amount || 0),
      membership: Number(d.membership || 0),
      donation: Number(d.donation || 0),
      programs: Number(d.programs || 0),
    }));
  }, [data]);

  if (!monthlyData.length) {
    return (
      <section className="finance-card">
        <div className="finance-chart-empty">No chart data available</div>
      </section>
    );
  }

  return (
    <section className="finance-charts-grid">
      {/* 🔵 LINE CHART */}
      <div className="finance-card">
        <h3 className="finance-section-title">Revenue Trend</h3>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={monthlyData}
            onClick={() => onDrill?.(monthlyData)}
          >
            <CartesianGrid strokeDasharray="5 5" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(v) => formatMoney(v)} />
            <Legend />

            <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} />
            <Line type="monotone" dataKey="membership" stroke="#16a34a" />
            <Line type="monotone" dataKey="donation" stroke="#f59e0b" />
            <Line type="monotone" dataKey="programs" stroke="#9333ea" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 🟣 BAR CHART */}
      <div className="finance-card">
        <h3 className="finance-section-title">Category Breakdown</h3>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={monthlyData}
            onClick={() => onDrill?.(monthlyData)}
          >
            <CartesianGrid strokeDasharray="5 5" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(v) => formatMoney(v)} />
            <Legend />

            <Bar dataKey="membership" fill="#16a34a" />
            <Bar dataKey="donation" fill="#f59e0b" />
            <Bar dataKey="programs" fill="#9333ea" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}