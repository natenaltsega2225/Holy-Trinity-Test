// // frontend/src/utils/generateCertificatePdf.js
// import html2canvas from "html2canvas";
// import jsPDF from "jspdf";

// /* =========================================================
//    ENTERPRISE CERTIFICATE PDF GENERATOR
// ========================================================= */

// export async function generateCertificatePdf({
//   elementId = "certificate-preview-content",
//   filename = "certificate.pdf",
// } = {}) {

//   try {

//     const element =
//       document.getElementById(elementId);

//     if (!element) {
//       throw new Error(
//         "Certificate preview element not found."
//       );
//     }

//     if (document.fonts?.ready) {
//       await document.fonts.ready;
//     }

//     /* =====================================================
//        REMOVE SCALE TRANSFORM
//     ===================================================== */

//     const previewScale =
//       element.closest(".cert-preview-scale");

//     const oldTransform =
//       previewScale?.style?.transform || "";

//     if (previewScale) {
//       previewScale.style.transform = "none";
//     }

//     await new Promise((r) =>
//       setTimeout(r, 300)
//     );

//     /* =====================================================
//        CANVAS
//     ===================================================== */

//     const canvas =
//       await html2canvas(element, {

//         scale: 3,

//         useCORS: true,

//         allowTaint: true,

//         backgroundColor: "#ffffff",

//         logging: false,

//         imageTimeout: 30000,

//         removeContainer: true,

//         foreignObjectRendering: false,
//       });

//     const imageData =
//       canvas.toDataURL(
//         "image/png",
//         1.0
//       );

//     const pdf =
//       new jsPDF({

//         orientation:
//           canvas.width > canvas.height
//             ? "landscape"
//             : "portrait",

//         unit: "px",

//         format: [
//           canvas.width,
//           canvas.height,
//         ],
//       });

//     pdf.addImage(
//       imageData,
//       "PNG",
//       0,
//       0,
//       canvas.width,
//       canvas.height,
//       undefined,
//       "FAST"
//     );

//     pdf.save(filename);

//     /* =====================================================
//        RESTORE SCALE
//     ===================================================== */

//     if (previewScale) {
//       previewScale.style.transform =
//         oldTransform;
//     }

//     return true;

//   } catch (err) {

//     console.error(
//       "generateCertificatePdf error:",
//       err
//     );

//     throw err;
//   }
// }

// frontend/src/utils/generateCertificatePdf.js

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/* =========================================================
   ENTERPRISE CERTIFICATE PDF GENERATOR
========================================================= */

export async function generateCertificatePdf({

  elementId =
    "certificate-preview-content",

  filename =
    "certificate.pdf",

} = {}) {

  try {

    /* =====================================================
       ELEMENT
    ===================================================== */

    const element =
      document.getElementById(
        elementId
      );

    if (!element) {

      throw new Error(
        "Certificate preview element not found."
      );
    }

    /* =====================================================
       WAIT FOR FONTS
    ===================================================== */

    if (
      document.fonts?.ready
    ) {

      await document.fonts.ready;
    }

    /* =====================================================
       REMOVE PREVIEW SCALE
    ===================================================== */

    const previewScale =
      element.closest(
        ".cert-preview-scale"
      );

    const oldTransform =
      previewScale?.style
        ?.transform || "";

    if (previewScale) {

      previewScale.style.transform =
        "none";
    }

    /* =====================================================
       WAIT FOR DOM
    ===================================================== */

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          300
        )
    );

    /* =====================================================
       DIMENSIONS
    ===================================================== */

    const width =
      element.scrollWidth;

    const height =
      element.scrollHeight;

    /* =====================================================
       CANVAS
    ===================================================== */

    const canvas =
      await html2canvas(
        element,
        {

          scale: 3,

          useCORS: true,

          allowTaint: true,

          backgroundColor:
            "#ffffff",

          logging: false,

          imageTimeout:
            30000,

          removeContainer:
            true,

          foreignObjectRendering:
            false,

          width,

          height,

          windowWidth:
            width,

          windowHeight:
            height,

          scrollX: 0,

          scrollY: 0,
        }
      );

    /* =====================================================
       IMAGE
    ===================================================== */

    const imageData =
      canvas.toDataURL(
        "image/png",
        1.0
      );

    /* =====================================================
       PDF
    ===================================================== */

    const pdf =
      new jsPDF({

        orientation:
          canvas.width >
          canvas.height
            ? "landscape"
            : "portrait",

        unit: "px",

        format: [
          canvas.width,
          canvas.height,
        ],

        compress: true,

        hotfixes: [
          "px_scaling",
        ],
      });

    /* =====================================================
       ADD IMAGE
    ===================================================== */

    pdf.addImage(

      imageData,

      "PNG",

      0,
      0,

      canvas.width,
      canvas.height,

      undefined,

      "FAST"
    );

    /* =====================================================
       PDF META
    ===================================================== */

    pdf.setProperties({

      title:
        "Official Church Certificate",

      subject:
        "Church Certificate",

      author:
        "Holy Trinity Ethiopian Orthodox Tewahedo Church",

      creator:
        "Enterprise Certificate System",
    });

    /* =====================================================
       SAVE
    ===================================================== */

    pdf.save(filename);

    /* =====================================================
       RESTORE SCALE
    ===================================================== */

    if (previewScale) {

      previewScale.style.transform =
        oldTransform;
    }

    return true;

  } catch (err) {

    console.error(
      "generateCertificatePdf error:",
      err
    );

    throw err;
  }
}