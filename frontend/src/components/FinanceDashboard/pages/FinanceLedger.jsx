// frontend/src/components/FinanceDashboard/pages/FinanceLedger.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  RefreshCcw,
  Search,
  Send,
} from "lucide-react";

import api from "../../api";


import "../../../styles/shared-payment-components.css";
import "../../../styles/ledger-enterprise.css";
import FinanceActionMenu from "../components/FinanceActionMenu";

const CURRENT_YEAR = new Date().getFullYear();

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Tax Statement Categories" },
  { value: "donation", label: "Donations" },
  { value: "membership", label: "Membership" },
  { value: "pledge", label: "Pledge Payments" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function cleanText(value, fallback = "--") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatDate(value) {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function normalizeRows(payload) {
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.statements)) return payload.statements;
  if (Array.isArray(payload)) return payload;
  return [];
}

function selectedCategoryTotal(row, category) {
  if (category === "donation") {
    return Number(row.total_donations || 0);
  }

  if (category === "membership") {
    return Number(row.total_membership || 0);
  }

  if (category === "pledge") {
    return Number(row.total_pledge || 0);
  }

  return Number(row.grand_total || 0);
}
function summaryCategoryTotal(summary, category) {
  if (category === "donation") {
    return Number(summary.total_donations || 0);
  }

  if (category === "membership") {
    return Number(summary.total_membership || 0);
  }

  if (category === "pledge") {
    return Number(summary.total_pledge || 0);
  }

  return Number(summary.grand_total || 0);
}

function categoryLabel(value) {
  return CATEGORY_OPTIONS.find((item) => item.value === value)?.label || "All Categories";
}

export default function FinanceLedger() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    total_pages: 1,
  });
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  // const [filters, setFilters] = useState({
  //   search: "",
  //   year: String(CURRENT_YEAR),
  //   category: "all",
  //   from: `${CURRENT_YEAR}-01-01`,
  //   to: `${CURRENT_YEAR}-12-31`,
  //   with_activity_only: "1",
  //   page: 1,
  //   limit: 50,
  // });
const [filters, setFilters] = useState({
  search: "",
  year: String(CURRENT_YEAR),
  category: "all",
  from: `${CURRENT_YEAR}-01-01`,
  to: `${CURRENT_YEAR}-12-31`,
  page: 1,
  limit: 50,
});
  const selectedTotal = useMemo(
    () => summaryCategoryTotal(summary, filters.category),
    [summary, filters.category]
  );

  const pageStart = useMemo(() => {
    if (!pagination.total) return 0;
    return (Number(pagination.page || 1) - 1) * Number(pagination.limit || 50) + 1;
  }, [pagination]);

  const pageEnd = useMemo(() => {
    if (!pagination.total) return 0;
    return Math.min(
      Number(pagination.total || 0),
      Number(pagination.page || 1) * Number(pagination.limit || 50)
    );
  }, [pagination]);

  const visibleIds = useMemo(
    () => rows.map((row) => Number(row.member_id)).filter(Boolean),
    [rows]
  );

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedMemberIds.includes(id));

  const loadStatements = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const res = await api.get("/finance/member-ledger/statements", {
        // params: {
        //   search: filters.search,
        //   year: filters.year,
        //   category: filters.category === "all" ? "" : filters.category,
        //   from: filters.from,
        //   to: filters.to,
        //   with_activity_only: filters.with_activity_only,
        //   page: filters.page,
        //   limit: filters.limit,
        // },
        params: {
  search: filters.search,
  year: filters.year,
  category: filters.category === "all" ? "" : filters.category,
  from: filters.from,
  to: filters.to,
  with_activity_only: 1,
  page: filters.page,
  limit: filters.limit,
}
      });

      const nextRows = normalizeRows(res.data);
      const nextPagination = res.data?.pagination || {};

      setRows(nextRows);
      setSummary(res.data?.summary || {});
      setPagination({
        page: Number(nextPagination.page || filters.page || 1),
        limit: Number(nextPagination.limit || filters.limit || 50),
        total: Number(nextPagination.total || nextRows.length || 0),
        total_pages: Number(nextPagination.total_pages || 1),
      });
  
      setSelectedMemberIds((current) =>
        current.filter((id) => nextRows.some((row) => Number(row.member_id) === id))
      );
    } catch (error) {
      console.error("finance member statements failed:", error);
      setRows([]);
      setSummary({});
      setPagination({
        page: Number(filters.page || 1),
        limit: Number(filters.limit || 50),
        total: 0,
        total_pages: 1,
      });
      setErr(
        error?.response?.data?.error ||
          "Unable to load member statements. Confirm financeMemberLedger.js is mounted and the backend was restarted."
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadStatements();
  }, [loadStatements]);

  function updateFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: name === "page" ? value : 1,
    }));
  }

  function clearFilters() {
    setFilters({
      search: "",
      year: String(CURRENT_YEAR),
      category: "all",
      from: `${CURRENT_YEAR}-01-01`,
      to: `${CURRENT_YEAR}-12-31`,
      with_activity_only: "1",
      page: 1,
      limit: 50,
    });
    setSelectedMemberIds([]);
    setErr("");
    setSuccess("");
  }

  function toggleAllVisible() {
    setSelectedMemberIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function toggleMember(memberId) {
    const id = Number(memberId);

    if (!id) return;

    setSelectedMemberIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function exportMembersCsv() {
   const header = [
  "Member ID",
  "Member",
  "Email",
  "Phone",
  "Year",
  "Total Contributions",
  "Donations",
  "Membership",
  "Pledge",
  "Payments",
  "Last Payment",
];

    const body = rows.map((row) => 
      [
  row.member_no,
  row.full_name,
  row.email,
  row.phone,
  filters.year,
  row.grand_total,
  row.total_donations,
  row.total_membership,
  row.total_pledge,
  row.payment_count,
  row.last_payment_at,
]
  );

    const csv = [header, ...body]
      .map((line) => line.map(csvEscape).join(","))
      .join("\n");

    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `${filters.year}-member-annual-statements.csv`
    );
  }

  async function downloadStatement(row) {
  
    setErr("");
    setSuccess("");

    try {
      const res = await api.get(
        `/finance/member-ledger/${row.member_id}/statement/${filters.year}/pdf`,
        { responseType: "blob" }
      );

      const memberNo = cleanText(row.member_no, row.member_id).replace(/[^a-z0-9-]+/gi, "-");

      downloadBlob(
        res.data,
        `${filters.year}-holy-trinity-contribution-statement-${memberNo}.pdf`
      );
    } catch (error) {
      console.error("statement pdf failed:", error);
      setErr(error?.response?.data?.error || "Unable to download this member statement.");
    }
  }

  function openStatement(row) {
  
    const url = `/api/finance/member-ledger/${row.member_id}/statement/${filters.year}/html`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function emailStatement(row) {

    setErr("");
    setSuccess("");

    try {
      await api.post(`/finance/member-ledger/${row.member_id}/statement/${filters.year}/email`, {
        to: row.email || undefined,
      });

      setSuccess(`Official ${filters.year} statement sent to ${row.email || row.full_name}.`);
    } catch (error) {
      console.error("statement email failed:", error);
      setErr(error?.response?.data?.error || "Unable to email this member statement.");
    }
  }

  async function emailSelectedStatements() {
    if (!selectedMemberIds.length) {
      setErr("Select at least one member row before sending statements.");
      return;
    }

    setSending(true);
    setErr("");
    setSuccess("");

    try {
      const res = await api.post("/finance/member-ledger/statements/email", {
        year: filters.year,
        member_ids: selectedMemberIds,
      });

      setSuccess(
        `Statement batch complete. Sent: ${res.data?.sent || 0}. Failed: ${res.data?.failed || 0}.`
      );
    } catch (error) {
      console.error("batch statement email failed:", error);
      setErr(error?.response?.data?.error || "Unable to email selected statements.");
    } finally {
      setSending(false);
    }
  }

  function goToPage(page) {
    const nextPage = Math.max(1, Math.min(Number(pagination.total_pages || 1), page));
    updateFilter("page", nextPage);
  }

  return (
    <div className="finance-ledger-page">
      
      <section className="finance-page-hero">
        <div>
          <span className="finance-kicker">Finance Ledger</span>
          <h1>Member Annual Statements</h1>
          <p>
           <p>Generate official annual contribution statements for membership dues, donations, and pledge payments.
</p>
          </p>
        </div>

        <div className="finance-page-actions">
          <button type="button" className="finance-btn finance-btn-light" onClick={loadStatements}>
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button type="button" className="finance-btn finance-btn-light" onClick={exportMembersCsv}>
            <FileSpreadsheet size={16} />
            Export Rows
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={emailSelectedStatements}
            disabled={sending || !selectedMemberIds.length}
          >
            <Send size={16} />
            Send Selected
          </button>
          
        </div>
      </section>

      {err ? <div className="finance-alert finance-alert-danger">{err}</div> : null}
      {success ? <div className="finance-alert finance-alert-success">{success}</div> : null}



      <section className="finance-card">
        <div className="finance-ledger-countbar">
          <div>
            <strong>{pagination.total}</strong>
            <span>member statement rows</span>
          </div>
          <div>
            <strong>{money(selectedTotal)}</strong>
            <span>{categoryLabel(filters.category)} total</span>
          </div>
          <div>
            <strong>{selectedMemberIds.length}</strong>
            <span>selected to email</span>
          </div>
          <div>
            <strong>
              {pageStart}-{pageEnd}
            </strong>
            <span>showing on page {pagination.page}</span>
          </div>
        </div>

        <div className="finance-ledger-filter-grid">
          <label className="finance-field finance-field-wide">
            <span>Search</span>
            <div className="finance-input-with-icon">
              <Search size={16} />
              <input
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Search member, email, phone, or member ID"
              />
            </div>
          </label>

          <label className="finance-field">
            <span>Year</span>
            <select value={filters.year} onChange={(event) => updateFilter("year", event.target.value)}>
              {Array.from({ length: 8 }).map((_, index) => {
                const year = CURRENT_YEAR + 1 - index;

                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="finance-field">
            <span>Category Total</span>
            <select
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
            >
              {CATEGORY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="finance-field">
            <span>From</span>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
            />
          </label>

          <label className="finance-field">
            <span>To</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
            />
          </label>

          <label className="finance-field">
            <span>Rows</span>
            <select
              value={filters.limit}
              onChange={(event) => updateFilter("limit", Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          {/* <label className="finance-ledger-checkbox">
            <input
              type="checkbox"
              checked={filters.with_activity_only === "1"}
              onChange={(event) =>
                updateFilter("with_activity_only", event.target.checked ? "1" : "0")
              }
            />
            With activity only
          </label> */}
{/* 
          <button type="button" className="finance-btn finance-btn-primary" onClick={loadStatements}>
            <Search size={16} />
            Search
          </button> */}

          <button type="button" className="finance-btn finance-btn-light" onClick={clearFilters}>
            Clear
          </button>
          
        </div>
      </section>


      <section className="finance-card">
        <div className="finance-card-head">
          <div>
            <h2>Official Member Statement Register</h2>
            <p>
              Each row is one member for the selected year. Use View, PDF, or Send when a member
              requests an official annual contribution statement.
            </p>
          </div>
          <div className="finance-ledger-page-count">
            Showing {pageStart}-{pageEnd} of {pagination.total}
          </div>
        </div>

        <div className="finance-table-wrap">
          <table className="finance-table finance-ledger-statement-table">
            <thead>

            <tr>
  <th>
    <input
      type="checkbox"
      checked={allVisibleSelected}
      onChange={toggleAllVisible}
      aria-label="Select visible member statements"
    />
  </th>
 <th>Member ID</th>
<th>Full Name</th>
  <th>Email</th>
  <th>Phone</th>
  <th>Total Contributions</th>
  <th>Donations</th>
  <th>Membership</th>
  <th>Pledge</th>
  <th>Payments</th>
  <th>Last Payment</th>
  <th>Actions</th>
</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12">Loading member statements...</td>
                </tr>
              ) : rows.length ? (
                rows.map((row) => {
                  const memberId = Number(row.member_id);

   return (

 <tr key={memberId || row.member_no}>
  <td>
    <input
      type="checkbox"
      checked={selectedMemberIds.includes(memberId)}
      onChange={() => toggleMember(memberId)}
      disabled={!memberId}
      aria-label={`Select ${row.full_name || row.member_no || "member"}`}
    />
  </td>

 <td>
  {cleanText(row.member_no)}
</td>

<td>
  {cleanText(row.full_name)}
</td>
  <td>{cleanText(row.email)}</td>

  <td>{cleanText(row.phone)}</td>

  <td>
    <strong>{money(row.grand_total)}</strong>
    <small>{filters.year}</small>
  </td>

  <td>{money(row.total_donations)}</td>

  <td>{money(row.total_membership)}</td>

  <td>{money(row.total_pledge)}</td>
  

  <td>{Number(row.payment_count || 0)}</td>

  <td>{formatDate(row.last_payment_at)}</td>

  <td className="finance-action-cell">
    <FinanceActionMenu
      row={row}
      actions={[
        {
          key: "view",
          label: "View",
          onClick: () => openStatement(row),
        },
        {
          key: "pdf",
          label: "PDF",
          onClick: () => downloadStatement(row),
        },
        {
          key: "sendEmail",
          label: "Send",
          onClick: () => emailStatement(row),
          disabled: !row.email,
        },
      ]}
    />
  </td>
</tr>

);
                })
              ) : (
                <tr>
                  <td colSpan="12">No member statements found for this view.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="finance-ledger-pagination">
          <div>
            Page {pagination.page} of {pagination.total_pages}
          </div>
          <div className="finance-row-actions">
            <button
              type="button"
              className="finance-btn finance-btn-light"
              onClick={() => goToPage(Number(pagination.page || 1) - 1)}
              disabled={loading || Number(pagination.page || 1) <= 1}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button
              type="button"
              className="finance-btn finance-btn-light"
              onClick={() => goToPage(Number(pagination.page || 1) + 1)}
              disabled={loading || Number(pagination.page || 1) >= Number(pagination.total_pages || 1)}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      
      
    </div>
  );
}
