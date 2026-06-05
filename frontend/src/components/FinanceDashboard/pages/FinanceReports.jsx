// frontend/src/components/FinanceDashboard/pages/FinanceReports.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Download,
  RefreshCcw,
  DollarSign,
  Receipt,
  FileText,
  Landmark,
  CreditCard,
  Calendar,
  PieChart,
  BarChart3,
} from "lucide-react";

import FinanceLedgerSummaryCards from "../components/FinanceLedgerSummaryCards";

import "../../../styles/shared-payment-components.css";
// import "../../../styles/finance-dashboard.css";

function money(value) {
  return Number(value || 0).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  );
}

function pretty(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) =>
      m.toUpperCase()
    );
}

export default function FinanceReports() {

  const [loading, setLoading] =
    useState(false);

  const [report, setReport] =
    useState(null);

  const [filters, setFilters] =
    useState({
      date_from: "",
      date_to: "",
      category: "",
    });

  async function loadData() {

    try {

      setLoading(true);

      const params =
        new URLSearchParams();

      Object.entries(filters)
        .forEach(([k, v]) => {

          if (
            v !== undefined &&
            v !== null &&
            String(v).trim() !== ""
          ) {

            params.append(k, v);
          }
        });

      const res =
        await fetch(
          `/api/finance/reports/overview?${params.toString()}`,
          {
            credentials:
              "include",
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          "Failed to load finance reports."
        );
      }

      setReport(data);

    } catch (err) {

      console.error(err);

    } finally {

      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const paymentTotals =
    useMemo(() => {

      if (!report)
        return {};

      return {

        totalPayments:
          Number(
            report.summary?.totalPayments || 0
          ),

        totalReceipts:
          Number(
            report.summary?.totalReceipts || 0
          ),

        totalInvoices:
          Number(
            report.summary?.totalInvoices || 0
          ),

        totalLedger:
          Number(
            report.summary?.totalLedger || 0
          ),

      };

    }, [report]);

  return (
    <div className="finance-enterprise-page">

      <div className="finance-page-header">

        <div>

          <h1>
            Finance Reports
          </h1>

          <p>
            Enterprise
            finance analytics,
            accounting reports,
            payment reporting,
            invoice reporting,
            reconciliation,
            donations,
            dues,
            pledges,
            and financial KPIs.
          </p>

        </div>

        <div className="finance-header-actions">

          <button
            className="finance-btn finance-btn-secondary"
            onClick={loadData}
          >
            <RefreshCcw size={16} />
            Refresh
          </button>

          <button
            className="finance-btn finance-btn-primary"
            onClick={() =>
              window.open(
                "/api/finance/reports/export",
                "_blank"
              )
            }
          >
            <Download size={16} />
            Export Reports
          </button>

        </div>

      </div>

      <div className="finance-section-card">

        <div className="finance-section-title">

          <Calendar size={16} />

          <span>
            Report Filters
          </span>

        </div>

        <div className="finance-grid finance-grid-4">

          <div className="finance-field">

            <label>
              From
            </label>

            <input
              type="date"
              value={
                filters.date_from
              }
              onChange={(e) =>
                setFilters(
                  (prev) => ({
                    ...prev,
                    date_from:
                      e.target.value,
                  })
                )
              }
            />

          </div>

          <div className="finance-field">

            <label>
              To
            </label>

            <input
              type="date"
              value={
                filters.date_to
              }
              onChange={(e) =>
                setFilters(
                  (prev) => ({
                    ...prev,
                    date_to:
                      e.target.value,
                  })
                )
              }
            />

          </div>

          <div className="finance-field">

            <label>
              Category
            </label>

            <select
              value={
                filters.category
              }
              onChange={(e) =>
                setFilters(
                  (prev) => ({
                    ...prev,
                    category:
                      e.target.value,
                  })
                )
              }
            >
              <option value="">
                All
              </option>

              <option value="membership">
                Membership
              </option>

              <option value="donation">
                Donation
              </option>

              <option value="pledge">
                Pledge
              </option>

              <option value="school">
                School
              </option>

              <option value="trip">
                Trip
              </option>

            </select>

          </div>

          <div className="finance-field finance-field-end">

            <button
              className="finance-btn finance-btn-primary"
              onClick={loadData}
            >
              Generate
              Report
            </button>

          </div>

        </div>

      </div>

      <div className="finance-summary-grid">

        <div className="finance-summary-card finance-summary-card-primary">

          <div className="finance-summary-card-top">

            <DollarSign size={18} />

            <span>
              Payments
            </span>

          </div>

          <strong>
            {money(
              paymentTotals.totalPayments
            )}
          </strong>

        </div>

        <div className="finance-summary-card finance-summary-card-success">

          <div className="finance-summary-card-top">

            <Receipt size={18} />

            <span>
              Receipts
            </span>

          </div>

          <strong>
            {money(
              paymentTotals.totalReceipts
            )}
          </strong>

        </div>

        <div className="finance-summary-card finance-summary-card-warning">

          <div className="finance-summary-card-top">

            <FileText size={18} />

            <span>
              Invoices
            </span>

          </div>

          <strong>
            {money(
              paymentTotals.totalInvoices
            )}
          </strong>

        </div>

        <div className="finance-summary-card">

          <div className="finance-summary-card-top">

            <Landmark size={18} />

            <span>
              Ledger
            </span>

          </div>

          <strong>
            {money(
              paymentTotals.totalLedger
            )}
          </strong>

        </div>

      </div>

      <FinanceLedgerSummaryCards
        rows={
          report?.ledgerRows || []
        }
        stats={
          report?.ledgerStats || {}
        }
      />

      <div className="finance-grid finance-grid-2">

        <div className="finance-section-card">

          <div className="finance-section-title">

            <BarChart3 size={16} />

            <span>
              Revenue By Category
            </span>

          </div>

          <div className="finance-report-list">

            {(report?.revenueByCategory || []).map(
              (item, idx) => (

                <div
                  key={idx}
                  className="finance-report-row"
                >

                  <div>
                    <strong>
                      {pretty(
                        item.category
                      )}
                    </strong>
                  </div>

                  <div>
                    {money(
                      item.total
                    )}
                  </div>

                </div>
              )
            )}

          </div>

        </div>

        <div className="finance-section-card">

          <div className="finance-section-title">

            <PieChart size={16} />

            <span>
              Payment Methods
            </span>

          </div>

          <div className="finance-report-list">

            {(report?.paymentMethods || []).map(
              (item, idx) => (

                <div
                  key={idx}
                  className="finance-report-row"
                >

                  <div className="finance-inline-icon">

                    <CreditCard size={14} />

                    <strong>
                      {pretty(
                        item.method
                      )}
                    </strong>

                  </div>

                  <div>
                    {money(
                      item.total
                    )}
                  </div>

                </div>
              )
            )}

          </div>

        </div>

      </div>

      <div className="finance-section-card">

        <div className="finance-section-title">

          <Landmark size={16} />

          <span>
            Financial Summary
          </span>

        </div>

        <div className="finance-table-wrap">

          <table className="finance-table">

            <thead>

              <tr>

                <th>
                  Metric
                </th>

                <th>
                  Value
                </th>

              </tr>

            </thead>

            <tbody>

              <tr>
                <td>
                  Total Payments
                </td>

                <td>
                  {money(
                    report?.summary?.totalPayments
                  )}
                </td>
              </tr>

              <tr>
                <td>
                  Total Receipts
                </td>

                <td>
                  {money(
                    report?.summary?.totalReceipts
                  )}
                </td>
              </tr>

              <tr>
                <td>
                  Total Invoices
                </td>

                <td>
                  {money(
                    report?.summary?.totalInvoices
                  )}
                </td>
              </tr>

              <tr>
                <td>
                  Total Ledger Credits
                </td>

                <td>
                  {money(
                    report?.summary?.ledgerCredits
                  )}
                </td>
              </tr>

              <tr>
                <td>
                  Total Ledger Debits
                </td>

                <td>
                  {money(
                    report?.summary?.ledgerDebits
                  )}
                </td>
              </tr>

            </tbody>

          </table>

        </div>

      </div>

      {loading && (
        <div className="finance-loading-overlay">
          Loading reports...
        </div>
      )}

    </div>
  );
}