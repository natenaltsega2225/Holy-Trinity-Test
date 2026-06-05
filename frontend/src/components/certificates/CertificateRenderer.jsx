// // frontend/src/components/certificates/CertificateRenderer.jsx

// import React from "react";

// import VolunteerCertificateTemplate from "./VolunteerCertificateTemplate";
// import BaptismCertificateTemplate from "./BaptismCertificateTemplate";
// import MarriageCertificateTemplate from "./MarriageCertificateTemplate";
// import EngagementCertificateTemplate from "./EngagementCertificateTemplate";
// import ParticipationCertificateTemplate from "./ParticipationCertificateTemplate";
// import RecognitionCertificateTemplate from "./RecognitionCertificateTemplate";

// export const CERTIFICATE_TYPES = [

//   {
//     value: "volunteer_certificate",
//     label: "Volunteer Certificate",
//   },

//   {
//     value: "baptism_certificate",
//     label: "Baptism Certificate",
//   },

//   {
//     value: "engagement_certificate",
//     label: "Engagement Certificate",
//   },

//   {
//     value: "marriage_certificate",
//     label: "Marriage Certificate",
//   },

//   {
//     value: "participation_certificate",
//     label: "Participation Certificate",
//   },

//   {
//     value: "recognition_certificate",
//     label: "Recognition Certificate",
//   },

// ];

// export function getCertificateLabel(type) {

//   const match = CERTIFICATE_TYPES.find(
//     (item) => item.value === type
//   );

//   return match?.label || "Certificate";
// }

// export default function CertificateRenderer({
//   type,
//   data = {},
// }) {

//   switch (type) {

//     case "volunteer_certificate":
//       return (
//         <VolunteerCertificateTemplate
//           volunteerName={
//             data.volunteerName ||
//             data.recipientName ||
//             data.fullName
//           }
//           totalHours={data.totalHours}
//           recognitionLevel={data.recognitionLevel}
//           dateIssued={data.dateIssued}
//           churchName={data.churchName}
//           address={data.address}
//         />
//       );

//     case "baptism_certificate":
//       return (
//         <BaptismCertificateTemplate
//           baptizedName={
//             data.baptizedName ||
//             data.fullName ||
//             data.recipientName
//           }
//           christianName={data.christianName}
//           fatherName={data.fatherName}
//           motherName={data.motherName}
//           baptismDate={data.baptismDate}
//           priestName={data.priestName}
//           churchName={data.churchName}
//           certificateNumber={data.certificateNumber}
//           location={data.location}
//         />
//       );

//     case "engagement_certificate":
//       return (
//         <EngagementCertificateTemplate
//           groomName={data.groomName}
//           brideName={data.brideName}
//           engagementDate={data.engagementDate}
//           priestName={data.priestName}
//           churchName={data.churchName}
//           certificateNumber={data.certificateNumber}
//           location={data.location}
//         />
//       );

//     case "marriage_certificate":
//       return (
//         <MarriageCertificateTemplate
//           groomName={data.groomName}
//           brideName={data.brideName}
//           marriageDate={data.marriageDate}
//           priestName={data.priestName}
//           churchName={data.churchName}
//           certificateNumber={data.certificateNumber}
//           location={data.location}
//         />
//       );

//     case "participation_certificate":
//       return (
//         <ParticipationCertificateTemplate
//           participantName={
//             data.participantName ||
//             data.fullName
//           }
//           eventName={data.eventName}
//           eventDate={data.eventDate}
//           issuedDate={data.issuedDate}
//           administratorName={data.administratorName}
//           churchName={data.churchName}
//           certificateNumber={data.certificateNumber}
//           location={data.location}
//         />
//       );

//     case "recognition_certificate":
//       return (
//         <RecognitionCertificateTemplate
//           recipientName={
//             data.recipientName ||
//             data.fullName
//           }
//           recognitionTitle={data.recognitionTitle}
//           recognitionReason={data.recognitionReason}
//           recognitionLevel={data.recognitionLevel}
//           issuedDate={data.issuedDate}
//           administratorName={data.administratorName}
//           churchName={data.churchName}
//           certificateNumber={data.certificateNumber}
//           location={data.location}
//         />
//       );

//     default:
//       return (
//         <div
//           style={{
//             padding: 40,
//             textAlign: "center",
//             color: "#64748b",
//             fontSize: 18,
//             fontWeight: 600,
//           }}
//         >
//           Unsupported certificate type:
//           {" "}
//           {String(type)}
//         </div>
//       );
//   }
// }


// frontend/src/components/certificates/CertificateRenderer.jsx

import React from "react";

import "../../styles/enterprise-certificate.css";

/* =========================================================
   HELPERS
========================================================= */

function safe(
  value,
  fallback = "—"
) {

  return String(
    value ?? ""
  ).trim() || fallback;
}

function prettyType(
  type = ""
) {

  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) =>
      m.toUpperCase()
    );
}

/* =========================================================
   MAIN
========================================================= */

export default function CertificateRenderer({
  type,
  data = {},
}) {

  const isMarriage =
    type ===
      "marriage_certificate" ||
    type ===
      "engagement_certificate";

  return (

    <div className="ec-root">

      {/* ===================================================
         WATERMARK
      =================================================== */}

      <div className="ec-watermark">

        ✠

      </div>

      {/* ===================================================
         BORDER
      =================================================== */}

      <div className="ec-border" />

      <div className="ec-inner-border" />

      {/* ===================================================
         HEADER
      =================================================== */}

      <div className="ec-header">

        <div className="ec-church-name">

          {safe(
            data.churchName,
            "Holy Trinity Ethiopian Orthodox Tewahedo Church"
          )}

        </div>

        <div className="ec-location">

          {safe(
            data.location,
            "Nashville, Tennessee"
          )}

        </div>

        <div className="ec-title">

          {prettyType(type)}

        </div>

        <div className="ec-subtitle">

          Official Church Certificate

        </div>

      </div>

      {/* ===================================================
         BODY
      =================================================== */}

      <div className="ec-body">

        <div className="ec-intro">

          This certifies that

        </div>

        <div className="ec-recipient">

          {isMarriage
            ? `${safe(
                data.recipientName
              )} & ${safe(
                data.brideName
              )}`
            : safe(
                data.recipientName
              )}

        </div>

        <div className="ec-description">

          {buildDescription(
            type,
            data
          )}

        </div>

      </div>

      {/* ===================================================
         META
      =================================================== */}

      <div className="ec-meta-grid">

        <MetaCard
          label="Issue Date"
          value={safe(
            data.issueDate
          )}
        />

        <MetaCard
          label="Priest"
          value={safe(
            data.priestName
          )}
        />

        {type ===
          "volunteer_certificate" && (

          <MetaCard
            label="Volunteer Hours"
            value={safe(
              data.volunteerHours,
              "0"
            )}
          />
        )}

        {type ===
          "recognition_certificate" && (

          <MetaCard
            label="Recognition"
            value={safe(
              data.recognitionLevel
            )}
          />
        )}

        {type ===
          "baptism_certificate" && (

          <>
            <MetaCard
              label="Christian Name"
              value={safe(
                data.christianName
              )}
            />

            <MetaCard
              label="Baptism Date"
              value={safe(
                data.baptismDate
              )}
            />
          </>
        )}

      </div>

      {/* ===================================================
         FOOTER
      =================================================== */}

      <div className="ec-footer">

        <div className="ec-sign-wrap">

          <div className="ec-sign-line" />

          <div className="ec-sign-name">

            {safe(
              data.priestName
            )}

          </div>

          <div className="ec-sign-title">

            Church Priest

          </div>

        </div>

        <div className="ec-seal">

          ✠

        </div>

        <div className="ec-sign-wrap">

          <div className="ec-sign-line" />

          <div className="ec-sign-name">

            Church Administration

          </div>

          <div className="ec-sign-title">

            {safe(
              data.issueDate
            )}

          </div>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   DESCRIPTION
========================================================= */

function buildDescription(
  type,
  data
) {

  switch (type) {

    case "baptism_certificate":

      return `
This certifies that the individual named above has faithfully received the Holy Sacrament of Baptism according to the sacred apostolic teachings and traditions of the Ethiopian Orthodox Tewahedo Church.
      `;

    case "marriage_certificate":

      return `
This certificate officially recognizes the sacred union of marriage solemnized before God, the Holy Church, family, and witnesses according to the sacramental traditions of the Ethiopian Orthodox Tewahedo Church.
      `;

    case "engagement_certificate":

      return `
Official recognition and blessing of Holy Engagement granted under the guidance and traditions of the Ethiopian Orthodox Tewahedo Church.
      `;

    case "volunteer_certificate":

      return `
Awarded in recognition of faithful volunteer ministry, dedicated service, and contribution toward church and community activities.
      `;

    case "recognition_certificate":

      return `
Presented in recognition of outstanding dedication, faithful service, and exceptional contribution to the church community.
      `;

    default:

      return `
Official church certificate document issued by the Ethiopian Orthodox Tewahedo Church.
      `;
  }
}

/* =========================================================
   META CARD
========================================================= */

function MetaCard({
  label,
  value,
}) {

  return (

    <div className="ec-meta-card">

      <div className="ec-meta-label">

        {label}

      </div>

      <div className="ec-meta-value">

        {value}

      </div>

    </div>
  );
}