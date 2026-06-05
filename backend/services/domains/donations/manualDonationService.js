// backend/services/domains/donations/manualDonationService.js
"use strict";

const pool =
  require("../../../db");

const {

  insertExistingColumns,

} = require(
  "../../../utils/dbHelpers"
);

const {

  money,

  clean,
  nullable,

  mysqlNow,

  normalizeDonationCategory,
  normalizePaymentMethod,
  normalizeProvider,
  normalizeStatus,

} = require(
  "../../../utils/financeHelpers"
);

const {

  generatePaymentNumber,

} = require(
  "../../../utils/numberGenerator"
);

const {

  createDonationDetail,

} = require(
  "./donationService"
);

const {

  createInvoice,

} = require(
  "../../invoiceService"
);

const {

  createReceipt,

} = require(
  "../../receiptService"
);

const {

  postPaymentEntry,

} = require(
  "../../ledgerService"
);

/* =========================================================
   CREATE MANUAL DONATION
========================================================= */

async function createManualDonation(
  payload = {}
) {

  const conn =
    await pool.getConnection();

  try {

    await conn.beginTransaction();

    /* =====================================
       NORMALIZATION
    ===================================== */

    const amount =
      money(
        payload.amount
      );

    if (amount <= 0) {

      throw new Error(
        "Donation amount must be greater than zero."
      );
    }

    const paymentMethod =
      normalizePaymentMethod(
        payload.method ||
        "cash"
      );

    const provider =
      normalizeProvider(
        payload.provider,
        paymentMethod
      );

    const status =
      normalizeStatus(
        payload.status ||
        "paid"
      );

    const donationCategory =
      normalizeDonationCategory(

        payload.donation_category ||

        payload.sub_category
      );

    /* =====================================
       PAYMENT
    ===================================== */

    const paymentNumber =
      generatePaymentNumber();

    const paymentId =
      await insertExistingColumns(

        conn,

        "tbl_finance_payments",

        {

          payment_number:
            paymentNumber,

          member_id:
            payload.member_id || null,

          member_no:
            payload.member_no || null,

          full_name_snapshot:
            clean(
              payload.full_name
            ),

          email_snapshot:
            nullable(
              payload.email
            ),

          phone_snapshot:
            nullable(
              payload.phone
            ),

          payment_type:
            "donation",

          category:
            "donation",

          sub_category:
            donationCategory,

          description:

            payload.description ||

            "Manual donation entry",

          amount,

          currency:
            payload.currency || "USD",

          method:
            paymentMethod,

          provider,

          status,

          reference_no:
            nullable(
              payload.reference_no
            ),

          transaction_reference:
            nullable(
              payload.transaction_reference
            ),

          paid_at:
            payload.paid_at ||
            mysqlNow(),

          created_by:
            payload.created_by || null,

          created_at:
            mysqlNow(),

          updated_at:
            mysqlNow(),
        }
      );

    /* =====================================
       DONATION DETAIL
    ===================================== */

    await createDonationDetail(

      conn,

      {

        payment_id:
          paymentId,

        member_id:
          payload.member_id,

        donor_name:
          payload.full_name,

        donor_email:
          payload.email,

        phone:
          payload.phone,

        donation_category:
          donationCategory,

        donation_label:
          payload.donation_label,

        amount,

        currency:
          payload.currency || "USD",

        is_anonymous:
          payload.is_anonymous,

        dedication_name:
          payload.dedication_name,

        memorial_name:
          payload.memorial_name,

        notes:
          payload.notes,
      }
    );

    /* =====================================
       INVOICE
    ===================================== */

    const invoice =
      await createInvoice(

        conn,

        {

          payment_id:
            paymentId,

          member_id:
            payload.member_id,

          member_no:
            payload.member_no,

          full_name:
            payload.full_name,

          email:
            payload.email,

          phone:
            payload.phone,

          payment_type:
            "donation",

          category:
            "donation",

          sub_category:
            donationCategory,

          amount,

          description:

            payload.description ||

            "Donation",
        }
      );

    /* =====================================
       RECEIPT
    ===================================== */

    const receipt =
      await createReceipt(

        conn,

        {

          payment_id:
            paymentId,

          invoice_id:
            invoice.id,

          member_id:
            payload.member_id,

          payment_type:
            "donation",

          amount,

          email:
            payload.email,
        }
      );

    /* =====================================
       LEDGER
    ===================================== */

    await postPaymentEntry(

      conn,

      {

        member_id:
          payload.member_id,

        member_no:
          payload.member_no,

        full_name:
          payload.full_name,

        phone:
          payload.phone,

        payment_id:
          paymentId,

        invoice_id:
          invoice.id,

        receipt_id:
          receipt.id,

        payment_number:
          paymentNumber,

        amount,

        provider,

        reference_no:
          payload.reference_no,
      }
    );

    await conn.commit();

    return {

      success: true,

      payment_id:
        paymentId,

      payment_number:
        paymentNumber,

      invoice_id:
        invoice.id,

      receipt_id:
        receipt.id,

      receipt_number:
        receipt.receipt_number,
    };

  } catch (err) {

    await conn.rollback();

    console.error(
      "createManualDonation error:",
      err
    );

    throw err;

  } finally {

    conn.release();
  }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createManualDonation,
};