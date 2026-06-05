// frontend/src/components/FinanceDashboard/components/FinanceRecurringDonationManager.jsx

import React from "react";

import {
  RefreshCcw,
  PauseCircle,
  PlayCircle,
  CreditCard,
} from "lucide-react";

import "../../../styles/finance-dashboard.css";


function money(value) {
  return `$${Number(
    value || 0
  ).toFixed(2)}`;
}

export default function FinanceRecurringDonationManager({
  rows = [],
  onPause,
  onResume,
  onCancel,
}) {
  return (
    <div className="finance-recurring-manager">

      <div className="finance-recurring-head">

        <div>

          <h2>
            Recurring Donations
          </h2>

          <p>
            Stripe recurring donor
            subscriptions and
            automated gifts.
          </p>

        </div>

      </div>

      <table className="finance-recurring-table">

        <thead>

          <tr>

            <th>
              Donor
            </th>

            <th>
              Amount
            </th>

            <th>
              Frequency
            </th>

            <th>
              Next Charge
            </th>

            <th>
              Status
            </th>

            <th />

          </tr>

        </thead>

        <tbody>

          {rows.map(
            (row) => (
              <tr
                key={row.id}
              >

                <td>
                  {
                    row.full_name
                  }
                </td>

                <td>
                  {money(
                    row.amount
                  )}
                </td>

                <td>
                  {
                    row.frequency
                  }
                </td>

                <td>
                  {new Date(
                    row.next_charge_date
                  ).toLocaleDateString()}
                </td>

                <td>
                  {
                    row.status
                  }
                </td>

                <td>

                  <div className="finance-row-actions">

                    {row.status ===
                    "active" ? (

                      <button
                        className="finance-inline-btn"
                        onClick={() =>
                          onPause?.(
                            row
                          )
                        }
                      >

                        <PauseCircle
                          size={14}
                        />

                        Pause

                      </button>

                    ) : (

                      <button
                        className="finance-inline-btn"
                        onClick={() =>
                          onResume?.(
                            row
                          )
                        }
                      >

                        <PlayCircle
                          size={14}
                        />

                        Resume

                      </button>

                    )}

                    <button
                      className="finance-inline-btn danger"
                      onClick={() =>
                        onCancel?.(
                          row
                        )
                      }
                    >

                      Cancel

                    </button>

                  </div>

                </td>

              </tr>
            )
          )}

        </tbody>

      </table>

    </div>
  );
}