// frontend/src/components/MembershipDashboard/pages/DashboardHome.jsx
// frontend/src/components/MembershipDashboard/pages/DashboardHome.jsx

import React, { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import api from "../../api";

import MemberPageHeader from "../components/MemberPageHeader";
import BillingOverviewLayout from "../components/BillingOverviewLayout";

import "../../../styles/membership-dashboard.css";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function rowsFrom(data) {
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function isPaid(row = {}) {
  return (
    row.paid === true ||
    ["paid", "completed", "posted", "approved"].includes(
      String(row.status || row.coverage_status || "").toLowerCase()
    )
  );
}

function monthKey(row = {}) {
  const n = Number(row.month_number || row.month || 0);

  if (n >= 1 && n <= 12) {
    return MONTHS[n - 1];
  }

  const raw = String(
    row.coverage_month ||
      row.coverage_key ||
      row.month_name ||
      ""
  );

  return raw.slice(0, 3);
}

export default function DashboardHome() {
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [coverageRows, setCoverageRows] = useState([]);
  const [receiptRows, setReceiptRows] = useState([]);
  const [upcomingPrograms, setUpcomingPrograms] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);

      const [
        paymentsRes,
        invoicesRes,
        coverageRes,
        receiptsRes,
        programsRes,
      ] = await Promise.allSettled([
        api.get("/member/payments?limit=20"),
        api.get("/member/invoices?limit=20"),
        api.get("/member/membership-coverage"),
        api.get("/member/receipts?limit=10"),

        api.get("/news-events", {
          params: {
            published: 1,
            page: 1,
            limit: 100,
          },
        }),
      ]);

      setPayments(
        paymentsRes.status === "fulfilled"
          ? rowsFrom(paymentsRes.value.data)
          : []
      );

      setInvoices(
        invoicesRes.status === "fulfilled"
          ? rowsFrom(invoicesRes.value.data)
          : []
      );

      setCoverageRows(
        coverageRes.status === "fulfilled"
          ? rowsFrom(coverageRes.value.data)
          : []
      );

      setReceiptRows(
        receiptsRes.status === "fulfilled"
          ? rowsFrom(receiptsRes.value.data)
          : []
      );

      const programRows =
        programsRes.status === "fulfilled"
          ? rowsFrom(programsRes.value.data)
          : [];

      setUpcomingPrograms(
        programRows.filter((r) =>
          ["kids", "school", "trip"].includes(
            String(r.category || "").toLowerCase()
          )
        )
      );
    } catch (err) {
      console.error("Member dashboard load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const unpaidMonths = useMemo(() => {
    const paid = new Set();

    coverageRows.forEach((row) => {
      if (isPaid(row)) {
        const key = monthKey(row);

        if (key) {
          paid.add(key);
        }
      }
    });

    return MONTHS.filter((m) => !paid.has(m));
  }, [coverageRows]);

  const activePlan =
    payments[0]?.plan_name ||
    payments[0]?.plan_type ||
    payments[0]?.sub_category ||
    "Membership Plan";

  function handleReceiptDownload(receipt) {
    if (receipt?.pdf_url) {
      window.open(receipt.pdf_url, "_blank");
      return;
    }

    if (receipt?.receipt_number) {
      window.open(
        `/dash/membership/receipts/${encodeURIComponent(
          receipt.receipt_number
        )}`,
        "_blank"
      );
    }
  }

  return (
    <div className="member-page">
      <MemberPageHeader
        title="Dashboard"
        subtitle="Welcome to your member portal and billing center."
      />

      {loading ? (
        <div className="member-loading-card">
          Loading dashboard...
        </div>
      ) : null}

      {!loading ? (
        <BillingOverviewLayout
          payments={payments}
          invoices={invoices}
          coverageRows={coverageRows}
          receiptRows={receiptRows}
          unpaidMonths={unpaidMonths}
          upcomingPrograms={upcomingPrograms}
          activePlan={activePlan}
          onDownloadReceipt={handleReceiptDownload}
          onGoTab={(tab) =>
            navigate(`/dash/membership/my-payments/${tab}`)
          }
          onContactFinance={() => navigate("/contact")}
        />
      ) : null}
    </div>
  );
}