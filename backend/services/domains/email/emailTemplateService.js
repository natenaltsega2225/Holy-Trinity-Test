// backend/services/domains/email/emailTemplateService.js
"use strict";

/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(
  value
) {

  return String(
    value || ""
  )

    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function currency(
  amount
) {

  return `$${Number(
    amount || 0
  ).toFixed(2)}`;
}

function baseTemplate({

  title,

  content,
}) {

  return `
  <div
    style="
      font-family:
        Arial,
        sans-serif;

      background:
        #f4f6f9;

      padding:
        24px;
    "
  >

    <div
      style="
        max-width:
          700px;

        margin:
          0 auto;

        background:
          #ffffff;

        border-radius:
          10px;

        overflow:
          hidden;

        border:
          1px solid #e5e7eb;
      "
    >

      <div
        style="
          background:
            #1d4ed8;

          color:
            white;

          padding:
            20px;
        "
      >

        <h1
          style="
            margin:0;
            font-size:24px;
          "
        >
          Holy Trinity Church
        </h1>

      </div>

      <div
        style="
          padding:
            30px;
        "
      >

        <h2>
          ${escapeHtml(title)}
        </h2>

        ${content}

      </div>

      <div
        style="
          background:
            #f9fafb;

          padding:
            18px;

          font-size:
            12px;

          color:
            #6b7280;

          text-align:
            center;
        "
      >

        Holy Trinity Ethiopian Orthodox Church

      </div>

    </div>

  </div>
  `;
}

/* =========================================================
   RECEIPT EMAIL
========================================================= */

function receiptEmailTemplate(
  payload = {}
) {

  return baseTemplate({

    title:
      "Payment Receipt",

    content:
      `
      <p>
        Dear
        <strong>
          ${escapeHtml(
            payload.full_name
          )}
        </strong>,
      </p>

      <p>
        Thank you for your payment.
      </p>

      <table
        width="100%"
        cellpadding="8"
        style="
          border-collapse:
            collapse;
        "
      >

        <tr>
          <td><strong>Receipt #</strong></td>
          <td>
            ${escapeHtml(
              payload.receipt_number
            )}
          </td>
        </tr>

        <tr>
          <td><strong>Payment #</strong></td>
          <td>
            ${escapeHtml(
              payload.payment_number
            )}
          </td>
        </tr>

        <tr>
          <td><strong>Amount</strong></td>
          <td>
            ${currency(
              payload.amount
            )}
          </td>
        </tr>

        <tr>
          <td><strong>Category</strong></td>
          <td>
            ${escapeHtml(
              payload.category
            )}
          </td>
        </tr>

      </table>

      <p>
        Thank you for your support.
      </p>
      `,
  });
}

/* =========================================================
   INVOICE EMAIL
========================================================= */

function invoiceEmailTemplate(
  payload = {}
) {

  return baseTemplate({

    title:
      "Invoice Notice",

    content:
      `
      <p>
        Dear
        <strong>
          ${escapeHtml(
            payload.full_name
          )}
        </strong>,
      </p>

      <p>
        An invoice has been generated.
      </p>

      <table
        width="100%"
        cellpadding="8"
      >

        <tr>
          <td>
            <strong>
              Invoice #
            </strong>
          </td>

          <td>
            ${escapeHtml(
              payload.invoice_number
            )}
          </td>
        </tr>

        <tr>
          <td>
            <strong>
              Amount
            </strong>
          </td>

          <td>
            ${currency(
              payload.amount
            )}
          </td>
        </tr>

        <tr>
          <td>
            <strong>
              Due Date
            </strong>
          </td>

          <td>
            ${escapeHtml(
              payload.due_date
            )}
          </td>
        </tr>

      </table>
      `,
  });
}

/* =========================================================
   WELCOME EMAIL
========================================================= */

function welcomeEmailTemplate(
  payload = {}
) {

  return baseTemplate({

    title:
      "Welcome",

    content:
      `
      <p>
        Welcome
        <strong>
          ${escapeHtml(
            payload.full_name
          )}
        </strong>
      </p>

      <p>
        Your account has been created successfully.
      </p>
      `,
  });
}

/* =========================================================
   PASSWORD RESET EMAIL
========================================================= */

function passwordResetTemplate(
  payload = {}
) {

  return baseTemplate({

    title:
      "Password Reset",

    content:
      `
      <p>
        A password reset was requested.
      </p>

      <p>

        <a
          href="${escapeHtml(
            payload.reset_url
          )}"

          style="
            background:#1d4ed8;
            color:white;
            padding:12px 18px;
            text-decoration:none;
            border-radius:6px;
          "
        >

          Reset Password

        </a>

      </p>
      `,
  });
}

/* =========================================================
   EVENT REGISTRATION EMAIL
========================================================= */

function eventRegistrationTemplate(
  payload = {}
) {

  return baseTemplate({

    title:
      "Event Registration",

    content:
      `
      <p>
        You are registered for:
      </p>

      <h3>
        ${escapeHtml(
          payload.event_name
        )}
      </h3>

      <p>
        Date:
        ${escapeHtml(
          payload.event_date
        )}
      </p>

      <p>
        Location:
        ${escapeHtml(
          payload.location
        )}
      </p>
      `,
  });
}

/* =========================================================
   DONATION THANK YOU
========================================================= */

function donationThankYouTemplate(
  payload = {}
) {

  return baseTemplate({

    title:
      "Thank You For Your Donation",

    content:
      `
      <p>
        Dear
        <strong>
          ${escapeHtml(
            payload.full_name
          )}
        </strong>,
      </p>

      <p>
        Thank you for your generous donation of
        <strong>
          ${currency(
            payload.amount
          )}
        </strong>
      </p>

      <p>
        Your support is appreciated.
      </p>
      `,
  });
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  baseTemplate,

  receiptEmailTemplate,

  invoiceEmailTemplate,

  welcomeEmailTemplate,

  passwordResetTemplate,

  eventRegistrationTemplate,

  donationThankYouTemplate,
};