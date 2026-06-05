// //frontend\src\components\receipts\ChurchReceiptPreview.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import api from "../api";

import ChurchReceiptTemplate from "./ChurchReceiptTemplate";

import {
  sampleDonationReceipt,
  sampleMembershipReceipt,
  sampleSchoolReceipt,
  sampleTripReceipt,
} from "./receiptSampleData";

import "../../styles/church-receipt.css";

/* =========================================================
   STATES
========================================================= */

function LoadingState() {
  return (
    <div className="receipt-preview-state-card">
      <h2>
        Loading receipt...
      </h2>

      <p>
        Please wait while
        we prepare your
        receipt preview.
      </p>
    </div>
  );
}

function ErrorState({
  message,
  onBack,
  onUseSample,
}) {
  return (
    <div className="receipt-preview-state-card receipt-preview-state-card-error">
      <h2>
        Unable to load
        receipt
      </h2>

      <p>{message}</p>

      <div className="receipt-preview-state-actions">
        <button
          type="button"
          className="receipt-toolbar-btn receipt-toolbar-btn-secondary"
          onClick={onBack}
        >
          Go Back
        </button>

        <button
          type="button"
          className="receipt-toolbar-btn receipt-toolbar-btn-primary"
          onClick={onUseSample}
        >
          Open Sample
          Receipt
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function ChurchReceiptPreview() {
  const navigate =
    useNavigate();

  const {
    receiptNo = "",
  } = useParams();

  const [searchParams] =
    useSearchParams();

  const scope = String(
    searchParams.get(
      "scope"
    ) || "member"
  ).toLowerCase();

  const [mode, setMode] =
    useState("live");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [payload, setPayload] =
    useState(null);

  /* =========================================================
     LOAD RECEIPT
  ========================================================= */

  useEffect(() => {
    let active = true;

    async function loadReceipt() {
      if (!receiptNo) {
        setLoading(false);

        setError(
          "Receipt number is missing."
        );

        return;
      }

      try {
        setLoading(true);
        setError("");

        const endpoint =
          scope ===
          "finance"
            ? `/finance/receipts/${encodeURIComponent(
                receiptNo
              )}`

            : `/member/receipts/${encodeURIComponent(
                receiptNo
              )}`;

        const {
          data,
        } = await api.get(
          endpoint
        );

        if (!active)
          return;

        if (
          data?.receipt &&
          data?.church
        ) {
          setPayload({
            church:
              data.church,

            receipt:
              data.receipt,
          });

          setMode("live");
        } else {
          setError(
            "Receipt payload was returned without valid template data."
          );
        }
      } catch (err) {
        if (!active)
          return;

        console.error(
          "Failed to load live receipt:",
          err
        );

        setError(
          err?.response
            ?.data?.error ||
            "Failed to load receipt preview."
        );
      } finally {
        if (active)
          setLoading(false);
      }
    }

    loadReceipt();

    return () => {
      active = false;
    };
  }, [receiptNo, scope]);

  /* =========================================================
     SAMPLE RECEIPTS
  ========================================================= */

  const sampleData =
    useMemo(() => {
      switch (mode) {
        case "donation":
          return sampleDonationReceipt;

        case "school":
          return sampleSchoolReceipt;

        case "trip":
          return sampleTripReceipt;

        default:
          return sampleMembershipReceipt;
      }
    }, [mode]);

  /* =========================================================
     DISPLAY
  ========================================================= */

  const displayData =
    mode === "live" &&
    payload?.church &&
    payload?.receipt
      ? payload
      : sampleData;

  const canPrint =
    !!displayData?.receipt;

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="receipt-preview-shell">
      {/* =========================================
          TOOLBAR
      ========================================= */}

      <div className="receipt-toolbar">
        <div className="receipt-toolbar-left">
          <button
            type="button"
            className="receipt-toolbar-btn receipt-toolbar-btn-secondary"
            onClick={() =>
              navigate(-1)
            }
          >
            Back
          </button>

          <button
            type="button"
            className="receipt-toolbar-btn"
            onClick={() =>
              setMode("live")
            }
            disabled={
              !payload
            }
            data-active={
              mode === "live"
            }
          >
            Live Receipt
          </button>

          <button
            type="button"
            className="receipt-toolbar-btn"
            onClick={() =>
              setMode(
                "membership"
              )
            }
            data-active={
              mode ===
              "membership"
            }
          >
            Membership
          </button>

          <button
            type="button"
            className="receipt-toolbar-btn"
            onClick={() =>
              setMode(
                "donation"
              )
            }
            data-active={
              mode ===
              "donation"
            }
          >
            Donation
          </button>

          <button
            type="button"
            className="receipt-toolbar-btn"
            onClick={() =>
              setMode(
                "school"
              )
            }
            data-active={
              mode ===
              "school"
            }
          >
            School
          </button>

          <button
            type="button"
            className="receipt-toolbar-btn"
            onClick={() =>
              setMode(
                "trip"
              )
            }
            data-active={
              mode ===
              "trip"
            }
          >
            Trip
          </button>
        </div>

        <div className="receipt-toolbar-right">
          <button
            type="button"
            className="receipt-toolbar-btn receipt-toolbar-btn-primary"
            onClick={() => {
              if (
                canPrint
              ) {
                window.print();
              }
            }}
            disabled={
              !canPrint
            }
          >
            Print Receipt
          </button>
        </div>
      </div>

      {/* =========================================
          STATES
      ========================================= */}

      {loading ? (
        <LoadingState />
      ) : error &&
        !payload ? (
        <ErrorState
          message={
            error
          }
          onBack={() =>
            navigate(-1)
          }
          onUseSample={() =>
            setMode(
              "membership"
            )
          }
        />
      ) : (
        <ChurchReceiptTemplate
          church={
            displayData?.church ||
            {}
          }
          receipt={
            displayData?.receipt ||
            {}
          }
        />
      )}
    </div>
  );
}