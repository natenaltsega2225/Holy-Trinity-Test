// frontend/src/components/FinanceDashboard/components/FinanceBulkReceiptSender.jsx

import React, {
  useMemo,
  useState,
} from "react";

import api from "../../api";

import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Users,
} from "lucide-react";

// import "../finance-dashboard.css";

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceBulkReceiptSender({

  rows = [],

  onSuccess,
}) {

  /* =====================================================
     STATE
  ===================================================== */

  const [loading,
    setLoading] =
      useState(false);

  const [error,
    setError] =
      useState("");

  const [success,
    setSuccess] =
      useState("");

  const [subject,
    setSubject] =
      useState(
        "Your Contribution Receipt"
      );

  const [message,
    setMessage] =
      useState(`
Dear Member,

Please find your receipt attached.

Thank you for your continued support and contribution.

Holy Trinity Finance Office
      `.trim()
      );

  const [includePdf,
    setIncludePdf] =
      useState(true);

  const [selectedRows,
    setSelectedRows] =
      useState([]);

  /* =====================================================
     SELECT
  ===================================================== */

  function toggleRow(id) {

    setSelectedRows(
      (prev) => {

        if (
          prev.includes(id)
        ) {

          return prev.filter(
            (x) =>
              x !== id
          );
        }

        return [
          ...prev,
          id,
        ];
      }
    );
  }

  function toggleAll() {

    if (
      selectedRows.length ===
      rows.length
    ) {

      setSelectedRows([]);

      return;
    }

    setSelectedRows(
      rows.map(
        (r) => r.id
      )
    );
  }

  /* =====================================================
     COMPUTED
  ===================================================== */

  const selectedData =
    useMemo(() => {

      return rows.filter(
        (r) =>
          selectedRows.includes(
            r.id
          )
      );

    }, [
      rows,
      selectedRows,
    ]);

  /* =====================================================
     SEND
  ===================================================== */

  async function handleSend() {

    try {

      setLoading(true);

      setError("");

      setSuccess("");

      await api.post(

        "/finance/receipts/bulk-send",

        {
          rows:
            selectedData,

          subject,

          message,

          include_pdf:
            includePdf,
        }
      );

      setSuccess(
        "Bulk receipts successfully sent."
      );

      onSuccess?.();

    } catch (err) {

      console.error(err);

      setError(

        err?.response?.data
          ?.error ||

        "Unable to send bulk receipts."
      );

    } finally {

      setLoading(false);
    }
  }

  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="finance-bulk-receipt">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="finance-bulk-head">

        <div className="finance-bulk-title">

          <Users size={20} />

          <div>

            <h2>
              Bulk Receipt Sender
            </h2>

            <p>

              Enterprise mass
              donor communication
              and receipt delivery.

            </p>

          </div>

        </div>

      </div>

      {/* =====================================
          ALERTS
      ===================================== */}

      {error ? (

        <div className="finance-alert error">

          <AlertTriangle size={16} />

          {error}

        </div>

      ) : null}

      {success ? (

        <div className="finance-alert success">

          <CheckCircle2 size={16} />

          {success}

        </div>

      ) : null}

      {/* =====================================
          META
      ===================================== */}

      <div className="finance-bulk-meta">

        <div className="finance-summary-box">

          <span>
            Total Recipients
          </span>

          <strong>

            {rows.length}

          </strong>

        </div>

        <div className="finance-summary-box">

          <span>
            Selected
          </span>

          <strong>

            {
              selectedRows.length
            }

          </strong>

        </div>

      </div>

      {/* =====================================
          EMAIL SETTINGS
      ===================================== */}

      <div className="finance-field">

        <label>
          Email Subject
        </label>

        <input
          value={subject}
          onChange={(e) =>
            setSubject(
              e.target.value
            )
          }
        />

      </div>

      <div className="finance-field">

        <label>
          Email Message
        </label>

        <textarea
          rows="8"
          value={message}
          onChange={(e) =>
            setMessage(
              e.target.value
            )
          }
        />

      </div>

      <div className="finance-checkbox-row">

        <input
          type="checkbox"
          checked={includePdf}
          onChange={(e) =>
            setIncludePdf(
              e.target.checked
            )
          }
        />

        <span>

          Attach PDF receipts

        </span>

      </div>

      {/* =====================================
          TABLE
      ===================================== */}

      <div className="finance-bulk-table-wrap">

        <table className="finance-bulk-table">

          <thead>

            <tr>

              <th>

                <input
                  type="checkbox"
                  checked={
                    selectedRows.length ===
                    rows.length
                  }
                  onChange={
                    toggleAll
                  }
                />

              </th>

              <th>
                Member
              </th>

              <th>
                Email
              </th>

              <th>
                Receipt #
              </th>

              <th>
                Amount
              </th>

            </tr>

          </thead>

          <tbody>

            {!rows.length ? (

              <tr>

                <td
                  colSpan="5"
                  className="finance-empty-state"
                >

                  No receipts found.

                </td>

              </tr>

            ) : null}

            {rows.map(
              (row) => (

                <tr
                  key={row.id}
                >

                  <td>

                    <input
                      type="checkbox"
                      checked={selectedRows.includes(
                        row.id
                      )}
                      onChange={() =>
                        toggleRow(
                          row.id
                        )
                      }
                    />

                  </td>

                  <td>

                    {row.full_name}

                  </td>

                  <td>

                    {row.email}

                  </td>

                  <td>

                    {
                      row.receipt_number
                    }

                  </td>

                  <td>

                    ${Number(
                      row.amount || 0
                    ).toFixed(2)}

                  </td>

                </tr>
              )
            )}

          </tbody>

        </table>

      </div>

      {/* =====================================
          FOOTER
      ===================================== */}

      <div className="finance-bulk-actions">

        <button
          className="finance-btn primary"
          onClick={
            handleSend
          }
          disabled={loading}
        >

          <Send size={16} />

          {loading
            ? "Sending..."
            : "Send Receipts"}

        </button>

      </div>

    </div>
  );
}