
// backend/services/certificatePdfService.js

"use strict";

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const {
  renderCertificateHtml,
} = require("./certificateHtmlService");

/* =========================================================
   ENSURE DIRECTORY
========================================================= */

function ensureDirectoryExists(
  filePath
) {

  const dir =
    path.dirname(filePath);

  if (
    !fs.existsSync(dir)
  ) {

    fs.mkdirSync(dir, {
      recursive: true,
    });
  }
}

/* =========================================================
   WAIT
========================================================= */

async function wait(ms = 300) {

  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

/* =========================================================
   CREATE CERTIFICATE PDF
========================================================= */

async function createCertificatePdf({
  outputPath,
  type,
  payload = {},
  member = {},
}) {

  if (!outputPath) {

    throw new Error(
      "outputPath is required"
    );
  }

  ensureDirectoryExists(
    outputPath
  );

  /* =====================================================
     HTML
  ===================================================== */

  const html =
    renderCertificateHtml(
      type,
      payload,
      member
    );

  /* =====================================================
     BROWSER
  ===================================================== */

 const browser =
  await puppeteer.launch({

    headless: "new",

    ignoreHTTPSErrors: true,

    args: [

      "--no-sandbox",

      "--disable-setuid-sandbox",

      "--disable-dev-shm-usage",

      "--allow-file-access-from-files",

      "--enable-local-file-accesses",

      "--disable-web-security",

      "--font-render-hinting=medium",
    ],
  });
  try {

    const page =
      await browser.newPage();
await page.setBypassCSP(true);

await page.setRequestInterception(false);
    /* ===================================================
       VIEWPORT
    =================================================== */

    await page.setViewport({

      width: 1600,

      height: 1200,

      deviceScaleFactor: 2,
    });

    /* ===================================================
       CONTENT
    =================================================== */

    await page.setContent(
      html,
      {

        waitUntil: [
          "load",
          "networkidle0",
        ],
      }
    );

    /* ===================================================
       WAIT FOR FONTS
    =================================================== */

    await page.evaluateHandle(
      "document.fonts.ready"
    );

    await wait(600);

    /* ===================================================
       PDF
    =================================================== */

    await page.pdf({

      path: outputPath,

      landscape: true,

      printBackground: true,

      preferCSSPageSize: true,

      format: "Letter",

      margin: {

        top: "0in",

        right: "0in",

        bottom: "0in",

        left: "0in",
      },
    });

    /* ===================================================
       VERIFY FILE
    =================================================== */

    if (
      !fs.existsSync(
        outputPath
      )
    ) {

      throw new Error(
        "Certificate PDF was not created."
      );
    }

    const stat =
      fs.statSync(
        outputPath
      );

    if (
      stat.size < 1000
    ) {

      throw new Error(
        "Generated certificate PDF is invalid or empty."
      );
    }

    return {

      success: true,

      outputPath,

      size: stat.size,
    };

  } catch (err) {

    console.error(
      "createCertificatePdf error:",
      err
    );

    throw err;

  } finally {

    await browser.close();
  }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  createCertificatePdf,
};