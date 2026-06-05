// frontend/src/components/AdminDashboard/pages/ProgramRegistrations.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../../components/api";
import "../../../styles/newsEventsAdmin.css";

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function parseParticipants(value) {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function exportRowsToCsv(rows) {
  const headers = [
    "Program",
    "Category",
    "Registrant",
    "Email",
    "Phone",
    "Participants",
    "Participant Names",
    "Price Per Person",
    "Total Amount",
    "Status",
    "Payment Number",
    "Receipt Number",
    "Created At",
  ];

  const csvRows = rows.map((row) => {
    const participants = parseParticipants(row.participants_json);
    const participantNames = participants
      .map((p) => `${p.name || ""}${p.age ? ` (${p.age})` : ""}`)
      .join(" | ");

    return [
      row.program_title || "",
      row.category || "",
      row.full_name || "",
      row.email || "",
      row.phone || "",
      row.quantity || "",
      participantNames,
      row.price_per_person || "",
      row.total_amount || "",
      row.status || "",
      row.payment_number || "",
      row.receipt_number || "",
      row.created_at || "",
    ];
  });

  const csv = [headers, ...csvRows]
    .map((line) =>
      line
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "program-registrations.csv";
  a.click();

  URL.revokeObjectURL(url);
}

export default function ProgramRegistrations() {
  const [rows, setRows] = useState([]);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const { data } = await api.get("/program-registrations/admin", {
        params: {
          category: category || undefined,
          status: status || undefined,
          search: search.trim() || undefined,
        },
      });

      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (error) {
      console.error(error);
      setErr("Could not load program registrations.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status]);

  const summary = useMemo(() => {
    const totalRevenue = rows.reduce(
      (sum, row) => sum + Number(row.total_amount || 0),
      0
    );

    const totalParticipants = rows.reduce(
      (sum, row) => sum + Number(row.quantity || 0),
      0
    );

    const paidCount = rows.filter((row) => row.status === "paid").length;

    return {
      totalRows: rows.length,
      totalRevenue,
      totalParticipants,
      paidCount,
    };
  }, [rows]);

  return (
    <div className="nea-page">
      <section className="nea-hero">
        <div>
          <p className="nea-eyebrow">Administration</p>
          <h2>Program Registrations</h2>
          <p>
            View kids school and trip registrations, participants, capacity usage,
            payment status, receipts, and export data.
          </p>
        </div>

        <div className="nea-hero-actions">
          <button
            type="button"
            className="nea-primary-btn"
            onClick={() => exportRowsToCsv(rows)}
            disabled={!rows.length}
          >
            Export CSV
          </button>
        </div>
      </section>

      <section className="nea-stats-grid">
        <article className="nea-stat-card">
          <span>Registrations</span>
          <strong>{summary.totalRows}</strong>
        </article>

        <article className="nea-stat-card">
          <span>Paid</span>
          <strong>{summary.paidCount}</strong>
        </article>

        <article className="nea-stat-card">
          <span>Participants</span>
          <strong>{summary.totalParticipants}</strong>
        </article>

        <article className="nea-stat-card">
          <span>Revenue</span>
          <strong>{formatMoney(summary.totalRevenue)}</strong>
        </article>
      </section>

      <section className="nea-toolbar-card">
        <form
          className="nea-toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input
            className="nea-input"
            placeholder="Search name, email, phone, or program..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="nea-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All Programs</option>
            <option value="kids">Kids Programs</option>
            <option value="trip">Trips</option>
          </select>

          <select
            className="nea-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button type="submit" className="nea-primary-btn">
            Search
          </button>
        </form>
      </section>

      {err ? <div className="auth-banner">{err}</div> : null}

      <section className="nea-table-card">
        <div className="nea-table-wrap desktop-table">
          <table className="nea-table">
            <thead>
              <tr>
                <th>Program</th>
                <th>Registrant</th>
                <th>Participants</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Receipt</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="nea-empty-cell">
                    Loading…
                  </td>
                </tr>
              ) : null}

              {!loading && rows.map((row) => {
                const participants = parseParticipants(row.participants_json);

                return (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.program_title || "--"}</strong>
                      <div>{row.category === "kids" ? "Kids Program" : "Trip"}</div>
                    </td>

                    <td>
                      <strong>{row.full_name}</strong>
                      <div>{row.email}</div>
                      <div>{row.phone || "--"}</div>
                    </td>

                    <td>
                      <strong>{row.quantity}</strong>
                      <div>
                        {participants.length
                          ? participants
                              .map((p) =>
                                `${p.name || ""}${p.age ? ` (${p.age})` : ""}`
                              )
                              .join(", ")
                          : "--"}
                      </div>
                    </td>

                    <td>
                      <strong>{formatMoney(row.total_amount)}</strong>
                      <div>{formatMoney(row.price_per_person)} / person</div>
                      <div>{row.payment_number || "--"}</div>
                    </td>

                    <td>
                      <span
                        className={
                          row.status === "paid"
                            ? "nea-pill nea-pill-published"
                            : "nea-pill nea-pill-draft"
                        }
                      >
                        {row.status}
                      </span>
                    </td>

                    <td>{row.receipt_number || "--"}</td>

                    <td>{formatDate(row.created_at)}</td>
                  </tr>
                );
              })}

              {!loading && !rows.length ? (
                <tr>
                  <td colSpan={7} className="nea-empty-cell">
                    No registrations found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}