// src/components/Login.jsx



import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api, { getBaseURL } from "../components/api";
import { useAuth, landingForRole } from "../hooks/useAuth";
import { usePublicSettings } from "../context/PublicSettingsContext";
import "../styles/auth.css";

function cleanIdentifier(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function validate(form) {
  const errors = {};

  if (!cleanIdentifier(form.identifier)) {
    errors.identifier = "Email, username, or member ID is required.";
  }

  if (!String(form.password || "").trim()) {
    errors.password = "Password is required.";
  }

  return errors;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  const { settings: publicSettings } = usePublicSettings();

  const infoMessage = location.state?.message || "";
  const temporaryPasswordNotice = location.state?.temporaryPassword || false;

  const loginWelcomeText =
    publicSettings?.branding?.loginWelcomeText ||
    "Enter your account credentials to continue.";

  const [form, setForm] = useState({
    identifier: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState({});
  const [error, setError] = useState("");

  const errors = useMemo(() => validate(form), [form]);
  const formValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  function setField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function markTouched(name) {
    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));
  }

  function fieldError(name) {
    return touched[name] ? errors[name] : "";
  }

  function fieldClass(name) {
    return fieldError(name) ? "auth-input-error" : "";
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setTouched({
      identifier: true,
      password: true,
    });

    if (!formValid) {
      setError("Please enter your login information.");
      return;
    }

    setBusy(true);

    try {
      const payload = {
        identifier: cleanIdentifier(form.identifier),
        password: form.password,
      };

      const { data } = await api.post("/auth/login", payload, {
        withCredentials: true,
      });

   
console.log("LOGIN RESPONSE", data);
/* =====================================================
   MFA REQUIRED
===================================================== */

if (data?.mfa_required) {

  localStorage.setItem(
    "ht_mfa_required",
    "1"
  );

  localStorage.setItem(
    "ht_mfa_user_id",
    String(data.user_id)
  );

  navigate(
    "/mfa-verify",
    {
      replace: true,
      state: {
        userId: data.user_id,
      },
    }
  );

  return;
}

/* =====================================================
   TEMP PASSWORD RESET REQUIRED
===================================================== */

if (
  data?.must_change_password === true ||
  data?.requires_password_reset === true
) {

  /* =========================================
     STORE IDENTIFIER
  ========================================= */

  sessionStorage.setItem(
    "ht_reset_identifier",
    form.identifier || ""
  );

  /* =========================================
     STORE ACCESS TOKEN
  ========================================= */

  if (data?.token) {

    localStorage.setItem(
      "ht_token",
      data.token
    );
  }

  /* =========================================
     STORE USER
  ========================================= */

  if (data?.user) {

    localStorage.setItem(
      "ht_user",
      JSON.stringify(
        data.user
      )
    );
  }

  /* =========================================
     REDIRECT TO TEMP PASSWORD RESET
  ========================================= */

  navigate(
    "/reset-temp-password",
    {

      replace: true,

      state: {

        identifier:

          form.identifier ||

          data?.user?.email ||

          data?.user?.username ||

          data?.user?.member_no ||

          "",

        username:
          data?.user?.username || "",

        memberNo:
          data?.user?.member_no || "",

        fullName:
          data?.user?.full_name || "",

        requires_password_reset: true,
      },
    }
  );

  return;
}

/* =====================================================
   NORMAL LOGIN
===================================================== */

if (
  !data?.token ||
  !data?.user
) {

  throw new Error(
    "Invalid response from server."
  );
}
      if (String(data.user?.status || "").toLowerCase() === "pending") {
        throw new Error("Your account is pending approval.");
      }

      auth.setToken(data.token);
      auth.setUser(data.user);

      if (data.must_change_password || data.user?.must_change_password) {
        navigate("/reset-password-required", {
          replace: true,
          state: {
            identifier: data.user.email || form.identifier,
            username: data.user.username || "",
            memberNo: data.user.member_no || "",
          },
        });

        return;
      }

      const paymentType = location.state?.paymentType;

      if (paymentType === "membership") {
        navigate("/dash/membership/my-payments", {
          replace: true,
          state: {
            paymentType: "membership",
          },
        });

        return;
      }

      if (paymentType === "donation") {
        navigate("/dash/membership/my-payments", {
          replace: true,
          state: {
            paymentType: "donation",
          },
        });

        return;
      }

      const role = String(data.user.role || "member").toLowerCase();

      const redirectTo = location.state?.redirectTo || landingForRole(role);

      navigate(redirectTo, {
        replace: true,
      });
    } 
   catch (err) {
  console.error("Login error:", err);

  const apiError =
    err?.response?.data?.error ||
    err?.response?.data?.message;

  if (!err?.response) {
    setError(
      "Network error. Unable to connect to server."
    );
  } else if (err.response.status === 401) {
    setError(
      apiError ||
      "Incorrect username or password."
    );
  } else if (err.response.status === 403) {
    setError(
      apiError ||
      "Account access denied."
    );
  } else if (err.response.status === 423) {
    setError(
      apiError ||
      "Account temporarily locked."
    );
  } else if (err.response.status === 429) {
    setError(
      "Too many login attempts."
    );
  } else {
    setError(
      apiError ||
      "Login failed."
    );
  }
}
    
    finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card auth-card-narrow">
        <div className="auth-head">
          <h1 className="auth-head-title">Holy Trinity Portal</h1>
        </div>

        <p className="auth-sub auth-sub-centered">
          {loginWelcomeText}
          <br />
          <span className="auth-sub-small">
            Finance-created member accounts can sign in using email, username,
            or member ID.
          </span>
        </p>

        {infoMessage ? (
          <div className="auth-banner auth-banner-success" role="status">
            {infoMessage}
          </div>
        ) : null}

        {temporaryPasswordNotice ? (
          <div className="auth-banner auth-banner-success" role="status">
            Your account was created successfully. Please sign in using your
            temporary password and set a new secure password.
          </div>
        ) : null}

        {error ? (
          <div className="auth-banner" role="alert">
            {error}
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="login-identifier">
              Email, Username, or Member ID{" "}
              <span className="auth-required">*</span>
            </label>

            <input
              id="login-identifier"
              type="text"
              placeholder="Enter email, username, or member ID"
              value={form.identifier}
              onChange={(e) => setField("identifier", e.target.value)}
              onBlur={() => markTouched("identifier")}
              className={fieldClass("identifier")}
              autoComplete="username"
              required
            />

            {fieldError("identifier") ? (
              <div className="auth-field-error">{fieldError("identifier")}</div>
            ) : null}
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">
              Password <span className="auth-required">*</span>
            </label>

            <div className="auth-password-wrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                onBlur={() => markTouched("password")}
                className={fieldClass("password")}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {fieldError("password") ? (
              <div className="auth-field-error">{fieldError("password")}</div>
            ) : null}
          </div>

          <button className="auth-btn" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign In"}
          </button>

          <div className="auth-help-row">
            <Link to="/forgot-password" className="auth-link">
              Forgot your password?
            </Link>
          </div>

          <p className="auth-switch">
            Need access? Please contact the finance office.
          </p>
        </form>
      </div>
    </div>
  );
}