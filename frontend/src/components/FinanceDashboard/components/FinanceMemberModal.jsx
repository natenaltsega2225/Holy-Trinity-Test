// frontend/src/components/FinanceDashboard/components/FinanceMemberModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import { useAuth } from "../../../hooks/useAuth";
import LinkedAccessAccountModal from "./LinkedAccessAccountModal";

const emptyForm = {
  first_name: "",
  last_name: "",
  full_name: "",
  email: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  zip: "",
  status: "active",
  membership_status: "active",
  is_active: "1",
  open_balance: "0",
  total_paid: "0",
  notes: "",

  plan_id: "",
  membership_start_month: "",
membership_end_month: "",
  amount_paid: "",

  payment_method: "stripe_card",

  reference_no: "",

  emergency_contact: "",

  gender: "",

  date_of_birth: "",

  auto_renew: false,

  cover_processing_fee: false,
};
const emptyDependent = {
  first_name: "",
  last_name: "",
  relationship: "",
  dependent_type: "dependent",
  gender: "",
  date_of_birth: "",
  email: "",
  phone: "",
  status: "active",
  is_active: 1,
  notes: "",
};

function clean(value) {
  return String(value || "").trim();
}

function validateName(value) {
  return /^[A-Za-z][A-Za-z\s'-]{0,99}$/.test(clean(value));
}

function validateEmail(value) {
  if (!clean(value)) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function validatePhone(value) {
  if (!clean(value)) return true;
  return /^[0-9+\-().\s]{7,25}$/.test(clean(value));
}
function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function num(value) {
  const n = Number(value || 0);

  return Number.isFinite(n)
    ? n
    : 0;
}

function normalizeOption(value) {
  const v = String(
    value || "monthly"
  ).toLowerCase();

  if (
    [
      "monthly",
      "3_month",
      "6_month",
      "12_month",
    ].includes(v)
  ) {
    return v;
  }

  return "monthly";
}

function planLabel(plan) {
  return (
    plan?.plan_name ||
    plan?.name ||
    "Membership Plan"
  );
}

function getPlanAmount(plan) {
  return num(
    plan?.minimum_amount ??
      plan?.amount ??
      plan?.price ??
      plan?.dues_amount
  );
}

function getRegistrationFee(plan) {
  return num(
    plan?.registration_fee ??
      plan?.registration_amount ??
      plan?.first_time_fee ??
      0
  );
}

function calculateProcessingFee(
  amount,
  enabled
) {
  if (!enabled) return 0;

  return Number(
    (
      (amount * 0.029 + 0.3) /
      (1 - 0.029)
    ).toFixed(2)
  );
}
function getPaymentSummary(form, plan) {

  const membershipAmount =
    Number(form.amount_paid || 0);

  const registrationFee =
    Number(
      plan?.registration_fee || 0
    );

  const subtotal =
    membershipAmount +
    registrationFee;

  const processingFee =
    form.cover_processing_fee
      ? Number(
          (
            (subtotal * 0.029 + 0.3) /
            (1 - 0.029)
          ).toFixed(2)
        )
      : 0;

  const total =
    subtotal + processingFee;

  return {
    membershipAmount,
    registrationFee,
    processingFee,
    subtotal,
    total,
  };
}

function getAge(value) {
  if (!value) return "--";

  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) return "--";

  const today = new Date();

  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dob.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : "--";
}

function formatDate(value) {
  if (!value) return "--";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";

  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function buildFullName(form) {

  const first =
    clean(form.first_name);

  const last =
    clean(form.last_name);

  const combined =
    `${first} ${last}`.trim();

  if (combined) {
    return combined;
  }

  const emailPrefix =
    clean(form.email)
      .split("@")[0];

  return emailPrefix || "";
}

function isStripePaymentMethod(value) {
  const method = String(value || "").trim().toLowerCase();

  return (
    method === "stripe_card" ||
    method === "stripe_ach" ||
    method === "card" ||
    method === "ach"
  );
}

function normalizeStripeMethod(value) {
  const method = String(value || "").trim().toLowerCase();

  if (method === "stripe_ach" || method === "ach") {
    return "stripe_ach";
  }

  return "stripe_card";
}

function normalizeManualMethod(value) {
  const method = String(value || "").trim().toLowerCase();

  if (method === "bank_deposit") return "bank_deposit";
  if (method === "check") return "check";
  if (method === "zelle") return "zelle";
  if (method === "cash") return "cash";
  if (method === "other") return "other";

  return method || "manual";
}

function validateMember(form, mode) {
  const errors = {};

  if (!clean(form.first_name)) {
    errors.first_name = "First name is required.";
  } else if (!validateName(form.first_name)) {
    errors.first_name = "First name must contain letters only.";
  }

  if (!clean(form.last_name)) {
    errors.last_name = "Last name is required.";
  } else if (!validateName(form.last_name)) {
    errors.last_name = "Last name must contain letters only.";
  }

  if (!clean(form.email)) {
    errors.email = "Email is required.";
  } else if (!validateEmail(form.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!validatePhone(form.phone)) {
    errors.phone = "Enter a valid phone number.";
  }

  if (mode === "register") {
    if (!clean(form.plan_id)) {
      errors.plan_id = "Membership plan is required.";
    }

    if (!clean(form.membership_start_month)) {
      errors.membership_start_month = "Start month is required.";
    }

    const amount = Number(form.amount_paid || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount_paid = "Amount paid must be greater than zero.";
    }

    if (!clean(form.payment_method)) {
      errors.payment_method = "Payment method is required.";
    }
  }

  return errors;
}

function validateDependent(form) {
  const errors = {};

  if (!clean(form.first_name)) {
    errors.first_name = "First name is required.";
  } else if (!validateName(form.first_name)) {
    errors.first_name = "First name must contain letters only.";
  }

  if (!clean(form.last_name)) {
    errors.last_name = "Last name is required.";
  } else if (!validateName(form.last_name)) {
    errors.last_name = "Last name must contain letters only.";
  }

  if (!clean(form.relationship)) {
    errors.relationship = "Relationship is required.";
  }

  if (!form.date_of_birth) {
    errors.date_of_birth = "Date of birth is required.";
  }

  if (clean(form.email) && !validateEmail(form.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (clean(form.phone) && !validatePhone(form.phone)) {
    errors.phone = "Enter a valid phone number.";
  }

  return errors;
}

function ErrorText({ text }) {
  return text ? <div className="finance-field-error">{text}</div> : null;
}

export default function FinanceMemberModal({
  open,
  onClose,
  onSaved,
  onSuccess,
  row = null,
  memberId = null,
  mode = "create",
}) {
  const resolvedMemberId = memberId || row?.id || null;

  const resolvedMode =
    mode === "register"
      ? "register"
      : row || resolvedMemberId
      ? "edit"
      : "register";

  const isEdit = resolvedMode === "edit" && resolvedMemberId;

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [dependents, setDependents] = useState([]);
  const [dependentForm, setDependentForm] = useState(emptyDependent);
  const [dependentErrors, setDependentErrors] = useState({});
  const [editingDependentId, setEditingDependentId] = useState(null);
  const [savingDependent, setSavingDependent] = useState(false);

  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [linkedModalOpen, setLinkedModalOpen] = useState(false);
const [dependentModalOpen, setDependentModalOpen] = useState(false);
  const auth = useAuth();

  const isAdmin =
    auth?.user?.role === "admin" || auth?.user?.role === "super_admin";
const selectedPlan = useMemo(() => {
  return plans.find(
    (p) =>
      String(p.id) ===
      String(form.plan_id)
  );
}, [plans, form.plan_id]);

const billingOption =
  useMemo(() => {
    return normalizeOption(
      selectedPlan?.billing_cycle
    );
  }, [selectedPlan]);

const paymentSummary =
  useMemo(() => {
    return getPaymentSummary(
      form,
      selectedPlan
    );
  }, [form, selectedPlan]);

/* =====================================================
   AUTO CALCULATE MEMBERSHIP END MONTH
===================================================== */

useEffect(() => {

  if (
    !form.membership_start_month
  ) {
    return;
  }

  const durationMonths =
    Number(
      selectedPlan?.duration_months || 1
    );

  const endMonth =
    calculateCoverageEndMonth(
      form.membership_start_month,
      durationMonths
    );

  setForm((prev) => ({

    ...prev,

    membership_end_month:
      endMonth,
  }));

}, [
  form.membership_start_month,
  selectedPlan,
]);

/* =====================================================
   AUTO BUILD FULL NAME
===================================================== */

useEffect(() => {

  const first =
    clean(form.first_name);

  const last =
    clean(form.last_name);

  const combined =
    `${first} ${last}`.trim();

  setForm((prev) => ({

    ...prev,

    full_name:
      combined ||
      (
        clean(prev.email)
          .split("@")[0]
      ) ||
      "",
  }));

}, [
  form.first_name,
  form.last_name,
  form.email,
]);

const summary = useMemo(() => {

  const activeDependents =
    dependents.filter(
      (d) =>
        Number(d.is_active ?? 1) === 1 &&
        String(d.status || "").toLowerCase() === "active"
    ).length;

  const selectedPlan =
    plans.find(
      (p) =>
        String(p.id) ===
        String(form.plan_id)
    );

  return {

    fullName:
      buildFullName(form) ||
      "New Member",

    dependents:
      activeDependents,

    household:
      activeDependents + 1,

    selectedPlan,
  };

}, [
  form,
  dependents,
  plans,
]);

  async function loadPlans() {
    try {
      const { data } = await api.get("/dues/plans");
      setPlans(Array.isArray(data?.rows) ? data.rows : []);
    } catch {
      setPlans([]);
    }
  }



  async function loadMember() {
    if (!resolvedMemberId || resolvedMode === "register") {
      setForm({
        ...emptyForm,
        first_name: row?.first_name || "",
        last_name: row?.last_name || "",
        full_name: row?.full_name || "",
        email: row?.email || "",
        phone: row?.phone || "",
      });

      setDependents([]);
      setLinkedAccounts([]);
      setErrors({});
      setErr("");
      return;
    }

    try {
      setLoading(true);
      setErr("");

      const { data } = await api.get(`/finance/members/${resolvedMemberId}`);

      const r = data?.row || row || {};

      setForm({
        ...emptyForm,
        first_name: r.first_name || "",
        last_name: r.last_name || "",
        full_name: r.full_name || "",
        email: r.email || "",
        phone: r.phone || "",
        address_line1: r.address_line1 || r.address_line_1 || "",
        address_line2: r.address_line2 || r.address_line_2 || "",
        city: r.city || "",
        state: r.state || "",
        zip: r.zip || r.zip_code || "",
        status: r.status || "active",
        membership_status: r.membership_status || "active",
        is_active: String(Number(r.is_active ?? 1)),
        open_balance: String(r.open_balance ?? 0),
        total_paid: String(r.total_paid ?? 0),
        notes: r.notes || "",
        gender: r.gender || "",
        date_of_birth: r.date_of_birth
          ? String(r.date_of_birth).slice(0, 10)
          : "",
        emergency_contact: r.emergency_contact || "",
      });

      setDependents(Array.isArray(data?.dependents) ? data.dependents : []);
      setLinkedAccounts(
        Array.isArray(data?.linkedAccounts) ? data.linkedAccounts : []
      );
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to load member.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    loadPlans();
    loadMember();

    setDependentForm(emptyDependent);
    setDependentErrors({});
    setEditingDependentId(null);
  }, [open, resolvedMemberId, resolvedMode]);

  if (!open) return null;

  function finishSuccess(payload) {
    onSuccess?.(payload);
    onSaved?.(payload);
  }

  function upd(key, value) {
    setForm((s) => ({
      ...s,
      [key]: value,
    }));
  }

  function updDependent(key, value) {
    setDependentForm((s) => ({
      ...s,
      [key]: value,
    }));
  }

  async function reloadLinkedAccounts() {
    if (!resolvedMemberId) return;

    const { data } = await api.get(`/finance/members/${resolvedMemberId}`);

    setLinkedAccounts(
      Array.isArray(data?.linkedAccounts) ? data.linkedAccounts : []
    );
  }

  async function reloadDependents() {
    if (!resolvedMemberId) return;

    const { data } = await api.get(`/finance/members/${resolvedMemberId}`);

    setDependents(Array.isArray(data?.dependents) ? data.dependents : []);
  }

function calculateCoverageEndMonth(
  startMonth,
  durationMonths
) {

  if (!startMonth) {
    return "";
  }

  const [year, month] =
    String(startMonth)
      .split("-")
      .map(Number);

  if (!year || !month) {
    return "";
  }

  const totalMonths =
    (year * 12 + (month - 1)) +
    Number(durationMonths || 1) -
    1;

  const endYear =
    Math.floor(totalMonths / 12);

  const endMonth =
    String(
      (totalMonths % 12) + 1
    ).padStart(2, "0");

  return `${endYear}-${endMonth}`;
}
async function submit(e) {

  e.preventDefault();

  setErr("");

  const nextErrors =
    validateMember(
      form,
      resolvedMode
    );

  setErrors(nextErrors);

  if (
    Object.keys(nextErrors).length
  ) {
    return;
  }

  setBusy(true);

  try {

    const fullName =
      buildFullName(form);

    const selectedPlan =
      plans.find(
        (p) =>
          String(p.id) ===
          String(form.plan_id)
      );

    const method =
      String(
        form.payment_method || ""
      )
        .trim()
        .toLowerCase();

    const durationMonths =
      Number(
        selectedPlan?.duration_months || 1
      );

    const paymentMethodType =
      method.includes("ach")
        ? "ach"
        : "card";
const coverageEndMonth =
  calculateCoverageEndMonth(
    form.membership_start_month,
    durationMonths
  );

const coverageLabel =
  `${form.membership_start_month} → ${coverageEndMonth}`;
    const payload = {

      ...form,

      /* =====================================================
         MEMBER
      ===================================================== */

      full_name:
        fullName,

      email:
        clean(form.email)
          .toLowerCase(),

      phone:
        clean(form.phone),

      is_active:
        Number(
          form.is_active || 0
        ),

      address_line_1:
        form.address_line1 ||
        null,

      address_line_2:
        form.address_line2 ||
        null,

      city:
        form.city || null,

      state:
        form.state || null,

      zip_code:
        form.zip || null,

      country:
        "USA",

      /* =====================================================
         PAYMENT TOTALS
      ===================================================== */
membership_end_month:
  coverageEndMonth,

coverage_end_month:
  coverageEndMonth,
      membership_amount:
        paymentSummary.membershipAmount,

      registration_fee:
        paymentSummary.registrationFee,

      processing_fee:
        isStripePaymentMethod(method)
          ? paymentSummary.processingFee
          : 0,

      subtotal_amount:
        paymentSummary.subtotal,

      amount_paid:
        paymentSummary.membershipAmount,

      amount:
        paymentSummary.total,

      total_amount:
        paymentSummary.total,

      /* =====================================================
         PAYMENT OPTIONS
      ===================================================== */

      payment_method_type:
        paymentMethodType,

      cover_processing_fee:
        form.cover_processing_fee,

      auto_renew:
        isStripePaymentMethod(method)
          ? form.auto_renew
          : false,

      payment_method:
        method,

      method:
        method,

      /* =====================================================
         MEMBERSHIP
      ===================================================== */

      plan_id:
        form.plan_id,

      dues_plan_id:
        form.plan_id,

      plan_name:
        selectedPlan?.plan_name ||
        "",

      months_paid:
        durationMonths,

      duration_months:
        durationMonths,

      membership_start_month:
        form.membership_start_month,

      coverage_label:
        coverageLabel,

      coverage_start_month:
        form.membership_start_month,

      /* =====================================================
         PAYMENT CATEGORY
      ===================================================== */

      payment_type:
        "membership",

      category:
        "membership",

      source:
        "finance",

      created_from:
        "finance_registration",

      /* =====================================================
         EXTRA DETAILS
      ===================================================== */

      reference_no:
        form.reference_no ||
        null,

      emergency_contact:
        form.emergency_contact ||
        null,

      gender:
        form.gender || null,

      date_of_birth:
        form.date_of_birth ||
        null,

      /* =====================================================
         EMAIL + DOCUMENT FLOW
      ===================================================== */

      send_welcome_email:
        true,

      send_receipt_email:
        true,

      create_invoice:
        true,

      create_ledger_entry:
        true,

      create_member_after_payment:
        true,
    };

    let result;

    /* =====================================================
       EDIT MEMBER
    ===================================================== */

    if (isEdit) {

      result =
        await api.put(
          `/finance/members/${resolvedMemberId}`,
          payload
        );

      finishSuccess(
        result?.data
      );

      onClose?.();

      return;
    }

    /* =====================================================
       STRIPE FLOW
    ===================================================== */

    if (
      isStripePaymentMethod(method)
    ) {

      const stripePaymentMethod =
        normalizeStripeMethod(
          method
        );

      const checkoutPayload = {

        ...payload,

        payment_method:
          stripePaymentMethod,

        method:
          stripePaymentMethod,

        provider:
          "stripe",

        success_url:
          `${window.location.origin}/dash/finance/members?registration=success&member_created=true&session_id={CHECKOUT_SESSION_ID}`,

        cancel_url:
          `${window.location.origin}/dash/finance/members?registration=cancelled`,
      };

      const { data } =
        await api.post(
          "/finance/create-registration-checkout",
          checkoutPayload
        );

      const checkoutUrl =

        data?.checkout_url ||

        data?.url ||

        data?.stripe_url;

      if (!checkoutUrl) {

        throw new Error(
          "Stripe checkout URL missing."
        );
      }

      window.location.href =
        checkoutUrl;

      return;
    }

    /* =====================================================
       MANUAL PAYMENT
    ===================================================== */

    const manualMethod =
      normalizeManualMethod(
        method
      );

    result =
      await api.post(
        "/finance/register-new-member",
        {

          ...payload,

          payment_method:
            manualMethod,

          method:
            manualMethod,
provider: "manual",

          status:
            "paid",

          payment_status:
            "paid",
        }
      );

    finishSuccess(
      result?.data
    );

    onClose?.();

  } catch (e2) {

    console.error(
      "Finance member registration failed:",
      e2
    );

    setErr(

      e2?.response?.data?.error ||

      e2?.response?.data?.message ||

      e2?.message ||

      "Failed to save member."
    );

    if (
      e2?.response?.data?.errors
    ) {

      setErrors(
        e2.response.data.errors
      );
    }

  } finally {

    setBusy(false);
  }
}

  function resetDependentForm() {
    setEditingDependentId(null);
    setDependentForm(emptyDependent);
    setDependentErrors({});
  }

  function startEditDependent(dep) {
    setEditingDependentId(dep.id);
setDependentModalOpen(true);
    setDependentForm({
      first_name: dep.first_name || "",
      last_name: dep.last_name || "",
      relationship: dep.relationship || "",
      dependent_type: dep.dependent_type || "dependent",
      gender: dep.gender || "",
      date_of_birth: dep.date_of_birth
        ? String(dep.date_of_birth).slice(0, 10)
        : "",
      email: dep.email || "",
      phone: dep.phone || "",
      status: dep.status || "active",
      is_active: Number(dep.is_active ?? 1),
      notes: dep.notes || "",
    });

    setDependentErrors({});
  }

 async function saveDependent() {

  if (!resolvedMemberId) {

    setErr(
      "Save the member first before adding dependents."
    );

    return;
  }

  const nextErrors =
    validateDependent(
      dependentForm
    );

  setDependentErrors(
    nextErrors
  );

  if (
    Object.keys(nextErrors).length
  ) {
    return;
  }

  try {

    setSavingDependent(true);

    setErr("");

    const payload = {

      ...dependentForm,

      first_name:
        clean(
          dependentForm.first_name
        ),

      last_name:
        clean(
          dependentForm.last_name
        ),

      relationship:
        clean(
          dependentForm.relationship
        ),

      email:
        clean(
          dependentForm.email
        ).toLowerCase(),

      phone:
        clean(
          dependentForm.phone
        ),

      notes:
        clean(
          dependentForm.notes
        ),

      is_active:
        Number(
          dependentForm.is_active ?? 1
        ),
    };

    /* =========================================
       UPDATE EXISTING DEPENDENT
    ========================================= */

    if (editingDependentId) {

      await api.put(

        `/finance/members/${resolvedMemberId}/dependents/${editingDependentId}`,

        payload
      );

    } else {

      /* =========================================
         CREATE NEW DEPENDENT
      ========================================= */

      await api.post(

        `/finance/members/${resolvedMemberId}/dependents`,

        payload
      );
    }

    /* =========================================
       RELOAD MEMBER + DEPENDENTS
    ========================================= */

    await loadMember();

    /* =========================================
       RESET + CLOSE MODAL
    ========================================= */

    resetDependentForm();

    setDependentModalOpen(false);

    finishSuccess({

      type:
        editingDependentId
          ? "dependent_updated"
          : "dependent_created",
    });

  } catch (e) {

    console.error(
      "Save dependent failed:",
      e
    );

    setErr(

      e?.response?.data?.error ||

      e?.response?.data?.message ||

      "Failed to save dependent."
    );

    if (
      e?.response?.data?.errors
    ) {

      setDependentErrors(
        e.response.data.errors
      );
    }

  } finally {

    setSavingDependent(false);
  }
}

async function deleteDependent(dep) {

  if (
    !resolvedMemberId ||
    !dep?.id
  ) {
    return;
  }

  const dependentName =

    dep.full_name ||

    `${dep.first_name || ""} ${dep.last_name || ""}`.trim() ||

    "this dependent";

  const confirmed =
    window.confirm(

      `Delete dependent "${dependentName}"?`
    );

  if (!confirmed) {
    return;
  }

  try {

    setErr("");

    await api.delete(

      `/finance/members/${resolvedMemberId}/dependents/${dep.id}`
    );

    /* =========================================
       RELOAD MEMBER + DEPENDENTS
    ========================================= */

    await loadMember();

    /* =========================================
       RESET FORM
    ========================================= */

    resetDependentForm();

    finishSuccess({
      type: "dependent_deleted",
    });

  } catch (e) {

    console.error(
      "Delete dependent failed:",
      e
    );

    setErr(

      e?.response?.data?.error ||

      e?.response?.data?.message ||

      "Failed to delete dependent."
    );
  }
}
  async function toggleLinkedAccount(account) {
    try {
      await api.patch(`/admin/accounts/${account.id}/status`, {
        is_active: Number(account.is_active) === 1 ? 0 : 1,
      });

      await reloadLinkedAccounts();
      finishSuccess();
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to update linked account.");
    }
  }

  return (
    <>
      <div
        className="finance-member-modal-overlay"
        role="dialog"
        aria-modal="true"
      >
        <div className="finance-member-modal">
          <div className="finance-member-modal-head">
            <div>
              <p className="finance-modal-eyebrow">Finance Member</p>

              <h2>
                {isEdit ? "Edit Member Profile" : "Register New Member"}
              </h2>

              <p>
                {isEdit
                  ? "Manage member identity, household dependents, and linked access accounts."
                  : "Create a member registration, route card/ACH through Stripe, or record manual in-person payment."}
              </p>
            </div>

            <button
              type="button"
              className="finance-modal-close"
              onClick={onClose}
              disabled={busy}
            >
              ✕
            </button>
          </div>

          <div className="finance-member-modal-summary">
            <div>
              <span>Member</span>
              <strong>{summary.fullName}</strong>
            </div>

            <div>
              <span>Status</span>
              <strong>{form.membership_status || "--"}</strong>
            </div>

            <div>
              <span>Plan</span>
              <strong>{summary.selectedPlan?.plan_name || "--"}</strong>
            </div>

            <div>
              <span>Payment</span>
             <strong>
  {money(
    paymentSummary.total
  )}
</strong>
            </div>
          </div>

          {err ? (
            <div className="finance-alert finance-alert-error">{err}</div>
          ) : null}

          {loading ? (
            <section className="finance-card finance-loading-card">
              Loading member...
            </section>
          ) : (
            <form className="finance-member-modal-body" onSubmit={submit}>




              <section className="finance-member-section">
                <div className="finance-section-head">
                  <div>
                    <h3 className="finance-section-title">
                      Member Information
                    </h3>

                    <p className="finance-section-subtitle">
                      Primary details used for billing, receipts, login access,
                      and member search.
                    </p>
                  </div>
                </div>

                <div className="finance-modal-grid finance-modal-grid-2">
                  <div className="finance-field">
                    <label>First Name *</label>

              <input
  value={form.first_name}
  onChange={(e) =>
    upd(
      "first_name",
      e.target.value
    )
  }
/>

                    <ErrorText text={errors.first_name} />
                  </div>

                  <div className="finance-field">
                    <label>Last Name *</label>

                    <input
                      value={form.last_name}
                      onChange={(e) => upd("last_name", e.target.value)}
                    />

                    <ErrorText text={errors.last_name} />
                  </div>

                  <div className="finance-field">
                    <label>Full Name</label>
<input
  value={form.full_name}
  readOnly
  className="finance-readonly-field"
  placeholder="Auto-generated from first and last name"
/>
                  </div>

                  <div className="finance-field">
                    <label>Email *</label>

                    <input
                      value={form.email}
                      onChange={(e) => upd("email", e.target.value)}
                    />

                    <ErrorText text={errors.email} />
                  </div>

                  <div className="finance-field">
                    <label>Phone</label>

                    <input
                      value={form.phone}
                      onChange={(e) => upd("phone", e.target.value)}
                    />

                    <ErrorText text={errors.phone} />
                  </div>

                  <div className="finance-field">
                    <label>Gender</label>

                    <select
                      value={form.gender}
                      onChange={(e) => upd("gender", e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>

                  <div className="finance-field">
                    <label>Date of Birth</label>

                    <input
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => upd("date_of_birth", e.target.value)}
                    />
                  </div>

                  <div className="finance-field">
                    <label>Emergency Contact</label>

                    <input
                      value={form.emergency_contact}
                      onChange={(e) => upd("emergency_contact", e.target.value)}
                    />
                  </div>
                </div>
              </section>
<section className="finance-member-section">

  <div className="finance-section-head">

    <div>
      <h3 className="finance-section-title">
        Address Information
      </h3>

      <p className="finance-section-subtitle">
        Primary mailing and household address for statements,
        invoices, tax documents, and member communication.
      </p>
    </div>

  </div>

  <div className="finance-modal-grid finance-modal-grid-2">

    <div className="finance-field finance-field-span-2">
      <label>
        Address Line 1
      </label>

      <input
        value={form.address_line1}
        onChange={(e) =>
          upd(
            "address_line1",
            e.target.value
          )
        }
        placeholder="Street address"
      />
    </div>

    <div className="finance-field finance-field-span-2">
      <label>
        Address Line 2
      </label>

      <input
        value={form.address_line2}
        onChange={(e) =>
          upd(
            "address_line2",
            e.target.value
          )
        }
        placeholder="Apartment, suite, building, unit..."
      />
    </div>

    <div className="finance-field">
      <label>
        City
      </label>

      <input
        value={form.city}
        onChange={(e) =>
          upd(
            "city",
            e.target.value
          )
        }
      />
    </div>

    <div className="finance-field">
      <label>
        State
      </label>

      <input
        value={form.state}
        onChange={(e) =>
          upd(
            "state",
            e.target.value
          )
        }
      />
    </div>

    <div className="finance-field">
      <label>
        ZIP Code
      </label>

      <input
        value={form.zip}
        onChange={(e) =>
          upd(
            "zip",
            e.target.value
          )
        }
      />
    </div>

  </div>

</section>

  {resolvedMode === "register" ? (

  <section className="finance-member-section">

    <div className="finance-section-head">
      <div>
        <h3 className="finance-section-title">
          Membership & Payment
        </h3>

        <p className="finance-section-subtitle">
          Card and ACH payments redirect
          to Stripe Checkout. Cash, check,
          Zelle, and bank deposit payments
          are recorded immediately.
        </p>
      </div>
    </div>

    <div className="finance-modal-grid finance-modal-grid-2">

      <div className="finance-field">
        <label>
          Membership Plan *
        </label>

        <select
          value={form.plan_id}
          onChange={(e) => {

            const planId =
              e.target.value;

            const plan =
              plans.find(
                (p) =>
                  String(p.id) ===
                  String(planId)
              );

            setForm((prev) => ({
              ...prev,

              plan_id: planId,

              membership_start_month:
                prev.membership_start_month ||
                new Date()
                  .toISOString()
                  .slice(0, 7),

              amount_paid: plan
                ? String(
                    getPlanAmount(plan)
                  )
                : "",

              auto_renew:
                Number(
                  plan?.duration_months || 1
                ) === 1,
              cover_processing_fee:
  isStripePaymentMethod(
    prev.payment_method
  ),

            }));
          }}
        >
          <option value="">
            Select plan
          </option>

          {plans.map((p) => (
            <option
              key={p.id}
              value={p.id}
            >
              {planLabel(p)}
              {" — "}
              {normalizeOption(
                p?.billing_cycle
              ).replace("_", " ")}
              {" — "}
              {money(
                getPlanAmount(p)
              )}
            </option>
          ))}
        </select>

        <ErrorText text={errors.plan_id} />
      </div>

      <div className="finance-field">
        <label>
          Membership Start Month *
        </label>

        <input
          type="month"
          value={form.membership_start_month}
          onChange={(e) =>
            upd(
              "membership_start_month",
              e.target.value
            )
          }
        />

        <ErrorText
          text={
            errors.membership_start_month
          }
        />
      </div>

<div className="finance-field">
  <label>
    Membership End Month
  </label>

  <input
    type="month"
    value={
      calculateCoverageEndMonth(
        form.membership_start_month,
        Number(
          selectedPlan?.duration_months || 1
        )
      )
    }
    disabled
    className="finance-month-display"
  />
</div>

      <div className="finance-field">
        <label>
          Membership Amount *
        </label>

        <input
          type="number"
          min="0"
          step="0.01"
          value={form.amount_paid}
          onChange={(e) =>
            upd(
              "amount_paid",
              e.target.value
            )
          }
        />

        <ErrorText
          text={errors.amount_paid}
        />
      </div>

      <div className="finance-field">
        <label>
          Payment Method *
        </label>

        <select
          value={form.payment_method}
        onChange={(e) => {

  const value =
    e.target.value;

  setForm((prev) => ({

    ...prev,

    payment_method:
      value,

    cover_processing_fee:
      isStripePaymentMethod(value),
  }));
}}
        >
          <option value="stripe_card">
            Card — Stripe Checkout
          </option>

          <option value="stripe_ach">
            ACH Bank Transfer — Stripe Checkout
          </option>

          <option value="cash">
            Cash
          </option>

          <option value="check">
            Check
          </option>

          <option value="zelle">
            Zelle
          </option>

          <option value="bank_deposit">
            Bank Deposit
          </option>

          <option value="other">
            Other
          </option>
        </select>

        <ErrorText
          text={errors.payment_method}
        />
      </div>

      {!isStripePaymentMethod(
        form.payment_method
      ) ? (
        <div className="finance-field finance-field-span-2">

          <label>
            Transaction Reference
          </label>

          <input
            value={form.reference_no}
            onChange={(e) =>
              upd(
                "reference_no",
                e.target.value
              )
            }
            placeholder="Check number, Zelle reference, bank deposit reference..."
          />
        </div>
      ) : null}

    </div>




    <div className="finance-payment-options">

      <label className="payx-checkbox-row">
        <input
          type="checkbox"
          checked={form.auto_renew}
          onChange={(e) =>
            upd(
              "auto_renew",
              e.target.checked
            )
          }
        />

        Enable auto-renew subscription
      </label>

      <label className="payx-checkbox-row">
        <input
          type="checkbox"
          checked={
            form.cover_processing_fee
          }
          onChange={(e) =>
            upd(
              "cover_processing_fee",
              e.target.checked
            )
          }
        />

        Cover processing fee
        (
        {money(
          paymentSummary.processingFee
        )}
        )
      </label>

    </div>

    <div className="finance-payment-summary-section">

      <div className="finance-section-head">
        <div>
          <h3 className="finance-section-title">
            Payment Summary
          </h3>

          <p className="finance-section-subtitle">
            Live totals generated from
            the active membership dues plan.
          </p>
        </div>
      </div>

      <div className="payx-summary-grid payx-summary-grid-tall">

        <div className="payx-summary-box">
          <span className="payx-summary-label">
            Plan
          </span>

          <strong>
            {planLabel(
              selectedPlan
            )}
          </strong>
        </div>

        <div className="payx-summary-box">
          <span className="payx-summary-label">
            Billing Cycle
          </span>

          <strong>
            {billingOption.replaceAll("_", " ")}
          </strong>
        </div>

        <div className="payx-summary-box">
          <span className="payx-summary-label">
            Membership Dues
          </span>

          <strong>
            {money(
              paymentSummary.membershipAmount
            )}
          </strong>
        </div>

        <div className="payx-summary-box">
          <span className="payx-summary-label">
            Registration Fee
          </span>

          <strong>
            {money(
              paymentSummary.registrationFee
            )}
          </strong>
        </div>

        {form.cover_processing_fee ? (
          <div className="payx-summary-box">
            <span className="payx-summary-label">
              Processing Fee
            </span>

            <strong>
              {money(
                paymentSummary.processingFee
              )}
            </strong>
          </div>
        ) : null}

        <div className="payx-summary-box payx-summary-box-highlight">
          <span className="payx-summary-label">
            Total
          </span>

          <strong>
            {money(
              paymentSummary.total
            )}
          </strong>
        </div>

      </div>

    </div>

  </section>

) : null}

              {isEdit ? (
                <section className="finance-member-section">
                  <div className="finance-section-head">
                    <div>
                      <h3 className="finance-section-title">Dependents</h3>

                      <p className="finance-section-subtitle">
                        Add, edit, or remove family dependents connected to this
                        finance member.
                      </p>
                    </div>
                  </div>



                  <div className="finance-dependent-list">
                    {dependents.length === 0 ? (
                      <div className="finance-dependent-empty">
                        No dependents linked to this member.
                      </div>
                    ) : (
                      dependents.map((dep) => (
                        <article key={dep.id} className="finance-dependent-card">
                          <div>
                            <strong>
                              {dep.full_name ||
                                `${dep.first_name || ""} ${
                                  dep.last_name || ""
                                }`.trim()}
                            </strong>

                            <span>
                              {dep.relationship || "--"} · Age{" "}
                              {dep.age ?? getAge(dep.date_of_birth)} ·{" "}
                              {dep.status || "--"}
                            </span>

                            <small>
                              DOB: {formatDate(dep.date_of_birth)} ·{" "}
                              {dep.email || "No email"}
                            </small>
                          </div>

                          <div className="finance-row-actions">
                            <button
                              type="button"
                              className="finance-btn finance-btn-secondary"
                              onClick={() => startEditDependent(dep)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="finance-btn finance-btn-danger"
                              onClick={() => deleteDependent(dep)}
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
                
              ) : null}

              {isEdit ? (
                <section className="finance-member-section">
                  <div className="finance-section-head">
                    <div>
                      <h3 className="finance-section-title">
                        Linked Access Accounts
                      </h3>

                      <p className="finance-section-subtitle">
                        View finance/admin login accounts connected to this
                        member.
                      </p>
                    </div>

                    {isAdmin ? (
                      <button
                        type="button"
                        className="finance-btn finance-btn-secondary"
                        onClick={() => setLinkedModalOpen(true)}
                      >
                        Create Linked Account
                      </button>
                    ) : null}
                  </div>

                  {linkedAccounts.length === 0 ? (
                    <div className="finance-dependent-empty">
                      No linked access accounts.
                    </div>
                  ) : (
                    <div className="finance-table-wrap">
                      <table className="finance-table finance-linked-table">
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Active</th>
                            {isAdmin ? <th>Actions</th> : null}
                          </tr>
                        </thead>

                        <tbody>
                          {linkedAccounts.map((acc) => (
                            <tr key={acc.id}>
                              <td>{acc.email}</td>
                              <td>{acc.username}</td>
                              <td>{acc.role}</td>
                              <td>
                                {Number(acc.is_active) === 1 ? "Yes" : "No"}
                              </td>

                              {isAdmin ? (
                                <td>
                                  <button
                                    type="button"
                                    className="finance-btn finance-btn-secondary"
                                    onClick={() => toggleLinkedAccount(acc)}
                                  >
                                    {Number(acc.is_active) === 1
                                      ? "Deactivate"
                                      : "Activate"}
                                  </button>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}

              <div className="finance-member-modal-actions">
                <button
                  type="button"
                  className="finance-btn finance-btn-secondary"
                  onClick={onClose}
                  disabled={busy}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="finance-btn finance-btn-primary"
                  disabled={busy}
                >
                  {busy
                    ? "Processing..."
                    : isEdit
                    ? "Update Member"
                    : isStripePaymentMethod(form.payment_method)
                    ? "Continue To Stripe Checkout"
                    : "Register Member & Record Payment"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
{dependentModalOpen ? (

  <div className="finance-submodal-overlay">

    <div className="finance-submodal finance-dependent-modal">

      <div className="finance-submodal-head">

        <div>

          <h3>
            {editingDependentId
              ? "Edit Dependent"
              : "Add Dependent"}
          </h3>

          <p>
            Manage household dependent information connected
            to this member profile.
          </p>

        </div>

        <button
          type="button"
          className="finance-modal-close"
          onClick={() => {
            setDependentModalOpen(false);
            resetDependentForm();
          }}
        >
          ✕
        </button>

      </div>

      <div className="finance-modal-grid finance-modal-grid-2">

        <div className="finance-field">
          <label>
            First Name *
          </label>

          <input
            value={dependentForm.first_name}
            onChange={(e) =>
              updDependent(
                "first_name",
                e.target.value
              )
            }
          />

          <ErrorText
            text={dependentErrors.first_name}
          />
        </div>

        <div className="finance-field">
          <label>
            Last Name *
          </label>

          <input
            value={dependentForm.last_name}
            onChange={(e) =>
              updDependent(
                "last_name",
                e.target.value
              )
            }
          />

          <ErrorText
            text={dependentErrors.last_name}
          />
        </div>

        <div className="finance-field">
          <label>
            Relationship *
          </label>

          <input
            value={dependentForm.relationship}
            onChange={(e) =>
              updDependent(
                "relationship",
                e.target.value
              )
            }
          />

          <ErrorText
            text={dependentErrors.relationship}
          />
        </div>

        <div className="finance-field">
          <label>
            Type
          </label>

          <select
            value={dependentForm.dependent_type}
            onChange={(e) =>
              updDependent(
                "dependent_type",
                e.target.value
              )
            }
          >
            <option value="dependent">
              Dependent
            </option>

            <option value="child">
              Child
            </option>

            <option value="spouse">
              Spouse
            </option>

            <option value="parent">
              Parent
            </option>
          </select>
        </div>

        <div className="finance-field">
          <label>
            Date of Birth *
          </label>

          <input
            type="date"
            value={dependentForm.date_of_birth}
            onChange={(e) =>
              updDependent(
                "date_of_birth",
                e.target.value
              )
            }
          />

          <ErrorText
            text={dependentErrors.date_of_birth}
          />
        </div>

        <div className="finance-field">
          <label>
            Gender
          </label>

          <select
            value={dependentForm.gender}
            onChange={(e) =>
              updDependent(
                "gender",
                e.target.value
              )
            }
          >
            <option value="">
              Select
            </option>

            <option value="male">
              Male
            </option>

            <option value="female">
              Female
            </option>
          </select>
        </div>

        <div className="finance-field">
          <label>
            Email
          </label>

          <input
            value={dependentForm.email}
            onChange={(e) =>
              updDependent(
                "email",
                e.target.value
              )
            }
          />

          <ErrorText
            text={dependentErrors.email}
          />
        </div>

        <div className="finance-field">
          <label>
            Phone
          </label>

          <input
            value={dependentForm.phone}
            onChange={(e) =>
              updDependent(
                "phone",
                e.target.value
              )
            }
          />

          <ErrorText
            text={dependentErrors.phone}
          />
        </div>

        <div className="finance-field finance-field-span-2">
          <label>
            Notes
          </label>

          <textarea
            rows="4"
            value={dependentForm.notes}
            onChange={(e) =>
              updDependent(
                "notes",
                e.target.value
              )
            }
          />
        </div>

      </div>

      <div className="finance-member-modal-actions">

        <button
          type="button"
          className="finance-btn finance-btn-secondary"
          onClick={() => {
            setDependentModalOpen(false);
            resetDependentForm();
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          className="finance-btn finance-btn-primary"
          onClick={saveDependent}
          disabled={savingDependent}
        >
          {savingDependent
            ? "Saving..."
            : editingDependentId
            ? "Update Dependent"
            : "Add Dependent"}
        </button>

      </div>

    </div>

  </div>

) : null}
      {isEdit ? (
        <LinkedAccessAccountModal
          open={linkedModalOpen}
          memberId={resolvedMemberId}
          memberName={
            form.full_name || `${form.first_name} ${form.last_name}`.trim()
          }
          onClose={() => setLinkedModalOpen(false)}
          onSaved={async () => {
            await reloadLinkedAccounts();
            finishSuccess();
          }}
        />
      ) : null}
    </>
  );
}