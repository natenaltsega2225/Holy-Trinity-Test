
// frontend/src/components/AdminDashboard/pages/CertificatesPage.jsx

import React, { useEffect, useMemo, useState } from "react";

import {
  Eye,
  Download,
  Search,
  MoreVertical,
  Mail,
  Archive,
  ShieldX,
  Trash2,
  FileBadge,
  Filter,
  RefreshCw,
  Plus,
  User,
  UserRoundX,
  X,
  Loader2,
} from "lucide-react";

import api from "../../../components/api";
// import "../../../styles/admin-certificates.css";
import "../../../styles/admin-enterprise.css";
import "../../../styles/admin-table.css";
/* =========================================================
   CERTIFICATE TYPES
========================================================= */

const TYPES = [
  "baptism_certificate",
  "engagement_certificate",
  "marriage_certificate",
  "volunteer_certificate",
  "participation_certificate",
  "recognition_certificate",
];

/* =========================================================
   HELPERS
========================================================= */

function prettyType(value = "") {
  return String(value || "")
    .replace(/_certificate$/i, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDate(value) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleDateString();
}

function normalizeUsers(payload) {
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.users)) return payload.users;

  return [];
}

function isActiveUser(user) {
  return (
    Number(user?.is_active) === 1 ||
    user?.is_active === true ||
    user?.is_active === "1" ||
    user?.is_active === undefined ||
    user?.is_active === null
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function CertificatesPage() {
  const PAGE_SIZE = 20;

  /* =====================================================
     TABLE STATE
  ===================================================== */

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");

  const [actionOpen, setActionOpen] = useState(null);

  /* =====================================================
     MODAL STATE
  ===================================================== */

  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState([]);
  const [searchingMembers, setSearchingMembers] = useState(false);

  const initialForm = useMemo(
    () => ({
      applicantType: "member",
      member_id: "",
      recipientName: "",
      externalEmail: "",
      type: "baptism_certificate",
      priestName: "",
      administratorName: "",
      note: "",
      husbandName: "",
      wifeName: "",
      marriageDate: "",
      witnessOne: "",
      witnessTwo: "",
      christianName: "",
      fatherName: "",
      motherName: "",
      godParentName: "",
      volunteerHours: "",
      recognitionLevel: "Gold Recognition",
    }),
    []
  );

  const [form, setForm] = useState(initialForm);

  /* =====================================================
     HELPERS
  ===================================================== */

  function updateForm(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setMemberSearch("");
    setMemberResults([]);
    setSearchingMembers(false);
  }

  function closeCreateModal() {
    setShowCreate(false);
    resetForm();
  }

  /* =====================================================
     LOAD CERTIFICATES
  ===================================================== */

 /* =====================================================
   LOAD CERTIFICATES
===================================================== */

async function loadData() {
  try {
    setLoading(true);

    const res = await api.get(
      "/admin/member-documents",
      {
        params: {
          search,
          status,
          type,
          page,
          pageSize: PAGE_SIZE,
        },
      }
    );

    console.log(
      "CERTIFICATE RESPONSE:",
      res.data
    );

    /* =========================================
       SUPPORT MULTIPLE RESPONSE SHAPES
    ========================================= */

    let rows = [];

    if (
      Array.isArray(
        res.data?.rows
      )
    ) {
      rows =
        res.data.rows;
    } else if (
      Array.isArray(
        res.data?.items
      )
    ) {
      rows =
        res.data.items;
    } else if (
      Array.isArray(
        res.data?.documents
      )
    ) {
      rows =
        res.data.documents;
    }

    setItems(rows);

    /* =========================================
       PAGINATION
    ========================================= */

    const total =
      Number(
        res.data?.total || 0
      );

    const calculatedPages =
      total > 0
        ? Math.ceil(
            total /
              PAGE_SIZE
          )
        : 1;

    setTotalPages(
      calculatedPages
    );

  } catch (err) {

    console.error(
      "LOAD CERTIFICATES ERROR:",
      err
    );

    setItems([]);

    setTotalPages(1);

    alert(
      err?.response?.data
        ?.error ||
        "Failed to load certificates."
    );

  } finally {

    setLoading(false);
  }
}
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status, type]);

  /* =====================================================
     SEARCH MEMBERS
  ===================================================== */

async function searchMembers(
  keyword = ""
) {

  try {

    const value =
      String(
        keyword || ""
      ).trim();

    setMemberSearch(
      value
    );

    setSearchingMembers(
      true
    );

    const res =
      await api.get(
        "/admin/access-users",
        {
          params: {

            search:
              value,

            page: 1,

            pageSize: 300,
          },
        }
      );

    let users =
      normalizeUsers(
        res.data
      );

    /* ==========================================
       ACTIVE USERS ONLY
    ========================================== */

    users = users.filter(
      (u) =>

        Number(
          u.is_active
        ) === 1 ||

        u.is_active ===
          true ||

        u.is_active ===
          "1" ||

        u.is_active ===
          undefined
    );

    /* ==========================================
       SORT A-Z
    ========================================== */

    users.sort(
      (a, b) => {

        const aName =
          String(

            a.member_full_name ||

            a.full_name ||

            ""
          ).toLowerCase();

        const bName =
          String(

            b.member_full_name ||

            b.full_name ||

            ""
          ).toLowerCase();

        return aName.localeCompare(
          bName
        );
      }
    );

    setMemberResults(
      users
    );

  } catch (err) {

    console.error(
      "Member search error:",
      err
    );

    setMemberResults(
      []
    );

  } finally {

    setSearchingMembers(
      false
    );
  }
}
  function selectMember(member) {
    const fullName =
      member.member_full_name ||
      member.full_name ||
      member.username ||
      "";

    setForm((prev) => ({
      ...prev,
      applicantType: "member",
      member_id: member.id || "",
      recipientName: fullName,
      externalEmail: member.email || "",
    }));

    setMemberSearch(fullName);
    setMemberResults([]);
  }

  /* =====================================================
     GENERATE CERTIFICATE
  ===================================================== */

  function validateForm() {
    const errors = [];

    if (form.applicantType === "member" && !form.member_id) {
      errors.push("Please search and select a member.");
    }

    if (!form.recipientName.trim()) {
      errors.push("Recipient name is required.");
    }

    if (!form.type) {
      errors.push("Certificate type is required.");
    }

    if (!form.priestName.trim()) {
      errors.push("Priest name is required.");
    }

    if (
      form.type === "marriage_certificate" ||
      form.type === "engagement_certificate"
    ) {
      if (!form.husbandName.trim()) {
        errors.push("Husband name is required.");
      }

      if (!form.wifeName.trim()) {
        errors.push("Wife name is required.");
      }
    }

    if (form.type === "baptism_certificate") {
      if (!form.christianName.trim()) {
        errors.push("Christian name is required.");
      }
    }

    return errors;
  }

  async function generateCertificate() {
    const errors = validateForm();

    if (errors.length) {
      alert(errors[0]);
      return;
    }

    try {
      setSubmitting(true);

      await api.post("/certificates/generate", {
        ...form,
        externalEmail: form.externalEmail || "",
        recipientName: form.recipientName.trim(),
      });

      alert("Certificate generated successfully.");

      closeCreateModal();

      await loadData();
    } catch (err) {
      console.error("GENERATE CERTIFICATE ERROR:", err);

      alert(
        err?.response?.data?.error ||
          err?.response?.data?.details ||
          "Failed to generate certificate."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =====================================================
     ACTIONS
  ===================================================== */

  async function handleView(id) {
    try {
      const response = await api.get(
        `/admin/member-documents/${id}/view`,
        {
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data], {
        type: "application/pdf",
      });

      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error("VIEW CERTIFICATE ERROR:", err);
      alert("Unable to open certificate.");
    }
  }

  async function handleDownload(id) {
    try {
      const response = await api.get(
        `/admin/member-documents/${id}/download`,
        {
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data], {
        type: "application/pdf",
      });

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "certificate.pdf";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("DOWNLOAD CERTIFICATE ERROR:", err);
      alert("Unable to download certificate.");
    }
  }

  async function resendEmail(id) {
    try {
      await api.post(`/admin/member-documents/${id}/resend-email`);

      alert("Certificate email resent successfully.");
    } catch (err) {
      console.error("RESEND EMAIL ERROR:", err);

      alert(
        err?.response?.data?.error ||
          "Failed to resend certificate email."
      );
    }
  }

  async function archiveCertificate(id) {
    try {
      await api.patch(`/admin/member-documents/${id}/archive`);
      await loadData();
    } catch (err) {
      console.error("ARCHIVE CERTIFICATE ERROR:", err);
      alert("Failed to archive certificate.");
    }
  }

  async function revokeCertificate(id) {
    try {
      await api.patch(`/admin/member-documents/${id}/revoke`);
      await loadData();
    } catch (err) {
      console.error("REVOKE CERTIFICATE ERROR:", err);
      alert("Failed to revoke certificate.");
    }
  }

  async function deleteCertificate(id) {
    const ok = window.confirm("Delete this certificate?");

    if (!ok) return;

    try {
      await api.delete(`/admin/member-documents/${id}`);
      await loadData();
    } catch (err) {
      console.error("DELETE CERTIFICATE ERROR:", err);
      alert("Failed to delete certificate.");
    }
  }

  function statusClass(value) {
    switch (String(value || "").toLowerCase()) {
      case "archived":
        return "status-archived";
      case "revoked":
        return "status-revoked";
      default:
        return "status-active";
    }
  }

  /* =====================================================
     DYNAMIC FORM FIELDS
  ===================================================== */

  function renderDynamicFields() {
    if (
      form.type === "marriage_certificate" ||
      form.type === "engagement_certificate"
    ) {
      return (
        <div className="cert-form-grid">
          <div className="cert-form-group">
            <label>Husband Name</label>
            <input
              type="text"
              value={form.husbandName}
              onChange={(e) =>
                updateForm("husbandName", e.target.value)
              }
            />
          </div>

          <div className="cert-form-group">
            <label>Wife Name</label>
            <input
              type="text"
              value={form.wifeName}
              onChange={(e) =>
                updateForm("wifeName", e.target.value)
              }
            />
          </div>

          <div className="cert-form-group">
            <label>Marriage / Engagement Date</label>
            <input
              type="date"
              value={form.marriageDate}
              onChange={(e) =>
                updateForm("marriageDate", e.target.value)
              }
            />
          </div>

          <div className="cert-form-group">
            <label>Witness One</label>
            <input
              type="text"
              value={form.witnessOne}
              onChange={(e) =>
                updateForm("witnessOne", e.target.value)
              }
            />
          </div>

          <div className="cert-form-group">
            <label>Witness Two</label>
            <input
              type="text"
              value={form.witnessTwo}
              onChange={(e) =>
                updateForm("witnessTwo", e.target.value)
              }
            />
          </div>
        </div>
      );
    }

    if (form.type === "baptism_certificate") {
      return (
        <div className="cert-form-grid">
          <div className="cert-form-group">
            <label>Christian Name</label>
            <input
              type="text"
              value={form.christianName}
              onChange={(e) =>
                updateForm("christianName", e.target.value)
              }
            />
          </div>

          <div className="cert-form-group">
            <label>Father Name</label>
            <input
              type="text"
              value={form.fatherName}
              onChange={(e) =>
                updateForm("fatherName", e.target.value)
              }
            />
          </div>

          <div className="cert-form-group">
            <label>Mother Name</label>
            <input
              type="text"
              value={form.motherName}
              onChange={(e) =>
                updateForm("motherName", e.target.value)
              }
            />
          </div>

          <div className="cert-form-group">
            <label>God Parent</label>
            <input
              type="text"
              value={form.godParentName}
              onChange={(e) =>
                updateForm("godParentName", e.target.value)
              }
            />
          </div>
        </div>
      );
    }

    if (
      form.type === "volunteer_certificate" ||
      form.type === "recognition_certificate"
    ) {
      return (
        <div className="cert-form-grid">
          <div className="cert-form-group">
            <label>Volunteer Hours</label>
            <input
              type="number"
              min="0"
              value={form.volunteerHours}
              onChange={(e) =>
                updateForm("volunteerHours", e.target.value)
              }
            />
          </div>

          <div className="cert-form-group">
            <label>Recognition Level</label>
            <select
              value={form.recognitionLevel}
              onChange={(e) =>
                updateForm("recognitionLevel", e.target.value)
              }
            >
              <option value="Gold Recognition">
                Gold Recognition
              </option>
              <option value="Silver Recognition">
                Silver Recognition
              </option>
              <option value="Bronze Recognition">
                Bronze Recognition
              </option>
            </select>
          </div>
        </div>
      );
    }

    return null;
  }

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div className="admin-cert-page">
      <div className="admin-cert-header">
        <div>
          <h1>Certificate Management</h1>
          <p>
            Enterprise certificate administration and delivery
            system.
          </p>
        </div>

        <div className="cert-header-actions">
          <button
            className="cert-refresh-btn"
            type="button"
            onClick={loadData}
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            className="cert-create-btn"
            type="button"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={16} />
            Add Certificate
          </button>
        </div>
      </div>

      <div className="cert-filter-bar">
        <div className="cert-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search certificates..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        <div className="cert-filter-group">
          <Filter size={15} />
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>

        <div className="cert-filter-group">
          <FileBadge size={15} />
          <select
            value={type}
            onChange={(e) => {
              setPage(1);
              setType(e.target.value);
            }}
          >
            <option value="">All Types</option>
            {TYPES.map((item) => (
              <option key={item} value={item}>
                {prettyType(item)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="cert-table-wrap">
        <table className="cert-table">
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Type</th>
              <th>Applicant</th>
              <th>Status</th>
              <th>Certificate #</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan="7" className="cert-loading">
                  Loading certificates...
                </td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan="7" className="cert-empty">
                  <div className="cert-empty-wrap">
                    <FileBadge size={44} />
                    <h3>No Certificates Found</h3>
                    <p>
                      No certificates match the selected filters.
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              items.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div className="cert-user">
                      <div className="cert-avatar">
                        <FileBadge size={18} />
                      </div>

                      <div>
                        <div className="cert-user-name">
                          {doc.recipient_name ||
                            doc.full_name ||
                            "--"}
                        </div>

                        <div className="cert-user-sub">
                          {doc.external_email || doc.email || "--"}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className="cert-type-pill">
                      {prettyType(doc.document_type)}
                    </span>
                  </td>

                  <td>
                    <span className="cert-applicant">
                      {doc.applicant_type || "member"}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`cert-status-pill ${statusClass(
                        doc.status
                      )}`}
                    >
                      {doc.status || "active"}
                    </span>
                  </td>

                  <td>
                    <span className="cert-number">
                      {doc.certificate_number || "--"}
                    </span>
                  </td>

                  <td>
                    {formatDate(doc.created_at || doc.uploaded_at)}
                  </td>

                  <td>
                    <div className="cert-action-wrap">
                      <button
                        className="cert-action-btn"
                        type="button"
                        onClick={() =>
                          setActionOpen(
                            actionOpen === doc.id ? null : doc.id
                          )
                        }
                      >
                        <MoreVertical size={16} />
                      </button>

                      {actionOpen === doc.id && (
                        <div className="cert-action-menu">
                          <button
                            type="button"
                            onClick={() => handleView(doc.id)}
                          >
                            <Eye size={15} />
                            View
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(doc.id)}
                          >
                            <Download size={15} />
                            Download
                          </button>

                          <button
                            type="button"
                            onClick={() => resendEmail(doc.id)}
                          >
                            <Mail size={15} />
                            Resend Email
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              archiveCertificate(doc.id)
                            }
                          >
                            <Archive size={15} />
                            Archive
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              revokeCertificate(doc.id)
                            }
                          >
                            <ShieldX size={15} />
                            Revoke
                          </button>

                          <button
                            type="button"
                            className="danger"
                            onClick={() =>
                              deleteCertificate(doc.id)
                            }
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="cert-pagination">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((prev) => prev - 1)}
        >
          Previous
        </button>

        <div className="cert-page-info">
          Page {page} of {totalPages}
        </div>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((prev) => prev + 1)}
        >
          Next
        </button>
      </div>

      {showCreate && (
        <div className="cert-modal-overlay">
          <div className="cert-modal">
            <div className="cert-modal-header">
              <h2>Generate Certificate</h2>

              <button type="button" onClick={closeCreateModal}>
                <X size={18} />
              </button>
            </div>

            <div className="cert-radio-group">
              <button
                type="button"
                className={
                  form.applicantType === "member" ? "active" : ""
                }
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    applicantType: "member",
                  }))
                }
              >
                <User size={16} />
                Member
              </button>

              <button
                type="button"
                className={
                  form.applicantType === "non_member"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    applicantType: "non_member",
                    member_id: "",
                  }))
                }
              >
                <UserRoundX size={16} />
                Non Member
              </button>
            </div>



            {form.applicantType === "member" && (
  <div className="cert-form-group cert-member-search-group">
    <label>
      Search Member
    </label>

    <div className="cert-member-search-wrap">

      <Search
        size={18}
        className="cert-member-search-icon"
      />

    <input
  type="text"
  placeholder="Search active members..."
  value={memberSearch}
  onChange={(e) =>
    searchMembers(
      e.target.value
    )
  }
  onFocus={() => {

    searchMembers("");

    if (
      memberResults.length
    ) {

      setMemberResults([
        ...memberResults,
      ]);
    }
  }}
/>

      {searchingMembers && (
        <div className="cert-member-loading">
          <Loader2
            size={16}
            className="spin"
          />
        </div>
      )}

      {memberResults.length >
        0 && (
        <div className="cert-member-dropdown">

          {memberResults.map(
            (member) => {

              const fullName =

                member.member_full_name ||

                member.full_name ||

                member.username ||

                "--";

              return (
                <button
                  key={
                    member.id
                  }
                  type="button"
                  className="cert-member-option"
                  onClick={() =>
                    selectMember(
                      member
                    )
                  }
                >
                  <div className="cert-member-option-main">
                    <span className="cert-member-option-name">
                      {fullName}
                    </span>

                    <span className="cert-member-option-email">
                      {member.email ||
                        "--"}
                    </span>
                  </div>

                  <span className="cert-member-option-role">
                    {member.role ||
                      "member"}
                  </span>
                </button>
              );
            }
          )}
        </div>
      )}
    </div>
  </div>
)}
            <div className="cert-form-grid">
              <div className="cert-form-group">
                <label>Recipient Name</label>
                <input
                  type="text"
                  value={form.recipientName}
                  onChange={(e) =>
                    updateForm("recipientName", e.target.value)
                  }
                />
              </div>

              <div className="cert-form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={form.externalEmail}
                  onChange={(e) =>
                    updateForm("externalEmail", e.target.value)
                  }
                />
              </div>

              <div className="cert-form-group">
                <label>Certificate Type</label>
                <select
                  value={form.type}
                  onChange={(e) => updateForm("type", e.target.value)}
                >
                  {TYPES.map((item) => (
                    <option key={item} value={item}>
                      {prettyType(item)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cert-form-group">
                <label>Priest Name</label>
                <input
                  type="text"
                  value={form.priestName}
                  onChange={(e) =>
                    updateForm("priestName", e.target.value)
                  }
                />
              </div>

              <div className="cert-form-group">
                <label>Administrator Name</label>
                <input
                  type="text"
                  value={form.administratorName}
                  onChange={(e) =>
                    updateForm("administratorName", e.target.value)
                  }
                />
              </div>
            </div>

            {renderDynamicFields()}

            <div className="cert-form-group">
              <label>Notes</label>
              <textarea
                rows="4"
                value={form.note}
                onChange={(e) => updateForm("note", e.target.value)}
              />
            </div>

            <div className="cert-modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={closeCreateModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="submit-btn"
                disabled={submitting}
                onClick={generateCertificate}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Certificate"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}