// src/pages/InvoiceViewPage.jsx
import "../styles/invoice.css";
import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import api from "../components/api";

import "../styles/invoice.css";

/* =========================================================
   HELPERS
========================================================= */

function money(value) {

  const n =
    Number(value || 0);

  return `$${n.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function formatDate(value) {

  if (!value) {
    return "--";
  }

  const d =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
    return "--";
  }

  return d.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }
  );
}

function pretty(value) {

  if (!value) {
    return "--";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (c) => c.toUpperCase()
    );
}

function getRoleBasePath() {

  try {

    const role =
      localStorage.getItem(
        "ht_role"
      ) || "";

    if (
      role === "finance" ||
      role === "admin" ||
      role === "super_admin"
    ) {
      return "/dash/finance";
    }

  } catch {}

  return "/dash/membership";
}

/* =========================================================
   PAGE
========================================================= */

export default function InvoiceViewPage() {

  const navigate =
    useNavigate();

  const {
    invoiceNumber,
  } = useParams();

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [invoice, setInvoice] =
    useState(null);

  /* =====================================================
     LOAD
  ===================================================== */

  useEffect(() => {

    let mounted = true;

    async function loadInvoice() {

      try {

        setLoading(true);
        setError("");

        const roleBase =
          getRoleBasePath();

        const isFinance =
          roleBase ===
          "/dash/finance";

        const endpoint =
          isFinance
            ? `/finance/invoices/${encodeURIComponent(
                invoiceNumber
              )}`
            : `/member/invoices/${encodeURIComponent(
                invoiceNumber
              )}`;

        const res =
          await api.get(
            endpoint
          );

        if (!mounted) {
          return;
        }

        if (
          !res.data?.ok
        ) {
          throw new Error(
            res.data?.error ||
              "Invoice not found."
          );
        }

        setInvoice(
          res.data.row ||
            null
        );

      } catch (err) {

        console.error(
          "Invoice load error:",
          err
        );

        if (!mounted) {
          return;
        }

        setError(
          err?.response?.data
            ?.error ||
            err.message ||
            "Failed to load invoice."
        );

      } finally {

        if (mounted) {
          setLoading(false);
        }

      }
    }

    if (invoiceNumber) {
      loadInvoice();
    }

    return () => {
      mounted = false;
    };

  }, [invoiceNumber]);

  /* =====================================================
     ACTIONS
  ===================================================== */

  function handleBack() {

    const roleBase =
      getRoleBasePath();

    navigate(
      `${roleBase}/my-payments/invoices`
    );
  }

  function handlePdf() {

    const roleBase =
      getRoleBasePath();

    const isFinance =
      roleBase ===
      "/dash/finance";

    const endpoint =
      isFinance
        ? `/api/finance/invoices/${encodeURIComponent(
            invoiceNumber
          )}/pdf`
        : `/api/member/invoices/${encodeURIComponent(
            invoiceNumber
          )}/pdf`;

    window.open(
      endpoint,
      "_blank"
    );
  }

  /* =====================================================
     SUMMARY
  ===================================================== */

  const summary =
    useMemo(() => {

      if (!invoice) {
        return [];
      }

      return [

        {
          label:
            "Invoice #",

          value:
            invoice.invoice_number,
        },

        {
          label:
            "Status",

          value:
            pretty(
              invoice.status
            ),
        },

        {
          label:
            "Invoice Date",

          value:
            formatDate(
              invoice.invoice_date
            ),
        },

        {
          label:
            "Due Date",

          value:
            formatDate(
              invoice.due_date
            ),
        },

        {
          label:
            "Coverage",

          value:
            invoice.period_label ||
            "--",
        },

        {
          label:
            "Balance Due",

          value:
            money(
              invoice.balance_due
            ),
        },

      ];

    }, [invoice]);

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {

    return (
      <div className="invoice-loading-page">

        <div className="invoice-loading-card">

          <div className="invoice-loader" />

          <h3>
            Loading Invoice
          </h3>

          <p>
            Preparing enterprise invoice...
          </p>

        </div>

      </div>
    );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (error) {

    return (
      <div className="invoice-loading-page">

        <div className="invoice-error-card">

          <div className="invoice-error-icon">
            !
          </div>

          <h3>
            Invoice Not Found
          </h3>

          <p>
            {error}
          </p>

          <button
            type="button"
            className="invoice-btn invoice-btn-secondary"
            onClick={handleBack}
          >
            Back
          </button>

        </div>

      </div>
    );
  }

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="invoice-page">

      {/* =================================================
          TOOLBAR
      ================================================= */}

      <div className="invoice-toolbar">

        <div className="invoice-toolbar-left">

          <button
            type="button"
            className="invoice-btn invoice-btn-secondary"
            onClick={handleBack}
          >
            ← Back
          </button>

        </div>

        <div className="invoice-toolbar-right">

          <button
            type="button"
            className="invoice-btn invoice-btn-primary"
            onClick={handlePdf}
          >
            Download PDF
          </button>

          <button
            type="button"
            className="invoice-btn invoice-btn-dark"
            onClick={() =>
              window.print()
            }
          >
            Print
          </button>

        </div>

      </div>

      {/* =================================================
          MAIN
      ================================================= */}

      <div className="invoice-shell">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="invoice-header">

          <div>

            <h1>
              Holy Trinity Ethiopian Orthodox Church
            </h1>

            <p>
              Enterprise Invoice
            </p>

          </div>

          <div className="invoice-status">

            {pretty(
              invoice.status
            )}

          </div>

        </div>

        {/* =================================================
            MEMBER
        ================================================= */}

        <div className="invoice-grid">

          <div className="invoice-card">

            <div className="invoice-card-title">
              Billed To
            </div>

            <div className="invoice-member-name">
              {
                invoice.full_name
              }
            </div>

            <div className="invoice-meta-grid">

              <div>
                <span>
                  Member #
                </span>

                <strong>
                  {
                    invoice.member_no
                  }
                </strong>
              </div>

              <div>
                <span>
                  Email
                </span>

                <strong>
                  {
                    invoice.email
                  }
                </strong>
              </div>

              <div>
                <span>
                  Phone
                </span>

                <strong>
                  {
                    invoice.phone
                  }
                </strong>
              </div>

            </div>

          </div>

          <div className="invoice-card">

            <div className="invoice-card-title">
              Invoice Summary
            </div>

            <div className="invoice-summary-grid">

              {summary.map(
                (item) => (
                  <div
                    key={
                      item.label
                    }
                    className="invoice-summary-item"
                  >
                    <span>
                      {
                        item.label
                      }
                    </span>

                    <strong>
                      {
                        item.value
                      }
                    </strong>
                  </div>
                )
              )}

            </div>

          </div>

        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="invoice-table-wrap">

          <table className="invoice-table">

            <thead>

              <tr>

                <th>
                  Description
                </th>

                <th>
                  Category
                </th>

                <th>
                  Coverage
                </th>

                <th>
                  Amount
                </th>

              </tr>

            </thead>

            <tbody>

              <tr>

                <td>
                  {
                    invoice.description ||
                    "Membership Payment"
                  }
                </td>

                <td>
                  {pretty(
                    invoice.invoice_type ||
                      invoice.category
                  )}
                </td>

                <td>
                  {
                    invoice.period_label ||
                    "--"
                  }
                </td>

                <td className="invoice-money">
                  {money(
                    invoice.total_amount
                  )}
                </td>

              </tr>

            </tbody>

            <tfoot>

              <tr>

                <td
                  colSpan={3}
                >
                  TOTAL
                </td>

                <td className="invoice-total-cell">
                  {money(
                    invoice.total_amount
                  )}
                </td>

              </tr>

            </tfoot>

          </table>

        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="invoice-footer">

          <div className="invoice-footer-left">

            <h4>
              Notes
            </h4>

            <p>
              {
                invoice.notes ||
                "Thank you for supporting the church ministry."
              }
            </p>

          </div>

          <div className="invoice-footer-right">

            <div className="invoice-total-box">

              <span>
                Balance Due
              </span>

              <strong>
                {money(
                  invoice.balance_due
                )}
              </strong>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}