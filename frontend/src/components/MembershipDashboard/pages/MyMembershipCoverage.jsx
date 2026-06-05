// // frontend\src\components\MembershipDashboard\pages\MyMembershipCoverage.jsx
// import React, {
//   useEffect,
//   useMemo,
//   useState,
// } from "react";

// import api from "../../api";

// import "../../../styles/membership-dashboard.css";

// const MONTHS = [
//   "Jan",
//   "Feb",
//   "Mar",
//   "Apr",
//   "May",
//   "Jun",
//   "Jul",
//   "Aug",
//   "Sep",
//   "Oct",
//   "Nov",
//   "Dec",
// ];

// function formatMoney(value) {
//   return `$${Number(value || 0).toLocaleString(
//     "en-US",
//     {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     }
//   )}`;
// }

// function formatDate(value) {
//   if (!value) return "--";

//   const d = new Date(value);

//   if (Number.isNaN(d.getTime())) {
//     return "--";
//   }

//   return d.toLocaleDateString("en-US");
// }

// function pretty(value) {
//   if (!value) return "--";

//   return String(value)
//     .replaceAll("_", " ")
//     .replace(/\b\w/g, (c) =>
//       c.toUpperCase()
//     );
// }

// function monthNumberFromRow(row = {}) {
//   const direct =
//     Number(
//       row.month_number ||
//         row.month ||
//         0
//     );

//   if (direct >= 1 && direct <= 12) {
//     return direct;
//   }

//   const raw =
//     String(
//       row.coverage_month ||
//         row.coverage_key ||
//         ""
//     ).trim();

//   if (/^\d{4}-\d{2}$/.test(raw)) {
//     return Number(raw.slice(5, 7));
//   }

//   return null;
// }

// function normalizeGridPayload(data) {
//   let source = [];

//   if (Array.isArray(data?.grid)) {
//     source = data.grid;
//   } else if (data?.grid && typeof data.grid === "object") {
//     source = Object.values(data.grid);
//   } else if (Array.isArray(data?.rows)) {
//     source = data.rows;
//   } else if (Array.isArray(data?.months)) {
//     source = data.months;
//   } else if (Array.isArray(data?.coverage)) {
//     source = data.coverage;
//   } else if (Array.isArray(data)) {
//     source = data;
//   }

//   const map = new Map();

//   source.forEach((row) => {
//     const monthNumber =
//       monthNumberFromRow(row);

//     if (monthNumber >= 1 && monthNumber <= 12) {
//       map.set(monthNumber, row);
//     }
//   });

//   return MONTHS.map((label, index) => {
//     const monthNumber = index + 1;
//     const row = map.get(monthNumber);

//     const status =
//       String(
//         row?.status ||
//           row?.coverage_status ||
//           ""
//       ).toLowerCase();

//     const paid =
//       Boolean(row?.paid) ||
//       ["paid", "completed", "posted", "approved"].includes(status);

//     return {
//       month_number: monthNumber,
//       month_name: label,
//       paid,
//       status: row
//         ? status || (paid ? "paid" : "unpaid")
//         : "unpaid",
//       payment_number:
//         row?.payment_number || null,
//       receipt_number:
//         row?.receipt_number || null,
//       invoice_number:
//         row?.invoice_number || null,
//       method:
//         row?.method ||
//         row?.payment_method ||
//         null,
//       provider:
//         row?.provider ||
//         row?.payment_provider ||
//         null,
//       amount:
//         Number(row?.amount || 0),
//     };
//   });
// }

// function normalizeRows(data) {
//   if (Array.isArray(data?.rows)) return data.rows;
//   if (Array.isArray(data?.data)) return data.data;
//   if (Array.isArray(data?.items)) return data.items;
//   if (Array.isArray(data?.coverage)) return data.coverage;
//   if (Array.isArray(data)) return data;
//   return [];
// }

// function StatusBadge({ status }) {
//   const s =
//     String(status || "").toLowerCase();

//   if (
//     ["paid", "completed", "posted", "approved"].includes(s)
//   ) {
//     return (
//       <span className="member-status-badge success">
//         Paid
//       </span>
//     );
//   }

//   if (s === "pending") {
//     return (
//       <span className="member-status-badge warning">
//         Pending
//       </span>
//     );
//   }

//   return (
//     <span className="member-status-badge danger">
//       Unpaid
//     </span>
//   );
// }

// function coverageSortValue(row = {}) {
//   return String(
//     row.coverage_end_month ||
//       row.last_month ||
//       row.coverage_month ||
//       row.coverage_key ||
//       ""
//   );
// }

// export default function MyMembershipCoverage() {
//   const currentYear =
//     new Date().getFullYear();

//   const [year, setYear] =
//     useState(currentYear);

//   const [grid, setGrid] =
//     useState(() =>
//       normalizeGridPayload({
//         grid: [],
//       })
//     );

//   const [coverageRows, setCoverageRows] =
//     useState([]);

//   const [loading, setLoading] =
//     useState(true);

//   const [error, setError] =
//     useState("");

//   async function loadCoverage() {
//     try {
//       setLoading(true);
//       setError("");

//       const [gridRes, coverageRes] =
//         await Promise.all([
//           api.get(
//             `/member/membership-grid/${year}`
//           ),
//           api.get(
//             "/member/membership-coverage",
//             {
//               params: {
//                 year,
//               },
//             }
//           ),
//         ]);

//       setGrid(
//         normalizeGridPayload(gridRes.data)
//       );

//       setCoverageRows(
//         normalizeRows(coverageRes.data)
//       );
//     } catch (err) {
//       console.error(
//         "Membership coverage load failed:",
//         err
//       );

//       setGrid(
//         normalizeGridPayload({
//           grid: [],
//         })
//       );

//       setCoverageRows([]);

//       setError(
//         err?.response?.data?.error ||
//           "Failed to load membership coverage."
//       );
//     } finally {
//       setLoading(false);
//     }
//   }

//   useEffect(() => {
//     loadCoverage();
//   }, [year]);

//   const stats =
//     useMemo(() => {
//       const paid =
//         grid.filter((row) => row.paid).length;

//       const unpaid =
//         Math.max(0, 12 - paid);

//       const percent =
//         Math.round((paid / 12) * 100);

//       const totalPaid =
//         grid.reduce(
//           (sum, row) =>
//             sum + Number(row.amount || 0),
//           0
//         );

//       return {
//         paid,
//         unpaid,
//         percent,
//         totalPaid,
//       };
//     }, [grid]);

//   const activeCoverage =
//     useMemo(() => {
//       if (!coverageRows.length) {
//         return null;
//       }

//       return [...coverageRows].sort(
//         (a, b) =>
//           coverageSortValue(b).localeCompare(
//             coverageSortValue(a)
//           )
//       )[0];
//     }, [coverageRows]);

//   return (
//     <div className="member-page">
//       <div className="member-page-header">
//         <div>
//           <p className="member-page-eyebrow">
//             Membership Coverage
//           </p>

//           <h1>
//             {year} Coverage Calendar
//           </h1>

//           <p>
//             Track paid months, unpaid months, renewal gaps, receipts,
//             and membership timeline.
//           </p>
//         </div>

//         <div className="member-page-actions">
//           <select
//             value={year}
//             onChange={(e) =>
//               setYear(Number(e.target.value))
//             }
//           >
//             {[
//               currentYear - 1,
//               currentYear,
//               currentYear + 1,
//             ].map((y) => (
//               <option
//                 key={y}
//                 value={y}
//               >
//                 {y}
//               </option>
//             ))}
//           </select>

//           <button
//             type="button"
//             className="member-link-btn"
//             onClick={loadCoverage}
//             disabled={loading}
//           >
//             Refresh
//           </button>
//         </div>
//       </div>

//       <div className="member-summary-grid">
//         <div className="member-summary-card">
//           <span>Paid Months</span>
//           <h2>{stats.paid}</h2>
//           <small>Covered months</small>
//         </div>

//         <div className="member-summary-card">
//           <span>Remaining</span>
//           <h2>{stats.unpaid}</h2>
//           <small>Unpaid months</small>
//         </div>

//         <div className="member-summary-card featured">
//           <span>Coverage</span>
//           <h2>{stats.percent}%</h2>
//           <small>Annual completion</small>
//         </div>

//         <div className="member-summary-card">
//           <span>Total Paid</span>
//           <h2>{formatMoney(stats.totalPaid)}</h2>
//           <small>Coverage payments</small>
//         </div>
//       </div>

//       {loading ? (
//         <div className="member-card">
//           Loading coverage...
//         </div>
//       ) : null}

//       {error ? (
//         <div className="member-alert error">
//           {error}
//         </div>
//       ) : null}

//       {!loading && activeCoverage ? (
//         <div className="member-card">
//           <div className="member-card-header">
//             <h2>
//               Current Membership Coverage
//             </h2>
//           </div>

//           <div className="coverage-active-grid">
//             <div className="coverage-info-box">
//               <span>Coverage Period</span>
//               <strong>
//                 {activeCoverage.coverage_label ||
//                   activeCoverage.coverage_month ||
//                   "--"}
//               </strong>
//             </div>

//             <div className="coverage-info-box">
//               <span>Membership Plan</span>
//               <strong>
//                 {activeCoverage.plan_name ||
//                   activeCoverage.plan_duration ||
//                   "--"}
//               </strong>
//             </div>

//             <div className="coverage-info-box">
//               <span>Months Paid</span>
//               <strong>
//                 {activeCoverage.months_paid || "--"}
//               </strong>
//             </div>

//             <div className="coverage-info-box">
//               <span>Amount</span>
//               <strong>
//                 {formatMoney(activeCoverage.amount)}
//               </strong>
//             </div>

//             <div className="coverage-info-box">
//               <span>Payment</span>
//               <strong>
//                 {activeCoverage.payment_number || "--"}
//               </strong>
//             </div>

//             <div className="coverage-info-box">
//               <span>Receipt</span>
//               <strong>
//                 {activeCoverage.receipt_number || "--"}
//               </strong>
//             </div>
//           </div>
//         </div>
//       ) : null}

//       {!loading ? (
//         <div className="member-card">
//           <div className="member-card-header">
//             <div>
//               <h2>
//                 Monthly Coverage Grid
//               </h2>

//               <p>
//                 Paid and unpaid months for {year}
//               </p>
//             </div>
//           </div>

//           <div className="coverage-grid">
//             {grid.map((month) => (
//               <div
//                 key={month.month_number}
//                 className={`coverage-month ${
//                   month.paid ? "paid" : "unpaid"
//                 }`}
//               >
//                 <div className="coverage-month-top">
//                   <div className="coverage-month-name">
//                     {month.month_name}
//                   </div>

//                   <StatusBadge status={month.status} />
//                 </div>

//                 <div className="coverage-month-body">
//                   <div className="coverage-meta">
//                     <small>Payment</small>
//                     <span>
//                       {month.payment_number || "--"}
//                     </span>
//                   </div>

//                   <div className="coverage-meta">
//                     <small>Receipt</small>
//                     <span>
//                       {month.receipt_number || "--"}
//                     </span>
//                   </div>

//                   <div className="coverage-meta">
//                     <small>Amount</small>
//                     <span>
//                       {month.amount
//                         ? formatMoney(month.amount)
//                         : "--"}
//                     </span>
//                   </div>

//                   <div className="coverage-meta">
//                     <small>Method</small>
//                     <span>
//                       {pretty(month.method)}
//                     </span>
//                   </div>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       ) : null}

//       {!loading && coverageRows.length ? (
//         <div className="member-card">
//           <div className="member-card-header">
//             <div>
//               <h2>
//                 Coverage History
//               </h2>

//               <p>
//                 Membership payment coverage timeline
//               </p>
//             </div>
//           </div>

//           <div className="member-table-wrap">
//             <table className="member-table">
//               <thead>
//                 <tr>
//                   <th>Coverage</th>
//                   <th>Plan</th>
//                   <th>Months</th>
//                   <th>Amount</th>
//                   <th>Payment</th>
//                   <th>Receipt</th>
//                   <th>Paid Date</th>
//                   <th>Status</th>
//                 </tr>
//               </thead>

//               <tbody>
//                 {coverageRows.map((row, index) => (
//                   <tr
//                     key={
//                       row.id ||
//                       row.payment_id ||
//                       `${row.coverage_month}-${index}`
//                     }
//                   >
//                     <td>
//                       {row.coverage_label ||
//                         row.coverage_month ||
//                         "--"}
//                     </td>

//                     <td>
//                       {row.plan_name ||
//                         row.plan_duration ||
//                         "--"}
//                     </td>

//                     <td>
//                       {row.months_paid || "--"}
//                     </td>

//                     <td>
//                       {formatMoney(row.amount)}
//                     </td>

//                     <td>
//                       {row.payment_number || "--"}
//                     </td>

//                     <td>
//                       {row.receipt_number || "--"}
//                     </td>

//                     <td>
//                       {formatDate(
//                         row.paid_at ||
//                           row.created_at
//                       )}
//                     </td>

//                     <td>
//                       <StatusBadge
//                         status={
//                           row.status ||
//                           row.coverage_status
//                         }
//                       />
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       ) : null}

//       {!loading &&
//       !coverageRows.length &&
//       !error ? (
//         <div className="member-card">
//           No membership coverage records found for this account.
//         </div>
//       ) : null}
//     </div>
//   );
// }

// frontend/src/components/MembershipDashboard/pages/MyMembershipCoverage.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../api";

import "../../../styles/membership-dashboard.css";

const MONTHS = [
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

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "--";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "--";

  return d.toLocaleDateString("en-US");
}

function monthNumberFromRow(row = {}) {
  const direct = Number(row.month_number || row.month || 0);

  if (direct >= 1 && direct <= 12) return direct;

  const raw = String(row.coverage_month || row.coverage_key || "").trim();

  if (/^\d{4}-\d{2}$/.test(raw)) {
    return Number(raw.slice(5, 7));
  }

  return null;
}

function normalizeGridPayload(data) {
  let source = [];

  if (Array.isArray(data?.grid)) {
    source = data.grid;
  } else if (data?.grid && typeof data.grid === "object") {
    source = Object.values(data.grid);
  } else if (Array.isArray(data?.rows)) {
    source = data.rows;
  } else if (Array.isArray(data?.months)) {
    source = data.months;
  } else if (Array.isArray(data?.coverage)) {
    source = data.coverage;
  } else if (Array.isArray(data)) {
    source = data;
  }

  const map = new Map();

  source.forEach((row) => {
    const monthNumber = monthNumberFromRow(row);

    if (monthNumber >= 1 && monthNumber <= 12) {
      map.set(monthNumber, row);
    }
  });

  return MONTHS.map((label, index) => {
    const monthNumber = index + 1;
    const row = map.get(monthNumber);

    const status = String(
      row?.status || row?.coverage_status || ""
    ).toLowerCase();

    const paid =
      Boolean(row?.paid) ||
      ["paid", "completed", "posted", "approved"].includes(status);

    return {
      month_number: monthNumber,
      month_name: label,
      paid,
      status: row ? status || (paid ? "paid" : "unpaid") : "unpaid",
      amount: Number(row?.amount || 0),
      payment_number: row?.payment_number || null,
      receipt_number: row?.receipt_number || null,
      invoice_number: row?.invoice_number || null,
      paid_at: row?.paid_at || row?.created_at || null,
    };
  });
}

function normalizeRows(data) {
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.coverage)) return data.coverage;
  if (Array.isArray(data)) return data;
  return [];
}

function StatusBadge({ paid }) {
  return paid ? (
    <span className="coverage-status-pill paid">Covered</span>
  ) : (
    <span className="coverage-status-pill unpaid">Open</span>
  );
}

function coverageSortValue(row = {}) {
  return String(
    row.coverage_end_month ||
      row.last_month ||
      row.coverage_month ||
      row.coverage_key ||
      ""
  );
}

export default function MyMembershipCoverage() {
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [grid, setGrid] = useState(() => normalizeGridPayload({ grid: [] }));
  const [coverageRows, setCoverageRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCoverage() {
    try {
      setLoading(true);
      setError("");

      const [gridRes, coverageRes] = await Promise.all([
        api.get(`/member/membership-grid/${year}`),
        api.get("/member/membership-coverage", {
          params: { year },
        }),
      ]);

      setGrid(normalizeGridPayload(gridRes.data));
      setCoverageRows(normalizeRows(coverageRes.data));
    } catch (err) {
      console.error("Membership coverage load failed:", err);

      setGrid(normalizeGridPayload({ grid: [] }));
      setCoverageRows([]);

      setError(
        err?.response?.data?.error ||
          "Failed to load membership coverage."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCoverage();
  }, [year]);

  const stats = useMemo(() => {
    const paid = grid.filter((row) => row.paid).length;
    const unpaid = Math.max(0, 12 - paid);
    const percent = Math.round((paid / 12) * 100);
    const totalPaid = grid.reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );

    return {
      paid,
      unpaid,
      percent,
      totalPaid,
    };
  }, [grid]);

  const nextUnpaid = useMemo(() => {
    return grid.find((row) => !row.paid) || null;
  }, [grid]);

  const activeCoverage = useMemo(() => {
    if (!coverageRows.length) return null;

    return [...coverageRows].sort((a, b) =>
      coverageSortValue(b).localeCompare(coverageSortValue(a))
    )[0];
  }, [coverageRows]);

  return (
    <div className="member-page">
      <div className="member-page-header">
        <div>
          <p className="member-page-eyebrow">Membership Coverage</p>

          <h1>{year} Coverage Calendar</h1>

          <p>
            A simple view of covered months, open months, and annual membership
            progress.
          </p>
        </div>

        <div className="member-page-actions">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="member-link-btn"
            onClick={loadCoverage}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="member-summary-grid">
        <div className="member-summary-card">
          <span>Covered</span>
          <h2>{stats.paid}</h2>
          <small>Paid months</small>
        </div>

        <div className="member-summary-card">
          <span>Open</span>
          <h2>{stats.unpaid}</h2>
          <small>Remaining months</small>
        </div>

        <div className="member-summary-card featured">
          <span>Progress</span>
          <h2>{stats.percent}%</h2>
          <small>Annual completion</small>
        </div>

        <div className="member-summary-card">
          <span>Total Paid</span>
          <h2>{formatMoney(stats.totalPaid)}</h2>
          <small>Membership coverage</small>
        </div>
      </div>

      {loading ? <div className="member-card">Loading coverage...</div> : null}

      {error ? <div className="member-alert error">{error}</div> : null}

      {!loading && activeCoverage ? (
        <div className="member-card coverage-overview-card">
          <div className="member-card-header">
            <div>
              <h2>Membership Snapshot</h2>
              <p>Your latest membership coverage status.</p>
            </div>
          </div>

          <div className="coverage-active-grid">
            <div className="coverage-info-box">
              <span>Latest Coverage</span>
              <strong>
                {activeCoverage.coverage_label ||
                  activeCoverage.coverage_month ||
                  "--"}
              </strong>
            </div>

            <div className="coverage-info-box">
              <span>Covered Months</span>
              <strong>{stats.paid} of 12</strong>
            </div>

            <div className="coverage-info-box">
              <span>Next Open Month</span>
              <strong>
                {nextUnpaid ? `${nextUnpaid.month_name} ${year}` : "Fully Covered"}
              </strong>
            </div>

            <div className="coverage-info-box">
              <span>Annual Progress</span>
              <strong>{stats.percent}% Complete</strong>
            </div>
          </div>
        </div>
      ) : null}

      {!loading ? (
        <div className="member-card">
          <div className="member-card-header">
            <div>
              <h2>Monthly Coverage Grid</h2>
              <p>Clear paid and unpaid membership months for {year}.</p>
            </div>
          </div>

          <div className="coverage-grid coverage-grid-clean">
            {grid.map((month) => (
              <div
                key={month.month_number}
                className={`coverage-month coverage-month-clean ${
                  month.paid ? "paid" : "unpaid"
                }`}
              >
                <div className="coverage-month-clean-top">
                  <div>
                    <span className="coverage-month-label">
                      Month
                    </span>

                    <h3>{month.month_name}</h3>
                  </div>

                  <StatusBadge paid={month.paid} />
                </div>

                <div className="coverage-month-clean-body">
                  {month.paid ? (
                    <>
                      <div className="coverage-clean-icon success">
                        ✓
                      </div>

                      <div>
                        <strong>Membership Covered</strong>
                        <p>
                          This month is paid and included in your active
                          membership coverage.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="coverage-clean-icon warning">
                        !
                      </div>

                      <div>
                        <strong>Payment Needed</strong>
                        <p>
                          This month is still open. You can include it in your
                          next renewal payment.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="coverage-month-clean-footer">
                  <span>Amount</span>
                  <strong>
                    {month.paid ? formatMoney(month.amount) : "--"}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && coverageRows.length ? (
        <div className="member-card">
          <div className="member-card-header">
            <div>
              <h2>Coverage History</h2>
              <p>Detailed payment records for finance reference.</p>
            </div>
          </div>

          <div className="member-table-wrap">
            <table className="member-table">
              <thead>
                <tr>
                  <th>Coverage</th>
                  <th>Plan</th>
                  <th>Months</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Receipt</th>
                  <th>Paid Date</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {coverageRows.map((row, index) => (
                  <tr
                    key={
                      row.id ||
                      row.payment_id ||
                      `${row.coverage_month}-${index}`
                    }
                  >
                    <td>{row.coverage_label || row.coverage_month || "--"}</td>

                    <td>{row.plan_name || row.plan_duration || "--"}</td>

                    <td>{row.months_paid || "--"}</td>

                    <td>{formatMoney(row.amount)}</td>

                    <td>{row.payment_number || "--"}</td>

                    <td>{row.receipt_number || "--"}</td>

                    <td>{formatDate(row.paid_at || row.created_at)}</td>

                    <td>
                      <StatusBadge
                        paid={[
                          "paid",
                          "completed",
                          "posted",
                          "approved",
                        ].includes(
                          String(row.status || row.coverage_status || "")
                            .toLowerCase()
                        )}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && !coverageRows.length && !error ? (
        <div className="member-card">
          No membership coverage records found for this account.
        </div>
      ) : null}
    </div>
  );
}