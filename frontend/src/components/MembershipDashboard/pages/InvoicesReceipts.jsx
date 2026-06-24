//frontend\src\components\MembershipDashboard\pages\GivingStatements.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Mail,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
} from "lucide-react";

import api from "../../api";
import "../../../styles/member-dashboard.css";

const STATEMENT_ENDPOINTS = [
  "/membership/giving-statements",
  "/membership/me/giving-statements",
  "/member/giving-statements",
  "/members/me/giving-statements",
  "/membership/ledger/statement",
  "/members/me/statements",
];

const PDF_ENDPOINTS = [
  "/membership/giving-statements/pdf",
  "/membership/me/giving-statements/pdf",
  "/member/giving-statements/pdf",
  "/members/me/giving-statements/pdf",
  "/membership/ledger/statement/pdf",
];

const EMAIL_ENDPOINTS = [
  "/membership/giving-statements/email",
  "/membership/me/giving-statements/email",
  "/member/giving-statements/email",
  "/members/me/giving-statements/email",
  "/membership/ledger/statement/email",
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "donation", label: "Donations" },
  { value: "membership", label: "Membership" },
  { value: "school", label: "School" },
  { value: "trip", label: "Trip" },
  { value: "pledge", label: "Pledge" },
];

const METHOD_OPTIONS = [
  { value: "all", label: "All Methods" },
  { value: "card", label: "Card" },
  { value: "ach", label: "ACH" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
];

function currentYear() {
  return new Date().getFullYear();
}

function yearStart(year) {
  return `${year}-01-01`;
}

function yearEnd(year) {
  return `${year}-12-31`;
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value, fallback = "--") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }

  return fallback;
}

function firstArray(source, keys) {
  for (const key of keys) {
    const value = source?.[key];

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Ignore malformed JSON.
      }
    }
  }

  return [];
}

function formatDate(value) {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return clean(value);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function categoryOf(row) {
  return String(
    firstValue(row, [
      "category",
      "payment_type",
      "finance_type",
      "type",
      "ledger_category",
    ], "other")
  ).toLowerCase();
}

function methodOf(row) {
  return clean(
    firstValue(row, ["payment_method", "method", "payment_instrument"], "--")
  );
}

function amountOf(row) {
  return numberValue(
    firstValue(row, [
      "amount",
      "total_amount",
      "paid_amount",
      "credit_amount",
      "payment_amount",
    ], 0)
  );
}

function statusOf(row) {
  return String(firstValue(row, ["status", "payment_status"], "paid")).toLowerCase();
}

function isPaid(row) {
  return ["paid", "succeeded", "completed", "issued", "posted", "cleared"].includes(
    statusOf(row)
  );
}

function statementRowDate(row) {
  return firstValue(row, [
    "paid_at",
    "payment_date",
    "received_at",
    "issued_at",
    "created_at",
    "date",
  ]);
}

function statementReference(row) {
  return clean(
    firstValue(row, [
      "receipt_number",
      "payment_number",
      "invoice_number",
      "reference_no",
      "reference_number",
      "transaction_reference",
      "stripe_payment_intent_id",
    ])
  );
}

function pretty(value) {
  return clean(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (["paid", "succeeded", "completed", "issued", "posted", "cleared"].includes(normalized)) {
    return "member-badge-success";
  }

  if (["pending", "open", "processing"].includes(normalized)) {
    return "member-badge-warning";
  }

  if (["failed", "cancelled", "canceled", "void", "refunded"].includes(normalized)) {
    return "member-badge-danger";
  }

  return "member-badge-neutral";
}

async function getFirstAvailable(endpoints, params = {}, config = {}) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.get(endpoint, {
        params,
        ...config,
      });

      return response;
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;

      if (![404, 405].includes(Number(status))) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Statement endpoint not available.");
}

async function postFirstAvailable(endpoints, payload = {}, config = {}) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.post(endpoint, payload, config);
      return response;
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;

      if (![404, 405].includes(Number(status))) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Statement email endpoint not available.");
}

function responsePayload(response) {
  return response?.data?.data || response?.data || response || {};
}

function normalizeStatementPayload(payload) {
  const data = payload?.data || payload || {};

  const rows = firstArray(data, [
    "entries",
    "rows",
    "items",
    "payments",
    "ledger",
    "records",
    "statement_rows",
  ]);

  const member =
    data.member ||
    data.member_info ||
    data.profile ||
    data.user ||
    data.account ||
    {};

  const organization =
    data.organization ||
    data.church ||
    data.org ||
    data.settings ||
    {};

  const summarySource =
    data.summary ||
    data.totals ||
    data.statement_summary ||
    {};

  const paidRows = rows.filter(isPaid);

  const totals = paidRows.reduce(
    (acc, row) => {
      const category = categoryOf(row);
      const amount = amountOf(row);

      if (category.includes("membership")) acc.membership += amount;
      else if (category.includes("school")) acc.school += amount;
      else if (category.includes("trip")) acc.trip += amount;
      else if (category.includes("pledge")) acc.pledge += amount;
      else if (category.includes("donation") || category.includes("giving")) acc.donations += amount;
      else acc.other += amount;

      acc.grand += amount;
      return acc;
    },
    {
      donations: 0,
      membership: 0,
      school: 0,
      trip: 0,
      pledge: 0,
      other: 0,
      grand: 0,
    }
  );

  return {
    rows,
    member,
    organization,
    summary: {
      total_donations: numberValue(
        firstValue(summarySource, ["total_donations", "donations"], totals.donations)
      ),
      total_membership: numberValue(
        firstValue(summarySource, ["total_membership", "membership"], totals.membership)
      ),
      total_school: numberValue(
        firstValue(summarySource, ["total_school", "school"], totals.school)
      ),
      total_trip: numberValue(
        firstValue(summarySource, ["total_trip", "trip"], totals.trip)
      ),
      total_pledge: numberValue(
        firstValue(summarySource, ["total_pledge", "pledge"], totals.pledge)
      ),
      total_other: numberValue(
        firstValue(summarySource, ["total_other", "other"], totals.other)
      ),
      grand_total: numberValue(
        firstValue(summarySource, ["grand_total", "statement_total", "total"], totals.grand)
      ),
    },
  };
}

function buildCsv(rows) {
  const header = [
    "Date",
    "Category",
    "Sub Category",
    "Method",
    "Reference",
    "Amount",
    "Status",
  ];

  const body = rows.map((row) => [
    formatDate(statementRowDate(row)),
    pretty(categoryOf(row)),
    clean(firstValue(row, ["sub_category", "donation_category", "program_name", "campaign_name", "description"])),
    methodOf(row),
    statementReference(row),
    amountOf(row),
    pretty(statusOf(row)),
  ]);

  return [header, ...body]
    .map((line) =>
      line
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
}

function downloadCsv(rows, year) {
  const blob = new Blob([buildCsv(rows)], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `giving-statement-${year}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function SummaryCard({ label, value, sub }) {
  return (
    <article className="member-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </article>
  );
}

function Badge({ value }) {
  return (
    <span className={`member-badge ${statusClass(value)}`}>
      {pretty(value)}
    </span>
  );
}

export default function GivingStatements() {
  const [filters, setFilters] = useState(() => {
    const year = currentYear();

    return {
      year,
      from: yearStart(year),
      to: yearEnd(year),
      category: "all",
      method: "all",
      search: "",
    };
  });

  const [rows, setRows] = useState([]);
  const [member, setMember] = useState({});
  const [organization, setOrganization] = useState({});
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const queryParams = useMemo(() => {
    const params = {
      year: filters.year,
      from: filters.from,
      to: filters.to,
    };

    if (filters.category !== "all") params.category = filters.category;
    if (filters.method !== "all") params.method = filters.method;
    if (filters.search.trim()) params.search = filters.search.trim();

    return params;
  }, [filters]);

  const visibleRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return rows.filter((row) => {
      if (filters.category !== "all" && !categoryOf(row).includes(filters.category)) {
        return false;
      }

      if (filters.method !== "all" && !methodOf(row).toLowerCase().includes(filters.method)) {
        return false;
      }

      if (!search) return true;

      const haystack = [
        categoryOf(row),
        methodOf(row),
        statementReference(row),
        firstValue(row, ["sub_category", "donation_category", "program_name", "campaign_name", "description"]),
        statusOf(row),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [rows, filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await getFirstAvailable(STATEMENT_ENDPOINTS, queryParams);
      const normalized = normalizeStatementPayload(responsePayload(response));

      setRows(normalized.rows);
      setMember(normalized.member);
      setOrganization(normalized.organization);
      setSummary(normalized.summary);
    } catch (err) {
      console.error("Unable to load giving statement:", err);
      setRows([]);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to load giving statement."
      );
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    load();
  }, [load]);

  function updateFilter(name, value) {
    setFilters((current) => {
      if (name === "year") {
        const year = Number(value) || currentYear();

        return {
          ...current,
          year,
          from: yearStart(year),
          to: yearEnd(year),
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  }

  async function downloadPdf() {
    setActionLoading("pdf");
    setError("");
    setSuccess("");

    try {
      const response = await getFirstAvailable(PDF_ENDPOINTS, queryParams, {
        responseType: "blob",
      });

      const contentType = response.headers?.["content-type"] || "";

      if (contentType.includes("application/json")) {
        const text = await response.data.text();
        const parsed = JSON.parse(text);

        const url =
          parsed.url ||
          parsed.pdf_url ||
          parsed.download_url ||
          parsed.statement_url;

        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
          return;
        }

        throw new Error("PDF link was not returned.");
      }

      const blobUrl = URL.createObjectURL(response.data);
      window.open(blobUrl, "_blank", "noopener,noreferrer");

      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch (err) {
      console.error("Unable to download giving statement PDF:", err);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to download statement PDF."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function emailStatement() {
    setActionLoading("email");
    setError("");
    setSuccess("");

    try {
      await postFirstAvailable(EMAIL_ENDPOINTS, {
        ...queryParams,
        attach_pdf: true,
      });

      setSuccess("Statement email sent successfully.");
    } catch (err) {
      console.error("Unable to email giving statement:", err);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to email statement."
      );
    } finally {
      setActionLoading("");
    }
  }

  function printView() {
    window.print();
  }

  const displayName =
    clean(
      firstValue(member, ["full_name", "name", "member_name"]),
      "Member"
    );

  const memberNo = clean(firstValue(member, ["member_no", "member_id", "id"]));
  const email = clean(firstValue(member, ["email"]));
  const address = [
    firstValue(member, ["address", "street"]),
    firstValue(member, ["city"]),
    firstValue(member, ["state"]),
    firstValue(member, ["zip", "postal_code"]),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="membership-dashboard-page member-page-stack">
      <section className="member-page-hero">
        <div>
          <span className="member-eyebrow">Member Finance</span>
          <h1>Giving Statements</h1>
          <p className="member-page-subtitle">
            Download or email your official annual contribution statement for tax records.
          </p>
        </div>

        <div className="member-page-actions">
          <button type="button" className="member-btn member-btn-light" onClick={load}>
            <RefreshCcw size={16} className={loading ? "member-spin" : ""} />
            Refresh
          </button>

          <button type="button" className="member-btn member-btn-light" onClick={printView}>
            <Printer size={16} />
            Print
          </button>

          <button
            type="button"
            className="member-btn member-btn-light"
            onClick={() => downloadCsv(visibleRows, filters.year)}
          >
            <FileSpreadsheet size={16} />
            CSV
          </button>

          <button
            type="button"
            className="member-btn member-btn-primary"
            onClick={downloadPdf}
            disabled={actionLoading === "pdf"}
          >
            <Download size={16} />
            Download PDF
          </button>

          <button
            type="button"
            className="member-btn member-btn-light"
            onClick={emailStatement}
            disabled={actionLoading === "email"}
          >
            <Mail size={16} />
            Email PDF
          </button>
        </div>
      </section>

      {error ? (
        <div className="member-alert member-alert-danger">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="member-alert member-alert-success">
          <ShieldCheck size={16} />
          {success}
        </div>
      ) : null}

      <section className="member-summary-grid">
        <SummaryCard
          label="Total Contributions"
          value={money(summary.grand_total)}
          sub={`${filters.year} statement total`}
        />
        <SummaryCard label="Donations" value={money(summary.total_donations)} sub="Tax giving" />
        <SummaryCard label="Membership" value={money(summary.total_membership)} sub="Membership payments" />
        <SummaryCard label="School" value={money(summary.total_school)} sub="School programs" />
        <SummaryCard label="Trip" value={money(summary.total_trip)} sub="Trip programs" />
        <SummaryCard label="Pledge" value={money(summary.total_pledge)} sub="Pledge payments" />
      </section>

      <section className="member-card">
        <div className="member-section-header">
          <div>
            <h2>Statement Recipient</h2>
            <p>Official contribution statement details for the selected year.</p>
          </div>
        </div>

        <div className="member-detail-grid">
          <div>
            <span>Member</span>
            <strong>{displayName}</strong>
          </div>
          <div>
            <span>Member ID</span>
            <strong>{memberNo}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{email}</strong>
          </div>
          <div>
            <span>Address</span>
            <strong>{address || "--"}</strong>
          </div>
          <div>
            <span>Church</span>
            <strong>{clean(firstValue(organization, ["church_name", "legal_name", "name"]), "Holy Trinity EOTC")}</strong>
          </div>
          <div>
            <span>Statement Year</span>
            <strong>{filters.year}</strong>
          </div>
        </div>
      </section>

      <section className="member-card">
        <div className="member-filter-grid">
          <label>
            <span>Year</span>
            <select
              value={filters.year}
              onChange={(event) => updateFilter("year", event.target.value)}
            >
              {Array.from({ length: 8 }, (_, index) => currentYear() - index).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Category</span>
            <select
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Method</span>
            <select
              value={filters.method}
              onChange={(event) => updateFilter("method", event.target.value)}
            >
              {METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>From</span>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
            />
          </label>

          <label>
            <span>To</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
            />
          </label>

          <label className="member-input-icon">
            <span>Search</span>
            <Search size={16} />
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search category, reference, or notes"
            />
          </label>
        </div>
      </section>

      <section className="member-card">
        <div className="member-section-header">
          <div>
            <h2>Official Contribution Ledger</h2>
            <p>
              No goods or services were provided in exchange for these contributions except for intangible religious benefits.
            </p>
          </div>
          <strong>{visibleRows.length} row(s)</strong>
        </div>

        <div className="member-table-wrap">
          <table className="member-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Sub-Category</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="member-empty-state">
                      <RefreshCcw size={18} className="member-spin" />
                      Loading statement...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && !visibleRows.length ? (
                <tr>
                  <td colSpan={7}>
                    <div className="member-empty-state">
                      No contribution rows found for this statement.
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading
                ? visibleRows.map((row, index) => (
                    <tr key={firstValue(row, ["id", "payment_number", "receipt_number"], index)}>
                      <td>{formatDate(statementRowDate(row))}</td>
                      <td>{pretty(categoryOf(row))}</td>
                      <td>
                        {clean(
                          firstValue(row, [
                            "sub_category",
                            "donation_category",
                            "program_name",
                            "campaign_name",
                            "description",
                          ])
                        )}
                      </td>
                      <td>{methodOf(row)}</td>
                      <td>{statementReference(row)}</td>
                      <td>{money(amountOf(row))}</td>
                      <td>
                        <Badge value={statusOf(row)} />
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}