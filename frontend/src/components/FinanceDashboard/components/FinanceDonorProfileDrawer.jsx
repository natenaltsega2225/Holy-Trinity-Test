// frontend/src/components/FinanceDashboard/components/FinanceDonorProfileDrawer.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  FileText,
  Mail,
  Phone,
  Receipt,
  RefreshCcw,
  Send,
  UserRound,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "payments", label: "Payments" },
  { key: "invoices", label: "Invoices" },
  { key: "receipts", label: "Receipts" },
  { key: "pledges", label: "Pledges" },
];

function clean(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function pretty(value) {
  const text = clean(value);
  if (!text) return "--";

  return text
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "--";

  const raw = clean(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) return `${match[2]}/${match[3]}/${match[1]}`;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return raw;

  return d.toLocaleDateString("en-US");
}

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];

    if (value !== undefined && value !== null && clean(value) !== "") {
      return value;
    }
  }

  return fallback;
}

function normalizeRows(payload, keys = []) {
  if (Array.isArray(payload)) return payload;

  for (const key of keys) {
    const value = payload?.[key] || payload?.data?.[key];
    if (Array.isArray(value)) return value;
  }

  const candidates = [
    payload?.rows,
    payload?.data,
    payload?.items,
    payload?.results,
    payload?.data?.rows,
    payload?.data?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function statusTone(value) {
  const status = clean(value).toLowerCase();

  if (["active", "paid", "completed", "posted", "sent", "issued"].includes(status)) {
    return "success";
  }

  if (["pending", "open", "partial", "processing", "unpaid"].includes(status)) {
    return "warning";
  }

  if (["failed", "overdue", "void", "cancelled", "inactive"].includes(status)) {
    return "danger";
  }

  return "neutral";
}

function StatusBadge({ status }) {
  return (
    <span className={`finance-status-badge ${statusTone(status)}`}>
      {pretty(status)}
    </span>
  );
}

function donorId(donor) {
  return firstValue(donor, ["id", "member_id", "donor_id", "payer_id"], "");
}

function memberNo(donor) {
  return firstValue(donor, ["member_no", "member_number"], "");
}

function fullName(donor) {
  return firstValue(
    donor,
    [
      "full_name",
      "full_name_snapshot",
      "member_name",
      "payer_name",
      "donor_name",
      "guest_name",
      "name",
    ],
    "Guest Donor"
  );
}

function email(donor) {
  return firstValue(
    donor,
    [
      "email",
      "email_snapshot",
      "member_email",
      "payer_email",
      "donor_email",
      "guest_email",
    ],
    ""
  );
}

function phone(donor) {
  return firstValue(
    donor,
    ["phone", "phone_snapshot", "member_phone", "payer_phone", "donor_phone"],
    ""
  );
}

function donorType(donor) {
  const type = firstValue(donor, ["payer_type", "donor_type", "member_type"], "");
  if (type) return type;

  return donorId(donor) || memberNo(donor) ? "member" : "guest";
}

function paymentAmount(row) {
  return numberValue(firstValue(row, ["amount", "payment_amount", "total_amount"], 0));
}

function invoiceTotal(row) {
  return numberValue(firstValue(row, ["total_amount", "amount", "invoice_amount"], 0));
}

function receiptAmount(row) {
  return numberValue(firstValue(row, ["amount", "receipt_amount", "total_amount"], 0));
}

function pledgeAmount(row) {
  return numberValue(firstValue(row, ["pledged_amount", "pledge_amount", "amount"], 0));
}

function pledgeRemaining(row) {
  return numberValue(
    firstValue(row, ["remaining_amount", "remaining_balance", "balance_due"], 0)
  );
}

async function getFirst(endpoints, config = {}) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.get(endpoint, config);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

async function postFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.post(endpoint, payload);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

function MiniTable({ rows, columns, emptyText }) {
  return (
    <div className="finance-table-wrap compact">
      <table className="finance-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {!rows.length ? (
            <tr>
              <td colSpan={columns.length} className="finance-empty-cell">
                {emptyText}
              </td>
            </tr>
          ) : null}

          {rows.map((row, index) => (
            <tr key={row.id || row.payment_number || row.invoice_number || index}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(row) : firstValue(row, [column.key], "--")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FinanceDonorProfileDrawer({
  open,
  donor,
  onClose,
  onCreatePayment,
  onCreateInvoice,
  onCreatePledge,
  onViewMember,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [profile, setProfile] = useState(donor || {});
  const [activity, setActivity] = useState({
    payments: [],
    invoices: [],
    receipts: [],
    pledges: [],
  });

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const id = donorId(profile || donor);
  const no = memberNo(profile || donor);
  const type = donorType(profile || donor);
  const isMember = clean(type).toLowerCase() === "member" || Boolean(id || no);

  const totals = useMemo(() => {
    const paid = activity.payments.reduce((sum, row) => sum + paymentAmount(row), 0);
    const invoiced = activity.invoices.reduce((sum, row) => sum + invoiceTotal(row), 0);
    const receipted = activity.receipts.reduce((sum, row) => sum + receiptAmount(row), 0);
    const pledged = activity.pledges.reduce((sum, row) => sum + pledgeAmount(row), 0);
    const pledgeOpen = activity.pledges.reduce((sum, row) => sum + pledgeRemaining(row), 0);

    return {
      paid,
      invoiced,
      receipted,
      pledged,
      pledgeOpen,
    };
  }, [activity]);

  const loadProfile = useCallback(async () => {
    if (!open || !donor) return;

    setLoading(true);
    setError("");

    const baseId = donorId(donor);
    const baseNo = memberNo(donor);
    const baseEmail = email(donor);

    try {
      const params = {
        member_id: baseId || "",
        member_no: baseNo || "",
        email: baseEmail || "",
        q: baseNo || baseEmail || fullName(donor),
      };

      const payload = await getFirst(
        [
          baseId ? `/finance/members/${baseId}/profile` : "",
          baseId ? `/finance/members/${baseId}` : "",
          "/finance/donor-profile",
          "/finance/search",
        ].filter(Boolean),
        { params }
      );

      const nextProfile =
        payload?.profile ||
        payload?.member ||
        payload?.donor ||
        payload?.data?.profile ||
        payload?.data?.member ||
        payload?.data?.donor ||
        donor;

      setProfile({
        ...donor,
        ...nextProfile,
      });

      setActivity({
        payments: normalizeRows(payload, ["payments"]),
        invoices: normalizeRows(payload, ["invoices"]),
        receipts: normalizeRows(payload, ["receipts"]),
        pledges: normalizeRows(payload, ["pledges"]),
      });
    } catch (_err) {
      setProfile(donor);

      try {
        const [payments, invoices, receipts, pledges] = await Promise.all([
          getFirst(["/finance/payments"], {
            params: {
              member_id: baseId,
              member_no: baseNo,
              email: baseEmail,
              limit: 10,
            },
          }),
          getFirst(["/finance/invoices"], {
            params: {
              member_id: baseId,
              member_no: baseNo,
              email: baseEmail,
              limit: 10,
            },
          }),
          getFirst(["/finance/receipts"], {
            params: {
              member_id: baseId,
              member_no: baseNo,
              email: baseEmail,
              limit: 10,
            },
          }),
          getFirst(["/finance/pledges"], {
            params: {
              member_id: baseId,
              member_no: baseNo,
              email: baseEmail,
              limit: 10,
            },
          }),
        ]);

        setActivity({
          payments: normalizeRows(payments, ["payments"]),
          invoices: normalizeRows(invoices, ["invoices"]),
          receipts: normalizeRows(receipts, ["receipts"]),
          pledges: normalizeRows(pledges, ["pledges"]),
        });
      } catch (err) {
        setError(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load donor profile activity."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [open, donor]);

  useEffect(() => {
    if (open) {
      setProfile(donor || {});
      setActiveTab("overview");
      setSuccess("");
      setError("");
      loadProfile();
    }
  }, [open, donor, loadProfile]);

  async function sendStatement() {
    const currentEmail = email(profile);

    if (!currentEmail) {
      setError("Email is required before sending a statement.");
      return;
    }

    setSending("statement");
    setError("");
    setSuccess("");

    try {
      await postFirst(
        [
          "/finance/statements/send",
          "/finance/member-statements/send",
          "/finance/reports/statements/send",
        ],
        {
          member_id: id || null,
          member_no: no || null,
          email: currentEmail,
          full_name: fullName(profile),
          payer_type: type,
          statement_type: "giving_statement",
          source: "finance_donor_profile_drawer",
        }
      );

      setSuccess("Statement email queued successfully.");
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to send statement."
      );
    } finally {
      setSending("");
    }
  }

  if (!open) return null;

  return (
    <aside className="finance-drawer-backdrop" role="presentation">
      <div className="finance-drawer finance-donor-profile-drawer">
        <div className="finance-drawer-head">
          <div>
            <p className="finance-eyebrow">Donor Profile</p>
            <h2>{fullName(profile)}</h2>
            <span>
              {isMember ? no || "Member" : "Non-Member / Guest"}
              {email(profile) ? ` - ${email(profile)}` : ""}
            </span>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="finance-alert danger">
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

        <div className="finance-selected-member">
          <div className="finance-selected-member-icon">
            <UserRound size={20} />
          </div>

          <div>
            <strong>{fullName(profile)}</strong>
            <span>
              {pretty(type)}
              {no ? ` - ${no}` : ""}
            </span>
            <small>
              {phone(profile) || "--"}
              {firstValue(profile, ["membership_status", "status"], "") ? " - " : ""}
              {firstValue(profile, ["membership_status", "status"], "") ? (
                <StatusBadge
                  status={firstValue(profile, ["membership_status", "status"], "")}
                />
              ) : null}
            </small>
          </div>
        </div>

        <div className="finance-summary-grid compact">
          <div className="finance-summary-card">
            <span>Total Paid</span>
            <strong>{money(totals.paid)}</strong>
            <small>Payment history</small>
          </div>

          <div className="finance-summary-card">
            <span>Invoiced</span>
            <strong>{money(totals.invoiced)}</strong>
            <small>Invoice total</small>
          </div>

          <div className="finance-summary-card">
            <span>Receipts</span>
            <strong>{money(totals.receipted)}</strong>
            <small>Issued receipts</small>
          </div>

          <div className="finance-summary-card">
            <span>Pledge Open</span>
            <strong>{money(totals.pledgeOpen)}</strong>
            <small>Remaining pledge</small>
          </div>
        </div>

        <div className="finance-row-actions finance-drawer-actions">
          <button
            type="button"
            className="finance-btn primary"
            onClick={() => onCreatePayment?.(profile)}
          >
            <CreditCard size={16} />
            Payment
          </button>

          <button
            type="button"
            className="finance-btn ghost"
            onClick={() => onCreateInvoice?.(profile)}
          >
            <FileText size={16} />
            Invoice
          </button>

          <button
            type="button"
            className="finance-btn ghost"
            onClick={() => onCreatePledge?.(profile)}
          >
            <Receipt size={16} />
            Pledge
          </button>

          <button
            type="button"
            className="finance-btn ghost"
            onClick={sendStatement}
            disabled={sending === "statement"}
          >
            <Send size={16} />
            {sending === "statement" ? "Sending..." : "Statement"}
          </button>
        </div>

        <div className="finance-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "active" : ""}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="finance-drawer-body">
          {loading ? (
            <div className="finance-empty-cell">Loading profile...</div>
          ) : null}

          {!loading && activeTab === "overview" ? (
            <div className="finance-detail-grid">
              <div>
                <span>Full Name</span>
                <strong>{fullName(profile)}</strong>
              </div>

              <div>
                <span>Member ID</span>
                <strong>{no || "--"}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{email(profile) || "--"}</strong>
              </div>

              <div>
                <span>Phone</span>
                <strong>{phone(profile) || "--"}</strong>
              </div>

              <div>
                <span>Type</span>
                <strong>{pretty(type)}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  <StatusBadge
                    status={firstValue(
                      profile,
                      ["membership_status", "status"],
                      isMember ? "active" : "guest"
                    )}
                  />
                </strong>
              </div>

              <div>
                <span>Address</span>
                <strong>
                  {[
                    firstValue(profile, ["address", "street_address"], ""),
                    firstValue(profile, ["city"], ""),
                    firstValue(profile, ["state"], ""),
                    firstValue(profile, ["zip", "postal_code"], ""),
                  ]
                    .filter(Boolean)
                    .join(", ") || "--"}
                </strong>
              </div>

              <div>
                <span>Last Activity</span>
                <strong>
                  {formatDate(
                    firstValue(
                      profile,
                      ["last_payment_at", "updated_at", "created_at"],
                      ""
                    )
                  )}
                </strong>
              </div>
            </div>
          ) : null}

          {!loading && activeTab === "payments" ? (
            <MiniTable
              rows={activity.payments}
              emptyText="No payments found."
              columns={[
                {
                  key: "payment_number",
                  label: "Payment #",
                  render: (row) => firstValue(row, ["payment_number"], "--"),
                },
                {
                  key: "category",
                  label: "Category",
                  render: (row) => pretty(firstValue(row, ["category", "payment_type"], "--")),
                },
                {
                  key: "amount",
                  label: "Amount",
                  render: (row) => money(paymentAmount(row)),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <StatusBadge status={firstValue(row, ["status"], "--")} />,
                },
                {
                  key: "date",
                  label: "Date",
                  render: (row) =>
                    formatDate(firstValue(row, ["paid_at", "created_at"], "")),
                },
              ]}
            />
          ) : null}

          {!loading && activeTab === "invoices" ? (
            <MiniTable
              rows={activity.invoices}
              emptyText="No invoices found."
              columns={[
                {
                  key: "invoice_number",
                  label: "Invoice #",
                  render: (row) => firstValue(row, ["invoice_number"], "--"),
                },
                {
                  key: "total_amount",
                  label: "Total",
                  render: (row) => money(invoiceTotal(row)),
                },
                {
                  key: "balance_due",
                  label: "Balance",
                  render: (row) =>
                    money(firstValue(row, ["balance_due", "remaining_amount"], 0)),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <StatusBadge status={firstValue(row, ["status"], "--")} />,
                },
                {
                  key: "date",
                  label: "Date",
                  render: (row) =>
                    formatDate(firstValue(row, ["invoice_date", "created_at"], "")),
                },
              ]}
            />
          ) : null}

          {!loading && activeTab === "receipts" ? (
            <MiniTable
              rows={activity.receipts}
              emptyText="No receipts found."
              columns={[
                {
                  key: "receipt_number",
                  label: "Receipt #",
                  render: (row) => firstValue(row, ["receipt_number"], "--"),
                },
                {
                  key: "amount",
                  label: "Amount",
                  render: (row) => money(receiptAmount(row)),
                },
                {
                  key: "email_status",
                  label: "Email",
                  render: (row) => (
                    <StatusBadge status={firstValue(row, ["email_status"], "issued")} />
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <StatusBadge status={firstValue(row, ["status"], "--")} />,
                },
                {
                  key: "date",
                  label: "Date",
                  render: (row) =>
                    formatDate(firstValue(row, ["issued_at", "created_at"], "")),
                },
              ]}
            />
          ) : null}

          {!loading && activeTab === "pledges" ? (
            <MiniTable
              rows={activity.pledges}
              emptyText="No pledges found."
              columns={[
                {
                  key: "pledge_number",
                  label: "Pledge #",
                  render: (row) => firstValue(row, ["pledge_number"], "--"),
                },
                {
                  key: "campaign",
                  label: "Campaign",
                  render: (row) =>
                    firstValue(row, ["campaign_name", "campaign_title"], "--"),
                },
                {
                  key: "pledged_amount",
                  label: "Pledged",
                  render: (row) => money(pledgeAmount(row)),
                },
                {
                  key: "remaining",
                  label: "Remaining",
                  render: (row) => money(pledgeRemaining(row)),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => <StatusBadge status={firstValue(row, ["status"], "--")} />,
                },
              ]}
            />
          ) : null}
        </div>

        <div className="finance-drawer-footer">
          <button type="button" className="finance-btn ghost" onClick={loadProfile}>
            <RefreshCcw size={16} />
            Refresh
          </button>

          {isMember ? (
            <button
              type="button"
              className="finance-btn ghost"
              onClick={() => onViewMember?.(profile)}
            >
              <UserRound size={16} />
              Member Profile
            </button>
          ) : null}

          {email(profile) ? (
            <a className="finance-btn ghost" href={`mailto:${email(profile)}`}>
              <Mail size={16} />
              Email
            </a>
          ) : null}

          {phone(profile) ? (
            <a className="finance-btn ghost" href={`tel:${phone(profile)}`}>
              <Phone size={16} />
              Call
            </a>
          ) : null}
        </div>
      </div>
    </aside>
  );
}