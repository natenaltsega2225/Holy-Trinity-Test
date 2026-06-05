// //backend\utils\emailSender.js
// "use strict";

// const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// async function sendReceiptEmail({ to, pdfBuffer, receiptNo }) {
//   try {
//     await transporter.sendMail({
//       from: `"Holy Trinity EOTC" <${process.env.EMAIL_USER}>`,
//       to,
//       subject: `Receipt ${receiptNo}`,
//       text: "Thank you for your payment. Your receipt is attached.",
//       attachments: [
//         {
//           filename: `${receiptNo}.pdf`,
//           content: pdfBuffer,
//         },
//       ],
//     });

//     return { success: true };
//   } catch (err) {
//     console.error("Email send error:", err);
//     return { success: false, error: err.message };
//   }
// }

// module.exports = { sendReceiptEmail };