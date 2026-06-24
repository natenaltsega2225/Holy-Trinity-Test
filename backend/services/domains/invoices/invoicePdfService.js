// backend/services/domains/invoices/invoicePdfService.js
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

const INVOICE_PDF_ROOT =
  process.env.FINANCE_INVOICE_PDF_ROOT ||
  path.join(BACKEND_ROOT, "storage", "finance", "invoices");

const INVOICE_PDF_PUBLIC_PREFIX =
  process.env.FINANCE_INVOICE_PDF_PUBLIC_PREFIX ||
  "/storage/finance/invoices";

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
    .replace(/^-|-$/g, "");
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
function participantNames(value) {
  return parseJsonArray(value)
    .map((item) => {
      if (typeof item === "string") {
        return clean(item, 120);
      }

      return clean(
        firstValue(
          item,
          [
            "full_name",
            "name",
            "student_name",
            "participant_name",
            "child_name",
            "first_name",
          ],
          ""
        ),
        120
      );
    })
    .filter(Boolean);
}
function byCategoryKey(key) {
  return (
    CATEGORY_CODES.find((item) => item.key === key) ||
    CATEGORY_CODES.find((item) => item.key === "other_fund")
  );
}

function categoryFor(invoice = {}) {
  const rawValues = [
    firstValue(invoice, [
      "category",
      "i_category",
      "p_category",
      "payment_category",
      "finance_category",
      "invoice_type",
      "payment_type",
      "i_payment_type",
      "p_payment_type",
      "type",
      "item_type",
      "line_item_type",
      "sub_category",
      "i_sub_category",
      "p_sub_category",
      "donation_category_key",
      "donation_category",
      "i_donation_category",
      "p_donation_category",
      "program_category",
    ], ""),
    invoice.plan_name,
    invoice.p_plan_name,
    invoice.membership_plan,
    invoice.coverage_label,
    invoice.campaign_name,
    invoice.program_name,
    invoice.item_name,
    invoice.description,
  ]
    .map((value) => normalizeKey(value))
    .filter(Boolean);

  const raw = rawValues.join("_") || "other_fund";

  if (CATEGORY_LABELS[raw]) return byCategoryKey(raw);

  if (
    raw.includes("member") ||
    raw.includes("dues") ||
    raw.includes("registration_fee") ||
    raw.includes("membership_registration")
  ) {
    return byCategoryKey("membership");
  }

  if (raw.includes("pledge") || raw.includes("campaign")) return byCategoryKey("pledge");
  if (raw.includes("school") || raw.includes("kids")) return byCategoryKey("school");
  if (raw.includes("trip") || raw.includes("travel")) return byCategoryKey("trip");
  if (raw.includes("plate")) return byCategoryKey("plate_collection");
  if (raw.includes("sunday")) return byCategoryKey("sunday_cash_collection");
  if (raw.includes("candle")) return byCategoryKey("candle_sale");
  if (raw.includes("tithe")) return byCategoryKey("tithe");
  if (raw.includes("vow")) return byCategoryKey("vows");
  if (raw.includes("bapt")) return byCategoryKey("baptism");
  if (raw.includes("wedding") || raw.includes("engagement")) return byCategoryKey("wedding_engagement");
  if (raw.includes("memorial") || raw.includes("funeral")) return byCategoryKey("memorial_service");
  if (raw.includes("building")) return byCategoryKey("building_fund");
  if (raw.includes("charity")) return byCategoryKey("charity_fund");
  if (raw.includes("auction")) return byCategoryKey("auction");
  if (raw.includes("donation") || raw.includes("gift")) return byCategoryKey("general_donation");

  return byCategoryKey("other_fund");
}

function categoryKeyFor(invoice = {}) {
  return categoryFor(invoice).key;
}
function readableKey(value) {
  return clean(value, 80)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function methodLabel(invoice = {}) {
  const rawMethod = normalizeKey(
    firstValue(
      invoice,
      [
        "payment_method",
        "method",
        "p_payment_method",
        "p_method",
        "provider_method",
        "payment_method_type",
        "stripe_payment_method_type",
      ],
      ""
    )
  );

  const provider = normalizeKey(
    firstValue(invoice, ["provider", "p_provider", "processor"], "")
  );

  const brand = readableKey(
    firstValue(
      invoice,
      [
        "card_brand",
        "p_card_brand",
        "brand",
        "payment_brand",
        "card_type",
      ],
      ""
    )
  );

  const last4 = clean(
    firstValue(
      invoice,
      [
        "card_last4",
        "card_last_4",
        "p_card_last4",
        "last4",
        "bank_last4",
        "ach_last4",
      ],
      ""
    ),
    20
  ).replace(/\D/g, "").slice(-4);

  const checkNo = clean(
    firstValue(invoice, ["check_number", "check_no", "p_check_number"], ""),
    80
  );

  const zelleRef = clean(
    firstValue(invoice, ["zelle_reference", "zelle_ref", "p_zelle_reference"], ""),
    80
  );

  if (rawMethod.includes("cash")) return "Cash";

  if (rawMethod.includes("check")) {
    return checkNo ? `Check #${checkNo}` : "Check";
  }

  if (rawMethod.includes("zelle")) {
    return zelleRef ? `Zelle (${zelleRef})` : "Zelle";
  }

  if (
    rawMethod.includes("ach") ||
    rawMethod.includes("bank") ||
    rawMethod.includes("us_bank_account")
  ) {
    return last4 ? `ACH / Bank **** ${last4}` : "ACH / Bank";
  }

  if (
    rawMethod.includes("card") ||
    rawMethod.includes("stripe") ||
    provider.includes("stripe") ||
    brand ||
    last4
  ) {
    if (brand && last4) return `${brand} **** ${last4}`;
    if (last4) return `Card **** ${last4}`;
    return brand || "Card";
  }

  return readableKey(rawMethod || provider || "Payment");
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
    email: process.env.CHURCH_EMAIL || process.env.ORGANIZATION_EMAIL || "",
    website: process.env.CHURCH_WEBSITE || process.env.FRONTEND_URL || "",
    taxId: process.env.CHURCH_TAX_ID || process.env.ORGANIZATION_TAX_ID || "",
  };
}


function invoiceView(invoice) {
  const amount = numberValue(
    firstValue(
      invoice,
      ["total_amount", "amount", "invoice_amount", "subtotal", "p_amount"],
      0
    )
  );

  const rawPaidAmount = numberValue(
    firstValue(
      invoice,
      [
        "paid_amount",
        "amount_paid",
        "collected_amount",
        "payment_amount",
        "p_amount",
      ],
      0
    )
  );

  const paidAmount =
    amount > 0
      ? Math.min(Math.max(rawPaidAmount, 0), amount)
      : Math.max(rawPaidAmount, 0);

  const explicitBalance = firstValue(
    invoice,
    ["balance_due", "remaining_amount", "outstanding_amount"],
    null
  );

  const computedBalanceDue = Math.max(amount - paidAmount, 0);

  const storedBalanceDue =
    explicitBalance === null ||
    explicitBalance === undefined ||
    explicitBalance === ""
      ? null
      : numberValue(explicitBalance);

  const balanceDue =
    amount > 0 && paidAmount >= amount
      ? 0
      : Math.max(
          Math.min(
            storedBalanceDue === null ? computedBalanceDue : storedBalanceDue,
            computedBalanceDue
          ),
          0
        );

  const category = categoryFor(invoice);
  const categoryKey = category.key;

  const participants = parseJsonArray(
    firstValue(
      invoice,
      ["participants_json", "i_participants_json", "p_participants_json"],
      "[]"
    )
  );

  const coverageStartDate = firstValue(
    invoice,
    [
      "coverage_start_date",
      "membership_start_date",
      "period_from",
      "coverage_from",
      "start_date",
      "p_coverage_start_date",
      "p_membership_start_date",
      "p_period_from",
      "p_start_date",
    ],
    ""
  );

  const coverageEndDate = firstValue(
    invoice,
    [
      "coverage_end_date",
      "membership_end_date",
      "period_to",
      "coverage_to",
      "end_date",
      "p_coverage_end_date",
      "p_membership_end_date",
      "p_period_to",
      "p_end_date",
    ],
    ""
  );

  const coverageStartMonth = Number(
    firstValue(
      invoice,
      ["coverage_start_month", "start_month", "p_coverage_start_month"],
      0
    )
  );

  const coverageEndMonth = Number(
    firstValue(
      invoice,
      ["coverage_end_month", "end_month", "p_coverage_end_month"],
      0
    )
  );

  const coverageYear = Number(
    firstValue(
      invoice,
      ["coverage_year", "membership_year", "year", "p_coverage_year"],
      new Date().getFullYear()
    )
  );

  const coverageEndYear = Number(
    firstValue(
      invoice,
      ["coverage_end_year", "p_coverage_end_year"],
      coverageYear
    )
  );

  function monthName(value) {
    const months = [
      null,
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const n = Number(value || 0);
    return months[n] || "";
  }

  function dateMonthLabel(start, end) {
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;

    if (
      s &&
      e &&
      !Number.isNaN(s.getTime()) &&
      !Number.isNaN(e.getTime())
    ) {
      const sm = monthName(s.getMonth() + 1);
      const em = monthName(e.getMonth() + 1);
      const sy = s.getFullYear();
      const ey = e.getFullYear();

      return sy === ey
        ? `${sm} - ${em} ${sy}`
        : `${sm} ${sy} - ${em} ${ey}`;
    }

    return "";
  }

  const coverageLabelFromDates = dateMonthLabel(
    coverageStartDate,
    coverageEndDate
  );

  const coverageLabelFromMonths =
    coverageStartMonth >= 1 &&
    coverageStartMonth <= 12 &&
    coverageEndMonth >= 1 &&
    coverageEndMonth <= 12
      ? coverageYear === coverageEndYear
        ? `${monthName(coverageStartMonth)} - ${monthName(coverageEndMonth)} ${coverageYear}`
        : `${monthName(coverageStartMonth)} ${coverageYear} - ${monthName(coverageEndMonth)} ${coverageEndYear}`
      : "";

  const coverageLabel =
    coverageLabelFromDates ||
    coverageLabelFromMonths ||
    firstValue(
      invoice,
      ["coverage_label", "p_coverage_label", "coverage_period"],
      ""
    );

  const pledgeAmountRaw = firstValue(
    invoice,
    ["pledged_amount", "pledge_amount", "p_pledged_amount"],
    null
  );

  const pledgePaidRaw = firstValue(
    invoice,
    ["pledge_paid_amount", "p_paid_amount"],
    null
  );

  const pledgeAmount =
    pledgeAmountRaw === null ? null : numberValue(pledgeAmountRaw);

  const pledgePaid =
    pledgePaidRaw === null ? null : numberValue(pledgePaidRaw);

  const pledgeRemainingRaw = firstValue(
    invoice,
    ["pledge_remaining_amount", "remaining_balance", "p_remaining_balance"],
    null
  );

  const pledgeRemaining =
    pledgeRemainingRaw === null
      ? pledgeAmount === null
        ? null
        : Math.max(numberValue(pledgeAmount) - numberValue(pledgePaid), 0)
      : numberValue(pledgeRemainingRaw);

  const billTo = firstValue(
    invoice,
    [
      "payer_name",
      "donor_name",
      "guest_name",
      "customer_name",
      "full_name_snapshot",
      "p_full_name_snapshot",
      "member_name",
      "m_full_name",
      "member_full_name",
      "full_name",
    ],
    "Guest Donor"
  );

  return {
    id: invoice.id,
    memberId: invoice.member_id || null,
    paymentId: invoice.payment_id || invoice.p_id || null,
    pledgeId: invoice.pledge_id || invoice.p_pledge_id || null,
    campaignId: invoice.campaign_id || invoice.p_campaign_id || null,
    registrationId: invoice.registration_id || invoice.p_registration_id || null,
    newsEventId:
      invoice.news_event_id ||
      invoice.related_entity_id ||
      invoice.p_news_event_id ||
      null,

    invoiceNumber: firstValue(
      invoice,
      ["invoice_number", "invoice_no", "number"],
      `INV-${invoice.id || Date.now()}`
    ),

    paymentNumber: firstValue(
      invoice,
      [
        "payment_number",
        "p_payment_number",
        "payment_no",
        "transaction_reference",
        "reference_number",
      ],
      "--"
    ),

    receiptNumber: firstValue(
      invoice,
      ["receipt_number", "r_receipt_number", "receipt_no"],
      "--"
    ),

    billTo,
    memberName: billTo,

    memberNo: firstValue(
      invoice,
      ["member_no", "p_member_no", "m_member_no", "member_number"],
      invoice.member_id ? `M-${String(invoice.member_id).padStart(5, "0")}` : "--"
    ),

    payerType: firstValue(
      invoice,
      ["donor_type", "payer_type", "p_payer_type", "member_type"],
      invoice.member_id ? "Member" : "Non Member"
    ),

    email: firstValue(
      invoice,
      [
        "payer_email",
        "donor_email",
        "guest_email",
        "customer_email",
        "email_snapshot",
        "p_email_snapshot",
        "recipient_email",
        "m_email",
        "member_email",
        "email",
      ],
      ""
    ),

    phone: firstValue(
      invoice,
      [
        "payer_phone",
        "donor_phone",
        "guest_phone",
        "customer_phone",
        "phone_snapshot",
        "p_phone_snapshot",
        "m_phone",
        "member_phone",
        "phone",
      ],
      "--"
    ),

    amount,
    paidAmount,
    balanceDue,

    status:
      amount > 0 && paidAmount >= amount
        ? "paid"
        : firstValue(invoice, ["invoice_status", "status"], "open"),

    invoiceDate: firstValue(
      invoice,
      ["invoice_date", "issued_at", "created_at", "date"],
      new Date()
    ),

    dueDate: firstValue(invoice, ["due_date", "invoice_due_date"], ""),

    category: categoryKey,
    categoryKey,
    categoryLabel: CATEGORY_LABELS[categoryKey] || CATEGORY_LABELS.other_fund,

    donationCategory:
      categoryKey === "membership"
        ? "Membership"
        : firstValue(
            invoice,
            [
              "donation_category_label",
              "i_donation_category_label",
              "p_donation_category_label",
              "donation_category",
              "i_donation_category",
              "p_donation_category",
              "fund_name",
              "fund",
              "category",
            ],
            "--"
          ),

    planName: firstValue(
      invoice,
      [
        "plan_name",
        "p_plan_name",
        "membership_plan",
        "dues_plan_name",
        "coverage_plan_name",
        "item_name",
      ],
      categoryKey === "membership" ? "Membership Plan" : ""
    ),

    monthsPaid: firstValue(
      invoice,
      [
        "months_paid",
        "duration_months",
        "coverage_month_count",
        "membership_months_paid",
        "p_months_paid",
        "p_duration_months",
      ],
      ""
    ),

    programName: firstValue(
      invoice,
      [
        "program_name",
        "i_program_name",
        "p_program_name",
        "program_title",
        "event_title",
        "school_program_name",
        "trip_name",
        "trip_program_name",
      ],
      "--"
    ),

    programCategory: firstValue(
      invoice,
      ["program_category", "school_or_trip_category", "category", "p_category"],
      categoryKey
    ),

    quantity: Number(
      firstValue(
        invoice,
        ["quantity", "i_quantity", "p_quantity"],
        participants.length || 1
      )
    ),

    pricePerPerson: numberValue(
      firstValue(invoice, ["price_per_person", "p_price_per_person"], 0)
    ),

    pricingTierLabel: firstValue(
      invoice,
      ["pricing_tier_label", "i_pricing_tier_label", "p_pricing_tier_label"],
      ""
    ),

    participants,
    participantNames: participantNames(participants),
    participantCount: Number(
      firstValue(
        invoice,
        ["participant_count", "quantity", "i_quantity", "p_quantity"],
        participants.length || 0
      )
    ),

    pledgeNumber: firstValue(invoice, ["pledge_number", "p_pledge_number"], "--"),
    pledgeCampaign: firstValue(
      invoice,
      ["campaign_name", "p_campaign_name", "pledge_campaign", "campaign"],
      "--"
    ),
    pledgeAmount,
    pledgePaid,
    pledgeRemaining,

    coverageYear: coverageYear || "",
    coverageStartDate,
    coverageEndDate,
    coverageFrom: coverageStartDate,
    coverageTo: coverageEndDate,
    coverageStartMonth,
    coverageEndMonth,
    coverageEndYear,
    coverageLabel,

    coverageMonths: firstValue(
      invoice,
      [
        "coverage_months",
        "coverage_months_json",
        "p_coverage_months_json",
        "membership_months",
        "months",
      ],
      ""
    ),

    paymentMethod: methodLabel(invoice),

    reference: firstValue(
      invoice,
      [
        "reference_number",
        "reference_no",
        "p_reference_no",
        "transaction_reference",
        "p_transaction_reference",
        "stripe_payment_intent_id",
        "p_stripe_payment_intent_id",
        "check_number",
        "zelle_reference",
      ],
      "--"
    ),

    paymentLink: firstValue(
      invoice,
      ["payment_url", "payment_link", "checkout_url", "public_invoice_url", "invoice_url"],
      ""
    ),

    createdBy: firstValue(
      invoice,
      [
        "created_by_name",
        "recorded_by_name",
        "staff_name",
        "finance_user_name",
        "created_by",
        "p_created_by",
      ],
      "--"
    ),

    description: firstValue(invoice, ["description", "notes", "memo"], ""),
  };
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

  if (
    selected.size === 0 &&
    category.key === "membership" &&
    clean(data.coverageMonths).toLowerCase() === "annual"
  ) {
    MONTHS.forEach(([key]) => selected.add(key));
  }

  return selected;
}

function participantsSummary(data) {
  const participants = parseJsonArray(data.participants)
    .map((item) =>
      typeof item === "string"
        ? clean(item, 80)
        : clean(
            firstValue(
              item,
              ["full_name", "name", "student_name", "participant_name", "child_name"],
              ""
            ),
            80
          )
    )
    .filter(Boolean);

  const count = Number(data.participantCount || participants.length || 0);

  if (!participants.length && count > 0) {
    return `${count} participant(s)`;
  }

  if (!participants.length) return "--";

  const names = participants.slice(0, 3).join(", ");
  const extra = participants.length > 3 ? ` +${participants.length - 3} more` : "";

  return `${count || participants.length} participant(s): ${names}${extra}`;
}

function invoiceRows(invoice, data, category) {
  if (Array.isArray(invoice.items) && invoice.items.length) {
    return invoice.items.map((item) => {
      const itemCategory = categoryFor({ ...invoice, ...item });
      const qty = numberValue(firstValue(item, ["qty", "quantity"], 1)) || 1;
      const unitAmount = numberValue(
        firstValue(item, ["unit_price", "unit_amount", "rate", "amount"], 0)
      );
      const amount = numberValue(
        firstValue(
          item,
          ["total_price", "total_amount", "line_total", "amount"],
          qty * unitAmount
        )
      );

      return {
        code: item.code || itemCategory.code,
        type: item.label || item.item_name || itemCategory.label,
        description: firstValue(
          item,
          [
            "description",
            "detail",
            "coverage",
            "coverage_label",
            "program_name",
            "campaign_name",
            "donation_category",
          ],
          category.key === "membership"
            ? data.coverageLabel || "Membership payment"
            : "--"
        ),
        qty,
        unitAmount,
        amount,
      };
    });
  }

  let description = data.category || "--";

  if (category.key === "membership") {
    description = [
      data.planName || "Membership Plan",
      data.coverageLabel ||
        (data.coverageFrom || data.coverageTo
          ? `${formatDate(data.coverageFrom)} to ${formatDate(data.coverageTo)}`
          : `Membership coverage ${data.coverageYear}`),
      data.monthsPaid ? `${data.monthsPaid} month(s)` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (category.key === "school" || category.key === "trip") {
    description = [
      category.key === "school"
        ? `School program: ${data.programName || "--"}`
        : `Trip program: ${data.programName || "--"}`,
      data.pricingTierLabel ? `Tier: ${data.pricingTierLabel}` : "",
      participantsSummary(data) !== "--" ? participantsSummary(data) : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (category.key === "pledge") {
    description = [
      `Campaign: ${data.pledgeCampaign || "--"}`,
      data.pledgeNumber && data.pledgeNumber !== "--" ? `Pledge #: ${data.pledgeNumber}` : "",
      data.pledgeRemaining !== null ? `Remaining: ${money(data.pledgeRemaining)}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (
    !["membership", "school", "trip", "pledge"].includes(category.key)
  ) {
    description = `Donation category: ${data.donationCategory || category.label}`;
  }

  return [
    {
      code: category.code,
      type: category.label,
      description,
      qty: 1,
      unitAmount: data.amount,
      amount: data.amount,
    },
  ];
}
async function ensureOutputDir() {
  await fsp.mkdir(INVOICE_PDF_ROOT, { recursive: true });
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
      // Try next registered font.
    }
  }

  doc.font(bold ? "Helvetica-Bold" : "Helvetica");
}

function splitBilingual(value) {
  const raw = clean(value, 500);
  if (!hasEthiopic(raw) || !hasLatin(raw)) return null;

  const parts = raw.split(/\s+(?:—|--|-)\s+/);
  if (parts.length < 2) return null;

  return {
    amharic: parts[0],
    english: parts.slice(1).join(" - "),
  };
}

function writeText(doc, text, x, y, width, options = {}) {
  const raw = clean(
    text === undefined || text === null || text === "" ? "--" : text,
    options.max || 500
  );

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

function statusColor(status) {
  const valueLower = clean(status, 40).toLowerCase();

  if (valueLower === "paid") return "#0f7a3d";
  if (valueLower === "partial") return "#946200";
  if (valueLower === "overdue") return "#b42318";
  if (valueLower === "cancelled" || valueLower === "void") return "#6b7280";
  if (valueLower === "draft") return "#475569";

  return "#0f3e67";
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

  value(
    doc,
    [church.address, church.phone, church.website].filter(Boolean).join(" | "),
    108,
    75,
    360,
    {
      size: 6.5,
      color: "#dbeafe",
    }
  );

  value(doc, "FINANCE INVOICE", 420, 25, 148, {
    bold: true,
    size: 13,
    color: "#ffffff",
    align: "right",
  });

  value(doc, data.invoiceNumber, 420, 48, 148, {
    bold: true,
    size: 7,
    color: "#e0f2fe",
    align: "right",
  });

  value(doc, `Date: ${formatDate(data.invoiceDate || new Date())}`, 420, 67, 148, {
    size: 7,
    color: "#dbeafe",
    align: "right",
  });

  doc.rect(42, 116, PAGE.contentWidth, 1).fill("#c8d3df");
}

function drawInvoiceMeta(doc, data) {
  doc.roundedRect(42, 132, 252, 76, 4).fillAndStroke("#eef6ff", "#c8d3df");

  label(doc, "Bill To", 56, 145, 190);
  value(doc, data.billTo, 56, 158, 210, {
    bold: true,
    size: 9.2,
  });

  label(doc, "Donor Type", 56, 184, 90);
  value(doc, data.payerType, 56, 196, 90, { size: 7.3 });

  label(doc, "Member ID / No.", 158, 184, 95);
  value(doc, data.memberNo, 158, 196, 95, { size: 7.3 });

  doc.roundedRect(312, 132, 258, 76, 4).stroke("#c8d3df");

  label(doc, "Invoice Date", 326, 145, 80);
  value(doc, formatDate(data.invoiceDate), 326, 158, 80, { size: 7.3 });

  label(doc, "Due Date", 420, 145, 80);
  value(doc, formatDate(data.dueDate), 420, 158, 80, { size: 7.3 });

  label(doc, "Status", 512, 145, 50);
  value(doc, clean(data.status).toUpperCase(), 512, 158, 50, {
    bold: true,
    color: statusColor(data.status),
    size: 7.7,
  });

  label(doc, "Payment #", 326, 184, 100);
  value(doc, data.paymentNumber, 326, 196, 100, { size: 6.8 });

  label(doc, "Receipt #", 440, 184, 100);
  value(doc, data.receiptNumber, 440, 196, 100, { size: 6.8 });
}

function drawContactSection(doc, data) {
  doc.roundedRect(42, 222, PAGE.contentWidth, 38, 4).stroke("#c8d3df");

  label(doc, "Email", 56, 233, 170);
  value(doc, data.email, 56, 246, 170, { size: 7 });

  label(doc, "Phone", 240, 233, 100);
  value(doc, data.phone, 240, 246, 100, { size: 7.2 });

  label(doc, "Reference #", 354, 233, 185);
  value(doc, data.reference, 354, 246, 185, { size: 6.8 });
}

function drawContextSection(doc, data, category) {
  const isMembership = category.key === "membership";
  const isProgram = category.key === "school" || category.key === "trip";
  const isPledge = category.key === "pledge";

  value(
    doc,
    isMembership
      ? "Membership Plan & Coverage"
      : isProgram
        ? "Program Registration Context"
        : isPledge
          ? "Pledge / Campaign Context"
          : "Invoice Context",
    42,
    277,
    260,
    { bold: true, size: 11, color: "#0f3e67" }
  );

  const boxHeight = isMembership ? 70 : 52;
  doc.roundedRect(42, 297, PAGE.contentWidth, boxHeight, 4).stroke("#c8d3df");

  if (isMembership) {
    label(doc, "Membership Plan", 56, 309, 140);
    value(doc, data.planName || "Membership Plan", 56, 322, 145, {
      bold: true,
      size: 7.4,
    });

    label(doc, "Coverage Period", 205, 309, 145);
    value(
      doc,
      data.coverageFrom || data.coverageTo
        ? `${formatDate(data.coverageFrom)} to ${formatDate(data.coverageTo)}`
        : data.coverageLabel || `Year ${data.coverageYear}`,
      205,
      322,
      165,
      { size: 7 }
    );

    label(doc, "Months", 390, 309, 90);
    value(doc, data.monthsPaid || "--", 390, 322, 90, {
      bold: true,
      size: 7.4,
      color: "#0f7a3d",
    });

    const selected = parseCoverageMonths(data, category);
    const chipW = 34;
    const chipH = 14;
    const startX = 56;
    const startY = 342;

    MONTHS.forEach(([key, month], index) => {
      const checked = selected.has(key);
      const x = startX + index * 40.5;

      doc.roundedRect(x, startY, chipW, chipH, 3)
        .fillAndStroke(
          checked ? "#dcfce7" : "#ffffff",
          checked ? "#86efac" : "#cbd5e1"
        );

      value(doc, `${checked ? "X " : ""}${month}`, x + 3, startY + 3.5, chipW - 6, {
        bold: checked,
        size: 5.5,
        color: checked ? "#166534" : "#64748b",
        align: "center",
      });
    });

    return 382;
  }

  label(doc, "Category", 56, 309, 150);
  value(doc, category.label || data.category || "--", 56, 322, 190, { size: 6.8 });

  label(doc, isProgram ? "Program / Tier" : "Donation / Program", 258, 309, 155);
  value(
    doc,
    isProgram
      ? [data.programName, data.pricingTierLabel].filter(Boolean).join(" / ") || "--"
      : data.donationCategory || data.programName || "--",
    258,
    322,
    165,
    { size: 7 }
  );

  label(doc, isPledge ? "Campaign / Remaining" : "Pledge Campaign", 438, 309, 100);
  value(
    doc,
    isPledge
      ? `${data.pledgeCampaign || "--"} / ${
          data.pledgeRemaining !== null ? money(data.pledgeRemaining) : "--"
        }`
      : data.pledgeCampaign || "--",
    438,
    322,
    105,
    {
      size: 7,
      color: isPledge ? "#0f7a3d" : "#111827",
    }
  );

  if (isProgram) {
    value(doc, participantsSummary(data), 56, 337, 470, {
      size: 6.5,
      color: "#64748b",
    });
  }

  return 365;
}

function drawLineItems(doc, rows, y) {
  value(doc, "Invoice Items", 42, y, 220, {
    bold: true,
    size: 11,
    color: "#0f3e67",
  });

  const x = 42;
  const tableY = y + 22;
  const widths = [36, 150, 207, 45, 90];
  const rowH = 27;

  doc.rect(x, tableY, PAGE.contentWidth, 22).fill("#0f3e67");

  const headers = ["Code", "Type", "Description", "Qty", "Amount"];
  let cursorX = x;

  headers.forEach((header, index) => {
    value(doc, header, cursorX + 5, tableY + 7, widths[index] - 8, {
      bold: true,
      size: 6.5,
      color: "#ffffff",
    });

    cursorX += widths[index];
  });

  const visibleRows = rows.slice(0, 2);

  visibleRows.forEach((row, index) => {
    const rowY = tableY + 22 + index * rowH;

    doc
      .rect(x, rowY, PAGE.contentWidth, rowH)
      .fillAndStroke(index % 2 === 0 ? "#ffffff" : "#f8fafc", "#d7dee8");

    let cx = x;

    value(doc, row.code || "--", cx + 5, rowY + 8, widths[0] - 8, { size: 7 });
    cx += widths[0];

    value(doc, row.type || "--", cx + 5, rowY + 4, widths[1] - 8, { size: 6.4 });
    cx += widths[1];

    value(doc, row.description || "--", cx + 5, rowY + 8, widths[2] - 8, { size: 6.8 });
    cx += widths[2];

    value(doc, String(row.qty || 1), cx + 5, rowY + 8, widths[3] - 8, { size: 7 });
    cx += widths[3];

    value(doc, money(row.amount || 0), cx + 5, rowY + 8, widths[4] - 8, {
      bold: true,
      color: "#0f7a3d",
      size: 7.2,
    });
  });

  const afterRowsY = tableY + 22 + visibleRows.length * rowH;

  if (rows.length > visibleRows.length) {
    value(
      doc,
      `${rows.length - visibleRows.length} additional line item(s) are recorded in the system.`,
      x + 5,
      afterRowsY + 5,
      500,
      {
        size: 6.5,
        color: "#64748b",
      }
    );

    return afterRowsY + 22;
  }

  return afterRowsY + 16;
}

function drawTotalsAndDetails(doc, data, category, y) {
  const totalsX = 354;

  doc.roundedRect(totalsX, y, 216, 72, 4).fillAndStroke("#eef6ff", "#c8d3df");

  label(doc, "Invoice Amount", totalsX + 14, y + 12, 100);
  value(doc, money(data.amount), totalsX + 120, y + 12, 80, {
    bold: true,
    color: "#0f3e67",
    size: 7.7,
  });

  label(doc, "Paid Amount", totalsX + 14, y + 34, 100);
  value(doc, money(data.paidAmount), totalsX + 120, y + 34, 80, {
    color: "#0f7a3d",
    size: 7.7,
  });

  label(doc, "Balance Due", totalsX + 14, y + 56, 100);
  value(doc, money(data.balanceDue), totalsX + 120, y + 56, 80, {
    bold: true,
    color: data.balanceDue > 0 ? "#b42318" : "#0f7a3d",
    size: 7.7,
  });

  value(doc, "Enterprise Details", 42, y, 220, {
    bold: true,
    size: 11,
    color: "#0f3e67",
  });

  doc.roundedRect(42, y + 20, 292, 72, 4).stroke("#c8d3df");

  const programOrCampaign =
    category.key === "membership"
      ? data.planName || "Membership"
      : category.key === "school" || category.key === "trip"
        ? data.programName || "--"
        : data.pledgeCampaign || data.programName || "--";

  const detailValue =
    category.key === "membership"
      ? data.coverageLabel || `${formatDate(data.coverageFrom)} to ${formatDate(data.coverageTo)}`
      : category.key === "pledge"
        ? data.pledgeRemaining !== null
          ? money(data.pledgeRemaining)
          : money(data.balanceDue)
        : category.key === "school" || category.key === "trip"
          ? participantsSummary(data)
          : data.donationCategory || "--";

  label(doc, category.key === "membership" ? "Plan" : "Donation Category", 56, y + 31, 130);
  value(doc, category.key === "membership" ? data.planName || "--" : data.donationCategory, 56, y + 43, 130, { size: 7 });

  label(doc, "Program / Campaign", 195, y + 31, 120);
  value(doc, programOrCampaign, 195, y + 43, 120, { size: 7 });

  label(doc, category.key === "pledge" ? "Pledge / Remaining" : "Coverage / Detail", 56, y + 56, 130);
  value(doc, detailValue, 56, y + 68, 130, {
    bold: category.key === "pledge",
    size: 6.8,
    color: category.key === "pledge" ? "#0f7a3d" : "#111827",
  });

  label(doc, "Created By", 195, y + 56, 120);
  value(doc, data.createdBy, 195, y + 68, 120, { size: 6.8 });

  return y + 104;
}

function drawNotesAndCertification(doc, data, y) {
  value(doc, "Notes", 42, y, 220, {
    bold: true,
    size: 11,
    color: "#0f3e67",
  });

  doc.roundedRect(42, y + 19, PAGE.contentWidth, 34, 4).stroke("#c8d3df");

  value(
    doc,
    data.paymentLink
      ? `Payment link: ${data.paymentLink}`
      : data.description ||
          "This invoice was generated by the Holy Trinity Finance & Membership Platform.",
    56,
    y + 30,
    500,
    {
      size: 6.8,
      color: "#475569",
      max: 240,
    }
  );

  value(doc, "Electronic Certification", 42, y + 66, 220, {
    bold: true,
    size: 11,
    color: "#0f3e67",
  });

  doc.roundedRect(42, y + 86, PAGE.contentWidth, 46, 4).fillAndStroke("#f8fafc", "#c8d3df");

  label(doc, "Certified By", 56, y + 97, 160);
  value(doc, "Holy Trinity Finance Office", 56, y + 109, 180, {
    bold: true,
    size: 7.4,
  });

  label(doc, "Authorization", 250, y + 97, 140);
  value(doc, "System Issued Invoice", 250, y + 109, 150, {
    bold: true,
    size: 7.4,
    color: "#0f7a3d",
  });

  label(doc, "Audit Reference", 420, y + 97, 120);
  value(doc, data.invoiceNumber, 420, y + 109, 120, { size: 6.6 });

  value(
    doc,
    "No handwritten signature is required for this electronically issued invoice. Finance audit records are retained in the system.",
    56,
    y + 123,
    500,
    {
      size: 6.2,
      color: "#64748b",
    }
  );
}

function drawFooter(doc, data) {
  const y = 724;

  doc.rect(42, y - 10, PAGE.contentWidth, 1).fill("#c8d3df");

  value(
    doc,
    "This invoice was generated by the Holy Trinity Finance & Membership Platform.",
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

  value(doc, `Invoice: ${data.invoiceNumber}`, 420, y + 15, 150, {
    size: 6,
    color: "#64748b",
    align: "right",
  });
}



function renderInvoice(doc, invoice) {
  const data = invoiceView(invoice);
  const category = categoryFor(invoice);
  const rows = invoiceRows(invoice, data, category);

  registerFonts(doc);

  drawHeader(doc, data);
  drawInvoiceMeta(doc, data);
  drawContactSection(doc, data);

  let y = drawContextSection(doc, data, category);
  y = drawLineItems(doc, rows, y);

  if (y > 485) {
    y = 485;
  }

  y = drawTotalsAndDetails(doc, data, category, y);

  if (y > 586) {
    y = 586;
  }

  drawNotesAndCertification(doc, data, y);
  drawFooter(doc, data);

  return data;
}

async function generateInvoicePdf(invoice, options = {}) {
  if (!invoice || typeof invoice !== "object") {
    throw new Error("Invoice data is required to generate a PDF.");
  }

  await ensureOutputDir();

  const previewData = invoiceView(invoice);
  const fileName = `${safeFileName(
    previewData.invoiceNumber || `invoice-${invoice.id || Date.now()}`
  )}.pdf`;

  const filePath = path.join(INVOICE_PDF_ROOT, fileName);
  const pdfUrl = `${INVOICE_PDF_PUBLIC_PREFIX.replace(/\/+$/, "")}/${fileName}`;

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: PAGE.margin,
      autoFirstPage: true,
      bufferPages: false,
      info: {
        Title: `Invoice ${previewData.invoiceNumber}`,
        Author: churchInfo().name,
        Subject: "Finance Invoice",
      },
    });

    const stream = fs.createWriteStream(filePath);

    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);

    doc.pipe(stream);
    renderInvoice(doc, invoice);
    doc.end();
  });

  const stat = await fsp.stat(filePath);

  return {
    success: true,
    invoice_id: invoice.id || null,
    invoice_number: previewData.invoiceNumber,
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

async function generateInvoicePdfBuffer(invoice) {
  if (!invoice || typeof invoice !== "object") {
    throw new Error("Invoice data is required to generate a PDF.");
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

    renderInvoice(doc, invoice);
    doc.end();
  });
}

module.exports = {
  CATEGORY_LABELS,
  CATEGORY_CODES,
  generateInvoicePdf,
  generateInvoicePdfBuffer,
};