// frontend/src/components/AdminDashboard/pages/ProgramRegistrations.jsx

import React, { useEffect, useMemo, useState } from "react";
import api from "../../../components/api";
import "../../../styles/newsEventsAdmin.css";
// import "../../../styles/admin-enterprise.css";
// import "../../../styles/admin-table.css";
const EMPTY_PARTICIPANT = {
  first_name: "",
  last_name: "",
  age: "",
  gender: "",
  grade: "",
  notes: "",
};

function initialForm() {
  return {
    payer_type: "guest",
    member_id: "",
    full_name: "",
    email: "",
    phone: "",

    program_category: "",
    program_key: "",
    participants: [{ ...EMPTY_PARTICIPANT }],

    payment_action: "invoice_payment_link",
    notes: "",
  };
}

function clean(value) {
  return String(value || "").trim();
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "--";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeCategory(value) {
  const category = String(value || "").trim().toLowerCase();

  if (["kids", "school", "school_program", "school-program"].includes(category)) {
    return "kids";
  }

  if (["trip", "trips", "trip_program", "trip-program"].includes(category)) {
    return "trip";
  }

  return category || "";
}

function categoryLabel(value) {
  return normalizeCategory(value) === "kids" ? "School Program" : "Trip Program";
}

function programTitle(row = {}) {
  return (
    row.title ||
    row.program_title ||
    row.program_name ||
    row.name ||
    "Untitled Program"
  );
}

function programPrice(row = {}) {
  return Number(
    row.price_per_person ||
      row.price ||
      row.amount ||
      row.unit_price ||
      0
  );
}

function normalizeProgram(row = {}) {
  const category = normalizeCategory(row.category || row.public_category);

  return {
    ...row,
    id: row.id || row.news_event_id || row.program_id,
    news_event_id: row.news_event_id || row.program_id || row.id,
    category,
    title: programTitle(row),
    price_per_person: programPrice(row),
    pricing_tiers: parseJsonArray(row.pricing_tiers),
    capacity:
      row.capacity === null || row.capacity === undefined || row.capacity === ""
        ? null
        : Number(row.capacity || 0),
    registered_quantity: Number(row.registered_quantity || row.registered || 0),
    registration_enabled: Number(row.registration_enabled ?? 1),
    is_published: Number(row.is_published ?? 1),
  };
}

function programKey(program) {
  return `${program.category}:${program.news_event_id || program.id}`;
}

function splitLegacyName(row = {}) {
  const raw = clean(row.name || row.full_name);
  if (!raw) return ["", ""];

  const parts = raw.split(/\s+/).filter(Boolean);

  return [
    row.first_name || row.firstName || parts[0] || "",
    row.last_name || row.lastName || parts.slice(1).join(" ") || "",
  ];
}

function normalizeParticipant(row = {}) {
  const [legacyFirst, legacyLast] = splitLegacyName(row);

  const firstName = clean(row.first_name || row.firstName || legacyFirst);
  const lastName = clean(row.last_name || row.lastName || legacyLast);

  return {
    first_name: firstName,
    last_name: lastName,
    age: clean(row.age),
    gender: clean(row.gender),
    grade: clean(row.grade),
    notes: clean(row.notes),
  };
}

function participantName(row = {}) {
  const participant = normalizeParticipant(row);

  return [participant.first_name, participant.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function participantPayload(row = {}, isSchool = false) {
  const participant = normalizeParticipant(row);
  const name = participantName(participant);

  return {
    name,
    first_name: participant.first_name,
    last_name: participant.last_name,
    age: participant.age,
    gender: participant.gender,
    grade: isSchool ? participant.grade : "",
    notes: participant.notes,
  };
}

function cleanParticipants(rows = []) {
  const next = (Array.isArray(rows) ? rows : [])
    .map(normalizeParticipant)
    .filter((row, index) => {
      if (index === 0) return true;

      return Boolean(
        row.first_name ||
          row.last_name ||
          row.age ||
          row.gender ||
          row.grade ||
          row.notes
      );
    });

  return next.length ? next : [{ ...EMPTY_PARTICIPANT }];
}

function activeTiers(program = {}) {
  return parseJsonArray(program.pricing_tiers)
    .filter((tier) => tier && Number(tier.amount || 0) > 0)
    .filter((tier) => tier.is_active === undefined || Number(tier.is_active) === 1)
    .map((tier, index) => ({
      id: tier.id || null,
      tier_label:
        tier.tier_label ||
        tier.label ||
        `${tier.min_quantity || tier.quantity || 1} Student`,
      min_quantity: Number(tier.min_quantity || tier.quantity || 1),
      max_quantity: Number(
        tier.max_quantity || tier.quantity || tier.min_quantity || 1
      ),
      amount: Number(tier.amount || 0),
      price_type: tier.price_type || "total",
      sort_order: Number(tier.sort_order ?? index),
    }))
    .sort((a, b) => a.min_quantity - b.min_quantity || a.sort_order - b.sort_order);
}

function findSchoolTier(program, quantity) {
  const qty = Math.max(1, Number(quantity || 1));

  return activeTiers(program).find(
    (tier) => qty >= tier.min_quantity && qty <= tier.max_quantity
  );
}

function calculateProgramAmount(program, quantity) {
  const qty = Math.max(1, Number(quantity || 1));

  if (!program) {
    return {
      quantity: qty,
      unitPrice: 0,
      totalAmount: 0,
      tier: null,
      pricingLabel: "--",
    };
  }

  if (program.category === "kids") {
    const tier = findSchoolTier(program, qty);

    if (tier) {
      const total =
        tier.price_type === "per_person"
          ? Number(tier.amount || 0) * qty
          : Number(tier.amount || 0);

      return {
        quantity: qty,
        unitPrice: qty ? total / qty : total,
        totalAmount: total,
        tier,
        pricingLabel: tier.tier_label,
      };
    }
  }

  const unitPrice = Number(program.price_per_person || 0);
  const totalAmount = unitPrice * qty;

  return {
    quantity: qty,
    unitPrice,
    totalAmount,
    tier: null,
    pricingLabel: `${formatMoney(unitPrice)} per person`,
  };
}

function memberName(member = {}) {
  return (
    member.full_name ||
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    member.name ||
    ""
  );
}

function rowInvoiceUrl(row = {}) {
  return (
    row.public_invoice_url ||
    row.invoice_url ||
    row.invoice_pdf_url ||
    row.invoice_download_url ||
    ""
  );
}

function rowPaymentUrl(row = {}) {
  return (
    row.payment_link_url ||
    row.checkout_url ||
    row.stripe_checkout_url ||
    row.payment_url ||
    ""
  );
}

function exportRowsToCsv(rows) {
  const headers = [
    "Program",
    "Category",
    "Registrant",
    "Email",
    "Phone",
    "Participants",
    "Participant Names",
    "Total Amount",
    "Status",
    "Payment Status",
    "Invoice Number",
    "Payment Link",
    "Receipt Number",
    "Created At",
  ];

  const csvRows = rows.map((row) => {
    const participants = parseJsonArray(row.participants_json);
    const participantNames = participants
      .map((p) => p.name || participantName(p))
      .filter(Boolean)
      .join(" | ");

    return [
      row.program_title || row.title || "",
      categoryLabel(row.category),
      row.full_name || row.guest_name || row.payer_name || "",
      row.email || row.guest_email || "",
      row.phone || row.guest_phone || "",
      row.quantity || "",
      participantNames,
      row.total_amount || "",
      row.status || "",
      row.payment_status || "",
      row.invoice_number || "",
      rowPaymentUrl(row),
      row.receipt_number || "",
      row.created_at || "",
    ];
  });

  const csv = [headers, ...csvRows]
    .map((line) =>
      line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "program-registrations.csv";
  a.click();

  URL.revokeObjectURL(url);
}

export default function ProgramRegistrations() {
  const [rows, setRows] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [members, setMembers] = useState([]);

  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [programLoading, setProgramLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [form, setForm] = useState(initialForm());
  const [openParticipantIndex, setOpenParticipantIndex] = useState(0);

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const { data } = await api.get("/program-registrations/admin", {
        params: {
          category: category || undefined,
          status: status || undefined,
          search: search.trim() || undefined,
        },
      });

      const nextRows = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.registrations)
          ? data.registrations
          : [];

      setRows(nextRows);
    } catch (error) {
      console.error(error);
      setErr("Could not load program registrations.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPublicProgramsFallback() {
    const [schoolRes, tripRes] = await Promise.all([
      api.get("/school/programs", {
        params: {
          finance: 1,
          include_past: 1,
          include_inactive: 1,
        },
      }),
      api.get("/trip/programs", {
        params: {
          finance: 1,
          include_past: 1,
          include_inactive: 1,
        },
      }),
    ]);

    const schoolRows = Array.isArray(schoolRes?.data?.rows)
      ? schoolRes.data.rows
      : [];

    const tripRows = Array.isArray(tripRes?.data?.rows)
      ? tripRes.data.rows
      : [];

    return [...schoolRows, ...tripRows]
      .map(normalizeProgram)
      .filter((program) => ["kids", "trip"].includes(program.category));
  }

  async function loadPrograms() {
    setProgramLoading(true);

    try {
      const { data } = await api.get("/news-events/admin/list", {
        params: {
          page: 1,
          limit: 100,
          registerable: 1,
        },
      });

      const adminPrograms = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.items)
          ? data.items
          : [];

      const normalized = adminPrograms
        .map(normalizeProgram)
        .filter((program) => ["kids", "trip"].includes(program.category))
        .filter((program) => Number(program.registration_enabled || 0) === 1);

      if (normalized.length) {
        setPrograms(normalized);
        return;
      }

      const fallbackPrograms = await loadPublicProgramsFallback();
      setPrograms(fallbackPrograms);
    } catch (error) {
      console.error("Admin program load failed, trying public program routes:", error);

      try {
        const fallbackPrograms = await loadPublicProgramsFallback();
        setPrograms(fallbackPrograms);
      } catch (fallbackError) {
        console.error(fallbackError);
        setPrograms([]);
      }
    } finally {
      setProgramLoading(false);
    }
  }

  async function loadMembers() {
    try {
      const { data } = await api.get("/finance/members", {
        params: {
          page: 1,
          limit: 250,
          pageSize: 250,
          q: "",
          search: "",
        },
      });

      const memberRows = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.members)
          ? data.members
          : [];

      setMembers(memberRows);
    } catch (error) {
      console.error("Member lookup load failed:", error);
      setMembers([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status]);

  useEffect(() => {
    loadPrograms();
    loadMembers();
  }, []);

  const selectedProgram = useMemo(() => {
    return programs.find((program) => programKey(program) === form.program_key) || null;
  }, [form.program_key, programs]);

  const selectedMember = useMemo(() => {
    return members.find((member) => String(member.id) === String(form.member_id)) || null;
  }, [form.member_id, members]);

  const formParticipants = useMemo(
    () => cleanParticipants(form.participants),
    [form.participants]
  );

  const participantCount = formParticipants.length;
  const isSchool = selectedProgram?.category === "kids";

  const pricing = useMemo(
    () => calculateProgramAmount(selectedProgram, participantCount),
    [selectedProgram, participantCount]
  );

  const filteredPrograms = useMemo(() => {
    const wanted = normalizeCategory(form.program_category || category);

    return programs.filter((program) => {
      if (!wanted) return true;
      return program.category === wanted;
    });
  }, [programs, form.program_category, category]);

  const summary = useMemo(() => {
    const totalRevenue = rows.reduce(
      (sum, row) => sum + Number(row.total_amount || 0),
      0
    );

    const totalParticipants = rows.reduce(
      (sum, row) => sum + Number(row.quantity || 0),
      0
    );

    const paidCount = rows.filter(
      (row) => String(row.status || "").toLowerCase() === "paid"
    ).length;

    const followUpCount = rows.filter((row) => {
      const paymentStatus = String(row.payment_status || "").toLowerCase();

      return (
        Number(row.finance_followup_required || 0) === 1 ||
        ["manual_followup", "pending_manual"].includes(paymentStatus)
      );
    }).length;

    return {
      totalRows: rows.length,
      totalRevenue,
      totalParticipants,
      paidCount,
      followUpCount,
    };
  }, [rows]);

  function openRegisterModal() {
    setErr("");
    setSuccess("");
    setForm(initialForm());
    setOpenParticipantIndex(0);
    setShowRegisterModal(true);

    if (!programs.length) loadPrograms();
    if (!members.length) loadMembers();
  }

  function closeRegisterModal() {
    if (saving) return;

    setShowRegisterModal(false);
    setForm(initialForm());
    setOpenParticipantIndex(0);
    setErr("");
  }

  function setField(key, value) {
    setForm((prev) => {
      if (key === "member_id") {
        const member = members.find((item) => String(item.id) === String(value));

        return {
          ...prev,
          member_id: value,
          full_name: memberName(member) || prev.full_name,
          email: member?.email || prev.email,
          phone: member?.phone || prev.phone,
        };
      }

      if (key === "payer_type") {
        return {
          ...prev,
          payer_type: value,
          member_id: value === "member" ? prev.member_id : "",
          full_name: value === "member" ? prev.full_name : "",
          email: value === "member" ? prev.email : "",
          phone: value === "member" ? prev.phone : "",
        };
      }

      if (key === "program_category") {
        return {
          ...prev,
          program_category: value,
          program_key: "",
          participants: [{ ...EMPTY_PARTICIPANT }],
        };
      }

      if (key === "program_key") {
        return {
          ...prev,
          program_key: value,
          participants: [{ ...EMPTY_PARTICIPANT }],
        };
      }

      return {
        ...prev,
        [key]: value,
      };
    });

    if (key === "program_category" || key === "program_key") {
      setOpenParticipantIndex(0);
    }
  }

  function updateParticipant(index, key, value) {
    setForm((prev) => {
      const participants = cleanParticipants(prev.participants);

      participants[index] = {
        ...participants[index],
        [key]: value,
      };

      return {
        ...prev,
        participants,
      };
    });
  }

  function addParticipant() {
    setForm((prev) => {
      const participants = [...cleanParticipants(prev.participants), { ...EMPTY_PARTICIPANT }];

      setOpenParticipantIndex(participants.length - 1);

      return {
        ...prev,
        participants,
      };
    });
  }

  function removeParticipant(index) {
    setForm((prev) => {
      const participants = cleanParticipants(prev.participants);

      if (participants.length <= 1) {
        return prev;
      }

      const next = participants.filter((_, itemIndex) => itemIndex !== index);

      setOpenParticipantIndex((current) => {
        if (current === index) return Math.max(0, index - 1);
        if (current > index) return current - 1;
        return current;
      });

      return {
        ...prev,
        participants: next,
      };
    });
  }

  function validateStaffRegistration() {
    if (!selectedProgram) return "Please select a school or trip program.";

    if (form.payer_type === "member" && !form.member_id) {
      return "Please select the member.";
    }

    if (!clean(form.full_name)) {
      return "Registrant full name is required.";
    }

    if (!clean(form.email)) {
      return "Registrant email is required.";
    }

    if (!participantCount || participantCount < 1) {
      return "At least one participant is required.";
    }

    if (
      selectedProgram.category === "kids" &&
      !pricing.tier &&
      activeTiers(selectedProgram).length
    ) {
      return "No school pricing tier matches this participant count.";
    }

    if (Number(pricing.totalAmount || 0) <= 0) {
      return "Program price must be greater than zero.";
    }

    const missingParticipant = formParticipants.some(
      (participant) => !clean(participant.first_name) || !clean(participant.last_name)
    );

    if (missingParticipant) {
      return isSchool
        ? "Each school student needs first name and last name."
        : "Each trip participant needs first name and last name.";
    }

    return "";
  }

  async function submitStaffRegistration(e) {
    e.preventDefault();

    setErr("");
    setSuccess("");

    const validationError = validateStaffRegistration();

    if (validationError) {
      setErr(validationError);
      return;
    }

    const participants = formParticipants.map((participant) =>
      participantPayload(participant, isSchool)
    );

    const paymentAction = String(form.payment_action || "invoice_payment_link");

    const manualMethodMap = {
      manual_cash_followup: "cash",
      manual_check_followup: "check",
      manual_zelle_followup: "zelle",
    };

    const preferredManualMethod = manualMethodMap[paymentAction] || null;
    const isManualFollowUp = Boolean(preferredManualMethod);
    const isOnlineInvoice = paymentAction === "invoice_payment_link";
    const isInvoiceOnly = paymentAction === "invoice_only";

    const payload = {
      source: "admin_staff_assisted",
      staff_assisted: true,

      news_event_id: selectedProgram.news_event_id || selectedProgram.id,
      program_id: selectedProgram.news_event_id || selectedProgram.id,
      category: selectedProgram.category,
      public_category: selectedProgram.category === "kids" ? "school" : "trip",
      program_name: selectedProgram.title,

      payer_type: form.payer_type,
      member_id: form.payer_type === "member" ? form.member_id : null,

      full_name: clean(form.full_name),
      email: clean(form.email),
      phone: clean(form.phone),

      quantity: participants.length,
      participants,
      participants_json: JSON.stringify(participants),

      pricing_tier_id: pricing.tier?.id || null,
      pricing_tier_label: pricing.tier?.tier_label || null,
      pricing_label: pricing.pricingLabel,
      price_per_person: Number(pricing.unitPrice || 0),
      total_amount: Number(pricing.totalAmount || 0),

      status: "pending",
      payment_status: "pending",
      invoice_status: "pending",

      create_invoice: true,
      create_payment_link: isOnlineInvoice,
      create_checkout: false,

      payment_method: isManualFollowUp
        ? preferredManualMethod
        : isOnlineInvoice
          ? "card_ach"
          : "invoice",
      preferred_payment_method: isManualFollowUp
        ? preferredManualMethod
        : isOnlineInvoice
          ? "card_ach"
          : "invoice",

      allow_card: isOnlineInvoice,
      allow_ach: isOnlineInvoice,

      send_invoice_email: isOnlineInvoice || isInvoiceOnly,
      send_invoice_email_to_recipient: isOnlineInvoice || isInvoiceOnly,

      notify_finance_admin: isManualFollowUp,
      send_invoice_to_finance_admin: isManualFollowUp,
      finance_followup_required: isManualFollowUp,
      finance_payment_processing_required: isManualFollowUp,

      create_receipt: false,
      send_receipt_email: false,
      mark_paid: false,

      notes: form.notes || null,
      registration_date: todayIso(),
    };

    const endpoints = [
      "/program-registrations/admin/register",
      "/program-registrations/admin",
      "/program-registrations",
    ];

    setSaving(true);

    try {
      let response = null;
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          response = await api.post(endpoint, payload);
          break;
        } catch (error) {
          lastError = error;

          if (error?.response?.status && error.response.status !== 404) {
            throw error;
          }
        }
      }

      if (!response) {
        throw lastError || new Error("Registration endpoint not available.");
      }

      setShowRegisterModal(false);
      setForm(initialForm());
      setOpenParticipantIndex(0);

      setSuccess(
        isManualFollowUp
          ? "Registration created. Invoice was routed to finance for manual payment follow-up."
          : "Registration created. Invoice/payment workflow was created for the registrant."
      );

      await load();
    } catch (error) {
      console.error(error);

      setErr(
        error?.response?.data?.details ||
          error?.response?.data?.error ||
          error?.message ||
          "Failed to create program registration."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="nea-page">
      <section className="nea-hero">
        <div>
          <p className="nea-eyebrow">Administration</p>
          <h2>Program Registrations</h2>
          <p>
            Register members or non-members for school and trip programs, create
            invoices, send payment links, and route manual payment follow-up to finance.
          </p>
        </div>

        <div className="nea-hero-actions">
          <button type="button" className="nea-primary-btn" onClick={openRegisterModal}>
            Staff Registration
          </button>

          <button
            type="button"
            className="nea-primary-btn"
            onClick={() => exportRowsToCsv(rows)}
            disabled={!rows.length}
          >
            Export CSV
          </button>
        </div>
      </section>

      {err ? <div className="auth-banner">{err}</div> : null}
      {success ? <div className="auth-success">{success}</div> : null}

      <section className="nea-stats-grid">
        <article className="nea-stat-card">
          <span>Registrations</span>
          <strong>{summary.totalRows}</strong>
        </article>

        <article className="nea-stat-card">
          <span>Paid</span>
          <strong>{summary.paidCount}</strong>
        </article>

        <article className="nea-stat-card">
          <span>Participants</span>
          <strong>{summary.totalParticipants}</strong>
        </article>

        <article className="nea-stat-card">
          <span>Manual Follow-Up</span>
          <strong>{summary.followUpCount}</strong>
        </article>

        <article className="nea-stat-card">
          <span>Visible Amount</span>
          <strong>{formatMoney(summary.totalRevenue)}</strong>
        </article>
      </section>

      <section className="nea-toolbar-card">
        <form
          className="nea-toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input
            className="nea-input"
            placeholder="Search name, email, phone, invoice, or program..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="nea-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All Programs</option>
            <option value="kids">School Programs</option>
            <option value="trip">Trips</option>
          </select>

          <select
            className="nea-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button type="submit" className="nea-primary-btn">
            Search
          </button>
        </form>
      </section>

      <section className="nea-table-card">
        <div className="nea-table-wrap desktop-table">
          <table className="nea-table">
            <thead>
              <tr>
                <th>Program</th>
                <th>Registrant</th>
                <th>Participants</th>
                <th>Amount</th>
                <th>Invoice</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="nea-empty-cell">
                    Loading registrations...
                  </td>
                </tr>
              ) : null}

              {!loading &&
                rows.map((row) => {
                  const participants = parseJsonArray(row.participants_json);
                  const invoiceUrl = rowInvoiceUrl(row);
                  const paymentUrl = rowPaymentUrl(row);
                  const normalizedStatus = String(row.status || "pending").toLowerCase();

                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>
                          {row.program_title || row.title || row.program_name || "--"}
                        </strong>
                        <div>{categoryLabel(row.category)}</div>
                      </td>

                      <td>
                        <strong>
                          {row.full_name || row.guest_name || row.payer_name || "--"}
                        </strong>
                        <div>{row.email || row.guest_email || "--"}</div>
                        <div>{row.phone || row.guest_phone || "--"}</div>
                      </td>

                      <td>
                        <strong>{row.quantity || participants.length || 0}</strong>
                        <div>
                          {participants.length
                            ? participants
                                .map((p) => p.name || participantName(p))
                                .filter(Boolean)
                                .join(", ")
                            : "--"}
                        </div>
                      </td>

                      <td>
                        <strong>{formatMoney(row.total_amount)}</strong>
                        <div>{formatMoney(row.price_per_person)} average</div>
                      </td>

                      <td>
                        <strong>{row.invoice_number || "--"}</strong>
                        {invoiceUrl ? (
                          <div>
                            <button
                              type="button"
                              className="nea-link-btn"
                              onClick={() =>
                                window.open(invoiceUrl, "_blank", "noopener,noreferrer")
                              }
                            >
                              Open Invoice
                            </button>
                          </div>
                        ) : null}
                      </td>

                      <td>
                        <strong>{row.payment_number || row.payment_status || "--"}</strong>
                        {paymentUrl ? (
                          <div>
                            <button
                              type="button"
                              className="nea-link-btn"
                              onClick={() =>
                                window.open(paymentUrl, "_blank", "noopener,noreferrer")
                              }
                            >
                              Payment Link
                            </button>
                          </div>
                        ) : null}
                        {Number(row.finance_followup_required || 0) === 1 ? (
                          <div>Finance follow-up</div>
                        ) : null}
                      </td>

                      <td>
                        <span
                          className={
                            normalizedStatus === "paid"
                              ? "nea-pill nea-pill-published"
                              : "nea-pill nea-pill-draft"
                          }
                        >
                          {row.status || "pending"}
                        </span>
                      </td>

                      <td>{formatDate(row.created_at)}</td>
                    </tr>
                  );
                })}

              {!loading && !rows.length ? (
                <tr>
                  <td colSpan={8} className="nea-empty-cell">
                    No registrations found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {showRegisterModal ? (
        <div className="nea-modal-overlay">
          <div className="nea-modal nea-modal-wide">
            <div className="nea-modal-head">
              <div>
                <h2>Staff-Assisted Program Registration</h2>
                <p>
                  Register a member or guest, create the invoice, and choose
                  payment-link delivery or finance manual follow-up.
                </p>
              </div>

              <button
                type="button"
                className="nea-close-btn"
                onClick={closeRegisterModal}
                disabled={saving}
              >
                x
              </button>
            </div>

            <div className="nea-modal-body">
              {err ? <div className="auth-banner">{err}</div> : null}

              <form className="nea-form-screen" onSubmit={submitStaffRegistration}>
                <div className="nea-form-grid">
                  <div className="nea-field">
                    <label>Payer Type</label>
                    <select
                      value={form.payer_type}
                      onChange={(e) => setField("payer_type", e.target.value)}
                    >
                      <option value="guest">Non-Member / Guest</option>
                      <option value="member">Member</option>
                    </select>
                  </div>

                  {form.payer_type === "member" ? (
                    <div className="nea-field">
                      <label>Member</label>
                      <select
                        value={form.member_id}
                        onChange={(e) => setField("member_id", e.target.value)}
                      >
                        <option value="">Select member</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.member_no || member.member_number || "Member"} -{" "}
                            {memberName(member)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div className="nea-field">
                    <label>Full Name</label>
                    <input
                      value={form.full_name}
                      onChange={(e) => setField("full_name", e.target.value)}
                      placeholder="Registrant full name"
                    />
                  </div>

                  <div className="nea-field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      placeholder="Email for invoice/payment link"
                    />
                  </div>

                  <div className="nea-field">
                    <label>Phone</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      placeholder="Phone"
                    />
                  </div>

                  <div className="nea-field">
                    <label>Program Type</label>
                    <select
                      value={form.program_category}
                      onChange={(e) => setField("program_category", e.target.value)}
                    >
                      <option value="">All Program Types</option>
                      <option value="kids">School Program</option>
                      <option value="trip">Trip Program</option>
                    </select>
                  </div>

                  <div className="nea-field">
                    <label>Program</label>
                    <select
                      value={form.program_key}
                      onChange={(e) => setField("program_key", e.target.value)}
                      disabled={programLoading}
                    >
                      <option value="">
                        {programLoading ? "Loading programs..." : "Select program"}
                      </option>

                      {filteredPrograms.map((program) => (
                        <option key={programKey(program)} value={programKey(program)}>
                          {categoryLabel(program.category)} - {program.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="nea-field">
                    <label>Invoice / Payment Flow</label>
                    <select
                      value={form.payment_action}
                      onChange={(e) => setField("payment_action", e.target.value)}
                    >
                      <option value="invoice_payment_link">
                        Send invoice with Card / ACH payment link
                      </option>
                      <option value="invoice_only">
                        Create invoice and email registrant
                      </option>
                      <option value="manual_cash_followup">
                        Cash - route invoice to finance follow-up
                      </option>
                      <option value="manual_check_followup">
                        Check - route invoice to finance follow-up
                      </option>
                      <option value="manual_zelle_followup">
                        Zelle - route invoice to finance follow-up
                      </option>
                    </select>
                  </div>

                  <div className="nea-field nea-form-col-full">
                    <div className="nea-section-head">
                      <div>
                        <label>
                          {isSchool ? "Students" : "Participants"} ({participantCount})
                        </label>
                        <p className="nea-muted">
                          Add each {isSchool ? "student" : "participant"} separately.
                          First and last name are required.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="nea-secondary-btn"
                        onClick={addParticipant}
                      >
                        + Add {isSchool ? "Student" : "Participant"}
                      </button>
                    </div>

                    <div className="nea-tier-list">
                      {formParticipants.map((participant, index) => {
                        const displayName = participantName(participant);
                        const isOpen = openParticipantIndex === index;

                        return (
                          <article className="nea-toolbar-card" key={index}>
                            <div className="nea-section-head">
                              <button
                                type="button"
                                className="nea-link-btn"
                                onClick={() =>
                                  setOpenParticipantIndex(isOpen ? -1 : index)
                                }
                              >
                                {isOpen ? "Collapse" : "Edit"}
                              </button>

                              <div>
                                <strong>
                                  {isSchool ? "Student" : "Participant"} {index + 1}
                                </strong>
                                <p className="nea-muted">
                                  {displayName || "Name not completed"}
                                </p>
                              </div>

                              <button
                                type="button"
                                className="nea-pagination-btn"
                                onClick={() => removeParticipant(index)}
                                disabled={formParticipants.length <= 1}
                              >
                                Remove
                              </button>
                            </div>

                            {isOpen ? (
                              <div className="nea-form-grid">
                                <div className="nea-field">
                                  <label>First Name</label>
                                  <input
                                    value={participant.first_name}
                                    onChange={(e) =>
                                      updateParticipant(index, "first_name", e.target.value)
                                    }
                                    placeholder="First name"
                                  />
                                </div>

                                <div className="nea-field">
                                  <label>Last Name</label>
                                  <input
                                    value={participant.last_name}
                                    onChange={(e) =>
                                      updateParticipant(index, "last_name", e.target.value)
                                    }
                                    placeholder="Last name"
                                  />
                                </div>

                                <div className="nea-field">
                                  <label>Age</label>
                                  <input
                                    value={participant.age}
                                    onChange={(e) =>
                                      updateParticipant(index, "age", e.target.value)
                                    }
                                    placeholder="Age"
                                  />
                                </div>

                                <div className="nea-field">
                                  <label>Gender</label>
                                  <select
                                    value={participant.gender}
                                    onChange={(e) =>
                                      updateParticipant(index, "gender", e.target.value)
                                    }
                                  >
                                    <option value="">Select gender</option>
                                    <option value="female">Female</option>
                                    <option value="male">Male</option>
                                  </select>
                                </div>

                                {isSchool ? (
                                  <div className="nea-field">
                                    <label>Grade</label>
                                    <input
                                      value={participant.grade}
                                      onChange={(e) =>
                                        updateParticipant(index, "grade", e.target.value)
                                      }
                                      placeholder="Grade"
                                    />
                                  </div>
                                ) : null}

                                <div className="nea-field nea-form-col-full">
                                  <label>Notes</label>
                                  <input
                                    value={participant.notes}
                                    onChange={(e) =>
                                      updateParticipant(index, "notes", e.target.value)
                                    }
                                    placeholder="Optional notes"
                                  />
                                </div>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </div>

                  <div className="nea-field nea-form-col-full">
                    <label>Registration Notes</label>
                    <textarea
                      className="rte-textarea"
                      value={form.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      placeholder="Internal notes for admin or finance"
                    />
                  </div>
                </div>

                <section className="nea-toolbar-card">
                  <div className="nea-stats-grid">
                    <article className="nea-stat-card">
                      <span>Selected Program</span>
                      <strong>{selectedProgram?.title || "--"}</strong>
                    </article>

                    <article className="nea-stat-card">
                      <span>Participants</span>
                      <strong>{participantCount}</strong>
                    </article>

                    <article className="nea-stat-card">
                      <span>Pricing</span>
                      <strong>{pricing.pricingLabel}</strong>
                    </article>

                    <article className="nea-stat-card">
                      <span>Total Due</span>
                      <strong>{formatMoney(pricing.totalAmount)}</strong>
                    </article>
                  </div>
                </section>

                <div className="nea-modal-actions">
                  <button
                    type="button"
                    className="nea-pagination-btn"
                    onClick={closeRegisterModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button type="submit" className="nea-add-btn" disabled={saving}>
                    {saving ? "Saving..." : "Create Registration"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}