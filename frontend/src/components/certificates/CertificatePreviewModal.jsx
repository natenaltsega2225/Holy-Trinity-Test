// //frontend\src\components\certificates\CertificatePreviewModal.jsx
// import React from "react";

// import {
//   Download,
//   Printer,
//   X,
// } from "lucide-react";

// import CertificateRenderer
//   from "./CertificateRenderer";

// import {
//   generateCertificatePdf,
// } from "../../utils/generateCertificatePdf";

// import "../../styles/certificate-preview-modal.css";

// /* =========================================================
//    CERTIFICATE PREVIEW MODAL
// ========================================================= */

// export default function CertificatePreviewModal({
//   open = false,
//   onClose,
//   type,
//   data = {},
// }) {

//   if (!open) return null;

//   /* =====================================================
//      DOWNLOAD
//   ===================================================== */

//   async function handleDownload() {

//     try {

//       const safeType =
//         type || "certificate";

//       const safeName =
//         (
//           data?.fullName ||
//           data?.recipientName ||
//           data?.participantName ||
//           data?.volunteerName ||
//           data?.baptizedName ||
//           data?.groomName ||
//           "document"
//         )
//           .replace(/\s+/g, "-")
//           .toLowerCase();

//       await generateCertificatePdf({

//         elementId:
//           "certificate-preview-content",

//         filename:
//           `${safeType}-${safeName}.pdf`,
//       });

//     } catch (err) {

//       console.error(err);

//       alert(
//         "Failed to generate PDF."
//       );
//     }
//   }

//   /* =====================================================
//      PRINT
//   ===================================================== */

//   function handlePrint() {

//     window.print();
//   }

//   /* =====================================================
//      UI
//   ===================================================== */

//   return (

//     <div
//       className="cert-modal-overlay"
//       onClick={onClose}
//     >

//       <div
//         className="cert-modal-container"
//         onClick={(e) =>
//           e.stopPropagation()
//         }
//       >

//         {/* =========================================
//            HEADER
//         ========================================== */}

//         <div className="cert-modal-header">

//           <div className="cert-modal-title-wrap">

//             <span className="cert-modal-badge">

//               Official Church Document

//             </span>

//             <h2>
//               Certificate Preview
//             </h2>

//             <p>
//               Production-ready certificate
//               rendering optimized for
//               download, printing,
//               archival, and member delivery.
//             </p>

//           </div>

//           <div className="cert-modal-actions">

//             <button
//               type="button"
//               className="cert-modal-download"
//               onClick={handleDownload}
//             >

//               <Download size={18} />

//               Download PDF

//             </button>

//             <button
//               type="button"
//               className="cert-modal-print"
//               onClick={handlePrint}
//             >

//               <Printer size={18} />

//               Print

//             </button>

//             <button
//               type="button"
//               className="cert-modal-close"
//               onClick={onClose}
//             >

//               <X size={20} />

//             </button>

//           </div>

//         </div>

//         {/* =========================================
//            BODY
//         ========================================== */}

//         <div className="cert-modal-body">

//           <div className="cert-modal-paper">

//             <div
//               id="certificate-preview-content"
//               className="cert-modal-certificate"
//             >

//               <CertificateRenderer
//                 type={type}
//                 data={data}
//               />

//             </div>

//           </div>

//         </div>

//       </div>

//     </div>
//   );
// }

// frontend/src/components/certificates/CertificatePreviewModal.jsx

import React from "react";

import {
  Download,
  Printer,
  X,
} from "lucide-react";

import CertificateRenderer from "./CertificateRenderer";

import {
  generateCertificatePdf,
} from "../../utils/generateCertificatePdf";

import "../../styles/certificate-preview-modal.css";

/* =========================================================
   MODAL
========================================================= */

export default function CertificatePreviewModal({
  open = false,
  onClose,
  type,
  data = {},
}) {

  if (!open) return null;

  /* =======================================================
     DOWNLOAD
  ======================================================= */

  async function handleDownload() {

    try {

      const safeType =
        type || "certificate";

      const safeName =
        (
          data?.recipientName ||
          data?.fullName ||
          "document"
        )
          .replace(/\s+/g, "-")
          .toLowerCase();

      await generateCertificatePdf({

        elementId:
          "certificate-preview-content",

        filename:
          `${safeType}-${safeName}.pdf`,
      });

    } catch (err) {

      console.error(err);

      alert(
        "Failed to generate PDF."
      );
    }
  }

  /* =======================================================
     PRINT
  ======================================================= */

  function handlePrint() {

    window.print();
  }

  /* =======================================================
     UI
  ======================================================= */

  return (

    <div
      className="cert-preview-overlay"
      onClick={onClose}
    >

      <div
        className="cert-preview-container"
        onClick={(e) =>
          e.stopPropagation()
        }
      >

        {/* =================================================
           HEADER
        ================================================= */}

        <div className="cert-preview-header">

          <div>

            <h2>
              Certificate Preview
            </h2>

            <p>
              Enterprise church
              certificate preview,
              print, and PDF export.
            </p>

          </div>

          <div className="cert-preview-actions">

            <button
              type="button"
              className="cert-preview-btn cert-preview-download"
              onClick={
                handleDownload
              }
            >

              <Download size={18} />

              Download PDF

            </button>

            <button
              type="button"
              className="cert-preview-btn cert-preview-print"
              onClick={
                handlePrint
              }
            >

              <Printer size={18} />

              Print

            </button>

            <button
              type="button"
              className="cert-preview-close"
              onClick={onClose}
            >

              <X size={20} />

            </button>

          </div>

        </div>

        {/* =================================================
           BODY
        ================================================= */}

        <div className="cert-preview-body">

          <div className="cert-preview-scale">

            <div
              id="certificate-preview-content"
            >

              <CertificateRenderer
                type={type}
                data={data}
              />

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
