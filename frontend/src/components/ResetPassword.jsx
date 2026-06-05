
// frontend/src/components/ResetPassword.jsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "../styles/auth.css";
import api, { getBaseURL } from "./api";

function getPasswordChecks(value) {
  const v = String(value || "");
  return {
    length: v.length >= 12,
    upper: /[A-Z]/.test(v),
    lower: /[a-z]/.test(v),
    number: /\d/.test(v),
    special: /[^A-Za-z0-9]/.test(v),
  };
}

function passwordStrengthLabel(value) {
  const score = Object.values(getPasswordChecks(value)).filter(Boolean).length;
  if (score <= 2) return "weak";
  if (score <= 4) return "medium";
  return "strong";
}

function validatePassword(value) {
  const checks = getPasswordChecks(value);
  if (!checks.length) return "Password must be at least 12 characters.";
  if (!checks.upper) return "Password must include an uppercase letter.";
  if (!checks.lower) return "Password must include a lowercase letter.";
  if (!checks.number) return "Password must include a number.";
  if (!checks.special) return "Password must include a special character.";
  return "";
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState({
    password: false,
    confirmPassword: false,
  });

  const nav = useNavigate();

  const passwordError = touched.password ? validatePassword(password) : "";
  const confirmError =
    touched.confirmPassword && confirmPassword !== password
      ? "Passwords do not match."
      : "";

  const checks = getPasswordChecks(password);
  const strength = passwordStrengthLabel(password);

  const formValid = useMemo(() => {
    return !!token && !validatePassword(password) && confirmPassword === password;
  }, [token, password, confirmPassword]);

  async function submit(e) {
    e.preventDefault();
    setTouched({ password: true, confirmPassword: true });
    setErr("");
    setSuccess("");

    if (!token) {
      setErr("This reset link is invalid or missing a token.");
      return;
    }

    if (!formValid) {
      setErr("Please correct the highlighted fields.");
      return;
    }

    setBusy(true);
    try {
      await api.post("/auth/reset-password", {
        token,
        new_password: password,
        confirm_password: confirmPassword,
      });

      setSuccess("Your password has been reset successfully.");
      setTimeout(() => nav("/login", { replace: true }), 1200);
    } catch (e2) {
      console.error("Reset password error:", e2);

      if (!e2.response) {
        setErr(
          `Cannot reach the API. Check that the backend is running at ${getBaseURL()} and CORS allows http://localhost:5173.`
        );
      } else {
        setErr(
          e2.response?.data?.error ||
            e2.response?.data?.message ||
            "Reset password failed."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card auth-card-compact auth-card-narrow">
        <div className="auth-head">
          <h1 className="auth-head-title">Reset Password</h1>
          <button
            type="button"
            className="auth-head-close"
            aria-label="Close reset password"
            onClick={() => nav("/login")}
          >
            ✕
          </button>
        </div>

        <p className="auth-sub auth-sub-centered">
          Create a new secure password for your account.
        </p>

        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-field">
            <label htmlFor="reset-password">
              New Password <span className="auth-required">*</span>
            </label>
            <div className="auth-password-wrap">
              <input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Create a strong password"
                value={password}
                onBlur={() => setTouched((s) => ({ ...s, password: true }))}
                onChange={(e) => setPassword(e.target.value)}
                className={passwordError ? "auth-input-error" : ""}
                aria-invalid={!!passwordError}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div className="auth-password-meter">
              <div className={`auth-password-strength auth-strength-${strength}`}>
                Strength: {strength.charAt(0).toUpperCase() + strength.slice(1)}
              </div>

              <ul className="auth-password-checks">
                <li className={checks.length ? "ok" : "bad"}>12+ characters</li>
                <li className={checks.upper ? "ok" : "bad"}>Uppercase</li>
                <li className={checks.lower ? "ok" : "bad"}>Lowercase</li>
                <li className={checks.number ? "ok" : "bad"}>Number</li>
                <li className={checks.special ? "ok" : "bad"}>Special character</li>
              </ul>
            </div>

            {passwordError ? (
              <div className="auth-field-error">{passwordError}</div>
            ) : null}
          </div>

          <div className="auth-field">
            <label htmlFor="reset-confirm-password">
              Confirm Password <span className="auth-required">*</span>
            </label>
            <div className="auth-password-wrap">
              <input
                id="reset-confirm-password"
                type={showConfirm ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onBlur={() =>
                  setTouched((s) => ({ ...s, confirmPassword: true }))
                }
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={confirmError ? "auth-input-error" : ""}
                aria-invalid={!!confirmError}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>

            {confirmError ? (
              <div className="auth-field-error">{confirmError}</div>
            ) : null}
          </div>

          {err ? (
            <div className="auth-banner" role="alert">
              {err}
            </div>
          ) : null}

          {success ? (
            <div className="auth-banner auth-banner-success" role="status">
              {success}
            </div>
          ) : null}

          <button
            className="auth-btn"
            type="submit"
            disabled={busy || !formValid}
          >
            {busy ? "Updating..." : "Reset Password"}
          </button>

          <p className="auth-switch">
            Back to{" "}
            <Link to="/login" className="auth-link">
              login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}