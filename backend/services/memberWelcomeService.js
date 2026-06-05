//backend\services\memberWelcomeService.js
"use strict";

const {
  sendGenericEmail,
} = require("./emailService");

const {
  publicMoney,
} = require("../utils/financeHelpers");

/* =========================================================
   BUILD WELCOME HTML
========================================================= */

function buildWelcomeHtml(
  payload = {}
) {

  const frontend =
    process.env.FRONTEND_URL ||
    "http://18.224.63.249";

  const loginUrl =
    `${frontend}/login`;

  const resetUrl =
    `${frontend}/reset-required`;

  return `

  <div
    style="
      margin:0;
      padding:40px 16px;
      background:#f1f5f9;
      font-family:Arial,Helvetica,sans-serif;
    "
  >

    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="
        max-width:760px;
        margin:auto;
        background:#ffffff;
        border-radius:18px;
        overflow:hidden;
        border:1px solid #dbe4ee;
      "
    >

      <!-- HEADER -->
      <tr>
        <td
          style="
            background:#0f2d52;
            padding:42px 32px;
            text-align:center;
          "
        >

          <h1
            style="
              margin:0;
              color:#ffffff;
              font-size:34px;
              font-weight:700;
              letter-spacing:.3px;
            "
          >
            Holy Trinity EOTC
          </h1>

          <div
            style="
              margin-top:10px;
              color:#dbeafe;
              font-size:15px;
            "
          >
            Finance & Membership Platform
          </div>

        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="padding:42px 38px;">

          <h2
            style="
              margin-top:0;
              margin-bottom:24px;
              color:#0f172a;
              font-size:30px;
              font-weight:700;
            "
          >
            Welcome To Holy Trinity EOTC
          </h2>

          <p
            style="
              margin:0 0 18px;
              font-size:16px;
              line-height:1.8;
              color:#475569;
            "
          >
            Dear
            <strong>
              ${payload.full_name || "Member"}
            </strong>,
          </p>

          <p
            style="
              margin:0 0 28px;
              font-size:16px;
              line-height:1.8;
              color:#475569;
            "
          >
            Your church membership account has been successfully created.
            Please use the temporary password below to access your account.
          </p>

          <!-- ACCOUNT TABLE -->
          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="
              border-collapse:collapse;
              margin-top:20px;
            "
          >

            <tr>
              <td
                style="
                  padding:14px;
                  border:1px solid #dbe4ee;
                  background:#f8fafc;
                  font-weight:700;
                  width:240px;
                  color:#0f172a;
                "
              >
                Member ID
              </td>

              <td
                style="
                  padding:14px;
                  border:1px solid #dbe4ee;
                  color:#334155;
                "
              >
                ${payload.member_no || "--"}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:14px;
                  border:1px solid #dbe4ee;
                  background:#f8fafc;
                  font-weight:700;
                "
              >
                Username
              </td>

              <td
                style="
                  padding:14px;
                  border:1px solid #dbe4ee;
                  color:#2563eb;
                  font-weight:600;
                "
              >
                ${payload.username || "--"}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:14px;
                  border:1px solid #dbe4ee;
                  background:#f8fafc;
                  font-weight:700;
                "
              >
                Temporary Password
              </td>

              <td
                style="
                  padding:14px;
                  border:1px solid #dbe4ee;
                  color:#b91c1c;
                  font-weight:700;
                  font-size:18px;
                  letter-spacing:1px;
                "
              >
                ${payload.temporary_password || "--"}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:14px;
                  border:1px solid #dbe4ee;
                  background:#f8fafc;
                  font-weight:700;
                "
              >
                Membership Plan
              </td>

              <td
                style="
                  padding:14px;
                  border:1px solid #dbe4ee;
                "
              >
                ${payload.plan_name || "--"}
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:14px;
                  border:1px solid #dbe4ee;
                  background:#f8fafc;
                  font-weight:700;
                "
              >
                Coverage
              </td>

              <td
                style="
                  padding:14px;
                  border:1px solid #dbe4ee;
                "
              >
                ${payload.coverage_label || "--"}
              </td>
            </tr>

          </table>

          <!-- BUTTONS -->
          <table
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="
              margin-top:34px;
            "
          >
            <tr>

              <td style="padding-right:14px;">

                <a
                  href="${loginUrl}"
                  target="_blank"
                  style="
                    background:#0f2d52;
                    color:#ffffff;
                    text-decoration:none;
                    padding:15px 28px;
                    border-radius:10px;
                    display:inline-block;
                    font-weight:700;
                    font-size:15px;
                  "
                >
                  Login To Your Account
                </a>

              </td>

              <td>

                <a
                  href="${resetUrl}"
                  target="_blank"
                  style="
                    background:#ffffff;
                    color:#0f2d52;
                    border:1px solid #0f2d52;
                    text-decoration:none;
                    padding:15px 28px;
                    border-radius:10px;
                    display:inline-block;
                    font-weight:700;
                    font-size:15px;
                  "
                >
                  Reset Password
                </a>

              </td>

            </tr>
          </table>

          <!-- SECURITY -->
          <div
            style="
              margin-top:34px;
              padding:18px 22px;
              background:#fef2f2;
              border:1px solid #fecaca;
              border-radius:12px;
              color:#991b1b;
              font-size:14px;
              line-height:1.8;
            "
          >

            For security purposes, you must change your password after your first login.

          </div>

          <!-- CONTACT -->
          <div
            style="
              margin-top:40px;
              padding:24px;
              background:#f8fafc;
              border-radius:14px;
              border:1px solid #e2e8f0;
            "
          >

            <h3
              style="
                margin-top:0;
                color:#0f172a;
                font-size:18px;
              "
            >
              Church Contact Information
            </h3>

            <p
              style="
                margin:10px 0;
                color:#475569;
                line-height:1.8;
              "
            >
              📍 2558 Couchville Pike,<br/>
              Nashville, TN 37217
            </p>

            <p
              style="
                margin:10px 0;
                color:#475569;
                line-height:1.8;
              "
            >
              📞 (615) 674-7405
            </p>

          </div>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td
          style="
            background:#f8fafc;
            border-top:1px solid #e2e8f0;
            padding:26px;
            text-align:center;
            color:#64748b;
            font-size:13px;
            line-height:1.8;
          "
        >

          Holy Trinity Ethiopian Orthodox Church<br/>
          Nashville, Tennessee

        </td>
      </tr>

    </table>

  </div>
  `;
}
/* =========================================================
   SEND WELCOME EMAIL
========================================================= */

async function sendMemberWelcomeEmail(
  payload = {}
) {

  if (!payload.email) {

    return {
      success: false,
      skipped: true,
      error:
        "No member email provided.",
    };
  }

  try {

    const result =
      await sendGenericEmail({

        to:
          payload.email,

        subject:
          "Welcome to Holy Trinity Church",

        html:
          buildWelcomeHtml(
            payload
          ),
      });

    return result;

  } catch (err) {

    console.error(
      "sendMemberWelcomeEmail error:",
      err
    );

    return {
      success: false,
      error:
        err.message,
    };
  }
}

module.exports = {

  buildWelcomeHtml,

  sendMemberWelcomeEmail,
};