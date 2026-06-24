
// frontend/src/components/FinanceDashboard/components/FinancePledgePaymentModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  Mail,
  Receipt,
  RefreshCcw,
  Send,
  Target,
  UserRound,
  X,
} from "lucide-react";
import api from "../../api";
import "../../../styles/finance-enterprise.css";

const PAYMENT_METHODS = [
  { value: "card", label: "Card", icon: CreditCard },
  { value: "ach", label: "ACH", icon: Landmark },
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "check", label: "Check", icon: FileText },
  { value: "zelle", label: "Zelle", icon: Send },
];

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return `$${numberValue(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function clean(value) {
  const text = String(value ?? "").trim();
  return text || "";
}

function firstValue(source = {}, keys = [], fallback = "") {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
}

function isStripeMethod(method) {
  return ["card", "ach"].includes(String(method || "").toLowerCase());
}

function needsReference(method) {
  return ["check", "zelle"].includes(String(method || "").toLowerCase());
}

function methodLabel(method) {
  const found = PAYMENT_METHODS.find((item) => item.value === method);
  return found?.label || String(method || "Payment").toUpperCase();
}

async function postFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      return await api.post(endpoint, payload);
    } catch (err) {
      lastError = err;

      const status = err?.response?.status;
      if (![404, 405].includes(Number(status))) {
        throw err;
      }
    }
  }

  throw lastError || new Error("No payment endpoint is available.");
}

function pledgeNumbers(pledge = {}) {
  const pledged = numberValue(
    firstValue(pledge, ["pledged_amount", "pledge_amount", "amount"], 0)
  );

  const paid = numberValue(
    firstValue(pledge, ["paid_amount", "amount_paid", "collected_amount"], 0)
  );

  const storedRemaining = firstValue(
    pledge,
    ["remaining_amount", "remaining_balance", "balance_due", "pledge_remaining"],
    null
  );

  const remaining =
    storedRemaining === null || storedRemaining === undefined || storedRemaining === ""
      ? Math.max(pledged - paid, 0)
      : Math.max(numberValue(storedRemaining), 0);

  return {
    pledged,
    paid,
    remaining,
  };
}

function donorName(pledge = {}) {
  return firstValue(
    pledge,
    [
      "full_name_snapshot",
      "donor_name",
      "member_name",
      "full_name",
      "guest_name",
      "payer_name",
      "name",
    ],
    "Guest Donor"
  );
}

function donorEmail(pledge = {}) {
  return firstValue(
    pledge,
    [
      "email_snapshot",
      "donor_email",
      "member_email",
      "email",
      "guest_email",
      "payer_email",
    ],
    ""
  );
}

function donorPhone(pledge = {}) {
  return firstValue(
    pledge,
    [
      "phone_snapshot",
      "donor_phone",
      "member_phone",
      "phone",
      "guest_phone",
      "payer_phone",
    ],
    ""
  );
}

function donorType(pledge = {}) {
  return firstValue(
    pledge,
    ["payer_type", "donor_type", "member_type"],
    pledge.member_id ? "member" : "guest"
  );
}

function campaignName(pledge = {}) {
  return firstValue(
    pledge,
    ["campaign_name", "campaign_title", "campaign", "fund_name"],
    "Pledge Campaign"
  );
}

export default function FinancePledgePaymentModal({
  open = false,
  pledge = null,
  onClose,
  onSuccess,
  onSaved,
}) {
  const pledgeId = pledge?.id || pledge?.pledge_id || null;

  const totals = useMemo(() => pledgeNumbers(pledge || {}), [pledge]);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [notes, setNotes] = useState("");

  const [sendReceiptEmail, setSendReceiptEmail] = useState(true);
  const [createOrUpdateInvoice, setCreateOrUpdateInvoice] = useState(true);
  const [sendInvoiceEmail, setSendInvoiceEmail] = useState(false);
  const [createLedgerEntry, setCreateLedgerEntry] = useState(true);
  const [closePledgeWhenPaid, setClosePledgeWhenPaid] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");

  useEffect(() => {
    if (!open) return;

    setAmount(totals.remaining > 0 ? String(totals.remaining.toFixed(2)) : "");
    setMethod("cash");
    setReferenceNo("");
    setReceivedDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setSendReceiptEmail(true);
    setCreateOrUpdateInvoice(true);
    setSendInvoiceEmail(false);
    setCreateLedgerEntry(true);
    setClosePledgeWhenPaid(true);
    setError("");
    setSuccessText("");
  }, [open, pledgeId, totals.remaining]);

  const paymentAmount = numberValue(amount);
  const remainingAfterPayment = Math.max(totals.remaining - paymentAmount, 0);
  const overPayment = paymentAmount > totals.remaining && totals.remaining > 0;

  const payerEmail = donorEmail(pledge || {});
  const payerName = donorName(pledge || {});
  const payerPhone = donorPhone(pledge || {});

  const validationError = useMemo(() => {
    if (!pledgeId) {
      return "Pledge record is missing.";
    }

    if (paymentAmount <= 0) {
      return "Enter a payment amount greater than zero.";
    }

    if (totals.remaining > 0 && paymentAmount > totals.remaining) {
      return "Payment amount cannot be greater than the remaining pledge balance.";
    }

    if (needsReference(method) && !clean(referenceNo)) {
      return `${methodLabel(method)} reference number is required.`;
    }

    if ((sendReceiptEmail || sendInvoiceEmail) && !clean(payerEmail)) {
      return "Email is required to send receipt or invoice messages.";
    }

    return "";
  }, [
    pledgeId,
    paymentAmount,
    totals.remaining,
    method,
    referenceNo,
    sendReceiptEmail,
    sendInvoiceEmail,
    payerEmail,
  ]);

  if (!open) return null;

  function buildBasePayload() {
    const paidAfter = totals.paid + paymentAmount;

    return {
      pledge_id: pledgeId,
      pledge_number: firstValue(pledge, ["pledge_number", "number"], null),

      campaign_id: firstValue(pledge, ["campaign_id"], null),
      campaign_name: campaignName(pledge || {}),

      member_id: firstValue(pledge, ["member_id"], null),
      member_no: firstValue(pledge, ["member_no", "member_number"], null),

      payer_type: donorType(pledge || {}),
      donor_type: donorType(pledge || {}),
      full_name: payerName,
      donor_name: payerName,
      payer_name: payerName,
      email: payerEmail,
      donor_email: payerEmail,
      payer_email: payerEmail,
      phone: payerPhone,
      donor_phone: payerPhone,
      payer_phone: payerPhone,

      category: "pledge",
      payment_type: "pledge",
      type: "pledge",
      sub_category: "pledge_payment",

      amount: paymentAmount,
      total_amount: paymentAmount,
      payment_amount: paymentAmount,

      pledged_amount: totals.pledged,
      pledge_paid_before: totals.paid,
      pledge_paid_after: paidAfter,
      pledge_remaining_before: totals.remaining,
      pledge_remaining_after: remainingAfterPayment,

      payment_method: method,
      method,
      provider: isStripeMethod(method) ? "stripe" : method,
      reference_no: clean(referenceNo) || null,
      transaction_reference: clean(referenceNo) || null,

      received_date: receivedDate || null,
      received_at: receivedDate || null,
      paid_at: receivedDate || null,

      notes: clean(notes) || null,
      memo: clean(notes) || null,

      status: "paid",
      payment_status: "paid",

      send_receipt_email: sendReceiptEmail,
      send_invoice_email: sendInvoiceEmail,
      create_invoice: createOrUpdateInvoice,
      update_invoice: createOrUpdateInvoice,
      create_ledger_entry: createLedgerEntry,
      close_pledge_when_paid: closePledgeWhenPaid,

      apply_to_pledge: true,
      update_pledge_balance: true,
      generate_receipt: true,
      generate_invoice: createOrUpdateInvoice,
      source: "finance",
      created_from: "finance_pledge_payment_modal",
    };
  }

  async function submitStripeCheckout(payload) {
    const successUrl = `${window.location.origin}/dash/finance/pledges?payment=success&pledge_id=${encodeURIComponent(
      pledgeId
    )}&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl = `${window.location.origin}/dash/finance/pledges?payment=cancelled&pledge_id=${encodeURIComponent(
      pledgeId
    )}`;

    const checkoutPayload = {
      ...payload,
      checkout_type: "finance_pledge_payment",
      process_direct_payment: true,
      process_pledge_payment: true,
      payment_method: method,
      method,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        checkout_type: "finance_pledge_payment",
        payment_type: "pledge",
        category: "pledge",
        pledge_id: String(pledgeId),
        pledge_number: String(payload.pledge_number || ""),
        campaign_id: String(payload.campaign_id || ""),
        campaign_name: String(payload.campaign_name || ""),
        member_id: String(payload.member_id || ""),
        member_no: String(payload.member_no || ""),
        full_name: String(payload.full_name || ""),
        email: String(payload.email || ""),
        phone: String(payload.phone || ""),
        payer_type: String(payload.payer_type || ""),
        amount: String(payload.amount || "0"),
        payment_method: String(method),
        method: String(method),
        send_receipt_email: String(Boolean(sendReceiptEmail)),
        send_invoice_email: String(Boolean(sendInvoiceEmail)),
        create_invoice: String(Boolean(createOrUpdateInvoice)),
      },
    };

    const res = await postFirst(
      [
        "/checkout/create-session",
        "/finance/checkout/create-session",
        "/finance/payments/checkout",
      ],
      checkoutPayload
    );

    const url =
      res?.data?.url ||
      res?.data?.checkout_url ||
      res?.data?.session?.url ||
      res?.data?.stripe_url;

    if (!url) {
      throw new Error("Stripe checkout URL was not returned.");
    }

    window.location.href = url;
  }

  async function submitManualPayment(payload) {
    return postFirst(
      [
        `/finance/pledges/${pledgeId}/payments`,
        `/finance/pledges/${pledgeId}/payment`,
        "/finance/payments",
      ],
      payload
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccessText("");

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = buildBasePayload();

    setSaving(true);

    try {
      if (isStripeMethod(method)) {
        await submitStripeCheckout(payload);
        return;
      }

      const res = await submitManualPayment(payload);
      const data = res?.data || {};

      setSuccessText(
        data.message ||
          "Pledge payment was recorded, receipt was generated, and pledge balance was updated."
      );

      onSaved?.(data);
      onSuccess?.(data);

      window.setTimeout(() => {
        onClose?.();
      }, 900);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to apply pledge payment."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <div
        className="finance-modal finance-pledge-payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pledge-payment-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="finance-modal-header">
            <div className="finance-modal-title-row">
              <span className="finance-modal-icon">
                <Target size={20} />
              </span>

              <div>
                <h2 id="pledge-payment-title">Apply Pledge Payment</h2>
                <p>
                  Record manual pledge payments or continue to Stripe for card
                  and ACH. The system updates pledge balance, invoice, receipt,
                  ledger, and audit history.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="finance-icon-button"
              onClick={onClose}
              aria-label="Close pledge payment modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="finance-modal-body">
            {error ? (
              <div className="finance-alert finance-alert-danger">
                <AlertTriangle size={17} />
                <span>{error}</span>
              </div>
            ) : null}

            {successText ? (
              <div className="finance-alert finance-alert-success">
                <CheckCircle2 size={17} />
                <span>{successText}</span>
              </div>
            ) : null}

            <div className="finance-grid finance-grid-2">
              <section className="finance-panel">
                <div className="finance-section-head">
                  <UserRound size={17} />
                  <h3>Donor / Pledge</h3>
                </div>

                <div className="finance-detail-grid">
                  <div>
                    <span>Donor</span>
                    <strong>{payerName}</strong>
                  </div>

                  <div>
                    <span>Type</span>
                    <strong>{donorType(pledge || {})}</strong>
                  </div>

                  <div>
                    <span>Member ID</span>
                    <strong>
                      {firstValue(pledge, ["member_no", "member_number"], "--")}
                    </strong>
                  </div>

                  <div>
                    <span>Email</span>
                    <strong>{payerEmail || "--"}</strong>
                  </div>

                  <div>
                    <span>Campaign</span>
                    <strong>{campaignName(pledge || {})}</strong>
                  </div>

                  <div>
                    <span>Pledge #</span>
                    <strong>
                      {firstValue(pledge, ["pledge_number", "number"], "--")}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="finance-panel finance-summary-panel">
                <div className="finance-section-head">
                  <Receipt size={17} />
                  <h3>Balance Summary</h3>
                </div>

                <div className="finance-kpi-stack">
                  <div>
                    <span>Pledged</span>
                    <strong>{money(totals.pledged)}</strong>
                  </div>

                  <div>
                    <span>Paid To Date</span>
                    <strong>{money(totals.paid)}</strong>
                  </div>

                  <div>
                    <span>Remaining Before</span>
                    <strong>{money(totals.remaining)}</strong>
                  </div>

                  <div className={overPayment ? "danger" : "success"}>
                    <span>Remaining After</span>
                    <strong>{money(remainingAfterPayment)}</strong>
                  </div>
                </div>
              </section>
            </div>

            <section className="finance-panel">
              <div className="finance-section-head">
                <Banknote size={17} />
                <h3>Payment Details</h3>
              </div>

              <div className="finance-form-grid">
                <label className="finance-field">
                  <span>Amount *</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    required
                  />
                </label>

                <label className="finance-field">
                  <span>Payment Method *</span>
                  <select
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                    required
                  >
                    {PAYMENT_METHODS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="finance-field">
                  <span>
                    Reference {needsReference(method) ? "*" : ""}
                  </span>
                  <input
                    value={referenceNo}
                    onChange={(event) => setReferenceNo(event.target.value)}
                    placeholder={
                      method === "check"
                        ? "Check number"
                        : method === "zelle"
                          ? "Zelle confirmation/reference"
                          : "Optional transaction reference"
                    }
                    required={needsReference(method)}
                  />
                </label>

                <label className="finance-field">
                  <span>Received Date</span>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(event) => setReceivedDate(event.target.value)}
                  />
                </label>

                <label className="finance-field finance-field-full">
                  <span>Notes</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    placeholder="Optional finance note for audit trail."
                  />
                </label>
              </div>

              <div className="finance-method-strip">
                {PAYMENT_METHODS.map((item) => {
                  const Icon = item.icon;
                  const active = method === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={`finance-method-chip ${active ? "active" : ""}`}
                      onClick={() => setMethod(item.value)}
                    >
                      <Icon size={15} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="finance-panel">
              <div className="finance-section-head">
                <Mail size={17} />
                <h3>Automation</h3>
              </div>

              <div className="finance-checkbox-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={sendReceiptEmail}
                    onChange={(event) => setSendReceiptEmail(event.target.checked)}
                  />
                  <span>Generate and email receipt</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={createOrUpdateInvoice}
                    onChange={(event) =>
                      setCreateOrUpdateInvoice(event.target.checked)
                    }
                  />
                  <span>Create or update invoice</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={sendInvoiceEmail}
                    onChange={(event) => setSendInvoiceEmail(event.target.checked)}
                  />
                  <span>Email invoice copy</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={createLedgerEntry}
                    onChange={(event) => setCreateLedgerEntry(event.target.checked)}
                  />
                  <span>Post ledger and audit entry</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={closePledgeWhenPaid}
                    onChange={(event) =>
                      setClosePledgeWhenPaid(event.target.checked)
                    }
                  />
                  <span>Auto-close pledge when fully paid</span>
                </label>
              </div>
            </section>

            <section className="finance-panel finance-payment-review">
              <div className="finance-section-head">
                <CheckCircle2 size={17} />
                <h3>Review</h3>
              </div>

              <div className="finance-review-row">
                <span>Payment Method</span>
                <strong>{methodLabel(method)}</strong>
              </div>

              <div className="finance-review-row">
                <span>Payment Amount</span>
                <strong>{money(paymentAmount)}</strong>
              </div>

              <div className="finance-review-row">
                <span>Remaining Balance</span>
                <strong>{money(remainingAfterPayment)}</strong>
              </div>

              <div className="finance-review-row">
                <span>Processing Path</span>
                <strong>
                  {isStripeMethod(method)
                    ? "Stripe checkout"
                    : "Manual finance entry"}
                </strong>
              </div>
            </section>
          </div>

          <div className="finance-modal-footer">
            <button
              type="button"
              className="finance-btn finance-btn-light"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="finance-btn finance-btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCcw size={16} className="finance-spin" />
                  Processing...
                </>
              ) : isStripeMethod(method) ? (
                <>
                  <CreditCard size={16} />
                  Continue To Checkout
                </>
              ) : (
                <>
                  <Receipt size={16} />
                  Apply Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}