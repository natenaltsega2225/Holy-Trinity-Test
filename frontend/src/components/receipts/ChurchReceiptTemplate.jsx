

//frontend\src\components\receipts\ChurchReceiptTemplate.jsx
import React from "react";
import "../../styles/church-receipt.css";

const CATEGORY_LABELS = {
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
  sunday_cash_collection: "የእሁድ ስብስብ — Sunday Collection",
};

function money(value) {
  const n = Number(value || 0);

  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "--";

  const raw = String(value).trim();

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return `${m}/${d}/${y}`;
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${m}/${d}/${y}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  return parsed.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function pretty(value) {
  if (!value) return "--";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function categoryLabel(value) {
  return CATEGORY_LABELS[value] || pretty(value);
}

function buildCoverageMonths(receipt) {
  const meta = receipt?.meta || {};

  if (Array.isArray(meta.coverageMonths) && meta.coverageMonths.length) {
    return meta.coverageMonths;
  }

  const start =
    meta.period_start ||
    meta.coverage_start ||
    receipt.coverage_start ||
    receipt.period_start;

  const end =
    meta.period_end ||
    meta.coverage_end ||
    receipt.coverage_end ||
    receipt.period_end;

  if (!start || !end) return [];

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return [];
  }

  const rows = [];
  const current = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    1
  );

  const last = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    1
  );

  while (current <= last) {
    rows.push({
      label: current.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      status: "Paid",
      checked: true,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return rows;
}

function Checkbox({ checked = false, label }) {
  return (
    <div className="cr-checkbox">
      <span className={`cr-checkbox-box ${checked ? "is-checked" : ""}`} />
      <span>{label}</span>
    </div>
  );
}

function OrthodoxCrossMark() {
  return (
    <div className="cr-cross-mark" aria-hidden="true">
      <svg viewBox="0 0 120 140" className="cr-cross-svg">
        <path
          d="M60 8
             L74 22 L68 28 L78 38 L70 46
             L86 62 L76 72 L88 84 L76 96
             L66 86 L60 92 L54 86 L44 96
             L32 84 L44 72 L34 62 L50 46
             L42 38 L52 28 L46 22 Z"
          fill="currentColor"
          opacity="0.9"
        />

        <path
          d="M56 18 h8 v90 h-8 z
             M24 42 h72 v8 H24 z
             M34 66 h52 v8 H34 z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

function ReceiptTable({ rows = [], coverageMonths = [] }) {
  const paymentRows = rows.length
    ? rows
    : [
        {
          code: "01",
          type: "Members Dues / Membership Payment",
          amount: "",
          remark: "",
        },
      ];

  const coverageRows = coverageMonths.map((month, index) => ({
    code: `C${String(index + 1).padStart(2, "0")}`,
    type: `Coverage Month / የተከፈለበት ወር`,
    amount: "",
    remark: month.label,
    checked: month.checked !== false,
  }));

  const displayRows = [...paymentRows, ...coverageRows];

  return (
    <div className="cr-table-wrap">
      <table className="cr-table">
        <thead>
          <tr>
            <th className="code-col">
              <div>መለያ</div>
              <div>Code</div>
            </th>

            <th>
              <div>የክፍያ ዓይነት</div>
              <div>Type of Payment</div>
            </th>

            <th className="amount-col">
              <div>የገንዘብ መጠን</div>
              <div>Amount</div>
            </th>

            <th className="remark-col">
              <div>ማስታወሻ</div>
              <div>Remark</div>
            </th>

            <th className="check-col">
              <div>ተከፍሏል</div>
              <div>Paid</div>
            </th>
          </tr>
        </thead>

        <tbody>
          {displayRows.map((row, index) => (
            <tr
              key={`${row.code || "row"}-${index}`}
              className={row.checked ? "is-coverage-row" : ""}
            >
              <td>{row.code || "--"}</td>

              <td>{row.type || "--"}</td>

              <td className="cr-money-cell">
                {row.amount === "" ||
                row.amount === null ||
                row.amount === undefined
                  ? ""
                  : money(row.amount)}
              </td>

              <td>{row.remark || ""}</td>

              <td className="cr-check-cell">
                {row.checked ? "✓" : ""}
              </td>
            </tr>
          ))}

          {Array.from({
            length: Math.max(0, 8 - displayRows.length),
          }).map((_, i) => (
            <tr key={`blank-${i}`} className="is-blank">
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EnterpriseMetaSection({ receipt }) {
  const meta = receipt?.meta || {};

  const items = [
    {
      label: "Payment #",
      value: meta.payment_number || receipt.payment_number,
    },
    {
      label: "Invoice #",
      value: meta.invoice_number || receipt.invoice_number,
    },
    {
      label: "Plan",
      value: meta.plan_name || receipt.plan_name,
    },
    {
      label: "Plan Type",
      value: meta.plan_type || receipt.plan_type,
    },
    {
      label: "Coverage",
      value:
        meta.coverage_label ||
        receipt.coverage_label ||
        receipt.period_label,
    },
    {
      label: "Duration",
      value:
        meta.duration_months || meta.months_paid || receipt.months_paid
          ? `${meta.duration_months || meta.months_paid || receipt.months_paid} Month(s)`
          : "",
    },
    {
      label: "Donation Category",
      value: meta.donation_category
        ? categoryLabel(meta.donation_category)
        : receipt.donation_category
        ? categoryLabel(receipt.donation_category)
        : "",
    },
    {
      label: "Program",
      value: meta.program_name || receipt.program_name,
    },
    {
      label: "Participants",
      value: meta.participants || receipt.participants,
    },
    {
      label: "Card",
      value:
        meta.card_last4 || receipt.card_last4
          ? `${String(meta.card_brand || receipt.card_brand || "CARD").toUpperCase()} •••• ${
              meta.card_last4 || receipt.card_last4
            }`
          : "",
    },
    {
      label: "Stripe Ref",
      value:
        meta.stripe_payment_intent_id ||
        receipt.stripe_payment_intent_id,
    },
  ].filter((item) => item.value);

  if (!items.length) return null;

  return (
    <section className="cr-enterprise-meta">
      <div className="cr-enterprise-meta-title">
        Payment Details / የክፍያ ዝርዝር
      </div>

      <div className="cr-enterprise-meta-grid">
        {items.map((item) => (
          <div className="cr-meta-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ChurchReceiptTemplate({
  church = {},
  receipt = {},
}) {
  const {
    amharicName = "ደብረ ብርሃን ቅድስት ሥላሴ የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ ቤተ ክርስቲያን",
    englishName = "Debre Berhan Holy Trinity Ethiopian Orthodox Tewahedo Church",
    phone = "615-674-7405",
    poBox = "P.O. BOX",
    address = "2558 Couchville Pike, Nashville, TN 37217",
  } = church;

  const {
    receiptNo = "RCPT-000001",
    serialNo = "5605",
    titleAmharic = "የገንዘብ መቀበያ ደረሰኝ",
    titleEnglish = "Cash Receipt",
    paidBy = "",
    memberType = "member",
    membershipId = "",
    date = "",
    method = "",
    receivedBy = "",
    accountant = "",
    checkNo = "",
    total = 0,
    totalInWords = "",
    rows = [],
    notes = "",
  } = receipt;

  const isMember = memberType === "member";
  const isNonMember = memberType === "non_member";
  const isNewMember = memberType === "new_member";

  const coverageMonths = buildCoverageMonths(receipt);

  return (
    <div className="cr-page">
      <div className="cr-paper">
        <div className="cr-serial-no">{serialNo}</div>

        <header className="cr-header">
          <div className="cr-header-left">
            <OrthodoxCrossMark />
          </div>

          <div className="cr-header-main">
            <div className="cr-church-amharic">{amharicName}</div>
            <div className="cr-church-english">{englishName}</div>

            <div className="cr-header-meta">
              <div className="cr-meta-item">
                <span className="cr-meta-label">Tel.</span>
                <strong>{phone}</strong>
              </div>

              <div className="cr-meta-item">
                <span className="cr-meta-label">Mail</span>
                <strong>{poBox}</strong>
              </div>

              <div className="cr-meta-item cr-meta-item-address">
                <span className="cr-meta-label">Address</span>
                <strong>{address}</strong>
              </div>
            </div>
          </div>
        </header>

        <section className="cr-title-block">
          <div className="cr-title-amharic">{titleAmharic}</div>
          <div className="cr-title-english">{titleEnglish}</div>
        </section>

        <section className="cr-top-fields">
          <div className="cr-field-row cr-field-row-main">
            <div className="cr-field-grow">
              <span className="cr-field-label">የከፈለው ስም / Paid by</span>
              <div className="cr-field-line">{paidBy || ""}</div>
            </div>

            <div className="cr-field-fixed">
              <span className="cr-field-label">
                የደረሰኝ ቁጥር / Receipt No
              </span>
              <div className="cr-field-line">{receiptNo}</div>
            </div>
          </div>

          <div className="cr-field-row cr-field-row-inline">
            <div className="cr-checkbox-group">
              <Checkbox checked={isMember} label="አባል / Member" />
              <Checkbox checked={isNonMember} label="አባል ያልሆነ / Non Member" />
              <Checkbox checked={isNewMember} label="አዲስ አባል / New Member" />
            </div>

            <div className="cr-field-fixed">
              <span className="cr-field-label">
                የአባልነት መለያ ቁጥር / Membership ID No.
              </span>
              <div className="cr-field-line">{membershipId || ""}</div>
            </div>
          </div>
        </section>

        <ReceiptTable rows={rows} coverageMonths={coverageMonths} />

        <section className="cr-total-section">
          <div className="cr-total-row">
            <div className="cr-total-label">ድምር / Total</div>
            <div className="cr-total-value">{money(total)}</div>
          </div>

          <div className="cr-total-words-row">
            <span className="cr-total-words-label">
              ድምር በፊደል / Total in Words:
            </span>
            <div className="cr-total-words-line">{totalInWords || ""}</div>
          </div>
        </section>

        <EnterpriseMetaSection receipt={receipt} />

        <section className="cr-bottom-grid">
          <div className="cr-bottom-col">
            <div className="cr-bottom-field">
              <span className="cr-field-label">የክፍያ ዘዴ / Method of Payment</span>
              <div className="cr-field-line">{method || ""}</div>
            </div>

            <div className="cr-bottom-field">
              <span className="cr-field-label">ተቀባይ / Received by</span>
              <div className="cr-field-line">{receivedBy || ""}</div>
            </div>

            <div className="cr-bottom-field">
              <span className="cr-field-label">ቀን / Date</span>
              <div className="cr-field-line">{formatDate(date)}</div>
            </div>
          </div>

          <div className="cr-bottom-col">
            <div className="cr-bottom-field">
              <span className="cr-field-label">ቼክ ቁጥር / Check No</span>
              <div className="cr-field-line">{checkNo || ""}</div>
            </div>

            <div className="cr-bottom-field">
              <span className="cr-field-label">ሂሳብ / Accountant</span>
              <div className="cr-field-line">{accountant || ""}</div>
            </div>

            <div className="cr-bottom-field">
              <span className="cr-field-label">ማስታወሻ / Notes</span>
              <div className="cr-field-line">{notes || ""}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}