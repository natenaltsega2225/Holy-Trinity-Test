// frontend/src/components/FinanceDashboard/components/FinanceLedgerExportModal.jsx

import React, {
  useState,
} from "react";

import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Filter,
} from "lucide-react";

import "../../../styles/shared-payment-components.css";
// import "../finance-dashboard.css";

const DEFAULT_FORM = {
  format: "csv",

  entry_type: "",
  reconciliation_status: "",
  status: "",

  date_from: "",
  date_to: "",

  include_reversed: true,
};

export default function FinanceLedgerExportModal({
  open,
  onClose,
}) {

  const [form, setForm] =
    useState(DEFAULT_FORM);

  const [loading, setLoading] =
    useState(false);

  function update(
    key,
    value
  ) {

    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleExport() {

    try {

      setLoading(true);

      const params =
        new URLSearchParams();

      Object.entries(form)
        .forEach(([k, v]) => {

          if (
            v !== undefined &&
            v !== null &&
            String(v) !== ""
          ) {

            params.append(
              k,
              v
            );
          }
        });

      window.open(
        `/api/finance/ledger/export?${params.toString()}`,
        "_blank"
      );

    } finally {

      setLoading(false);
    }
  }

  if (!open)
    return null;

  return (
    <div className="finance-modal-overlay">

      <div className="finance-modal finance-modal-md">

        <div className="finance-modal-header">

          <div>

            <h2>
              Export
              Ledger
            </h2>

            <p>
              Export
              enterprise
              accounting,
              reconciliation,
              and finance
              ledger data.
            </p>

          </div>

          <button
            type="button"
            className="finance-icon-btn"
            onClick={onClose}
          >
            <X size={18} />
          </button>

        </div>

        <div className="finance-modal-body">

          <div className="finance-section-card">

            <div className="finance-section-title">

              <FileSpreadsheet
                size={16}
              />

              <span>
                Export
                Configuration
              </span>

            </div>

            <div className="finance-grid finance-grid-2">

              <div className="finance-field">

                <label>
                  Export
                  Format
                </label>

                <select
                  value={
                    form.format
                  }
                  onChange={(e) =>
                    update(
                      "format",
                      e.target
                        .value
                    )
                  }
                >
                  <option value="csv">
                    CSV
                  </option>

                  <option value="xlsx">
                    Excel
                  </option>

                  <option value="pdf">
                    PDF
                  </option>
                </select>

              </div>

              <div className="finance-field">

                <label>
                  Entry
                  Type
                </label>

                <select
                  value={
                    form.entry_type
                  }
                  onChange={(e) =>
                    update(
                      "entry_type",
                      e.target
                        .value
                    )
                  }
                >
                  <option value="">
                    All
                  </option>

                  <option value="payment">
                    Payment
                  </option>

                  <option value="donation">
                    Donation
                  </option>

                  <option value="membership">
                    Membership
                  </option>

                  <option value="adjustment">
                    Adjustment
                  </option>

                  <option value="refund">
                    Refund
                  </option>
                </select>

              </div>

            </div>

          </div>

          <div className="finance-section-card">

            <div className="finance-section-title">

              <Filter size={16} />

              <span>
                Filters
              </span>

            </div>

            <div className="finance-grid finance-grid-2">

              <div className="finance-field">

                <label>
                  Reconciliation
                </label>

                <select
                  value={
                    form.reconciliation_status
                  }
                  onChange={(e) =>
                    update(
                      "reconciliation_status",
                      e.target
                        .value
                    )
                  }
                >
                  <option value="">
                    All
                  </option>

                  <option value="matched">
                    Matched
                  </option>

                  <option value="pending">
                    Pending
                  </option>
                </select>

              </div>

              <div className="finance-field">

                <label>
                  Status
                </label>

                <select
                  value={
                    form.status
                  }
                  onChange={(e) =>
                    update(
                      "status",
                      e.target
                        .value
                    )
                  }
                >
                  <option value="">
                    All
                  </option>

                  <option value="posted">
                    Posted
                  </option>

                  <option value="reversed">
                    Reversed
                  </option>

                  <option value="draft">
                    Draft
                  </option>
                </select>

              </div>

            </div>

          </div>

          <div className="finance-section-card">

            <div className="finance-section-title">

              <Calendar size={16} />

              <span>
                Date Range
              </span>

            </div>

            <div className="finance-grid finance-grid-2">

              <div className="finance-field">

                <label>
                  From
                </label>

                <input
                  type="date"
                  value={
                    form.date_from
                  }
                  onChange={(e) =>
                    update(
                      "date_from",
                      e.target
                        .value
                    )
                  }
                />

              </div>

              <div className="finance-field">

                <label>
                  To
                </label>

                <input
                  type="date"
                  value={
                    form.date_to
                  }
                  onChange={(e) =>
                    update(
                      "date_to",
                      e.target
                        .value
                    )
                  }
                />

              </div>

            </div>

          </div>

          <div className="finance-check-row">

            <input
              id="include_reversed"
              type="checkbox"
              checked={
                form.include_reversed
              }
              onChange={(e) =>
                update(
                  "include_reversed",
                  e.target
                    .checked
                )
              }
            />

            <label htmlFor="include_reversed">
              Include
              reversed
              ledger
              entries
            </label>

          </div>

        </div>

        <div className="finance-modal-footer">

          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={
              onClose
            }
          >
            Cancel
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-primary"
            disabled={
              loading
            }
            onClick={
              handleExport
            }
          >
            <Download
              size={16}
            />

            <span>
              {loading
                ? "Preparing..."
                : "Export Ledger"}
            </span>

          </button>

        </div>

      </div>

    </div>
  );
}