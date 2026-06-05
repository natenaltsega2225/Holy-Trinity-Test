// frontend/src/components/MembershipDashboard/components/BillingKPISection.jsx
import React, { useMemo } from "react";

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "--";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "--";
  }

  return d.toLocaleDateString("en-US");
}

function monthNumber(row = {}) {
  const direct = Number(row.month_number || row.month || 0);
  if (direct >= 1 && direct <= 12) return direct;

  const raw = String(row.coverage_month || row.coverage_key || "").trim();

  if (/^\d{4}-\d{2}$/.test(raw)) {
    return Number(raw.slice(5, 7));
  }

  return null;
}

export default function BillingKPISection({
  payments = [],
  invoices = [],
  coverageRows = [],
  activePlan = "--",
}) {
  const totalPaid = useMemo(() => {
    return payments.reduce(
      (sum, row) => sum + Number(row.amount || row.total_amount || 0),
      0
    );
  }, [payments]);

  const currentYearGiving = useMemo(() => {
    const year = new Date().getFullYear();

    return payments
      .filter((row) => {
        const d = new Date(row.payment_date || row.paid_at || row.created_at);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
      })
      .reduce(
        (sum, row) => sum + Number(row.amount || row.total_amount || 0),
        0
      );
  }, [payments]);

  const pendingInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const status = String(invoice.status || invoice.payment_status || "").toLowerCase();
      return status !== "paid";
    }).length;
  }, [invoices]);

  const coveragePercent = useMemo(() => {
    const months = new Set();

    coverageRows.forEach((row) => {
      const status = String(row.status || row.coverage_status || "").toLowerCase();

      const paid =
        row.paid === true ||
        ["paid", "completed", "posted"].includes(status);

      const m = monthNumber(row);

      if (paid && m >= 1 && m <= 12) {
        months.add(m);
      }
    });

    return Math.min(100, Math.round((months.size / 12) * 100));
  }, [coverageRows]);

  const latestPayment = useMemo(() => {
    if (!payments.length) return null;

    return [...payments].sort((a, b) => {
      const da = new Date(a.payment_date || a.paid_at || a.created_at);
      const db = new Date(b.payment_date || b.paid_at || b.created_at);
      return db - da;
    })[0];
  }, [payments]);

  return (
    <section className="billing-kpi-grid">
      <div className="billing-kpi-card">
        <span className="billing-kpi-label">Total Paid</span>
        <h3 className="billing-kpi-value">{money(totalPaid)}</h3>
        <p className="billing-kpi-meta">Lifetime payments</p>
      </div>

      <div className="billing-kpi-card">
        <span className="billing-kpi-label">Current Year Giving</span>
        <h3 className="billing-kpi-value">{money(currentYearGiving)}</h3>
        <p className="billing-kpi-meta">{new Date().getFullYear()}</p>
      </div>

      <div className="billing-kpi-card">
        <span className="billing-kpi-label">Membership Coverage</span>
        <h3 className="billing-kpi-value">{coveragePercent}%</h3>
        <p className="billing-kpi-meta">Jan–Dec coverage</p>
      </div>

      <div className="billing-kpi-card">
        <span className="billing-kpi-label">Pending Invoices</span>
        <h3 className="billing-kpi-value">{pendingInvoices}</h3>
        <p className="billing-kpi-meta">Outstanding balance</p>
      </div>

      <div className="billing-kpi-card">
        <span className="billing-kpi-label">Active Plan</span>
        <h3 className="billing-kpi-value">{activePlan || "--"}</h3>
        <p className="billing-kpi-meta">Membership plan</p>
      </div>

      <div className="billing-kpi-card">
        <span className="billing-kpi-label">Latest Payment</span>
        <h3 className="billing-kpi-value">
          {latestPayment ? money(latestPayment.amount || latestPayment.total_amount) : "--"}
        </h3>
        <p className="billing-kpi-meta">
          {latestPayment
            ? formatDate(
                latestPayment.payment_date ||
                  latestPayment.paid_at ||
                  latestPayment.created_at
              )
            : "No payments"}
        </p>
      </div>
    </section>
  );
}