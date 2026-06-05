


 //frontend\src\components\Register.jsx


import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api, { getBaseURL } from "../components/api";
import { useAuth, landingForRole } from "../hooks/useAuth";
import TermsAndConditionsModal from "../components/Auth/TermsAndConditionsModal";
import RegistrationSummaryModal from "../components/Auth/RegistrationSummaryModal";
import "../styles/auth.css";

const initialForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  zip: "",
  member_type: "new",
  password: "",
  confirm_password: "",
  agree: false,
};

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhoneE164(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (raw.startsWith("+")) return raw.replace(/\s+/g, "");

  const digits = onlyDigits(raw);
  if (!digits) return "";

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8) return `+${digits}`;

  return "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function isValidPhone(value) {
  if (!value) return true;
  return /^\+[1-9]\d{7,14}$/.test(String(value || ""));
}

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

function validate(form) {
  const errors = {};
  const phone = normalizePhoneE164(form.phone);

  if (!cleanText(form.first_name)) {
    errors.first_name = "First name is required.";
  } else if (cleanText(form.first_name).length < 2) {
    errors.first_name = "First name must be at least 2 characters.";
  }

  if (!cleanText(form.last_name)) {
    errors.last_name = "Last name is required.";
  } else if (cleanText(form.last_name).length < 2) {
    errors.last_name = "Last name must be at least 2 characters.";
  }

  if (!normalizeEmail(form.email)) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(form.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (form.phone && !isValidPhone(phone)) {
    errors.phone = "Enter a valid phone number, for example +16155550123.";
  }

  if (!cleanText(form.address_line1)) {
    errors.address_line1 = "Address line 1 is required.";
  }

  if (!cleanText(form.city)) {
    errors.city = "City is required.";
  }

  if (!cleanText(form.state)) {
    errors.state = "State is required.";
  }

  if (!cleanText(form.zip)) {
    errors.zip = "ZIP code is required.";
  } else {
    const digits = onlyDigits(form.zip);
    if (!(digits.length === 5 || digits.length === 9)) {
      errors.zip = "ZIP must be 5 or 9 digits.";
    }
  }

  const checks = getPasswordChecks(form.password);
  if (!checks.length) {
    errors.password = "Password must be at least 12 characters.";
  } else if (!checks.upper) {
    errors.password = "Password must include an uppercase letter.";
  } else if (!checks.lower) {
    errors.password = "Password must include a lowercase letter.";
  } else if (!checks.number) {
    errors.password = "Password must include a number.";
  } else if (!checks.special) {
    errors.password = "Password must include a special character.";
  }

  if (!form.confirm_password) {
    errors.confirm_password = "Please confirm your password.";
  } else if (form.confirm_password !== form.password) {
    errors.confirm_password = "Passwords do not match.";
  }

  if (!form.agree) {
    errors.agree = "You must read and accept the Terms and Conditions.";
  }

  return errors;
}

function pickBaseMonthlyPlan(rows) {
  const list = Array.isArray(rows) ? rows : [];

  return (
    list.find(
      (row) =>
        Number(row.is_active ?? 1) === 1 &&
        Number(row.duration_months || 0) === 1
    ) ||
    list.find((row) => Number(row.duration_months || 0) === 1) ||
    list.find((row) => Number(row.is_active ?? 1) === 1) ||
    list[0] ||
    null
  );
}

function buildSelectedPlan(basePlan, selectedOption, selectedCustomAmount) {
  if (!basePlan) return null;

  const monthly = Number(basePlan.amount || 0);

  if (selectedOption === "6_month") {
    return {
      key: "6_month",
      title: "6-Month Plan",
      durationMonths: 6,
      amount: Number((monthly * 6).toFixed(2)),
      displayAmount: Number((monthly * 6).toFixed(2)),
      isCustom: false,
    };
  }

  if (selectedOption === "12_month") {
    return {
      key: "12_month",
      title: "12-Month Plan",
      durationMonths: 12,
      amount: Number((monthly * 12).toFixed(2)),
      displayAmount: Number((monthly * 12).toFixed(2)),
      isCustom: false,
    };
  }

  if (selectedOption === "custom") {
    const custom = Number(selectedCustomAmount || 0);
    return {
      key: "custom",
      title: "Custom Payment",
      durationMonths: 1,
      amount: Number(monthly.toFixed(2)),
      displayAmount: Number.isFinite(custom) ? custom : 0,
      isCustom: true,
    };
  }

  return {
    key: "monthly",
    title: "1-Month Plan",
    durationMonths: 1,
    amount: Number(monthly.toFixed(2)),
    displayAmount: Number(monthly.toFixed(2)),
    isCustom: false,
  };
}

export default function Register() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [searchParams] = useSearchParams();

  const selectedOption = searchParams.get("selectedOption") || "monthly";
  const selectedCustomAmount = searchParams.get("customAmount") || "";
  const memberTypeFromQuery = searchParams.get("memberType") || "new";

  const [form, setForm] = useState({
    ...initialForm,
    member_type: memberTypeFromQuery,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({});
  const [termsOpen, setTermsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [planLoading, setPlanLoading] = useState(true);
  const [basePlan, setBasePlan] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadPlans() {
      try {
        setPlanLoading(true);
        const { data } = await api.get("/dues/plans");
        if (!mounted) return;

        const monthlyBase = pickBaseMonthlyPlan(data?.rows);
        setBasePlan(monthlyBase || null);
      } catch (err) {
        console.error("Load membership plans error:", err);
        if (mounted) {
          setBasePlan(null);
        }
      } finally {
        if (mounted) setPlanLoading(false);
      }
    }

    loadPlans();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedPlan = useMemo(
    () => buildSelectedPlan(basePlan, selectedOption, selectedCustomAmount),
    [basePlan, selectedOption, selectedCustomAmount]
  );

  const registrationFee = useMemo(() => {
    if (!basePlan) return 0;
    if (String(form.member_type || "").toLowerCase() !== "new") return 0;
    return Number(basePlan.registration_fee || 0);
  }, [basePlan, form.member_type]);

  const errors = useMemo(() => validate(form), [form]);
  const passwordChecks = useMemo(
    () => getPasswordChecks(form.password),
    [form.password]
  );
  const strength = useMemo(
    () => passwordStrengthLabel(form.password),
    [form.password]
  );

  const formValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function markTouched(name) {
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  function fieldError(name) {
    return touched[name] ? errors[name] : "";
  }

  function fieldClass(name) {
    return fieldError(name) ? "auth-input-error" : "";
  }

  function goBackToPlanSelection() {
    const params = new URLSearchParams({
      type: form.member_type || "new",
      selectedOption,
    });

    if (selectedOption === "custom" && selectedCustomAmount) {
      params.set("customAmount", selectedCustomAmount);
    }

    navigate(`/membership/select-plan?${params.toString()}`);
  }

  function openSummary(e) {
    e.preventDefault();
    setError("");

    const nextTouched = {
      first_name: true,
      last_name: true,
      email: true,
      phone: true,
      address_line1: true,
      city: true,
      state: true,
      zip: true,
      password: true,
      confirm_password: true,
      agree: true,
    };
    setTouched(nextTouched);

    if (!formValid) {
      setError("Please correct the required fields and try again.");
      return;
    }

    if (!basePlan || !selectedPlan) {
      setError(
        "No active 1-month membership plan is configured. Please select a plan first."
      );
      return;
    }

    if (selectedPlan.isCustom) {
      const custom = Number(selectedCustomAmount || 0);
      const minimum = Number(basePlan.amount || 0);

      if (!Number.isFinite(custom) || custom <= minimum) {
        setError(
          `Custom payment must be greater than $${minimum.toFixed(2)}.`
        );
        return;
      }
    }

    setSummaryOpen(true);
  }

  async function handleConfirmedSubmit() {
    setSummaryOpen(false);
    setBusy(true);
    setError("");

    try {
      const payload = {
        first_name: cleanText(form.first_name),
        last_name: cleanText(form.last_name),
        email: normalizeEmail(form.email),
        phone: normalizePhoneE164(form.phone) || null,
        address_line1: cleanText(form.address_line1),
        address_line2: cleanText(form.address_line2) || null,
        city: cleanText(form.city),
        state: cleanText(form.state),
        zip: cleanText(form.zip),
        member_type: form.member_type,
        password: form.password,
        confirm_password: form.confirm_password,
        agree: form.agree,
        success_url: `${window.location.origin}/dash/membership?status=registration-payment-success`,
        cancel_url: `${window.location.origin}/register?cancelled=1`,
      };

      const { data } = await api.post("/auth/register", payload, {
        withCredentials: true,
      });

      if (data?.token) auth?.setToken?.(data.token);
      if (data?.user) auth?.setUser?.(data.user || null);

      if (data?.requires_plan_selection && data?.member_id) {
        const params = new URLSearchParams({
          memberId: String(data.member_id),
          userId: String(data.user_id || ""),
          type: form.member_type,
          selectedOption,
        });

        if (selectedPlan?.isCustom && selectedCustomAmount) {
          params.set("customAmount", selectedCustomAmount);
        }

        navigate(`/membership/select-plan?${params.toString()}`, {
          replace: true,
        });
        return;
      }

      if (data?.token) {
        navigate(landingForRole(data.user?.role || "member"), {
          replace: true,
        });
        return;
      }

      throw new Error("Invalid response from server.");
    } catch (err) {
      console.error("Register error:", err);

      if (!err.response) {
        setError(
          `Cannot reach the API. Check that the backend is running at ${getBaseURL()} and CORS is configured correctly.`
        );
      } else if (err.response.status === 409) {
        setError("An account with this email already exists.");
      } else if (err.response.status === 429) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            "Registration failed."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <h1 className="auth-head-title">Create Your Account</h1>
        </div>

        <p className="auth-sub auth-sub-centered">
          Complete the required fields below to register securely.
        </p>

        {!planLoading && selectedPlan ? (
          <div className="auth-banner auth-banner-success" role="status">
            Selected plan: <strong>{selectedPlan.title}</strong>
            {" • "}
            Membership fee:{" "}
            <strong>${Number(selectedPlan.displayAmount || 0).toFixed(2)}</strong>
            {" • "}
            Registration fee: <strong>${registrationFee.toFixed(2)}</strong>
          </div>
        ) : null}

        {planLoading ? (
          <div className="auth-banner auth-banner-success" role="status">
            Loading current membership plan...
          </div>
        ) : null}

        {error ? (
          <div className="auth-banner" role="alert">
            {error}
          </div>
        ) : null}

        <form className="auth-form" onSubmit={openSummary} noValidate>
          <div className="auth-grid-2">
            <div className="auth-field">
              <label htmlFor="first_name">
                First Name <span className="auth-required">*</span>
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                placeholder="Enter your first name"
                value={form.first_name}
                onChange={(e) => setField("first_name", e.target.value)}
                onBlur={() => markTouched("first_name")}
                className={fieldClass("first_name")}
                autoComplete="given-name"
                maxLength={100}
                required
              />
              {fieldError("first_name") ? (
                <div className="auth-field-error">{fieldError("first_name")}</div>
              ) : null}
            </div>

            <div className="auth-field">
              <label htmlFor="last_name">
                Last Name <span className="auth-required">*</span>
              </label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                placeholder="Enter your last name"
                value={form.last_name}
                onChange={(e) => setField("last_name", e.target.value)}
                onBlur={() => markTouched("last_name")}
                className={fieldClass("last_name")}
                autoComplete="family-name"
                maxLength={100}
                required
              />
              {fieldError("last_name") ? (
                <div className="auth-field-error">{fieldError("last_name")}</div>
              ) : null}
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="auth-field">
              <label htmlFor="email">
                Email Address <span className="auth-required">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email address"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                onBlur={() => markTouched("email")}
                className={fieldClass("email")}
                autoComplete="email"
                maxLength={190}
                required
              />
              {fieldError("email") ? (
                <div className="auth-field-error">{fieldError("email")}</div>
              ) : null}
            </div>

            <div className="auth-field">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="Optional, for example +16155550123"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                onBlur={() => markTouched("phone")}
                className={fieldClass("phone")}
                autoComplete="tel"
                maxLength={20}
              />
              {fieldError("phone") ? (
                <div className="auth-field-error">{fieldError("phone")}</div>
              ) : null}
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="auth-field">
              <label htmlFor="zip">
                ZIP Code <span className="auth-required">*</span>
              </label>
              <input
                id="zip"
                name="zip"
                type="text"
                placeholder="Enter your ZIP code"
                value={form.zip}
                onChange={(e) => setField("zip", e.target.value)}
                onBlur={() => markTouched("zip")}
                className={fieldClass("zip")}
                autoComplete="postal-code"
                maxLength={10}
                required
              />
              {fieldError("zip") ? (
                <div className="auth-field-error">{fieldError("zip")}</div>
              ) : null}
            </div>

            <div className="auth-field">
              <label htmlFor="city">
                City <span className="auth-required">*</span>
              </label>
              <input
                id="city"
                name="city"
                type="text"
                placeholder="Enter your city"
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
                onBlur={() => markTouched("city")}
                className={fieldClass("city")}
                autoComplete="address-level2"
                maxLength={100}
                required
              />
              {fieldError("city") ? (
                <div className="auth-field-error">{fieldError("city")}</div>
              ) : null}
            </div>
          </div>

          <div className="auth-grid-2">
            <div className="auth-field">
              <label htmlFor="state">
                State <span className="auth-required">*</span>
              </label>
              <input
                id="state"
                name="state"
                type="text"
                placeholder="Enter your state"
                value={form.state}
                onChange={(e) => setField("state", e.target.value)}
                onBlur={() => markTouched("state")}
                className={fieldClass("state")}
                autoComplete="address-level1"
                maxLength={80}
                required
              />
              {fieldError("state") ? (
                <div className="auth-field-error">{fieldError("state")}</div>
              ) : null}
            </div>

            <div className="auth-field">
              <label htmlFor="address_line1">
                Address Line 1 <span className="auth-required">*</span>
              </label>
              <input
                id="address_line1"
                name="address_line1"
                type="text"
                placeholder="Enter your street address"
                value={form.address_line1}
                onChange={(e) => setField("address_line1", e.target.value)}
                onBlur={() => markTouched("address_line1")}
                className={fieldClass("address_line1")}
                autoComplete="address-line1"
                maxLength={200}
                required
              />
              {fieldError("address_line1") ? (
                <div className="auth-field-error">{fieldError("address_line1")}</div>
              ) : null}
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="address_line2">Address Line 2</label>
            <input
              id="address_line2"
              name="address_line2"
              type="text"
              placeholder="Apartment, suite, unit, or building"
              value={form.address_line2}
              onChange={(e) => setField("address_line2", e.target.value)}
              autoComplete="address-line2"
              maxLength={200}
            />
          </div>

          <div className="auth-grid-2">
            <div className="auth-field">
              <label htmlFor="password">
                Password <span className="auth-required">*</span>
              </label>
              <div className="auth-password-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  onBlur={() => markTouched("password")}
                  className={fieldClass("password")}
                  autoComplete="new-password"
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

              <div className="auth-password-meter">
                <div className={`auth-password-strength auth-strength-${strength}`}>
                  Strength: {strength.charAt(0).toUpperCase() + strength.slice(1)}
                </div>

                <ul className="auth-password-checks">
                  <li className={passwordChecks.length ? "ok" : "bad"}>
                    12+ characters
                  </li>
                  <li className={passwordChecks.upper ? "ok" : "bad"}>
                    Uppercase
                  </li>
                  <li className={passwordChecks.lower ? "ok" : "bad"}>
                    Lowercase
                  </li>
                  <li className={passwordChecks.number ? "ok" : "bad"}>
                    Number
                  </li>
                  <li className={passwordChecks.special ? "ok" : "bad"}>
                    Special character
                  </li>
                </ul>
              </div>

              {fieldError("password") ? (
                <div className="auth-field-error">{fieldError("password")}</div>
              ) : null}
            </div>

            <div className="auth-field">
              <label htmlFor="confirm_password">
                Confirm Password <span className="auth-required">*</span>
              </label>
              <div className="auth-password-wrap">
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={form.confirm_password}
                  onChange={(e) => setField("confirm_password", e.target.value)}
                  onBlur={() => markTouched("confirm_password")}
                  className={fieldClass("confirm_password")}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {fieldError("confirm_password") ? (
                <div className="auth-field-error">
                  {fieldError("confirm_password")}
                </div>
              ) : null}
            </div>
          </div>

          <div className="auth-terms">
            <label className="terms-check">
              <input
                type="checkbox"
                checked={form.agree}
                onChange={(e) => setField("agree", e.target.checked)}
                onBlur={() => markTouched("agree")}
              />
              <span>
                I have read and agree to the Terms and Conditions
                <span className="auth-required"> *</span>
              </span>
            </label>

            <button
              type="button"
              className="terms-readmore"
              onClick={() => setTermsOpen(true)}
            >
              Read Terms
            </button>
          </div>

          {fieldError("agree") ? (
            <div className="auth-field-error" style={{ marginTop: 6 }}>
              {fieldError("agree")}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              className="auth-btn"
              type="submit"
              disabled={busy || planLoading}
            >
              {busy ? "Submitting..." : "Continue Registration"}
            </button>

            <button
              type="button"
              className="payments-secondary-btn"
              onClick={goBackToPlanSelection}
            >
              Change Selected Plan
            </button>
          </div>

          <p className="auth-switch">
            Already have an account?{" "}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </form>
      </div>

      <TermsAndConditionsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        onAccept={() => {
          setField("agree", true);
          setTouched((prev) => ({ ...prev, agree: true }));
          setTermsOpen(false);
        }}
      />

      <RegistrationSummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        onContinue={handleConfirmedSubmit}
        memberType={form.member_type}
        selectedPlan={selectedPlan}
        registrationFee={registrationFee}
        agreed={form.agree}
      />
    </div>
  );
}

