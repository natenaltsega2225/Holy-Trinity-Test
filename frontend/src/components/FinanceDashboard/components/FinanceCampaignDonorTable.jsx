import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  Phone,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  User,
  Users,
  XCircle,
} from "lucide-react";
import api from "../../api";
import "../../../styles/finance-enterprise.css";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "pledged", label: "Pledged" },
  { value: "overdue", label: "Overdue" },
  { value: "unpaid", label: "Unpaid" },
  { value: "cancelled", label: "Cancelled" },
];

const DONOR_TYPE_OPTIONS = [
  { value: "", label: "All Donors" },
  { value: "member", label: "Members" },
  { value: "guest", label: "Guests / Non-Members" },
  { value: "organization", label: "Organizations" },
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
  if (Array.isArray(data.donors)) return data.donors;
  if (Array.isArray(data.supporters)) return data.supporters;
  if (Array.isArray(data.pledges)) return data.pledges;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function campaignId(campaign) {
  return campaign?.id || campaign?.campaign_id || "";
}

function campaignTitle(campaign) {
  return clean(campaign?.title || campaign?.campaign_name || campaign?.name || "Campaign");
}

function donorId(row) {
  return row?.id || row?.donor_id || row?.pledge_id || row?.member_id || row?.email || "";
}

function donorName(row) {
  return clean(
    row?.full_name ||
      row?.full_name_snapshot ||
      row?.donor_name ||
      row?.member_name ||
      row?.guest_name ||
      row?.name,
    "Guest Donor"
  );
}

function donorEmail(row) {
  return clean(row?.email || row?.email_snapshot || row?.donor_email || row?.member_email, "");
}

function donorPhone(row) {
  return clean(row?.phone || row?.phone_snapshot || row?.donor_phone || row?.member_phone, "");
}

function pledgedAmount(row) {
  return numberValue(row?.pledged_amount || row?.pledge_amount || row?.total_pledged);
}

function paidAmount(row) {
  return numberValue(row?.paid_amount || row?.amount_paid || row?.total_paid || row?.payment_amount);
}

function remainingAmount(row) {
  const explicit = row?.remaining_amount || row?.remaining_balance || row?.balance_due;

  if (explicit !== undefined && explicit !== null && String(explicit).trim() !== "") {
    return Math.max(0, numberValue(explicit));
  }

  return Math.max(0, pledgedAmount(row) - paidAmount(row));
}

function donorStatus(row) {
  return clean(row?.status || row?.pledge_status || row?.payment_status || "pledged");
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();

  if (["paid", "completed", "fulfilled", "active"].includes(status)) return "success";
  if (["partial", "pledged", "pending", "open"].includes(status)) return "warning";
  if (["overdue", "unpaid", "failed", "cancelled", "void"].includes(status)) return "danger";

  return "neutral";
}

function summaryFrom(data, rows) {
  const source = data.summary || data.totals || {};

  return {
    donors: source.donors ?? source.count ?? rows.length,
    pledged:
      source.pledged_amount ??
      rows.reduce((sum, row) => sum + pledgedAmount(row), 0),
    paid:
      source.paid_amount ??
      rows.reduce((sum, row) => sum + paidAmount(row), 0),
    remaining:
      source.remaining_amount ??
      rows.reduce((sum, row) => sum + remainingAmount(row), 0),
    overdue:
      source.overdue_count ??
      rows.filter((row) => donorStatus(row).toLowerCase() === "overdue").length,
    partial:
      source.partial_count ??
      rows.filter((row) => donorStatus(row).toLowerCase() === "partial").length,
  };
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

      if ([404, 405].includes(err?.response?.status)) continue;

      throw err;
    }
  }

  throw lastError || new Error("Campaign donor endpoint is not available.");
}

async function postFirst(paths, payload = {}) {
  let lastError = null;

  for (const path of paths.filter(Boolean)) {
    try {
      const response = await api.post(path, payload);

      return {
        endpoint: path,
        data: responseData(response),
      };
    } catch (err) {
      lastError = err;

      if ([404, 405].includes(err?.response?.status)) continue;

      throw err;
    }
  }

  throw lastError || new Error("Campaign donor action endpoint is not available.");
}

function exportCsv(rows, campaign) {
  const headers = [
    "Donor",
    "Member #",
    "Type",
    "Email",
    "Phone",
    "Pledged",
    "Paid",
    "Remaining",
    "Status",
    "Due Date",
    "Last Payment",
  ];

  const body = rows.map((row) => [
    donorName(row),
    clean(row.member_no || row.member_number),
    pretty(row.donor_type || row.payer_type || (row.member_id ? "member" : "guest")),
    donorEmail(row),
    donorPhone(row),
    pledgedAmount(row).toFixed(2),
    paidAmount(row).toFixed(2),
    remainingAmount(row).toFixed(2),
    pretty(donorStatus(row)),
    formatDate(row.due_date || row.pledge_due_date),
    formatDate(row.last_payment_at || row.paid_at),
  ]);

  const csv = [headers, ...body]
    .map((line) =>
      line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `campaign-donors-${campaignId(campaign) || "campaign"}-${todayIso()}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

export default function FinanceCampaignDonorTable({
  campaign = null,
  rows = null,
  autoLoad = true,
  compact = false,
  onOpenDonor,
  onOpenPledge,
  onOpenInvoice,
  onOpenReceipt,
  onCreateInvoice,
  onSendReminder,
  onRowsLoaded,
}) {
  const [internalRows, setInternalRows] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    donor_type: "",
  });
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const id = campaignId(campaign);
  const sourceRows = Array.isArray(rows) ? rows : internalRows;

  const visibleRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return sourceRows.filter((row) => {
      const haystack = [
        donorName(row),
        donorEmail(row),
        donorPhone(row),
        row.member_no,
        row.pledge_number,
        row.invoice_number,
        row.receipt_number,
        donorStatus(row),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || haystack.includes(search);

      const matchesStatus =
        !filters.status ||
        donorStatus(row).toLowerCase() === filters.status.toLowerCase();

      const type = String(
        row.donor_type || row.payer_type || (row.member_id ? "member" : "guest")
      ).toLowerCase();

      const matchesDonorType = !filters.donor_type || type === filters.donor_type.toLowerCase();

      return matchesSearch && matchesStatus && matchesDonorType;
    });
  }, [sourceRows, filters]);

  const selectedRows = useMemo(
    () => sourceRows.filter((row) => selected[donorId(row)]),
    [sourceRows, selected]
  );

  const summary = useMemo(() => summaryFrom({}, visibleRows), [visibleRows]);

  async function loadDonors() {
    if (Array.isArray(rows) || !id) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await getFirst(
        [
          `/finance/campaigns/${id}/donors`,
          `/finance/pledges/campaigns/${id}/donors`,
          `/finance/campaigns/${id}/pledges`,
          `/finance/pledges?campaign_id=${id}`,
        ],
        {
          params: {
            search: filters.search,
            status: filters.status,
            donor_type: filters.donor_type,
            limit: compact ? 25 : 250,
          },
        }
      );

      const nextRows = rowsFrom(result.data);
      setInternalRows(nextRows);
      setSelected({});
      onRowsLoaded?.(nextRows);
    } catch (err) {
      setInternalRows([]);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load campaign donors."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoLoad || !id) return;
    loadDonors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleRow(row, checked) {
    const rowId = donorId(row);
    if (!rowId) return;

    setSelected((current) => ({
      ...current,
      [rowId]: checked,
    }));
  }

  function toggleAll(checked) {
    if (!checked) {
      setSelected({});
      return;
    }

    const next = {};
    visibleRows.forEach((row) => {
      const rowId = donorId(row);
      if (rowId) next[rowId] = true;
    });

    setSelected(next);
  }

  async function runReminder(row) {
    setBusyAction(`reminder:${donorId(row)}`);
    setError("");
    setSuccess("");

    try {
      if (onSendReminder) {
        await onSendReminder(row, campaign);
      } else {
        await postFirst(
          [
            `/finance/campaigns/${id}/donors/${donorId(row)}/reminder`,
            `/finance/pledges/${row.pledge_id || row.id}/reminder`,
            "/finance/pledge-reminders/send",
          ],
          {
            campaign_id: id,
            donor_id: donorId(row),
            pledge_id: row.pledge_id || row.id || null,
            email: donorEmail(row) || null,
            phone: donorPhone(row) || null,
            source: "finance_campaign_donor_table",
          }
        );
      }

      setSuccess("Reminder sent.");
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to send donor reminder."
      );
    } finally {
      setBusyAction("");
    }
  }

  async function runBulkReminder() {
    if (!selectedRows.length) {
      setError("Select at least one donor.");
      return;
    }

    setBusyAction("bulk-reminder");
    setError("");
    setSuccess("");

    try {
      await postFirst(
        [
          `/finance/campaigns/${id}/donors/reminders`,
          `/finance/pledges/campaigns/${id}/reminders`,
          "/finance/pledge-reminders/bulk-send",
        ],
        {
          campaign_id: id,
          donors: selectedRows,
          donor_ids: selectedRows.map(donorId),
          source: "finance_campaign_donor_table",
        }
      );

      setSuccess(`Reminder queued for ${selectedRows.length} donor(s).`);
      setSelected({});
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to send bulk reminders."
      );
    } finally {
      setBusyAction("");
    }
  }

  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((row) => selected[donorId(row)]);

  return (
    <section className={`finance-panel ${compact ? "compact" : ""}`}>
      <div className="finance-page-head">
        <div>
          <span className="finance-kicker">Campaign Donors</span>
          <h1>{campaignTitle(campaign)}</h1>
          <p>
            Track donors, pledge commitments, paid amounts, open balances,
            reminders, invoices, and receipts.
          </p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn"
            onClick={() => exportCsv(visibleRows, campaign)}
            disabled={!visibleRows.length}
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            className="finance-btn"
            onClick={loadDonors}
            disabled={loading || Array.isArray(rows) || !id}
          >
            <RefreshCcw size={16} />
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={runBulkReminder}
            disabled={!selectedRows.length || Boolean(busyAction)}
          >
            <Send size={16} />
            Bulk Reminder
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
          <span>Donors</span>
          <strong>{summary.donors}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Pledged</span>
          <strong>{money(summary.pledged)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Paid</span>
          <strong>{money(summary.paid)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Remaining</span>
          <strong>{money(summary.remaining)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Overdue</span>
          <strong>{summary.overdue}</strong>
        </div>
      </div>

      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <label>
            Status
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Donor Type
            <select
              value={filters.donor_type}
              onChange={(event) => updateFilter("donor_type", event.target.value)}
            >
              {DONOR_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="finance-btn primary"
            onClick={loadDonors}
            disabled={loading || Array.isArray(rows)}
          >
            Apply
          </button>
        </div>

        <div className="finance-search">
          <Search size={16} />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search donor, member id, email, phone, pledge, invoice..."
          />
        </div>
      </div>

      {selectedRows.length ? (
        <div className="finance-bulk-bar">
          <div>
            <strong>{selectedRows.length}</strong> selected
            <span>{money(selectedRows.reduce((sum, row) => sum + remainingAmount(row), 0))}</span>
          </div>

          <div>
            <button
              type="button"
              className="finance-btn"
              onClick={() => setSelected({})}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <div className="finance-table-shell">
        <table className="finance-table">
          <thead>
            <tr>
              <th className="finance-check-col">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                  aria-label="Select all campaign donors"
                />
              </th>
              <th>Donor</th>
              <th>Contact</th>
              <th className="text-right">Pledged</th>
              <th className="text-right">Paid</th>
              <th className="text-right">Remaining</th>
              <th>Status</th>
              <th>Due / Last Payment</th>
              <th>Documents</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10}>
                  <div className="finance-audit-empty">Loading campaign donors...</div>
                </td>
              </tr>
            ) : null}

            {!loading && !visibleRows.length ? (
              <tr>
                <td colSpan={10}>
                  <div className="finance-audit-empty">
                    No campaign donor records found.
                  </div>
                </td>
              </tr>
            ) : null}

            {!loading &&
              visibleRows.map((row) => {
                const rowId = donorId(row);

                return (
                  <tr key={rowId}>
                    <td className="finance-check-col">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[rowId])}
                        onChange={(event) => toggleRow(row, event.target.checked)}
                        aria-label={`Select ${donorName(row)}`}
                      />
                    </td>

                    <td>
                      <button
                        type="button"
                        className="finance-link-button"
                        onClick={() => onOpenDonor?.(row)}
                      >
                        {donorName(row)}
                      </button>
                      <small>
                        <User size={12} />
                        {clean(row.member_no || row.member_number || row.donor_type || "Guest")}
                      </small>
                    </td>

                    <td>
                      <div className="finance-cell-stack">
                        <small>
                          <Mail size={12} />
                          {donorEmail(row) || "--"}
                        </small>
                        <small>
                          <Phone size={12} />
                          {donorPhone(row) || "--"}
                        </small>
                      </div>
                    </td>

                    <td className="text-right">
                      <strong>{money(pledgedAmount(row))}</strong>
                    </td>

                    <td className="text-right">
                      <strong>{money(paidAmount(row))}</strong>
                    </td>

                    <td className="text-right">
                      <strong>{money(remainingAmount(row))}</strong>
                    </td>

                    <td>
                      <span className={`finance-status ${statusClass(donorStatus(row))}`}>
                        {pretty(donorStatus(row))}
                      </span>
                    </td>

                    <td>
                      <div className="finance-cell-stack">
                        <small>
                          <CalendarDays size={12} />
                          Due {formatDate(row.due_date || row.pledge_due_date)}
                        </small>
                        <small>
                          Last {formatDate(row.last_payment_at || row.paid_at)}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div className="finance-inline-actions">
                        {row.invoice_number ? (
                          <button
                            type="button"
                            className="finance-mini-btn"
                            onClick={() => onOpenInvoice?.(row)}
                          >
                            <FileText size={13} />
                            Invoice
                          </button>
                        ) : null}

                        {row.receipt_number ? (
                          <button
                            type="button"
                            className="finance-mini-btn"
                            onClick={() => onOpenReceipt?.(row)}
                          >
                            <ShieldCheck size={13} />
                            Receipt
                          </button>
                        ) : null}

                        {!row.invoice_number && !row.receipt_number ? "--" : null}
                      </div>
                    </td>

                    <td>
                      <div className="finance-row-actions">
                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => onOpenPledge?.(row)}
                        >
                          <Users size={13} />
                          Pledge
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => onCreateInvoice?.(row)}
                        >
                          <FileText size={13} />
                          Invoice
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => runReminder(row)}
                          disabled={Boolean(busyAction)}
                        >
                          <Send size={13} />
                          Remind
                        </button>

                        <button
                          type="button"
                          className="finance-mini-btn danger"
                          onClick={() => onOpenPledge?.({ ...row, action: "cancel" })}
                        >
                          <XCircle size={13} />
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}