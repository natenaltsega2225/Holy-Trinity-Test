

// // backend/services/certificateHtmlService.js

// "use strict";

// /* =========================================================
//    ENTERPRISE CERTIFICATE HTML SERVICE
//    HTML + CSS template engine for Puppeteer PDF rendering
// ========================================================= */

// /* =========================================================
//    HELPERS
// ========================================================= */

// function esc(value = "") {
//   return String(value ?? "")
//     .replaceAll("&", "&amp;")
//     .replaceAll("<", "&lt;")
//     .replaceAll(">", "&gt;")
//     .replaceAll('"', "&quot;")
//     .replaceAll("'", "&#039;");
// }

// function titleCase(value = "") {
//   return String(value || "certificate")
//     .replaceAll("_", " ")
//     .replace(/\b\w/g, (m) => m.toUpperCase());
// }

// function formatDate(value) {
//   if (!value) return "—";

//   const date = new Date(value);

//   if (Number.isNaN(date.getTime())) {
//     return String(value);
//   }

//   return date.toLocaleDateString("en-US", {
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//   });
// }

// function compact(value, fallback = "—") {
//   return String(value ?? "").trim() || fallback;
// }

// function signatureText(value = "") {
//   return compact(value, "Church Administration");
// }

// /* =========================================================
//    NORMALIZE DATA
// ========================================================= */

// function normalizeCertificateData(type, payload = {}, member = {}) {
//   const husbandName =
//     payload.husbandName ||
//     payload.groomName ||
//     payload.recipientName ||
//     member.full_name ||
//     "";

//   const wifeName =
//     payload.wifeName ||
//     payload.brideName ||
//     payload.secondaryName ||
//     "";

//   const recipientName =
//     payload.recipientName ||
//     payload.fullName ||
//     payload.baptizedName ||
//     payload.volunteerName ||
//     payload.participantName ||
//     husbandName ||
//     member.full_name ||
//     "Recipient Name";

//   const secondaryName =
//     payload.secondaryName ||
//     payload.wifeName ||
//     payload.brideName ||
//     "";

//   return {
//     type,

//     title: titleCase(type),

//     churchName:
//       payload.churchName ||
//       "Holy Trinity Ethiopian Orthodox Tewahedo Church",

//     location:
//       payload.location ||
//       payload.address ||
//       "Nashville, Tennessee",

//     recipientName,

//     secondaryName,

//     husbandName,

//     wifeName,

//     certificateNumber:
//       payload.certificateNumber ||
//       `HT-${Date.now()}`,

//     priestName:
//       payload.priestName ||
//       payload.authorizedBy ||
//       "Church Administration",

//     administratorName:
//       payload.administratorName ||
//       payload.adminName ||
//       "Church Administration",

//     issuedDate:
//       payload.issueDate ||
//       payload.issuedDate ||
//       payload.dateIssued ||
//       new Date().toISOString().slice(0, 10),

//     eventDate:
//       payload.eventDate ||
//       payload.marriageDate ||
//       payload.engagementDate ||
//       payload.baptismDate ||
//       payload.completionDate ||
//       "",

//     christianName:
//       payload.christianName || "",

//     fatherName:
//       payload.fatherName || "",

//     motherName:
//       payload.motherName || "",

//     godFatherName:
//       payload.godFatherName || "",

//     godMotherName:
//       payload.godMotherName || "",

//     dateOfBirth:
//       payload.dateOfBirth || "",

//     placeOfBirth:
//       payload.placeOfBirth || "",

//     witnessOne:
//       payload.witnessOne || "",

//     witnessTwo:
//       payload.witnessTwo || "",

//     volunteerHours:
//       payload.volunteerHours ||
//       payload.totalHours ||
//       payload.serviceHours ||
//       "0",

//     recognitionLevel:
//       payload.recognitionLevel ||
//       "Gold Recognition",

//     recognitionTitle:
//       payload.recognitionTitle ||
//       "Faithful Service",

//     recognitionReason:
//       payload.recognitionReason ||
//       "Faithful dedication and contribution to the church community.",

//     ministryDepartment:
//       payload.ministryDepartment || "",

//     servicePeriod:
//       payload.servicePeriod || "",

//     eventName:
//       payload.eventName ||
//       payload.programName ||
//       "Church Program",

//     applicantType:
//       payload.applicantType ||
//       "member",

//     externalEmail:
//       payload.externalEmail || "",

//     notes:
//       payload.notes || "",
//   };
// }

// /* =========================================================
//    CERTIFICATE TITLES
// ========================================================= */

// function certificateTitle(type) {
//   switch (type) {
//     case "baptism_certificate":
//       return "Baptism Certificate";

//     case "engagement_certificate":
//       return "Engagement Certificate";

//     case "marriage_certificate":
//       return "Marriage Certificate";

//     case "volunteer_certificate":
//       return "Volunteer Certificate";

//     case "participation_certificate":
//       return "Participation Certificate";

//     case "recognition_certificate":
//       return "Recognition Certificate";

//     default:
//       return "Official Certificate";
//   }
// }

// function certificateSubtitle(type) {
//   switch (type) {
//     case "baptism_certificate":
//       return "Certificate of Holy Baptism";

//     case "engagement_certificate":
//       return "Certificate of Holy Engagement";

//     case "marriage_certificate":
//       return "Certificate of Holy Matrimony";

//     case "volunteer_certificate":
//       return "Certificate of Volunteer Service";

//     case "participation_certificate":
//       return "Certificate of Participation";

//     case "recognition_certificate":
//       return "Certificate of Recognition";

//     default:
//       return "Official Church Certificate";
//   }
// }

// /* =========================================================
//    BODY TEXT
// ========================================================= */

// function certificateDescription(d) {
//   switch (d.type) {
//     case "baptism_certificate":
//       return `
//         is recorded as having received the Holy Sacrament of Baptism
//         according to the apostolic faith, sacred teachings, and holy
//         traditions of the Ethiopian Orthodox Tewahedo Church.
//       `;

//     case "engagement_certificate":
//       return `
//         are prayerfully recognized for their holy engagement blessing,
//         witnessed before the church community and honored according to
//         the sacred traditions of the Ethiopian Orthodox Tewahedo Church.
//       `;

//     case "marriage_certificate":
//       return `
//         are joined together in sacred matrimony before God, the Holy Church,
//         family, and witnesses according to the apostolic faith, spiritual
//         teachings, and sacramental traditions of the Ethiopian Orthodox
//         Tewahedo Church.
//       `;

//     case "volunteer_certificate":
//       return `
//         is recognized for faithful volunteer service, dedication,
//         and valuable contributions to the church and community.
//         Your commitment is deeply appreciated.
//       `;

//     case "participation_certificate":
//       return `
//         is recognized for faithful participation, commitment, and
//         contribution to church programs and ministry activities.
//       `;

//     case "recognition_certificate":
//       return `
//         is awarded in recognition of outstanding dedication, faithful service,
//         ministry participation, and exceptional contribution to the church
//         and community.
//       `;

//     default:
//       return `
//         is officially recognized by the church administration.
//       `;
//   }
// }

// /* =========================================================
//    RECIPIENT DISPLAY
// ========================================================= */

// function recipientDisplay(d) {
//   if (
//     d.type === "marriage_certificate" ||
//     d.type === "engagement_certificate"
//   ) {
//     return `
//       <span>${esc(d.husbandName || d.recipientName)}</span>
//       ${d.wifeName || d.secondaryName ? `<em>&amp;</em><span>${esc(d.wifeName || d.secondaryName)}</span>` : ""}
//     `;
//   }

//   return `<span>${esc(d.recipientName)}</span>`;
// }

// /* =========================================================
//    META ITEMS
// ========================================================= */

// function getMetaItems(d) {
//   const base = [];

//   base.push({
//     icon: "▣",
//     label: "Issue Date",
//     value: formatDate(d.issuedDate),
//   });

//   base.push({
//     icon: "✝",
//     label: "Priest",
//     value: d.priestName,
//   });

//   if (d.type === "volunteer_certificate") {
//     base.push({
//       icon: "♥",
//       label: "Volunteer Hours",
//       value: d.volunteerHours,
//     });

//     base.push({
//       icon: "★",
//       label: "Recognition",
//       value: d.recognitionLevel,
//     });
//   } else if (d.type === "recognition_certificate") {
//     base.push({
//       icon: "★",
//       label: "Recognition",
//       value: d.recognitionLevel,
//     });

//     base.push({
//       icon: "✦",
//       label: "Award",
//       value: d.recognitionTitle,
//     });
//   } else if (d.type === "baptism_certificate") {
//     base.push({
//       icon: "✝",
//       label: "Baptism Date",
//       value: formatDate(d.eventDate),
//     });

//     base.push({
//       icon: "☦",
//       label: "Christian Name",
//       value: d.christianName || "—",
//     });
//   } else if (
//     d.type === "marriage_certificate" ||
//     d.type === "engagement_certificate"
//   ) {
//     base.push({
//       icon: "✝",
//       label:
//         d.type === "marriage_certificate"
//           ? "Marriage Date"
//           : "Engagement Date",
//       value: formatDate(d.eventDate),
//     });

//   } else {
//     base.push({
//       icon: "★",
//       label: "Program",
//       value: d.eventName,
//     });

//     base.push({
//       icon: "✦",
//       label: "Location",
//       value: d.location,
//     });
//   }

//   return base;
// }

// function renderMetaItems(d) {
//   return getMetaItems(d)
//     .map(
//       (item) => `
//         <div class="detail-item">
//           <div class="detail-icon">
//             ${esc(item.icon)}
//           </div>
//           <div>
//             <div class="detail-label">
//               ${esc(item.label)}
//             </div>
//             <div class="detail-value">
//               ${esc(item.value)}
//             </div>
//           </div>
//         </div>
//       `
//     )
//     .join("");
// }

// /* =========================================================
//    EXTRA SACRAMENT DETAILS
// ========================================================= */

// function renderSupplementalDetails(d) {
//   const rows = [];

//   if (d.type === "baptism_certificate") {
//     rows.push(["Father", d.fatherName]);
//     rows.push(["Mother", d.motherName]);
//     rows.push(["God Father", d.godFatherName]);
//     rows.push(["God Mother", d.godMotherName]);
//     rows.push(["Date of Birth", formatDate(d.dateOfBirth)]);
//     rows.push(["Place of Birth", d.placeOfBirth]);
//   }

//   if (
//     d.type === "marriage_certificate" ||
//     d.type === "engagement_certificate"
//   ) {
//     rows.push(["Husband", d.husbandName || d.recipientName]);
//     rows.push(["Wife", d.wifeName || d.secondaryName]);
   
//   }

//   if (!rows.length) return "";

//   return `
//     <div class="supplemental">
//       ${rows
//         .filter(([, value]) => value)
//         .map(
//           ([label, value]) => `
//             <div class="supplemental-row">
//               <strong>${esc(label)}</strong>
//               <span>${esc(value)}</span>
//             </div>
//           `
//         )
//         .join("")}
//     </div>
//   `;
// }

// /* =========================================================
//    MAIN RENDERER
// ========================================================= */

// function renderCertificateHtml(type, payload = {}, member = {}) {
//   const d = normalizeCertificateData(type, payload, member);

//   return `<!doctype html>
// <html>
// <head>
// <meta charset="utf-8" />
// <title>${esc(certificateTitle(d.type))}</title>

// <link rel="preconnect" href="https://fonts.googleapis.com">
// <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
// <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:wght@600;700;800&family=Cinzel:wght@600;700;800&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">





// <style>
//   @page {
//     size: Letter landscape;
//     margin: 0;
//   }

//   * {
//     box-sizing: border-box;
//   }

//   html,
//   body {
//     width: 11in;
//     height: 8.5in;
//     margin: 0;
//     padding: 0;
//     background: #ffffff;
//   }

//   body {
//     font-family: "Cormorant Garamond", Georgia, serif;
//     color: #111827;
//   }

//   .page {
//     position: relative;
//     width: 11in;
//     height: 8.5in;
//     overflow: hidden;

//     background:
//       radial-gradient(
//         circle at 50% 46%,
//         rgba(242, 190, 66, 0.14),
//         transparent 38%
//       ),
//       linear-gradient(
//         135deg,
//         #fff9e8 0%,
//         #fffdf6 42%,
//         #fff4d8 100%
//       );
//   }

//   .frame-green {
//     position: absolute;
//     inset: 0.10in;
//     border: 12px solid #067a33;
//     z-index: 5;
//   }

//   .frame-yellow {
//     position: absolute;
//     inset: 0.24in;
//     border: 10px solid #f2be42;
//     z-index: 5;
//   }

//   .frame-red {
//     position: absolute;
//     inset: 0.39in;
//     border: 7px solid #d71920;
//     z-index: 5;
//   }

//   .frame-gold-thin {
//     position: absolute;
//     inset: 0.55in;
//     border: 1.5px solid rgba(180, 126, 22, 0.72);
//     z-index: 5;
//   }







// /* =========================================================
//    GENERATED HOLY TRINITY TOP LOGO
// ========================================================= */

// .top-logo {
//   position: absolute;

//   top: 0.15in;

//   left: 50%;
//   transform: translateX(-50%);

//   width: .96in;
//   height: .96in;

//   border-radius: 50%;

//   overflow: hidden;

//   z-index: 40;

//   background:
//     radial-gradient(circle at center,
//       #f4c94c 0 14%,
//       #2b2115 15% 29%,
//       transparent 30%
//     ),
//     repeating-conic-gradient(
//       from 0deg,
//       #2b2115 0deg 8deg,
//       #ffffff 8deg 16deg
//     );

//   border: 3px solid #067a33;

//   box-shadow:
//     0 0 0 3px #f2be42,
//     0 0 0 5px #d71920,
//     0 3px 10px rgba(0,0,0,.20);
// }

// /* TOP LABEL */
// .top-logo::before {
//   content: "HOLY TRINITY";

//   position: absolute;

//   top: 0;

//   left: 50%;
//   transform: translateX(-50%);

//   width: 100%;
//   height: .19in;

//   background: #d71920;

//   color: #ffffff;

//   display: flex;
//   align-items: center;
//   justify-content: center;

//   font-family: "Cinzel", serif;

//   font-size: 5.5px;

//   font-weight: 800;

//   letter-spacing: .8px;

//   z-index: 5;
// }

// /* BOTTOM LABEL */
// .top-logo::after {
//   content: "NASHVILLE";

//   position: absolute;

//   bottom: 0;

//   left: 50%;
//   transform: translateX(-50%);

//   width: 100%;
//   height: .19in;

//   background: #d71920;

//   color: #ffffff;

//   display: flex;
//   align-items: center;
//   justify-content: center;

//   font-family: "Cinzel", serif;

//   font-size: 5.5px;

//   font-weight: 800;

//   letter-spacing: .9px;

//   z-index: 5;
// }

// /* CENTER CROSS */
// .logo-cross {
//   position: absolute;

//   top: 50%;
//   left: 50%;

//   transform: translate(-50%, -50%);

//   font-size: 18px;

//   color: #f4c94c;

//   z-index: 6;

//   text-shadow:
//     0 1px 2px rgba(0,0,0,.35);
// }


// /* =========================================================
//    SIDE OPEN BIBLE ICONS
// ========================================================= */

// .side-cross {
//   position: absolute;

//   top: 50%;

//   width: .88in;
//   height: .88in;

//   transform: translateY(-50%);

//   border-radius: 50%;

//   overflow: hidden;

//   z-index: 10;

//   background:
//     radial-gradient(
//       circle at center,
//       rgba(84,104,166,.18) 0%,
//       rgba(40,58,115,.42) 40%,
//       rgba(8,16,44,.96) 100%
//     );

//   border: 3px solid #d71920;

//   box-shadow:
//     0 0 0 3px #f2be42,
//     0 0 0 5px #067a33,
//     0 5px 14px rgba(0,0,0,.20);
// }

// /* =========================================================
//    REAL OPEN BIBLE IMAGE
// ========================================================= */

// .side-cross::before {
//   content: "";

//   position: absolute;

//   inset: 0;

//   background-image:
//     url("https://i.imgur.com/Wm6XK8F.png");

//   background-size: cover;

//   background-position: center;

//   background-repeat: no-repeat;

//   opacity: .98;

//   z-index: 4;
// }

// /* =========================================================
//    SOFT LIGHT REFLECTION
// ========================================================= */

// .side-cross::after {
//   content: "";

//   position: absolute;

//   inset: 0;

//   background:
//     radial-gradient(
//       circle at 30% 24%,
//       rgba(255,255,255,.26),
//       transparent 42%
//     );

//   z-index: 5;
// }

// /* =========================================================
//    LEFT / RIGHT POSITION
// ========================================================= */

// .side-cross.left {
//   left: 0.18in;
// }

// .side-cross.right {
//   right: 0.18in;
// }

//   /* =========================================================
//      WATERMARK
//   ========================================================= */

//   .watermark {
//     position: absolute;

//     top: 1.92in;
//     left: 50%;

//     transform: translateX(-50%);

//     width: 4.6in;
//     height: 4.6in;

//     border-radius: 50%;

//     opacity: .045;

//     background:
//       radial-gradient(
//         circle at 50% 50%,
//         transparent 0 28%,
//         rgba(242,190,66,.35) 29% 31%,
//         transparent 32%
//       ),
//       repeating-conic-gradient(
//         from 0deg,
//         rgba(36,27,20,.30) 0deg 8deg,
//         rgba(255,255,255,.18) 8deg 16deg
//       );

//     border: 10px solid #f2be42;

//     z-index: 1;
//   }

//   .watermark::before {
//     content: "HOLY TRINITY ETHIOPIAN ORTHODOX TEWAHEDO CHURCH";

//     position: absolute;

//     top: 0.22in;
//     left: 0.16in;
//     right: 0.16in;

//     text-align: center;

//     font: 800 17px "Cinzel", serif;

//     color: #8a5a05;

//     letter-spacing: 1px;
//   }

//   .watermark::after {
//     content: "☦";

//     position: absolute;
//     inset: 0;

//     display: flex;
//     align-items: center;
//     justify-content: center;

//     font: 800 145px "Times New Roman", serif;

//     color: #8a5a05;
//   }

//  /* =========================================================
//    SIDE CHURCH LOGO ICONS
// ========================================================= */

// .side-cross {
//   position: absolute;

//   top: 50%;

//   width: .96in;
//   height: .96in;

//   transform: translateY(-50%);

//   border-radius: 50%;

//   background:
//     radial-gradient(
//       circle at center,
//       rgba(255,255,255,.10),
//       rgba(255,255,255,.02)
//     ),
    

//   background-size: cover;
//   background-repeat: no-repeat;
//   background-position: center;

//   border: 3px solid #d71920;

//   box-shadow:
//     0 0 0 4px #f2be42,
//     0 0 0 6px #067a33,
//     0 5px 12px rgba(0,0,0,.18);

//   z-index: 7;

//   overflow: hidden;
// }

// .side-cross::before {
//   content: "";

//   position: absolute;
//   inset: 0;

//   background:
//     linear-gradient(
//       rgba(255,255,255,.10),
//       rgba(0,0,0,.08)
//     );

//   z-index: 1;
// }

// .side-cross.left {
//   left: 0.16in;
// }

// .side-cross.right {
//   right: 0.16in;
// }


// /* =========================================================
//    DECORATIVE GOLD CHURCH CORNERS
// ========================================================= */

// .corner {
//   position: absolute;

//   width: .52in;
//   height: .52in;

//   z-index: 12;

//   display: flex;
//   align-items: center;
//   justify-content: center;

//   color: #c9961a;

//   font-family:
//     "Segoe UI Symbol",
//     "Arial Unicode MS",
//     serif;

//   font-size: .46in;

//   font-weight: 700;

//   line-height: 1;

//   text-shadow:
//     0 1px 0 rgba(255,255,255,.55),
//     0 0 3px rgba(201,150,26,.45);
// }

// .corner::before {
//   content: "✠";
// }

// .corner.tl {
//   top: .62in;
//   left: .62in;
// }

// .corner.tr {
//   top: .62in;
//   right: .62in;
// }

// .corner.bl {
//   bottom: .72in;
//   left: .62in;
// }

// .corner.br {
//   bottom: .72in;
//   right: .62in;
// }
//   /* =========================================================
//      CONTENT
//   ========================================================= */

//   .content {
//     position: relative;

//     z-index: 4;

//     height: 100%;

//     padding: 1.08in .82in .52in;

//     text-align: center;
//   }

//   /* =========================================================
//      CHURCH NAME
//   ========================================================= */

//   .church-name {
//     margin-top: .30in;

//     display: flex;
//     flex-direction: column;
//     align-items: center;
//     justify-content: center;

//     text-align: center;
//   }

//  .church-name-main {
//   font-family: "Cinzel", serif;

//   font-size: .19in;

//   font-weight: 700;

//   line-height: 1.28;

//   letter-spacing: .8px;

//   text-transform: uppercase;

//   color: #1f2937;
// }

//   .church-divider {
//   width: 2.8in;

//   height: 1px;

//   margin: .07in auto;

//   background:
//     linear-gradient(
//       90deg,
//       transparent,
//       #c9961a,
//       transparent
//     );

//   position: relative;
// }

// .church-divider::before {
//   content: "✦";

//   position: absolute;

//   left: 50%;
//   top: 50%;

//   transform:
//     translate(-50%, -50%);

//   background: #fffdf6;

//   padding: 0 8px;

//   color: #c9961a;

//   font-size: 10px;
// }

//   .location {
//     font-family: "Cormorant Garamond", serif;

//     font-size: .12in;

//     color: #6b7280;

//     letter-spacing: 1px;

//     text-transform: uppercase;
//   }





//   /* =========================================================
//      TITLE
//   ========================================================= */

// .title {
//   margin-top: .24in;

//   font-family:
//     "Cinzel",
//     serif;

//   font-size: .54in;

//   font-weight: 800;

//   letter-spacing: 1.2px;

//   text-transform: uppercase;

//   color: #a30d16;

//   text-shadow:
//     0 1px 0 rgba(255,255,255,.45);
// }
//  .title-rule {
//   width: 2.8in;

//   margin: .10in auto .08in;

//   height: 1px;

//   background:
//     linear-gradient(
//       90deg,
//       transparent,
//       #c9961a,
//       transparent
//     );

//   position: relative;
// }

// .title-rule::before {
//   content: "✦";

//   position: absolute;

//   left: 50%;
//   top: 50%;

//   transform:
//     translate(-50%, -50%);

//   background: #fffdf6;

//   padding: 0 10px;

//   color: #c9961a;

//   font-size: 11px;
// }
//   .subtitle {
//   margin-top: .01in;

//   font-size: .20in;

//   color: #b77d16;

//   font-style: italic;

//   font-family:
//     "Cormorant Garamond",
//     serif;
// }

//  .presented {
//   margin-top: .10in;

//   font-size: .18in;

//   color: #374151;

//   font-family:
//     "Cormorant Garamond",
//     serif;
// }


// .recipient {
//   margin: .04in auto 0;

//   min-width: 5.4in;
//   max-width: 8.8in;

//   display: inline-flex;

//   justify-content: center;
//   align-items: baseline;

//   padding:
//     0 .34in .05in;

//   border-bottom: 2px solid #c9961a;

//   font-family:
//     "Bickham Script Pro",
//     "Edwardian Script ITC",
//     "Great Vibes",
//     cursive;

//   font-size: .92in;

//   font-weight: 400;

//   line-height: .88;

//   letter-spacing: .5px;

//   color: #0b132b;

//   text-shadow:
//     0 1px 0 rgba(255,255,255,.55),
//     0 1px 3px rgba(0,0,0,.08);
// }


//   .recipient em {
//     font-family:
//       "Playfair Display",
//       Georgia,
//       serif;

//     font-size: .32in;

//     color: #b77d16;

//     font-style: normal;
//   }




// .recipient-couple {
//   width: 100%;

//   display: flex;

//   justify-content: center;
//   align-items: center;

//   gap: .24in;

//   flex-wrap: nowrap;

//   max-width: 8.2in;

//   margin-left: auto;
//   margin-right: auto;
// }

// .recipient-couple span {
//   flex: 1;

//   min-width: 0;

//   max-width: 3.25in;

//   display: block;

//   text-align: center;

//   font-size: .78in;

//   line-height: .88;

//   white-space: normal;

//   overflow-wrap: break-word;

//   word-break: break-word;
// }

// .recipient-couple em {
//   flex: 0 0 auto;

//   font-size: .38in;

//   line-height: 1;

//   transform: translateY(-.04in);

//   color: #c9961a;

//   padding: 0 .03in;
// } 
//   /* marriage + engagement spacing safety */

// .recipient-couple + .description {
//   margin-top: .18in;
// }

// .recipient-couple ~ .details {
//   margin-top: .24in;
// }
//  .description {
//   width: 7.2in;

//   margin: .11in auto 0;

//   font-size: .16in;

//   line-height: 1.45;

//   color: #1f2937;
// }

//   /* =========================================================
//      DETAILS
//   ========================================================= */

//   .details {
//     margin: .12in auto 0;

//     width: 7.7in;

//     display: grid;

//     grid-template-columns: repeat(4, 1fr);

//     gap: .12in;

//     align-items: start;
//   }
// .details.marriage-layout {
//   grid-template-columns:
//     repeat(3, 1fr);
// }

// .details.engagement-layout {
//   grid-template-columns:
//     repeat(3, 1fr);
// }
//   .detail-item {
//     min-height: .52in;

//     display: grid;

//     grid-template-columns: .36in 1fr;

//     gap: .06in;

//     align-items: center;

//     border-right: 1px solid rgba(183,125,22,.58);

//     padding-right: .08in;
//   }

//   .detail-item:last-child {
//     border-right: none;
//   }

//   .detail-icon {
//   width: .38in;
//   height: .38in;

//   border-radius: 50%;

//   border: 2px solid #c9961a;

//   color: #c9961a;

//   display: flex;
//   align-items: center;
//   justify-content: center;

//   font: 800 16px Georgia, serif;

//   background:
//     rgba(255,255,255,.35);
// }

//   .detail-label {
//     font:
//       800 .095in "Cinzel",
//       serif;

//     color: #9b111e;

//     text-transform: uppercase;

//     letter-spacing: .5px;
//   }

//   .detail-value {
//     margin-top: .02in;

//     font:
//       700 .125in "Cormorant Garamond",
//       serif;

//     color: #111827;
//   }

//   .supplemental {
//     display: none;
//   }

//   /* =========================================================
//      SEAL
//   ========================================================= */

// .seal {
//   position: absolute;

//   left: 50%;
//   bottom: 1.22in;

//   transform: translateX(-50%);

//   width: 1.02in;
//   height: 1.02in;

//   border-radius: 50%;

//   background:
//     radial-gradient(circle,
//       #f9de73 0 42%,
//       #d4a620 43% 100%
//     );

//   border: 4px solid #b77d16;

//   box-shadow:
//     0 0 0 2px rgba(255,255,255,.45),
//     0 5px 12px rgba(0,0,0,.15);

//   z-index: 7;

//   display: flex;
//   align-items: center;
//   justify-content: center;

//   color: #7b4a05;

//   text-align: center;
// }
//   .seal-inner {
//     width: .76in;
//     height: .76in;

//     border-radius: 50%;

//     border: 2px dashed rgba(123,74,5,.75);

//     display: flex;
//     align-items: center;
//     justify-content: center;
//     flex-direction: column;

//     font:
//       800 8px "Cinzel",
//       serif;

//     letter-spacing: .6px;
//   }

//   .seal-cross {
//     font-size: 22px;

//     line-height: 1;
//   }
// /* =========================================================
//    FOOTER
// ========================================================= */

// .footer {
//   position: absolute;

//   left: 1.45in;
//   right: 1.45in;

//   bottom: 0.92in;

//   z-index: 6;

//   display: flex;

//   justify-content: space-between;

//   align-items: flex-end;
// }

// .signature {
//   width: 2.55in;

//   text-align: center;

//   position: relative;
// }

// .signature-script {
//   min-height: .34in;

//   margin-bottom: .06in;

//   padding: 0 .06in;

//   display: flex;
//   align-items: flex-end;
//   justify-content: center;

//   font-family:
//     "Great Vibes",
//     "Brush Script MT",
//     cursive;

//   font-size: .24in;

//   line-height: 1;

//   color: #2563eb;

//   white-space: nowrap;

//   overflow: hidden;

//   text-overflow: ellipsis;
// }
// .signature-line {
//   border-top: 1.5px solid #b77d16;

//   margin-top: .01in;
// }

// .signature-name {
//   margin-top: .04in;

//   font:
//     700 .11in "Cormorant Garamond",
//     serif;

//   color: #111827;

//   line-height: 1.1;
// }

// .signature-role {
//   margin-top: .01in;

//   font:
//     800 .078in "Cinzel",
//     serif;

//   color: #9b111e;

//   text-transform: uppercase;

//   letter-spacing: .8px;

//   line-height: 1.1;
// }
//   /* =========================================================
//      SCRIPTURE
//   ========================================================= */

// .scripture {
//   position: absolute;

//   left: 0;
//   right: 0;

//   bottom: .56in;

//   text-align: center;

//   font-size: .092in;

//   color: #b77d16;

//   font-style: italic;

//   z-index: 6;
// }
//   /* =========================================================
//      CERTIFICATE NUMBER
//   ========================================================= */

// .cert-number {
//   position: absolute;

//   right: 1.02in;

//   bottom: .82in;

//   text-align: right;

//   font:
//     700 .088in "Cinzel",
//     serif;

//   letter-spacing: 1px;

//   color: rgba(123,74,5,.92);

//   z-index: 10;
// }
// </style>



// </head>

// <body>

//   <div class="page">

//     <div class="frame-green"></div>
//     <div class="frame-yellow"></div>
//     <div class="frame-red"></div>
//     <div class="frame-gold-thin"></div>

//     <!-- TOP LOGO -->
//     <div class="top-logo">
//       <div class="logo-cross">✟</div>
//     </div>

//    <!-- WATERMARK -->
// <div class="watermark"></div>

// <!-- SIDE OPEN BIBLE ICONS -->
// // <div class="side-cross left"></div>

// // <div class="side-cross right"></div>

// <!-- CORNER CROSSES -->
// <div class="corner tl"></div>
// <div class="corner tr"></div>
// <div class="corner bl"></div>
// <div class="corner br"></div>

//     <main class="content">

//       <!-- CHURCH NAME -->
//       <div class="church-name">

//         <div class="church-name-main">
//           HOLY TRINITY ETHIOPIAN<br/>
//           ORTHODOX TEWAHEDO CHURCH
//         </div>

//         <div class="church-divider"></div>

//         <div class="location">
//           ${esc(d.location)}
//         </div>

//       </div>

//       <!-- CERTIFICATE TITLE -->
//       <div class="title">
//         ${esc(certificateTitle(d.type))}
//       </div>

//       <div class="title-rule"></div>

//       <div class="subtitle">
//         ${esc(certificateSubtitle(d.type))}
//       </div>

//       <div class="presented">
//         This certifies that
//       </div>

//       <!-- RECIPIENT -->
//       <div class="recipient ${
//         d.type === "marriage_certificate" ||
//         d.type === "engagement_certificate"
//           ? "recipient-couple"
//           : ""
//       }">
//         ${recipientDisplay(d)}
//       </div>

//       <!-- DESCRIPTION -->
//       <div class="description">
//         ${certificateDescription(d)}
//       </div>

//       <!-- DETAILS -->
//       <section class="details ${
//         d.type === "marriage_certificate"
//           ? "marriage-layout"
//           : d.type === "engagement_certificate"
//           ? "engagement-layout"
//           : ""
//       }">
//         ${renderMetaItems(d)}
//       </section>

//       ${renderSupplementalDetails(d)}

//     </main>

//     <!-- CENTER SEAL -->
//     <div class="seal">
//       <div class="seal-inner">
//         <div>HOLY</div>
//         <div class="seal-cross">☦</div>
//         <div>TRINITY</div>
//       </div>
//     </div>

//     <!-- SIGNATURES -->
//     <footer class="footer">

//       <div class="signature">
//         <div class="signature-script">
//           ${esc(signatureText(d.priestName))}
//         </div>

//         <div class="signature-line"></div>

//         <div class="signature-name">
//           ${esc(d.priestName)}
//         </div>

//         <div class="signature-role">
//           Church Priest
//         </div>
//       </div>

//       <div class="signature">
//         <div class="signature-script">
//           ${esc(signatureText(d.administratorName))}
//         </div>

//         <div class="signature-line"></div>

//         <div class="signature-name">
//           ${esc(d.administratorName)}
//         </div>

//         <div class="signature-role">
//           Church Administration
//         </div>
//       </div>

//     </footer>

//     <!-- SCRIPTURE -->
//     <div class="scripture">
//       “Let all that you do be done in love.” — 1 Corinthians 16:14
//     </div>

//     <!-- CERTIFICATE NUMBER -->
//     <div class="cert-number">
//       Certificate No. ${esc(d.certificateNumber)}
//       • Issued ${esc(formatDate(d.issuedDate))}
//     </div>

//   </div>

// </body>
// </html>`;
// }

// module.exports = {
//   normalizeCertificateData,
//   renderCertificateHtml,
// };


///// ===================== certificateHtmlService.js ============================//                                                            // backend/services/certificateHtmlService.js

"use strict";

/* =========================================================
   ENTERPRISE CERTIFICATE HTML SERVICE
   HTML + CSS template engine for Puppeteer PDF rendering
========================================================= */

/* =========================================================
   HELPERS
========================================================= */
const path = require("path");
const fs = require("fs");
function esc(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleCase(value = "") {
  return String(value || "certificate")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function compact(value, fallback = "—") {
  return String(value ?? "").trim() || fallback;
}

function signatureText(value = "") {
  return compact(value, "Church Administration");
}

/* =========================================================
   NORMALIZE DATA
========================================================= */
/* =========================================================
   NORMALIZE DATA
========================================================= */

function normalizeCertificateData(type, payload = {}, member = {}) {

  const husbandName =
    payload.husbandName ||
    payload.groomName ||
    payload.recipientName ||
    member.full_name ||
    "";

  const wifeName =
    payload.wifeName ||
    payload.brideName ||
    payload.secondaryName ||
    "";

  const recipientName =
    payload.recipientName ||
    payload.fullName ||
    payload.baptizedName ||
    payload.volunteerName ||
    payload.participantName ||
    husbandName ||
    member.full_name ||
    "Recipient Name";

  const secondaryName =
    payload.secondaryName ||
    payload.wifeName ||
    payload.brideName ||
    "";

  /* =====================================================
     ENTERPRISE LOGO PATH
  ===================================================== */


const logoAbsolutePath = path.resolve(
  __dirname,
  "../imgs/church_logo.jpeg"
);

let resolvedLogoPath = "";

try {
  const imageBuffer = fs.readFileSync(logoAbsolutePath);

  resolvedLogoPath =
    `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;

  console.log(
    "✅ Certificate logo embedded successfully"
  );
} catch (err) {
  console.error(
    "❌ Failed to load certificate logo:",
    err.message
  );

  resolvedLogoPath = "";
}
  return {

    type,

    title: titleCase(type),

    churchName:
      payload.churchName ||
      "Holy Trinity Ethiopian Orthodox Tewahedo Church",

    location:
      payload.location ||
      payload.address ||
      "Nashville, Tennessee",

    recipientName,

    secondaryName,

    husbandName,

    wifeName,

    certificateNumber:
      payload.certificateNumber ||
      `HT-${Date.now()}`,

    priestName:
      payload.priestName ||
      payload.authorizedBy ||
      "Church Administration",

    administratorName:
      payload.administratorName ||
      payload.adminName ||
      "Church Administration",

    issuedDate:
      payload.issueDate ||
      payload.issuedDate ||
      payload.dateIssued ||
      new Date().toISOString().slice(0, 10),

    eventDate:
      payload.eventDate ||
      payload.marriageDate ||
      payload.engagementDate ||
      payload.baptismDate ||
      payload.completionDate ||
      "",

    christianName:
      payload.christianName || "",

    fatherName:
      payload.fatherName || "",

    motherName:
      payload.motherName || "",

    godFatherName:
      payload.godFatherName || "",

    godMotherName:
      payload.godMotherName || "",

    dateOfBirth:
      payload.dateOfBirth || "",

    placeOfBirth:
      payload.placeOfBirth || "",

    witnessOne:
      payload.witnessOne || "",

    witnessTwo:
      payload.witnessTwo || "",

    volunteerHours:
      payload.volunteerHours ||
      payload.totalHours ||
      payload.serviceHours ||
      "0",

    recognitionLevel:
      payload.recognitionLevel ||
      "Gold Recognition",

    recognitionTitle:
      payload.recognitionTitle ||
      "Faithful Service",

    recognitionReason:
      payload.recognitionReason ||
      "Faithful dedication and contribution to the church community.",

    ministryDepartment:
      payload.ministryDepartment || "",

    servicePeriod:
      payload.servicePeriod || "",

    eventName:
      payload.eventName ||
      payload.programName ||
      "Church Program",

    applicantType:
      payload.applicantType || "member",

    externalEmail:
      payload.externalEmail || "",

    notes:
      payload.notes || "",

    logoPath:
      resolvedLogoPath,
  };
}

/* =========================================================
   CERTIFICATE TITLES
========================================================= */

function certificateTitle(type) {
  switch (type) {
    case "baptism_certificate":       return "Baptism Certificate";
    case "engagement_certificate":    return "Engagement Certificate";
    case "marriage_certificate":      return "Marriage Certificate";
    case "volunteer_certificate":     return "Volunteer Certificate";
    case "participation_certificate": return "Participation Certificate";
    case "recognition_certificate":   return "Recognition Certificate";
    default:                          return "Official Certificate";
  }
}

function certificateSubtitle(type) {
  switch (type) {
    case "baptism_certificate":       return "Certificate of Holy Baptism";
    case "engagement_certificate":    return "Certificate of Holy Engagement";
    case "marriage_certificate":      return "Certificate of Holy Matrimony";
    case "volunteer_certificate":     return "Certificate of Volunteer Service";
    case "participation_certificate": return "Certificate of Participation";
    case "recognition_certificate":   return "Certificate of Recognition";
    default:                          return "Official Church Certificate";
  }
}

/* =========================================================
   BODY TEXT
========================================================= */

function certificateDescription(d) {
  switch (d.type) {
    case "baptism_certificate":
      return `is recorded as having received the Holy Sacrament of Baptism
        according to the apostolic faith, sacred teachings, and holy
        traditions of the Ethiopian Orthodox Tewahedo Church.`;
    case "engagement_certificate":
      return `are prayerfully recognized for their holy engagement blessing,
        witnessed before the church community and honored according to
        the sacred traditions of the Ethiopian Orthodox Tewahedo Church.`;
    case "marriage_certificate":
      return `are joined together in sacred matrimony before God, the Holy Church,
        family, and witnesses according to the apostolic faith, spiritual
        teachings, and sacramental traditions of the Ethiopian Orthodox
        Tewahedo Church.`;
    case "volunteer_certificate":
      return `is recognized for faithful volunteer service, dedication,
        and valuable contributions to the church and community.
        Your commitment is deeply appreciated.`;
    case "participation_certificate":
      return `is recognized for faithful participation, commitment, and
        contribution to church programs and ministry activities.`;
    case "recognition_certificate":
      return `is awarded in recognition of outstanding dedication, faithful service,
        ministry participation, and exceptional contribution to the church
        and community.`;
    default:
      return `is officially recognized by the church administration.`;
  }
}

/* =========================================================
   RECIPIENT DISPLAY
========================================================= */

function recipientDisplay(d) {
  if (
    d.type === "marriage_certificate" ||
    d.type === "engagement_certificate"
  ) {
    return `
      <span>${esc(d.husbandName || d.recipientName)}</span>
      ${d.wifeName || d.secondaryName ? `<em>&amp;</em><span>${esc(d.wifeName || d.secondaryName)}</span>` : ""}
    `;
  }
  return `<span>${esc(d.recipientName)}</span>`;
}

/* =========================================================
   META ITEMS
========================================================= */

function getMetaItems(d) {
  const base = [];

  base.push({ icon: "▣", label: "Issue Date", value: formatDate(d.issuedDate) });
  base.push({ icon: "✝", label: "Priest",     value: d.priestName });

  if (d.type === "volunteer_certificate") {
    base.push({ icon: "♥", label: "Volunteer Hours", value: d.volunteerHours });
    base.push({ icon: "★", label: "Recognition",     value: d.recognitionLevel });
  } else if (d.type === "recognition_certificate") {
    base.push({ icon: "★", label: "Recognition", value: d.recognitionLevel });
    base.push({ icon: "✦", label: "Award",        value: d.recognitionTitle });
  } else if (d.type === "baptism_certificate") {
    base.push({ icon: "✝", label: "Baptism Date",   value: formatDate(d.eventDate) });
    base.push({ icon: "☦", label: "Christian Name", value: d.christianName || "—" });
  } else if (
    d.type === "marriage_certificate" ||
    d.type === "engagement_certificate"
  ) {
    base.push({
      icon: "✝",
      label: d.type === "marriage_certificate" ? "Marriage Date" : "Engagement Date",
      value: formatDate(d.eventDate),
    });
  } else {
    base.push({ icon: "★", label: "Program",  value: d.eventName });
    base.push({ icon: "✦", label: "Location", value: d.location });
  }

  return base;
}

function renderMetaItems(d) {
  return getMetaItems(d)
    .map(
      (item) => `
        <div class="detail-item">
          <div class="detail-icon">${esc(item.icon)}</div>
          <div>
            <div class="detail-label">${esc(item.label)}</div>
            <div class="detail-value">${esc(item.value)}</div>
          </div>
        </div>
      `
    )
    .join("");
}

/* =========================================================
   EXTRA SACRAMENT DETAILS
========================================================= */

function renderSupplementalDetails(d) {
  const rows = [];

  if (d.type === "baptism_certificate") {
    rows.push(["Father",       d.fatherName]);
    rows.push(["Mother",       d.motherName]);
    rows.push(["God Father",   d.godFatherName]);
    rows.push(["God Mother",   d.godMotherName]);
    rows.push(["Date of Birth",formatDate(d.dateOfBirth)]);
    rows.push(["Place of Birth",d.placeOfBirth]);
  }

  if (
    d.type === "marriage_certificate" ||
    d.type === "engagement_certificate"
  ) {
    rows.push(["Husband", d.husbandName || d.recipientName]);
    rows.push(["Wife",    d.wifeName || d.secondaryName]);
  }

  if (!rows.length) return "";

  return `
    <div class="supplemental">
      ${rows
        .filter(([, value]) => value)
        .map(
          ([label, value]) => `
            <div class="supplemental-row">
              <strong>${esc(label)}</strong>
              <span>${esc(value)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

/* =========================================================
   ORTHODOX CROSS SVG  — reusable snippet
========================================================= */

const orthodoxCrossSvg = `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <rect x="43" y="5"  width="14" height="90" rx="2" fill="#c9961a"/>
    <rect x="5"  y="43" width="90" height="14" rx="2" fill="#c9961a"/>
    <polygon points="43,5 50,0 57,5 55,12 45,12"     fill="#c9961a"/>
    <polygon points="43,95 50,100 57,95 55,88 45,88"  fill="#c9961a"/>
    <polygon points="5,43 0,50 5,57 12,55 12,45"     fill="#c9961a"/>
    <polygon points="95,43 100,50 95,57 88,55 88,45"  fill="#c9961a"/>
    <rect x="44" y="44" width="12" height="12" rx="1" transform="rotate(45 50 50)" fill="#b8860b"/>
  </svg>
`;

/* =========================================================
   MAIN RENDERER
   NOTE FOR PUPPETEER: await page.evaluateHandle('document.fonts.ready')
   before capturing the PDF so Google Fonts load correctly.
========================================================= */

function renderCertificateHtml(type, payload = {}, member = {}) {
  const d = normalizeCertificateData(type, payload, member);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(certificateTitle(d.type))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:wght@600;700;800&family=Cinzel:wght@600;700;800&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">

<style>
  @page { size: Letter landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { width: 11in; height: 8.5in; margin: 0; padding: 0; background: #ffffff; }
  body { font-family: "Cormorant Garamond", Georgia, serif; color: #111827; }

  /* ── PAGE ── */
  .page {
    position: relative;
    width: 11in;
    height: 8.5in;
    overflow: hidden;
    background:
      radial-gradient(circle at 50% 46%, rgba(242,190,66,0.14), transparent 38%),
      linear-gradient(135deg, #fff9e8 0%, #fffdf6 42%, #fff4d8 100%);
  }

  /* ── FRAMES ── */
  .frame-green     { position: absolute; inset: .10in; border: 12px solid #067a33; z-index: 5; }
  .frame-yellow    { position: absolute; inset: .24in; border: 10px solid #f2be42; z-index: 5; }
  .frame-red       { position: absolute; inset: .39in; border: 7px solid #d71920;  z-index: 5; }
  .frame-gold-thin { position: absolute; inset: .55in; border: 1.5px solid rgba(180,126,22,.72); z-index: 5; }

  /* ── TOP LOGO ── */
.top-logo {
  position: absolute;

  top: .08in;

  left: 50%;

  transform: translateX(-50%);

  width: .78in;
  height: .78in;

  z-index: 40;

  display: flex;
  align-items: center;
  justify-content: center;

  overflow: visible;
}

.top-logo img {

  width: 100%;
  height: 100%;

  object-fit: contain;

  display: block;

  filter:
    drop-shadow(0 3px 6px rgba(0,0,0,.18));
}
  /* ── SIDE CIRCLES (disabled by default — uncomment divs in HTML to enable) ── */
  .side-cross {
    position: absolute;
    top: 50%;
    width: .96in;
    height: .96in;
    transform: translateY(-50%);
    border-radius: 50%;
    overflow: hidden;
    border: 3px solid #d71920;
    box-shadow: 0 0 0 4px #f2be42, 0 0 0 6px #067a33, 0 5px 12px rgba(0,0,0,.18);
    z-index: 7;
    background: #fff;
  }
  .side-cross img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .side-cross.left  { left: .16in; }
  .side-cross.right { right: .16in; }

  /* ── WATERMARK ── */
  .watermark {
    position: absolute;
    top: 1.92in;
    left: 50%;
    transform: translateX(-50%);
    width: 4.6in;
    height: 4.6in;
    border-radius: 50%;
    opacity: .045;
    background:
      radial-gradient(circle at 50% 50%, transparent 0 28%, rgba(242,190,66,.35) 29% 31%, transparent 32%),
      repeating-conic-gradient(from 0deg, rgba(36,27,20,.30) 0deg 8deg, rgba(255,255,255,.18) 8deg 16deg);
    border: 10px solid #f2be42;
    z-index: 1;
  }
  .watermark::after {
    content: "☦";
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 800 145px "Times New Roman", serif;
    color: #8a5a05;
  }

  /* ── CORNER CROSSES — Ethiopian Orthodox SVG style ── */
  .corner {
    position: absolute;
    width: .55in;
    height: .55in;
    z-index: 12;
  }
  .corner.tl { top: .58in;    left: .58in; }
  .corner.tr { top: .58in;    right: .58in; }
  .corner.bl { bottom: .58in; left: .58in; }
  .corner.br { bottom: .58in; right: .58in; }

  /* ── CONTENT ── */
  .content {
    position: relative;
    z-index: 4;
    height: 100%;
    padding: 1.08in .82in .52in;
    text-align: center;
  }

  /* ── CHURCH NAME ── */
  .church-name {
    margin-top: .42in;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .church-name-main {
    font-family: "Cinzel", serif;
    font-size: .19in;
    font-weight: 700;
    line-height: 1.28;
    letter-spacing: .8px;
    text-transform: uppercase;
    color: #1f2937;
  }
  .church-divider {
    width: 2.8in;
    height: 1px;
    margin: .07in auto;
    background: linear-gradient(90deg, transparent, #c9961a, transparent);
    position: relative;
  }
  .church-divider::before {
    content: "✦";
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: #fffdf6;
    padding: 0 8px;
    color: #c9961a;
    font-size: 10px;
  }
  .location {
    font-family: "Cormorant Garamond", serif;
    font-size: .12in;
    color: #6b7280;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  /* ── TITLE ── */
  .title {
    margin-top: .24in;
    font-family: "Cinzel", serif;
    font-size: .54in;
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #a30d16;
    text-shadow: 0 1px 0 rgba(255,255,255,.45);
  }
  .title-rule {
    width: 2.8in;
    margin: .10in auto .08in;
    height: 1px;
    background: linear-gradient(90deg, transparent, #c9961a, transparent);
    position: relative;
  }
  .title-rule::before {
    content: "✦";
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: #fffdf6;
    padding: 0 10px;
    color: #c9961a;
    font-size: 11px;
  }
  .subtitle {
    margin-top: .01in;
    font-size: .20in;
    color: #b77d16;
    font-style: italic;
    font-family: "Cormorant Garamond", serif;
  }
  .presented {
    margin-top: .10in;
    font-size: .18in;
    color: #374151;
    font-family: "Cormorant Garamond", serif;
  }

  /* ── RECIPIENT ── */
  .recipient {
    margin: .04in auto 0;
    min-width: 5.4in;
    max-width: 8.8in;
    display: inline-flex;
    justify-content: center;
    align-items: baseline;
    padding: 0 .34in .05in;
    border-bottom: 2px solid #c9961a;
    font-family: "Bickham Script Pro", "Edwardian Script ITC", "Great Vibes", cursive;
    font-size: .92in;
    font-weight: 400;
    line-height: .88;
    letter-spacing: .5px;
    color: #0b132b;
    text-shadow: 0 1px 0 rgba(255,255,255,.55), 0 1px 3px rgba(0,0,0,.08);
  }
  .recipient em {
    font-family: "Playfair Display", Georgia, serif;
    font-size: .32in;
    color: #b77d16;
    font-style: normal;
  }
  .recipient-couple {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: .24in;
    flex-wrap: nowrap;
    max-width: 8.2in;
    margin-left: auto;
    margin-right: auto;
  }
  .recipient-couple span {
    flex: 1;
    min-width: 0;
    max-width: 3.25in;
    display: block;
    text-align: center;
    font-size: .78in;
    line-height: .88;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  .recipient-couple em {
    flex: 0 0 auto;
    font-size: .38in;
    line-height: 1;
    transform: translateY(-.04in);
    color: #c9961a;
    padding: 0 .03in;
  }
  .recipient-couple + .description { margin-top: .18in; }
  .recipient-couple ~ .details     { margin-top: .24in; }

  /* ── DESCRIPTION ── */
  .description {
    width: 7.2in;
    margin: .11in auto 0;
    font-size: .16in;
    line-height: 1.45;
    color: #1f2937;
  }

  /* ── DETAILS ── */
  .details {
    margin: .12in auto 0;
    width: 7.7in;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: .12in;
    align-items: start;
  }
  .details.marriage-layout,
  .details.engagement-layout { grid-template-columns: repeat(3, 1fr); }

  .detail-item {
    min-height: .52in;
    display: grid;
    grid-template-columns: .36in 1fr;
    gap: .06in;
    align-items: center;
    border-right: 1px solid rgba(183,125,22,.58);
    padding-right: .08in;
  }
  .detail-item:last-child { border-right: none; }
  .detail-icon {
    width: .38in;
    height: .38in;
    border-radius: 50%;
    border: 2px solid #c9961a;
    color: #c9961a;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 800 16px Georgia, serif;
    background: rgba(255,255,255,.35);
  }
  .detail-label {
    font: 800 .095in "Cinzel", serif;
    color: #9b111e;
    text-transform: uppercase;
    letter-spacing: .5px;
  }
  .detail-value {
    margin-top: .02in;
    font: 700 .125in "Cormorant Garamond", serif;
    color: #111827;
  }
  .supplemental { display: none; }

  /* ── SEAL ── */
  .seal {
    position: absolute;
    left: 50%;
    bottom: 1.22in;
    transform: translateX(-50%);
    width: 1.02in;
    height: 1.02in;
    border-radius: 50%;
    background: radial-gradient(circle, #f9de73 0 42%, #d4a620 43% 100%);
    border: 4px solid #b77d16;
    box-shadow: 0 0 0 2px rgba(255,255,255,.45), 0 5px 12px rgba(0,0,0,.15);
    z-index: 7;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #7b4a05;
    text-align: center;
  }
  .seal-inner {
    width: .76in;
    height: .76in;
    border-radius: 50%;
    border: 2px dashed rgba(123,74,5,.75);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    font: 800 8px "Cinzel", serif;
    letter-spacing: .6px;
  }
  .seal-cross { font-size: 22px; line-height: 1; }

  /* ── FOOTER ── */
  .footer {
    position: absolute;
    left: 1.45in;
    right: 1.45in;
    bottom: .92in;
    z-index: 6;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .signature { width: 2.55in; text-align: center; position: relative; }
  .signature-script {
    min-height: .34in;
    margin-bottom: .06in;
    padding: 0 .06in;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-family: "Great Vibes", "Brush Script MT", cursive;
    font-size: .24in;
    line-height: 1;
    color: #2563eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .signature-line { border-top: 1.5px solid #b77d16; margin-top: .01in; }
  .signature-name {
    margin-top: .04in;
    font: 700 .11in "Cormorant Garamond", serif;
    color: #111827;
    line-height: 1.1;
  }
  .signature-role {
    margin-top: .01in;
    font: 800 .078in "Cinzel", serif;
    color: #9b111e;
    text-transform: uppercase;
    letter-spacing: .8px;
    line-height: 1.1;
  }

  /* ── SCRIPTURE ── */
  .scripture {
    position: absolute;
    left: 1.2in;
    right: 1.2in;
    bottom: .68in;
    text-align: center;
    font-size: .092in;
    color: #b77d16;
    font-style: italic;
    z-index: 6;
  }

  /* ── CERTIFICATE NUMBER — clear of bottom corner crosses ── */
  .cert-number {
    position: absolute;
    right: 1.25in;
    bottom: .68in;
    text-align: right;
    font: 700 .088in "Cinzel", serif;
    letter-spacing: 1px;
    color: rgba(123,74,5,.92);
    z-index: 6;
  }
</style>

</head>
<body>
  <div class="page">

    <div class="frame-green"></div>
    <div class="frame-yellow"></div>
    <div class="frame-red"></div>
    <div class="frame-gold-thin"></div>

    <!-- TOP LOGO: place church_logo.jpeg in /imgs/ folder -->
    <div class="top-logo">
      <img src="${esc(d.logoPath)}" alt="Holy Trinity Church Logo">
    </div>

    <!-- WATERMARK -->
    <div class="watermark"></div>

    <!-- SIDE BIBLE ICONS (uncomment to enable) -->
    <!-- <div class="side-cross left"><img src="${esc(d.logoPath)}" alt=""></div> -->
    <!-- <div class="side-cross right"><img src="${esc(d.logoPath)}" alt=""></div> -->

    <!-- CORNER CROSSES — Ethiopian Orthodox SVG style -->
    <div class="corner tl">${orthodoxCrossSvg}</div>
    <div class="corner tr">${orthodoxCrossSvg}</div>
    <div class="corner bl">${orthodoxCrossSvg}</div>
    <div class="corner br">${orthodoxCrossSvg}</div>

    <main class="content">

      <!-- CHURCH NAME -->
      <div class="church-name">
        <div class="church-name-main">
          HOLY TRINITY ETHIOPIAN<br/>
          ORTHODOX TEWAHEDO CHURCH
        </div>
        <div class="church-divider"></div>
        <div class="location">${esc(d.location)}</div>
      </div>

      <!-- CERTIFICATE TITLE -->
      <div class="title">${esc(certificateTitle(d.type))}</div>
      <div class="title-rule"></div>
      <div class="subtitle">${esc(certificateSubtitle(d.type))}</div>
      <div class="presented">This certifies that</div>

      <!-- RECIPIENT -->
      <div class="recipient ${
        d.type === "marriage_certificate" ||
        d.type === "engagement_certificate"
          ? "recipient-couple"
          : ""
      }">
        ${recipientDisplay(d)}
      </div>

      <!-- DESCRIPTION -->
      <div class="description">${certificateDescription(d)}</div>

      <!-- DETAILS -->
      <section class="details ${
        d.type === "marriage_certificate"
          ? "marriage-layout"
          : d.type === "engagement_certificate"
          ? "engagement-layout"
          : ""
      }">
        ${renderMetaItems(d)}
      </section>

      ${renderSupplementalDetails(d)}

    </main>

    <!-- CENTER SEAL -->
    <div class="seal">
      <div class="seal-inner">
        <div>HOLY</div>
        <div class="seal-cross">☦</div>
        <div>TRINITY</div>
      </div>
    </div>

    <!-- SIGNATURES -->
    <footer class="footer">
      <div class="signature">
        <div class="signature-script">${esc(signatureText(d.priestName))}</div>
        <div class="signature-line"></div>
        <div class="signature-name">${esc(d.priestName)}</div>
        <div class="signature-role">Church Priest</div>
      </div>
      <div class="signature">
        <div class="signature-script">${esc(signatureText(d.administratorName))}</div>
        <div class="signature-line"></div>
        <div class="signature-name">${esc(d.administratorName)}</div>
        <div class="signature-role">Church Administration</div>
      </div>
    </footer>

    <!-- SCRIPTURE -->
    <div class="scripture">
      "Let all that you do be done in love." — 1 Corinthians 16:14
    </div>

    <!-- CERTIFICATE NUMBER -->
    <div class="cert-number">
      Certificate No. ${esc(d.certificateNumber)}
      &bull; Issued ${esc(formatDate(d.issuedDate))}
    </div>

  </div>
</body>
</html>`;
}

module.exports = {
  normalizeCertificateData,
  renderCertificateHtml,
};