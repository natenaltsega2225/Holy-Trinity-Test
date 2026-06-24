// frontend/src/components/FinanceDashboard/components/LinkedAccessAccountModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Mail,
  RefreshCcw,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const ACCOUNT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "pending_password_change", label: "Pending Password Change" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "locked", label: "Locked" },
  { value: "inactive", label: "Inactive" },
];

function clean(value) {
  return String(value ?? "").trim();
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

function memberId(member) {
  return firstValue(member, ["id", "member_id"], "");
}

function memberNo(member) {
  return firstValue(member, ["member_no", "member_number"], "");
}

function fullName(member) {
  return firstValue(member, ["full_name", "name"], "Member");
}

function email(member) {
  return firstValue(member, ["email", "member_email"], "");
}

function defaultUsername(member = {}) {
  const existing = firstValue(member, ["username"], "");

  if (existing) return existing;

  const no = memberNo(member);

  if (no) return no.toLowerCase();

  const name = fullName(member)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  return name || "";
}

function generatePassword(length = 14) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const cryptoObj = window.crypto || window.msCrypto;
  const bytes = new Uint32Array(length);

  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  }

  return Array.from(bytes)
    .map((value, index) => {
      const safe = cryptoObj?.getRandomValues ? value : Math.random() * alphabet.length;
      return alphabet[Math.floor(safe) % alphabet.length] || alphabet[index % alphabet.length];
    })
    .join("");
}

function statusTone(status) {
  const value = clean(status).toLowerCase();

  if (["active"].includes(value)) return "success";
  if (["pending_password_change", "pending_payment"].includes(value)) return "warning";
  if (["locked", "inactive", "disabled"].includes(value)) return "danger";

  return "neutral";
}

function StatusBadge({ status }) {
  return (
    <span className={`finance-status-badge ${statusTone(status)}`}>
      {clean(status).replaceAll("_", " ") || "--"}
    </span>
  );
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

async function patchFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.patch(endpoint, payload);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

export default function LinkedAccessAccountModal({
  open,
  member,
  account,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    account_status: "active",
    temporary_password: "",
    must_change_password: true,
    send_welcome_email: true,
    send_reset_email: false,
    unlock_account: false,
    notes: "",
  });

  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const hasAccount = useMemo(
    () =>
      Boolean(
        account?.id ||
          account?.user_id ||
          firstValue(member, ["user_id", "account_id", "username"], "")
      ),
    [account, member]
  );

  useEffect(() => {
    if (!open) return;

    setForm({
      username: firstValue(account, ["username"], defaultUsername(member)),
      email: firstValue(account, ["email"], email(member)),
      account_status: firstValue(
        account,
        ["account_status", "status"],
        firstValue(member, ["account_status"], "active")
      ),
      temporary_password: "",
      must_change_password:
        Number(firstValue(account, ["must_change_password"], 1)) === 1,
      send_welcome_email: !hasAccount,
      send_reset_email: false,
      unlock_account: false,
      notes: "",
    });

    setError("");
    setSuccess("");
    setSaving("");
  }, [open, member, account, hasAccount]);

  function setValue(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function close() {
    if (saving) return;
    onClose?.();
  }

  function basePayload(extra = {}) {
    return {
      member_id: memberId(member),
      member_no: memberNo(member),
      full_name: fullName(member),

      username: clean(form.username),
      email: clean(form.email),
      account_status: form.account_status,
      status: form.account_status,

      temporary_password: clean(form.temporary_password) || undefined,
      must_change_password: form.must_change_password ? 1 : 0,

      send_welcome_email: Boolean(form.send_welcome_email),
      send_reset_email: Boolean(form.send_reset_email),
      unlock_account: Boolean(form.unlock_account),

      notes: clean(form.notes) || null,
      source: "finance_linked_access_account_modal",

      ...extra,
    };
  }

  function validate(needsPassword = false) {
    if (!memberId(member)) {
      setError("Member profile is required.");
      return false;
    }

    if (!clean(form.username)) {
      setError("Username is required.");
      return false;
    }

    if (!clean(form.email)) {
      setError("Email is required.");
      return false;
    }

    if (needsPassword && !clean(form.temporary_password)) {
      setError("Temporary password is required.");
      return false;
    }

    return true;
  }

  async function createOrUpdateAccount(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const creating = !hasAccount;

    if (!validate(creating)) return;

    setSaving("save");

    try {
      const payload = basePayload({
        action: creating ? "create_access_account" : "update_access_account",
      });

      if (creating) {
        await postFirst(
          [
            `/finance/members/${memberId(member)}/access-account`,
            "/admin/access-users",
          ],
          payload
        );
      } else {
        await patchFirst(
          [
            `/finance/members/${memberId(member)}/access-account`,
            `/admin/access-users/${firstValue(account, ["id", "user_id"], "")}`,
          ],
          payload
        );
      }

      setSuccess(creating ? "Access account created." : "Access account updated.");
      onSaved?.();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save access account."
      );
    } finally {
      setSaving("");
    }
  }

  async function resetPassword() {
    setError("");
    setSuccess("");

    if (!validate(true)) return;

    setSaving("reset");

    try {
      await postFirst(
        [
          `/finance/members/${memberId(member)}/access-account/reset-password`,
          `/admin/access-users/${firstValue(account, ["id", "user_id"], "")}/reset-password`,
        ],
        basePayload({
          action: "reset_password",
          send_reset_email: true,
          must_change_password: 1,
        })
      );

      setSuccess("Temporary password reset and email workflow triggered.");
      onSaved?.();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to reset password."
      );
    } finally {
      setSaving("");
    }
  }

  async function resendWelcome() {
    setError("");
    setSuccess("");

    if (!validate(false)) return;

    setSaving("welcome");

    try {
      await postFirst(
        [
          `/finance/members/${memberId(member)}/access-account/resend-welcome`,
          `/admin/access-users/${firstValue(account, ["id", "user_id"], "")}/welcome`,
        ],
        basePayload({
          action: "resend_welcome_email",
        })
      );

      setSuccess("Welcome email resent.");
      onSaved?.();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to resend welcome email."
      );
    } finally {
      setSaving("");
    }
  }

  async function unlockAccount() {
    setError("");
    setSuccess("");

    if (!validate(false)) return;

    setSaving("unlock");

    try {
      await postFirst(
        [
          `/finance/members/${memberId(member)}/access-account/unlock`,
          `/admin/access-users/${firstValue(account, ["id", "user_id"], "")}/unlock`,
        ],
        basePayload({
          action: "unlock_account",
          account_status: "active",
          status: "active",
        })
      );

      setValue("account_status", "active");
      setSuccess("Access account unlocked.");
      onSaved?.();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to unlock account."
      );
    } finally {
      setSaving("");
    }
  }

  if (!open) return null;

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <form className="finance-modal finance-modal-wide" onSubmit={createOrUpdateAccount}>
        <div className="finance-modal-head">
          <div>
            <p className="finance-eyebrow">Member Portal Access</p>
            <h2>{hasAccount ? "Manage Access Account" : "Create Access Account"}</h2>
            <span>
              Link member dashboard access, reset temporary credentials, and
              resend secure login instructions.
            </span>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={close}
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
            <UserRound size={18} />
          </div>

          <div>
            <strong>{fullName(member)}</strong>
            <span>
              {memberNo(member) || "--"}
              {email(member) ? ` - ${email(member)}` : ""}
            </span>
            <small>
              Access status:{" "}
              <StatusBadge status={form.account_status} />
            </small>
          </div>
        </div>

        <section className="finance-modal-section">
          <div className="finance-section-head">
            <div>
              <h3>
                <ShieldCheck size={17} />
                Login Identity
              </h3>
              <p>
                Username can be member ID, first initial + last name, or an
                existing account username.
              </p>
            </div>
          </div>

          <div className="finance-form-grid three">
            <label>
              Username *
              <input
                value={form.username}
                onChange={(event) => setValue("username", event.target.value)}
                placeholder="m-00085 or mabebe"
                required
              />
            </label>

            <label>
              Email *
              <input
                type="email"
                value={form.email}
                onChange={(event) => setValue("email", event.target.value)}
                required
              />
            </label>

            <label>
              Account Status
              <select
                value={form.account_status}
                onChange={(event) => setValue("account_status", event.target.value)}
              >
                {ACCOUNT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Temporary Password
              <div className="finance-input-action">
                <input
                  value={form.temporary_password}
                  onChange={(event) =>
                    setValue("temporary_password", event.target.value)
                  }
                  placeholder={hasAccount ? "Only needed for reset" : "Required for new account"}
                />

                <button
                  type="button"
                  className="finance-mini-button"
                  onClick={() => setValue("temporary_password", generatePassword())}
                >
                  Generate
                </button>
              </div>
            </label>
          </div>

          <div className="finance-check-grid">
            <label>
              <input
                type="checkbox"
                checked={form.must_change_password}
                onChange={(event) =>
                  setValue("must_change_password", event.target.checked)
                }
              />
              Require password change
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.send_welcome_email}
                onChange={(event) =>
                  setValue("send_welcome_email", event.target.checked)
                }
              />
              Send welcome email
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.send_reset_email}
                onChange={(event) =>
                  setValue("send_reset_email", event.target.checked)
                }
              />
              Send reset email
            </label>
          </div>
        </section>

        <label className="finance-field-full">
          Internal Note
          <textarea
            value={form.notes}
            rows={3}
            onChange={(event) => setValue("notes", event.target.value)}
            placeholder="Reason for access change, password reset, or account repair"
          />
        </label>

        <div className="finance-modal-actions split">
          <div className="finance-row-actions">
            {hasAccount ? (
              <>
                <button
                  type="button"
                  className="finance-btn ghost"
                  onClick={resetPassword}
                  disabled={Boolean(saving)}
                >
                  <KeyRound size={16} />
                  {saving === "reset" ? "Resetting..." : "Reset Password"}
                </button>

                <button
                  type="button"
                  className="finance-btn ghost"
                  onClick={resendWelcome}
                  disabled={Boolean(saving)}
                >
                  <Send size={16} />
                  {saving === "welcome" ? "Sending..." : "Resend Welcome"}
                </button>

                <button
                  type="button"
                  className="finance-btn ghost"
                  onClick={unlockAccount}
                  disabled={Boolean(saving)}
                >
                  <LockKeyhole size={16} />
                  {saving === "unlock" ? "Unlocking..." : "Unlock"}
                </button>
              </>
            ) : null}
          </div>

          <div className="finance-row-actions">
            <button type="button" className="finance-btn ghost" onClick={close}>
              Cancel
            </button>

            <button type="submit" className="finance-btn primary" disabled={Boolean(saving)}>
              {hasAccount ? <RefreshCcw size={16} /> : <Mail size={16} />}
              {saving === "save"
                ? "Saving..."
                : hasAccount
                  ? "Save Account"
                  : "Create Account"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}