// frontend/src/components/FinanceDashboard/pages/FinanceAuditLogs.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ShieldCheck,
  Search,
  RefreshCcw,
  Download,
  Calendar,
  User,
  FileText,
  AlertTriangle,
  Eye,
} from "lucide-react";

import FinanceBadge from "../components/../../Shared/FinanceBadge";

import "../../../styles/shared-payment-components.css";
// import "../finance-dashboard.css";

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

export default function FinanceAuditLogs() {

  const [loading, setLoading] =
    useState(false);

  const [rows, setRows] =
    useState([]);

  const [stats, setStats] =
    useState(null);

  const [selected, setSelected] =
    useState(null);

  const [filters, setFilters] =
    useState({
      search: "",
      actor_id: "",
      action_type: "",
      entity_type: "",
      date_from: "",
      date_to: "",
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
          `/api/finance/audit-logs?${params.toString()}`,
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
          "Failed to load audit logs."
        );
      }

      setRows(
        data.rows || []
      );

      setStats(
        data.stats || null
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

  const totals =
    useMemo(() => {

      return {

        total:
          rows.length,

        reversals:
          rows.filter(
            (r) =>
              String(
                r.action_type || ""
              ).includes(
                "reverse"
              )
          ).length,

        exports:
          rows.filter(
            (r) =>
              String(
                r.action_type || ""
              ).includes(
                "export"
              )
          ).length,

        reconciliations:
          rows.filter(
            (r) =>
              String(
                r.action_type || ""
              ).includes(
                "reconcile"
              )
          ).length,
      };

    }, [rows]);

  return (
    <div className="finance-enterprise-page">

      <div className="finance-page-header">

        <div>

          <h1>
            Finance Audit Logs
          </h1>

          <p>
            Enterprise-grade
            finance audit,
            accountability,
            reconciliation,
            adjustments,
            exports,
            and accounting
            activity tracking.
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
                "/api/finance/audit-logs/export",
                "_blank"
              )
            }
          >
            <Download size={16} />
            Export
          </button>

        </div>

      </div>

      <div className="finance-summary-grid">

        <div className="finance-summary-card finance-summary-card-primary">

          <div className="finance-summary-card-top">
            <ShieldCheck size={18} />
            <span>
              Audit Events
            </span>
          </div>

          <strong>
            {totals.total}
          </strong>

        </div>

        <div className="finance-summary-card finance-summary-card-warning">

          <div className="finance-summary-card-top">
            <AlertTriangle size={18} />
            <span>
              Reversals
            </span>
          </div>

          <strong>
            {totals.reversals}
          </strong>

        </div>

        <div className="finance-summary-card finance-summary-card-success">

          <div className="finance-summary-card-top">
            <Download size={18} />
            <span>
              Exports
            </span>
          </div>

          <strong>
            {totals.exports}
          </strong>

        </div>

        <div className="finance-summary-card">

          <div className="finance-summary-card-top">
            <FileText size={18} />
            <span>
              Reconciliations
            </span>
          </div>

          <strong>
            {totals.reconciliations}
          </strong>

        </div>

      </div>

      <div className="finance-section-card">

        <div className="finance-section-title">

          <Search size={16} />

          <span>
            Audit Filters
          </span>

        </div>

        <div className="finance-grid finance-grid-5">

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
            />

          </div>

          <div className="finance-field">

            <label>
              Actor ID
            </label>

            <input
              value={
                filters.actor_id
              }
              onChange={(e) =>
                setFilters(
                  (prev) => ({
                    ...prev,
                    actor_id:
                      e.target.value,
                  })
                )
              }
            />

          </div>

          <div className="finance-field">

            <label>
              Action
            </label>

            <input
              value={
                filters.action_type
              }
              onChange={(e) =>
                setFilters(
                  (prev) => ({
                    ...prev,
                    action_type:
                      e.target.value,
                  })
                )
              }
            />

          </div>

          <div className="finance-field">

            <label>
              Entity
            </label>

            <input
              value={
                filters.entity_type
              }
              onChange={(e) =>
                setFilters(
                  (prev) => ({
                    ...prev,
                    entity_type:
                      e.target.value,
                  })
                )
              }
            />

          </div>

          <div className="finance-field finance-field-end">

            <button
              className="finance-btn finance-btn-primary"
              onClick={loadData}
            >
              Apply
            </button>

          </div>

        </div>

      </div>

      <div className="finance-table-card">

        <div className="finance-table-wrap">

          <table className="finance-table">

            <thead>

              <tr>

                <th>
                  Date
                </th>

                <th>
                  Actor
                </th>

                <th>
                  Action
                </th>

                <th>
                  Entity
                </th>

                <th>
                  Entity ID
                </th>

                <th>
                  IP
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
                    Loading...
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
                      No audit logs found.
                    </td>
                  </tr>
                )}

              {!loading &&
                rows.map(
                  (row) => (

                    <tr
                      key={
                        row.id
                      }
                    >

                      <td>
                        {formatDate(
                          row.created_at
                        )}
                      </td>

                      <td>

                        <div className="finance-inline-icon">

                          <User size={14} />

                          <span>
                            {row.actor_id ||
                              "--"}
                          </span>

                        </div>

                      </td>

                      <td>

                        <FinanceBadge
                          label={pretty(
                            row.action_type
                          )}
                          type="primary"
                        />

                      </td>

                      <td>
                        {pretty(
                          row.entity_type
                        )}
                      </td>

                      <td>
                        {row.entity_id ||
                          "--"}
                      </td>

                      <td>
                        {row.ip_address ||
                          "--"}
                      </td>

                      <td>

                        <button
                          className="finance-btn finance-btn-xs"
                          onClick={() =>
                            setSelected(
                              row
                            )
                          }
                        >
                          <Eye size={14} />
                        </button>

                      </td>

                    </tr>
                  )
                )}

            </tbody>

          </table>

        </div>

      </div>

      {selected && (

        <div className="finance-drawer-overlay">

          <div className="finance-drawer finance-drawer-lg">

            <div className="finance-drawer-header">

              <div>

                <h2>
                  Audit Event
                </h2>

                <p>
                  Enterprise
                  audit activity
                  details and
                  accounting traceability.
                </p>

              </div>

              <button
                className="finance-icon-btn"
                onClick={() =>
                  setSelected(
                    null
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="finance-drawer-body">

              <div className="finance-detail-grid">

                <div className="finance-detail-card">

                  <div className="finance-detail-list">

                    <div className="finance-detail-row">
                      <span>
                        Action
                      </span>

                      <strong>
                        {pretty(
                          selected.action_type
                        )}
                      </strong>
                    </div>

                    <div className="finance-detail-row">
                      <span>
                        Entity
                      </span>

                      <strong>
                        {pretty(
                          selected.entity_type
                        )}
                      </strong>
                    </div>

                    <div className="finance-detail-row">
                      <span>
                        Entity ID
                      </span>

                      <strong>
                        {selected.entity_id}
                      </strong>
                    </div>

                    <div className="finance-detail-row">
                      <span>
                        Actor
                      </span>

                      <strong>
                        {selected.actor_id}
                      </strong>
                    </div>

                    <div className="finance-detail-row">
                      <span>
                        IP Address
                      </span>

                      <strong>
                        {selected.ip_address ||
                          "--"}
                      </strong>
                    </div>

                    <div className="finance-detail-row">
                      <span>
                        Created
                      </span>

                      <strong>
                        {formatDate(
                          selected.created_at
                        )}
                      </strong>
                    </div>

                  </div>

                </div>

              </div>

              <div className="finance-detail-card">

                <div className="finance-detail-card-title">
                  <FileText size={16} />
                  <span>
                    Metadata
                  </span>
                </div>

                <pre className="finance-json-view">
{JSON.stringify(
  selected.metadata_json || {},
  null,
  2
)}
                </pre>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}