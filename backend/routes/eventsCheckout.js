// //backend\routes\eventsCheckout.js
// "use strict";

// const express = require("express");
// const Stripe = require("stripe");
// const jwt = require("jsonwebtoken");
// const pool = require("../db");

// const router = express.Router();
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// function cents(value) {
//   return Math.round(Number(value || 0) * 100);
// }

// function clean(value, max = 255) {
//   return String(value || "").trim().slice(0, max);
// }

// function getJwtSecret() {
//   return process.env.JWT_SECRET || "dev_secret";
// }

// function optionalAuth(req, _res, next) {
//   try {
//     const header = req.headers.authorization || "";
//     const token = header.startsWith("Bearer ") ? header.slice(7) : null;

//     if (!token) {
//       req.user = null;
//       return next();
//     }

//     req.user = jwt.verify(token, getJwtSecret());
//     return next();
//   } catch {
//     req.user = null;
//     return next();
//   }
// }

// async function getMemberByUserId(userId) {
//   if (!userId) return null;

//   const [[row]] = await pool.query(
//     `
//     SELECT
//       m.id,
//       m.member_no,
//       m.full_name,
//       m.email,
//       m.phone
//     FROM tbl_users u
//     INNER JOIN tbl_members m ON m.id = u.member_id
//     WHERE u.id = ?
//     LIMIT 1
//     `,
//     [userId]
//   );

//   return row || null;
// }

// router.post("/create-checkout-session", optionalAuth, async (req, res) => {
//   try {
//     const programId = Number(req.body.program_id || req.body.news_event_id || 0);
//     const quantity = Math.max(1, Number(req.body.quantity || req.body.participants || 1));

//     const successUrl = clean(req.body.success_url, 500);
//     const cancelUrl = clean(req.body.cancel_url, 500);

//     if (!programId) {
//       return res.status(400).json({ error: "Program ID is required." });
//     }

//     if (!successUrl || !cancelUrl) {
//       return res.status(400).json({
//         error: "Success and cancel URLs are required.",
//       });
//     }

//     const [[program]] = await pool.query(
//       `
//       SELECT
//         id,
//         title,
//         category,
//         start_date,
//         end_date,
//         time_text,
//         location,
//         price_per_person,
//         registration_enabled,
//         is_published
//       FROM tbl_news_events
//       WHERE id = ?
//         AND category IN ('kids', 'trip')
//         AND is_published = 1
//         AND registration_enabled = 1
//       LIMIT 1
//       `,
//       [programId]
//     );

//     if (!program) {
//       return res.status(404).json({ error: "Program not found or registration is closed." });
//     }

//     const price = Number(program.price_per_person || 0);

//     if (price <= 0) {
//       return res.status(400).json({ error: "Program price is not configured." });
//     }

//     let member = null;
//     if (req.user?.id) {
//       member = await getMemberByUserId(req.user.id);
//     }

//     const applicantName =
//       member?.full_name || clean(req.body.full_name || req.body.applicant_name || "", 180);
//     const applicantEmail =
//       member?.email || clean(req.body.email || "", 190);
//     const applicantPhone =
//       member?.phone || clean(req.body.phone || "", 40);

//     const coverProcessingFee =
//       req.body.cover_processing_fee === true ||
//       req.body.cover_processing_fee === "true" ||
//       req.body.cover_processing_fee === "1";

//     const processingFee = coverProcessingFee
//       ? Number(req.body.processing_fee || 0)
//       : 0;

//     const lineItems = [];

//     for (let i = 1; i <= quantity; i += 1) {
//       lineItems.push({
//         quantity: 1,
//         price_data: {
//           currency: "usd",
//           unit_amount: cents(price),
//           product_data: {
//             name: `${program.title} — Participant ${i}`,
//             description: [
//               program.category === "kids" ? "Kids School Program Registration" : "Trip Registration",
//               program.start_date ? `Date: ${new Date(program.start_date).toLocaleDateString("en-US")}` : "",
//               program.time_text ? `Time: ${program.time_text}` : "",
//               program.location ? `Location: ${program.location}` : "",
//               applicantName ? `Applicant: ${applicantName}` : "",
//             ]
//               .filter(Boolean)
//               .join(" • "),
//           },
//         },
//       });
//     }

//     if (coverProcessingFee && processingFee > 0) {
//       lineItems.push({
//         quantity: 1,
//         price_data: {
//           currency: "usd",
//           unit_amount: cents(processingFee),
//           product_data: {
//             name: "Processing Fee",
//             description: "Optional card processing fee covered by payer",
//           },
//         },
//       });
//     }

//     const participantsPayload = Array.isArray(req.body.participants)
//       ? req.body.participants
//       : [];

//     const session = await stripe.checkout.sessions.create({
//       mode: "payment",
//       customer_email: applicantEmail || undefined,
//       success_url: successUrl,
//       cancel_url: cancelUrl,
//       payment_method_types: ["card"],
//       line_items: lineItems,
//       metadata: {
//         payment_kind: "program",
//         payment_type: program.category === "kids" ? "school" : "trip",
//         type: "program",
//         category: program.category,
//         sub_category: program.title,

//         user_id: req.user?.id ? String(req.user.id) : "",
//         member_id: member?.id ? String(member.id) : "",
//         member_no: member?.member_no || "",

//         news_event_id: String(program.id),
//         program_id: String(program.id),
//         program_name: program.title,

//         full_name: applicantName,
//         email: applicantEmail,
//         phone: applicantPhone,

//         quantity: String(quantity),
//         participants: String(quantity),
//         price_per_person: String(price),
//         base_amount: String(price * quantity),
//         processing_fee: String(processingFee || 0),
//         cover_processing_fee: coverProcessingFee ? "true" : "false",

//         note: clean(req.body.notes || req.body.note || "", 500),
//         participants_json: JSON.stringify(participantsPayload).slice(0, 450),
//         method: "card",
//         provider: "stripe",
//       },
//     });

//     return res.json({
//       ok: true,
//       url: session.url,
//       id: session.id,
//     });
//   } catch (err) {
//     console.error("POST /events/create-checkout-session error:", err);
//     return res.status(500).json({ error: "Failed to create program checkout session." });
//   }
// });

// module.exports = router;