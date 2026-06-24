
// frontend/src/components/FinanceDashboard/pages/FinanceMemberProfile.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  HeartHandshake,
  Mail,
  Plus,
  Receipt,
  RefreshCcw,
  Send,
  ShieldCheck,
  Target,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";
import FinanceActionMenu from "../components/FinanceActionMenu"
const TABS = [
  { key: "overview", label: "Overview", icon: UserRound },
  { key: "coverage", label: "Coverage", icon: CalendarDays },
  { key: "dependents", label: "Dependents", icon: Users },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "receipts", label: "Receipts", icon: Receipt },
  { key: "pledges", label: "Pledges", icon: Target },
 
];

const MONTHS = [
  { value: 1, short: "Jan", label: "January" },
  { value: 2, short: "Feb", label: "February" },
  { value: 3, short: "Mar", label: "March" },
  { value: 4, short: "Apr", label: "April" },
  { value: 5, short: "May", label: "May" },
  { value: 6, short: "Jun", label: "June" },
  { value: 7, short: "Jul", label: "July" },
  { value: 8, short: "Aug", label: "August" },
  { value: 9, short: "Sep", label: "September" },
  { value: 10, short: "Oct", label: "October" },
  { value: 11, short: "Nov", label: "November" },
  { value: 12, short: "Dec", label: "December" },
];

function clean(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return `$${numberValue(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function firstValue(source = {}, keys = [], fallback = "") {
  for (const key of keys) {
    const value = source?.[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
}

function formatDate(value) {
  if (!value) return "--";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return String(value);
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "--";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return String(value);
  }

  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toInputDate(value) {
  if (!value) return "";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  return d.toISOString().slice(0, 10);
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();

  if (["active", "paid", "completed", "issued", "sent", "cleared"].includes(status)) {
    return "success";
  }

  if (["pending", "pending_payment", "open", "partial", "processing"].includes(status)) {
    return "warning";
  }

  if (["inactive", "failed", "cancelled", "void", "overdue", "returned"].includes(status)) {
    return "danger";
  }

  return "neutral";
}

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function StatusBadge({ value }) {
  return (
    <span className={`finance-status-badge ${statusClass(value)}`}>
      {pretty(value)}
    </span>
  );
}

function normalizeRows(data, keys = []) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;

  return [];
}

function normalizeMember(data) {
  return (
    data?.member ||
    data?.profile ||
    data?.row ||
    data?.data?.member ||
    data?.data?.profile ||
    data?.data ||
    data ||
    null
  );
}

async function getFirst(endpoints, fallback = null) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const res = await api.get(endpoint);
      return res.data;
    } catch (err) {
      lastError = err;

      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) {
        throw err;
      }
    }
  }

  if (fallback !== null) return fallback;

  throw lastError || new Error("Requested resource was not found.");
}

async function postFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      return await api.post(endpoint, payload);
    } catch (err) {
      lastError = err;

      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) {
        throw err;
      }
    }
  }

  throw lastError || new Error("No endpoint is available.");
}

async function patchFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      return await api.patch(endpoint, payload);
    } catch (err) {
      lastError = err;

      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) {
        throw err;
      }
    }
  }

  throw lastError || new Error("No endpoint is available.");
}

async function openFirstDocument(endpoints, filename) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const res = await api.get(endpoint, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: res.headers?.["content-type"] || "application/pdf",
      });

      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");

      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    } catch (err) {
      lastError = err;

      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) {
        throw err;
      }
    }
  }

  throw lastError || new Error(`Unable to open ${filename || "document"}.`);
}

function memberFullName(member = {}) {
  return firstValue(
    member,
    ["full_name", "full_name_snapshot", "name"],
    `${firstValue(member, ["first_name"], "")} ${firstValue(member, ["last_name"], "")}`.trim()
  );
}

function memberEmail(member = {}) {
  return firstValue(member, ["email", "email_snapshot", "primary_email"], "");
}

function memberPhone(member = {}) {
  return firstValue(member, ["phone", "phone_snapshot", "primary_phone"], "");
}

function memberNumber(member = {}) {
  return firstValue(member, ["member_no", "member_number", "membership_id"], "--");
}

function parseJsonMaybe(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    return parsed || fallback;
  } catch (_err) {
    return fallback;
  }
}

function coverageMonthsFrom(member = {}, coverage = {}) {
  const explicit = parseJsonMaybe(
    firstValue(
      coverage,
      ["coverage_months_json", "coverage_months", "months_json", "months"],
      ""
    ),
    []
  );

  if (explicit.length) {
    return explicit.map((item) => Number(item)).filter(Boolean);
  }

  const start = numberValue(
    firstValue(coverage, ["coverage_start_month", "start_month"], firstValue(member, ["coverage_start_month"], 0))
  );

  const end = numberValue(
    firstValue(coverage, ["coverage_end_month", "end_month"], firstValue(member, ["coverage_end_month"], 0))
  );

  if (start && end && start <= end) {
    return MONTHS.filter((month) => month.value >= start && month.value <= end).map(
      (month) => month.value
    );
  }

  return [];
}

function DataTable({ columns = [], rows = [], empty = "No records found." }) {
  if (!rows.length) {
    return <div className="finance-empty-state">{empty}</div>;
  }

  return (
    <div className="finance-table-wrap">
      <table className="finance-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key || column.label}>{column.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || row.invoice_number || row.receipt_number || row.payment_number || index}>
              {columns.map((column) => (
                <td key={column.key || column.label}>
                  {column.render
                    ? column.render(row[column.key], row, index)
                    : row[column.key] ?? "--"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DependentModal({ open, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    relationship: "child",
    gender: "",
    date_of_birth: "",
    email: "",
    phone: "",
    school_grade: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;

    setForm({
      first_name: "",
      last_name: "",
      relationship: "child",
      gender: "",
      date_of_birth: "",
      email: "",
      phone: "",
      school_grade: "",
      notes: "",
    });
  }, [open]);

  if (!open) return null;

  function update(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function submit(event) {
    event.preventDefault();

    const fullName = `${clean(form.first_name)} ${clean(form.last_name)}`.trim();

    onSave({
      ...form,
      full_name: fullName,
      is_active: 1,
      status: "active",
    });
  }

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <div
        className="finance-modal finance-dependent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dependent-modal-title"
      >
        <form onSubmit={submit}>
          <div className="finance-modal-header">
            <div className="finance-modal-title-row">
              <span className="finance-modal-icon">
                <Users size={20} />
              </span>

              <div>
                <h2 id="dependent-modal-title">Add Dependent</h2>
                <p>Add a child or household dependent to this member profile.</p>
              </div>
            </div>

            <button
              type="button"
              className="finance-icon-button"
              onClick={onClose}
              aria-label="Close add dependent modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="finance-modal-body">
            <div className="finance-form-grid">
              <label className="finance-field">
                <span>First Name *</span>
                <input
                  value={form.first_name}
                  onChange={(event) => update("first_name", event.target.value)}
                  required
                />
              </label>

              <label className="finance-field">
                <span>Last Name *</span>
                <input
                  value={form.last_name}
                  onChange={(event) => update("last_name", event.target.value)}
                  required
                />
              </label>

              <label className="finance-field">
                <span>Relationship *</span>
                <select
                  value={form.relationship}
                  onChange={(event) => update("relationship", event.target.value)}
                  required
                >
                  <option value="child">Child</option>
                  <option value="spouse">Spouse</option>
                  <option value="parent">Parent</option>
                  <option value="relative">Relative</option>
                  <option value="household">Household</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="finance-field">
                <span>Gender</span>
                <select
                  value={form.gender}
                  onChange={(event) => update("gender", event.target.value)}
                >
                  <option value="">Select Gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>

              <label className="finance-field">
                <span>Date Of Birth</span>
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(event) => update("date_of_birth", event.target.value)}
                />
              </label>

              <label className="finance-field">
                <span>School / Grade</span>
                <input
                  value={form.school_grade}
                  onChange={(event) => update("school_grade", event.target.value)}
                  placeholder="Example: Grade 4"
                />
              </label>

              <label className="finance-field">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                />
              </label>

              <label className="finance-field">
                <span>Phone</span>
                <input
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                />
              </label>

              <label className="finance-field finance-field-full">
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="finance-modal-footer">
            <button
              type="button"
              className="finance-btn finance-btn-light"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button type="submit" className="finance-btn finance-btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <RefreshCcw size={16} className="finance-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Add Dependent
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditMemberModal({
  open,
  member,
  onClose,
  onSave,
  saving,
}) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    gender: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    household_type: "",
  });

  useEffect(() => {
    if (!open || !member) return;

    setForm({
      first_name: firstValue(
        member,
        ["first_name"],
        ""
      ),

      last_name: firstValue(
        member,
        ["last_name"],
        ""
      ),

      email: firstValue(
        member,
        ["email", "primary_email"],
        ""
      ),

      phone: firstValue(
        member,
        ["phone", "primary_phone"],
        ""
      ),

      gender: firstValue(
        member,
        ["gender"],
        ""
      ),

      address: firstValue(
  member,
  [
    "address_line1",
    "address_line_1",
    "address",
    "street_address"
  ],
  ""
),

      city: firstValue(
        member,
        ["city"],
        ""
      ),

      state: firstValue(
        member,
        ["state"],
        ""
      ),

      zip: firstValue(
        member,
        ["zip", "postal_code"],
        ""
      ),

     household_type: firstValue(
  member,
  [
    "household_type",
    "household_role"
  ],
  ""
),
    });
  }, [open, member]);

  if (!open) return null;

  function update(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function submit(event) {
    event.preventDefault();

    onSave({
      ...form,
      full_name: `${clean(
        form.first_name
      )} ${clean(form.last_name)}`.trim(),
    });
  }

  return (
    <div
      className="finance-modal-backdrop"
      role="presentation"
    >
      <div
        className="finance-modal"
        role="dialog"
        aria-modal="true"
      >
        <form onSubmit={submit}>
          <div className="finance-modal-header">
            <div className="finance-modal-title-row">
              <span className="finance-modal-icon">
                <UserRound size={20} />
              </span>

              <div>
                <h2>Edit Member</h2>
                <p>
                  Update member profile
                  information.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="finance-icon-button"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>

          <div className="finance-modal-body">
            <div className="finance-form-grid">

              <label className="finance-field">
                <span>First Name *</span>
                <input
                  value={form.first_name}
                  onChange={(e) =>
                    update(
                      "first_name",
                      e.target.value
                    )
                  }
                  required
                />
              </label>

              <label className="finance-field">
                <span>Last Name *</span>
                <input
                  value={form.last_name}
                  onChange={(e) =>
                    update(
                      "last_name",
                      e.target.value
                    )
                  }
                  required
                />
              </label>

              <label className="finance-field">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    update(
                      "email",
                      e.target.value
                    )
                  }
                />
              </label>

              <label className="finance-field">
                <span>Phone</span>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    update(
                      "phone",
                      e.target.value
                    )
                  }
                />
              </label>

              <label className="finance-field">
                <span>Gender</span>
                <select
                  value={form.gender}
                  onChange={(e) =>
                    update(
                      "gender",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select Gender
                  </option>
                  <option value="male">
                    Male
                  </option>
                  <option value="female">
                    Female
                  </option>
                </select>
              </label>

              <label className="finance-field">
                <span>
                  Household Type
                </span>
                <select
                  value={form.household_type}
                  onChange={(e) =>
                    update(
                      "household_type",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select
                  </option>
                  <option value="single">
                    Single
                  </option>
                  <option value="family">
                    Family
                  </option>
                  <option value="couple">
                    Couple
                  </option>
                </select>
              </label>

              <label className="finance-field finance-field-full">
                <span>Address</span>
                <input
                  value={form.address}
                  onChange={(e) =>
                    update(
                      "address",
                      e.target.value
                    )
                  }
                />
              </label>

              <label className="finance-field">
                <span>City</span>
                <input
                  value={form.city}
                  onChange={(e) =>
                    update(
                      "city",
                      e.target.value
                    )
                  }
                />
              </label>

              <label className="finance-field">
                <span>State</span>
                <input
                  value={form.state}
                  onChange={(e) =>
                    update(
                      "state",
                      e.target.value
                    )
                  }
                />
              </label>

              <label className="finance-field">
                <span>ZIP</span>
                <input
                  value={form.zip}
                  onChange={(e) =>
                    update(
                      "zip",
                      e.target.value
                    )
                  }
                />
              </label>

            </div>
          </div>

          <div className="finance-modal-footer">
            <button
              type="button"
              className="finance-btn finance-btn-light"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="finance-btn finance-btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCcw
                    size={16}
                    className="finance-spin"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



export default function FinanceMemberProfile() {
  const { id, tab } = useParams();
  const navigate = useNavigate();

  const activeTab = TABS.some((item) => item.key === tab) ? tab : "overview";

  const [member, setMember] = useState(null);
  const [dependents, setDependents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [pledges, setPledges] = useState([]);
 
  const [coverage, setCoverage] = useState(null);
const currentYear = new Date().getFullYear();

const [coverageYear, setCoverageYear] =
  useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [dependentModalOpen, setDependentModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");

const loadProfile = useCallback(async () => {
  if (!id) return;

  setLoading(true);
  setError("");

  try {
    const memberData = await getFirst([
      `/finance/members/${id}`,
      `/finance/members/${id}/profile`,
      `/members/${id}`,
    ]);

    const nextMember = normalizeMember(memberData);

    setMember(nextMember);

    const [
      dependentData,
      paymentData,
      invoiceData,
      receiptData,
      pledgeData,
      coverageData,
    ] = await Promise.all([
      getFirst(
        [
          `/finance/members/${id}/dependents`,
          `/finance/member-dependents?member_id=${id}`,
          `/finance/dependents?member_id=${id}`,
        ],
        { rows: [] }
      ).catch(() => ({ rows: [] })),

      getFirst(
        [
          `/finance/payments?member_id=${id}&limit=50`,
          `/finance/members/${id}/payments`,
        ],
        { rows: [] }
      ).catch(() => ({ rows: [] })),

      getFirst(
        [
          `/finance/invoices?member_id=${id}&limit=50`,
          `/invoices?member_id=${id}&limit=50`,
          `/finance/members/${id}/invoices`,
        ],
        { rows: [] }
      ).catch(() => ({ rows: [] })),

      getFirst(
        [
          `/finance/receipts?member_id=${id}&limit=50`,
          `/receipts?member_id=${id}&limit=50`,
          `/finance/members/${id}/receipts`,
        ],
        { rows: [] }
      ).catch(() => ({ rows: [] })),

      getFirst(
        [
          `/finance/pledges?member_id=${id}&limit=50`,
          `/finance/members/${id}/pledges`,
        ],
        { rows: [] }
      ).catch(() => ({ rows: [] })),

      
      getFirst(
        [
          // `/finance/members/${id}/coverage?year=${new Date().getFullYear()}`
          `/finance/members/${id}/coverage?year=${coverageYear}`
        ],
        { coverage: null, rows: [] }
      ).catch(() => ({
        coverage: null,
        rows: [],
      })),
    ]);

    console.log(
      "Coverage API Response:",
      coverageData
    );

    const coverageRow =
      coverageData?.coverage ||
      coverageData?.rows?.[0] ||
      null;

    console.log(
      "Coverage Selected:",
      coverageRow
    );

    setCoverage(coverageRow);

    setDependents(
      normalizeRows(
        dependentData,
        ["dependents"]
      )
    );

    setPayments(
      normalizeRows(
        paymentData,
        ["payments"]
      )
    );

    setInvoices(
      normalizeRows(
        invoiceData,
        ["invoices"]
      )
    );

    setReceipts(
      normalizeRows(
        receiptData,
        ["receipts"]
      )
    );

    setPledges(
      normalizeRows(
        pledgeData,
        ["pledges"]
      )
    );

  

  } catch (err) {
    setError(
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      "Failed to load member profile."
    );
  } finally {
    setLoading(false);
  }
}, [id, coverageYear]);



  useEffect(() => {
    loadProfile();
  }, [loadProfile,  coverageYear]);

  const summary = useMemo(() => {
    const totalPaid = payments.reduce((sum, row) => sum + numberValue(row.amount), 0);
    const invoiceBalance = invoices.reduce(
      (sum, row) =>
        sum +
        numberValue(
          firstValue(row, ["balance_due", "remaining_amount", "outstanding_amount"], 0)
        ),
      0
    );

    const pledgeRemaining = pledges.reduce(
      (sum, row) =>
        sum +
        numberValue(
          firstValue(row, ["remaining_amount", "remaining_balance", "balance_due"], 0)
        ),
      0
    );

    return {
      totalPaid,
      invoiceBalance,
      pledgeRemaining,
      dependents: dependents.length,
    };
  }, [payments, invoices, pledges, dependents]);

  const coveredMonths = useMemo(
    () => coverageMonthsFrom(member || {}, coverage || {}),
    [member, coverage]
  );



  async function handleAddDependent(payload) {
    setActionLoading("dependent");
    setError("");
    setSuccessText("");

    try {
      await postFirst(
        [
          `/finance/members/${id}/dependents`,
          "/finance/member-dependents",
          "/finance/dependents",
        ],
        {
          ...payload,
          member_id: id,
        }
      );

      setSuccessText("Dependent added successfully.");
      setDependentModalOpen(false);
      await loadProfile();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to add dependent."
      );
    } finally {
      setActionLoading("");
    }
  }
async function handleUpdateMember(
  payload
) {
  try {
    setActionLoading("update-member");

    await patchFirst(
      [
        `/finance/members/${id}`,
        `/members/${id}`,
      ],
      payload
    );

    setSuccessText(
      "Member updated successfully."
    );

    setEditModalOpen(false);

    await loadProfile();
  } catch (err) {
    setError(
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      "Failed to update member."
    );
  } finally {
    setActionLoading("");
  }
}
  async function handleDeactivateDependent(dependent) {
    const dependentId = dependent?.id || dependent?.dependent_id;

    if (!dependentId) return;

    setActionLoading(`dependent-${dependentId}`);
    setError("");
    setSuccessText("");

    try {
      await patchFirst(
        [
          `/finance/members/${id}/dependents/${dependentId}/deactivate`,
          `/finance/member-dependents/${dependentId}`,
          `/finance/dependents/${dependentId}`,
        ],
        {
          status: "inactive",
          is_active: 0,
        }
      );

      setSuccessText("Dependent status updated.");
      await loadProfile();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update dependent."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function handleSendWelcomeEmail() {
    setActionLoading("welcome");
    setError("");
    setSuccessText("");

    try {
      await postFirst(
        [
          `/finance/members/${id}/welcome-email`,
          `/finance/registration/${id}/welcome-email`,
          `/members/${id}/welcome-email`,
        ],
        {
          member_id: id,
          send_welcome_email: true,
        }
      );

      setSuccessText("Welcome email sent.");
      await loadProfile();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to send welcome email."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function openInvoicePdf(row) {
    const invoiceId = row.id || row.invoice_id;
    const invoiceNumber = row.invoice_number;

    await openFirstDocument(
      [
        `/finance/invoices/${invoiceId}/pdf`,
        `/invoices/${invoiceId}/pdf`,
        invoiceNumber ? `/finance/invoices/${invoiceNumber}/pdf` : null,
      ].filter(Boolean),
      `${invoiceNumber || "invoice"}.pdf`
    );
  }

  async function openReceiptPdf(row) {
    const receiptId = row.id || row.receipt_id;
    const receiptNumber = row.receipt_number;

    await openFirstDocument(
      [
        `/finance/receipts/${receiptId}/pdf`,
        `/receipts/${receiptId}/pdf`,
        receiptNumber ? `/finance/receipts/${receiptNumber}/pdf` : null,
      ].filter(Boolean),
      `${receiptNumber || "receipt"}.pdf`
    );
  }

  if (loading) {
    return (
      <div className="finance-page">
        <div className="finance-loading-panel">
          <RefreshCcw size={18} className="finance-spin" />
          Loading member profile...
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="finance-page">
        <div className="finance-alert finance-alert-danger">
          <AlertTriangle size={17} />
          <span>Member profile was not found.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="finance-page finance-member-profile-page">
      <div className="finance-page-header">
        <div>
          <Link to="/dash/finance/members" className="finance-back-link">
            <ArrowLeft size={16} />
            Members
          </Link>

          <p className="finance-eyebrow">Finance Member Profile</p>
          <h1>{memberFullName(member)}</h1>

          <p className="finance-page-subtitle">
            {memberNumber(member)} · {memberEmail(member) || "--"} ·{" "}
            {memberPhone(member) || "--"}
          </p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={loadProfile}
          >
            <RefreshCcw size={16} />
            Refresh
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={handleSendWelcomeEmail}
            disabled={actionLoading === "welcome"}
          >
            <Mail size={16} />
            Welcome Email
          </button>
<button
  type="button"
  className="finance-btn finance-btn-primary"
  onClick={() => setEditModalOpen(true)}
>
  Edit Member
</button>
          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={() => setDependentModalOpen(true)}
          >
            <Plus size={16} />
            Add Dependent
          </button>
        </div>
      </div>

      {error ? (
        <div className="finance-alert finance-alert-danger">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      {successText ? (
        <div className="finance-alert finance-alert-success">
          <CheckCircle2 size={17} />
          <span>{successText}</span>
        </div>
      ) : null}

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <span>Membership</span>
          <strong>{pretty(firstValue(member, ["membership_status", "status"], "--"))}</strong>
          <small>Account: {pretty(firstValue(member, ["account_status"], "--"))}</small>
        </div>

        <div className="finance-summary-card">
          <span>Total Paid</span>
          <strong>{money(summary.totalPaid)}</strong>
          <small>{payments.length} payment records</small>
        </div>

        <div className="finance-summary-card">
          <span>Invoice Balance</span>
          <strong>{money(summary.invoiceBalance)}</strong>
          <small>{invoices.length} invoices</small>
        </div>

        <div className="finance-summary-card">
          <span>Pledge Balance</span>
          <strong>{money(summary.pledgeRemaining)}</strong>
          <small>{pledges.length} pledges</small>
        </div>

        <div className="finance-summary-card">
          <span>Dependents</span>
          <strong>{summary.dependents}</strong>
          <small>Household records</small>
        </div>
      </div>

      <div className="finance-profile-actions">
        <button
          type="button"
          className="finance-action-tile"
          onClick={() =>
            navigate(`/dash/finance/payments?member_id=${encodeURIComponent(id)}`)
          }
        >
          <CreditCard size={18} />
          <span>Collect Payment</span>
        </button>

        <button
          type="button"
          className="finance-action-tile"
          onClick={() =>
            navigate(`/dash/finance/invoice-generator?member_id=${encodeURIComponent(id)}`)
          }
        >
          <FileText size={18} />
          <span>Create Invoice</span>
        </button>

        <button
          type="button"
          className="finance-action-tile"
          onClick={() =>
            navigate(`/dash/finance/pledges?member_id=${encodeURIComponent(id)}`)
          }
        >
          <Target size={18} />
          <span>Create Pledge</span>
        </button>

        <button
          type="button"
          className="finance-action-tile"
          onClick={() =>
            navigate(`/dash/finance/reports?member_id=${encodeURIComponent(id)}`)
          }
        >
          <Download size={18} />
          <span>Statement</span>
        </button>
      </div>

      <div className="finance-tabbar">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = item.key === activeTab;

          return (
            <button
              key={item.key}
              type="button"
              className={`finance-tab ${active ? "active" : ""}`}
              onClick={() => navigate(`/dash/finance/members/${id}/${item.key}`)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>



      {activeTab === "overview" ? (
        <div className="finance-grid finance-grid-2">
          <section className="finance-panel">
            <div className="finance-section-head">
              <UserRound size={17} />
              <h2>Member Information</h2>
            </div>

            <div className="finance-detail-grid">
              <div>
                <span>Member ID</span>
               <strong className="finance-member-id">{memberNumber(member)}</strong>
              </div>

              <div>
                <span>Full Name</span>
                <strong>{memberFullName(member)}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{memberEmail(member) || "--"}</strong>
              </div>

              <div>
                <span>Phone</span>
                <strong>{memberPhone(member) || "--"}</strong>
              </div>

              <div>
                <span>Gender</span>
                <strong>{pretty(firstValue(member, ["gender"], "--"))}</strong>
              </div>

              <div>
                <span>Household Type</span>
                <strong>{pretty(firstValue(member,[ "household_type", "household_role"], "--" ))}</strong>
              </div>

              <div>
                <span>Start Date</span>
                <strong>
                  {formatDate(firstValue(member, ["membership_start_date", "start_date", "created_at"], ""))}
                </strong>
              </div>

              <div>
                <span>End Date</span>
                <strong>
                  {formatDate(firstValue(member, ["membership_end_date", "end_date"], ""))}
                </strong>
              </div>
            </div>
          </section>

          <section className="finance-panel">
            <div className="finance-section-head">
              <ShieldCheck size={17} />
              <h2>Account Access</h2>
            </div>

            <div className="finance-detail-grid">
              <div>
                <span>Username</span>
                <strong>{firstValue(member, ["username"], "--")}</strong>
              </div>

              <div>
                <span>User ID</span>
                <strong>{firstValue(member, ["user_id"], "--")}</strong>
              </div>

              <div>
                <span>Account Status</span>
                <StatusBadge value={firstValue(member, ["account_status"], "--")} />
              </div>

              <div>
                <span>Password Reset</span>
                <strong>
                  {Number(firstValue(member, ["must_change_password", "password_reset_required"], 0))
                    ? "Required"
                    : "Not Required"}
                </strong>
              </div>

              <div>
                <span>Welcome Email</span>
                <StatusBadge
                  value={firstValue(member, ["welcome_email_status"], "not_sent")}
                />
              </div>

              <div>
                <span>Registered</span>
                <strong>{formatDateTime(firstValue(member, ["created_at"], ""))}</strong>
              </div>
            </div>
          </section>

          <section className="finance-panel finance-panel-full">
            <div className="finance-section-head">
              <HeartHandshake size={17} />
              <h2>Address</h2>
            </div>

            <div className="finance-detail-grid">
              <div>
                <span>Address</span>
             <strong>{firstValue(member,[ "address_line1","address_line_1", "address", "street_address"], "--")}</strong>
              </div>

              <div>
                <span>City</span>
                <strong>{firstValue(member, ["city"], "--")}</strong>
              </div>

              <div>
                <span>State</span>
                <strong>{firstValue(member, ["state"], "--")}</strong>
              </div>

              <div>
                <span>ZIP</span>
                <strong>{firstValue(member, ["zip", "postal_code"], "--")}</strong>
              </div>
            </div>
          </section>
        </div>

      ) : null}

{activeTab === "coverage" && (

<section className="finance-panel">

  <div className="finance-section-head finance-section-head-between">

    <div className="finance-section-title">
      <CalendarDays size={18} />
      <h2>Membership Coverage</h2>
    </div>

    <div className="finance-year-selector">
      <label htmlFor="coverageYear">
        Year
      </label>

      <select
        id="coverageYear"
        value={coverageYear}
        onChange={(e) =>
          setCoverageYear(Number(e.target.value))
        }
      >
        {[2024,2025,2026,2027,2028,2029,2030].map((year) => (
          <option
            key={year}
            value={year}
          >
            {year}
          </option>
        ))}
      </select>
    </div>

  </div>

  <div className="finance-coverage-cards">

    <div className="finance-coverage-card">
      <span>Membership Plan</span>
      <strong>
        {firstValue(
          coverage,
          ["plan_name"],
          "Annual Membership"
        )}
      </strong>
    </div>

    <div className="finance-coverage-card">
      <span>Coverage Period</span>
      <strong>
        {firstValue(
          coverage,
          ["coverage_label"],
          "--"
        )}
      </strong>
    </div>

    <div className="finance-coverage-card">
      <span>Months Paid</span>
      <strong>
        {firstValue(
          coverage,
          ["months_paid"],
          0
        )}
      </strong>
    </div>

    <div className="finance-coverage-card">
      <span>Total Paid</span>
      <strong>
        {money(
          firstValue(
            coverage,
            ["amount"],
            0
          )
        )}
      </strong>
    </div>

    <div className="finance-coverage-card">
      <span>Paid Through</span>
      <strong>
        {firstValue(
          coverage,
          ["paid_through"],
          "--"
        )}
      </strong>
    </div>

    <div className="finance-coverage-card">
      <span>Next Renewal</span>
      <strong>
        {formatDate(
          firstValue(
            coverage,
            ["next_due_at"],
            ""
          )
        )}
      </strong>
    </div>

    <div className="finance-coverage-card">
      <span>Renewal Status</span>

      <div
        className={`finance-renewal-badge ${
          String(
            firstValue(
              coverage,
              ["renewal_status"],
              "current"
            )
          ).toLowerCase()
        }`}
      >
        {String(
          firstValue(
            coverage,
            ["renewal_status"],
            "Current"
          )
        ).toUpperCase()}
      </div>
    </div>

  </div>

  <div className="finance-coverage-progress">

    <div className="finance-progress-header">

      <span>
        Coverage Progress
      </span>

      <strong>
        {coveredMonths.length} / 12 Months Covered
      </strong>

    </div>

    <div className="finance-progress-bar">
      <div
        className="finance-progress-fill"
        style={{
          width: `${Math.round(
            (coveredMonths.length / 12) * 100
          )}%`
        }}
      />
    </div>

  </div>

  <div className="finance-month-grid">

    {MONTHS.map((month) => {

      const covered =
        coveredMonths.includes(
          month.value
        );

      return (

        <div
          key={month.value}
          className={`finance-month-card ${
            covered
              ? "covered"
              : "open"
          }`}
        >

          <div className="month-name">
            {month.label}
          </div>

          <div className="month-status">

            {covered ? (
              <>
                <CheckCircle2 size={15} />
                Paid
              </>
            ) : (
              <>
                <X size={15} />
                Open
              </>
            )}

          </div>

        </div>

      );

    })}

  </div>

</section>

)}


      {activeTab === "dependents" ? (
        <section className="finance-panel">
          <div className="finance-section-head finance-section-head-between">
            <div>
              <Users size={17} />
              <h2>Dependents</h2>
            </div>

            <button
              type="button"
              className="finance-btn finance-btn-primary"
              onClick={() => setDependentModalOpen(true)}
            >
              <Plus size={16} />
              Add Dependent
            </button>
          </div>

          <DataTable
            rows={dependents}
            empty="No dependents have been added."
            columns={[
              {
                key: "full_name",
                label: "Name",
                render: (_value, row) =>
                  firstValue(
                    row,
                    ["full_name", "name"],
                    `${firstValue(row, ["first_name"], "")} ${firstValue(row, ["last_name"], "")}`.trim()
                  ),
              },
              {
                key: "relationship",
                label: "Relationship",
                render: (value) => pretty(value),
              },
              {
                key: "gender",
                label: "Gender",
                render: (value) => pretty(value),
              },
              {
                key: "date_of_birth",
                label: "DOB",
                render: (value) => formatDate(value),
              },
              {
                key: "school_grade",
                label: "School / Grade",
                render: (value, row) => value || row.grade || "--",
              },
              {
                key: "status",
                label: "Status",
                render: (value, row) => (
                  <StatusBadge value={value || (Number(row.is_active) === 1 ? "active" : "inactive")} />
                ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (_value, row) => (
                  <button
                    type="button"
                    className="finance-mini-button"
                    onClick={() => handleDeactivateDependent(row)}
                    disabled={actionLoading === `dependent-${row.id || row.dependent_id}`}
                  >
                    Deactivate
                  </button>
                ),
              },
            ]}
          />
        </section>
      ) : null}

      {activeTab === "payments" ? (
        <section className="finance-panel">
          <div className="finance-section-head">
            <CreditCard size={17} />
            <h2>Payments</h2>
          </div>

          <DataTable
            rows={payments}
            empty="No payments found for this member."
            columns={[
              { key: "payment_number", label: "Payment #" },
              {
                key: "category",
                label: "Category",
                render: (value, row) => pretty(value || row.payment_type),
              },
              {
                key: "method",
                label: "Method",
                render: (value, row) => pretty(value || row.payment_method),
              },
              {
                key: "amount",
                label: "Amount",
                render: (value) => money(value),
              },
              {
                key: "status",
                label: "Status",
                render: (value, row) => <StatusBadge value={value || row.payment_status} />,
              },
              {
                key: "created_at",
                label: "Date",
                render: (value, row) => formatDate(value || row.paid_at),
              },
              { key: "receipt_number", label: "Receipt #" },
            ]}
          />
        </section>
      ) : null}

      {activeTab === "invoices" ? (
        <section className="finance-panel">
          <div className="finance-section-head">
            <FileText size={17} />
            <h2>Invoices</h2>
          </div>

          <DataTable
            rows={invoices}
            empty="No invoices found for this member."
            columns={[
              { key: "invoice_number", label: "Invoice #" },
              {
                key: "category",
                label: "Category",
                render: (value, row) => pretty(value || row.invoice_type),
              },
              {
                key: "total_amount",
                label: "Amount",
                render: (value, row) => money(value ?? row.amount),
              },
              {
                key: "paid_amount",
                label: "Paid",
                render: (value) => money(value),
              },
              {
                key: "balance_due",
                label: "Balance",
                render: (value) => money(value),
              },
              {
                key: "status",
                label: "Status",
                render: (value, row) => <StatusBadge value={value || row.invoice_status} />,
              },
              {
                key: "created_at",
                label: "Date",
                render: (value, row) => formatDate(value || row.invoice_date),
              },
              {
                key: "actions",
                label: "Actions",
                render: (_value, row) => (
                  <button
                    type="button"
                    className="finance-mini-button"
                    onClick={() => openInvoicePdf(row)}
                  >
                    PDF
                  </button>
                ),
              },
            ]}
          />
        </section>
      ) : null}

      {activeTab === "receipts" ? (
        <section className="finance-panel">
          <div className="finance-section-head">
            <Receipt size={17} />
            <h2>Receipts</h2>
          </div>

          <DataTable
            rows={receipts}
            empty="No receipts found for this member."
            columns={[
              { key: "receipt_number", label: "Receipt #" },
              { key: "payment_number", label: "Payment #" },
              { key: "invoice_number", label: "Invoice #" },
              {
                key: "amount",
                label: "Amount",
                render: (value) => money(value),
              },
              {
                key: "method",
                label: "Method",
                render: (value, row) => pretty(value || row.payment_method),
              },
              {
                key: "status",
                label: "Status",
                render: (value) => <StatusBadge value={value} />,
              },
              {
                key: "created_at",
                label: "Date",
                render: (value, row) => formatDate(value || row.issued_at),
              },
              {
                key: "actions",
                label: "Actions",
                render: (_value, row) => (
                  <button
                    type="button"
                    className="finance-mini-button"
                    onClick={() => openReceiptPdf(row)}
                  >
                    PDF
                  </button>
                ),
              },
            ]}
          />
        </section>
      ) : null}

      {activeTab === "pledges" ? (
        <section className="finance-panel">
          <div className="finance-section-head">
            <Target size={17} />
            <h2>Pledges</h2>
          </div>

          <DataTable
            rows={pledges}
            empty="No pledges found for this member."
            columns={[
              { key: "pledge_number", label: "Pledge #" },
              {
                key: "campaign_name",
                label: "Campaign",
                render: (value, row) => value || row.campaign || "--",
              },
              {
                key: "pledged_amount",
                label: "Pledged",
                render: (value, row) => money(value ?? row.amount),
              },
              {
                key: "paid_amount",
                label: "Paid",
                render: (value) => money(value),
              },
              {
                key: "remaining_amount",
                label: "Remaining",
                render: (value, row) =>
                  money(
                    value ??
                      row.remaining_balance ??
                      Math.max(numberValue(row.pledged_amount) - numberValue(row.paid_amount), 0)
                  ),
              },
              {
                key: "due_date",
                label: "Due",
                render: (value) => formatDate(value),
              },
              {
                key: "status",
                label: "Status",
                render: (value) => <StatusBadge value={value} />,
              },
            ]}
          />
        </section>
      ) : null}

      
      <DependentModal
        open={dependentModalOpen}
        onClose={() => setDependentModalOpen(false)}
        onSave={handleAddDependent}
        saving={actionLoading === "dependent"}
      />
      <EditMemberModal
  open={editModalOpen}
  member={member}
  onClose={() => setEditModalOpen(false)}
  onSave={handleUpdateMember}
  saving={actionLoading === "update-member"}
/>
    </div>
  );
}