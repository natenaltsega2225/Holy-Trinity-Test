// backend/services/domains/invoices/invoiceItemService.js
"use strict";

const db = require("../../../db");

/* =========================================================
   HELPERS
========================================================= */

function money(value) {
  return Number(value || 0);
}

/* =========================================================
   CREATE ITEM
========================================================= */

async function createInvoiceItem(
  conn,
  payload = {}
) {

  const quantity =
    Number(payload.quantity || 1);

  const unitPrice =
    money(payload.unit_price);

  const total =
    quantity * unitPrice;

  const [result] =
    await conn.query(
      `
      INSERT INTO tbl_finance_invoice_items (

        invoice_id,

        item_type,
        item_name,
        description,

        quantity,
        unit_price,
        total_price,

        metadata_json,

        created_at,
        updated_at

      ) VALUES (

        ?, ?, ?, ?,

        ?, ?, ?,

        ?,

        NOW(),
        NOW()
      )
      `,
      [

        payload.invoice_id,

        payload.item_type || null,
        payload.item_name || null,
        payload.description || null,

        quantity,
        unitPrice,
        total,

        payload.metadata_json || null,
      ]
    );

  return result.insertId;
}

/* =========================================================
   CREATE BULK ITEMS
========================================================= */

async function createInvoiceItems(
  conn,
  invoiceId,
  items = []
) {

  const ids = [];

  for (const item of items) {

    const id =
      await createInvoiceItem(
        conn,
        {
          ...item,
          invoice_id:
            invoiceId,
        }
      );

    ids.push(id);
  }

  return ids;
}

/* =========================================================
   GET ITEMS
========================================================= */

async function getInvoiceItems(
  invoiceId
) {

  const [rows] =
    await db.query(
      `
      SELECT *

      FROM tbl_finance_invoice_items

      WHERE invoice_id = ?

      ORDER BY id ASC
      `,
      [invoiceId]
    );

  return rows;
}

/* =========================================================
   BUILD MEMBERSHIP ITEMS
========================================================= */

function buildMembershipInvoiceItems(
  payload = {}
) {

  const months =
    Array.isArray(
      payload.coverage_months
    )
      ? payload.coverage_months
      : [];

  return [

    {
      item_type:
        "membership",

      item_name:
        payload.plan_name ||
        "Membership Plan",

      description:
        months.length
          ? `Coverage: ${months.join(", ")}`
          : "Membership dues",

      quantity:
        Number(
          payload.months_paid || 1
        ),

      unit_price:
        Number(
          payload.unit_price || 0
        ),
    },
  ];
}

/* =========================================================
   BUILD DONATION ITEM
========================================================= */

function buildDonationInvoiceItems(
  payload = {}
) {

  return [

    {
      item_type:
        "donation",

      item_name:
        payload.donation_category ||
        "Donation",

      description:
        payload.notes ||
        "Church donation",

      quantity: 1,

      unit_price:
        Number(
          payload.amount || 0
        ),
    },
  ];
}

/* =========================================================
   BUILD PROGRAM ITEM
========================================================= */

function buildProgramInvoiceItems(
  payload = {}
) {

  return [

    {
      item_type:
        payload.category,

      item_name:
        payload.program_name,

      description:
        payload.description ||
        "Program registration",

      quantity:
        Number(
          payload.quantity || 1
        ),

      unit_price:
        Number(
          payload.unit_price || 0
        ),
    },
  ];
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createInvoiceItem,
  createInvoiceItems,

  getInvoiceItems,

  buildMembershipInvoiceItems,
  buildDonationInvoiceItems,
  buildProgramInvoiceItems,
};