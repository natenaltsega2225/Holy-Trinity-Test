//backend\services\domains\donations\programs\schoolPaymentService.js
"use strict";

const pool = require("../../../db");

const {
  clean,
  money,
} = require("../../../utils/financeHelpers");

const {
  createPendingRegistration,
} = require("./programRegistrationService");

/* =========================================================
   LOAD SCHOOL PROGRAM
========================================================= */

async function getSchoolProgram(
  conn,
  eventId
) {

  const [[event]] =
    await conn.query(
      `
      SELECT
        id,
        category,
        title,
        subtitle,

        start_date,
        end_date,

        capacity,

        registration_enabled,
        is_published,

        price_per_person

      FROM tbl_news_events

      WHERE id = ?
        AND category = 'kids'

      LIMIT 1
      `,
      [eventId]
    );

  return event || null;
}

/* =========================================================
   VALIDATE SCHOOL PROGRAM
========================================================= */

async function validateSchoolProgram(
  conn,
  event
) {

  if (!event) {

    throw new Error(
      "School program not found."
    );
  }

  if (
    !Number(event.is_published)
  ) {

    throw new Error(
      "Program is not published."
    );
  }

  if (
    !Number(
      event.registration_enabled
    )
  ) {

    throw new Error(
      "Registration is closed."
    );
  }

  const price =
    Number(
      event.price_per_person || 0
    );

  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {

    throw new Error(
      "Program pricing is not configured."
    );
  }

  return true;
}

/* =========================================================
   CHECK CAPACITY
========================================================= */

async function validateSchoolCapacity(

  conn,

  eventId,

  quantity
) {

  const [[row]] =
    await conn.query(
      `
      SELECT

        e.capacity,

        COALESCE(
          SUM(r.quantity),
          0
        ) AS used

      FROM tbl_news_events e

      LEFT JOIN tbl_event_program_registrations r
        ON r.news_event_id = e.id
        AND r.status IN (
          'pending',
          'paid'
        )

      WHERE e.id = ?

      GROUP BY e.id

      LIMIT 1
      `,
      [eventId]
    );

  const capacity =
    Number(
      row?.capacity || 0
    );

  if (!capacity) {
    return true;
  }

  const used =
    Number(
      row?.used || 0
    );

  if (
    used + quantity >
    capacity
  ) {

    throw new Error(
      "Not enough seats available."
    );
  }

  return true;
}
/* =========================================================
   CREATE SCHOOL CHECKOUT PAYLOAD
========================================================= */

async function buildSchoolPaymentPayload(
  payload = {}
) {

  const conn =
    await pool.getConnection();

  try {

    await conn.beginTransaction();

    const eventId =
      Number(
        payload.news_event_id ||

        payload.program_id ||

        0
      );

    if (!eventId) {

      throw new Error(
        "Program id is required."
      );
    }

    const quantity =
      Math.max(
        1,
        Number(
          payload.quantity || 1
        )
      );

    const event =
      await getSchoolProgram(
        conn,
        eventId
      );

    await validateSchoolProgram(
      conn,
      event
    );

    await validateSchoolCapacity(
      conn,
      eventId,
      quantity
    );

    const price =
      money(
        event.price_per_person
      );

    const registration =
      await createPendingRegistration(
        conn,
        {

          news_event_id:
            event.id,

          category:
            "kids",

          member_id:
            payload.member_id,

          full_name:
            payload.full_name,

          email:
            payload.email,

          phone:
            payload.phone,

          quantity,

          participants:
            payload.participants,

          notes:
            payload.notes,

          price_per_person:
            price,
        }
      );

    await conn.commit();

    return {

      ok: true,

      registration_id:
        registration.registration_id,

      payment_payload: {

        payment_type:
          "school",

        category:
          "school",

        sub_category:
          clean(
            event.title,
            160
          ),

        amount:
          registration.total_amount,

        quantity,

        member_id:
          payload.member_id ||

          null,

        full_name:
          payload.full_name,

        email:
          payload.email,

        phone:
          payload.phone,

        related_entity_id:
          event.id,

        related_entity_type:
          "news_event",

        registration_id:
          registration.registration_id,

        news_event_id:
          event.id,

        program_name:
          event.title,

        participants:
          payload.participants ||
          [],
      },
    };

  } catch (err) {

    await conn.rollback();

    throw err;

  } finally {

    conn.release();
  }
}

module.exports = {

  getSchoolProgram,

  validateSchoolProgram,

  validateSchoolCapacity,

  buildSchoolPaymentPayload,
};