// backend/services/domains/receipts/receiptPdfService.js
"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");

const BACKEND_ROOT =
  process.env.BACKEND_ROOT ||
  path.resolve(__dirname, "../../..");

const FONT_DIR =
  process.env.FINANCE_FONT_DIR ||
  path.join(BACKEND_ROOT, "assets", "fonts");

const FONT_LATIN_REGULAR =
  process.env.FINANCE_FONT_LATIN_REGULAR ||
  path.join(FONT_DIR, "NotoSans-Regular.ttf");

const FONT_LATIN_BOLD =
  process.env.FINANCE_FONT_LATIN_BOLD ||
  path.join(FONT_DIR, "NotoSans-Bold.ttf");

const FONT_ETHIOPIC_REGULAR =
  process.env.FINANCE_FONT_REGULAR ||
  path.join(FONT_DIR, "NotoSansEthiopic-Regular.ttf");

const FONT_ETHIOPIC_BOLD =
  process.env.FINANCE_FONT_BOLD ||
  path.join(FONT_DIR, "NotoSansEthiopic-Bold.ttf");

const RECEIPT_PDF_ROOT =
  process.env.FINANCE_RECEIPT_PDF_ROOT ||
  path.join(BACKEND_ROOT, "storage", "finance", "receipts");

const RECEIPT_PDF_PUBLIC_PREFIX =
  process.env.FINANCE_RECEIPT_PDF_PUBLIC_PREFIX ||
  "/storage/finance/receipts";

const PAGE = {
  width: 612,
  height: 792,
  margin: 42,
  contentWidth: 528,
};

const CATEGORY_LABELS = {
  membership: "አባልነት — Membership Dues",
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
  sunday_cash_collection: "የእሁድ ስብስብ — Sunday Collection",
  school: "ትምህርት — School Program",
  trip: "ጉዞ — Trip Program",
  other_fund: "ሌላ — Other Fund",
};

const CATEGORY_CODES = [
  ["01", "membership"],
  ["02", "plate_collection"],
  ["03", "candle_sale"],
  ["04", "general_donation"],
  ["05", "tithe"],
  ["06", "vows"],
  ["07", "baptism"],
  ["08", "wedding_engagement"],
  ["09", "memorial_service"],
  ["10", "pledge"],
  ["11", "building_fund"],
  ["12", "charity_fund"],
  ["13", "auction"],
  ["14", "school"],
  ["15", "trip"],
  ["16", "sunday_cash_collection"],
  ["99", "other_fund"],
].map(([code, key]) => ({
  code,
  key,
  label: CATEGORY_LABELS[key],
}));

const MONTHS = [
  ["jan", "Jan"],
  ["feb", "Feb"],
  ["mar", "Mar"],
  ["apr", "Apr"],
  ["may", "May"],
  ["jun", "Jun"],
  ["jul", "Jul"],
  ["aug", "Aug"],
  ["sep", "Sep"],
  ["oct", "Oct"],
  ["nov", "Nov"],
  ["dec", "Dec"],
];

function clean(value, max = 500) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeKey(value) {
  return clean(value, 140)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function safeFileName(value) {
  return clean(value || crypto.randomUUID(), 140)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || `receipt-${Date.now()}`;
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

function formatDate(value) {
  if (!value) return "--";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return clean(value, 60);

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function monthLabel(month) {
  return MONTHS[Number(month || 0) - 1]?.[1] || "";
}

function firstValue(source, keys, fallback = "") {
  for (const key of keys) {
    if (
      source &&
      source[key] !== undefined &&
      source[key] !== null &&
      source[key] !== ""
    ) {
      return source[key];
    }
  }

  return fallback;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mergeReceiptMetadata(receipt = {}) {
  const metadata = parseJsonObject(receipt.metadata_json || receipt.metadata || receipt.extra_json);

  return {
    ...(metadata.payer || {}),
    ...(metadata.payment || {}),
    ...(metadata.invoice || {}),
    ...(metadata.program || {}),
    ...(metadata.pledge || {}),
    ...(metadata.campaign || {}),
    ...(metadata.membership || {}),
    ...(metadata.amounts || {}),
    ...(metadata.receipt || {}),
    ...metadata,
    ...receipt,
  };
}

function firstArrayValue(source = {}, keys = []) {
  for (const key of keys) {
    const rows = parseJsonArray(source[key]);
    if (rows.length) return rows;
  }
  return [];
}

function rowHasProcessingFee(rows = []) {
  return rows.some((row) => {
    const text = `${row.code || ""} ${row.type || ""} ${row.description || ""}`.toLowerCase();
    return row.code === "PF" || text.includes("processing fee");
  });
}

function appendProcessingFeeRow(rows = [], data = {}) {
  const fee = numberValue(data.processingFee);
  if (fee <= 0 || rowHasProcessingFee(rows)) return rows;

  const totalPaid = numberValue(data.amount);
  const baseAmount = numberValue(data.invoiceAmount || data.baseAmount || Math.max(totalPaid - fee, 0));
  const currentTotal = rows.reduce((sum, row) => sum + numberValue(row.amount), 0);

  if (Math.abs(currentTotal - totalPaid) < 0.02 && baseAmount > 0) {
    const index = rows.findIndex((row) => numberValue(row.amount) >= fee);
    if (index >= 0) rows[index].amount = Math.max(numberValue(rows[index].amount) - fee, 0);
  }

  rows.push({
    code: "PF",
    type: "Processing Fee",
    className: "Fee",
    description: `${String(data.method || "").toLowerCase() === "ach" ? "ACH / checking" : "Card"} processing fee`,
    amount: fee,
    remark: data.reference || data.paymentNumber || "--",
  });

  return rows;
}
function byCategoryKey(key) {
  return (
    CATEGORY_CODES.find((item) => item.key === key) ||
    CATEGORY_CODES.find((item) => item.key === "other_fund")
  );
}

function categoryFor(source = {}) {
  const candidates = [
    source.payment_type,
    source.p_payment_type,
    source.i_payment_type,
    source.invoice_type,
    source.i_invoice_type,
    source.category,
    source.p_category,
    source.i_category,
    source.payment_category,
    source.finance_category,
    source.type,
    source.item_type,
    source.item_name,
    source.sub_category,
    source.p_sub_category,
    source.i_sub_category,
    source.donation_category,
    source.p_donation_category,
    source.i_donation_category,
    source.donation_category_key,
    source.program_category,
    source.p_program_category,
    source.i_program_category,
  ]
    .map(normalizeKey)
    .filter(Boolean);

  if (
    candidates.some(
      (key) =>
        ["membership", "membership_dues", "membership_registration", "registration_fee"].includes(key) ||
        key.includes("member") ||
        key.includes("dues")
    )
  ) {
    return byCategoryKey("membership");
  }

  for (const key of candidates) {
    if (CATEGORY_LABELS[key]) return byCategoryKey(key);
    if (key.includes("pledge")) return byCategoryKey("pledge");
    if (key.includes("school") || key.includes("kids")) return byCategoryKey("school");
    if (key.includes("trip") || key.includes("travel")) return byCategoryKey("trip");
    if (key.includes("plate")) return byCategoryKey("plate_collection");
    if (key.includes("sunday")) return byCategoryKey("sunday_cash_collection");
    if (key.includes("candle")) return byCategoryKey("candle_sale");
    if (key.includes("tithe")) return byCategoryKey("tithe");
    if (key.includes("vow")) return byCategoryKey("vows");
    if (key.includes("bapt")) return byCategoryKey("baptism");
    if (key.includes("wedding") || key.includes("engagement")) return byCategoryKey("wedding_engagement");
    if (key.includes("memorial") || key.includes("funeral")) return byCategoryKey("memorial_service");
    if (key.includes("building")) return byCategoryKey("building_fund");
    if (key.includes("charity")) return byCategoryKey("charity_fund");
    if (key.includes("auction")) return byCategoryKey("auction");
    if (key.includes("donation") || key.includes("gift")) return byCategoryKey("general_donation");
  }

  return byCategoryKey("other_fund");
}

function churchInfo() {
  return {
    name:
      process.env.CHURCH_NAME ||
      process.env.ORGANIZATION_NAME ||
      "Debre Berhan Holy Trinity Ethiopian Orthodox Tewahedo Church",
    amharicName:
      process.env.CHURCH_NAME_AMHARIC ||
      "ደብረ ብርሃን ቅድስት ሥላሴ ኢትዮጵያ ኦርቶዶክስ ተዋሕዶ ቤተክርስቲያን",
    address:
      process.env.CHURCH_ADDRESS ||
      "2558 Couchville Pike, Nashville, TN 37217",
    phone: process.env.CHURCH_PHONE || "615-674-7405",
    website: process.env.CHURCH_WEBSITE || process.env.FRONTEND_URL || "",
  };
}

function buildCoverageLabel(data = {}) {
  if (data.coverageLabel) return data.coverageLabel;

  const from = data.coverageFrom ? new Date(data.coverageFrom) : null;
  const to = data.coverageTo ? new Date(data.coverageTo) : null;

  if (
    from &&
    to &&
    !Number.isNaN(from.getTime()) &&
    !Number.isNaN(to.getTime())
  ) {
    const sy = from.getFullYear();
    const ey = to.getFullYear();
    const sm = monthLabel(from.getMonth() + 1);
    const em = monthLabel(to.getMonth() + 1);

    return sy === ey ? `${sm} - ${em} ${sy}` : `${sm} ${sy} - ${em} ${ey}`;
  }

  return data.coverageYear ? `Membership coverage ${data.coverageYear}` : "--";
}

function receiptView(receipt) {
  receipt = mergeReceiptMetadata(receipt);

  let processingFee = numberValue(
    firstValue(
      receipt,
      [
        "processing_fee",
        "stripe_processing_fee",
        "card_processing_fee",
        "ach_processing_fee",
        "online_processing_fee",
      ],
      0
    )
  );

  let amount = numberValue(
    firstValue(
      receipt,
      [
        "total_amount",
        "payment_amount",
        "stripe_gross_amount",
        "stripe_paid_amount",
        "amount",
        "receipt_amount",
        "p_amount",
      ],
      0
    )
  );

  const invoiceAmount = numberValue(
    firstValue(
      receipt,
      [
        "invoice_amount",
        "invoice_amount_applied",
        "base_amount",
        "subtotal_amount",
        "amount_before_fee",
      ],
      processingFee > 0 ? Math.max(amount - processingFee, 0) : amount
    )
  );

  if (processingFee <= 0 && invoiceAmount > 0 && amount > invoiceAmount) {
    processingFee = Number((amount - invoiceAmount).toFixed(2));
  }

  if (processingFee > 0 && invoiceAmount > 0 && amount <= invoiceAmount) {
    amount = Number((invoiceAmount + processingFee).toFixed(2));
  }

  const pledgeAmount = numberValue(
    firstValue(receipt, ["pledged_amount", "pledge_amount", "p_pledged_amount"], 0)
  );

  const pledgePaid = numberValue(
    firstValue(receipt, ["pledge_paid_amount", "paid_amount", "p_paid_amount"], 0)
  );

  const pledgeRemainingRaw = firstValue(
    receipt,
    [
      "remaining_balance",
      "remaining_amount",
      "balance_due",
      "pledge_remaining_amount",
      "p_remaining_balance",
    ],
    null
  );

  const pledgeRemaining =
    pledgeRemainingRaw === null || pledgeRemainingRaw === ""
      ? Math.max(pledgeAmount - pledgePaid, 0)
      : numberValue(pledgeRemainingRaw);

  const coverageFrom = firstValue(
    receipt,
    [
      "coverage_from",
      "membership_from",
      "period_from",
      "coverage_start_date",
      "p_coverage_start_date",
      "i_coverage_start_date",
    ],
    ""
  );

  const coverageTo = firstValue(
    receipt,
    [
      "coverage_to",
      "membership_to",
      "period_to",
      "coverage_end_date",
      "p_coverage_end_date",
      "i_coverage_end_date",
    ],
    ""
  );

  const view = {
    receiptNumber: firstValue(
      receipt,
      ["receipt_number", "receipt_no", "number"],
      `RCPT-${receipt.id || Date.now()}`
    ),

    paymentNumber: firstValue(
      receipt,
      [
        "payment_number",
        "p_payment_number",
        "payment_no",
        "transaction_reference",
        "reference_number",
      ],
      "--"
    ),

    invoiceNumber: firstValue(
      receipt,
      ["invoice_number", "i_invoice_number", "invoice_no"],
      "--"
    ),

    paidBy: firstValue(
      receipt,
      [
        "payer_name",
        "donor_name",
        "guest_name",
        "full_name_snapshot",
        "p_full_name_snapshot",
        "i_full_name_snapshot",
        "member_name",
        "m_full_name",
        "full_name",
        "cardholder_name",
        "account_holder_name",
      ],
      "Guest Donor"
    ),

    memberNo: firstValue(
      receipt,
      [
        "member_no",
        "p_member_no",
        "i_member_no",
        "m_member_no",
        "member_number",
        "member_id_no",
      ],
      receipt.member_id ? `Member #${receipt.member_id}` : "--"
    ),

    donorType: firstValue(
      receipt,
      ["donor_type", "payer_type", "p_payer_type", "i_payer_type", "member_type"],
      receipt.member_id ? "Member" : "Non Member"
    ),

    email: firstValue(
      receipt,
      [
        "payer_email",
        "donor_email",
        "guest_email",
        "email_snapshot",
        "p_email_snapshot",
        "i_email_snapshot",
        "recipient_email",
        "member_email",
        "m_email",
        "email",
      ],
      "--"
    ),

    phone: firstValue(
      receipt,
      [
        "payer_phone",
        "donor_phone",
        "guest_phone",
        "phone_snapshot",
        "p_phone_snapshot",
        "i_phone_snapshot",
        "member_phone",
        "m_phone",
        "phone",
      ],
      "--"
    ),

    amount,
    invoiceAmount,
    baseAmount: invoiceAmount,
    processingFee,

    items: firstArrayValue(receipt, [
      "allocation_rows",
      "allocation_rows_json",
      "receipt_items",
      "receipt_items_json",
      "items",
      "items_json",
      "line_items",
      "line_items_json",
    ]),

    method: firstValue(
      receipt,
      ["payment_method", "p_payment_method", "method", "payment_method_type"],
      "--"
    ),

    category: firstValue(
      receipt,
      [
        "category",
        "p_category",
        "i_category",
        "payment_category",
        "finance_category",
        "donation_category",
        "invoice_type",
        "i_invoice_type",
        "payment_type",
        "p_payment_type",
      ],
      "--"
    ),

    donationCategory: firstValue(
      receipt,
      [
        "donation_category_label",
        "p_donation_category_label",
        "i_donation_category_label",
        "donation_category",
        "p_donation_category",
        "i_donation_category",
        "fund_name",
        "fund",
        "sub_category",
        "p_sub_category",
        "category",
      ],
      "--"
    ),

    programName: firstValue(
      receipt,
      [
        "program_name",
        "p_program_name",
        "i_program_name",
        "program_title",
        "school_program_name",
        "trip_name",
        "trip_program_name",
        "event_title",
      ],
      "--"
    ),

    participants: firstValue(
      receipt,
      [
        "participants_json",
        "p_participants_json",
        "i_participants_json",
        "student_names_json",
        "registrants_json",
        "children_json",
      ],
      ""
    ),

    participantCount: firstValue(
      receipt,
      [
        "participant_count",
        "p_participant_count",
        "i_participant_count",
        "student_count",
        "quantity",
      ],
      ""
    ),

    pricingTierLabel: firstValue(
      receipt,
      ["pricing_tier_label", "p_pricing_tier_label", "i_pricing_tier_label", "tier_label"],
      ""
    ),

    pledgeNumber: firstValue(receipt, ["pledge_number", "p_pledge_number", "pledge_no"], "--"),
    pledgeCampaign: firstValue(
      receipt,
      ["campaign_name", "p_campaign_name", "i_campaign_name", "pledge_campaign", "campaign", "campaign_title"],
      "--"
    ),
    pledgeAmount,
    pledgePaid,
    pledgeRemaining,

    planName: firstValue(
      receipt,
      ["plan_name", "p_plan_name", "i_plan_name", "membership_plan", "dues_plan_name"],
      ""
    ),

    coverageLabel: firstValue(
      receipt,
      ["coverage_label", "p_coverage_label", "i_coverage_label", "membership_coverage_label", "coverage_description"],
      ""
    ),

    monthsPaid: firstValue(
      receipt,
      ["months_paid", "p_months_paid", "i_months_paid", "coverage_month_count", "membership_months_paid"],
      ""
    ),

    coverageYear: firstValue(
      receipt,
      ["coverage_year", "p_coverage_year", "membership_year", "year"],
      new Date().getFullYear()
    ),

    coverageFrom,
    coverageTo,

    coverageMonths: firstValue(
      receipt,
      [
        "coverage_months_json",
        "p_coverage_months_json",
        "i_coverage_months_json",
        "coverage_months",
        "membership_months",
        "months",
      ],
      ""
    ),

    receiptDate: firstValue(
      receipt,
      ["receipt_date", "issued_at", "sent_at", "created_at", "date"],
      new Date()
    ),

    reference: firstValue(
      receipt,
      [
        "reference_no",
        "p_reference_no",
        "reference_number",
        "transaction_reference",
        "p_transaction_reference",
        "stripe_payment_intent_id",
        "p_stripe_payment_intent_id",
        "stripe_charge_id",
        "check_number",
        "zelle_reference",
      ],
      "--"
    ),

    receivedBy: firstValue(
      receipt,
      ["received_by_name", "staff_name", "created_by_name", "recorded_by_name"],
      "--"
    ),

    cardLast4: firstValue(receipt, ["card_last4", "p_card_last4", "card_last_4", "last4"], ""),
    cardBrand: firstValue(receipt, ["card_brand", "p_card_brand", "brand"], ""),
    cardExpMonth: firstValue(receipt, ["card_exp_month", "p_card_exp_month", "exp_month"], ""),
    cardExpYear: firstValue(receipt, ["card_exp_year", "p_card_exp_year", "exp_year"], ""),
  };

  view.coverageLabel = buildCoverageLabel(view);

  return view;
}

function parseCoverageMonths(data, category) {
  const selected = new Set();
  const jsonMonths = parseJsonArray(data.coverageMonths);

  jsonMonths.forEach((item) => {
    const raw =
      typeof item === "string"
        ? item
        : item.key || item.month || item.label || item.m || item.month_number;

    if (Number(raw) >= 1 && Number(raw) <= 12) {
      selected.add(MONTHS[Number(raw) - 1][0]);
      return;
    }

    const key = clean(raw, 20).toLowerCase().slice(0, 3);
    if (key) selected.add(key);
  });

  clean(data.coverageMonths, 300)
    .toLowerCase()
    .split(/[,\s|]+/)
    .map((item) => item.trim().slice(0, 3))
    .filter(Boolean)
    .forEach((item) => selected.add(item));

  if (data.coverageFrom && data.coverageTo) {
    const from = new Date(data.coverageFrom);
    const to = new Date(data.coverageTo);

    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
      const end = new Date(to.getFullYear(), to.getMonth(), 1);

      while (cursor <= end) {
        selected.add(MONTHS[cursor.getMonth()][0]);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }
  }

  if (selected.size === 0 && category.key === "membership" && clean(data.coverageMonths).toLowerCase() === "annual") {
    MONTHS.forEach(([key]) => selected.add(key));
  }

  return selected;
}

function numberToWords(value) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function underThousand(input) {
    let n = input;
    let words = "";

    if (n >= 100) {
      words += `${ones[Math.floor(n / 100)]} Hundred`;
      n %= 100;
      if (n) words += " ";
    }

    if (n >= 20) {
      words += tens[Math.floor(n / 10)];
      n %= 10;
      if (n) words += ` ${ones[n]}`;
    } else if (n > 0) {
      words += ones[n];
    }

    return words;
  }

  const amount = Math.abs(numberValue(value));
  let dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);

  if (dollars === 0 && cents === 0) return "Zero Dollars Only";

  const parts = [];

  if (dollars >= 1000000) {
    parts.push(`${underThousand(Math.floor(dollars / 1000000))} Million`);
    dollars %= 1000000;
  }

  if (dollars >= 1000) {
    parts.push(`${underThousand(Math.floor(dollars / 1000))} Thousand`);
    dollars %= 1000;
  }

  if (dollars > 0) parts.push(underThousand(dollars));

  const dollarWords = parts.length ? `${parts.join(" ")} Dollars` : "Zero Dollars";

  return cents > 0
    ? `${dollarWords} and ${underThousand(cents)} Cents Only`
    : `${dollarWords} Only`;
}

function allocationClassFor(category) {
  if (category.key === "membership") return "Membership";
  if (category.key === "school") return "School";
  if (category.key === "trip") return "Trip";
  if (category.key === "pledge") return "Pledge";
  return "Donation";
}

function allocationTypeFor(item = {}, category, data) {
  const key = normalizeKey(item.item_type || item.type || item.item_name || item.description);

  if (key.includes("registration")) return "Registration Fee";
  if (key.includes("processing") || key.includes("fee")) return "Processing Fee";
  if (category.key === "membership") return "Membership Dues";
  if (category.key === "school") return "School Program";
  if (category.key === "trip") return "Trip Program";
  if (category.key === "pledge") return "Pledge Payment";

  return data.donationCategory && data.donationCategory !== "--"
    ? data.donationCategory
    : "Donation";
}

function allocationDescriptionFor(item = {}, category, data) {
  const raw = firstValue(
    item,
    ["description", "detail", "coverage", "coverage_label", "program_name", "campaign_name", "donation_category"],
    ""
  );

  if (raw && normalizeKey(raw) !== "donation") return raw;

  if (category.key === "membership") {
    return [
      data.planName || "Membership Plan",
      data.coverageLabel,
      data.monthsPaid ? `${data.monthsPaid} month(s)` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (category.key === "school") {
    const participants = parseJsonArray(data.participants);
    return [
      `School program: ${data.programName || "--"}`,
      data.pricingTierLabel ? `Tier: ${data.pricingTierLabel}` : "",
      data.participantCount || participants.length ? `Participants: ${data.participantCount || participants.length}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (category.key === "trip") {
    const participants = parseJsonArray(data.participants);
    return [
      `Trip program: ${data.programName || "--"}`,
      data.pricingTierLabel ? `Tier: ${data.pricingTierLabel}` : "",
      data.participantCount || participants.length ? `Participants: ${data.participantCount || participants.length}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (category.key === "pledge") {
    return [
      `Campaign: ${data.pledgeCampaign || "--"}`,
      data.pledgeNumber && data.pledgeNumber !== "--" ? `Pledge #: ${data.pledgeNumber}` : "",
      `Remaining: ${money(data.pledgeRemaining || 0)}`,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  return `Donation category: ${data.donationCategory || category.label || "--"}`;
}

function amountForItem(item = {}, fallback = 0) {
  const quantity = numberValue(firstValue(item, ["quantity", "qty"], 1)) || 1;
  const unit = numberValue(firstValue(item, ["unit_price", "price"], 0));
  const total = numberValue(firstValue(item, ["amount", "total_amount", "total_price"], 0));

  return total > 0 ? total : unit > 0 ? unit * quantity : numberValue(fallback);
}

function allocationRows(receipt, data, category) {
  const receiptCategory = categoryFor(receipt);

  const rawItems =
    Array.isArray(data.items) && data.items.length
      ? data.items
      : firstArrayValue(receipt, [
          "allocation_rows",
          "allocation_rows_json",
          "receipt_items",
          "receipt_items_json",
          "items",
          "items_json",
          "line_items",
          "line_items_json",
        ]);

  if (rawItems.length) {
    const rows = rawItems.map((item) => {
      const isProcessingFee =
        String(item.code || "").toUpperCase() === "PF" ||
        String(item.type || item.description || "")
          .toLowerCase()
          .includes("processing fee");

      const itemCategory =
        isProcessingFee
          ? byCategoryKey("other_fund")
          : receiptCategory.key === "membership"
            ? receiptCategory
            : categoryFor({ ...receipt, ...item });

      const rowClass =
        isProcessingFee
          ? "Fee"
          : item.className ||
            item.class_name ||
            allocationClassFor(itemCategory);

      return {
        code:
          item.code ||
          item.item_code ||
          (isProcessingFee ? "PF" : itemCategory.code),

        type:
          item.type ||
          item.item_type ||
          (isProcessingFee
            ? "Processing Fee"
            : allocationTypeFor(item, itemCategory, data)),

        className: rowClass,

        description:
          item.description ||
          item.detail ||
          item.memo ||
          (isProcessingFee
            ? `${String(data.method || "").toLowerCase() === "ach" ? "ACH / checking" : "Card"} processing fee`
            : allocationDescriptionFor(item, itemCategory, data)),

        amount: amountForItem(
          item,
          isProcessingFee
            ? data.processingFee
            : data.invoiceAmount || data.baseAmount || data.amount
        ),

        remark:
          firstValue(
            item,
            ["remark", "notes", "reference_number", "payment_reference", "reference"],
            ""
          ) ||
          (rowClass === "Membership" ? data.paymentNumber : data.reference) ||
          "--",
      };
    });

    return appendProcessingFeeRow(rows, data);
  }

  const className = allocationClassFor(category);

  return appendProcessingFeeRow(
    [
      {
        code: category.code,
        type: allocationTypeFor({}, category, data),
        className,
        description: allocationDescriptionFor({}, category, data),
        amount: data.invoiceAmount || data.baseAmount || data.amount,
        remark:
          className === "Membership"
            ? data.paymentNumber || data.reference
            : data.reference || "--",
      },
    ],
    data
  );
}
async function ensureOutputDir() {
  await fsp.mkdir(RECEIPT_PDF_ROOT, { recursive: true });
}

function registerFonts(doc) {
  if (fs.existsSync(FONT_LATIN_REGULAR)) doc.registerFont("latin", FONT_LATIN_REGULAR);
  if (fs.existsSync(FONT_LATIN_BOLD)) doc.registerFont("latin-bold", FONT_LATIN_BOLD);
  if (fs.existsSync(FONT_ETHIOPIC_REGULAR)) doc.registerFont("ethiopic", FONT_ETHIOPIC_REGULAR);
  if (fs.existsSync(FONT_ETHIOPIC_BOLD)) doc.registerFont("ethiopic-bold", FONT_ETHIOPIC_BOLD);
}

function hasEthiopic(value) {
  return /[\u1200-\u137F]/.test(String(value || ""));
}

function hasLatin(value) {
  return /[A-Za-z0-9]/.test(String(value || ""));
}

function setFont(doc, bold = false, sample = "") {
  const text = String(sample || "");
  const wantsEthiopic = hasEthiopic(text);

  const candidates = wantsEthiopic
    ? [bold ? "ethiopic-bold" : "ethiopic", bold ? "latin-bold" : "latin"]
    : [bold ? "latin-bold" : "latin", bold ? "Helvetica-Bold" : "Helvetica"];

  for (const candidate of candidates) {
    try {
      doc.font(candidate);
      return;
    } catch {
      // Try next font.
    }
  }

  doc.font(bold ? "Helvetica-Bold" : "Helvetica");
}

function splitBilingual(value) {
  const raw = clean(value, 500);
  if (!hasEthiopic(raw) || !hasLatin(raw)) return null;

  const parts = raw.split(/\s+(?:—|-|--)\s+/);
  if (parts.length < 2) return null;

  return {
    amharic: parts[0],
    english: parts.slice(1).join(" - "),
  };
}

function writeText(doc, text, x, y, width, options = {}) {
  const raw = clean(text === undefined || text === null || text === "" ? "--" : text, options.max || 500);
  const color = options.color || "#111827";
  const size = options.size || 8.5;
  const bilingual = splitBilingual(raw);

  if (bilingual) {
    setFont(doc, options.bold, bilingual.amharic);
    doc.fontSize(Math.max(size - 0.7, 6)).fillColor(color).text(bilingual.amharic, x, y, {
      width,
      lineGap: 0,
      align: options.align || "left",
    });

    setFont(doc, options.bold, bilingual.english);
    doc.fontSize(Math.max(size - 1, 6)).fillColor(color).text(bilingual.english, x, y + 9, {
      width,
      lineGap: 0,
      align: options.align || "left",
    });

    return;
  }

  setFont(doc, options.bold, raw);
  doc.fontSize(size).fillColor(color).text(raw, x, y, {
    width,
    lineGap: options.lineGap ?? 0,
    align: options.align || "left",
  });
}

function label(doc, text, x, y, width) {
  writeText(doc, text, x, y, width, {
    bold: true,
    size: 6.7,
    color: "#5d6878",
  });
}

function value(doc, text, x, y, width, options = {}) {
  writeText(doc, text, x, y, width, options);
}

function drawOrthodoxCross(doc, x, y, size) {
  const s = size;
  const c = s / 2;
  const gold = "#d8b451";
  const goldDark = "#9f7a1f";
  const goldLight = "#f8e7a1";

  function diamond(cx, cy, w, h, color) {
    doc
      .fillColor(color)
      .moveTo(cx, cy - h / 2)
      .lineTo(cx + w / 2, cy)
      .lineTo(cx, cy + h / 2)
      .lineTo(cx - w / 2, cy)
      .closePath()
      .fill();
  }

  function ring(cx, cy, r) {
    doc
      .circle(cx, cy, r)
      .fillColor(goldLight)
      .fill()
      .circle(cx, cy, r)
      .strokeColor(goldDark)
      .lineWidth(0.7)
      .stroke();
  }

  doc.save();
  doc.translate(x, y);

  diamond(c, s * 0.12, s * 0.26, s * 0.22, goldLight);
  diamond(c, s * 0.88, s * 0.26, s * 0.22, goldLight);
  diamond(s * 0.12, c, s * 0.22, s * 0.26, goldLight);
  diamond(s * 0.88, c, s * 0.22, s * 0.26, goldLight);

  doc.fillColor(gold).strokeColor(goldDark).lineWidth(0.8);
  doc.roundedRect(c - s * 0.07, s * 0.16, s * 0.14, s * 0.68, 2).fillAndStroke();
  doc.roundedRect(s * 0.16, c - s * 0.07, s * 0.68, s * 0.14, 2).fillAndStroke();
  doc.roundedRect(c - s * 0.18, s * 0.16, s * 0.36, s * 0.08, 2).fillAndStroke();
  doc.roundedRect(c - s * 0.18, s * 0.76, s * 0.36, s * 0.08, 2).fillAndStroke();
  doc.roundedRect(s * 0.16, c - s * 0.18, s * 0.08, s * 0.36, 2).fillAndStroke();
  doc.roundedRect(s * 0.76, c - s * 0.18, s * 0.08, s * 0.36, 2).fillAndStroke();

  ring(c, s * 0.15, s * 0.07);
  ring(c, s * 0.85, s * 0.07);
  ring(s * 0.15, c, s * 0.07);
  ring(s * 0.85, c, s * 0.07);
  ring(c, c, s * 0.075);

  doc.circle(c, c, s * 0.025).fillColor("#fff7cc").fill();

  doc.restore();
}

function drawHeader(doc, data) {
  const church = churchInfo();

  doc.rect(0, 0, PAGE.width, 104).fill("#0b3d66");
  drawOrthodoxCross(doc, 42, 22, 52);

  value(doc, church.amharicName, 108, 22, 302, {
    bold: true,
    size: 10.2,
    color: "#ffffff",
  });

  value(doc, church.name, 108, 47, 302, {
    bold: true,
    size: 9.2,
    color: "#ffffff",
  });

  value(doc, [church.address, church.phone, church.website].filter(Boolean).join(" | "), 108, 75, 360, {
    size: 6.5,
    color: "#dbeafe",
  });

  value(doc, "OFFICIAL RECEIPT", 420, 25, 148, {
    bold: true,
    size: 13,
    color: "#ffffff",
    align: "right",
  });

  value(doc, data.receiptNumber, 420, 48, 148, {
    bold: true,
    size: 7,
    color: "#e0f2fe",
    align: "right",
  });

  value(doc, `Date: ${formatDate(data.receiptDate || new Date())}`, 420, 67, 148, {
    size: 7,
    color: "#dbeafe",
    align: "right",
  });

  doc.rect(42, 116, PAGE.contentWidth, 1).fill("#c8d3df");
}

function drawPayerSection(doc, data) {
  value(doc, "Official Finance Receipt", 42, 132, 250, {
    bold: true,
    size: 13,
    color: "#0f3e67",
  });

  doc.roundedRect(42, 156, PAGE.contentWidth, 58, 4).fillAndStroke("#eef6ff", "#c8d3df");

  label(doc, "Paid By", 56, 168, 150);
  value(doc, data.paidBy, 56, 181, 150, { bold: true, size: 8.4 });

  label(doc, "Donor Type", 214, 168, 75);
  value(doc, data.donorType, 214, 181, 75, { size: 8 });

  label(doc, "Member ID / No.", 302, 168, 88);
  value(doc, data.memberNo, 302, 181, 88, { size: 8 });

  label(doc, "Email", 404, 168, 145);
  value(doc, data.email, 404, 181, 145, { size: 7.2 });

  label(doc, "Phone", 56, 194, 95);
  value(doc, data.phone, 56, 205, 95, { size: 7.3 });

  label(doc, "Payment #", 160, 194, 120);
  value(doc, data.paymentNumber, 160, 205, 120, { size: 7 });

  label(doc, "Invoice #", 290, 194, 120);
  value(doc, data.invoiceNumber, 290, 205, 120, { size: 7 });

  label(doc, "Reference #", 420, 194, 130);
  value(doc, data.reference, 420, 205, 130, { size: 7 });
}

function drawContextSection(doc, data, category) {
  const isMembership = category.key === "membership";
  const isProgram = category.key === "school" || category.key === "trip";
  const isPledge = category.key === "pledge";

  const title = isMembership
    ? "Membership Payment"
    : isProgram
      ? category.key === "school"
        ? "School Program Payment"
        : "Trip Program Payment"
      : isPledge
        ? "Pledge Payment"
        : "Donation Payment";

  value(doc, "Payment Context", 42, 232, 220, {
    bold: true,
    size: 11,
    color: "#0f3e67",
  });

  doc.roundedRect(42, 254, PAGE.contentWidth, isMembership ? 74 : 54, 4)
    .fillAndStroke("#ffffff", "#c8d3df");

  label(doc, "Payment Type", 56, 266, 130);
  value(doc, title, 56, 279, 150, {
    bold: true,
    size: 7.6,
  });

  if (isMembership) {
    label(doc, "Membership Plan", 220, 266, 130);
    value(doc, data.planName || "Membership", 220, 279, 150, { size: 7.2 });

    label(doc, "Coverage", 390, 266, 130);
    value(doc, data.coverageLabel || `Year ${data.coverageYear}`, 390, 279, 145, {
      bold: true,
      size: 7.2,
      color: "#0f7a3d",
    });

    const selected = parseCoverageMonths(data, category);
    const chipW = 34;
    const chipH = 14;
    const startX = 56;
    const startY = 302;

    MONTHS.forEach(([monthKey, monthText], index) => {
      const checked = selected.has(monthKey);
      const x = startX + index * 40.5;

      doc.roundedRect(x, startY, chipW, chipH, 3)
        .fillAndStroke(
          checked ? "#dcfce7" : "#ffffff",
          checked ? "#86efac" : "#cbd5e1"
        );

      value(doc, checked ? `X ${monthText}` : monthText, x + 3, startY + 3.5, chipW - 6, {
        bold: checked,
        size: 5.7,
        color: checked ? "#166534" : "#64748b",
        align: "center",
      });
    });

    return;
  }

  label(doc, isProgram ? "Program" : isPledge ? "Campaign" : "Donation Category", 220, 266, 150);
  value(
    doc,
    isProgram
      ? data.programName || "--"
      : isPledge
        ? data.pledgeCampaign || "--"
        : data.donationCategory || category.label,
    220,
    279,
    180,
    { size: 7.2 }
  );

  label(doc, "Reference", 420, 266, 120);
  value(doc, data.reference || "--", 420, 279, 125, { size: 6.8 });
}

function drawAllocationTable(doc, rows) {
  value(doc, "Payment Allocation", 42, 336, 220, {
    bold: true,
    size: 11,
    color: "#0f3e67",
  });

  const x = 42;
  const y = 358;
  const widths = [32, 92, 70, 185, 66, 83];
  const rowH = 27;

  doc.rect(x, y, PAGE.contentWidth, 22).fill("#0f3e67");

  const headers = ["Code", "Type", "Class", "Description", "Amount", "Remark"];
  let cursorX = x;

  headers.forEach((header, index) => {
    value(doc, header, cursorX + 4, y + 7, widths[index] - 7, {
      bold: true,
      size: 5.8,
      color: "#ffffff",
    });

    cursorX += widths[index];
  });

  const visibleRows = rows.slice(0, 4);

  visibleRows.forEach((row, index) => {
    const rowY = y + 22 + index * rowH;

    doc
      .rect(x, rowY, PAGE.contentWidth, rowH)
      .fillAndStroke(index % 2 === 0 ? "#ffffff" : "#f8fafc", "#d7dee8");

    let cx = x;

    value(doc, row.code || "--", cx + 4, rowY + 8, widths[0] - 7, { size: 6.4 });
    cx += widths[0];

    value(doc, row.type || "--", cx + 4, rowY + 5, widths[1] - 7, { size: 6.1 });
    cx += widths[1];

    value(doc, row.className || "--", cx + 4, rowY + 8, widths[2] - 7, {
      bold: true,
      size: 6.2,
      color: "#0f3e67",
    });
    cx += widths[2];

    value(doc, row.description || "--", cx + 4, rowY + 5, widths[3] - 7, { size: 6.1 });
    cx += widths[3];

    value(doc, money(row.amount || 0), cx + 4, rowY + 8, widths[4] - 7, {
      bold: true,
      color: "#0f7a3d",
      size: 6.5,
      align: "right",
    });
    cx += widths[4];

    value(doc, row.remark || "--", cx + 4, rowY + 7, widths[5] - 7, { size: 5.8 });
  });

  const total = rows.reduce((sum, row) => sum + numberValue(row.amount), 0);
  const totalY = y + 22 + visibleRows.length * rowH;

  doc.rect(x, totalY, PAGE.contentWidth, 22).fillAndStroke("#eef6ff", "#c8d3df");

  value(doc, "Total", 365, totalY + 7, 60, {
    bold: true,
    size: 7.5,
    color: "#0f3e67",
  });

  value(doc, money(total), 430, totalY + 7, 100, {
    bold: true,
    size: 7.5,
    color: "#0f7a3d",
  });

  if (rows.length > visibleRows.length) {
    value(
      doc,
      `${rows.length - visibleRows.length} additional item(s) are recorded in the finance system.`,
      x + 5,
      totalY + 25,
      500,
      {
        size: 6.2,
        color: "#64748b",
      }
    );

    return totalY + 36;
  }

  return totalY + 28;
}

function drawEnterpriseDetails(doc, data, y) {
  value(doc, "Enterprise Details", 42, y, 220, {
    bold: true,
    size: 11,
    color: "#0f3e67",
  });

  doc.roundedRect(42, y + 18, PAGE.contentWidth, 46, 4).stroke("#c8d3df");

  label(doc, "Primary Classification", 56, y + 29, 145);
  value(doc, categoryFor(data).key === "membership" ? "Membership" : data.category, 56, y + 41, 145, { size: 6.7 });

  label(doc, "Program / Campaign", 220, y + 29, 145);
  value(
    doc,
    data.programName && data.programName !== "--"
      ? data.programName
      : data.pledgeCampaign && data.pledgeCampaign !== "--"
        ? data.pledgeCampaign
        : "--",
    220,
    y + 41,
    145,
    { size: 6.7 }
  );

  label(doc, "Recorded By", 385, y + 29, 130);
  value(doc, data.receivedBy, 385, y + 41, 130, { size: 6.7 });

  label(doc, "Payment Instrument", 56, y + 53, 145);
  value(
    doc,
    data.cardLast4
      ? `${data.cardBrand || "Card"} **** ${data.cardLast4}`
      : data.method || "--",
    56,
    y + 64,
    145,
    { size: 6.3 }
  );

  label(doc, "Receipt Status", 385, y + 53, 130);
  value(doc, "Issued", 385, y + 64, 130, {
    bold: true,
    size: 6.5,
    color: "#0f7a3d",
  });

  return y + 76;
}

function drawAmountAndCertification(doc, data, y) {
  if (y > 600) y = 600;

  value(doc, "Amount in Words", 42, y, 220, {
    bold: true,
    size: 11,
    color: "#0f3e67",
  });

  doc.roundedRect(42, y + 18, PAGE.contentWidth, 25, 4).stroke("#c8d3df");

  value(doc, numberToWords(data.amount), 56, y + 27, 500, {
    bold: true,
    size: 7.4,
  });

  value(doc, "Payment Method / Certification", 42, y + 55, 260, {
    bold: true,
    size: 11,
    color: "#0f3e67",
  });

  doc.roundedRect(42, y + 74, PAGE.contentWidth, 58, 4).fillAndStroke("#f8fafc", "#c8d3df");

  label(doc, "Method", 56, y + 85, 100);
  value(doc, data.method, 56, y + 97, 100, { bold: true, size: 6.8 });

  label(doc, "Reference", 170, y + 85, 170);
  value(doc, data.reference, 170, y + 97, 170, { size: 6.4 });

  label(doc, "Issued Date", 360, y + 85, 95);
  value(doc, formatDate(data.receiptDate || new Date()), 360, y + 97, 95, { size: 6.5 });

  label(doc, "Certified By", 56, y + 112, 150);
  value(doc, "Holy Trinity Finance Office", 56, y + 123, 170, { bold: true, size: 6.4 });

  label(doc, "Authorization", 250, y + 112, 140);
  value(doc, "System Issued Receipt", 250, y + 123, 150, {
    bold: true,
    size: 6.4,
    color: "#0f7a3d",
  });

  label(doc, "Audit Reference", 420, y + 112, 120);
  value(doc, data.receiptNumber, 420, y + 123, 120, { size: 6.1 });

  return y + 140;
}

function drawFooter(doc, data) {
  const y = 724;

  doc.rect(42, y - 10, PAGE.contentWidth, 1).fill("#c8d3df");

  value(
    doc,
    "This receipt was generated by the Holy Trinity Finance & Membership Platform. Please retain it for your records.",
    42,
    y,
    PAGE.contentWidth,
    {
      size: 6.4,
      color: "#64748b",
      align: "center",
    }
  );

  value(doc, `Generated: ${new Date().toISOString()}`, 42, y + 15, 250, {
    size: 6,
    color: "#64748b",
  });

  value(doc, `Receipt: ${data.receiptNumber}`, 420, y + 15, 150, {
    size: 6,
    color: "#64748b",
    align: "right",
  });
}

function renderReceipt(doc, receipt) {
  const data = receiptView(receipt);
  const category = categoryFor(receipt);
  const rows = allocationRows(receipt, data, category);

  registerFonts(doc);

  drawHeader(doc, data);
  drawPayerSection(doc, data);
  drawContextSection(doc, data, category);

  let y = drawAllocationTable(doc, rows);
  y = drawEnterpriseDetails(doc, data, y);
  drawAmountAndCertification(doc, data, y);
  drawFooter(doc, data);

  return data;
}

async function ensureOutputDir() {
  await fsp.mkdir(RECEIPT_PDF_ROOT, { recursive: true });
}

async function generateReceiptPdf(receipt, options = {}) {
  if (!receipt || typeof receipt !== "object") {
    throw new Error("Receipt data is required to generate a PDF.");
  }

  await ensureOutputDir();

  const previewData = receiptView(receipt);
  const fileName = `${safeFileName(previewData.receiptNumber || `receipt-${receipt.id || Date.now()}`)}.pdf`;
  const filePath = path.join(RECEIPT_PDF_ROOT, fileName);
  const pdfUrl = `${RECEIPT_PDF_PUBLIC_PREFIX.replace(/\/+$/, "")}/${fileName}`;

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: PAGE.margin,
      autoFirstPage: true,
      bufferPages: false,
      info: {
        Title: `Receipt ${previewData.receiptNumber}`,
        Author: churchInfo().name,
        Subject: "Official Finance Receipt",
      },
    });

    const stream = fs.createWriteStream(filePath);

    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);

    doc.pipe(stream);
    renderReceipt(doc, receipt);
    doc.end();
  });

  const stat = await fsp.stat(filePath);

  return {
    success: true,
    receipt_id: receipt.id || null,
    receipt_number: previewData.receiptNumber,
    filename: fileName,
    file_path: filePath,
    path: filePath,
    pdf_url: pdfUrl,
    url: pdfUrl,
    mime_type: "application/pdf",
    size: stat.size,
    generated_at: new Date().toISOString(),
    download_disposition: options.download ? "attachment" : "inline",
  };
}

async function generateReceiptPdfBuffer(receipt) {
  if (!receipt || typeof receipt !== "object") {
    throw new Error("Receipt data is required to generate a PDF.");
  }

  return new Promise((resolve, reject) => {
    const buffers = [];

    const doc = new PDFDocument({
      size: "LETTER",
      margin: PAGE.margin,
      autoFirstPage: true,
      bufferPages: false,
    });

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    renderReceipt(doc, receipt);
    doc.end();
  });
}

module.exports = {
  CATEGORY_LABELS,
  CATEGORY_CODES,
  generateReceiptPdf,
  generateReceiptPdfBuffer,
};