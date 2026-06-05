

// src/components/Shared/MembersList.jsx
import React, { useEffect, useState } from "react";
import api from "../api";
import MemberFilters from "./MemberFilters";

export default function MembersList({ canEdit = false, canExport = false }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState({ text: "", status: "active", plan: "" });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");

      try {
        const params = {
          search: q.text || "",
          page,
          pageSize,
        };

        if (q.plan) params.plan = q.plan;

        if (q.status === "active") params.active = "1";
        if (q.status === "inactive") params.active = "0";
        if (q.status === "delinquent") params.paid = "unpaid";

        const { data } = await api.get("/members", { params });

        setRows(data?.rows || []);
        setTotal(Number(data?.total || 0));
      } catch (e) {
        console.error(e);
        setRows([]);
        setTotal(0);
        setErr(e?.response?.data?.error || "Failed to load members");
      }

      setLoading(false);
    })();
  }, [q, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <>
      <div className="dash-title" style={{ marginBottom: 8 }}>
        Membership
      </div>

      <MemberFilters
        value={q}
        onChange={(next) => {
          setPage(1);
          setQ(next);
        }}
        pageSize={pageSize}
        onPageSize={setPageSize}
      />

      {err ? (
        <div className="auth-banner" style={{ margin: "10px 0" }}>
          {err}
        </div>
      ) : null}

      <div className="dash-table-wrap">
        <div className="dash-table-scroll" style={{ maxHeight: 560 }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th style={{ width: 240 }}>Name</th>
                <th>Email</th>
                <th style={{ width: 150 }}>Status</th>
                <th style={{ width: 180 }}>Plan</th>
                <th style={{ width: 160 }}>Next Due</th>
                <th style={{ width: 150 }}>Total Paid</th>
                {(canEdit || canExport) && <th style={{ width: 220, textAlign: "right" }}>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canEdit || canExport ? 7 : 6} style={{ padding: 16 }}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 950 }}>
                      {m.first_name} {m.last_name}
                    </td>
                    <td>{m.email}</td>
                    <td>{m.status || m.paid_status || "—"}</td>
                    <td>{m.plan_label || (m.cadence_months ? `${m.cadence_months} months` : "—")}</td>
                    <td>{m.next_due || m.next_due_at || "—"}</td>
                    <td>${Number(m.total_paid || 0).toLocaleString()}</td>

                    {(canEdit || canExport) && (
                      <td>
                        <div className="dash-actions">
                          {canEdit && <button className="dash-btn dash-btn-ghost" onClick={() => {}}>Edit</button>}
                          {canExport && (
                            <button className="dash-btn dash-btn-primary" onClick={() => {}}>
                              Export
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canEdit || canExport ? 7 : 6} style={{ padding: 16 }}>
                    No members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="dash-pager">
          <button
            className="dash-btn dash-btn-ghost"
            disabled={!canPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>

          <div className="meta">
            Page {page} / {totalPages} • Total {total}
          </div>

          <button
            className="dash-btn dash-btn-primary"
            disabled={!canNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      </div>
    </>
  );
}