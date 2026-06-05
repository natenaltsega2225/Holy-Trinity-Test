//backend\utils\pdfGenerator.js
"use strict";

const PDFDocument = require("pdfkit");

const {
  getCertificateTemplate,
} = require("../templates/certificateTemplates");

function safeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

async function generateCertificatePDF({
  outputStream,
  payload,
}) {

  return new Promise((resolve, reject) => {

    try {

      const template =
        getCertificateTemplate(
          payload.type
        );

      const doc = new PDFDocument({
        size: "LETTER",
        layout: "landscape",
        margin: 0,
      });

      doc.pipe(outputStream);

      const pageWidth =
        doc.page.width;

      const pageHeight =
        doc.page.height;

      /* =========================================
         BACKGROUND
      ========================================= */

      doc
        .rect(
          0,
          0,
          pageWidth,
          pageHeight
        )
        .fill("#f5d7c8");

      doc
        .rect(
          18,
          18,
          pageWidth - 36,
          pageHeight - 36
        )
        .fill("#fffdf9");

      doc
        .lineWidth(2)
        .strokeColor("#d8d2c8");

      doc
        .rect(
          34,
          34,
          pageWidth - 68,
          pageHeight - 68
        )
        .stroke();

      /* =========================================
         HEADER
      ========================================= */

      doc
        .fillColor("#9a6b00")
        .font("Times-Bold")
        .fontSize(28);

      doc.text("✟", 0, 42, {
        align: "center",
      });

      doc
        .fillColor("#8f5b25")
        .font("Times-Roman")
        .fontSize(13);

      doc.text(
        safeText(
          payload.churchName,
          "Holy Trinity Ethiopian Orthodox Church"
        ),
        0,
        78,
        {
          align: "center",
          characterSpacing: 2,
        }
      );

      doc
        .fillColor("#6a645c")
        .font("Times-Roman")
        .fontSize(11);

      doc.text(
        safeText(
          payload.address,
          "Nashville, TN"
        ),
        0,
        98,
        {
          align: "center",
        }
      );

      /* =========================================
         TITLE
      ========================================= */

      doc
        .fillColor("#24211c")
        .font("Times-Roman")
        .fontSize(34);

      doc.text(
        template.title.toUpperCase(),
        0,
        126,
        {
          align: "center",
        }
      );

      doc
        .fillColor("#ed7e59")
        .font("Times-Roman")
        .fontSize(20);

      doc.text(
        template.subtitle,
        0,
        170,
        {
          align: "center",
          characterSpacing: 1,
        }
      );

      /* =========================================
         PRESENTED TO
      ========================================= */

      doc
        .fillColor("#54504a")
        .font("Times-Roman")
        .fontSize(11);

      doc.text(
        "THIS CERTIFICATE IS PRESENTED TO",
        0,
        212,
        {
          align: "center",
          characterSpacing: 1.2,
        }
      );

      doc
        .fillColor("#17365f")
        .font("Times-Bold")
        .fontSize(24);

      doc.text(
        safeText(
          payload.recipientName,
          "Member Name"
        ),
        0,
        244,
        {
          align: "center",
        }
      );

      doc
        .strokeColor("#70685f")
        .lineWidth(1);

      doc
        .moveTo(86, 302)
        .lineTo(
          pageWidth - 86,
          302
        )
        .stroke();

      /* =========================================
         BODY
      ========================================= */

      doc
        .fillColor("#403c37")
        .font("Times-Roman")
        .fontSize(14);

      const bodyText =
        buildCertificateBody(payload);

      doc.text(
        bodyText,
        110,
        330,
        {
          width: pageWidth - 220,
          align: "center",
          lineGap: 5,
        }
      );

      /* =========================================
         SEAL
      ========================================= */

      const sealX =
        pageWidth / 2;

      const sealY = 485;

      doc
        .circle(
          sealX,
          sealY,
          52
        )
        .fillAndStroke(
          "#d8af48",
          "#d5b056"
        );

      doc
        .circle(
          sealX,
          sealY,
          45
        )
        .lineWidth(2)
        .strokeColor("#a97b18")
        .stroke();

      doc
        .fillColor("#7b5300")
        .font("Times-Bold")
        .fontSize(22);

      doc.text(
        "✟",
        sealX - 8,
        sealY - 13
      );

      /* =========================================
         FOOTER
      ========================================= */

      doc
        .strokeColor("#7c736b")
        .lineWidth(1);

      doc
        .moveTo(72, 538)
        .lineTo(212, 538)
        .stroke();

      doc
        .moveTo(
          pageWidth - 212,
          538
        )
        .lineTo(
          pageWidth - 72,
          538
        )
        .stroke();

      doc
        .fillColor("#d17f65")
        .font("Times-Roman")
        .fontSize(13);

      doc.text(
        safeText(
          payload.issuedBy,
          "Church Administrator"
        ),
        42,
        548,
        {
          width: 200,
          align: "center",
        }
      );

      doc.text(
        `Date: ${safeText(
          payload.dateIssued,
          "________________"
        )}`,
        pageWidth - 232,
        548,
        {
          width: 180,
          align: "center",
        }
      );

      doc.end();

      outputStream.on(
        "finish",
        resolve
      );

      outputStream.on(
        "error",
        reject
      );

    } catch (error) {
      reject(error);
    }
  });
}

function buildCertificateBody(
  payload
) {

  switch (payload.type) {

    case "volunteer_certificate":
      return `
In grateful recognition of faithfully completing
${safeText(payload.totalHours, "0")} volunteer hours
in service to the Church community.

This service has been recognized at the level of
${safeText(payload.recognitionLevel, "Bronze")}.
`;

    case "baptism_certificate":
      return `
According to the sacred teachings and traditions
of the Ethiopian Orthodox Tewahedo Church,
this member has officially received the
Holy Sacrament of Baptism.
`;

    case "marriage_certificate":
      return `
This certifies that the Holy Sacrament of Marriage
has been administered according to the teachings
and traditions of the Ethiopian Orthodox Tewahedo Church.
`;

    case "engagement_certificate":
      return `
This certifies that the sacred engagement blessing
has been administered according to the traditions
of the Ethiopian Orthodox Tewahedo Church.
`;

    case "participation_certificate":
      return `
Awarded in recognition of faithful participation
and active involvement in Church programs and ministries.
`;

    case "recognition_certificate":
      return `
Presented in appreciation of exceptional dedication,
leadership, and service to the Church community.
`;

    default:
      return `
Official Church Certificate
`;
  }
}

module.exports = {
  generateCertificatePDF,
};