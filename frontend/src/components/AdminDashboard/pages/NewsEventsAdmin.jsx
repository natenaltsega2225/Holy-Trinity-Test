
// src/components/AdminDashboard/pages/NewsEventsAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
 import "../../../styles/newsEventsAdmin.css";
import "../../../styles/auth.css";
// import "../../../styles/admin-enterprise.css";
// import "../../../styles/admin-table.css";
const CATEGORY_OPTIONS = [
  { value: "holiday", label: "Annual Calendar / Holiday" },
  { value: "kids", label: "School Program" },
  { value: "trip", label: "Trip Program" },
  { value: "news", label: "Church Announcement" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

const TABS = [
  { key: "events", label: "Calendar & Programs" },
  { key: "posted", label: "Published Items" },
  { key: "registrations", label: "Registrations" },
];

const DEFAULT_SCHOOL_TIERS = [
  {
    tier_label: "1 Student",
    min_quantity: 1,
    max_quantity: 1,
    amount: "",
    price_type: "total",
    is_active: 1,
    sort_order: 0,
  },
  {
    tier_label: "2 Students",
    min_quantity: 2,
    max_quantity: 2,
    amount: "",
    price_type: "total",
    is_active: 1,
    sort_order: 1,
  },
  {
    tier_label: "3 Students",
    min_quantity: 3,
    max_quantity: 3,
    amount: "",
    price_type: "total",
    is_active: 1,
    sort_order: 2,
  },
];

const INITIAL_FORM = {
  id: null,
  category: "news",
  title: "",
  subtitle: "",
  summary: "",
  body_html: "",
  start_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  location: "",
  audience: "",
  flyer_url: "",
  holiday_color: "#4A75E6",
  is_published: 1,
  registration_enabled: 0,
  price_per_person: "",
  capacity: "",
  registration_notes: "",
  pricing_tiers: [],
};

function clean(value) {
  return String(value ?? "").trim();
}

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function stripHtml(html) {
  return clean(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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

function formatDate(value) {
  if (!value) return "--";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function fmtDateRange(row) {
  if (row.start_date || row.end_date) {
    return `${row.start_date || "--"} to ${row.end_date || "--"}`;
  }

  return "--";
}

function parseTimeText(timeText) {
  const raw = clean(timeText);

  if (!raw) {
    return {
      start_time: "",
      end_time: "",
    };
  }

  const normalized = raw.replace(/\s+to\s+/i, " - ");
  const parts = normalized.split(" - ").map((item) => item.trim());

  if (parts.length >= 2) {
    return {
      start_time: parts[0],
      end_time: parts[1],
    };
  }

  return {
    start_time: raw,
    end_time: "",
  };
}

function buildTimeText(startTime, endTime) {
  const start = clean(startTime);
  const end = clean(endTime);

  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  if (end) return end;

  return "";
}

function normalizePricingTiers(tiers = []) {
  return parseJsonArray(tiers).map((tier, index) => {
    const minQuantity = Number(
      tier.min_quantity || tier.minQuantity || tier.quantity || 1
    );

    const maxQuantity = Number(
      tier.max_quantity ||
        tier.maxQuantity ||
        tier.quantity ||
        tier.min_quantity ||
        minQuantity
    );

    const label =
      clean(tier.tier_label || tier.label) ||
      (minQuantity === maxQuantity
        ? `${minQuantity} Student${minQuantity === 1 ? "" : "s"}`
        : `${minQuantity}-${maxQuantity} Students`);

    return {
      id: tier.id || null,
      tier_label: label,
      min_quantity: minQuantity,
      max_quantity: maxQuantity,
      amount:
        tier.amount === null || tier.amount === undefined
          ? ""
          : String(tier.amount),
      price_type: tier.price_type || tier.priceType || "total",
      is_active:
        tier.is_active === false || Number(tier.is_active) === 0 ? 0 : 1,
      sort_order: Number(tier.sort_order ?? index),
    };
  });
}

function activePricingTiers(tiers = []) {
  return normalizePricingTiers(tiers)
    .filter((tier) => Number(tier.is_active) === 1)
    .filter((tier) => Number(tier.amount || 0) > 0)
    .sort((a, b) => a.min_quantity - b.min_quantity);
}

function schoolFallbackPrice(tiers = [], fallback = "") {
  const active = activePricingTiers(tiers);
  const oneStudent = active.find(
    (tier) =>
      Number(tier.min_quantity) === 1 &&
      Number(tier.max_quantity) === 1
  );

  if (oneStudent) return oneStudent.amount;

  return fallback || "";
}

function validatePricingTiers(tiers = []) {
  const active = activePricingTiers(tiers);

  for (const tier of active) {
    if (!Number.isInteger(Number(tier.min_quantity)) || Number(tier.min_quantity) <= 0) {
      return "Each pricing tier needs a valid minimum quantity.";
    }

    if (
      !Number.isInteger(Number(tier.max_quantity)) ||
      Number(tier.max_quantity) < Number(tier.min_quantity)
    ) {
      return "Each pricing tier maximum must be greater than or equal to minimum.";
    }

    if (Number(tier.amount || 0) <= 0) {
      return "Each active pricing tier needs an amount greater than zero.";
    }
  }

  for (let i = 1; i < active.length; i += 1) {
    const previous = active[i - 1];
    const current = active[i];

    if (Number(current.min_quantity) <= Number(previous.max_quantity)) {
      return "School pricing tiers cannot overlap.";
    }
  }

  return "";
}

function categoryLabel(value) {
  return (
    CATEGORY_OPTIONS.find((item) => item.value === value)?.label ||
    value ||
    "--"
  );
}

function isProgramCategory(category) {
  return category === "kids" || category === "trip";
}

function statCount(rows, category) {
  return rows.filter((row) => row.category === category).length;
}

function parseParticipants(value) {
  return parseJsonArray(value);
}

function registrationLabel(row) {
  return row.category === "kids" ? "School Program" : "Trip Program";
}

function exportRegistrationsCSV(rows) {
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
    "Payment Number",
    "Receipt Number",
    "Created At",
  ];

  const lines = rows.map((row) => {
    const participants = parseParticipants(row.participants_json);
    const participantNames = participants
      .map((item) => `${item.name || ""}${item.age ? ` (${item.age})` : ""}`)
      .join(" | ");

    return [
      row.program_title || row.title || "",
      row.category || "",
      row.full_name || "",
      row.email || "",
      row.phone || "",
      row.quantity || "",
      participantNames,
      row.total_amount || "",
      row.status || "",
      row.payment_number || "",
      row.receipt_number || "",
      row.created_at || "",
    ];
  });

  const csv = [headers, ...lines]
    .map((line) =>
      line
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(",")
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

function RowActionsMenu({
  onEdit,
  onDelete,
  onViewImage,
  onViewApplicants,
  hasImage,
  canViewApplicants,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleDocClick() {
      setOpen(false);
    }

    if (open) {
      document.addEventListener("click", handleDocClick);
    }

    return () => {
      document.removeEventListener("click", handleDocClick);
    };
  }, [open]);

  return (
    <div className="nea-action-menu" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="nea-kebab-btn"
        aria-label="Open actions"
        onClick={() => setOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>

      {open ? (
        <div className="nea-kebab-menu">
          {canViewApplicants ? (
            <button
              type="button"
              className="nea-kebab-item"
              onClick={() => {
                setOpen(false);
                onViewApplicants();
              }}
            >
              View Registrations
            </button>
          ) : null}

          {hasImage ? (
            <button
              type="button"
              className="nea-kebab-item"
              onClick={() => {
                setOpen(false);
                onViewImage();
              }}
            >
              View Image
            </button>
          ) : null}

          <button
            type="button"
            className="nea-kebab-item"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit
          </button>

          <button
            type="button"
            className="nea-kebab-item danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CapacityBar({ used = 0, capacity = 0 }) {
  const cap = Number(capacity || 0);
  const count = Number(used || 0);
  const percent = cap > 0 ? Math.min(100, Math.round((count / cap) * 100)) : 0;

  return (
    <div className="nea-capacity-cell">
      <div className="nea-capacity-track">
        <div className="nea-capacity-fill" style={{ width: `${percent}%` }} />
      </div>

      <span>
        {cap > 0 ? `${count}/${cap} (${percent}%)` : `${count} registered`}
      </span>
    </div>
  );
}

function PricingSummary({ row }) {
  if (row.category === "kids") {
    const tiers = activePricingTiers(row.pricing_tiers);

    if (tiers.length) {
      return (
        <div>
          <strong>{tiers.length} school tier(s)</strong>
          <div className="nea-muted">
            {tiers
              .slice(0, 3)
              .map((tier) => `${tier.tier_label}: ${money(tier.amount)}`)
              .join(" | ")}
          </div>
        </div>
      );
    }

    return (
      <div>
        <strong>{money(row.price_per_person)}</strong>
        <div className="nea-muted">Fallback school price</div>
      </div>
    );
  }

  if (row.category === "trip") {
    return (
      <div>
        <strong>{money(row.price_per_person)}</strong>
        <div className="nea-muted">Per person</div>
      </div>
    );
  }

  return "--";
}

export default function NewsEventsAdmin() {
  const [activeTab, setActiveTab] = useState("events");

  const [rows, setRows] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [eventParticipants, setEventParticipants] = useState([]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [publishedFilter, setPublishedFilter] = useState("all");
  const [registrationCategoryFilter, setRegistrationCategoryFilter] = useState("all");
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showModal, setShowModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [participantsTitle, setParticipantsTitle] = useState("");

  const [form, setForm] = useState(INITIAL_FORM);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeExistingFlyer, setRemoveExistingFlyer] = useState(false);

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const params = {
        page: 1,
        limit: 100,
      };

      if (categoryFilter !== "all") params.category = categoryFilter;
      if (publishedFilter === "published") params.published = "1";
      if (publishedFilter === "draft") params.published = "0";
      if (search.trim()) params.search = search.trim();

      const { data } = await api.get("/news-events/admin/list", {
        params,
      });

      const nextRows = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.rows)
          ? data.rows
          : [];

      setRows(nextRows);
      setPage(1);
    } catch (error) {
      console.error(error);
      setRows([]);
      setErr(
        error?.response?.data?.details ||
          error?.response?.data?.error ||
          "Failed to load calendar and program items."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadRegistrations(extraParams = {}) {
    setRegistrationsLoading(true);

    try {
      const params = { ...extraParams };

      if (!params.event_id && registrationCategoryFilter !== "all") {
        params.category = registrationCategoryFilter;
      }

      if (registrationStatusFilter !== "all") {
        params.status = registrationStatusFilter;
      }

      if (search.trim()) {
        params.search = search.trim();
      }

      const { data } = await api.get("/program-registrations/admin", {
        params,
      });

      const nextRows = Array.isArray(data?.rows) ? data.rows : [];

      if (params.event_id) {
        setEventParticipants(nextRows);
      } else {
        setRegistrations(nextRows);
      }
    } catch (error) {
      console.error(error);

      if (extraParams.event_id) {
        setEventParticipants([]);
      } else {
        setRegistrations([]);
      }

      setErr(
        error?.response?.data?.error ||
          "Failed to load program registrations."
      );
    } finally {
      setRegistrationsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, publishedFilter]);

  useEffect(() => {
    if (activeTab === "registrations") {
      loadRegistrations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, registrationCategoryFilter, registrationStatusFilter]);

  function setField(key, value) {
    setForm((previous) => {
      if (key === "category") {
        const isProgram = isProgramCategory(value);
        const isSchool = value === "kids";

        return {
          ...previous,
          category: value,
          registration_enabled: isProgram ? 1 : 0,
          price_per_person: isProgram ? previous.price_per_person : "",
          capacity: isProgram ? previous.capacity : "",
          registration_notes: isProgram ? previous.registration_notes : "",
          pricing_tiers: isSchool
            ? previous.pricing_tiers?.length
              ? previous.pricing_tiers
              : DEFAULT_SCHOOL_TIERS
            : [],
        };
      }

      return {
        ...previous,
        [key]: value,
      };
    });
  }

  function resetModal() {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setForm(INITIAL_FORM);
    setImageFile(null);
    setImagePreview("");
    setRemoveExistingFlyer(false);
    setErr("");
    setShowModal(false);
  }

  function openCreate(category = "news") {
    setForm({
      ...INITIAL_FORM,
      category,
      registration_enabled: isProgramCategory(category) ? 1 : 0,
      pricing_tiers: category === "kids" ? DEFAULT_SCHOOL_TIERS : [],
    });

    setImageFile(null);
    setImagePreview("");
    setRemoveExistingFlyer(false);
    setErr("");
    setSuccess("");
    setShowModal(true);
  }

  function openEdit(row) {
    const parsed = parseTimeText(row.time_text);
    const savedTiers = parseJsonArray(row.pricing_tiers);

    setForm({
      id: row.id,
      category: row.category || "news",
      title: row.title || "",
      subtitle: row.subtitle || "",
      summary: row.summary || "",
      body_html: row.body_html || "",
      start_date: row.start_date || "",
      end_date: row.end_date || "",
      start_time: parsed.start_time,
      end_time: parsed.end_time,
      location: row.location || "",
      audience: row.audience || "",
      flyer_url: row.flyer_url || "",
      holiday_color: row.holiday_color || "#4A75E6",
      is_published: Number(row.is_published) ? 1 : 0,
      registration_enabled: Number(row.registration_enabled || 0),
      price_per_person: row.price_per_person || "",
      capacity: row.capacity || "",
      registration_notes: row.registration_notes || "",
      pricing_tiers:
        row.category === "kids"
          ? normalizePricingTiers(
              savedTiers.length ? savedTiers : DEFAULT_SCHOOL_TIERS
            )
          : [],
    });

    setImageFile(null);
    setImagePreview(row.flyer_url || "");
    setRemoveExistingFlyer(false);
    setErr("");
    setSuccess("");
    setShowModal(true);
  }

  async function openApplicants(row) {
    setParticipantsTitle(row.title || "Program Registrations");
    setEventParticipants([]);
    setShowParticipantsModal(true);

    await loadRegistrations({
      event_id: row.id,
    });
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErr("Only jpg, jpeg, png, and webp image files are allowed.");
      return;
    }

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setErr("");
    setImageFile(file);
    setRemoveExistingFlyer(false);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(null);
    setImagePreview("");
    setRemoveExistingFlyer(true);
    setField("flyer_url", "");
  }

  function updatePricingTier(index, key, value) {
    setForm((previous) => {
      const tiers = normalizePricingTiers(previous.pricing_tiers);

      tiers[index] = {
        ...tiers[index],
        [key]: value,
      };

      return {
        ...previous,
        pricing_tiers: tiers,
      };
    });
  }

  function addPricingTier() {
    setForm((previous) => {
      const tiers = normalizePricingTiers(previous.pricing_tiers);
      const last = tiers[tiers.length - 1];
      const nextQty = Number(last?.max_quantity || tiers.length) + 1;

      return {
        ...previous,
        pricing_tiers: [
          ...tiers,
          {
            tier_label: `${nextQty} Students`,
            min_quantity: nextQty,
            max_quantity: nextQty,
            amount: "",
            price_type: "total",
            is_active: 1,
            sort_order: tiers.length,
          },
        ],
      };
    });
  }

  function removePricingTier(index) {
    setForm((previous) => ({
      ...previous,
      pricing_tiers: normalizePricingTiers(previous.pricing_tiers).filter(
        (_tier, tierIndex) => tierIndex !== index
      ),
    }));
  }

  function validateAdminEventForm(nextForm) {
    const category = nextForm.category;
    const isProgram = isProgramCategory(category);
    const isSchool = category === "kids";
    const isTrip = category === "trip";

    if (!clean(nextForm.title)) return "Title is required.";

    if (category === "holiday" && !nextForm.start_date) {
      return "Annual calendar and holiday entries require a start date.";
    }

    if (isProgram) {
      if (!nextForm.start_date) return "Program start date is required.";
      if (!clean(nextForm.location)) return "Program location is required.";

      if (Number(nextForm.registration_enabled || 0)) {
        if (isTrip && Number(nextForm.price_per_person || 0) <= 0) {
          return "Trip programs require a regular price per person.";
        }

        if (isSchool) {
          const tiers = activePricingTiers(nextForm.pricing_tiers);
          const fallback = Number(schoolFallbackPrice(tiers, nextForm.price_per_person) || 0);

          if (!tiers.length && fallback <= 0) {
            return "School programs require at least one pricing tier or a fallback price.";
          }

          const tierError = validatePricingTiers(tiers);

          if (tierError) return tierError;
        }
      }
    }

    return "";
  }

  async function handleSave(event) {
    event.preventDefault();
    setErr("");
    setSuccess("");

    const validationError = validateAdminEventForm(form);

    if (validationError) {
      setErr(validationError);
      return;
    }

    try {
      const formData = new FormData();
      const isProgram = isProgramCategory(form.category);
      const isSchool = form.category === "kids";

      formData.append("category", form.category);
      formData.append("title", form.title);
      formData.append("subtitle", form.subtitle || "");
      formData.append("summary", form.summary || "");
      formData.append("body_html", form.body_html || "");
      formData.append("start_date", form.start_date || "");
      formData.append("end_date", form.end_date || "");
      formData.append("time_text", buildTimeText(form.start_time, form.end_time));
      formData.append("location", form.location || "");
      formData.append("audience", form.audience || "");
      formData.append("is_published", String(form.is_published ? 1 : 0));
      formData.append(
        "holiday_color",
        form.category === "holiday"
          ? form.holiday_color || "#4A75E6"
          : ""
      );

      if (isProgram) {
        const tiers = isSchool
          ? normalizePricingTiers(form.pricing_tiers).filter(
              (tier) =>
                Number(tier.amount) > 0 &&
                Number(tier.min_quantity) > 0 &&
                Number(tier.max_quantity) >= Number(tier.min_quantity)
            )
          : [];

        const fallbackPrice = isSchool
          ? schoolFallbackPrice(tiers, form.price_per_person)
          : form.price_per_person;

        formData.append(
          "registration_enabled",
          String(form.registration_enabled ? 1 : 0)
        );
        formData.append("price_per_person", String(Number(fallbackPrice || 0)));
        formData.append("capacity", form.capacity || "");
        formData.append("registration_notes", form.registration_notes || "");
        formData.append("pricing_tiers", JSON.stringify(tiers));
      } else {
        formData.append("registration_enabled", "0");
        formData.append("price_per_person", "0");
        formData.append("capacity", "");
        formData.append("registration_notes", "");
        formData.append("pricing_tiers", "[]");
      }

      if (form.flyer_url && !imageFile) {
        formData.append("flyer_url", form.flyer_url);
      }

      if (imageFile) {
        formData.append("flyer_image", imageFile);
      }

      if (removeExistingFlyer) {
        formData.append("remove_flyer", "1");
      }

      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      };

      if (form.id) {
        await api.put(`/news-events/admin/${form.id}`, formData, config);
      } else {
        await api.post("/news-events/admin", formData, config);
      }

      resetModal();
      setSuccess("Calendar/program item saved successfully.");
      await load();
    } catch (error) {
      console.error(error);
      setErr(
        error?.response?.data?.details ||
          error?.response?.data?.error ||
          error?.message ||
          "Save failed."
      );
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this item?"
    );

    if (!confirmed) return;

    try {
      await api.delete(`/news-events/admin/${id}`);
      setSuccess("Item deleted successfully.");
      await load();
    } catch (error) {
      console.error(error);
      setErr(
        error?.response?.data?.error ||
          error?.message ||
          "Delete failed."
      );
    }
  }

  const visibleRows = useMemo(() => {
    let next = [...rows];

    if (activeTab === "posted") {
      next = next.filter((row) => Number(row.is_published || 0) === 1);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();

      next = next.filter((row) =>
        [
          row.title,
          row.subtitle,
          row.summary,
          row.location,
          row.audience,
          row.category,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      );
    }

    return next;
  }, [rows, search, activeTab]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [visibleRows, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const eventSummary = useMemo(() => {
    return {
      total: rows.length,
      holidays: statCount(rows, "holiday"),
      school: statCount(rows, "kids"),
      trips: statCount(rows, "trip"),
      news: statCount(rows, "news"),
      published: rows.filter((row) => Number(row.is_published || 0) === 1).length,
    };
  }, [rows]);

  const registrationSummary = useMemo(() => {
    const revenue = registrations.reduce(
      (sum, row) => sum + Number(row.total_amount || 0),
      0
    );

    const participants = registrations.reduce(
      (sum, row) => sum + Number(row.quantity || 0),
      0
    );

    const paid = registrations.filter(
      (row) => String(row.status || "").toLowerCase() === "paid"
    ).length;

    return {
      total: registrations.length,
      paid,
      participants,
      revenue,
    };
  }, [registrations]);

  function renderRegistrationsTable(sourceRows, loadingMessage = "Loading registrations...") {
    return (
      <div className="nea-table-wrap desktop-table">
        <table className="nea-table">
          <thead>
            <tr>
              <th>Program</th>
              <th>Registrant</th>
              <th>Participants</th>
              <th>Revenue</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Receipt</th>
            </tr>
          </thead>

          <tbody>
            {registrationsLoading ? (
              <tr>
                <td colSpan={8} className="nea-empty-cell">
                  {loadingMessage}
                </td>
              </tr>
            ) : null}

            {!registrationsLoading &&
              sourceRows.map((row) => {
                const participants = parseParticipants(row.participants_json);

                return (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.program_title || row.title || "--"}</strong>
                      <div className="nea-muted">{registrationLabel(row)}</div>
                    </td>

                    <td>
                      <strong>{row.full_name || "--"}</strong>
                      <div>{row.email || "--"}</div>
                      <div className="nea-muted">{row.phone || "--"}</div>
                    </td>

                    <td>
                      <strong>{row.quantity || participants.length || 0}</strong>
                      <div className="nea-muted">
                        {participants.length
                          ? participants
                              .map((item) =>
                                `${item.name || ""}${item.age ? ` (${item.age})` : ""}`
                              )
                              .join(", ")
                          : "--"}
                      </div>
                    </td>

                    <td>
                      <strong>{money(row.total_amount)}</strong>
                      <div className="nea-muted">
                        {money(row.price_per_person)} average
                      </div>
                    </td>

                    <td>
                      <CapacityBar
                        used={row.total_paid_participants || row.quantity}
                        capacity={row.capacity}
                      />
                    </td>

                    <td>
                      <span
                        className={
                          String(row.status || "").toLowerCase() === "paid"
                            ? "nea-pill nea-pill-published"
                            : "nea-pill nea-pill-draft"
                        }
                      >
                        {row.status || "pending"}
                      </span>
                    </td>

                    <td>{row.payment_number || "--"}</td>
                    <td>{row.receipt_number || "--"}</td>
                  </tr>
                );
              })}

            {!registrationsLoading && !sourceRows.length ? (
              <tr>
                <td colSpan={8} className="nea-empty-cell">
                  No registrations found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <div className="nea-page">
        <section className="nea-hero">
          <div>
            <p className="nea-eyebrow">Admin Calendar & Programs</p>
            <h2>News, Events, School & Trips</h2>
            <p>
              Manage annual calendar items, church announcements, registerable
              school programs with dynamic tier pricing, and trip programs with
              regular per-person pricing.
            </p>
          </div>

          <div className="nea-hero-actions">
            <button
              type="button"
              className="nea-primary-btn"
              onClick={() => openCreate("holiday")}
            >
              Add Calendar Item
            </button>

            <button
              type="button"
              className="nea-primary-btn"
              onClick={() => openCreate("kids")}
            >
              Add School Program
            </button>

            <button
              type="button"
              className="nea-primary-btn"
              onClick={() => openCreate("trip")}
            >
              Add Trip
            </button>

            <button
              type="button"
              className="nea-secondary-btn"
              onClick={() => openCreate("news")}
            >
              Add Announcement
            </button>
          </div>
        </section>

        {err ? <div className="auth-banner">{err}</div> : null}
        {success ? <div className="auth-success">{success}</div> : null}

        <section className="nea-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`nea-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </section>

        {activeTab !== "registrations" ? (
          <>
            <section className="nea-stats-grid">
              <article className="nea-stat-card">
                <span>Total Items</span>
                <strong>{eventSummary.total}</strong>
              </article>

              <article className="nea-stat-card">
                <span>Published</span>
                <strong>{eventSummary.published}</strong>
              </article>

              <article className="nea-stat-card">
                <span>Calendar</span>
                <strong>{eventSummary.holidays}</strong>
              </article>

              <article className="nea-stat-card">
                <span>School Programs</span>
                <strong>{eventSummary.school}</strong>
              </article>

              <article className="nea-stat-card">
                <span>Trips</span>
                <strong>{eventSummary.trips}</strong>
              </article>

              <article className="nea-stat-card">
                <span>Announcements</span>
                <strong>{eventSummary.news}</strong>
              </article>
            </section>

            <section className="nea-toolbar-card">
              <form
                className="nea-toolbar"
                onSubmit={(event) => {
                  event.preventDefault();
                  load();
                }}
              >
                <input
                  className="nea-input"
                  type="text"
                  placeholder="Search title, date, location, audience..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                <select
                  className="nea-select"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="all">All Categories</option>
                  {CATEGORY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <select
                  className="nea-select"
                  value={publishedFilter}
                  onChange={(event) => setPublishedFilter(event.target.value)}
                >
                  <option value="all">All Visibility</option>
                  <option value="published">Published Only</option>
                  <option value="draft">Draft Only</option>
                </select>

                <button type="submit" className="nea-primary-btn">
                  Search
                </button>
              </form>
            </section>

            <section className="nea-table-card">
              <div className="nea-table-topbar">
                <div className="nea-page-size">
                  <label htmlFor="rowsPerPage">Rows per page</label>
                  <select
                    id="rowsPerPage"
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="nea-table-wrap desktop-table">
                <table className="nea-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Name</th>
                      <th>Dates</th>
                      <th>Location</th>
                      <th>Pricing</th>
                      <th>Capacity</th>
                      <th>Image</th>
                      <th>Status</th>
                      <th>Summary</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={10} className="nea-empty-cell">
                          Loading...
                        </td>
                      </tr>
                    ) : null}

                    {!loading &&
                      pagedRows.map((row) => {
                        const isProgram = isProgramCategory(row.category);

                        return (
                          <tr key={row.id}>
                            <td>{categoryLabel(row.category)}</td>

                            <td className="nea-title-cell">
                              <strong>{row.title}</strong>
                              {isProgram && Number(row.registration_enabled || 0) ? (
                                <div className="nea-muted">Registration enabled</div>
                              ) : null}
                            </td>

                            <td>{fmtDateRange(row)}</td>
                            <td>{row.location || "--"}</td>

                            <td>
                              {isProgram ? <PricingSummary row={row} /> : "--"}
                            </td>

                            <td>
                              {isProgram ? (
                                <CapacityBar
                                  used={row.registered_quantity}
                                  capacity={row.capacity}
                                />
                              ) : (
                                "--"
                              )}
                            </td>

                            <td>
                              {row.flyer_url ? (
                                <button
                                  type="button"
                                  className="nea-mini-btn"
                                  onClick={() =>
                                    window.open(row.flyer_url, "_blank", "noopener")
                                  }
                                >
                                  Image
                                </button>
                              ) : (
                                "--"
                              )}
                            </td>

                            <td>
                              {Number(row.is_published || 0) ? (
                                <span className="nea-pill nea-pill-published">
                                  Published
                                </span>
                              ) : (
                                <span className="nea-pill nea-pill-draft">
                                  Draft
                                </span>
                              )}
                            </td>

                            <td>{stripHtml(row.summary || "").slice(0, 80) || "--"}</td>

                            <td className="nea-actions-cell">
                              <RowActionsMenu
                                hasImage={Boolean(row.flyer_url)}
                                canViewApplicants={isProgram}
                                onViewApplicants={() => openApplicants(row)}
                                onViewImage={() =>
                                  window.open(row.flyer_url, "_blank", "noopener")
                                }
                                onEdit={() => openEdit(row)}
                                onDelete={() => handleDelete(row.id)}
                              />
                            </td>
                          </tr>
                        );
                      })}

                    {!loading && !pagedRows.length ? (
                      <tr>
                        <td colSpan={10} className="nea-empty-cell">
                          No items found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="nea-pagination">
                <button
                  type="button"
                  className="nea-pagination-btn"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </button>

                <div className="nea-pagination-status">
                  Page {page} of {totalPages}
                </div>

                <button
                  type="button"
                  className="nea-pagination-btn"
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="nea-stats-grid">
              <article className="nea-stat-card">
                <span>Registrations</span>
                <strong>{registrationSummary.total}</strong>
              </article>

              <article className="nea-stat-card">
                <span>Paid</span>
                <strong>{registrationSummary.paid}</strong>
              </article>

              <article className="nea-stat-card">
                <span>Participants</span>
                <strong>{registrationSummary.participants}</strong>
              </article>

              <article className="nea-stat-card">
                <span>Revenue</span>
                <strong>{money(registrationSummary.revenue)}</strong>
              </article>
            </section>

            <section className="nea-toolbar-card">
              <form
                className="nea-toolbar"
                onSubmit={(event) => {
                  event.preventDefault();
                  loadRegistrations();
                }}
              >
                <input
                  className="nea-input"
                  type="text"
                  placeholder="Search registrant, email, phone, or program..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                <select
                  className="nea-select"
                  value={registrationCategoryFilter}
                  onChange={(event) =>
                    setRegistrationCategoryFilter(event.target.value)
                  }
                >
                  <option value="all">All Programs</option>
                  <option value="kids">School Programs</option>
                  <option value="trip">Trips</option>
                </select>

                <select
                  className="nea-select"
                  value={registrationStatusFilter}
                  onChange={(event) =>
                    setRegistrationStatusFilter(event.target.value)
                  }
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <button type="submit" className="nea-primary-btn">
                  Search
                </button>

                <button
                  type="button"
                  className="nea-primary-btn"
                  onClick={() => exportRegistrationsCSV(registrations)}
                  disabled={!registrations.length}
                >
                  Export CSV
                </button>
              </form>
            </section>

            <section className="nea-table-card">
              {renderRegistrationsTable(registrations)}
            </section>
          </>
        )}
      </div>

      {showParticipantsModal ? (
        <div
          className="nea-modal-overlay"
          onClick={() => setShowParticipantsModal(false)}
        >
          <div
            className="nea-modal nea-modal-wide"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="nea-modal-head">
              <h2>{participantsTitle} Registrations</h2>

              <button
                type="button"
                className="nea-close-btn"
                onClick={() => setShowParticipantsModal(false)}
              >
                x
              </button>
            </div>

            <div className="nea-modal-body">
              {renderRegistrationsTable(eventParticipants)}
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="nea-modal-overlay" onClick={resetModal}>
          <div
            className="nea-modal nea-modal-wide"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="nea-modal-head">
              <div>
                <h2>{form.id ? "Edit Calendar / Program" : "Add Calendar / Program"}</h2>
                <p>
                  Configure announcements, annual calendar items, school tier
                  pricing, and trip registration pricing.
                </p>
              </div>

              <button
                type="button"
                className="nea-close-btn"
                onClick={resetModal}
              >
                x
              </button>
            </div>

            <div className="nea-modal-body">
              {err ? <div className="auth-banner">{err}</div> : null}

              <form className="nea-form-screen" onSubmit={handleSave}>
                <div className="nea-image-upload-wrap">
                  <label className="nea-circle-upload">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleImageChange}
                      hidden
                    />

                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="nea-circle-preview"
                      />
                    ) : (
                      <span>
                        Click here
                        <br />
                        to add image
                      </span>
                    )}
                  </label>

                  {imagePreview ? (
                    <button
                      type="button"
                      className="nea-remove-image-btn"
                      onClick={clearImage}
                    >
                      Remove image
                    </button>
                  ) : null}
                </div>

                <div className="nea-form-grid">
                  <div className="nea-field">
                    <label>Category</label>
                    <select
                      value={form.category}
                      onChange={(event) => setField("category", event.target.value)}
                    >
                      {CATEGORY_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="nea-field">
                    <label>Title</label>
                    <input
                      value={form.title}
                      onChange={(event) => setField("title", event.target.value)}
                      placeholder="Enter title"
                      required
                    />
                  </div>

                  <div className="nea-field">
                    <label>Subtitle</label>
                    <input
                      value={form.subtitle}
                      onChange={(event) =>
                        setField("subtitle", event.target.value)
                      }
                      placeholder="Optional subtitle"
                    />
                  </div>

                  <div className="nea-field">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={form.start_date || ""}
                      onChange={(event) =>
                        setField("start_date", event.target.value)
                      }
                    />
                  </div>

                  <div className="nea-field">
                    <label>End Date</label>
                    <input
                      type="date"
                      value={form.end_date || ""}
                      onChange={(event) =>
                        setField("end_date", event.target.value)
                      }
                    />
                  </div>

                  <div className="nea-field">
                    <label>Start Time</label>
                    <input
                      type="time"
                      value={form.start_time || ""}
                      onChange={(event) =>
                        setField("start_time", event.target.value)
                      }
                    />
                  </div>

                  <div className="nea-field">
                    <label>End Time</label>
                    <input
                      type="time"
                      value={form.end_time || ""}
                      onChange={(event) =>
                        setField("end_time", event.target.value)
                      }
                    />
                  </div>

                  <div className="nea-field nea-form-col-full">
                    <label>Location</label>
                    <input
                      value={form.location}
                      onChange={(event) =>
                        setField("location", event.target.value)
                      }
                      placeholder="Required for school and trip programs"
                    />
                  </div>

                  <div className="nea-field nea-form-col-full">
                    <label>Audience</label>
                    <input
                      value={form.audience}
                      onChange={(event) =>
                        setField("audience", event.target.value)
                      }
                      placeholder="Optional audience"
                    />
                  </div>

                  <div className="nea-field nea-form-col-full">
                    <label>Image URL Fallback</label>
                    <input
                      value={form.flyer_url}
                      onChange={(event) => {
                        setField("flyer_url", event.target.value);

                        if (!imageFile && !removeExistingFlyer) {
                          setImagePreview(event.target.value);
                        }
                      }}
                      placeholder="Optional image URL if you are not uploading a file"
                    />
                  </div>

                  {form.category === "holiday" ? (
                    <div className="nea-field">
                      <label>Calendar Color</label>
                      <input
                        type="color"
                        value={form.holiday_color || "#4A75E6"}
                        onChange={(event) =>
                          setField("holiday_color", event.target.value)
                        }
                        className="nea-color-input"
                      />
                    </div>
                  ) : null}

                  {isProgramCategory(form.category) ? (
                    <>
                      {form.category === "trip" ? (
                        <div className="nea-field">
                          <label>Regular Price Per Person</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.price_per_person}
                            onChange={(event) =>
                              setField("price_per_person", event.target.value)
                            }
                            placeholder="0.00"
                          />
                        </div>
                      ) : null}

                      {form.category === "kids" ? (
                        <div className="nea-field">
                          <label>Fallback School Price</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.price_per_person}
                            onChange={(event) =>
                              setField("price_per_person", event.target.value)
                            }
                            placeholder="Optional fallback"
                          />
                        </div>
                      ) : null}

                      <div className="nea-field">
                        <label>Capacity</label>
                        <input
                          type="number"
                          min="1"
                          value={form.capacity}
                          onChange={(event) =>
                            setField("capacity", event.target.value)
                          }
                          placeholder="Optional capacity"
                        />
                      </div>

                      <div className="nea-field nea-form-col-full">
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(form.registration_enabled)}
                            onChange={(event) =>
                              setField(
                                "registration_enabled",
                                event.target.checked ? 1 : 0
                              )
                            }
                            style={{ width: "16px", marginRight: "8px" }}
                          />
                          Enable public and finance/admin registration
                        </label>
                      </div>

                      {form.category === "kids" ? (
                        <div className="nea-field nea-form-col-full">
                          <div className="nea-section-head">
                            <div>
                              <h3>School Discount Pricing</h3>
                              <p>
                                Add as many pricing tiers as needed. Amount can
                                be a total price for the quantity/range or a
                                per-student price.
                              </p>
                            </div>

                            <button
                              type="button"
                              className="nea-mini-btn"
                              onClick={addPricingTier}
                            >
                              Add Tier
                            </button>
                          </div>

                          <div className="nea-tier-list">
                            {normalizePricingTiers(form.pricing_tiers).map(
                              (tier, index) => (
                                <div className="nea-tier-row" key={index}>
                                  <input
                                    value={tier.tier_label}
                                    onChange={(event) =>
                                      updatePricingTier(
                                        index,
                                        "tier_label",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Label"
                                  />

                                  <input
                                    type="number"
                                    min="1"
                                    value={tier.min_quantity}
                                    onChange={(event) =>
                                      updatePricingTier(
                                        index,
                                        "min_quantity",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Min"
                                  />

                                  <input
                                    type="number"
                                    min="1"
                                    value={tier.max_quantity}
                                    onChange={(event) =>
                                      updatePricingTier(
                                        index,
                                        "max_quantity",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Max"
                                  />

                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={tier.amount}
                                    onChange={(event) =>
                                      updatePricingTier(
                                        index,
                                        "amount",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Amount"
                                  />

                                  <select
                                    value={tier.price_type}
                                    onChange={(event) =>
                                      updatePricingTier(
                                        index,
                                        "price_type",
                                        event.target.value
                                      )
                                    }
                                  >
                                    <option value="total">Total Price</option>
                                    <option value="per_person">
                                      Per Student
                                    </option>
                                  </select>

                                  <label className="nea-inline-check">
                                    <input
                                      type="checkbox"
                                      checked={Number(tier.is_active) === 1}
                                      onChange={(event) =>
                                        updatePricingTier(
                                          index,
                                          "is_active",
                                          event.target.checked ? 1 : 0
                                        )
                                      }
                                    />
                                    Active
                                  </label>

                                  <button
                                    type="button"
                                    className="nea-mini-btn danger"
                                    onClick={() => removePricingTier(index)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      ) : null}

                      <div className="nea-field nea-form-col-full">
                        <label>Registration Notes</label>
                        <textarea
                          className="rte-textarea"
                          value={form.registration_notes}
                          onChange={(event) =>
                            setField("registration_notes", event.target.value)
                          }
                          placeholder="Optional instructions for parents or participants"
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="nea-field nea-form-col-full">
                    <label>Summary</label>
                    <input
                      value={form.summary}
                      onChange={(event) =>
                        setField("summary", event.target.value)
                      }
                      placeholder="Short summary"
                    />
                  </div>

                  <div className="nea-field nea-form-col-full">
                    <label>Description</label>
                    <textarea
                      className="rte-textarea"
                      value={form.body_html}
                      onChange={(event) =>
                        setField("body_html", event.target.value)
                      }
                      placeholder="Enter detailed description"
                    />
                  </div>

                  <div className="nea-field nea-form-col-full">
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(form.is_published)}
                        onChange={(event) =>
                          setField("is_published", event.target.checked ? 1 : 0)
                        }
                        style={{ width: "16px", marginRight: "8px" }}
                      />
                      Publish now
                    </label>
                  </div>
                </div>

                <div className="nea-modal-actions nea-modal-actions-left">
                  <button type="submit" className="nea-add-btn">
                    {form.id ? "Update Item" : "Add Item"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}