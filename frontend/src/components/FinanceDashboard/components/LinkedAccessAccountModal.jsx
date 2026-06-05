//frontend\src\components\FinanceDashboard\components\LinkedAccessAccountModal.jsx
import React, { useEffect, useState } from "react";
import api from "../../api";

const initialForm = {
  role: "finance",
  username: "",
  email: "",
  phone: "",
  password: "",
  auto_generate_password: true,
  is_active: "1",
};

export default function LinkedAccessAccountModal({
  open,
  onClose,
  onSaved,
  memberId,
  memberName,
}) {
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    if (!open) {
      setForm(initialForm);
      setErr("");
      setSuccessInfo(null);
    }
  }, [open]);

  if (!open) return null;

  function upd(key, value) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setSuccessInfo(null);

    if (!memberId) {
      setErr("Member id is missing.");
      return;
    }

    if (!form.username.trim() || !form.email.trim()) {
      setErr("Username and email are required.");
      return;
    }

    if (!form.auto_generate_password && !form.password.trim()) {
      setErr("Password is required when auto-generate is off.");
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.post(`/admin/members/${memberId}/accounts`, {
        ...form,
        is_active: Number(form.is_active),
      });

      setSuccessInfo({
        message: data?.message || "Linked account created successfully.",
        temp_password: data?.temp_password || null,
      });

      onSaved?.();
    } catch (e2) {
      setErr(e2?.response?.data?.error || "Failed to create linked account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="terms-overlay" role="dialog" aria-modal="true">
      <div className="terms-modal" style={{ maxWidth: 760 }}>
        <div className="terms-head">
          <h2>Create Linked Staff Account</h2>
          <button className="terms-close" onClick={onClose}>✕</button>
        </div>

        <p style={{ marginTop: 0 }}>
          Member: <strong>{memberName || `#${memberId}`}</strong>
        </p>

        <form className="auth-form" onSubmit={submit}>
          <div className="auth-grid-2">
            <div className="auth-field">
              <label>Role *</label>
              <select value={form.role} onChange={(e) => upd("role", e.target.value)}>
                <option value="finance">Finance</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="auth-field">
              <label>Account Status</label>
              <select value={form.is_active} onChange={(e) => upd("is_active", e.target.value)}>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="auth-field">
              <label>Username *</label>
              <input
                value={form.username}
                onChange={(e) => upd("username", e.target.value)}
                placeholder="nigusea.finance@church.org"
              />
            </div>

            <div className="auth-field">
              <label>Email *</label>
              <input
                value={form.email}
                onChange={(e) => upd("email", e.target.value)}
                placeholder="finance@church.org"
              />
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="auth-field">
              <label>Phone</label>
              <input
                value={form.phone}
                onChange={(e) => upd("phone", e.target.value)}
                placeholder="+15555555555"
              />
            </div>

            <div className="auth-field">
              <label>Password Mode</label>
              <select
                value={form.auto_generate_password ? "1" : "0"}
                onChange={(e) => upd("auto_generate_password", e.target.value === "1")}
              >
                <option value="1">Auto generate temporary password</option>
                <option value="0">Enter password manually</option>
              </select>
            </div>
          </div>

          {!form.auto_generate_password ? (
            <div className="auth-field">
              <label>Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => upd("password", e.target.value)}
                placeholder="Strong password"
              />
            </div>
          ) : null}

          {err ? <div className="auth-banner">{err}</div> : null}

          {successInfo ? (
            <div className="auth-banner auth-banner-success">
              <div>{successInfo.message}</div>
              {successInfo.temp_password ? (
                <div style={{ marginTop: 8 }}>
                  Temporary Password: <strong>{successInfo.temp_password}</strong>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="terms-actions">
            <button type="button" className="terms-cancel" onClick={onClose}>
              Close
            </button>
            <button type="submit" className="terms-accept" disabled={busy}>
              {busy ? "Creating..." : "Create Linked Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}