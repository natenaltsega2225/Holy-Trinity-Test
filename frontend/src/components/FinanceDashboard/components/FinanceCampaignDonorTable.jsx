// frontend/src/components/FinanceDashboard/components/FinanceCampaignDonorTable.jsx

import React from "react";
import { Mail, Receipt, CreditCard } from "lucide-react";
// import "../finance-dashboard.css";

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function FinanceCampaignDonorTable({
  rows = [],
  loading = false,
  onViewDonor,
  onApplyPayment,
  onSendReminder,
  onViewReceipt,
}) {
  if (loading) {
    return <div className="finance-table-loading">Loading campaign donors...</div>;
  }

  return (
    <div className="finance-campaign-donor-table-wrap">
      <table className="finance-campaign-donor-table">
        <thead>
          <tr>
            <th>Donor</th>
            <th>Member #</th>
            <th>Campaign</th>
            <th>Pledged</th>
            <th>Paid</th>
            <th>Remaining</th>
            <th>Status</th>
            <th>Last Payment</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {!rows.length ? (
            <tr>
              <td colSpan="9" className="finance-empty-state">
                No donors found for this campaign.
              </td>
            </tr>
          ) : null}

          {rows.map((row) => {
            const pledged = Number(row.pledged_amount || 0);
            const paid = Number(row.paid_amount || 0);
            const remaining = Math.max(pledged - paid, 0);

            return (
              <tr key={row.id}>
                <td>
                  <div className="finance-member-cell">
                    <strong>{row.full_name || row.guest_name || "Guest Donor"}</strong>
                    <span>{row.email || row.phone || "--"}</span>
                  </div>
                </td>

                <td>{row.member_no || "Non Member"}</td>

                <td>{row.campaign_name || "--"}</td>

                <td>{money(pledged)}</td>

                <td>{money(paid)}</td>

                <td>{money(remaining)}</td>

                <td>
                  <span className={`finance-status-badge ${String(row.status || "").toLowerCase()}`}>
                    {pretty(row.status)}
                  </span>
                </td>

                <td>{row.last_payment_date ? new Date(row.last_payment_date).toLocaleDateString() : "--"}</td>

                <td>
                  <div className="finance-row-actions">
                    <button className="finance-inline-btn" onClick={() => onViewDonor?.(row)}>
                      Donor
                    </button>

                    {remaining > 0 ? (
                      <button className="finance-inline-btn" onClick={() => onApplyPayment?.(row)}>
                        <CreditCard size={14} />
                        Pay
                      </button>
                    ) : null}

                    <button className="finance-inline-btn" onClick={() => onSendReminder?.(row)}>
                      <Mail size={14} />
                      Reminder
                    </button>

                    {row.receipt_number ? (
                      <button className="finance-inline-btn" onClick={() => onViewReceipt?.(row)}>
                        <Receipt size={14} />
                        Receipt
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}