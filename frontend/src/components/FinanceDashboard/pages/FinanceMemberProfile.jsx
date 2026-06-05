//frontend\src\components\FinanceDashboard\pages\FinanceMemberProfile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../api";

function money(v) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function fmtDate(v) {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleDateString();
}

const TABS = ["overview", "payments", "ledger", "invoices", "dependents"];

export default function FinanceMemberProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const initialTab = TABS.includes(params.get("tab")) ? params.get("tab") : "overview";

  const [tab, setTab] = useState(initialTab);
  const [member, setMember] = useState(null);
  const [dependents, setDependents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setErr("");

        const [memberRes, paymentsRes, invoicesRes, ledgerRes] = await Promise.allSettled([
          api.get(`/finance/members/${id}`),
          api.get(`/finance/payments`, { params: { member_id: id, limit: 25 } }),
          api.get(`/finance/invoices`, { params: { member_id: id, limit: 25 } }),
          api.get(`/finance/ledger`, { params: { member_id: id, limit: 25 } }),
        ]);

        if (!alive) return;

        const memberData = memberRes.status === "fulfilled" ? memberRes.value.data : {};
        const row = memberData.row || memberData.member || null;

        setMember(row);
        setDependents(memberData.dependents || row?.dependents || []);
        setPayments(paymentsRes.status === "fulfilled" ? paymentsRes.value.data?.rows || [] : []);
        setInvoices(invoicesRes.status === "fulfilled" ? invoicesRes.value.data?.rows || [] : []);
        setLedger(ledgerRes.status === "fulfilled" ? ledgerRes.value.data?.rows || [] : []);

        if (!row) setErr("Member not found.");
      } catch (e) {
        setErr(e?.response?.data?.error || "Failed to load member profile.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (id) load();

    return () => {
      alive = false;
    };
  }, [id]);

  const summary = useMemo(() => {
    return {
      paid: payments.reduce((s, p) => s + Number(p.amount || 0), 0),
      balance: Number(member?.open_balance || 0),
      dependents: dependents.length,
    };
  }, [member, payments, dependents]);

  function switchTab(next) {
    setTab(next);
    setParams({ tab: next });
  }

  if (loading) return <div className="finance-card">Loading member profile...</div>;

  if (err || !member) {
    return (
      <div className="finance-card">
        <h2>Member Profile</h2>
        <p>{err || "Member not found."}</p>
        <button className="finance-btn finance-btn-secondary" onClick={() => nav("/dash/finance/members")}>
          Back to Members
        </button>
      </div>
    );
  }

  return (
    <div className="finance-page-shell">
      <section className="finance-card">
        <div className="finance-profile-head">
          <div>
            <p className="finance-modal-eyebrow">Finance Member Profile</p>
            <h1>{member.full_name || "--"}</h1>
            <p>
              {member.member_no || "--"} · {member.email || "No email"} · {member.phone || "No phone"}
            </p>
          </div>

          <div className="finance-row-actions">
            <button className="finance-btn finance-btn-secondary" onClick={() => nav("/dash/finance/members")}>
              Back
            </button>
            <button className="finance-btn finance-btn-primary" onClick={() => nav(`/dash/finance/payments?member_id=${id}`)}>
              Payment History
            </button>
          </div>
        </div>

        <div className="finance-summary-grid">
          <div className="finance-summary-card">
            <span>Membership</span>
            <h3>{member.membership_status || "--"}</h3>
          </div>
          <div className="finance-summary-card">
            <span>Account</span>
            <h3>{member.status || "--"}</h3>
          </div>
          <div className="finance-summary-card featured">
            <span>Total Paid</span>
            <h3>{money(summary.paid || member.total_paid)}</h3>
          </div>
          <div className="finance-summary-card">
            <span>Dependents</span>
            <h3>{summary.dependents}</h3>
          </div>
        </div>

        <div className="finance-tabs">
          {TABS.map((t) => (
            <button key={t} type="button" className={tab === t ? "active" : ""} onClick={() => switchTab(t)}>
              {t.replace("-", " ")}
            </button>
          ))}
        </div>
      </section>

      {tab === "overview" && (
        <section className="finance-card">
          <h2>Full Member Information</h2>
          <div className="finance-modal-grid finance-modal-grid-2">
            <p><b>Member No:</b> {member.member_no || "--"}</p>
            <p><b>Name:</b> {member.full_name || "--"}</p>
            <p><b>Email:</b> {member.email || "--"}</p>
            <p><b>Phone:</b> {member.phone || "--"}</p>
            <p><b>Address:</b> {[member.address_line_1, member.address_line_2, member.city, member.state, member.zip_code].filter(Boolean).join(", ") || "--"}</p>
            <p><b>Registered:</b> {fmtDate(member.created_at || member.joined_at)}</p>
            <p><b>Balance:</b> {money(member.open_balance)}</p>
            <p><b>Payment Status:</b> {member.payment_status || "--"}</p>
          </div>
        </section>
      )}

      {tab === "payments" && (
        <section className="finance-card">
          <h2>Payments</h2>
          <table className="finance-table">
            <thead><tr><th>Date</th><th>Payment #</th><th>Category</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id || p.payment_number}>
                  <td>{fmtDate(p.payment_date || p.paid_at || p.created_at)}</td>
                  <td>{p.payment_number || "--"}</td>
                  <td>{p.category || p.payment_type || "--"}</td>
                  <td>{p.method || p.payment_method || "--"}</td>
                  <td>{money(p.amount)}</td>
                  <td>{p.status || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "ledger" && (
        <section className="finance-card">
          <h2>Ledger</h2>
          <table className="finance-table">
            <thead><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
            <tbody>
              {ledger.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.created_at || r.entry_date)}</td>
                  <td>{r.description || "--"}</td>
                  <td>{money(r.debit)}</td>
                  <td>{money(r.credit)}</td>
                  <td>{money(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "invoices" && (
        <section className="finance-card">
          <h2>Invoices</h2>
          <table className="finance-table">
            <thead><tr><th>Invoice #</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id || i.invoice_number}>
                  <td>{i.invoice_number || "--"}</td>
                  <td>{fmtDate(i.invoice_date || i.created_at)}</td>
                  <td>{money(i.total_amount || i.amount)}</td>
                  <td>{money(i.paid_amount)}</td>
                  <td>{money(i.balance_due)}</td>
                  <td>{i.status || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "dependents" && (
        <section className="finance-card">
          <h2>Dependents</h2>
          {dependents.length === 0 ? (
            <p>No dependents found.</p>
          ) : (
            <table className="finance-table">
              <thead><tr><th>Name</th><th>Relationship</th><th>DOB</th><th>Email</th><th>Phone</th><th>Status</th></tr></thead>
              <tbody>
                {dependents.map((d) => (
                  <tr key={d.id}>
                    <td>{d.full_name || `${d.first_name || ""} ${d.last_name || ""}`}</td>
                    <td>{d.relationship || "--"}</td>
                    <td>{fmtDate(d.date_of_birth)}</td>
                    <td>{d.email || "--"}</td>
                    <td>{d.phone || "--"}</td>
                    <td>{d.status || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}