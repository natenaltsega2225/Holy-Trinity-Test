// frontend/src/components/FinanceDashboard/pages/InvoiceGenerator.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Link as LinkIcon,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";

import api from "../../api";

// import "../../../styles/finance-enterprise.css";
// import "../../../styles/finance-dashboard.css";
import "../../../styles/finance-enterprise.css";
const CATEGORY_LABELS = {
  membership: "አባልነት — Membership Dues",
  membership_registration: "አባልነት — Membership Registration",

  plate_collection: "መባ — Plate Collection",
  candle_sale: "ሻማ — Candle Sale",
  general_donation: "ስጦታ — General Donation",
  tithe: "አስራት — Tithe",
  vows: "ስዕለት — Vows",
  baptism: "ክርስትና — Baptism",
  wedding_engagement: "ጋብቻ / ቀለበት — Wedding / Engagement",
  memorial_service: "ፍታት — Memorial Service",
  pledge: "ቃል የተገባ — Pledge",
  building_fund: "የቤተክርስቲያን ማሰሪያ — Building Fund",
  charity_fund: "በጎ አድራጎት — Charity Fund",
  auction: "ጨረታ — Auction",
  other_fund: "ሌላ — Other Fund",

  school: "ትምህርት — School Program",
  kids: "ትምህርት — School Program",
  trip: "ጉዞ — Trip Program",
  manual: "ሌላ — Manual Invoice",
};

const PAYER_TYPES = [
  { value: "member", label: "Member" },
  { value: "guest", label: "Non Member / Guest" },
];

const INVOICE_TYPES = [
  { value: "membership", label: CATEGORY_LABELS.membership },
  { value: "donation", label: "ስጦታ — Donation" },
  { value: "pledge", label: CATEGORY_LABELS.pledge },
  { value: "school", label: CATEGORY_LABELS.school },
  { value: "trip", label: CATEGORY_LABELS.trip },
  { value: "manual", label: CATEGORY_LABELS.manual },
];

const DONATION_CATEGORIES = [
  { value: "plate_collection", label: CATEGORY_LABELS.plate_collection },
  { value: "candle_sale", label: CATEGORY_LABELS.candle_sale },
  { value: "general_donation", label: CATEGORY_LABELS.general_donation },
  { value: "tithe", label: CATEGORY_LABELS.tithe },
  { value: "vows", label: CATEGORY_LABELS.vows },
  { value: "baptism", label: CATEGORY_LABELS.baptism },
  { value: "wedding_engagement", label: CATEGORY_LABELS.wedding_engagement },
  { value: "memorial_service", label: CATEGORY_LABELS.memorial_service },
  { value: "pledge", label: CATEGORY_LABELS.pledge },
  { value: "building_fund", label: CATEGORY_LABELS.building_fund },
  { value: "charity_fund", label: CATEGORY_LABELS.charity_fund },
  { value: "auction", label: CATEGORY_LABELS.auction },
  { value: "other_fund", label: CATEGORY_LABELS.other_fund },
];

const PLEDGE_PAYMENT_OPTIONS = [
  { value: "pay_upfront", label: "Paying Upfront" },
  { value: "partial_payment", label: "Paying Partially" },
  { value: "pay_later", label: "Pay Later" },
];

const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, index) => ({ value: index + 1, label }));

const EMPTY_GUEST = {
  first_name: "",
  last_name: "",
  full_name: "",
  email: "",
  phone: "",
};

function rowsFrom(data) {
  const queue = [data];
  const seen = new Set();

  while (queue.length) {
    const item = queue.shift();

    if (!item || seen.has(item)) continue;
    seen.add(item);

    if (Array.isArray(item)) return item;

    for (const key of [
      "rows",
      "data",
      "items",
      "results",
      "records",
      "list",
      "members",
      "plans",
      "programs",
      "school_programs",
      "schoolPrograms",
      "trip_programs",
      "tripPrograms",
      "trips",
      "events",
      "news_events",
      "newsEvents",
      "campaigns",
      "pledges",
      "payload",
      "result",
    ]) {
      if (Array.isArray(item?.[key])) return item[key];
      if (item?.[key] && typeof item[key] === "object") {
        queue.push(item[key]);
      }
    }
  }

  return [];
}

function clean(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function labelForCategory(value) {
  return CATEGORY_LABELS[String(value || "").toLowerCase()] || clean(value) || "--";
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}
function memberName(member = {}) {
  return (
    member.full_name ||
    `${member.first_name || ""} ${member.last_name || ""}`.trim() ||
    "Unnamed Member"
  );
}

function guestName(guest = {}) {
  return (
    guest.full_name ||
    `${guest.first_name || ""} ${guest.last_name || ""}`.trim()
  );
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function dueDateDefault() {
  const date = new Date();
  date.setDate(date.getDate() + 15);
  return date.toISOString().slice(0, 10);
}

function normalizeProgram(row = {}, fallbackCategory = "") {
  const rawCategory = String(
    row.category ||
      row.program_category ||
      row.type ||
      fallbackCategory ||
      ""
  ).toLowerCase();

  const category =
    rawCategory === "kids" ||
    rawCategory === "school_program" ||
    rawCategory === "school-program" ||
    rawCategory === "school"
      ? "school"
      : rawCategory === "trip_program" ||
        rawCategory === "trip-program" ||
        rawCategory === "trip"
      ? "trip"
      : fallbackCategory;

  const id =
    row.id ||
    row.program_id ||
    row.news_event_id ||
    row.event_id ||
    row.newsEventId;

  const tiers = parseJsonArray(
    row.pricing_tiers ||
      row.pricing_tiers_json ||
      row.price_tiers ||
      row.tiers
  );

  return {
    ...row,
    id,
    category,
    title:
      row.title ||
      row.program_name ||
      row.trip_name ||
      row.name ||
      row.event_title ||
      row.program_title ||
      `Program #${id || ""}`.trim(),
    price:
      row.price_per_person ||
      row.regular_price ||
      row.default_price ||
      row.price ||
      row.amount ||
      row.unit_price ||
      0,
    location: row.location || "",
    pricing_tiers: tiers,
    registration_enabled:
      row.registration_enabled ??
      row.is_registration_enabled ??
      row.registerable ??
      1,
  };
}

function programAmount(program, quantity, type, manualUnitAmount = 0) {
  const qty = Math.max(1, Number(quantity || 1));

  if (!program) {
    return numberValue(manualUnitAmount) * qty;
  }

  if (type === "school") {
    const tier = parseJsonArray(program.pricing_tiers).find((item) => {
      const min = Number(item.min_quantity || item.quantity || item.student_count || 0);
      const max = Number(item.max_quantity || item.quantity || item.student_count || min);
      return qty >= min && qty <= max;
    });

    if (tier) {
      return numberValue(
        tier.amount ||
          tier.total_amount ||
          tier.price ||
          tier.tier_amount
      );
    }
  }

  return numberValue(
    program.price ||
      program.price_per_person ||
      program.regular_price ||
      program.default_price ||
      program.amount ||
      program.unit_price ||
      manualUnitAmount
  ) * qty;
}

function normalizeCampaign(row = {}) {
  return {
    ...row,
    id: row.id || row.campaign_id,
    title:
      row.title ||
      row.campaign_name ||
      row.name ||
      `Pledge Campaign #${row.id || row.campaign_id || ""}`,
    goal_amount: row.goal_amount || row.target_amount || row.amount || 0,
  };
}

function coverageEnd(startYear, startMonth, months) {
  const date = new Date(
    Number(startYear),
    Number(startMonth) - 1 + Number(months || 1) - 1,
    1
  );

  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

async function postFirst(paths, payload) {
  let lastError = null;

  for (const path of paths.filter(Boolean)) {
    try {
      return await api.post(path, payload);
    } catch (err) {
      lastError = err;

      const status = err?.response?.status;
      if (status && status !== 404 && status !== 405) {
        throw err;
      }
    }
  }

  throw lastError;
}

function paymentLinkFrom(payload = {}) {
  const candidates = [
    payload.payment_link,
    payload.paymentLink,
    payload.payment_url,
    payload.paymentUrl,
    payload.payment_link_url,
    payload.paymentLinkUrl,
    payload.pay_url,
    payload.payUrl,
    payload.pay_link,
    payload.payLink,
    payload.checkout_url,
    payload.checkoutUrl,
    payload.checkout_link,
    payload.checkoutLink,
    payload.public_checkout_url,
    payload.publicCheckoutUrl,
    payload.public_payment_link,
    payload.publicPaymentLink,
    payload.public_url,
    payload.publicUrl,
    payload.url,
    payload.links?.pay_url,
    payload.links?.payUrl,
    payload.links?.payment_url,
    payload.links?.paymentUrl,
    payload.links?.payment_link,
    payload.links?.paymentLink,
    payload.links?.checkout_url,
    payload.links?.checkoutUrl,
    payload.links?.checkout_link,
    payload.links?.checkoutLink,
    payload.links?.public_checkout_url,
    payload.links?.publicCheckoutUrl,
    payload.links?.public_payment_link,
    payload.links?.publicPaymentLink,
    payload.links?.view_url,
    payload.invoice?.payment_link,
    payload.invoice?.paymentLink,
    payload.invoice?.payment_url,
    payload.invoice?.paymentUrl,
    payload.invoice?.pay_url,
    payload.invoice?.payUrl,
    payload.invoice?.checkout_url,
    payload.invoice?.checkoutUrl,
    payload.invoice?.checkout_link,
    payload.invoice?.checkoutLink,
    payload.invoice?.public_checkout_url,
    payload.invoice?.publicCheckoutUrl,
    payload.invoice?.public_payment_link,
    payload.invoice?.publicPaymentLink,
    payload.invoice?.links?.pay_url,
    payload.invoice?.links?.payUrl,
    payload.invoice?.links?.payment_url,
    payload.invoice?.links?.paymentUrl,
    payload.invoice?.links?.payment_link,
    payload.invoice?.links?.paymentLink,
    payload.invoice?.links?.checkout_url,
    payload.invoice?.links?.checkoutUrl,
    payload.invoice?.links?.checkout_link,
    payload.invoice?.links?.checkoutLink,
    payload.invoice?.links?.public_checkout_url,
    payload.invoice?.links?.publicCheckoutUrl,
    payload.invoice?.links?.public_payment_link,
    payload.invoice?.links?.publicPaymentLink,
    payload.invoice?.links?.view_url,
    payload.row?.payment_link,
    payload.row?.paymentLink,
    payload.row?.payment_url,
    payload.row?.checkout_url,
    payload.row?.checkout_link,
    payload.row?.links?.pay_url,
    payload.row?.links?.payment_link,
    payload.row?.links?.checkout_url,
    payload.row?.links?.checkout_link,
    payload.data?.payment_link,
    payload.data?.paymentLink,
    payload.data?.payment_url,
    payload.data?.paymentUrl,
    payload.data?.pay_url,
    payload.data?.payUrl,
    payload.data?.checkout_url,
    payload.data?.checkoutUrl,
    payload.data?.checkout_link,
    payload.data?.checkoutLink,
    payload.data?.public_checkout_url,
    payload.data?.public_payment_link,
    payload.data?.links?.pay_url,
    payload.data?.links?.payUrl,
    payload.data?.links?.payment_url,
    payload.data?.links?.paymentUrl,
    payload.data?.links?.payment_link,
    payload.data?.links?.paymentLink,
    payload.data?.links?.checkout_url,
    payload.data?.links?.checkoutUrl,
    payload.data?.links?.checkout_link,
    payload.data?.links?.checkoutLink,
    payload.data?.links?.public_checkout_url,
    payload.data?.links?.public_payment_link,
    payload.data?.links?.view_url,
    payload.result?.payment_link,
    payload.result?.payment_url,
    payload.result?.checkout_url,
    payload.result?.checkout_link,
    payload.result?.links?.payment_link,
    payload.result?.links?.checkout_url,
    payload.payload?.payment_link,
    payload.payload?.payment_url,
    payload.payload?.checkout_url,
    payload.payload?.checkout_link,
    payload.payload?.links?.payment_link,
    payload.payload?.links?.checkout_url,
  ];

  return clean(candidates.find((candidate) => clean(candidate)));
}

function withCheckoutMethod(url, method = "card") {
  const rawUrl = clean(url);
  const rawMethod = clean(method || "card").toLowerCase();

  if (!rawUrl || !["card", "ach"].includes(rawMethod)) {
    return rawUrl;
  }

  try {
    const parsed =
      rawUrl.startsWith("/")
        ? new URL(rawUrl, window.location.origin)
        : new URL(rawUrl);

    parsed.searchParams.set("method", rawMethod);

    if (rawUrl.startsWith("/")) {
      return `${parsed.pathname}${parsed.search}`;
    }

    return parsed.toString();
  } catch {
    const separator = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${separator}method=${encodeURIComponent(rawMethod)}`;
  }
}

function invoiceFromResponse(payload = {}) {
  return (
    payload.invoice ||
    payload.row ||
    payload.record ||
    payload.data?.invoice ||
    payload.data?.row ||
    payload.data?.record ||
    payload.data ||
    payload ||
    {}
  );
}

function invoiceIdFromResponse(payload = {}) {
  const invoice = invoiceFromResponse(payload);
  return (
    invoice.id ||
    invoice.invoice_id ||
    invoice.finance_invoice_id ||
    payload.invoice_id ||
    payload.id ||
    payload.data?.invoice_id ||
    payload.result?.invoice_id ||
    null
  );
}

function invoiceNumberFromResponse(payload = {}) {
  const invoice = invoiceFromResponse(payload);

  return clean(
    invoice.invoice_number ||
      invoice.invoice_no ||
      invoice.number ||
      payload.invoice_number ||
      payload.invoice_no ||
      payload.number ||
      payload.data?.invoice_number ||
      payload.result?.invoice_number ||
      ""
  );
}

export default function InvoiceGenerator() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  const [memberSearch, setMemberSearch] = useState("");
  const [payerType, setPayerType] = useState("member");
  const [selectedMember, setSelectedMember] = useState(null);
  const [guest, setGuest] = useState(EMPTY_GUEST);

  const [invoiceType, setInvoiceType] = useState("membership");
  const [invoiceDate, setInvoiceDate] = useState(todayDate());
  const [dueDate, setDueDate] = useState(dueDateDefault());
  const [notes, setNotes] = useState("");

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [coverageStartMonth, setCoverageStartMonth] = useState(
    new Date().getMonth() + 1
  );
  const [coverageYear, setCoverageYear] = useState(new Date().getFullYear());

  const [donationCategory, setDonationCategory] = useState("general_donation");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [programName, setProgramName] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [pledgePaymentOption, setPledgePaymentOption] = useState("pay_later");

  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState("");

  const [sendEmail, setSendEmail] = useState(true);
  const [attachPdf, setAttachPdf] = useState(true);
  const [includePaymentLink, setIncludePaymentLink] = useState(true);
  const [createPdf, setCreatePdf] = useState(true);

  const [lineItems, setLineItems] = useState([
    {
      item_name: "Custom Invoice Item",
      description: "",
      quantity: 1,
      unit_price: "",
    },
  ]);

  useEffect(() => {
    loadInitialData();
    loadMembers("");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMembers(memberSearch);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [memberSearch]);

  useEffect(() => {
    setError("");
    setSuccess("");
    setSelectedProgramId("");
    setProgramName("");
    setSelectedCampaignId("");

    if (invoiceType === "donation") {
      setDonationCategory("general_donation");
    }

    if (invoiceType === "pledge") {
      setDonationCategory("pledge");
      setIncludePaymentLink(true);
    }
  }, [invoiceType]);

  async function loadInitialData() {
    try {
      setLoading(true);

      const [plansRes, schoolRes, tripRes, campaignsRes] = await Promise.all([
        api.get("/dues/plans").catch(() => ({ data: { rows: [] } })),
        api.get("/school/programs", { params: { include_past: 1, include_sold_out: 1 } }).catch(() => ({ data: { rows: [] } })),
        api.get("/trip/programs", { params: { include_past: 1, include_sold_out: 1 } }).catch(() => ({ data: { rows: [] } })),
        api.get("/finance/campaigns").catch(() => ({ data: { rows: [] } })),
      ]);

      const nextPlans = rowsFrom(plansRes.data);
      const schoolPrograms = rowsFrom(schoolRes.data).map((row) =>
        normalizeProgram(row, "school")
      );
      const tripPrograms = rowsFrom(tripRes.data).map((row) =>
        normalizeProgram(row, "trip")
      );

      setPlans(nextPlans);
      setPrograms([...schoolPrograms, ...tripPrograms]);
      setCampaigns(rowsFrom(campaignsRes.data).map(normalizeCampaign));

      if (!selectedPlanId && nextPlans.length) {
        setSelectedPlanId(String(nextPlans[0].id));
      }
    } catch (err) {
      console.error("Invoice generator load failed:", err);
      setError("Unable to load invoice reference data.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers(search = "") {
    try {
      setLoadingMembers(true);

      const { data } = await api.get("/finance/members", {
        params: {
          page: 1,
          limit: 100,
          pageSize: 100,
          q: search,
          search,
        },
      });

      setMembers(rowsFrom(data));
    } catch (err) {
      console.error("Member search failed:", err);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }

  const selectedPlan = useMemo(
    () => plans.find((plan) => String(plan.id) === String(selectedPlanId)),
    [plans, selectedPlanId]
  );

  const filteredPrograms = useMemo(() => {
    if (invoiceType === "school") {
      return programs.filter((program) =>
        ["school", "kids", "school_program", "school-program"].includes(
          String(program.category || "").toLowerCase()
        )
      );
    }

    if (invoiceType === "trip") {
      return programs.filter((program) =>
        ["trip", "trip_program", "trip-program"].includes(
          String(program.category || "").toLowerCase()
        )
      );
    }

    return [];
  }, [invoiceType, programs]);

  const selectedProgram = useMemo(
    () =>
      filteredPrograms.find(
        (program) => String(program.id) === String(selectedProgramId)
      ),
    [filteredPrograms, selectedProgramId]
  );

  const selectedCampaign = useMemo(
    () =>
      campaigns.find(
        (campaign) => String(campaign.id) === String(selectedCampaignId)
      ),
    [campaigns, selectedCampaignId]
  );

  const coverageMonths = Math.max(
    1,
    Number(selectedPlan?.duration_months || selectedPlan?.months || 1)
  );

  const coverageEndData = coverageEnd(
    coverageYear,
    coverageStartMonth,
    coverageMonths
  );

  const generatedItems = useMemo(() => {
    if (invoiceType === "membership") {
      const price = numberValue(
        selectedPlan?.minimum_amount ||
          selectedPlan?.membership_amount ||
          selectedPlan?.amount ||
          selectedPlan?.price
      );

      const planName =
        selectedPlan?.plan_name || selectedPlan?.name || "Membership Dues";

      return [
        {
          item_type: "membership",
          item_name: planName,
          description: `${planName} | ${coverageMonths} month(s) membership coverage`,
          quantity: 1,
          unit_price: price,
          total_price: price,
        },
      ];
    }

    if (invoiceType === "donation") {
      const value = numberValue(amount);
      const label = labelForCategory(donationCategory);

      return [
        {
          item_type: "donation",
          item_name: label,
          description: `Donation category: ${label}`,
          quantity: 1,
          unit_price: value,
          total_price: value,
        },
      ];
    }

    if (invoiceType === "school" || invoiceType === "trip") {
      const qty = Math.max(1, numberValue(quantity));
      const title =
        selectedProgram?.title ||
        clean(programName) ||
        (invoiceType === "school" ? "School Program" : "Trip Program");
      const total = programAmount(selectedProgram, qty, invoiceType, amount);
      const unit = qty > 0 ? total / qty : total;

      return [
        {
          item_type: invoiceType,
          item_name: title,
          description: `${
            invoiceType === "school" ? CATEGORY_LABELS.school : CATEGORY_LABELS.trip
          } | ${title} | ${qty} participant(s)`,
          quantity: qty,
          unit_price: unit,
          total_price: total,
        },
      ];
    }

    if (invoiceType === "pledge") {
      const value = numberValue(amount);
      const campaignTitle = selectedCampaign?.title || "General Pledge";
      const optionLabel =
        PLEDGE_PAYMENT_OPTIONS.find((item) => item.value === pledgePaymentOption)
          ?.label || "Pay Later";

      return [
        {
          item_type: "pledge",
          item_name: campaignTitle,
          description: `${CATEGORY_LABELS.pledge} | ${optionLabel}`,
          quantity: 1,
          unit_price: value,
          total_price: value,
        },
      ];
    }

    return lineItems.map((item) => {
      const qty = Math.max(1, numberValue(item.quantity));
      const unit = numberValue(item.unit_price);

      return {
        ...item,
        item_type: "manual",
        quantity: qty,
        unit_price: unit,
        total_price: qty * unit,
      };
    });
  }, [
    invoiceType,
    selectedPlan,
    coverageMonths,
    amount,
    donationCategory,
    selectedProgram,
    programName,
    quantity,
    selectedCampaign,
    pledgePaymentOption,
    lineItems,
  ]);

  const totalAmount = generatedItems.reduce(
    (sum, item) => sum + numberValue(item.total_price),
    0
  );

  const payerName =
    payerType === "member" ? memberName(selectedMember || {}) : guestName(guest);

  const payerEmail =
    payerType === "member" ? selectedMember?.email || "" : guest.email;

  const payerPhone =
    payerType === "member" ? selectedMember?.phone || "" : guest.phone;

  function updateGuest(key, value) {
    setGuest((previous) => ({
      ...previous,
      [key]: value,
      full_name:
        key === "first_name" || key === "last_name"
          ? `${key === "first_name" ? value : previous.first_name} ${
              key === "last_name" ? value : previous.last_name
            }`.trim()
          : previous.full_name,
    }));
  }

  function updateLineItem(index, key, value) {
    setLineItems((previous) =>
      previous.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [key]: value } : item
      )
    );
  }

  function addLineItem() {
    setLineItems((previous) => [
      ...previous,
      {
        item_name: "Custom Invoice Item",
        description: "",
        quantity: 1,
        unit_price: "",
      },
    ]);
  }

  function removeLineItem(index) {
    setLineItems((previous) =>
      previous.filter((_, currentIndex) => currentIndex !== index)
    );
  }

  function validate() {
    if (payerType === "member" && !selectedMember?.id) {
      return "Please select a member.";
    }

    if (payerType === "guest") {
      if (!clean(guest.first_name)) return "Guest first name is required.";
      if (!clean(guest.last_name)) return "Guest last name is required.";
      if (!clean(guest.email)) return "Guest email is required.";
      if (!clean(guest.phone)) return "Guest phone is required.";
    }

    if (!clean(payerEmail) && sendEmail) {
      return "Recipient email is required to send invoice email.";
    }

    if (!dueDate) return "Due date is required.";

    if (invoiceType === "membership" && !selectedPlan?.id) {
      return "Please select a membership plan.";
    }

    if (invoiceType === "school" || invoiceType === "trip") {
      if (!selectedProgram?.id && !clean(programName)) {
        return "Please select a program or enter a program name.";
      }
    }

    if (invoiceType === "pledge" && numberValue(amount) <= 0) {
      return "Pledge invoice amount is required.";
    }

    if (totalAmount <= 0) {
      return "Invoice amount must be greater than zero.";
    }

    return "";
  }

  function payerPayload() {
    return {
      payer_type: payerType,
      donor_type: payerType === "member" ? "member" : "non_member",
      member_id: payerType === "member" ? selectedMember?.id || null : null,
      member_no: payerType === "member" ? selectedMember?.member_no || null : null,

      first_name:
        payerType === "member"
          ? selectedMember?.first_name || null
          : guest.first_name || null,
      last_name:
        payerType === "member"
          ? selectedMember?.last_name || null
          : guest.last_name || null,

      full_name: payerName || null,
      email: payerEmail || null,
      phone: payerPhone || null,

      guest_name: payerType === "guest" ? payerName || null : null,
      guest_email: payerType === "guest" ? payerEmail || null : null,
      guest_phone: payerType === "guest" ? payerPhone || null : null,
    };
  }

  function buildPayload() {
    const isProgram = invoiceType === "school" || invoiceType === "trip";
    const programTitle =
      selectedProgram?.title ||
      clean(programName) ||
      (invoiceType === "school" ? "School Program" : "Trip Program");

    const campaignTitle = selectedCampaign?.title || "General Pledge";

    return {
      ...payerPayload(),

      invoice_type: invoiceType,
      payment_type: invoiceType,
      category: invoiceType === "manual" ? "invoice" : invoiceType,
      sub_category:
        invoiceType === "donation"
          ? donationCategory
          : invoiceType === "membership"
          ? selectedPlan?.plan_name || selectedPlan?.name
          : isProgram
          ? programTitle
          : invoiceType === "pledge"
          ? campaignTitle
          : "manual_invoice",

      donation_category:
        invoiceType === "donation"
          ? donationCategory
          : invoiceType === "pledge"
          ? "pledge"
          : null,
      donation_category_label:
        invoiceType === "donation"
          ? labelForCategory(donationCategory)
          : invoiceType === "pledge"
          ? CATEGORY_LABELS.pledge
          : null,

      pledge_category: invoiceType === "pledge" ? "pledge" : null,
      pledge_payment_option:
        invoiceType === "pledge" ? pledgePaymentOption : null,
      create_pledge: invoiceType === "pledge",
      create_pledge_record: invoiceType === "pledge",
      pledge_invoice: invoiceType === "pledge",

      plan_id: invoiceType === "membership" ? selectedPlan?.id : null,
      dues_plan_id: invoiceType === "membership" ? selectedPlan?.id : null,
      plan_name:
        invoiceType === "membership"
          ? selectedPlan?.plan_name || selectedPlan?.name
          : null,

      program_id: isProgram ? selectedProgram?.id || null : null,
      news_event_id: isProgram ? selectedProgram?.id || null : null,
      event_id: isProgram ? selectedProgram?.id || null : null,
      program_name: isProgram ? programTitle : null,
      program_title: isProgram ? programTitle : null,
      program_category: isProgram ? invoiceType : null,
      program_type: isProgram ? invoiceType : null,

      campaign_id:
        invoiceType === "pledge" && selectedCampaign?.id
          ? selectedCampaign.id
          : null,
      campaign_name: invoiceType === "pledge" ? campaignTitle : null,
      pledge_type: invoiceType === "pledge" ? pledgePaymentOption : null,
      pledge_status: invoiceType === "pledge" ? "active" : null,
      pledged_amount: invoiceType === "pledge" ? totalAmount : null,
      pledge_amount: invoiceType === "pledge" ? totalAmount : null,
      upfront_amount: 0,
      remaining_balance: invoiceType === "pledge" ? totalAmount : null,

      quantity: Math.max(1, numberValue(quantity)),
      amount: totalAmount,
      total_amount: totalAmount,
      invoice_amount: totalAmount,
      invoice_total_amount: totalAmount,
      subtotal_amount: totalAmount,
      amount_due: totalAmount,
      payment_link_amount: totalAmount,
      checkout_amount: totalAmount,
      paid_amount: 0,
      balance_due: totalAmount,

      invoice_date: invoiceDate,
      due_date: dueDate,
      status: "open",
      invoice_status: "open",

      coverage_year: invoiceType === "membership" ? Number(coverageYear) : null,
      coverage_start_month:
        invoiceType === "membership" ? Number(coverageStartMonth) : null,
      coverage_end_month:
        invoiceType === "membership" ? Number(coverageEndData.month) : null,
      coverage_end_year:
        invoiceType === "membership" ? Number(coverageEndData.year) : null,
      months_paid: invoiceType === "membership" ? coverageMonths : null,
      duration_months: invoiceType === "membership" ? coverageMonths : null,

      notes: notes || null,
      description: notes || null,

      items: generatedItems,
      line_items: generatedItems,
      invoice_items: generatedItems,

      create_pdf: !!createPdf,
      send_email: false,
      send_invoice_email: false,
      defer_invoice_email: !!sendEmail,
      requested_send_invoice_email: !!sendEmail,
      email_after_payment_link: false,
      attach_pdf: !!attachPdf,
      include_pdf: !!attachPdf,
      create_payment_link: !!includePaymentLink || !!sendEmail,
      public_payment_link: !!includePaymentLink || !!sendEmail,
      include_payment_link: !!includePaymentLink || !!sendEmail,
      send_payment_link: !!sendEmail || !!includePaymentLink,
      payment_link_required: true,
      force_payment_link: !!includePaymentLink || !!sendEmail,
      include_checkout_link: !!includePaymentLink || !!sendEmail,

      metadata: {
        invoice_type: invoiceType,
        donation_category:
          invoiceType === "donation"
            ? donationCategory
            : invoiceType === "pledge"
            ? "pledge"
            : null,
        donation_category_label:
          invoiceType === "donation"
            ? labelForCategory(donationCategory)
            : invoiceType === "pledge"
            ? CATEGORY_LABELS.pledge
            : null,
        pledge_payment_option:
          invoiceType === "pledge" ? pledgePaymentOption : null,
        program_category: isProgram ? invoiceType : null,
        program_name: isProgram ? programTitle : null,
        program_id: isProgram ? selectedProgram?.id || null : null,
        news_event_id: isProgram ? selectedProgram?.id || null : null,
        campaign_name: invoiceType === "pledge" ? campaignTitle : null,
        pledge_type: invoiceType === "pledge" ? pledgePaymentOption : null,
        pledged_amount: invoiceType === "pledge" ? totalAmount : null,
      },

      source: "finance",
      created_from: "finance_invoice_generator",
    };
  }

  async function ensureInvoicePaymentLink(invoiceResponse, sourcePayload = {}) {
    const responseData = invoiceResponse?.data || invoiceResponse || {};
    const existingLink = paymentLinkFrom(responseData);
    const checkoutMethod = sourcePayload.checkout_method || sourcePayload.payment_method || "card";

    if (existingLink) {
      return withCheckoutMethod(existingLink, checkoutMethod);
    }

    const invoiceId = invoiceIdFromResponse(responseData);
    const invoiceNumber = invoiceNumberFromResponse(responseData);

    if (!invoiceId && !invoiceNumber) {
      return "";
    }

    const linkAmount = numberValue(
      sourcePayload.payment_link_amount ||
        sourcePayload.checkout_amount ||
        sourcePayload.amount_due ||
        sourcePayload.invoice_amount ||
        sourcePayload.invoice_total_amount ||
        sourcePayload.balance_due ||
        sourcePayload.total_amount ||
        sourcePayload.amount
    );

    const linkPayload = {
      ...sourcePayload,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      amount: linkAmount,
      total_amount: linkAmount,
      invoice_amount: linkAmount,
      invoice_total_amount: linkAmount,
      amount_due: linkAmount,
      payment_link_amount: linkAmount,
      checkout_amount: linkAmount,
      balance_due: linkAmount,
      method: sourcePayload.checkout_method || "card",
      payment_method: sourcePayload.checkout_method || "card",
      checkout_method: sourcePayload.checkout_method || "card",
      create_payment_link: true,
      public_payment_link: true,
      include_payment_link: true,
      include_checkout_link: true,
      send_payment_link: true,
      payment_link_required: true,
      force_payment_link: true,
      send_email: !!sendEmail,
      send_invoice_email: !!sendEmail,
      attach_pdf: !!attachPdf,
      include_pdf: !!attachPdf,
      create_pdf: !!createPdf,
    };

    try {
      const linkResponse = await postFirst(
        [
          ...(invoiceId
            ? [
                `/finance/invoices/${invoiceId}/payment-link`,
                `/invoices/${invoiceId}/payment-link`,
                `/finance/invoices/${invoiceId}/checkout-link`,
                `/invoices/${invoiceId}/checkout-link`,
              ]
            : []),
          ...(invoiceNumber
            ? [
                `/public/invoices/${encodeURIComponent(invoiceNumber)}/payment-link`,
                `/public/invoices/${encodeURIComponent(invoiceNumber)}/checkout-link`,
                `/finance/invoices/${encodeURIComponent(invoiceNumber)}/payment-link`,
                `/invoices/${encodeURIComponent(invoiceNumber)}/payment-link`,
                `/finance/invoices/${encodeURIComponent(invoiceNumber)}/checkout-link`,
                `/invoices/${encodeURIComponent(invoiceNumber)}/checkout-link`,
              ]
            : []),
        ],
        {
          ...linkPayload,
          send_email: false,
          send_invoice_email: false,
          force_payment_link: true,
        }
      );

      const generatedLink = paymentLinkFrom(linkResponse?.data);
      if (generatedLink) {
        return withCheckoutMethod(generatedLink, checkoutMethod);
      }
    } catch (linkErr) {
      console.warn("Invoice payment-link endpoint fallback failed:", linkErr);
    }

    if (sendEmail) {
      try {
        const emailResponse = await postFirst(
          [
            ...(invoiceId
              ? [
                  `/finance/invoices/${invoiceId}/send-email`,
                  `/invoices/${invoiceId}/send-email`,
                  `/finance/invoices/${invoiceId}/email`,
                  `/invoices/${invoiceId}/email`,
                ]
              : []),
            ...(invoiceNumber
              ? [
                  `/finance/invoices/${encodeURIComponent(invoiceNumber)}/send-email`,
                  `/invoices/${encodeURIComponent(invoiceNumber)}/send-email`,
                  `/finance/invoices/${encodeURIComponent(invoiceNumber)}/email`,
                  `/invoices/${encodeURIComponent(invoiceNumber)}/email`,
                ]
              : []),
          ],
          {
            ...linkPayload,
            send_email: true,
            send_invoice_email: true,
            force_payment_link: true,
          }
        );

        const emailedLink = paymentLinkFrom(emailResponse?.data);
        if (emailedLink) {
          return withCheckoutMethod(emailedLink, checkoutMethod);
        }
      } catch (emailErr) {
        console.warn("Invoice payment-link email fallback failed:", emailErr);
      }
    }

    return "";
  }

  async function handleSubmit() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const validationError = validate();

      if (validationError) {
        setError(validationError);
        return;
      }

      const payload = buildPayload();

      const invoiceResponse = await postFirst(
        ["/finance/invoices", "/invoices"],
        payload
      );
      const { data } = invoiceResponse;

      const invoice = invoiceFromResponse(data);
      const invoiceId = invoiceIdFromResponse(data);
      const invoiceNumber = invoiceNumberFromResponse(data);
      const paymentLink = await ensureInvoicePaymentLink(invoiceResponse, payload);
      const createResponseHasPaymentLink = Boolean(paymentLink || paymentLinkFrom(data));
      const createResponseSentEmail = Boolean(
        data?.email_result ||
          data?.email?.messageId ||
          data?.email?.accepted ||
          data?.notification?.messageId
      );

      if (sendEmail && (invoiceId || invoiceNumber) && (!createResponseSentEmail || includePaymentLink)) {
        await postFirst(
          [
            ...(invoiceId
              ? [
                  `/finance/invoices/${invoiceId}/send-email`,
                  `/invoices/${invoiceId}/send-email`,
                  `/finance/invoices/${invoiceId}/email`,
                  `/invoices/${invoiceId}/email`,
                ]
              : []),
            ...(invoiceNumber
              ? [
                  `/finance/invoices/${encodeURIComponent(invoiceNumber)}/send-email`,
                  `/invoices/${encodeURIComponent(invoiceNumber)}/send-email`,
                  `/finance/invoices/${encodeURIComponent(invoiceNumber)}/email`,
                  `/invoices/${encodeURIComponent(invoiceNumber)}/email`,
                ]
              : []),
          ],
          {
            invoice_id: invoiceId,
            invoice_number: invoiceNumber,
            recipient_email: payerEmail,
            email: payerEmail,
            payment_link: paymentLink || undefined,
            checkout_url: paymentLink || undefined,
            attach_pdf: !!attachPdf,
            include_pdf: !!attachPdf,
            create_pdf: !!createPdf,
            create_payment_link: true,
            public_payment_link: true,
            include_payment_link: true,
            include_checkout_link: true,
            send_payment_link: true,
            payment_link_required: true,
            force_payment_link: !!includePaymentLink || !createResponseHasPaymentLink,
          }
        );
      }

      setSuccess(
        `Invoice ${invoiceNumber} created successfully.`
      );

      window.setTimeout(() => {
        navigate("/dash/finance/invoices");
      }, 800);
    } catch (err) {
      console.error("Invoice creation failed:", err);

      setError(
        err?.response?.data?.details ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Unable to create invoice."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="finance-enterprise-page finance-invoice-generator">
      <section className="finance-page-hero">
        <div>
          <span className="finance-eyebrow">Finance Invoice</span>
          <h1>Create Invoice</h1>
          <p>
            Generate invoices for members and non-members with PDF, email
            delivery, payment links, pledge follow-up, school/trip programs,
            and audit-ready finance metadata.
          </p>
        </div>

        <button
          type="button"
          className="finance-btn finance-btn-secondary"
          onClick={() => navigate("/dash/finance/invoices")}
        >
          <ArrowLeft size={16} strokeWidth={2.1} />
          Invoices
        </button>
      </section>

      {error ? (
        <div className="finance-alert finance-alert-danger">
          <AlertTriangle size={16} strokeWidth={2.1} />
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="finance-alert finance-alert-success">
          <CheckCircle2 size={16} strokeWidth={2.1} />
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="finance-card finance-muted-panel">
          Loading invoice reference data...
        </div>
      ) : null}

      <div className="finance-generator-grid">
        <section className="finance-card">
          <div className="finance-section-title">
            <UserRound size={18} strokeWidth={2.1} />
            <h2>Recipient</h2>
          </div>

          <div className="finance-grid-2">
            <div className="finance-field">
              <label>Payer Type</label>
              <select
                value={payerType}
                onChange={(event) => {
                  setPayerType(event.target.value);
                  setSelectedMember(null);
                  setGuest(EMPTY_GUEST);
                }}
              >
                {PAYER_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="finance-field">
              <label>Invoice Type</label>
              <select
                value={invoiceType}
                onChange={(event) => setInvoiceType(event.target.value)}
              >
                {INVOICE_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {payerType === "member" ? (
            <>
              <div className="finance-field">
                <label>Search Member</label>
                <div className="finance-input-icon">
                  <Search size={16} strokeWidth={2.1} />
                  <input
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Search member ID, name, email, or phone"
                  />
                </div>
              </div>

              <div className="finance-field">
                <label>Member *</label>
                <select
                  value={selectedMember?.id || ""}
                  onChange={(event) => {
                    const member = members.find(
                      (row) => String(row.id) === String(event.target.value)
                    );
                    setSelectedMember(member || null);
                  }}
                >
                  <option value="">
                    {loadingMembers ? "Searching..." : "Select member"}
                  </option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.member_no || "No ID"} - {memberName(member)} -{" "}
                      {member.email || "No email"}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="finance-grid-2">
              <div className="finance-field">
                <label>First Name *</label>
                <input
                  value={guest.first_name}
                  onChange={(event) =>
                    updateGuest("first_name", event.target.value)
                  }
                />
              </div>

              <div className="finance-field">
                <label>Last Name *</label>
                <input
                  value={guest.last_name}
                  onChange={(event) =>
                    updateGuest("last_name", event.target.value)
                  }
                />
              </div>

              <div className="finance-field">
                <label>Email *</label>
                <input
                  type="email"
                  value={guest.email}
                  onChange={(event) => updateGuest("email", event.target.value)}
                />
              </div>

              <div className="finance-field">
                <label>Phone *</label>
                <input
                  value={guest.phone}
                  onChange={(event) => updateGuest("phone", event.target.value)}
                />
              </div>
            </div>
          )}
        </section>

        <section className="finance-card">
          <div className="finance-section-title">
            <Send size={18} strokeWidth={2.1} />
            <h2>Delivery Options</h2>
          </div>

          <div className="finance-option-grid">
            <label className="finance-check-row">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(event) => setSendEmail(event.target.checked)}
              />
              Email Invoice
            </label>

            <label className="finance-check-row">
              <input
                type="checkbox"
                checked={attachPdf}
                onChange={(event) => setAttachPdf(event.target.checked)}
              />
              Attach PDF
            </label>

            <label className="finance-check-row">
              <input
                type="checkbox"
                checked={includePaymentLink}
                onChange={(event) => setIncludePaymentLink(event.target.checked)}
              />
              <LinkIcon size={14} strokeWidth={2.1} />
              Payment Link
            </label>

            <label className="finance-check-row">
              <input
                type="checkbox"
                checked={createPdf}
                onChange={(event) => setCreatePdf(event.target.checked)}
              />
              Create PDF
            </label>
          </div>
        </section>

        <section className="finance-card">
          <div className="finance-section-title">
            <FileText size={18} strokeWidth={2.1} />
            <h2>Invoice Details</h2>
          </div>

          <div className="finance-grid-2">
            <div className="finance-field">
              <label>Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
              />
            </div>

            <div className="finance-field">
              <label>Due Date *</label>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>

          {invoiceType === "membership" ? (
            <div className="finance-grid-2">
              <div className="finance-field">
                <label>Membership Plan *</label>
                <select
                  value={selectedPlanId}
                  onChange={(event) => setSelectedPlanId(event.target.value)}
                >
                  <option value="">Select plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.plan_name || plan.name} -{" "}
                      {money(
                        plan.minimum_amount ||
                          plan.membership_amount ||
                          plan.amount ||
                          plan.price
                      )}
                    </option>
                  ))}
                </select>
              </div>

              <div className="finance-field">
                <label>Coverage Start</label>
                <select
                  value={coverageStartMonth}
                  onChange={(event) =>
                    setCoverageStartMonth(Number(event.target.value))
                  }
                >
                  {MONTH_OPTIONS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="finance-field">
                <label>Coverage Year</label>
                <input
                  type="number"
                  value={coverageYear}
                  onChange={(event) => setCoverageYear(event.target.value)}
                />
              </div>

              <div className="finance-field">
                <label>Coverage End</label>
                <input
                  readOnly
                  value={`${
                    MONTH_OPTIONS.find(
                      (item) => item.value === coverageEndData.month
                    )?.label || ""
                  } ${coverageEndData.year}`}
                />
              </div>
            </div>
          ) : null}

          {invoiceType === "donation" ? (
            <div className="finance-grid-2">
              <div className="finance-field">
                <label>Donation Category</label>
                <select
                  value={donationCategory}
                  onChange={(event) => setDonationCategory(event.target.value)}
                >
                  {DONATION_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="finance-field">
                <label>Amount *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {invoiceType === "school" || invoiceType === "trip" ? (
            <div className="finance-grid-2">
              <div className="finance-field">
                <label>
                  {invoiceType === "school" ? "School Program" : "Trip Program"}
                </label>
                <select
                  value={selectedProgramId}
                  onChange={(event) => {
                    const id = event.target.value;
                    const program = filteredPrograms.find(
                      (row) => String(row.id) === String(id)
                    );

                    setSelectedProgramId(id);

                    if (program) {
                      setProgramName(program.title);
                      setAmount(program.price || "");
                    }
                  }}
                >
                  <option value="">Select program</option>
                  {filteredPrograms.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.title} - {money(program.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="finance-field">
                <label>Program Name</label>
                <input
                  value={programName}
                  onChange={(event) => setProgramName(event.target.value)}
                  placeholder={
                    invoiceType === "school"
                      ? "School program name"
                      : "Trip program name"
                  }
                />
              </div>

              <div className="finance-field">
                <label>Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>

              <div className="finance-field">
                <label>Unit Amount *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {invoiceType === "pledge" ? (
            <div className="finance-grid-2">
              <div className="finance-field">
                <label>Pledge Campaign</label>
                <select
                  value={selectedCampaignId}
                  onChange={(event) => setSelectedCampaignId(event.target.value)}
                >
                  <option value="">No campaign / General pledge</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.title} - Goal {money(campaign.goal_amount)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="finance-field">
                <label>Pledge Payment Option</label>
                <select
                  value={pledgePaymentOption}
                  onChange={(event) => setPledgePaymentOption(event.target.value)}
                >
                  {PLEDGE_PAYMENT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="finance-field">
                <label>Pledge Amount *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>

              <div className="finance-field">
                <label>Category</label>
                <input readOnly value={CATEGORY_LABELS.pledge} />
              </div>
            </div>
          ) : null}

          {invoiceType === "manual" ? (
            <div className="finance-line-editor">
              {lineItems.map((item, index) => (
                <div className="finance-line-editor-row" key={index}>
                  <div className="finance-field">
                    <label>Item</label>
                    <input
                      value={item.item_name}
                      onChange={(event) =>
                        updateLineItem(index, "item_name", event.target.value)
                      }
                    />
                  </div>

                  <div className="finance-field">
                    <label>Description</label>
                    <input
                      value={item.description}
                      onChange={(event) =>
                        updateLineItem(index, "description", event.target.value)
                      }
                    />
                  </div>

                  <div className="finance-field">
                    <label>Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) =>
                        updateLineItem(index, "quantity", event.target.value)
                      }
                    />
                  </div>

                  <div className="finance-field">
                    <label>Unit Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(event) =>
                        updateLineItem(index, "unit_price", event.target.value)
                      }
                    />
                  </div>

                  <button
                    type="button"
                    className="finance-icon-btn danger"
                    onClick={() => removeLineItem(index)}
                    disabled={lineItems.length <= 1}
                    aria-label="Remove item"
                  >
                    <Trash2 size={16} strokeWidth={2.1} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="finance-btn finance-btn-secondary"
                onClick={addLineItem}
              >
                <Plus size={16} strokeWidth={2.1} />
                Add Line Item
              </button>
            </div>
          ) : null}

          <div className="finance-field">
            <label>Notes</label>
            <textarea
              rows="4"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </section>

        <aside className="finance-card finance-invoice-summary-card">
          <h2>Invoice Preview</h2>

          <div className="finance-summary-list">
            <div>
              <span>Recipient</span>
              <strong>{payerName || "--"}</strong>
            </div>

            <div>
              <span>Email</span>
              <strong>{payerEmail || "--"}</strong>
            </div>

            <div>
              <span>Invoice Type</span>
              <strong>
                {INVOICE_TYPES.find((item) => item.value === invoiceType)?.label}
              </strong>
            </div>

            <div>
              <span>Total Amount</span>
              <strong>{money(totalAmount)}</strong>
            </div>
          </div>

          <h3>Line Items</h3>

          <div className="finance-preview-table-wrap">
            <table className="finance-preview-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {generatedItems.map((item, index) => (
                  <tr key={`${item.item_name}-${index}`}>
                    <td>
                      <strong>{item.item_name || "--"}</strong>
                      <span>{item.description || "--"}</span>
                    </td>
                    <td>{item.quantity}</td>
                    <td>{money(item.unit_price)}</td>
                    <td>{money(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="finance-form-actions">
            <button
              type="button"
              className="finance-btn finance-btn-secondary"
              onClick={() => navigate("/dash/finance/invoices")}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="button"
              className="finance-btn finance-btn-primary"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCcw size={16} strokeWidth={2.1} />
                  Creating...
                </>
              ) : (
                <>
                  <Send size={16} strokeWidth={2.1} />
                  Create Invoice
                </>
              )}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
