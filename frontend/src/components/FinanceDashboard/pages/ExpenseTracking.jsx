// frontend/src/components/FinanceDashboard/pages/ExpenseTracking.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Edit3,
  Plus,
  RefreshCcw,
  Search,
  UserRound,
  X,
} from "lucide-react";

// import "../../../styles/shared-payment-components.css";
// import "../../../styles/finance-dashboard.css";
import "../../../styles/finance-enterprise.css";
import FinanceActionMenu from "../components/FinanceActionMenu"
const DEFAULT_CATEGORIES = [
  { value: "utilities", label: "Utilities" },
  { value: "maintenance", label: "Maintenance" },
  { value: "supplies", label: "Supplies" },
  { value: "charity", label: "Charity" },
  { value: "clergy", label: "Clergy Support" },
  { value: "program", label: "Program Expense" },
  { value: "reimbursement", label: "Individual Reimbursement" },
  { value: "vendor", label: "Vendor Payment" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM = {
  expense_type: "vendor",
  category: "other",
  category_label: "Other",
  vendor_name: "",
  vendor_email: "",
  vendor_phone: "",
  invoice_no: "",
  payee_first_name: "",
  payee_last_name: "",
  payee_email: "",
  payee_phone: "",
  payee_address: "",
  payee_city: "",
  payee_state: "",
  payee_zip: "",
  description: "",
  amount: "",
  payment_method: "",
  reference_no: "",
  expense_date: new Date().toISOString().slice(0, 10),
  due_date: "",
  status: "pending",
  approval_status: "pending",
  notes: "",
};

function money(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
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

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeRows(data) {
  return data.rows || data.expenses || data.reimbursements || data.data || [];
}

function normalizeCategories(data) {
  const rows = data.categories || data.rows || data.data || [];

  if (!Array.isArray(rows) || !rows.length) {
    return DEFAULT_CATEGORIES;
  }

  return rows.map((row) => ({
    value: row.value || row.category_key || row.key || row.category || row.id,
    label: row.label || row.name || row.category_label || row.category || "Category",
  }));
}

async function fetchJson(path, options = {}) {
  const token = readAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers,
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch (_err) {
    data = { raw: text };
  }

  if (response.status === 401) {
    throw new Error("Your finance session expired. Please sign in again.");
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || data.message || "Request failed.");
  }

  return data;
}

function readAuthToken() {
  const tokenKeys = [
    "ht_token",
    "access_token",
    "accessToken",
    "auth_token",
    "authToken",
    "token",
    "jwt",
    "jwtToken",
    "id_token",
    "holy_token",
    "holy_access_token",
  ];

  const objectKeys = [
    "ht_auth",
    "auth",
    "holy_auth",
    "ht_user",
    "user",
    "authUser",
    "currentUser",
  ];

  const stores = [window.localStorage, window.sessionStorage].filter(Boolean);

  for (const store of stores) {
    for (const key of tokenKeys) {
      const value = store.getItem(key);
      if (value && !["undefined", "null"].includes(value)) {
        return String(value).replace(/^Bearer\s+/i, "");
      }
    }

    for (const key of objectKeys) {
      const raw = store.getItem(key);
      if (!raw) continue;

      try {
        const value = JSON.parse(raw);
        const token =
          value?.accessToken ||
          value?.access_token ||
          value?.token ||
          value?.jwt ||
          value?.auth?.token;

        if (token) {
          return String(token).replace(/^Bearer\s+/i, "");
        }
      } catch (_err) {}
    }
  }

  return "";
}

function statusBadge(status) {
  const value = String(status || "").toLowerCase();

  if (["paid", "approved", "completed"].includes(value)) {
    return "success";
  }

  if (["rejected", "void", "cancelled", "failed"].includes(value)) {
    return "danger";
  }

  if (["pending", "review", "submitted"].includes(value)) {
    return "warning";
  }

  return "neutral";
}

function Field({ label, children }) {
  return (
    <label className="finance-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function ExpenseTracking() {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    category: "",
    payment_method: "",
    from: "",
    to: "",
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const summary = useMemo(() => {
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const pending = rows
      .filter((row) => String(row.status || row.approval_status).toLowerCase() === "pending")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const approved = rows
      .filter((row) => ["approved", "paid"].includes(String(row.status || row.approval_status).toLowerCase()))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const paid = rows
      .filter((row) => String(row.status).toLowerCase() === "paid")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return [
      { label: "Records", value: rows.length, note: "Visible expenses" },
      { label: "Total Expenses", value: money(total), note: "Current query total" },
      { label: "Pending", value: money(pending), note: "Needs review" },
      { label: "Approved", value: money(approved), note: "Ready to pay" },
      { label: "Paid", value: money(paid), note: "Completed expenses" },
    ];
  }, [rows]);

  function updateFilter(key, value) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateForm(key, value) {
    setForm((prev) => {
      const next = {
        ...prev,
        [key]: value,
      };

      if (key === "category") {
        const selected = categories.find((item) => String(item.value) === String(value));
        next.category_label = selected?.label || value;
      }

      if (key === "expense_type" && value === "reimbursement") {
        next.category = "reimbursement";
        next.category_label = "Individual Reimbursement";
      }

      if (key === "expense_type" && value === "vendor" && next.category === "reimbursement") {
        next.category = "vendor";
        next.category_label = "Vendor Payment";
      }

      return next;
    });
  }

  async function loadCategories() {
    try {
      const data = await fetchJson("/api/finance/expenses/categories");
      setCategories(normalizeCategories(data));
    } catch (_err) {
      setCategories(DEFAULT_CATEGORIES);
    }
  }

  async function loadRows() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== "") params.set(key, value);
      });
      if (filters.search) params.set("q", filters.search);
      params.set("page", "1");
      params.set("limit", "100");
      params.set("pageSize", "100");

      const data = await fetchJson(`/api/finance/expenses?${params.toString()}`);
      setRows(normalizeRows(data));
    } catch (err) {
      setRows([]);
      setError(err.message || "Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCategory() {
    const label = newCategory.trim();
    if (!label) return;

    try {
      const data = await fetchJson("/api/finance/expenses/categories", {
        method: "POST",
        body: JSON.stringify({ label }),
      });
      const category = data.category || {
        value: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        label,
      };
      setCategories((prev) => [...prev, category]);
      setNewCategory("");
      setShowCategoryModal(false);
      setMessage("Expense category created.");
    } catch (err) {
      setError(err.message || "Unable to create category.");
    }
  }

  function validateForm() {
    if (Number(form.amount || 0) <= 0) return "Expense amount must be greater than zero.";
    if (!form.category) return "Expense category is required.";
    if (form.expense_type === "vendor" && !form.vendor_name.trim()) {
      return "Vendor name is required for vendor expenses.";
    }
    if (
      form.expense_type === "reimbursement" &&
      !`${form.payee_first_name} ${form.payee_last_name}`.trim()
    ) {
      return "Reimbursement requires the individual's first and last name.";
    }
    if (form.expense_type === "reimbursement" && !form.payee_email.trim() && !form.payee_phone.trim()) {
      return "Reimbursement requires an email or phone number.";
    }
    return "";
  }

  async function submitExpense(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const endpoint =
        form.expense_type === "reimbursement"
          ? "/api/finance/reimbursements"
          : "/api/finance/expenses";

      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify(form),
      });

      setShowModal(false);
      setForm(EMPTY_FORM);
      setMessage("Expense record created successfully.");
      await loadRows();
    } catch (err) {
      setError(err.message || "Unable to create expense.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(row, status) {
    try {
      await fetchJson(`/api/finance/expenses/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          approval_status: status,
        }),
      });
      setMessage(`Expense marked ${pretty(status)}.`);
      await loadRows();
    } catch (err) {
      setError(err.message || "Unable to update expense.");
    }
  }

  useEffect(() => {
    loadCategories();
    loadRows();
  }, []);

  return (
    <div className="finance-enterprise-page">
      <section className="finance-page-hero">
        <div>
          <p className="finance-eyebrow">Finance Operations</p>
          <h1>Expenses</h1>
          <p>
            Track vendor payments, reimbursements, categories, approvals,
            references, and ledger-ready outgoing finance activity.
          </p>
        </div>
        <div className="finance-page-actions">
          <button className="finance-btn finance-btn-secondary" onClick={loadRows} disabled={loading}>
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button className="finance-btn finance-btn-secondary" onClick={() => setShowCategoryModal(true)}>
            <Plus size={16} />
            Category
          </button>
          <button className="finance-btn finance-btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            New Expense
          </button>
        </div>
      </section>

      {error ? <div className="finance-alert finance-alert-danger">{error}</div> : null}
      {message ? <div className="finance-alert finance-alert-success">{message}</div> : null}

      <section className="finance-summary-grid">
        {summary.map((item) => (
          <article className="finance-summary-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </article>
        ))}
      </section>

      <section className="finance-toolbar-card">
        <div className="finance-search-field">
          <Search size={15} />
          <input
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            placeholder="Search vendor, person, category, reference, or invoice..."
          />
        </div>
        <select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={filters.category} onChange={(e) => updateFilter("category", e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
        <select value={filters.payment_method} onChange={(e) => updateFilter("payment_method", e.target.value)}>
          <option value="">All Methods</option>
          <option value="cash">Cash</option>
          <option value="check">Check</option>
          <option value="zelle">Zelle</option>
          <option value="ach">ACH</option>
          <option value="card">Card</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} />
        <input type="date" value={filters.to} onChange={(e) => updateFilter("to", e.target.value)} />
      
      </section>

      <section className="finance-table-card">
        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Vendor / Person</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan="10" className="finance-empty-row">
                    {loading ? "Loading expenses..." : "No expenses found."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const status = row.status || row.approval_status || "pending";

               return (
  <tr key={row.id || row.expense_number}>
    <td>{formatDate(row.expense_date || row.created_at)}</td>

    <td>{pretty(row.expense_type || row.type || "expense")}</td>

    <td>
      <strong>{row.vendor_name || row.payee_full_name || row.payee_name || "--"}</strong>
      <small>{row.vendor_email || row.payee_email || ""}</small>
    </td>

    <td>{row.category_label || pretty(row.category)}</td>
    <td>{row.description || row.notes || "--"}</td>
    <td>{money(row.amount)}</td>
    <td>{pretty(row.payment_method || row.method)}</td>
    <td>{row.reference_no || row.invoice_no || "--"}</td>

    <td>
      <span className={`finance-badge finance-badge-${statusBadge(status)}`}>
        {pretty(status)}
      </span>
    </td>

    <td className="finance-action-cell">
      <FinanceActionMenu
        row={row}
        actions={[
          {
            key: "approve",
            label: "Approve",
            icon: CheckCircle2,
            onClick: () => updateStatus(row, "approved"),
            visible: status !== "approved" && status !== "paid",
          },
          {
            key: "markPaid",
            label: "Paid",
            icon: DollarSign,
            onClick: () => updateStatus(row, "paid"),
            visible: status !== "paid",
          },
        ]}
      />
    </td>
  </tr>
);

                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCategoryModal ? (
        <div className="finance-modal-backdrop">
          <div className="finance-modal finance-modal-sm">
            <div className="finance-modal-head">
              <h2>Add Expense Category</h2>
              <button type="button" onClick={() => setShowCategoryModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="finance-modal-body">
              <Field label="Category Name">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Example: Youth ministry supplies"
                />
              </Field>
            </div>
            <div className="finance-modal-actions">
              <button className="finance-btn finance-btn-secondary" onClick={() => setShowCategoryModal(false)}>
                Cancel
              </button>
              <button className="finance-btn finance-btn-primary" onClick={saveCategory}>
                <Plus size={16} />
                Add Category
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="finance-modal-backdrop">
          <form className="finance-modal finance-modal-xl" onSubmit={submitExpense}>
            <div className="finance-modal-head">
              <div>
                <h2>Create Expense</h2>
                <p>Capture vendor payments and individual reimbursements with audit-ready detail.</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="finance-modal-body">
              <div className="finance-form-grid">
                <Field label="Expense Type">
                  <select value={form.expense_type} onChange={(e) => updateForm("expense_type", e.target.value)}>
                    <option value="vendor">Vendor / Payee Expense</option>
                    <option value="reimbursement">Individual Reimbursement</option>
                  </select>
                </Field>

                <Field label="Category">
                  <select value={form.category} onChange={(e) => updateForm("category", e.target.value)}>
                    {categories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Amount">
                  <input type="number" step="0.01" value={form.amount} onChange={(e) => updateForm("amount", e.target.value)} />
                </Field>

                <Field label="Expense Date">
                  <input type="date" value={form.expense_date} onChange={(e) => updateForm("expense_date", e.target.value)} />
                </Field>

                <Field label="Due Date">
                  <input type="date" value={form.due_date} onChange={(e) => updateForm("due_date", e.target.value)} />
                </Field>

                <Field label="Status">
                  <select value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Paid</option>
                  </select>
                </Field>
              </div>

              <section className="finance-subsection">
                <h3>
                  <ClipboardList size={16} />
                  Vendor Information
                </h3>
                <div className="finance-form-grid">
                  <Field label={form.expense_type === "vendor" ? "Vendor Name *" : "Vendor Name"}>
                    <input value={form.vendor_name} onChange={(e) => updateForm("vendor_name", e.target.value)} />
                  </Field>
                  <Field label="Vendor Email">
                    <input value={form.vendor_email} onChange={(e) => updateForm("vendor_email", e.target.value)} />
                  </Field>
                  <Field label="Vendor Phone">
                    <input value={form.vendor_phone} onChange={(e) => updateForm("vendor_phone", e.target.value)} />
                  </Field>
                  <Field label="Vendor Invoice #">
                    <input value={form.invoice_no} onChange={(e) => updateForm("invoice_no", e.target.value)} />
                  </Field>
                </div>
              </section>

              {form.expense_type === "reimbursement" ? (
                <section className="finance-subsection">
                  <h3>
                    <UserRound size={16} />
                    Individual Reimbursement Information
                  </h3>
                  <div className="finance-form-grid">
                    <Field label="First Name *">
                      <input value={form.payee_first_name} onChange={(e) => updateForm("payee_first_name", e.target.value)} />
                    </Field>
                    <Field label="Last Name *">
                      <input value={form.payee_last_name} onChange={(e) => updateForm("payee_last_name", e.target.value)} />
                    </Field>
                    <Field label="Email">
                      <input value={form.payee_email} onChange={(e) => updateForm("payee_email", e.target.value)} />
                    </Field>
                    <Field label="Phone">
                      <input value={form.payee_phone} onChange={(e) => updateForm("payee_phone", e.target.value)} />
                    </Field>
                    <Field label="Address">
                      <input value={form.payee_address} onChange={(e) => updateForm("payee_address", e.target.value)} />
                    </Field>
                    <Field label="City">
                      <input value={form.payee_city} onChange={(e) => updateForm("payee_city", e.target.value)} />
                    </Field>
                    <Field label="State">
                      <input value={form.payee_state} onChange={(e) => updateForm("payee_state", e.target.value)} />
                    </Field>
                    <Field label="ZIP">
                      <input value={form.payee_zip} onChange={(e) => updateForm("payee_zip", e.target.value)} />
                    </Field>
                  </div>
                </section>
              ) : null}

              <section className="finance-subsection">
                <h3>
                  <Edit3 size={16} />
                  Payment & Notes
                </h3>
                <div className="finance-form-grid">
                  <Field label="Payment Method">
                    <select value={form.payment_method} onChange={(e) => updateForm("payment_method", e.target.value)}>
                      <option value="">Not paid yet</option>
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                      <option value="zelle">Zelle</option>
                      <option value="ach">ACH</option>
                      <option value="card">Card</option>
                    </select>
                  </Field>
                  <Field label="Reference #">
                    <input value={form.reference_no} onChange={(e) => updateForm("reference_no", e.target.value)} />
                  </Field>
                  <Field label="Description">
                    <input value={form.description} onChange={(e) => updateForm("description", e.target.value)} />
                  </Field>
                </div>
                <Field label="Notes">
                  <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} rows={4} />
                </Field>
              </section>
            </div>

            <div className="finance-modal-actions">
              <button className="finance-btn finance-btn-secondary" type="button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="finance-btn finance-btn-primary" type="submit" disabled={saving}>
                <Plus size={16} />
                {saving ? "Creating..." : "Create Expense"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
