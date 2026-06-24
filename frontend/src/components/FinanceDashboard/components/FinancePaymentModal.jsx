// frontend/src/components/FinanceDashboard/components/FinancePaymentModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CreditCard,
  FileText,
  Link as LinkIcon,
  Receipt,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import api from "../../api";
// import "../../../styles/finance-dashboard.css";
// import "../../../styles/finance-enterprise.css";
import "../../../styles/finance-enterprise.css";
const CATEGORY_LABELS = {
  membership: "አባልነት — Membership",
  donation: "ስጦታ — Donation",
  school: "ትምህርት — School Program",
  trip: "ጉዞ — Trip Program",
  pledge: "ቃል የተገባ — Pledge",
  plate_collection: "መባ — Plate Collection",
  candle_sale: "ሻማ — Candle Sale",
  general_donation: "ስጦታ — General Donation",
  tithe: "አስራት — Tithe",
  vows: "ስዕለት — Vows",
  baptism: "ክርስትና — Baptism",
  wedding_engagement: "ጋብቻ / ቀለበት — Wedding / Engagement",
  memorial_service: "ፍታት — Memorial Service",
  building_fund: "የቤተክርስቲያን ማሰሪያ — Building Fund",
  charity_fund: "በጎ አድራጎት — Charity Fund",
  auction: "ጨረታ — Auction",
  other_fund: "ሌላ — Other Fund",
};
const WORKFLOWS = [
  { value: "payment", label: "Collect Payment" },
  { value: "invoice", label: "Send Invoice" },
  { value: "pledge", label: "Create Pledge" },
];

const PAYER_TYPES = [
  { value: "member", label: "Member" },
  { value: "guest", label: "Non Member / Guest" },
];

const PAYMENT_TYPES = [
  { value: "membership", label: CATEGORY_LABELS.membership },
  { value: "donation", label: CATEGORY_LABELS.donation },
  { value: "school", label: CATEGORY_LABELS.school },
  { value: "trip", label: CATEGORY_LABELS.trip },
  { value: "pledge", label: CATEGORY_LABELS.pledge },
];
const PAYMENT_METHODS = [
  { value: "card", label: "Card - Stripe" },
  { value: "ach", label: "ACH - Stripe" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
];

const PLEDGE_TYPES = [
  { value: "promise_to_pay", label: "Promise To Pay" },
  { value: "partial_upfront", label: "Pay Partially" },
  { value: "pay_now", label: "Pay Upfront" },
];

const DONATION_CATEGORIES = [
  "plate_collection",
  "candle_sale",
  "general_donation",
  "tithe",
  "vows",
  "baptism",
  "wedding_engagement",
  "memorial_service",
  "pledge",
  "building_fund",
  "charity_fund",
  "auction",
  "other_fund",
].map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));

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
function isStripeMethod(method) {
  return method === "card" || method === "ach";
}

function methodNeedsReference(method) {
  return method === "check" || method === "zelle";
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

function invoiceRecordFrom(payload = {}) {
  return (
    payload.invoice ||
    payload.row ||
    payload.record ||
    payload.result?.invoice ||
    payload.result?.row ||
    payload.data?.invoice ||
    payload.data?.row ||
    payload.data?.record ||
    payload.data ||
    payload ||
    {}
  );
}

function invoiceIdFrom(payload = {}) {
  const invoice = invoiceRecordFrom(payload);

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

function invoiceNumberFrom(payload = {}) {
  const invoice = invoiceRecordFrom(payload);

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

function withCheckoutMethod(url, method) {
  const rawUrl = clean(url);
  const rawMethod = clean(method);

  if (!rawUrl || !rawMethod || !isStripeMethod(rawMethod)) {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl, window.location.origin);
    parsed.searchParams.set("method", rawMethod);

    if (/^https?:\/\//i.test(rawUrl)) {
      return parsed.toString();
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (_err) {
    const joiner = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${joiner}method=${encodeURIComponent(rawMethod)}`;
  }
}

export default function FinancePaymentModal({
  open,
  onClose,
  onSuccess,
  onSaved,
  member = null,
  pledge = null,
  defaultWorkflow = "payment",
  defaultPaymentType = "membership",
})  {
  const [workflow, setWorkflow] = useState("payment");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState("");

  const [plans, setPlans] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [members, setMembers] = useState([]);

  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState(member || null);
  const [payerType, setPayerType] = useState(member ? "member" : "member");
  const [guest, setGuest] = useState(EMPTY_GUEST);

  const [paymentType, setPaymentType] = useState("membership");
  const [method, setMethod] = useState("card");

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [programName, setProgramName] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState("");
  const [donationCategory, setDonationCategory] = useState("general_donation");

  const [pledgeType, setPledgeType] = useState("promise_to_pay");
  const [pledgedAmount, setPledgedAmount] = useState("");
  const [upfrontAmount, setUpfrontAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [referenceNo, setReferenceNo] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [notes, setNotes] = useState("");

  const [coverageYear, setCoverageYear] = useState(new Date().getFullYear());
  const [coverageStartMonth, setCoverageStartMonth] = useState(
    new Date().getMonth() + 1
  );

  const [sendInvoiceEmail, setSendInvoiceEmail] = useState(true);
  const [sendReceiptEmail, setSendReceiptEmail] = useState(true);
  const [createInvoice, setCreateInvoice] = useState(true);
  const [createLedgerEntry, setCreateLedgerEntry] = useState(true);
  const [includePaymentLink, setIncludePaymentLink] = useState(true);

  useEffect(() => {
    if (!open) return;

    const initialWorkflow = pledge ? "pledge" : defaultWorkflow || "payment";
    const initialPaymentType = pledge ? "pledge" : defaultPaymentType || "membership";

    setWorkflow(initialWorkflow);
    setError("");
    setSaving(false);
    setSelectedMember(member || null);
    setPayerType(member ? "member" : "member");
    setGuest(EMPTY_GUEST);
    setPaymentType(initialPaymentType);
    setMethod("card");
    setSelectedCampaignId(pledge?.campaign_id || "");
    setPledgedAmount(pledge?.remaining_balance || pledge?.balance_due || "");
    setUpfrontAmount(pledge?.remaining_balance || pledge?.balance_due || "");
    setPledgeType(pledge ? "pay_now" : "promise_to_pay");
    setDueDate(String(pledge?.due_date || "").slice(0, 10));
    setReferenceNo("");
    setReceivedDate("");
    setNotes("");
    setCreateInvoice(true);
    setSendInvoiceEmail(true);
    setIncludePaymentLink(true);
    setSendReceiptEmail(!pledge);

    loadInitialData();
    loadMembers("");
  }, [open, member, pledge, defaultWorkflow, defaultPaymentType]);

  useEffect(() => {
    if (!open) return undefined;

    const timer = window.setTimeout(() => {
      loadMembers(memberSearch);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [memberSearch, open]);

  useEffect(() => {
    if (workflow === "invoice") {
      setMethod("card");
      setCreateInvoice(true);
      setSendInvoiceEmail(true);
      setSendReceiptEmail(false);
      setIncludePaymentLink(true);
    }

    if (workflow === "pledge") {
      setPaymentType("pledge");
      setCreateInvoice(true);
      setSendInvoiceEmail(true);
      setIncludePaymentLink(true);

      if (pledgeType === "promise_to_pay") {
        setSendReceiptEmail(false);
      }
    }
  }, [workflow, pledgeType]);

  useEffect(() => {
    if (paymentType !== "pledge") return;

    const pledged = numberValue(pledgedAmount);

    if (pledgeType === "promise_to_pay") {
      setUpfrontAmount("");
      setSendReceiptEmail(false);
    }

    if (pledgeType === "pay_now") {
      setUpfrontAmount(pledged ? String(pledged) : "");
      setSendReceiptEmail(true);
    }

    if (pledgeType === "partial_upfront") {
      setSendReceiptEmail(true);
    }
  }, [pledgeType, pledgedAmount, paymentType]);

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
    const schoolPrograms = rowsFrom(schoolRes.data).map((row) => normalizeProgram(row, "school"));
    const tripPrograms = rowsFrom(tripRes.data).map((row) => normalizeProgram(row, "trip"));

    setPlans(nextPlans);
    setPrograms([...schoolPrograms, ...tripPrograms]);
    setCampaigns(rowsFrom(campaignsRes.data).map(normalizeCampaign));

    if (!selectedPlanId && nextPlans.length) {
      setSelectedPlanId(String(nextPlans[0].id));
    }
  } catch (err) {
    console.error("Finance payment modal load failed:", err);
    setError("Unable to load finance reference data.");
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
      console.error("Failed to load finance members:", err);
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
    if (paymentType === "school") {
      return programs.filter((program) =>
        ["school", "kids", "school_program", "school-program"].includes(
          String(program.category || "").toLowerCase()
        )
      );
    }

    if (paymentType === "trip") {
      return programs.filter((program) =>
        ["trip", "trip_program", "trip-program"].includes(
          String(program.category || "").toLowerCase()
        )
      );
    }

    return [];
  }, [paymentType, programs]);

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

  const isPromiseToPay =
    workflow === "pledge" &&
    paymentType === "pledge" &&
    pledgeType === "promise_to_pay";

  const needsPaymentMethod =
    workflow === "payment" ||
    (workflow === "pledge" && paymentType === "pledge" && !isPromiseToPay);

  const paymentAmount = useMemo(() => {
  if (paymentType === "membership") {
    return numberValue(
      selectedPlan?.minimum_amount ||
        selectedPlan?.membership_amount ||
        selectedPlan?.amount ||
        selectedPlan?.price
    );
  }

  if (paymentType === "school" || paymentType === "trip") {
    return programAmount(selectedProgram, quantity, paymentType, amount);
  }

  if (paymentType === "pledge") {
    return isPromiseToPay ? 0 : numberValue(upfrontAmount);
  }

  return numberValue(amount);
}, [
  paymentType,
  selectedPlan,
  selectedProgram,
  quantity,
  amount,
  upfrontAmount,
  isPromiseToPay,
]);
  const invoiceAmount =
    paymentType === "pledge" ? numberValue(pledgedAmount) : paymentAmount;

  const pledgeRemaining = Math.max(
    numberValue(pledgedAmount) - numberValue(upfrontAmount),
    0
  );

  const payerName =
    payerType === "member" ? memberName(selectedMember || {}) : guestName(guest);

  const payerEmail =
    payerType === "member" ? selectedMember?.email || "" : guest.email;

  const payerPhone =
    payerType === "member" ? selectedMember?.phone || "" : guest.phone;

  function updateGuest(key, value) {
    setGuest((previous) => {
      const next = {
        ...previous,
        [key]: value,
      };

      next.full_name = `${next.first_name || ""} ${next.last_name || ""}`.trim();

      return next;
    });
  }

  function changePaymentType(nextType) {
    setPaymentType(nextType);
    setSelectedPlanId("");
    setSelectedProgramId("");
    setProgramName("");
    setAmount("");
    setPledgedAmount("");
    setUpfrontAmount("");
    setPledgeType("promise_to_pay");

    if (nextType === "pledge") {
      setWorkflow("pledge");
      setDonationCategory("pledge");
      setCreateInvoice(true);
      setSendInvoiceEmail(true);
      setIncludePaymentLink(true);
    }
  }

  function validate() {
    if (payerType === "member" && !selectedMember?.id) {
      return "Please select a member.";
    }

    if (payerType === "guest") {
      if (!clean(guest.first_name)) return "Guest first name is required.";
      if (!clean(guest.last_name)) return "Guest last name is required.";

      if (
        workflow === "pledge" ||
        workflow === "invoice" ||
        sendInvoiceEmail ||
        includePaymentLink ||
        (needsPaymentMethod && isStripeMethod(method))
      ) {
        if (!clean(guest.email)) return "Guest email is required.";
      }

      if (workflow === "pledge" && !clean(guest.phone)) {
        return "Guest phone is required for pledge follow-up.";
      }
    }

    if (paymentType === "membership" && !selectedPlan?.id) {
      return "Please select a membership plan.";
    }

    if (paymentType === "school" || paymentType === "trip") {
      if (!selectedProgram?.id && !clean(programName)) {
        return "Please select a program or enter a program name.";
      }
    }

    if (paymentType === "donation" && numberValue(amount) <= 0) {
      return "Donation amount is required.";
    }

    if (workflow === "invoice" && invoiceAmount <= 0) {
      return "Invoice amount must be greater than zero.";
    }

    if (workflow === "invoice" && !clean(payerEmail)) {
      return "Recipient email is required to send an invoice.";
    }

    if (workflow === "pledge" || paymentType === "pledge") {
      if (numberValue(pledgedAmount) <= 0) {
        return "Pledged amount is required.";
      }

      if (numberValue(upfrontAmount) > numberValue(pledgedAmount)) {
        return "Upfront payment cannot exceed the pledge.";
      }

      if (pledgeType === "partial_upfront" && numberValue(upfrontAmount) <= 0) {
        return "Partial pledge requires an upfront payment amount.";
      }

      if (
        pledgeType === "pay_now" &&
        numberValue(upfrontAmount) !== numberValue(pledgedAmount)
      ) {
        return "Pay upfront must equal the pledged amount.";
      }
    } else if (workflow === "payment" && paymentAmount <= 0) {
      return "Payment amount must be greater than zero.";
    }

    if (
      needsPaymentMethod &&
      methodNeedsReference(method) &&
      !clean(referenceNo)
    ) {
      return "Reference number is required for Check and Zelle payments.";
    }

    return "";
  }

  function payerPayload() {
    return {
      payer_type: payerType,
      donor_type: payerType === "member" ? "member" : "non_member",

      member_id: payerType === "member" ? selectedMember?.id || null : null,
      member_no:
        payerType === "member" ? selectedMember?.member_no || null : null,

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

function commonPayload() {
  const methodValue = needsPaymentMethod ? method : null;

  const baseAmount =
    paymentType === "pledge"
      ? numberValue(pledgedAmount)
      : invoiceAmount || paymentAmount;
  const invoiceDueAmount =
    paymentType === "pledge"
      ? isPromiseToPay
        ? numberValue(pledgedAmount)
        : numberValue(upfrontAmount)
      : workflow === "invoice"
        ? invoiceAmount
        : paymentAmount;

  const stripePayment = Boolean(methodValue && isStripeMethod(methodValue));

  return {
    ...payerPayload(),

    method: methodValue,
    payment_method: methodValue,
    provider: methodValue
      ? isStripeMethod(methodValue)
        ? "stripe"
        : methodValue
      : isPromiseToPay
        ? "invoice"
        : null,

    reference_no: needsPaymentMethod ? referenceNo || null : null,
    received_date: needsPaymentMethod ? receivedDate || null : null,
    received_at: needsPaymentMethod ? receivedDate || null : null,

    amount: workflow === "invoice" || isPromiseToPay ? invoiceDueAmount : paymentAmount,
    total_amount: workflow === "invoice" || isPromiseToPay ? invoiceDueAmount : paymentAmount,
    invoice_amount: baseAmount,
    invoice_total_amount: baseAmount,
    base_amount: baseAmount,
    subtotal_amount: baseAmount,
    amount_due: invoiceDueAmount,
    payment_link_amount: invoiceDueAmount,
    checkout_amount: invoiceDueAmount,
    balance_due: invoiceDueAmount,
    amount_before_fee: baseAmount,
    processing_fee: 0,

    apply_processing_fee: stripePayment,
    include_processing_fee: stripePayment,
    processing_fee_paid_by: "payer",

    notes: notes || null,

    send_invoice_email: !!sendInvoiceEmail,
    send_receipt_email: needsPaymentMethod ? !!sendReceiptEmail : false,

    create_invoice: !!createInvoice || isPromiseToPay,
    create_ledger_entry: !!createLedgerEntry,

    create_payment_link: !!includePaymentLink || isPromiseToPay,
    public_payment_link: !!includePaymentLink || isPromiseToPay,
    include_payment_link: !!includePaymentLink || isPromiseToPay,

    source: "finance",
    created_from: "finance_payment_center",
  };
}

  function typedPayload() {
    if (paymentType === "membership") {
      return {
        ...commonPayload(),

        category: "membership",
        payment_type: "membership",
        type: "membership",

        plan_id: selectedPlan?.id,
        dues_plan_id: selectedPlan?.id,
        plan_name: selectedPlan?.plan_name || selectedPlan?.name || "Membership",
        unit_amount: paymentAmount,
        base_amount: invoiceAmount,
        invoice_amount: invoiceAmount,
        amount: workflow === "invoice" ? invoiceAmount : paymentAmount,
        total_amount: workflow === "invoice" ? invoiceAmount : paymentAmount,

        months_paid: coverageMonths,
        duration_months: coverageMonths,
        coverage_year: Number(coverageYear),
        coverage_start_month: Number(coverageStartMonth),
        coverage_end_month: Number(coverageEndData.month),
        coverage_end_year: Number(coverageEndData.year),
      };
    }

    if (paymentType === "school" || paymentType === "trip") {
      const title =
        selectedProgram?.title ||
        clean(programName) ||
        (paymentType === "school" ? "School Program" : "Trip Program");

      return {
        ...commonPayload(),

        category: paymentType,
        payment_type: paymentType,
        type: paymentType,

        related_entity_id: selectedProgram?.id || null,
        program_id: selectedProgram?.id || null,
        news_event_id: selectedProgram?.id || null,
        event_id: selectedProgram?.id || null,
        program_name: title,
        program_title: title,
        program_category: paymentType,
        program_type: paymentType,
        item_type: paymentType,

        quantity: Math.max(1, Number(quantity || 1)),
        price_per_person: numberValue(selectedProgram?.price || amount),
        unit_amount: numberValue(selectedProgram?.price || amount),
        base_amount: invoiceAmount,
        invoice_amount: invoiceAmount,
        amount: workflow === "invoice" ? invoiceAmount : paymentAmount,
        total_amount: workflow === "invoice" ? invoiceAmount : paymentAmount,
      };
    }

    if (paymentType === "pledge") {
      const pledged = numberValue(pledgedAmount);
      const upfront = isPromiseToPay ? 0 : numberValue(upfrontAmount);
      const remaining = Math.max(pledged - upfront, 0);
      const invoiceChargeAmount = isPromiseToPay ? pledged : upfront;
      const campaignName = selectedCampaign?.title || "General Pledge";

      return {
        ...commonPayload(),

        category: "pledge",
        payment_type: "pledge",
        type: "pledge",

        donation_category: "pledge",
        donation_category_label: CATEGORY_LABELS.pledge,

        campaign_id: selectedCampaign?.id || null,
        campaign_name: campaignName,

        pledge_type: pledgeType,
        pledge_payment_option: pledgeType,
        pledged_amount: pledged,
        pledge_amount: pledged,
        pledge_total_amount: pledged,

        amount: invoiceChargeAmount,
        total_amount: invoiceChargeAmount,
        payment_amount: upfront,
        collected_amount: upfront,

        base_amount: invoiceChargeAmount,
        subtotal_amount: invoiceChargeAmount,
        invoice_amount: invoiceChargeAmount,
        invoice_total_amount: invoiceChargeAmount,
        checkout_amount: invoiceChargeAmount,
        payment_link_amount: invoiceChargeAmount,
        amount_due: invoiceChargeAmount,
        upfront_amount: upfront,
        paid_amount: upfront,
        remaining_balance: remaining,
        pledge_remaining_balance: remaining,
        pledge_balance_due: remaining,
        balance_due: remaining,

        due_date: dueDate || null,
        status: remaining <= 0 ? "paid" : "active",
        pledge_status: remaining <= 0 ? "paid" : "active",

        create_invoice: true,
        send_invoice_email: true,
        send_payment_link: true,
        create_payment_link: true,
        public_payment_link: true,
        include_payment_link: true,
        include_checkout_link: true,
        payment_link_required: true,
        force_payment_link: true,

        invoice_only: isPromiseToPay,
        promise_to_pay: isPromiseToPay,
        send_receipt_email: isPromiseToPay ? false : !!sendReceiptEmail,
      };
    }

    return {
      ...commonPayload(),

      category: "donation",
      payment_type: "donation",
      type: "donation",

      sub_category: donationCategory,
      donation_category: donationCategory,
      donation_category_label: labelForCategory(donationCategory),

      amount: workflow === "invoice" ? invoiceAmount : paymentAmount,
      total_amount: workflow === "invoice" ? invoiceAmount : paymentAmount,
    };
  }

  function checkoutPayload(payload) {
    const items = invoiceItemsForPayload(payload);
    const payableAmount = payableAmountFromPayload(payload, items);
    const invoiceId = payload.invoice_id || payload.linked_invoice_id || payload.existing_invoice_id || null;
    const invoiceNumber =
      payload.invoice_number ||
      payload.linked_invoice_number ||
      payload.existing_invoice_number ||
      null;

    const basePayload = invoiceId || invoiceNumber
      ? {
          invoice_id: invoiceId,
          invoice_number: invoiceNumber,
          linked_invoice_id: invoiceId,
          linked_invoice_number: invoiceNumber,
          existing_invoice_id: invoiceId,
          existing_invoice_number: invoiceNumber,
          payer_type: payload.payer_type,
          donor_type: payload.donor_type,
          member_id: payload.member_id,
          member_no: payload.member_no,
          full_name: payload.full_name,
          email: payload.email,
          phone: payload.phone,
          category: payload.category,
          payment_type: payload.payment_type,
          type: payload.type,
          sub_category: payload.sub_category,
          donation_category: payload.donation_category,
          donation_category_label: payload.donation_category_label,
          amount: payableAmount,
          total_amount: payableAmount,
          invoice_amount: payableAmount,
          invoice_total_amount: payableAmount,
          amount_due: payableAmount,
          payment_link_amount: payableAmount,
          checkout_amount: payableAmount,
          balance_due: payableAmount,
          items,
          line_items: items,
          invoice_items: items,
        }
      : payload;

    return {
      ...basePayload,
      method: payload.method || payload.payment_method || method,
      payment_method: payload.payment_method || payload.method || method,
      checkout_method: payload.checkout_method || payload.payment_method || payload.method || method,
      provider: "stripe",
      process_direct_payment: false,
      success_url: `${window.location.origin}/dash/finance/payments?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${window.location.origin}/dash/finance/payments?status=cancelled`,
    };
  }

  function invoiceItemsForPayload(payload) {
    if (Array.isArray(payload.items) && payload.items.length) {
      return payload.items;
    }

    const qty = Math.max(1, Number(payload.quantity || 1));
    const total = numberValue(
      payload.invoice_amount || payload.total_amount || payload.amount
    );
    const unit = qty > 1 ? total / qty : total;
    const itemType = payload.payment_type || payload.category || paymentType;
    const itemName =
      payload.plan_name ||
      payload.program_name ||
      payload.campaign_name ||
      labelForCategory(payload.donation_category || itemType);

    return [
      {
        item_type: itemType,
        item_name: itemName,
        description:
          payload.description ||
          payload.notes ||
          `${labelForCategory(itemType)} invoice`,
        quantity: qty,
        unit_price: unit,
        total_price: total,
      },
    ];
  }

  function itemAmount(item) {
    const qty = Math.max(1, numberValue(item.quantity || item.qty || 1));
    const explicit = numberValue(
      item.total_price ||
        item.total_amount ||
        item.line_total ||
        item.amount ||
        item.price_total
    );

    if (explicit > 0) {
      return explicit;
    }

    return (
      numberValue(item.unit_price || item.unit_amount || item.price || item.rate) *
      qty
    );
  }

  function itemsTotal(items = []) {
    return items.reduce((sum, item) => sum + itemAmount(item), 0);
  }

  function payableAmountFromPayload(payload, items = []) {
    return numberValue(
      payload.payment_link_amount ||
        payload.checkout_amount ||
        payload.amount_due ||
        payload.invoice_amount ||
        payload.invoice_total_amount ||
        payload.balance_due ||
        payload.total_amount ||
        payload.amount ||
        itemsTotal(items)
    );
  }

  async function submitStripe(payload) {
    const { data } = await postFirst(
      [
        "/checkout/create-session",
        "/finance/checkout/create-session",
        "/finance/payments/checkout",
        "/payments/checkout",
      ],
      checkoutPayload(payload)
    );

    const checkoutUrl =
      data?.url ||
      data?.checkout_url ||
      data?.stripe_url ||
      data?.session?.url ||
      data?.checkout?.url ||
      paymentLinkFrom(data);

    if (!checkoutUrl) {
      throw new Error("Stripe checkout URL missing from backend.");
    }

    window.location.href = checkoutUrl;
  }

  async function createInvoiceOnly(payload) {
    const items = invoiceItemsForPayload(payload);
    const invoiceTotal = payableAmountFromPayload(payload, items);
    const requestedMethod = payload.payment_method || payload.method || method;
    const wantsPaymentLink = Boolean(
      payload.create_payment_link ||
        payload.public_payment_link ||
        payload.include_payment_link ||
        payload.send_payment_link ||
        payload.payment_link_required ||
        payload.include_checkout_link ||
        includePaymentLink ||
        isStripeMethod(requestedMethod)
    );
    const wantsEmail = Boolean(
      payload.send_email || payload.send_invoice_email || sendInvoiceEmail
    );

    const invoicePayload = {
      ...payload,
      status: "open",
      invoice_status: "open",
      invoice_only: true,
      amount: invoiceTotal,
      total_amount: invoiceTotal,
      invoice_amount: invoiceTotal,
      invoice_total_amount: invoiceTotal,
      subtotal_amount: invoiceTotal,
      amount_due: invoiceTotal,
      payment_link_amount: invoiceTotal,
      checkout_amount: invoiceTotal,
      balance_due: invoiceTotal,
      paid_amount: 0,
      send_email: false,
      send_invoice_email: false,
      defer_invoice_email: wantsEmail,
      requested_send_invoice_email: wantsEmail,
      email_after_payment_link: false,
      create_payment_link: wantsPaymentLink,
      public_payment_link: wantsPaymentLink,
      include_payment_link: wantsPaymentLink,
      send_payment_link: wantsPaymentLink,
      payment_link_required: wantsPaymentLink,
      force_payment_link: wantsPaymentLink,
      include_checkout_link: wantsPaymentLink,
      requested_payment_method: requestedMethod || null,
      checkout_method: requestedMethod || null,
      payment_method: null,
      method: null,
      provider: null,
      items,
      line_items: items,
      invoice_items: items,
    };

    return postFirst(["/finance/invoices", "/invoices"], invoicePayload);
  }

  async function ensureInvoicePaymentLink(invoiceResponse, sourcePayload = {}, selectedMethod = method) {
    const responseData = invoiceResponse?.data || {};
    const existingLink = paymentLinkFrom(responseData);

    if (existingLink) {
      return withCheckoutMethod(existingLink, selectedMethod);
    }

    const invoiceId = invoiceIdFrom(responseData);
    const invoiceNumber = invoiceNumberFrom(responseData);

    if (!invoiceId && !invoiceNumber) {
      return "";
    }

    const amountForLink = numberValue(
      sourcePayload.payment_link_amount ||
        sourcePayload.checkout_amount ||
        sourcePayload.amount_due ||
        sourcePayload.invoice_amount ||
        sourcePayload.invoice_total_amount ||
        sourcePayload.balance_due ||
        sourcePayload.total_amount ||
        sourcePayload.amount ||
        itemsTotal(invoiceItemsForPayload(sourcePayload))
    );

    const linkPayload = {
      ...sourcePayload,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      amount: amountForLink,
      total_amount: amountForLink,
      invoice_amount: amountForLink,
      invoice_total_amount: amountForLink,
      amount_due: amountForLink,
      payment_link_amount: amountForLink,
      checkout_amount: amountForLink,
      balance_due: amountForLink,
      method: selectedMethod,
      payment_method: selectedMethod,
      checkout_method: selectedMethod,
      create_payment_link: true,
      public_payment_link: true,
      include_payment_link: true,
      send_payment_link: true,
      payment_link_required: true,
      include_checkout_link: true,
      send_email: !!sendInvoiceEmail,
      send_invoice_email: !!sendInvoiceEmail,
      attach_pdf: true,
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
          force_payment_link: true,
          send_email: false,
          send_invoice_email: false,
        }
      );

      const generatedLink = paymentLinkFrom(linkResponse?.data);
      if (generatedLink) {
        return withCheckoutMethod(generatedLink, selectedMethod);
      }
    } catch (linkErr) {
      console.warn("Invoice payment-link endpoint fallback failed:", linkErr);
    }

    if (sendInvoiceEmail) {
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
            force_payment_link: true,
            send_email: true,
            send_invoice_email: true,
          }
        );

        const emailedLink = paymentLinkFrom(emailResponse?.data);
        if (emailedLink) {
          return withCheckoutMethod(emailedLink, selectedMethod);
        }
      } catch (emailErr) {
        console.warn("Invoice email fallback failed:", emailErr);
      }
    }

    return "";
  }

  async function createManualPayment(payload) {
    const paidPayload = {
      ...payload,
      status: "paid",
      payment_status: "paid",
    };

    return postFirst(
      ["/finance/payments", "/payments", "/finance/manual-entries"],
      paidPayload
    );
  }

  async function createPledge(payload) {
    const response = await postFirst(["/finance/pledges", "/pledges"], payload);
    const data = response?.data || {};

    const pledgeId =
      data.pledge_id ||
      data.pledge?.id ||
      data.pledge?.pledge_id ||
      data.id;

    const wantsInvoiceLink =
      payload.create_invoice ||
      payload.create_payment_link ||
      payload.public_payment_link ||
      payload.include_payment_link ||
      payload.send_invoice_email;

    const alreadyHasLink = paymentLinkFrom(data);

    if (pledgeId && wantsInvoiceLink && !alreadyHasLink) {
      try {
        const linkResponse = await postFirst(
          [
            `/finance/pledges/${pledgeId}/reminder/link`,
            `/pledges/${pledgeId}/reminder/link`,
            `/finance/pledges/${pledgeId}/actions/create-payment-link`,
            `/pledges/${pledgeId}/actions/create-payment-link`,
          ],
          {
            amount:
              payload.payment_link_amount ||
              payload.checkout_amount ||
              payload.amount_due ||
              payload.invoice_amount ||
              payload.remaining_balance ||
              payload.balance_due ||
              payload.pledged_amount,
            due_date: payload.due_date || null,
            force_new_invoice: false,
          }
        );

        data.invoice = data.invoice || linkResponse?.data?.invoice;
        data.links = data.links || linkResponse?.data?.links;
        data.payment_link =
          data.payment_link ||
          paymentLinkFrom(linkResponse?.data) ||
          null;
      } catch (linkErr) {
        console.warn("Pledge payment link fallback failed:", linkErr);
      }
    }

    data.payment_link = data.payment_link || paymentLinkFrom(data) || null;

    if (pledgeId && payload.send_invoice_email && data.payment_link && !data.email_result) {
      try {
        await postFirst(
          [
            `/finance/pledges/${pledgeId}/reminder/send`,
            `/pledges/${pledgeId}/reminder/send`,
            `/finance/pledges/${pledgeId}/actions/send-reminder`,
            `/pledges/${pledgeId}/actions/send-reminder`,
          ],
          {
            amount:
              payload.payment_link_amount ||
              payload.checkout_amount ||
              payload.amount_due ||
              payload.invoice_amount ||
              payload.remaining_balance ||
              payload.balance_due ||
              payload.pledged_amount,
            due_date: payload.due_date || null,
            force_new_invoice: false,
          }
        );
      } catch (emailErr) {
        console.warn("Pledge invoice email fallback failed:", emailErr);
      }
    }

    return {
      ...response,
      data,
    };
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      const validationError = validate();

      if (validationError) {
        setError(validationError);
        return;
      }

      const payload = typedPayload();

      if (workflow === "invoice") {
        const invoicePayload = {
          ...payload,
          create_payment_link: true,
          public_payment_link: true,
          include_payment_link: true,
          send_payment_link: true,
          payment_link_required: true,
        };

        const invoiceResponse = await createInvoiceOnly(invoicePayload);

        if (sendInvoiceEmail || includePaymentLink || isStripeMethod(method)) {
          await ensureInvoicePaymentLink(invoiceResponse, invoicePayload, method);
        }

        onSuccess?.();
        onSaved?.();
        onClose?.();
        return;
      }

      if (workflow === "pledge") {
        const pledgeResponse = await createPledge(payload);
        const pledgeData = pledgeResponse?.data || {};
        const pledgeId =
          pledgeData.pledge_id ||
          pledgeData.pledge?.id ||
          pledgeData.pledge?.pledge_id ||
          pledgeData.id ||
          null;
        const pledgePayload = {
          ...payload,
          pledge_id: pledgeId || payload.pledge_id || null,
          invoice_id: pledgeData.invoice?.id || pledgeData.invoice_id || null,
          invoice_number:
            pledgeData.invoice?.invoice_number ||
            pledgeData.invoice_number ||
            null,
        };

        if (isPromiseToPay) {
          onSuccess?.();
          onSaved?.();
          onClose?.();
          return;
        }

        if (isStripeMethod(method) && numberValue(upfrontAmount) > 0) {
          let pledgePaymentLink = paymentLinkFrom(pledgeData);

          if (!pledgePaymentLink && pledgePayload.invoice_id) {
            pledgePaymentLink = await ensureInvoicePaymentLink(
              { data: pledgeData },
              pledgePayload,
              method
            );
          }

          if (!pledgePaymentLink) {
            throw new Error(
              pledgeData.warning ||
                "Pledge was created, but the backend did not return a payment link. Please resend the pledge invoice link from the pledge or invoice center."
            );
          }

          window.location.href = withCheckoutMethod(pledgePaymentLink, method);
          return;
        }

        if (numberValue(upfrontAmount) > 0) {
          await createManualPayment({
            ...pledgePayload,
            amount: numberValue(upfrontAmount),
            total_amount: numberValue(upfrontAmount),
            create_invoice: true,
          });
        }

        onSuccess?.();
        onSaved?.();
        onClose?.();
        return;
      }

      if (isStripeMethod(method)) {
        if (paymentType !== "membership") {
          const invoiceResponse = await createInvoiceOnly({
            ...payload,
            create_invoice: true,
            create_payment_link: true,
            public_payment_link: true,
            include_payment_link: true,
            send_payment_link: !!sendInvoiceEmail,
            payment_link_required: true,
            send_email: !!sendInvoiceEmail,
            send_invoice_email: !!sendInvoiceEmail,
          });

          const invoicePaymentLink = await ensureInvoicePaymentLink(
            invoiceResponse,
            payload,
            method
          );

          if (!invoicePaymentLink) {
            const invoiceData = invoiceResponse?.data || {};
            const invoiceId = invoiceIdFrom(invoiceData);
            const invoiceNumber = invoiceNumberFrom(invoiceData);

            await submitStripe({
              ...payload,
              create_invoice: false,
              invoice_id: invoiceId,
              invoice_number: invoiceNumber,
              linked_invoice_id: invoiceId,
              linked_invoice_number: invoiceNumber,
              existing_invoice_id: invoiceId,
              existing_invoice_number: invoiceNumber,
            });
            return;
          }

          window.location.href = withCheckoutMethod(invoicePaymentLink, method);
          return;
        }

        await submitStripe(payload);
        return;
      }

      await createManualPayment(payload);
      onSuccess?.();
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error("Finance payment save failed:", err);

      setError(
        err?.response?.data?.details ||
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Unable to process finance request."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="finance-modal-overlay">
      <div className="finance-payment-modal finance-payment-modal-enterprise">
        <div className="finance-modal-header">
          <div>
            <h2>Finance Payment Center</h2>
            <p>
              Payments, invoices, pledges, receipts, payment links, ledger, and
              audit records.
            </p>
          </div>

          <button
            type="button"
            className="finance-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="finance-alert error" role="alert">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : null}

        <div className="finance-modal-body">
          <div className="finance-segmented-control">
            {WORKFLOWS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={workflow === item.value ? "active" : ""}
                onClick={() => setWorkflow(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={needsPaymentMethod ? "finance-grid-3" : "finance-grid-2"}>
            <div className="finance-field">
              <label>Payer Type</label>
              <select
                value={payerType}
                onChange={(event) => {
                  setPayerType(event.target.value);
                  if (event.target.value === "guest") setSelectedMember(null);
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
              <label>Finance Type</label>
              <select
                value={paymentType}
                onChange={(event) => changePaymentType(event.target.value)}
                disabled={workflow === "pledge" || !!pledge?.id}
              >
                {PAYMENT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {needsPaymentMethod ? (
              <div className="finance-field">
                <label>Payment Method</label>
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                >
                  {PAYMENT_METHODS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {isPromiseToPay ? (
            <div className="finance-muted-panel">
              Promise To Pay creates a pledge record and an open invoice with a
              payment link. No payment method is required until the person pays
              online or finance records an in-person payment.
            </div>
          ) : null}

          {payerType === "member" ? (
            <section className="finance-card finance-member-picker">
              <div className="finance-field">
                <label>Search Member</label>
                <div className="finance-input-with-icon">
                  <Search size={16} />
                  <input
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Search by member ID, name, email, or phone"
                  />
                </div>
              </div>

              <div className="finance-field">
                <label>Member *</label>
                <select
                  value={selectedMember?.id || ""}
                  onChange={(event) => {
                    const found = members.find(
                      (row) => String(row.id) === String(event.target.value)
                    );
                    setSelectedMember(found || null);
                  }}
                >
                  <option value="">
                    {loadingMembers ? "Loading members..." : "Select member"}
                  </option>
                  {members.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.member_no || "MEM"} - {memberName(row)} -{" "}
                      {row.email || "No email"}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          ) : (
            <div className="finance-grid-4">
              <div className="finance-field">
                <label>Guest First Name *</label>
                <input
                  value={guest.first_name}
                  onChange={(event) => updateGuest("first_name", event.target.value)}
                />
              </div>

              <div className="finance-field">
                <label>Guest Last Name *</label>
                <input
                  value={guest.last_name}
                  onChange={(event) => updateGuest("last_name", event.target.value)}
                />
              </div>

              <div className="finance-field">
                <label>Guest Email</label>
                <input
                  type="email"
                  value={guest.email}
                  onChange={(event) => updateGuest("email", event.target.value)}
                />
              </div>

              <div className="finance-field">
                <label>Guest Phone</label>
                <input
                  value={guest.phone}
                  onChange={(event) => updateGuest("phone", event.target.value)}
                />
              </div>
            </div>
          )}

          {paymentType === "membership" ? (
            <>
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
                      {plan.duration_months || 1} month(s) -{" "}
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

              <div className="finance-grid-3">
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
                        (month) => month.value === coverageEndData.month
                      )?.label || ""
                    } ${coverageEndData.year}`}
                  />
                </div>
              </div>
            </>
          ) : null}

          {paymentType === "donation" ? (
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

          {paymentType === "school" || paymentType === "trip" ? (
            <div className="finance-grid-4">
              <div className="finance-field">
                <label>
                  {paymentType === "school" ? "School Program" : "Trip Program"}
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

          {paymentType === "pledge" ? (
            <>
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

              <div className="finance-grid-3">
                <div className="finance-field">
                  <label>Pledge Type</label>
                  <select
                    value={pledgeType}
                    onChange={(event) => setPledgeType(event.target.value)}
                  >
                    {PLEDGE_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="finance-field">
                  <label>Pledged Amount *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pledgedAmount}
                    onChange={(event) => setPledgedAmount(event.target.value)}
                  />
                </div>

                {!isPromiseToPay ? (
                  <div className="finance-field">
                    <label>Upfront Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={upfrontAmount}
                      onChange={(event) => setUpfrontAmount(event.target.value)}
                    />
                  </div>
                ) : null}
              </div>

              <div className="finance-grid-2">
                <div className="finance-field">
                  <label>Follow-up Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </div>

                <div className="finance-payment-total finance-payment-total-strong">
                  <span>Remaining Balance</span>
                  <strong>{money(pledgeRemaining)}</strong>
                </div>
              </div>
            </>
          ) : null}

          {workflow === "invoice" ? (
            <div className="finance-field">
              <label>Invoice Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          ) : null}

          {needsPaymentMethod && methodNeedsReference(method) ? (
            <div className="finance-field">
              <label>Reference Number *</label>
              <input
                value={referenceNo}
                onChange={(event) => setReferenceNo(event.target.value)}
                placeholder="Check number or Zelle confirmation"
              />
            </div>
          ) : null}

          {needsPaymentMethod && !isStripeMethod(method) ? (
            <div className="finance-field">
              <label>Received Date</label>
              <input
                type="datetime-local"
                value={receivedDate}
                onChange={(event) => setReceivedDate(event.target.value)}
              />
            </div>
          ) : null}

          <div className="finance-field">
            <label>Notes</label>
            <textarea
              rows="3"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="finance-grid-4">
            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={createInvoice}
                onChange={(event) => setCreateInvoice(event.target.checked)}
                disabled={workflow === "pledge"}
              />
              <span>Create Invoice</span>
            </label>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={sendInvoiceEmail}
                onChange={(event) => setSendInvoiceEmail(event.target.checked)}
                disabled={workflow === "pledge"}
              />
              <span>Email Invoice</span>
            </label>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={sendReceiptEmail}
                onChange={(event) => setSendReceiptEmail(event.target.checked)}
                disabled={!needsPaymentMethod || isPromiseToPay}
              />
              <span>Email Receipt</span>
            </label>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={includePaymentLink}
                onChange={(event) => setIncludePaymentLink(event.target.checked)}
                disabled={workflow === "pledge"}
              />
              <span>Payment Link</span>
            </label>
          </div>

          <section className="finance-card finance-review-card">
            <div className="finance-payment-total">
              <span>
                <UserRound size={14} /> Payer
              </span>
              <strong>{payerName || "Not selected"}</strong>
            </div>

            <div className="finance-payment-total">
              <span>
                {needsPaymentMethod && isStripeMethod(method) ? (
                  <CreditCard size={14} />
                ) : (
                  <Banknote size={14} />
                )}{" "}
                Method
              </span>
              <strong>
                {isPromiseToPay
                  ? "Invoice Link - No Payment Collected"
                  : workflow === "invoice"
                  ? "Invoice Link"
                  : needsPaymentMethod && isStripeMethod(method)
                  ? "Stripe Checkout"
                  : needsPaymentMethod
                  ? "Manual Entry"
                  : "No Payment Method"}
              </strong>
            </div>

            <div className="finance-payment-total">
              <span>
                <Receipt size={14} /> Amount
              </span>
              <strong>
                {money(
                  workflow === "invoice" || isPromiseToPay
                    ? invoiceAmount
                    : paymentAmount
                )}
              </strong>
            </div>

            <div className="finance-payment-total">
              <span>
                <ShieldCheck size={14} /> Records
              </span>
              <strong>
                Invoice {createInvoice ? "on" : "off"}, email{" "}
                {sendInvoiceEmail || sendReceiptEmail ? "on" : "off"}, ledger{" "}
                {createLedgerEntry ? "on" : "off"}
              </strong>
            </div>
          </section>
        </div>

        <div className="finance-modal-footer">
          <button
            type="button"
            className="finance-btn secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? (
              <>
                <RefreshCcw size={16} /> Processing...
              </>
            ) : workflow === "invoice" ? (
              <>
                <Send size={16} /> Create & Send Invoice
              </>
            ) : isPromiseToPay ? (
              <>
                <FileText size={16} /> Create Pledge & Send Invoice
              </>
            ) : workflow === "pledge" ? (
              <>
                <FileText size={16} /> Create Pledge
              </>
            ) : needsPaymentMethod && isStripeMethod(method) ? (
              <>
                <CreditCard size={16} /> Continue To Checkout
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Record Manual Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
