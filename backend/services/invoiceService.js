//backend\services\invoiceService.js
"use strict";

/*
=========================================================
 ENTERPRISE INVOICE SERVICE
---------------------------------------------------------
 Central invoice engine

 Owns:
 - invoice creation
 - invoice numbering
 - balances
 - membership invoices
 - donation invoices
 - school/trip invoices
 - invoice status
=========================================================
*/

const {

  insertExistingColumns,

  updateExistingColumns,

} = require(
  "../utils/dbHelpers"
);

const {

  money,

  mysqlNow,

  generateNumber,

} = require(
  "../utils/financeHelpers"
);

/* =========================================================
   HELPERS
========================================================= */

function clean(
  value,
  fallback = null
) {

  const v =
    String(
      value ?? ""
    ).trim();

  return v || fallback;
}

function normalizeType(
  value
) {

  const v =
    clean(
      value,
      "other"
    ).toLowerCase();

  if (
    [
      "membership",
      "dues",
    ].includes(v)
  ) {
    return "membership";
  }

  if (
    [
      "donation",
    ].includes(v)
  ) {
    return "donation";
  }

  if (
    [
      "school",
      "kids",
    ].includes(v)
  ) {
    return "school";
  }

  if (
    [
      "trip",
    ].includes(v)
  ) {
    return "trip";
  }

  return v;
}

/* =========================================================
   CREATE INVOICE
========================================================= */

async function createInvoice(

  conn,

  payload = {}
) {

  const amount =
    money(
      payload.amount
    );

  const balanceDue =
    payload.status === "paid"
      ? 0
      : amount;

 const invoiceNumber =
  generateNumber("INV");

const invoiceId =
    await insertExistingColumns(
      conn,
      "tbl_finance_invoices",
      {

        invoice_number:
  invoiceNumber,

        member_id:
          payload.member_id || null,

        member_no:
          clean(
            payload.member_no
          ),

        full_name_snapshot:
          clean(
            payload.full_name
          ),

        email_snapshot:
          clean(
            payload.email
          ),

        phone_snapshot:
          clean(
            payload.phone
          ),

        invoice_type:
          normalizeType(
            payload.invoice_type ||
            payload.payment_type
          ),

        category:
          normalizeType(
            payload.category ||
            payload.payment_type
          ),

        sub_category:
          clean(
            payload.sub_category
          ),

        description:
          clean(
            payload.description,
            "Finance invoice"
          ),

        related_entity_id:
          payload.related_entity_id || null,

        related_entity_type:
          clean(
            payload.related_entity_type
          ),

        payment_id:
          payload.payment_id || null,

        currency:
          clean(
            payload.currency,
            "USD"
          ),

        subtotal:
          amount,

        tax_amount:
          money(
            payload.tax_amount || 0
          ),

        fee_amount:
          money(
            payload.fee_amount || 0
          ),

        discount_amount:
          money(
            payload.discount_amount || 0
          ),

        total_amount:
          amount,

        amount_paid:
          payload.status === "paid"
            ? amount
            : 0,

        balance_due:
          balanceDue,

        status:
          clean(
            payload.status,
            "paid"
          ),

        invoice_date:
          payload.invoice_date ||
          mysqlNow(),

        due_date:
          payload.due_date ||
          mysqlNow(),

        period_label:
          clean(
            payload.period_label
          ),

        period_start:
          payload.period_start || null,

        period_end:
          payload.period_end || null,

        months_paid:
          Number(
            payload.months_paid || 0
          ),

        quantity:
          Number(
            payload.quantity || 1
          ),

        notes:
          clean(
            payload.notes
          ),

        created_by:
          payload.created_by || null,

        created_at:
          mysqlNow(),

        updated_at:
          mysqlNow(),
      }
    );

    /* =============================================
   DEFAULT INVOICE ITEM
============================================= */

await createInvoiceItem(
  conn,
  {

    invoice_id:
      invoiceId,

    item_name:
      payload.item_name ||

      payload.description ||

      "Payment",

    description:
      payload.description,

    quantity:
      payload.quantity || 1,

    unit_price:
      amount,

    amount,
  }
).catch((err) => {

  console.error(
    "createInvoiceItem failed:",
    err.message
  );
});
 return {

  id:
    invoiceId,

  invoice_number:
    invoiceNumber,

  total_amount:
    amount,

  balance_due:
    balanceDue,
};
}

/* =========================================================
   MARK INVOICE PAID
========================================================= */

async function markInvoicePaid(

  conn,

  invoiceId,

  paymentId,

  amount
) {

  const amt =
    money(amount);

  await updateExistingColumns(

    conn,

    "tbl_finance_invoices",

    {

      payment_id:
        paymentId,

      amount_paid:
        amt,

      balance_due:
        0,

      status:
        "paid",

      paid_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [invoiceId]
  );
}
/* =========================================================
   MARK INVOICE PENDING
========================================================= */

async function markInvoicePending(

  conn,

  invoiceId
) {

  await updateExistingColumns(

    conn,

    "tbl_finance_invoices",

    {

      status:
        "pending",

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [invoiceId]
  );
}
/* =========================================================
   CREATE INVOICE ITEM
========================================================= */

async function createInvoiceItem(

  conn,

  payload = {}
) {

  return insertExistingColumns(
    conn,
    "tbl_finance_invoice_items",

    {

      invoice_id:
        payload.invoice_id,

      item_code:
        clean(
          payload.item_code
        ),

      item_name:
        clean(
          payload.item_name,
          "Payment"
        ),

      description:
        clean(
          payload.description
        ),

      quantity:
        Number(
          payload.quantity || 1
        ),

      unit_price:
        money(
          payload.unit_price ||
          payload.amount
        ),

      amount:
        money(
          payload.amount
        ),

      line_total:
        money(
          payload.line_total ||
          payload.amount
        ),

      created_at:
        mysqlNow(),
    }
  );
}
/* =========================================================
   MEMBERSHIP INVOICE
========================================================= */

async function createMembershipInvoice(

  conn,

  payload = {}
) {

  return createInvoice(
    conn,
    {

      ...payload,

      invoice_type:
        "membership",

      category:
        "membership",

      status:
        payload.status ||
        "paid",
    }
  );
}

/* =========================================================
   DONATION INVOICE
========================================================= */

async function createDonationInvoice(

  conn,

  payload = {}
) {

  return createInvoice(
    conn,
    {

      ...payload,

      invoice_type:
        "donation",

      category:
        "donation",

      status:
        "paid",
    }
  );
}

/* =========================================================
   SCHOOL INVOICE
========================================================= */

async function createSchoolInvoice(

  conn,

  payload = {}
) {

  return createInvoice(
    conn,
    {

      ...payload,

      invoice_type:
        "school",

      category:
        "school",

      status:
        "paid",
    }
  );
}

/* =========================================================
   TRIP INVOICE
========================================================= */

async function createTripInvoice(

  conn,

  payload = {}
) {

  return createInvoice(
    conn,
    {

      ...payload,

      invoice_type:
        "trip",

      category:
        "trip",

      status:
        "paid",
    }
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createInvoice,

  markInvoicePaid,
createInvoiceItem,

markInvoicePending,
  createMembershipInvoice,

  createDonationInvoice,

  createSchoolInvoice,

  createTripInvoice,
};