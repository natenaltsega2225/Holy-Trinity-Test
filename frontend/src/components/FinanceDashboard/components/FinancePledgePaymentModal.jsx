// frontend/src/components/FinanceDashboard/components/FinancePledgePaymentModal.jsx

import React, { useMemo, useState } from "react";
import api from "../../api";
import { CreditCard, Receipt } from "lucide-react";


import "../../../styles/finance-dashboard.css";



function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function FinancePledgePaymentModal({
  open,
  pledge,
  onClose,
  onSuccess,
}) {
  const remaining = useMemo(() => {
    return Math.max(Number(pledge?.pledged_amount || 0) - Number(pledge?.paid_amount || 0), 0);
  }, [pledge]);

  const [amount, setAmount] = useState(remaining);
  const [method, setMethod] = useState("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [sendReceipt, setSendReceipt] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handlePayment() {
    try {
      setSaving(true);
      setError("");

      if (Number(amount || 0) <= 0) {
        throw new Error("Payment amount is required.");
      }

      if (Number(amount) > remaining) {
        throw new Error("Payment cannot exceed remaining pledge balance.");
      }

      await api.post(`/finance/pledges/${pledge.id}/payments`, {
        amount: Number(amount),
        method,
        reference_no: referenceNo,
        notes,
        send_receipt: sendReceipt,
      });

      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Unable to apply pledge payment.");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !pledge) return null;

  return (
    <div className="finance-modal-overlay">
      <div className="finance-payment-modal">
        <div className="finance-modal-header">
          <div className="finance-email-title-wrap">
            <CreditCard size={18} />
            <div>
              <h2>Apply Pledge Payment</h2>
              <p>Collect full or partial payment against an existing promise-to-pay pledge.</p>
            </div>
          </div>

          <button className="finance-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {error ? <div className="finance-alert error">{error}</div> : null}

        <div className="finance-modal-body">
          <div className="finance-refund-summary">
            <div>
              <label>Donor</label>
              <strong>{pledge.full_name || "Guest Donor"}</strong>
            </div>

            <div>
              <label>Campaign</label>
              <strong>{pledge.campaign_name || "--"}</strong>
            </div>

            <div>
              <label>Pledged</label>
              <strong>{money(pledge.pledged_amount)}</strong>
            </div>

            <div>
              <label>Remaining</label>
              <strong>{money(remaining)}</strong>
            </div>
          </div>

          <div className="finance-grid-2">
            <div className="finance-field">
              <label>Payment Amount</label>
              <input
                type="number"
                min="0.01"
                max={remaining}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="finance-field">
              <label>Payment Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="zelle">Zelle</option>
                <option value="card">Card / Stripe</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          <div className="finance-field">
            <label>Reference #</label>
            <input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Check / Zelle / Stripe reference"
            />
          </div>

          <label className="finance-checkbox-row">
            <input
              type="checkbox"
              checked={sendReceipt}
              onChange={(e) => setSendReceipt(e.target.checked)}
            />
            <span>Generate and email receipt</span>
          </label>

          <div className="finance-field">
            <label>Notes</label>
            <textarea rows="4" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="finance-modal-footer">
          <button className="finance-btn secondary" onClick={onClose}>
            Cancel
          </button>

          <button className="finance-btn primary" onClick={handlePayment} disabled={saving}>
            <Receipt size={16} />
            {saving ? "Saving..." : "Apply Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}