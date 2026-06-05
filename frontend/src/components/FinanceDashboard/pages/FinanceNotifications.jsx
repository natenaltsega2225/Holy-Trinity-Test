// frontend/src/components/FinanceDashboard/pages/FinanceNotifications.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Bell,
  RefreshCcw,
  Search,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RotateCcw,
  Trash2,
  Send,
} from "lucide-react";

import "../../../styles/shared-payment-components.css";
import "../../../styles/finance-dashboard.css";

/* =========================================================
   HELPERS
========================================================= */

function pretty(value) {

  return String(
    value || ""
  )
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) =>
      m.toUpperCase()
    );
}

function formatDate(value) {

  if (!value)
    return "--";

  return new Date(
    value
  ).toLocaleString();
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceNotifications() {

  const [loading, setLoading] =
    useState(false);

  const [rows, setRows] =
    useState([]);

  const [filters, setFilters] =
    useState({
      search: "",
      status: "",
      type: "",
    });

  /* =======================================================
     LOAD
  ======================================================= */

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
          `/api/finance/notifications?${params.toString()}`,
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
          "Failed to load notifications."
        );
      }

      setRows(
        data.rows || []
      );

    } catch (err) {

      console.error(err);

    } finally {

      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /* =======================================================
     STATS
  ======================================================= */

  const stats =
    useMemo(() => {

      return {

        total:
          rows.length,

        sent:
          rows.filter(
            (r) =>
              r.status ===
              "sent"
          ).length,

        failed:
          rows.filter(
            (r) =>
              r.status ===
              "failed"
          ).length,

        retrying:
          rows.filter(
            (r) =>
              r.status ===
              "retrying"
          ).length,
      };

    }, [rows]);

  /* =======================================================
     RETRY
  ======================================================= */

  async function retryNotification(
    id
  ) {

    try {

      const res =
        await fetch(
          `/api/finance/notifications/retry/${id}`,
          {
            method:
              "POST",

            credentials:
              "include",
          }
        );

      const data =
        await res.json();

      if (!res.ok) {

        throw new Error(
          data.error ||
          "Retry failed."
        );
      }

      await loadData();

    } catch (err) {

      console.error(err);

      alert(
        err.message
      );
    }
  }

  /* =======================================================
     DELETE
  ======================================================= */

  async function deleteNotification(
    id
  ) {

    const ok =
      window.confirm(
        "Delete this notification?"
      );

    if (!ok)
      return;

    try {

      const res =
        await fetch(
          `/api/finance/notifications/${id}`,
          {
            method:
              "DELETE",

            credentials:
              "include",
          }
        );

      const data =
        await res.json();

      if (!res.ok) {

        throw new Error(
          data.error ||
          "Delete failed."
        );
      }

      await loadData();

    } catch (err) {

      console.error(err);

      alert(
        err.message
      );
    }
  }

  /* =======================================================
     STATUS BADGE
  ======================================================= */

  function renderStatus(
    status
  ) {

    const normalized =
      String(
        status || ""
      ).toLowerCase();

    if (
      normalized ===
      "sent"
    ) {

      return (
        <span className="finance-badge finance-badge-success">

          <CheckCircle2 size={12} />

          Sent

        </span>
      );
    }

    if (
      normalized ===
      "failed"
    ) {

      return (
        <span className="finance-badge finance-badge-danger">

          <AlertTriangle size={12} />

          Failed

        </span>
      );
    }

    if (
      normalized ===
      "retrying"
    ) {

      return (
        <span className="finance-badge finance-badge-warning">

          <RotateCcw size={12} />

          Retrying

        </span>
      );
    }

    return (
      <span className="finance-badge">

        <Clock3 size={12} />

        Pending

      </span>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (

    <div className="finance-enterprise-page">

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="finance-page-header">

        <div>

          <h1>
            Finance Notifications
          </h1>

          <p>
            Enterprise finance
            email delivery,
            invoice delivery,
            receipt delivery,
            retries,
            failures,
            and notification tracking.
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

        </div>

      </div>

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <div className="finance-summary-grid">

        <div className="finance-summary-card finance-summary-card-primary">

          <div className="finance-summary-card-top">

            <Bell size={18} />

            <span>
              Notifications
            </span>

          </div>

          <strong>
            {stats.total}
          </strong>

        </div>

        <div className="finance-summary-card finance-summary-card-success">

          <div className="finance-summary-card-top">

            <CheckCircle2 size={18} />

            <span>
              Sent
            </span>

          </div>

          <strong>
            {stats.sent}
          </strong>

        </div>

        <div className="finance-summary-card finance-summary-card-danger">

          <div className="finance-summary-card-top">

            <AlertTriangle size={18} />

            <span>
              Failed
            </span>

          </div>

          <strong>
            {stats.failed}
          </strong>

        </div>

        <div className="finance-summary-card finance-summary-card-warning">

          <div className="finance-summary-card-top">

            <RotateCcw size={18} />

            <span>
              Retrying
            </span>

          </div>

          <strong>
            {stats.retrying}
          </strong>

        </div>

      </div>

      {/* ===================================================
          FILTERS
      =================================================== */}

      <div className="finance-section-card">

        <div className="finance-section-title">

          <Search size={16} />

          <span>
            Notification Filters
          </span>

        </div>

        <div className="finance-grid finance-grid-4">

          <div className="finance-field">

            <label>
              Search
            </label>

            <input
              value={
                filters.search
              }
              onChange={(e) =>
                setFilters(
                  (prev) => ({
                    ...prev,
                    search:
                      e.target.value,
                  })
                )
              }
              placeholder="Search..."
            />

          </div>

          <div className="finance-field">

            <label>
              Status
            </label>

            <select
              value={
                filters.status
              }
              onChange={(e) =>
                setFilters(
                  (prev) => ({
                    ...prev,
                    status:
                      e.target.value,
                  })
                )
              }
            >

              <option value="">
                All
              </option>

              <option value="sent">
                Sent
              </option>

              <option value="failed">
                Failed
              </option>

              <option value="retrying">
                Retrying
              </option>

            </select>

          </div>

          <div className="finance-field">

            <label>
              Type
            </label>

            <select
              value={
                filters.type
              }
              onChange={(e) =>
                setFilters(
                  (prev) => ({
                    ...prev,
                    type:
                      e.target.value,
                  })
                )
              }
            >

              <option value="">
                All
              </option>

              <option value="receipt_email">
                Receipt Email
              </option>

              <option value="invoice_email">
                Invoice Email
              </option>

            </select>

          </div>

          <div className="finance-field finance-field-end">

            <button
              className="finance-btn finance-btn-primary"
              onClick={loadData}
            >
              Apply Filters
            </button>

          </div>

        </div>

      </div>

      {/* ===================================================
          TABLE
      =================================================== */}

      <div className="finance-table-card">

        <div className="finance-table-wrap">

          <table className="finance-table">

            <thead>

              <tr>

                <th>
                  Type
                </th>

                <th>
                  Recipient
                </th>

                <th>
                  Subject
                </th>

                <th>
                  Status
                </th>

                <th>
                  Retry Count
                </th>

                <th>
                  Created
                </th>

                <th>
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {loading && (

                <tr>

                  <td
                    colSpan="7"
                    className="finance-empty-cell"
                  >
                    Loading notifications...
                  </td>

                </tr>
              )}

              {!loading &&
                rows.length === 0 && (

                  <tr>

                    <td
                      colSpan="7"
                      className="finance-empty-cell"
                    >
                      No notifications found.
                    </td>

                  </tr>
                )}

              {!loading &&
                rows.map(
                  (row) => (

                    <tr
                      key={row.id}
                    >

                      <td>

                        <div className="finance-inline-icon">

                          <Mail size={14} />

                          <span>
                            {pretty(
                              row.notification_type
                            )}
                          </span>

                        </div>

                      </td>

                      <td>
                        {row.recipient_email ||
                          "--"}
                      </td>

                      <td>
                        {row.subject ||
                          "--"}
                      </td>

                      <td>
                        {renderStatus(
                          row.status
                        )}
                      </td>

                      <td>
                        {row.retry_count ||
                          0}
                      </td>

                      <td>
                        {formatDate(
                          row.created_at
                        )}
                      </td>

                      <td>

                        <div className="finance-table-actions">

                          <button
                            className="finance-btn finance-btn-xs finance-btn-warning"
                            onClick={() =>
                              retryNotification(
                                row.id
                              )
                            }
                          >

                            <RotateCcw size={14} />

                          </button>

                          <button
                            className="finance-btn finance-btn-xs finance-btn-danger"
                            onClick={() =>
                              deleteNotification(
                                row.id
                              )
                            }
                          >

                            <Trash2 size={14} />

                          </button>

                        </div>

                      </td>

                    </tr>
                  )
                )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}