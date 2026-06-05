// backend/services/domains/donations/donationService.js
// backend/services/domains/donations/donationReceiptService.js
"use strict";

const {

  findOne,

} = require(
  "../../../utils/dbHelpers"
);

const {

  donationCategoryLabel,

  publicMoney,

} = require(
  "../../../utils/financeHelpers"
);

/* =========================================================
   LOAD DONATION RECEIPT DATA
========================================================= */

async function getDonationReceiptData(

  conn,

  paymentId
) {

  const row =
    await findOne(

      conn,

      `
      SELECT

        p.id,

        p.payment_number,

        p.amount,

        p.currency,

        p.method,
        p.provider,

        p.created_at,
        p.paid_at,

        p.full_name_snapshot,
        p.email_snapshot,
        p.phone_snapshot,

        p.sub_category,

        r.id AS receipt_id,
        r.receipt_number,

        d.donation_category,
        d.donation_label,

        d.is_anonymous,

        d.dedication_name,
        d.memorial_name,

        d.notes

      FROM tbl_finance_payments p

      INNER JOIN tbl_finance_receipts r
        ON r.payment_id = p.id

      LEFT JOIN tbl_finance_donation_details d
        ON d.payment_id = p.id

      WHERE p.id = ?

      LIMIT 1
      `,

      [paymentId]
    );

  if (!row) {

    throw new Error(
      "Donation receipt data not found."
    );
  }

  return {

    receipt_id:
      row.receipt_id,

    receipt_number:
      row.receipt_number,

    payment_number:
      row.payment_number,

    donor_name:
      row.is_anonymous

        ? "Anonymous Donor"

        : row.full_name_snapshot,

    donor_email:
      row.email_snapshot,

    donor_phone:
      row.phone_snapshot,

    donation_category:
      row.donation_category,

    donation_category_label:
      donationCategoryLabel(
        row.donation_category
      ),

    donation_label:
      row.donation_label,

    amount:
      Number(
        row.amount || 0
      ),

    amount_display:
      publicMoney(
        row.amount
      ),

    currency:
      row.currency || "USD",

    method:
      row.method,

    provider:
      row.provider,

    paid_at:
      row.paid_at,

    memorial_name:
      row.memorial_name,

    dedication_name:
      row.dedication_name,

    notes:
      row.notes,

    acknowledgement_text:
      buildAcknowledgementText(
        row
      ),
  };
}

/* =========================================================
   ACKNOWLEDGEMENT TEXT
========================================================= */

function buildAcknowledgementText(
  row = {}
) {

  const parts = [];

  parts.push(
    "Thank you for your generous donation and faithful support."
  );

  if (
    row.memorial_name
  ) {

    parts.push(
      `This donation was made in memory of ${row.memorial_name}.`
    );
  }

  if (
    row.dedication_name
  ) {

    parts.push(
      `Dedicated in honor of ${row.dedication_name}.`
    );
  }

  parts.push(
    "No goods or services were provided in exchange for this contribution unless otherwise stated."
  );

  return parts.join(" ");
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  getDonationReceiptData,

  buildAcknowledgementText,
};