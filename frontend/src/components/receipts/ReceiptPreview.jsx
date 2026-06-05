import React, { useMemo } from "react";
import "../../styles/receipt.css";

function clean(value, fallback = "--") {
  const v = String(value ?? "").trim();
  return v || fallback;
}

function money(value) {
  const n = Number(value || 0);

  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "--";

  const d = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(d.getTime())) return "--";

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function pretty(value) {
  return clean(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function normalizeRows(rows = []) {
  return Array.isArray(rows) ? rows : [];
}

function normalizeCoverageMonths(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

function MetaRow({
  label,
  value,
}) {
  return (
    <div className="receipt-meta-row">
      <span>{label}</span>
      <strong>{value || "--"}</strong>
    </div>
  );
}

export default function ReceiptPreview({
  receiptData,
}) {

  const church =
    receiptData?.church || {};

  const receipt =
    receiptData?.receipt || {};

  const rows =
    normalizeRows(receipt.rows);

  const meta =
    receipt.meta || {};

  const total =
    Number(receipt.total || 0);

  const coverageMonths =
    normalizeCoverageMonths(
      meta.coverage_months
    );

  const hasCoverage =
    coverageMonths.length > 0;

  const isMembership =
    String(
      receipt.titleEnglish || ""
    )
      .toLowerCase()
      .includes("membership");

  const isDonation =
    String(
      receipt.titleEnglish || ""
    )
      .toLowerCase()
      .includes("donation");

  const summaryCards =
    useMemo(() => {

      const cards = [];

      cards.push({
        label: "Receipt #",
        value:
          receipt.receiptNo,
      });

      cards.push({
        label: "Payment #",
        value:
          meta.payment_number,
      });

      cards.push({
        label: "Invoice #",
        value:
          meta.invoice_number,
      });

      cards.push({
        label: "Method",
        value:
          meta.payment_method,
      });

      cards.push({
        label: "Source",
        value:
          meta.payment_source,
      });

      if (meta.card && meta.card !== "--") {
        cards.push({
          label: "Card",
          value: meta.card,
        });
      }

      if (
        isMembership &&
        meta.months_paid
      ) {
        cards.push({
          label: "Months Paid",
          value:
            meta.months_paid,
        });
      }

      if (
        isMembership &&
        meta.coverage_label
      ) {
        cards.push({
          label: "Coverage",
          value:
            meta.coverage_label,
        });
      }

      if (
        isDonation &&
        meta.donation_category
      ) {
        cards.push({
          label:
            "Donation Type",
          value:
            meta.donation_category,
        });
      }

      return cards;

    }, [
      receipt,
      meta,
      isMembership,
      isDonation,
    ]);

  return (
    <div className="receipt-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="receipt-shell">

        <div className="receipt-header">

          <div className="receipt-header-left">
            <h1>
              {church.amharicName}
            </h1>

            <h2>
              {church.englishName}
            </h2>

            <div className="receipt-church-meta">
              <span>
                {church.phone}
              </span>

              <span>
                {church.address}
              </span>

              {church.poBox ? (
                <span>
                  {church.poBox}
                </span>
              ) : null}
            </div>
          </div>

          <div className="receipt-header-right">

            <div className="receipt-status-badge">
              PAID
            </div>

            <h3>
              {receipt.titleEnglish}
            </h3>

            <div className="receipt-number">
              {receipt.receiptNo}
            </div>

            <div className="receipt-date">
              {formatDate(
                receipt.date
              )}
            </div>

          </div>

        </div>

        {/* =====================================================
            MEMBER / PAYMENT INFO
        ===================================================== */}

        <div className="receipt-top-grid">

          <div className="receipt-card">
            <div className="receipt-card-title">
              Paid By
            </div>

            <div className="receipt-primary-name">
              {receipt.paidBy}
            </div>

            <div className="receipt-sub-grid">

              <MetaRow
                label="Member Type"
                value={pretty(
                  receipt.memberType
                )}
              />

              <MetaRow
                label="Membership ID"
                value={
                  receipt.membershipId
                }
              />

              <MetaRow
                label="Received By"
                value={
                  receipt.receivedBy
                }
              />

              <MetaRow
                label="Accountant"
                value={
                  receipt.accountant
                }
              />

            </div>
          </div>

          <div className="receipt-card">
            <div className="receipt-card-title">
              Payment Summary
            </div>

            <div className="receipt-summary-grid">

              {summaryCards.map(
                (item) => (
                  <div
                    key={item.label}
                    className="receipt-summary-item"
                  >
                    <span>
                      {item.label}
                    </span>

                    <strong>
                      {item.value ||
                        "--"}
                    </strong>
                  </div>
                )
              )}

            </div>
          </div>

        </div>

        {/* =====================================================
            TABLE
        ===================================================== */}

        <div className="receipt-table-wrap">

          <table className="receipt-table">

            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>Details</th>

                {isMembership ? (
                  <th>
                    Coverage
                  </th>
                ) : null}

                <th>
                  Amount
                </th>
              </tr>
            </thead>

            <tbody>

              {rows.map(
                (row, idx) => {

                  const coverageMonths =
                    normalizeCoverageMonths(
                      row.coverage_months
                    );

                  return (
                    <tr
                      key={idx}
                    >
                      <td>
                        {row.code ||
                          idx + 1}
                      </td>

                      <td>
                        <div className="receipt-row-title">
                          {row.type}
                        </div>

                        {row.donation_category ? (
                          <div className="receipt-row-meta">
                            Donation:
                            {" "}
                            {
                              row.donation_category
                            }
                          </div>
                        ) : null}

                        {row.participants ? (
                          <div className="receipt-row-meta">
                            Participants:
                            {" "}
                            {
                              row.participants
                            }
                          </div>
                        ) : null}
                      </td>

                      <td>
                        {row.remark ||
                          "--"}

                        {row.months_paid ? (
                          <div className="receipt-row-meta">
                            Months:
                            {" "}
                            {
                              row.months_paid
                            }
                          </div>
                        ) : null}
                      </td>

                      {isMembership ? (
                        <td>

                          {coverageMonths.length > 0 ? (
                            <div className="receipt-coverage-list">

                              {coverageMonths.map(
                                (m) => (
                                  <div
                                    key={m}
                                    className="receipt-coverage-item"
                                  >
                                    ✓ {m}
                                  </div>
                                )
                              )}

                            </div>
                          ) : (
                            row.coverage_label ||
                            "--"
                          )}

                        </td>
                      ) : null}

                      <td className="receipt-money">
                        {money(
                          row.amount
                        )}
                      </td>

                    </tr>
                  );
                }
              )}

            </tbody>

            <tfoot>
              <tr>

                <td
                  colSpan={
                    isMembership
                      ? 4
                      : 3
                  }
                >
                  TOTAL
                </td>

                <td className="receipt-money receipt-total-cell">
                  {money(total)}
                </td>

              </tr>
            </tfoot>

          </table>

        </div>

        {/* =====================================================
            COVERAGE SECTION
        ===================================================== */}

        {hasCoverage ? (
          <div className="receipt-card">

            <div className="receipt-card-title">
              Membership Coverage Months
            </div>

            <div className="receipt-coverage-grid">

              {coverageMonths.map(
                (month) => (
                  <div
                    key={month}
                    className="receipt-coverage-box"
                  >
                    ✓ {month}
                  </div>
                )
              )}

            </div>

          </div>
        ) : null}

        {/* =====================================================
            META SECTION
        ===================================================== */}

        <div className="receipt-card">

          <div className="receipt-card-title">
            Enterprise Payment Metadata
          </div>

          <div className="receipt-meta-grid">

            <MetaRow
              label="Email"
              value={meta.email}
            />

            <MetaRow
              label="Phone"
              value={meta.phone}
            />

            <MetaRow
              label="Coverage Start"
              value={
                meta.coverage_start
              }
            />

            <MetaRow
              label="Coverage End"
              value={
                meta.coverage_end
              }
            />

            <MetaRow
              label="Created"
              value={
                meta.created_at
              }
            />

            <MetaRow
              label="Auto Renew"
              value={
                meta.auto_renew
              }
            />

          </div>

        </div>

        {/* =====================================================
            FOOTER
        ===================================================== */}

        <div className="receipt-footer">

          <div className="receipt-footer-left">

            <div className="receipt-footer-title">
              Notes
            </div>

            <p>
              {receipt.notes ||
                "Thank you for supporting the church and community ministries."}
            </p>

          </div>

          <div className="receipt-footer-right">

            <div className="receipt-total-box">

              <span>
                Total Paid
              </span>

              <strong>
                {money(total)}
              </strong>

            </div>

            <div className="receipt-total-words">
              {
                receipt.totalInWords
              }
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}