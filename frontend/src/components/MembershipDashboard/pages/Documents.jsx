
// // frontend/src/components/MembershipDashoard/pages/Documents.jsx

// import React, {
//   useEffect,
//   useMemo,
//   useState,
// } from "react";

// import {
//   Eye,
//   Download,
//   Search,
//   FileBadge,
//   CalendarDays,
//   ShieldCheck,
//   MoreVertical,
// } from "lucide-react";

// import api from "../../api";

// import "../../../styles/member-documents.css";

// /* =========================================================
//    COMPONENT
// ========================================================= */

// export default function Documents() {

//   const [
//     loading,
//     setLoading,
//   ] = useState(false);

//   const [
//     documents,
//     setDocuments,
//   ] = useState([]);

//   const [
//     search,
//     setSearch,
//   ] = useState("");

//   const [
//     actionOpen,
//     setActionOpen,
//   ] = useState(null);

//   /* =====================================================
//      LOAD
//   ===================================================== */

//   async function loadDocuments() {

//     try {

//       setLoading(true);

//       const res =
//         await api.get(
//           "/member/documents"
//         );

//       const items =
//         Array.isArray(
//           res.data?.items
//         )
//           ? res.data.items
//           : [];

//       items.sort(
//         (a, b) =>
//           String(
//             a.title || ""
//           ).localeCompare(
//             String(
//               b.title || ""
//             )
//           )
//       );

//       setDocuments(items);

//     } catch (err) {

//       console.error(err);

//       alert(
//         "Unable to load documents."
//       );

//     } finally {

//       setLoading(false);
//     }
//   }

//   useEffect(() => {

//     loadDocuments();

//   }, []);

//   /* =====================================================
//      FILTERED
//   ===================================================== */

//   const filteredDocuments =
//     useMemo(() => {

//       const q =
//         search
//           .toLowerCase()
//           .trim();

//       if (!q) {
//         return documents;
//       }

//       return documents.filter(
//         (doc) => {

//           return (

//             String(
//               doc.title || ""
//             )
//               .toLowerCase()
//               .includes(q)

//             ||

//             String(
//               doc.type || ""
//             )
//               .toLowerCase()
//               .includes(q)

//             ||

//             String(
//               doc.certificate_number || ""
//             )
//               .toLowerCase()
//               .includes(q)
//           );
//         }
//       );

//     }, [
//       documents,
//       search,
//     ]);

//   /* =====================================================
//      VIEW
//   ===================================================== */

//   async function handleView(
//     id
//   ) {

//     try {

//       const response =
//         await api.get(
//           `/member/documents/${id}/view`,
//           {
//             responseType:
//               "blob",
//           }
//         );

//       const blob =
//         new Blob(
//           [response.data],
//           {
//             type:
//               "application/pdf",
//           }
//         );

//       const url =
//         URL.createObjectURL(
//           blob
//         );

//       window.open(
//         url,
//         "_blank"
//       );

//     } catch (err) {

//       console.error(err);

//       alert(
//         "Unable to open certificate."
//       );
//     }
//   }

//   /* =====================================================
//      DOWNLOAD
//   ===================================================== */

//   async function handleDownload(
//     id
//   ) {

//     try {

//       const response =
//         await api.get(
//           `/member/documents/${id}/download`,
//           {
//             responseType:
//               "blob",
//           }
//         );

//       const blob =
//         new Blob(
//           [response.data],
//           {
//             type:
//               "application/pdf",
//           }
//         );

//       const url =
//         URL.createObjectURL(
//           blob
//         );

//       const link =
//         document.createElement(
//           "a"
//         );

//       link.href = url;

//       link.download =
//         "certificate.pdf";

//       document.body.appendChild(
//         link
//       );

//       link.click();

//       link.remove();

//       URL.revokeObjectURL(
//         url
//       );

//     } catch (err) {

//       console.error(err);

//       alert(
//         "Unable to download certificate."
//       );
//     }
//   }

//   /* =====================================================
//      FORMAT TYPE
//   ===================================================== */

//   function prettyType(
//     type = ""
//   ) {

//     return String(type)
//       .replaceAll(
//         "_",
//         " "
//       )
//       .replace(
//         /\b\w/g,
//         (m) =>
//           m.toUpperCase()
//       );
//   }

//   /* =====================================================
//      EMPTY
//   ===================================================== */

//   const isEmpty =
//     !loading &&
//     filteredDocuments.length === 0;

//   /* =====================================================
//      UI
//   ===================================================== */

//   return (

//     <div className="member-doc-page">

//       {/* =================================================
//          HEADER
//       ================================================= */}

//       <div className="member-doc-header">

//         <div>

//           <h1>
//             My Certificates & Documents
//           </h1>

//           <p>
//             Secure enterprise
//             document center
//             for your official
//             church certificates.
//           </p>

//         </div>

//       </div>

//       {/* =================================================
//          SEARCH
//       ================================================= */}

//       <div className="member-doc-search">

//         <Search size={16} />

//         <input
//           type="text"
//           placeholder="Search documents..."
//           value={search}
//           onChange={(e) =>
//             setSearch(
//               e.target.value
//             )
//           }
//         />

//       </div>

//       {/* =================================================
//          TABLE
//       ================================================= */}

//       <div className="member-doc-table-wrap">

//         <table className="member-doc-table">

//           <thead>

//             <tr>

//               <th>
//                 Document
//               </th>

//               <th>
//                 Type
//               </th>

//               <th>
//                 Certificate #
//               </th>

//               <th>
//                 Issued
//               </th>

//               <th>
//                 Status
//               </th>

//               <th>
//                 Action
//               </th>

//             </tr>

//           </thead>

//           <tbody>

//             {loading && (

//               <tr>

//                 <td
//                   colSpan="6"
//                   className="member-doc-loading"
//                 >
//                   Loading documents...
//                 </td>

//               </tr>
//             )}

//             {isEmpty && (

//               <tr>

//                 <td
//                   colSpan="6"
//                   className="member-doc-empty"
//                 >

//                   <div className="member-doc-empty-box">

//                     <FileBadge size={42} />

//                     <h3>
//                       No Documents Found
//                     </h3>

//                     <p>
//                       Your certificates
//                       and documents
//                       will appear here.
//                     </p>

//                   </div>

//                 </td>

//               </tr>
//             )}

//             {!loading &&
//               filteredDocuments.map(
//                 (doc) => (

//                   <tr key={doc.id}>

//                     {/* =============================
//                        DOC
//                     ============================== */}
// <td>

//   <div className="member-doc-user">

//     <div className="member-doc-icon">

//       <FileBadge size={18} />

//     </div>

//     <div className="member-doc-title">

//       {
//         prettyType(
//           doc.document_type ||
//           doc.type
//         )
//       }

//     </div>

//   </div>

// </td>
//                     {/* =============================
//                        TYPE
//                     ============================== */}

//                     <td>

//                       <span className="member-doc-type">

//                         {
//                           prettyType(
//                             doc.type
//                           )
//                         }

//                       </span>

//                     </td>

//                     {/* =============================
//                        CERT
//                     ============================== */}

//                     <td>

//                       <span className="member-doc-cert">

//                         {
//                           doc.certificate_number
//                         }

//                       </span>

//                     </td>

//                     {/* =============================
//                        DATE
//                     ============================== */}

//                     <td>

//                       <div className="member-doc-date">

//                         <CalendarDays size={14} />

//                         {new Date(
//                           doc.created_at
//                         ).toLocaleDateString()}

//                       </div>

//                     </td>

//                     {/* =============================
//                        STATUS
//                     ============================== */}

//                     <td>

//                       <div className="member-doc-status">

//                         <ShieldCheck size={14} />

//                         {
//                           doc.status ||
//                           "active"
//                         }

//                       </div>

//                     </td>

//                     {/* =============================
//                        ACTIONS
//                     ============================== */}

//                     <td>

//                       <div className="member-doc-actions-wrap">

//                         <button
//                           className="member-doc-action-btn"
//                           onClick={() =>
//                             setActionOpen(
//                               actionOpen ===
//                                 doc.id
//                                 ? null
//                                 : doc.id
//                             )
//                           }
//                         >
//                           <MoreVertical size={16} />
//                         </button>

//                         {actionOpen ===
//                           doc.id && (

//                           <div className="member-doc-action-menu">

//                             <button
//                               onClick={() =>
//                                 handleView(
//                                   doc.id
//                                 )
//                               }
//                             >
//                               <Eye size={15} />
//                               View
//                             </button>

//                             <button
//                               onClick={() =>
//                                 handleDownload(
//                                   doc.id
//                                 )
//                               }
//                             >
//                               <Download size={15} />
//                               Download
//                             </button>

//                           </div>
//                         )}

//                       </div>

//                     </td>

//                   </tr>
//                 )
//               )}

//           </tbody>

//         </table>

//       </div>

//     </div>
//   );
// }
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileBadge,
  FileText,
  Filter,
  Mail,
  RefreshCcw,
  Search,
  ShieldCheck,
} from "lucide-react";

import api from "../../api";

import "../../../styles/member-documents.css";

const LIST_ENDPOINTS = [
  "/member/documents",
  "/member/documents/list",
  "/membership/documents",
];

const DOCUMENT_ROUTE_PREFIXES = ["/member/documents", "/membership/documents"];

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function pretty(value, fallback = "--") {
  const text = normalizeText(value);

  if (!text) return fallback;

  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeStatus(value) {
  const status = normalizeText(value || "available").toLowerCase();

  if (["active", "available", "issued", "ready", "approved"].includes(status)) {
    return "available";
  }

  if (["pending", "processing", "review", "in_review"].includes(status)) {
    return "pending";
  }

  if (["archived", "expired", "revoked", "inactive"].includes(status)) {
    return "archived";
  }

  return status || "available";
}

function statusLabel(value) {
  const status = normalizeStatus(value);

  if (status === "available") return "Available";
  if (status === "pending") return "Pending";
  if (status === "archived") return "Archived";

  return pretty(status);
}

function statusIcon(value) {
  const status = normalizeStatus(value);

  if (status === "available") return <CheckCircle2 size={14} />;
  if (status === "pending") return <Clock size={14} />;
  if (status === "archived") return <Archive size={14} />;

  return <ShieldCheck size={14} />;
}

function documentId(row) {
  return firstValue(row, ["id", "document_id", "member_document_id"], "");
}

function documentTitle(row) {
  return firstValue(
    row,
    ["title", "document_title", "name", "file_title", "certificate_title"],
    pretty(documentType(row), "Official Document")
  );
}

function documentType(row) {
  return firstValue(
    row,
    ["document_type", "type", "category", "certificate_type", "file_type"],
    "document"
  );
}

function documentReference(row) {
  return firstValue(
    row,
    [
      "certificate_number",
      "certificate_no",
      "reference_no",
      "reference_number",
      "document_number",
      "document_no",
    ],
    "--"
  );
}

function uploadedBy(row) {
  return firstValue(
    row,
    ["uploaded_by_name", "uploaded_by", "created_by_name", "created_by_email"],
    "--"
  );
}

function issuedDate(row) {
  return firstValue(
    row,
    ["issued_at", "issue_date", "uploaded_at", "created_at", "updated_at"],
    ""
  );
}

function fileName(row) {
  return firstValue(
    row,
    ["original_file_name", "filename", "file_name", "stored_file_name"],
    `${pretty(documentType(row), "document").replace(/\s+/g, "-").toLowerCase()}.pdf`
  );
}

function hasFile(row) {
  return Boolean(
    firstValue(row, ["file_url", "file_path", "storage_key", "filename", "file_name"], "")
  );
}

function formatDate(value) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeDocuments(payload) {
  const root = payload?.data ?? payload;

  const candidates = [
    root?.items,
    root?.documents,
    root?.rows,
    root?.data?.items,
    root?.data?.documents,
    root?.data?.rows,
    root?.data,
    root,
  ];

  const rows = candidates.find((candidate) => Array.isArray(candidate)) || [];

  return rows
    .map((row) => ({ ...row }))
    .filter((row) => documentId(row) || documentTitle(row));
}

function parseFilenameFromHeader(headerValue) {
  const header = String(headerValue || "");

  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const normalMatch = header.match(/filename="?([^";]+)"?/i);
  if (normalMatch?.[1]) {
    return normalMatch[1];
  }

  return "";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename || "member-document.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function getBlobWithFallback(id, action) {
  let lastError = null;

  for (const prefix of DOCUMENT_ROUTE_PREFIXES) {
    try {
      return await api.get(`${prefix}/${encodeURIComponent(id)}/${action}`, {
        responseType: "blob",
      });
    } catch (error) {
      lastError = error;

      if (![404, 405].includes(Number(error?.response?.status))) {
        break;
      }
    }
  }

  throw lastError;
}

async function postWithFallback(id, action) {
  let lastError = null;

  for (const prefix of DOCUMENT_ROUTE_PREFIXES) {
    try {
      return await api.post(`${prefix}/${encodeURIComponent(id)}/${action}`);
    } catch (error) {
      lastError = error;

      if (![404, 405].includes(Number(error?.response?.status))) {
        break;
      }
    }
  }

  throw lastError;
}

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadDocuments() {
    setLoading(true);
    setError("");
    setNotice("");

    let lastError = null;

    for (const endpoint of LIST_ENDPOINTS) {
      try {
        const response = await api.get(endpoint);
        const rows = normalizeDocuments(response.data);

        rows.sort((a, b) =>
          String(issuedDate(b) || "").localeCompare(String(issuedDate(a) || ""))
        );

        setDocuments(rows);
        setLoading(false);
        return;
      } catch (loadError) {
        lastError = loadError;

        if (![404, 405].includes(Number(loadError?.response?.status))) {
          break;
        }
      }
    }

    console.error("Unable to load member documents:", lastError);
    setDocuments([]);
    setError(
      lastError?.response?.data?.error ||
        lastError?.response?.data?.message ||
        "Unable to load documents."
    );
    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  const typeOptions = useMemo(() => {
    const values = new Set();

    documents.forEach((doc) => {
      const value = normalizeText(documentType(doc));
      if (value) values.add(value);
    });

    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents.filter((doc) => {
      const status = normalizeStatus(firstValue(doc, ["status"], "available"));
      const type = normalizeText(documentType(doc));

      if (typeFilter && type !== typeFilter) return false;
      if (statusFilter && status !== statusFilter) return false;

      if (!query) return true;

      const haystack = [
        documentTitle(doc),
        documentType(doc),
        documentReference(doc),
        uploadedBy(doc),
        fileName(doc),
        firstValue(doc, ["notes", "description", "summary"], ""),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [documents, search, typeFilter, statusFilter]);

  const summary = useMemo(() => {
    const available = documents.filter(
      (doc) => normalizeStatus(firstValue(doc, ["status"], "available")) === "available"
    ).length;

    const pending = documents.filter(
      (doc) => normalizeStatus(firstValue(doc, ["status"], "")) === "pending"
    ).length;

    const archived = documents.filter(
      (doc) => normalizeStatus(firstValue(doc, ["status"], "")) === "archived"
    ).length;

    return {
      total: documents.length,
      available,
      pending,
      archived,
    };
  }, [documents]);

  async function openDocument(row) {
    const id = documentId(row);

    if (!id) {
      setError("Document ID is missing.");
      return;
    }

    try {
      setActionLoading(`view-${id}`);
      setError("");
      setNotice("");

      const response = await getBlobWithFallback(id, "view");
      const blob = new Blob([response.data], {
        type: response.headers?.["content-type"] || "application/pdf",
      });

      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");

      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (viewError) {
      console.error("Unable to open document:", viewError);
      setError(
        viewError?.response?.data?.error ||
          viewError?.response?.data?.message ||
          "Unable to open this document."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function downloadDocument(row) {
    const id = documentId(row);

    if (!id) {
      setError("Document ID is missing.");
      return;
    }

    try {
      setActionLoading(`download-${id}`);
      setError("");
      setNotice("");

      const response = await getBlobWithFallback(id, "download");
      const contentType =
        response.headers?.["content-type"] || "application/octet-stream";

      const blob = new Blob([response.data], { type: contentType });

      const headerName = parseFilenameFromHeader(
        response.headers?.["content-disposition"]
      );

      downloadBlob(blob, headerName || fileName(row));
    } catch (downloadError) {
      console.error("Unable to download document:", downloadError);
      setError(
        downloadError?.response?.data?.error ||
          downloadError?.response?.data?.message ||
          "Unable to download this document."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function emailDocument(row) {
    const id = documentId(row);

    if (!id) {
      setError("Document ID is missing.");
      return;
    }

    try {
      setActionLoading(`email-${id}`);
      setError("");
      setNotice("");

      try {
        await postWithFallback(id, "email");
      } catch (firstError) {
        if (![404, 405].includes(Number(firstError?.response?.status))) {
          throw firstError;
        }

        await postWithFallback(id, "resend-email");
      }

      setNotice("Document email sent successfully.");
    } catch (emailError) {
      console.error("Unable to email document:", emailError);
      setError(
        emailError?.response?.data?.error ||
          emailError?.response?.data?.message ||
          "Unable to email this document."
      );
    } finally {
      setActionLoading("");
    }
  }

  const isEmpty = !loading && filteredDocuments.length === 0;

  return (
    <main className="member-documents-page">
      <section className="member-doc-hero">
        <div>
          <span className="member-doc-eyebrow">Member Document Center</span>
          <h1 className="member-doc-title">Official Documents</h1>
          <p className="member-doc-subtitle">
            Documents uploaded by the admin team appear here automatically for
            secure viewing, download, and email delivery.
          </p>
        </div>

        <div className="member-doc-hero-actions">
          <button
            type="button"
            className="member-doc-btn member-doc-button"
            onClick={loadDocuments}
            disabled={loading}
          >
            <RefreshCcw size={16} className={loading ? "member-doc-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <div className="member-doc-alert member-doc-alert-error">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="member-doc-alert member-doc-alert-success">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      ) : null}

      <section className="member-doc-summary-grid">
        <article className="member-doc-summary-card">
          <FileText size={18} />
          <span>Total Documents</span>
          <strong>{summary.total}</strong>
          <small>Attached to your profile</small>
        </article>

        <article className="member-doc-summary-card">
          <CheckCircle2 size={18} />
          <span>Available</span>
          <strong>{summary.available}</strong>
          <small>Ready to view or download</small>
        </article>

        <article className="member-doc-summary-card">
          <Clock size={18} />
          <span>Pending</span>
          <strong>{summary.pending}</strong>
          <small>Processing or review</small>
        </article>

        <article className="member-doc-summary-card">
          <Archive size={18} />
          <span>Archived</span>
          <strong>{summary.archived}</strong>
          <small>Expired or archived records</small>
        </article>
      </section>

      <section className="member-doc-toolbar">
        <label className="member-doc-search">
          <Search size={18} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, type, certificate number, or notes..."
          />
        </label>

        <label className="member-doc-select">
          <Filter size={16} />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="">All Types</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {pretty(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="member-doc-select">
          <ShieldCheck size={16} />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="pending">Pending</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </section>

      <section className="member-doc-section">
        <div className="member-doc-section-header">
          <div>
            <h2>Official Documents</h2>
            <p>Documents uploaded by the admin team appear here automatically.</p>
          </div>

          <span className="member-doc-count">
            {filteredDocuments.length} shown
          </span>
        </div>

        <div className="member-doc-table-wrap">
          <table className="member-doc-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Uploaded By</th>
                <th>Issued</th>
                <th>Status</th>
                <th>File</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="member-doc-loading">
                      <RefreshCcw size={18} className="member-doc-spin" />
                      Loading documents...
                    </div>
                  </td>
                </tr>
              ) : null}

              {isEmpty ? (
                <tr>
                  <td colSpan={8}>
                    <div className="member-doc-empty">
                      <FileBadge size={46} />
                      <h3>No documents found</h3>
                      <p>
                        When the admin team attaches a document to your profile,
                        it will appear here for viewing and download.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading
                ? filteredDocuments.map((doc) => {
                    const id = documentId(doc);
                    const status = normalizeStatus(
                      firstValue(doc, ["status"], "available")
                    );
                    const disabled = Boolean(actionLoading);

                    return (
                      <tr key={id || `${documentTitle(doc)}-${issuedDate(doc)}`}>
                        <td>
                          <div className="member-doc-cell-title">
                            <span className="member-doc-file-icon">
                              <FileBadge size={18} />
                            </span>

                            <div>
                              <strong>{documentTitle(doc)}</strong>
                              <small>{fileName(doc)}</small>
                            </div>
                          </div>
                        </td>

                        <td>{pretty(documentType(doc))}</td>
                        <td>{documentReference(doc)}</td>
                        <td>{uploadedBy(doc)}</td>

                        <td>
                          <span className="member-doc-date">
                            <CalendarDays size={14} />
                            {formatDate(issuedDate(doc))}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`member-doc-badge member-doc-badge-${status}`}
                          >
                            {statusIcon(status)}
                            {statusLabel(status)}
                          </span>
                        </td>

                        <td>{hasFile(doc) ? "Attached" : "Available"}</td>

                        <td>
                          <div className="member-doc-row-actions">
                            <button
                              type="button"
                              className="member-doc-action-btn"
                              onClick={() => openDocument(doc)}
                              disabled={disabled}
                            >
                              <Eye size={15} />
                              View
                            </button>

                            <button
                              type="button"
                              className="member-doc-action-btn"
                              onClick={() => downloadDocument(doc)}
                              disabled={disabled}
                            >
                              <Download size={15} />
                              Download
                            </button>

                            <button
                              type="button"
                              className="member-doc-action-btn"
                              onClick={() => emailDocument(doc)}
                              disabled={disabled}
                            >
                              <Mail size={15} />
                              Email
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}