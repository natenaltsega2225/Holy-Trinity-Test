//frontend\src\components\ForgotPassword.jsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/auth.css";
import api, { getBaseURL } from "./api";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function validateEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }
  return "";
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [touched, setTouched] = useState(false);

  const nav = useNavigate();

  const emailError = touched ? validateEmail(email) : "";
  const formValid = useMemo(() => !validateEmail(email), [email]);

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    setErr("");
    setSuccess("");

    if (!formValid) {
      setErr("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      await api.post("/auth/forgot-password", {
        email: normalizeEmail(email),
      });

      setSuccess(
        "If an account exists for that email, password reset instructions have been sent."
      );
    } catch (e2) {
      console.error("Forgot password error:", e2);

      if (!e2.response) {
        setErr(
          `Cannot reach the API. Check that the backend is running at ${getBaseURL()} and CORS allows http://localhost:5173.`
        );
      } else if (e2.response.status === 429) {
        setErr("Too many attempts. Please try again later.");
      } else {
        setErr(
          e2.response?.data?.error ||
            e2.response?.data?.message ||
            "Could not process your request."
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
          <h1 className="auth-head-title">Forgot Password</h1>
          <button
            type="button"
            className="auth-head-close"
            aria-label="Close forgot password"
            onClick={() => nav("/login")}
          >
            ✕
          </button>
        </div>

       <p className="auth-sub auth-sub-centered">

  Enter your account email address to receive
  secure password reset instructions.

  <br />

  <span className="auth-sub-small">

    New members created by the finance office
    should use their temporary password first.

  </span>

</p>

        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-field">
            <label htmlFor="forgot-email">
              Email Address <span className="auth-required">*</span>
            </label>
            <input
              id="forgot-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="Enter your account email address"
              value={email}
              onBlur={() => setTouched(true)}
              onChange={(e) => setEmail(e.target.value)}
              className={emailError ? "auth-input-error" : ""}
              aria-invalid={!!emailError}
            />
            {emailError ? (
              <div className="auth-field-error">{emailError}</div>
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
            {busy ? "Sending..." : "Send Reset Link"}
          </button>

          <p className="auth-switch">
            Remembered your password?{" "}
            <Link to="/login" className="auth-link">
              Back to login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}