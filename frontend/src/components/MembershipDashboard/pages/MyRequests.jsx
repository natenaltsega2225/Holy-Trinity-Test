// frontend/src/components/MembershipDashoard/pages/MyRequests.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import "../../../styles/member-dashboard.css";

function formatDateTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(value) {
  if (!value) return "";
  const raw = String(value).slice(0, 10);
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw || String(value);
  return d.toLocaleDateString("en-US");
}

function formatTimeOnly(value) {
  if (!value) return "";
  const raw = String(value).slice(0, 5);
  const parts = raw.split(":");
  if (parts.length < 2) return raw;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return raw;

  const temp = new Date();
  temp.setHours(hours, minutes, 0, 0);

  return temp.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSchedule(date, time) {
  const d = formatDateOnly(date);
  const t = formatTimeOnly(time);

  if (!d && !t) return "--";
  if (d && t) return `${d} ${t}`;
  return d || t || "--";
}

function truncateText(value, max = 90) {
  const text = String(value || "").trim();
  if (!text) return "--";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function statusBadgeStyle(status) {
  const s = String(status || "").toLowerCase();

  if (s === "approved") {
    return {
      background: "var(--member-success-bg)",
      color: "var(--member-success-text)",
    };
  }

  if (s === "scheduled") {
    return {
      background: "#eef5ff",
      color: "var(--member-primary-strong)",
    };
  }

  if (s === "rejected" || s === "cancelled") {
    return {
      background: "var(--member-danger-bg)",
      color: "var(--member-danger-text)",
    };
  }

  if (s === "completed") {
    return {
      background: "#f1f5f9",
      color: "#475569",
    };
  }

  if (s === "in_review") {
    return {
      background: "#fff7e8",
      color: "#a16207",
    };
  }

  return {
    background: "#eef5ff",
    color: "var(--member-primary-strong)",
  };
}

function RequestStatusBadge({ status }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 12px",
        borderRadius: "999px",
        fontSize: "0.84rem",
        fontWeight: 700,
        textTransform: "capitalize",
        ...statusBadgeStyle(status),
      }}
    >
      {status || "--"}
    </span>
  );
}

function RequestDetailModal({ row, onClose, onPrint, onDownload }) {
  if (!row) return null;

  return (
    <div className="member-modal-overlay" onClick={onClose}>
      <div
        className="member-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="member-modal-head">
          <div>
            <h3>{row.form_name || "Request Detail"}</h3>
            <p>Review request details, admin response, and schedule.</p>
          </div>

          <button
            type="button"
            className="member-btn member-btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="member-request-detail-grid">
          <div>
            <span>Request Type</span>
            <strong>{row.form_name || "--"}</strong>
          </div>

          <div>
            <span>Status</span>
            <div>
              <RequestStatusBadge status={row.status} />
            </div>
          </div>

          <div>
            <span>Scheduled</span>
            <strong>{formatSchedule(row.scheduled_date, row.scheduled_time)}</strong>
          </div>

          <div>
            <span>Submitted</span>
            <strong>{formatDateTime(row.created_at)}</strong>
          </div>

          <div>
            <span>Updated</span>
            <strong>{formatDateTime(row.updated_at)}</strong>
          </div>

          <div className="full">
            <span>Admin Notes</span>
            <p>{row.admin_notes || "--"}</p>
          </div>

          <div className="full">
            <span>Explanation</span>
            <p>{row.admin_explanation || "--"}</p>
          </div>
        </div>

        <div className="member-modal-actions">
          <button
            type="button"
            className="member-btn member-btn-secondary member-btn-download"
            onClick={() => onDownload(row)}
          >
            Download
          </button>

          <button
            type="button"
            className="member-btn member-btn-primary"
            onClick={() => onPrint(row)}
          >
            Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyRequests() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [submittedStatus, setSubmittedStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedRow, setSelectedRow] = useState(null);

  async function loadRequests(
    nextPage = page,
    nextSearch = submittedSearch,
    nextStatus = submittedStatus
  ) {
    try {
      setLoading(true);
      setErrorText("");

      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("limit", String(limit));
      params.set("search", nextSearch || "");

      const { data } = await api.get(
        `/forms/member/my-requests?${params.toString()}`
      );

      let incomingRows = Array.isArray(data?.rows) ? data.rows : [];

      if (nextStatus) {
        incomingRows = incomingRows.filter(
          (row) =>
            String(row?.status || "").toLowerCase() ===
            nextStatus.toLowerCase()
        );
      }

      const backendTotal = Number(data?.total || 0);
      const filteredTotal = nextStatus ? incomingRows.length : backendTotal;

      setRows(incomingRows);
      setTotal(filteredTotal);
      setTotalPages(nextStatus ? 1 : Number(data?.totalPages || 1));
      setPage(nextStatus ? 1 : Number(data?.page || nextPage || 1));
    } catch (err) {
      console.error(err);
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setErrorText(
        err?.response?.data?.message || "Failed to load your requests."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests(1, "", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needsActionCount = useMemo(() => {
    return rows.filter((row) =>
      ["pending", "in_review", "scheduled"].includes(
        String(row?.status || "").toLowerCase()
      )
    ).length;
  }, [rows]);

  function handleApplyFilters() {
    setSubmittedSearch(search);
    setSubmittedStatus(statusFilter);
    setPage(1);
    loadRequests(1, search, statusFilter);
  }

  function handleResetFilters() {
    setSearch("");
    setSubmittedSearch("");
    setStatusFilter("");
    setSubmittedStatus("");
    setPage(1);
    loadRequests(1, "", "");
  }

  function handlePrev() {
    if (page <= 1 || Boolean(submittedStatus)) return;
    loadRequests(page - 1, submittedSearch, submittedStatus);
  }

  function handleNext() {
    if (page >= totalPages || Boolean(submittedStatus)) return;
    loadRequests(page + 1, submittedSearch, submittedStatus);
  }

  function handleDownload(row) {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            requestType: row.form_name || "--",
            status: row.status || "--",
            adminNotes: row.admin_notes || "--",
            explanation: row.admin_explanation || "--",
            scheduled: formatSchedule(row.scheduled_date, row.scheduled_time),
            submitted: formatDateTime(row.created_at),
            updated: formatDateTime(row.updated_at),
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${String(row.form_name || "request")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-${row.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handlePrint(row) {
    const content = `
      <html>
        <head>
          <title>${row.form_name || "Request Detail"}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f3552; }
            h1 { margin-bottom: 8px; color: #0f2d5c; }
            .meta { margin-bottom: 20px; color: #5b708b; }
            .section { margin-top: 20px; }
            .label { font-weight: bold; color: #0f2d5c; display: block; margin-bottom: 6px; }
            .box { border: 1px solid #dbe5f0; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
          </style>
        </head>
        <body>
          <h1>${row.form_name || "Request Detail"}</h1>
          <div class="meta">Holy Trinity EOTC Member Request</div>

          <div class="section">
            <div class="box"><span class="label">Status</span>${row.status || "--"}</div>
            <div class="box"><span class="label">Scheduled</span>${formatSchedule(
              row.scheduled_date,
              row.scheduled_time
            )}</div>
            <div class="box"><span class="label">Submitted</span>${formatDateTime(
              row.created_at
            )}</div>
            <div class="box"><span class="label">Updated</span>${formatDateTime(
              row.updated_at
            )}</div>
            <div class="box"><span class="label">Admin Notes</span>${row.admin_notes || "--"}</div>
            <div class="box"><span class="label">Explanation</span>${row.admin_explanation || "--"}</div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <div className="member-page">
      <section className="member-card">
        <div className="member-header">
          <div>
            <h1 className="member-header-title">My Requests</h1>
            <p className="member-header-subtitle">
              Track your submitted requests, admin responses, and scheduling
              updates.
            </p>
          </div>
        </div>
      </section>

      <section className="member-card member-card-compact">
        <div className="member-summary-grid">
          <div className="member-summary-box">
            <span className="member-summary-label">Total Requests</span>
            <strong>{total}</strong>
          </div>

          <div className="member-summary-box">
            <span className="member-summary-label">Visible On Page</span>
            <strong>{rows.length}</strong>
          </div>

          <div className="member-summary-box member-summary-box-highlight">
            <span className="member-summary-label">Needs Action / Review</span>
            <strong>{needsActionCount}</strong>
          </div>
        </div>
      </section>

      <section className="member-card member-card-filters">
        <div className="member-filters-grid">
          <div>
            <input
              className="member-input"
              type="text"
              placeholder="Search by request type, status, notes, explanation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <select
              className="member-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_review">In Review</option>
              <option value="approved">Approved</option>
              <option value="scheduled">Scheduled</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="member-filter-row">
          <button
            type="button"
            className="member-btn member-btn-primary"
            onClick={handleApplyFilters}
          >
            Apply Filters
          </button>

          <button
            type="button"
            className="member-btn member-btn-secondary"
            onClick={handleResetFilters}
          >
            Reset
          </button>
        </div>
      </section>

      <section className="member-card">
        {loading ? (
          <div className="member-empty">
            <h3>Loading requests...</h3>
          </div>
        ) : errorText ? (
          <div className="member-banner member-banner-error member-banner-inline">
            {errorText}
          </div>
        ) : rows.length === 0 ? (
          <div className="member-empty">
            <h3>No records found</h3>
            <p>Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="member-scroll-hint">
              Hold <strong>Shift</strong> and use the mouse wheel, or swipe
              left/right, to read more columns.
            </div>

            <div className="member-table-wrap member-table-wrap-scroll">
              <table className="member-table member-requests-table">
                <thead>
                  <tr>
                    <th>Request Type</th>
                    <th>Status</th>
                    <th>Admin Notes</th>
                    <th>Explanation</th>
                    <th>Scheduled</th>
                    <th>Submitted</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.form_name || "--"}</td>
                      <td>
                        <RequestStatusBadge status={row.status} />
                      </td>
                      <td className="member-request-text-cell">
                        <div className="member-request-preview">
                          {truncateText(row.admin_notes, 110)}
                        </div>
                      </td>
                      <td className="member-request-text-cell">
                        <div className="member-request-preview">
                          {truncateText(row.admin_explanation, 110)}
                        </div>
                      </td>
                      <td>
                        {formatSchedule(row.scheduled_date, row.scheduled_time)}
                      </td>
                      <td>{formatDateTime(row.created_at)}</td>
                      <td>{formatDateTime(row.updated_at)}</td>
                      <td>
                        <div className="member-request-actions member-request-actions-inline">
                          <button
                            type="button"
                            className="member-btn member-btn-secondary member-btn-sm"
                            onClick={() => setSelectedRow(row)}
                          >
                            View
                          </button>

                          <button
                            type="button"
                            className="member-btn member-btn-primary member-btn-sm"
                            onClick={() => handlePrint(row)}
                          >
                            PDF
                          </button>

                          <button
                            type="button"
                            className="member-btn member-btn-download member-btn-sm"
                            onClick={() => handleDownload(row)}
                          >
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="member-requests-mobile-list">
              {rows.map((row) => (
                <article key={row.id} className="member-request-mobile-card">
                  <div className="member-request-mobile-head">
                    <h3>{row.form_name || "--"}</h3>
                    <RequestStatusBadge status={row.status} />
                  </div>

                  <div className="member-request-mobile-grid">
                    <div>
                      <span>Admin Notes</span>
                      <p>{truncateText(row.admin_notes, 180)}</p>
                    </div>

                    <div>
                      <span>Explanation</span>
                      <p>{truncateText(row.admin_explanation, 180)}</p>
                    </div>

                    <div>
                      <span>Scheduled</span>
                      <p>
                        {formatSchedule(
                          row.scheduled_date,
                          row.scheduled_time
                        )}
                      </p>
                    </div>

                    <div>
                      <span>Submitted</span>
                      <p>{formatDateTime(row.created_at)}</p>
                    </div>

                    <div>
                      <span>Updated</span>
                      <p>{formatDateTime(row.updated_at)}</p>
                    </div>
                  </div>

                  <div className="member-request-actions">
                    <button
                      type="button"
                      className="member-btn member-btn-secondary member-btn-sm"
                      onClick={() => setSelectedRow(row)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="member-btn member-btn-primary member-btn-sm"
                      onClick={() => handlePrint(row)}
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      className="member-btn member-btn-download member-btn-sm"
                      onClick={() => handleDownload(row)}
                    >
                      Download
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="member-pagination">
              <button
                type="button"
                className="member-btn"
                disabled={page <= 1 || Boolean(submittedStatus)}
                onClick={handlePrev}
              >
                Previous
              </button>

              <div className="member-inline-note">
                {page} / {totalPages || 1}
              </div>

              <button
                type="button"
                className="member-btn"
                disabled={page >= totalPages || Boolean(submittedStatus)}
                onClick={handleNext}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>

      <RequestDetailModal
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onPrint={handlePrint}
        onDownload={handleDownload}
      />
    </div>
  );
}