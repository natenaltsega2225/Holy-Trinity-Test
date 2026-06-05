//frontend\src\components\ResetPasswordRequired.jsx
import React, {
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import "../styles/auth.css";

import api from "../components/api";

import {
  useAuth,
  landingForRole,
} from "../hooks/useAuth";

function getPasswordChecks(value) {

  const v =
    String(value || "");

  return {

    length:
      v.length >= 12,

    upper:
      /[A-Z]/.test(v),

    lower:
      /[a-z]/.test(v),

    number:
      /\d/.test(v),

    special:
      /[^A-Za-z0-9]/.test(v),
  };
}

function validatePassword(value) {

  const checks =
    getPasswordChecks(value);

  if (!checks.length) {
    return "Password must be at least 12 characters.";
  }

  if (!checks.upper) {
    return "Password must include uppercase.";
  }

  if (!checks.lower) {
    return "Password must include lowercase.";
  }

  if (!checks.number) {
    return "Password must include a number.";
  }

  if (!checks.special) {
    return "Password must include a special character.";
  }

  return "";
}

export default function ResetPasswordRequired() {

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const auth =
    useAuth();

  const identifier =

    location.state?.identifier ||

    sessionStorage.getItem(
      "ht_reset_identifier"
    ) ||

    "";

  const [tempPassword, setTempPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showTemp, setShowTemp] =
    useState(false);

  const [showNew, setShowNew] =
    useState(false);

  const [showConfirm, setShowConfirm] =
    useState(false);

  const passwordError =
    validatePassword(newPassword);

  const confirmError =

    confirmPassword !== newPassword

      ? "Passwords do not match."

      : "";

  const formValid =
    useMemo(() => {

      return (

        !!identifier &&

        !!tempPassword &&

        !passwordError &&

        !confirmError
      );

    }, [

      identifier,
      tempPassword,
      newPassword,
      confirmPassword,
      passwordError,
      confirmError,
    ]);

  async function handleSubmit(e) {

    e.preventDefault();

    setBusy(true);

    setError("");

    try {

      /* ========================================
         VERIFY TEMP PASSWORD
      ======================================== */

      const loginRes =
        await api.post(
          "/auth/login",
          {
            identifier,
            password:
              tempPassword,
          },
          {
            withCredentials: true,
          }
        );

      if (
        !loginRes.data
          ?.requires_password_reset
      ) {

        throw new Error(
          "Temporary password verification failed."
        );
      }

      /* ========================================
         RESET PASSWORD
      ======================================== */

      const resetRes =
        await api.post(
          "/auth/reset-temp-password",
          {
            identifier,

            temp_password:
              tempPassword,

            new_password:
              newPassword,

            confirm_password:
              confirmPassword,
          }
        );

      /* ========================================
         AUTO LOGIN
      ======================================== */

      auth.setToken(
        resetRes.data.token
      );

      auth.setUser(
        resetRes.data.user
      );

      sessionStorage.removeItem(
        "ht_reset_identifier"
      );

      navigate(

        landingForRole(
          resetRes.data.user.role
        ),

        {
          replace: true,
        }
      );

    } catch (err) {

      console.error(err);

      setError(

        err.response?.data?.error ||

        err.message ||

        "Unable to reset password."
      );

    } finally {

      setBusy(false);
    }
  }

  return (

    <div className="auth-wrap">

      <div className="auth-card auth-card-narrow">

        <div className="auth-head">

          <h1 className="auth-head-title">
            Reset Password
          </h1>

        </div>

        <p className="auth-sub auth-sub-centered">

          Your account uses a temporary password.
          Create a secure permanent password.

        </p>

        {error ? (

          <div className="auth-banner">

            {error}

          </div>

        ) : null}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          <div className="auth-field">

            <label>
              Account
            </label>

            <input
              value={identifier}
              readOnly
            />

          </div>

          <div className="auth-field">

            <label>
              Temporary Password
            </label>

            <div className="auth-password-wrap">

              <input
                type={
                  showTemp
                    ? "text"
                    : "password"
                }
                value={tempPassword}
                onChange={(e) =>
                  setTempPassword(
                    e.target.value
                  )
                }
                required
              />

              <button
                type="button"
                className="auth-password-toggle"
                onClick={() =>
                  setShowTemp(
                    (v) => !v
                  )
                }
              >
                {showTemp
                  ? "Hide"
                  : "Show"}
              </button>

            </div>

          </div>

          <div className="auth-field">

            <label>
              New Password
            </label>

            <div className="auth-password-wrap">

              <input
                type={
                  showNew
                    ? "text"
                    : "password"
                }
                value={newPassword}
                onChange={(e) =>
                  setNewPassword(
                    e.target.value
                  )
                }
                required
              />

              <button
                type="button"
                className="auth-password-toggle"
                onClick={() =>
                  setShowNew(
                    (v) => !v
                  )
                }
              >
                {showNew
                  ? "Hide"
                  : "Show"}
              </button>

            </div>

          </div>

          <div className="auth-field">

            <label>
              Confirm Password
            </label>

            <div className="auth-password-wrap">

              <input
                type={
                  showConfirm
                    ? "text"
                    : "password"
                }
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(
                    e.target.value
                  )
                }
                required
              />

              <button
                type="button"
                className="auth-password-toggle"
                onClick={() =>
                  setShowConfirm(
                    (v) => !v
                  )
                }
              >
                {showConfirm
                  ? "Hide"
                  : "Show"}
              </button>

            </div>

          </div>

          <button
            className="auth-btn"
            type="submit"
            disabled={
              busy ||
              !formValid
            }
          >

            {busy

              ? "Updating..."

              : "Update Password"}

          </button>

        </form>

      </div>

    </div>
  );
}