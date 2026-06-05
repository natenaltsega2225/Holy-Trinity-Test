

 // frontend\src\pages\ReceiptViewPage.jsx
 // src/pages/ReceiptViewPage.jsx

import React, {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import api from "../components/api";

import ReceiptPreview from "../components/receipts/ReceiptPreview";

import "../styles/receipt.css";

/* =========================================================
   HELPERS
========================================================= */

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

export default function ReceiptViewPage() {

  const navigate =
    useNavigate();

  const {
    receiptNumber,
    receiptNo,
  } = useParams();

  const receiptId =
    receiptNumber ||
    receiptNo;

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    receiptData,
    setReceiptData,
  ] = useState(null);

  /* =====================================================
     LOAD RECEIPT
  ===================================================== */

  useEffect(() => {

    let mounted = true;

    async function loadReceipt() {

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
            ? `/finance/receipts/${encodeURIComponent(
                receiptId
              )}`
            : `/member/receipts/${encodeURIComponent(
                receiptId
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
              "Receipt not found."
          );
        }

        setReceiptData(
          res.data.receipt
        );

      } catch (err) {

        console.error(
          "Receipt load error:",
          err
        );

        if (!mounted) {
          return;
        }

        setError(
          err?.response?.data
            ?.error ||
            err.message ||
            "Failed to load receipt."
        );

      } finally {

        if (mounted) {
          setLoading(false);
        }

      }
    }

    if (receiptId) {
      loadReceipt();
    }

    return () => {
      mounted = false;
    };

  }, [receiptId]);

  /* =====================================================
     DOWNLOAD PDF
  ===================================================== */

  function handleDownloadPdf() {

    const roleBase =
      getRoleBasePath();

    const isFinance =
      roleBase ===
      "/dash/finance";

    const endpoint =
      isFinance
        ? `/api/finance/receipts/${encodeURIComponent(
            receiptId
          )}/pdf`
        : `/api/member/receipts/${encodeURIComponent(
            receiptId
          )}/pdf`;

    window.open(
      endpoint,
      "_blank"
    );
  }

  /* =====================================================
     BACK
  ===================================================== */

  function handleBack() {

    const roleBase =
      getRoleBasePath();

    navigate(
      `${roleBase}/my-payments/history`
    );
  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {

    return (
      <div className="receipt-loading-page">

        <div className="receipt-loading-card">

          <div className="receipt-loader" />

          <h3>
            Loading Receipt
          </h3>

          <p>
            Preparing enterprise payment receipt...
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
      <div className="receipt-loading-page">

        <div className="receipt-error-card">

          <div className="receipt-error-icon">
            !
          </div>

          <h3>
            Receipt Not Available
          </h3>

          <p>
            {error}
          </p>

          <div className="receipt-error-actions">

            <button
              type="button"
              className="receipt-btn receipt-btn-secondary"
              onClick={handleBack}
            >
              Back
            </button>

          </div>

        </div>

      </div>
    );
  }

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="receipt-view-page">

      {/* =================================================
          TOP ACTION BAR
      ================================================= */}

      <div className="receipt-toolbar">

        <div className="receipt-toolbar-left">

          <button
            type="button"
            className="receipt-btn receipt-btn-secondary"
            onClick={handleBack}
          >
            ← Back
          </button>

        </div>

        <div className="receipt-toolbar-right">

          <button
            type="button"
            className="receipt-btn receipt-btn-primary"
            onClick={handleDownloadPdf}
          >
            Download PDF
          </button>

          <button
            type="button"
            className="receipt-btn receipt-btn-dark"
            onClick={() =>
              window.print()
            }
          >
            Print
          </button>

        </div>

      </div>

      {/* =================================================
          RECEIPT PREVIEW
      ================================================= */}

      <ReceiptPreview
        receiptData={
          receiptData
        }
      />

    </div>
  );
}