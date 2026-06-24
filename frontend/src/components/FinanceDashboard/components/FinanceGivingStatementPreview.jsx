import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  Printer,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  User,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const STATEMENT_TYPES = [
  { value: "giving", label: "Giving Statement" },
  { value: "membership", label: "Membership Statement" },
  { value: "pledge", label: "Pledge Statement" },
  { value: "annual", label: "Annual Statement" },
  { value: "quarterly", label: "Quarterly Statement" },
  { value: "monthly", label: "Monthly Statement" },
];

const PERIOD_OPTIONS = [
  { value: "year", label: "Full Year" },
  { value: "q1", label: "Q1" },
  { value: "q2", label: "Q2" },
  { value: "q3", label: "Q3" },
  { value: "q4", label: "Q4" },
  { value: "custom", label: "Custom" },
];

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numberValue(value));
}

function clean(value, fallback = "--") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function pretty(value) {
  return clean(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function currentYear() {
  return new Date().getFullYear();
}

function yearStart(year) {
  return `${year}-01-01`;
}

function yearEnd(year) {
  return `${year}-12-31`;
}

function periodDates(year, period) {
  if (period === "q1") return { from: `${year}-01-01`, to: `${year}-03-31` };
  if (period === "q2") return { from: `${year}-04-01`, to: `${year}-06-30` };
  if (period === "q3") return { from: `${year}-07-01`, to: `${year}-09-30` };
  if (period === "q4") return { from: `${year}-10-01`, to: `${year}-12-31` };

  return { from: yearStart(year), to: yearEnd(year) };
}

function formatDate(value) {
  if (!value) return "--";

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) return `${match[2]}/${match[3]}/${match[1]}`;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function responseData(response) {
  return response?.data || response || {};
}

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.transactions)) return data.transactions;
  if (Array.isArray(data.statement_rows)) return data.statement_rows;
  if (Array.isArray(data.payments)) return data.payments;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function statementFrom(data) {
  return data.statement || data.preview || data.summary || data.data || data || {};
}

function firstValue(source, keys, fallback = "") {
  if (!source) return fallback;

  for (const key of keys) {
    const value = source[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
}

function rowAmount(row) {
  return numberValue(
    firstValue(row, ["amount", "payment_amount", "total_amount", "paid_amount"], 0)
  );
}

function rowCategory(row) {
  return firstValue(
    row,
    ["category", "payment_type", "statement_category", "donation_category"],
    "finance"
  );
}

function rowDate(row) {
  return firstValue(row, ["payment_date", "paid_at", "receipt_date", "created_at", "date"], "");
}

function rowDescription(row) {
  return firstValue(
    row,
    [
      "description",
      "notes",
      "memo",
      "coverage_label",
      "program_name",
      "campaign_name",
      "donation_category",
    ],
    pretty(rowCategory(row))
  );
}

function statementSummary(statement, rows) {
  const membership =
    statement.membership_total ??
    statement.membership_amount ??
    rows
      .filter((row) => rowCategory(row).toLowerCase() === "membership")
      .reduce((sum, row) => sum + rowAmount(row), 0);

  const donation =
    statement.donation_total ??
    statement.donation_amount ??
    rows
      .filter((row) => rowCategory(row).toLowerCase() === "donation")
      .reduce((sum, row) => sum + rowAmount(row), 0);

  const pledge =
    statement.pledge_total ??
    statement.pledge_amount ??
    rows
      .filter((row) => rowCategory(row).toLowerCase() === "pledge")
      .reduce((sum, row) => sum + rowAmount(row), 0);

  const program =
    statement.program_total ??
    statement.program_amount ??
    rows
      .filter((row) => ["school", "trip", "program"].includes(rowCategory(row).toLowerCase()))
      .reduce((sum, row) => sum + rowAmount(row), 0);

  const total =
    statement.total_amount ??
    statement.total_given ??
    statement.total_paid ??
    rows.reduce((sum, row) => sum + rowAmount(row), 0);

  return {
    total,
    membership,
    donation,
    pledge,
    program,
    count: statement.transaction_count ?? rows.length,
    deductible: statement.tax_deductible_amount ?? donation + pledge,
  };
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function exportCsv(rows, filename) {
  const headers = [
    "Date",
    "Category",
    "Description",
    "Payment #",
    "Invoice #",
    "Receipt #",
    "Method",
    "Reference",
    "Amount",
  ];

  const body = rows.map((row) => [
    formatDate(rowDate(row)),
    pretty(rowCategory(row)),
    rowDescription(row),
    clean(row.payment_number),
    clean(row.invoice_number),
    clean(row.receipt_number),
    pretty(row.method || row.payment_method),
    clean(row.reference_no || row.reference_number || row.transaction_reference),
    rowAmount(row).toFixed(2),
  ]);

  const csv = [headers, ...body]
    .map((line) => line.map(csvEscape).join(","))
    .join("\n");

  downloadBlob(
    new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    }),
    filename
  );
}

async function getFirst(paths, config = {}) {
  let lastError = null;

  for (const path of paths.filter(Boolean)) {
    try {
      const response = await api.get(path, config);

      return {
        endpoint: path,
        data: responseData(response),
      };
    } catch (err) {
      lastError = err;

      if ([404, 405].includes(err?.response?.status)) {
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("Statement endpoint is not available.");
}

async function postFirst(paths, payload = {}, config = {}) {
  let lastError = null;

  for (const path of paths.filter(Boolean)) {
    try {
      const response = await api.post(path, payload, config);

      return {
        endpoint: path,
        response,
        data: responseData(response),
      };
    } catch (err) {
      lastError = err;

      if ([404, 405].includes(err?.response?.status)) {
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("Statement action endpoint is not available.");
}

export default function FinanceGivingStatementPreview({
  open = true,
  embedded = false,
  member = null,
  memberId = "",
  memberNo = "",
  statement = null,
  statementRows = [],
  type = "giving",
  year = currentYear(),
  onClose,
  onGenerated,
  onSent,
}) {
  const [filters, setFilters] = useState({
    statement_type: type,
    year: String(year || currentYear()),
    period: "year",
    from: yearStart(year || currentYear()),
    to: yearEnd(year || currentYear()),
    search: "",
    email_to: "",
  });

  const [loadedStatement, setLoadedStatement] = useState(statement || {});
  const [rows, setRows] = useState(statementRows || []);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resolvedMemberId =
    memberId || firstValue(member, ["id", "member_id"], firstValue(loadedStatement, ["member_id"], ""));

  const resolvedMemberNo =
    memberNo ||
    firstValue(
      member,
      ["member_no", "member_number"],
      firstValue(loadedStatement, ["member_no", "member_number"], "--")
    );

  const recipient = useMemo(() => {
    return {
      name: firstValue(
        member,
        ["full_name", "name"],
        firstValue(
          loadedStatement,
          ["full_name", "full_name_snapshot", "member_name", "donor_name", "recipient_name"],
          "Member / Donor"
        )
      ),
      email: firstValue(
        member,
        ["email"],
        firstValue(
          loadedStatement,
          ["email", "email_snapshot", "recipient_email", "member_email", "donor_email"],
          ""
        )
      ),
      phone: firstValue(
        member,
        ["phone"],
        firstValue(loadedStatement, ["phone", "phone_snapshot", "member_phone"], "")
      ),
      address: firstValue(
        member,
        ["address"],
        firstValue(loadedStatement, ["address", "mailing_address"], "")
      ),
    };
  }, [member, loadedStatement]);

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    if (!search) return rows;

    return rows.filter((row) => {
      const haystack = [
        rowDate(row),
        rowCategory(row),
        rowDescription(row),
        row.payment_number,
        row.invoice_number,
        row.receipt_number,
        row.reference_no,
        row.method,
        row.payment_method,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [rows, filters.search]);

  const summary = useMemo(
    () => statementSummary(loadedStatement, filteredRows),
    [loadedStatement, filteredRows]
  );

  useEffect(() => {
    if (!open) return;

    const nextYear = String(year || currentYear());
    const dates = periodDates(nextYear, "year");

    setFilters({
      statement_type: type || "giving",
      year: nextYear,
      period: "year",
      from: dates.from,
      to: dates.to,
      search: "",
      email_to:
        firstValue(
          member,
          ["email"],
          firstValue(statement, ["email", "recipient_email", "email_snapshot"], "")
        ) || "",
    });

    setLoadedStatement(statement || {});
    setRows(statementRows || []);
    setError("");
    setSuccess("");
    setBusyAction("");
    setLoading(false);
  }, [open, type, year, statement, statementRows, member]);

  if (!open) {
    return null;
  }

  function updateFilter(key, value) {
    setFilters((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      if (key === "year") {
        const dates = periodDates(value || currentYear(), current.period);
        next.from = dates.from;
        next.to = dates.to;
      }

      if (key === "period" && value !== "custom") {
        const dates = periodDates(current.year || currentYear(), value);
        next.from = dates.from;
        next.to = dates.to;
      }

      if ((key === "from" || key === "to") && value) {
        next.period = "custom";
      }

      return next;
    });
  }

  function requestPayload() {
    return {
      member_id: resolvedMemberId || null,
      member_no: resolvedMemberNo !== "--" ? resolvedMemberNo : null,
      statement_type: filters.statement_type,
      type: filters.statement_type,
      year: filters.year,
      period: filters.period,
      from: filters.from,
      to: filters.to,
      date_from: filters.from,
      date_to: filters.to,
      email_to: filters.email_to || recipient.email || null,
      source: "finance_giving_statement_preview",
    };
  }

  async function loadPreview() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const payload = requestPayload();

      const result = await getFirst(
        [
          resolvedMemberId ? `/finance/statements/member/${resolvedMemberId}` : "",
          resolvedMemberId ? `/finance/reports/statements/member/${resolvedMemberId}` : "",
          "/finance/statements/preview",
          "/finance/reports/statements/preview",
          "/finance/statements",
        ],
        {
          params: payload,
        }
      );

      const data = result.data;
      const nextRows = rowsFrom(data);

      setLoadedStatement(statementFrom(data));
      setRows(nextRows);

      setSuccess("Statement preview refreshed.");

      onGenerated?.({
        endpoint: result.endpoint,
        statement: statementFrom(data),
        rows: nextRows,
      });
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load statement preview."
      );
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    setBusyAction("pdf");
    setError("");
    setSuccess("");

    try {
      const payload = requestPayload();

      const result = await postFirst(
        [
          "/finance/statements/pdf",
          "/finance/reports/statements/pdf",
          resolvedMemberId ? `/finance/statements/member/${resolvedMemberId}/pdf` : "",
          "/finance/giving-statements/pdf",
        ],
        payload,
        {
          responseType: "blob",
        }
      );

      const blob =
        result.response?.data instanceof Blob
          ? result.response.data
          : new Blob([result.response?.data], {
              type: "application/pdf",
            });

      downloadBlob(
        blob,
        `${filters.statement_type}-statement-${resolvedMemberNo}-${filters.year}.pdf`
      );

      setSuccess("Statement PDF downloaded.");
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to download statement PDF."
      );
    } finally {
      setBusyAction("");
    }
  }

  async function emailStatement() {
    setBusyAction("email");
    setError("");
    setSuccess("");

    if (!filters.email_to && !recipient.email) {
      setError("Recipient email is required before sending a statement.");
      setBusyAction("");
      return;
    }

    try {
      const payload = requestPayload();

      const result = await postFirst(
        [
          "/finance/statements/email",
          "/finance/reports/statements/email",
          resolvedMemberId ? `/finance/statements/member/${resolvedMemberId}/email` : "",
          "/finance/giving-statements/email",
        ],
        payload
      );

      setSuccess("Statement email sent.");
      onSent?.({
        endpoint: result.endpoint,
        data: result.data,
        payload,
      });
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to send statement email."
      );
    } finally {
      setBusyAction("");
    }
  }

  const body = (
    <section className="finance-panel">
      <div className="finance-page-head">
        <div>
          <span className="finance-kicker">Statements</span>
          <h1>{pretty(filters.statement_type)}</h1>
          <p>
            Generate clear member, donor, pledge, and annual giving statements
            for finance records and year-end communication.
          </p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn"
            onClick={() =>
              exportCsv(
                filteredRows,
                `${filters.statement_type}-statement-${resolvedMemberNo}-${filters.year}.csv`
              )
            }
            disabled={!filteredRows.length}
          >
            <FileSpreadsheet size={16} />
            CSV
          </button>

          <button
            type="button"
            className="finance-btn"
            onClick={() => window.print()}
          >
            <Printer size={16} />
            Print
          </button>

          <button
            type="button"
            className="finance-btn"
            onClick={downloadPdf}
            disabled={busyAction === "pdf"}
          >
            <Download size={16} />
            {busyAction === "pdf" ? "Preparing..." : "PDF"}
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={emailStatement}
            disabled={busyAction === "email"}
          >
            <Send size={16} />
            {busyAction === "email" ? "Sending..." : "Email"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="finance-alert danger">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="finance-alert success">
          <CheckCircle2 size={17} />
          <span>{success}</span>
        </div>
      ) : null}

      <div className="finance-summary-grid compact">
        <div className="finance-summary-card">
          <span>Total Given / Paid</span>
          <strong>{money(summary.total)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Tax Deductible</span>
          <strong>{money(summary.deductible)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Membership</span>
          <strong>{money(summary.membership)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Donation</span>
          <strong>{money(summary.donation)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Transactions</span>
          <strong>{summary.count}</strong>
        </div>
      </div>

      <div className="finance-section">
        <div className="finance-section-title">
          <User size={18} />
          <h3>Recipient</h3>
        </div>

        <div className="finance-detail-grid">
          <div>
            <span>Name</span>
            <strong>{recipient.name}</strong>
          </div>

          <div>
            <span>Member ID</span>
            <strong>{resolvedMemberNo}</strong>
          </div>

          <div>
            <span>Email</span>
            <strong>{recipient.email || "--"}</strong>
          </div>

          <div>
            <span>Phone</span>
            <strong>{recipient.phone || "--"}</strong>
          </div>

          <div className="finance-field-full">
            <span>Address</span>
            <strong>{recipient.address || "--"}</strong>
          </div>
        </div>
      </div>

      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <CalendarDays size={16} />

          <label>
            Type
            <select
              value={filters.statement_type}
              onChange={(event) => updateFilter("statement_type", event.target.value)}
            >
              {STATEMENT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Year
            <input
              type="number"
              min="2000"
              max="2100"
              value={filters.year}
              onChange={(event) => updateFilter("year", event.target.value)}
            />
          </label>

          <label>
            Period
            <select
              value={filters.period}
              onChange={(event) => updateFilter("period", event.target.value)}
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            From
            <input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
            />
          </label>

          <label>
            To
            <input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
            />
          </label>

          <button
            type="button"
            className="finance-btn"
            onClick={loadPreview}
            disabled={loading}
          >
            <RefreshCcw size={16} />
            {loading ? "Loading..." : "Preview"}
          </button>
        </div>

        <div className="finance-search">
          <Search size={16} />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search category, receipt, invoice, method, reference..."
          />
        </div>
      </div>

      <div className="finance-section">
        <div className="finance-section-title">
          <Mail size={18} />
          <h3>Email Delivery</h3>
        </div>

        <div className="finance-form-grid">
          <label>
            Recipient Email
            <input
              type="email"
              value={filters.email_to}
              onChange={(event) => updateFilter("email_to", event.target.value)}
              placeholder="member@example.com"
            />
          </label>
        </div>
      </div>

      <div className="finance-table-shell">
        <table className="finance-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Payment #</th>
              <th>Invoice #</th>
              <th>Receipt #</th>
              <th>Method</th>
              <th>Reference</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9}>
                  <div className="finance-audit-empty">
                    Loading statement transactions...
                  </div>
                </td>
              </tr>
            ) : null}

            {!loading && !filteredRows.length ? (
              <tr>
                <td colSpan={9}>
                  <div className="finance-audit-empty">
                    No statement transactions found for the selected period.
                  </div>
                </td>
              </tr>
            ) : null}

            {!loading &&
              filteredRows.map((row, index) => (
                <tr key={row.id || row.payment_id || row.receipt_id || index}>
                  <td>{formatDate(rowDate(row))}</td>

                  <td>
                    <span className="finance-chip">{pretty(rowCategory(row))}</span>
                  </td>

                  <td>{rowDescription(row)}</td>

                  <td>{clean(row.payment_number)}</td>
                  <td>{clean(row.invoice_number)}</td>
                  <td>{clean(row.receipt_number)}</td>

                  <td>{pretty(row.method || row.payment_method)}</td>

                  <td>
                    <span className="finance-mono">
                      {clean(
                        row.reference_no ||
                          row.reference_number ||
                          row.transaction_reference
                      )}
                    </span>
                  </td>

                  <td className="text-right">
                    <strong>{money(rowAmount(row))}</strong>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="finance-audit-empty">
        <ShieldCheck size={15} />
        Statements are generated from posted finance records. Please review
        payment, receipt, pledge, and membership coverage details before sending.
      </div>
    </section>
  );

  if (embedded) {
    return body;
  }

  return (
    <div className="finance-drawer-backdrop" role="presentation">
      <aside
        className="finance-drawer finance-drawer-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Giving statement preview"
      >
        <div className="finance-drawer-head">
          <div>
            <span className="finance-kicker">Statement Preview</span>
            <h2>{recipient.name}</h2>
            <p>
              Preview, export, print, and email member or donor finance statements.
            </p>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={onClose}
            aria-label="Close statement preview"
          >
            <X size={18} />
          </button>
        </div>

        {body}
      </aside>
    </div>
  );
}