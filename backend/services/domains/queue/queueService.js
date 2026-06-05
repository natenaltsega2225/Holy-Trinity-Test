// backend/services/domains/queue/queueService.js
"use strict";

const {

  Queue,

  Worker,

  QueueEvents,

} = require(
  "bullmq"
);

const IORedis =
  require("ioredis");

const {

  sendEmail,

} = require(
  "../notifications/notificationService"
);

const {

  createReceiptPdf,

} = require(
  "../../pdfService"
);

const {

  smartParseDocument,

} = require(
  "../documents/OCRDocumentService"
);

/* =========================================================
   REDIS
========================================================= */

const connection =
  new IORedis({

    host:
      process.env.REDIS_HOST ||
      "127.0.0.1",

    port:
      Number(
        process.env.REDIS_PORT
      ) || 6379,

    maxRetriesPerRequest:
      null,
  });

/* =========================================================
   QUEUES
========================================================= */

const QUEUES = {

  EMAIL:
    "email-queue",

  RECEIPT:
    "receipt-queue",

  OCR:
    "ocr-queue",

  EXPORT:
    "export-queue",

  ANALYTICS:
    "analytics-queue",
};

const emailQueue =
  new Queue(

    QUEUES.EMAIL,

    { connection }
  );

const receiptQueue =
  new Queue(

    QUEUES.RECEIPT,

    { connection }
  );

const ocrQueue =
  new Queue(

    QUEUES.OCR,

    { connection }
  );

/* =========================================================
   EVENTS
========================================================= */

const emailEvents =
  new QueueEvents(

    QUEUES.EMAIL,

    { connection }
  );

emailEvents.on(
  "completed",
  ({ jobId }) => {

    console.log(
      `[QUEUE EMAIL COMPLETED] ${jobId}`
    );
  }
);

emailEvents.on(
  "failed",
  ({ jobId, failedReason }) => {

    console.error(
      `[QUEUE EMAIL FAILED] ${jobId}`,
      failedReason
    );
  }
);

/* =========================================================
   EMAIL JOB
========================================================= */

async function addEmailJob(
  payload = {}
) {

  return emailQueue.add(

    "send-email",

    payload,

    {

      attempts: 3,

      backoff: {

        type:
          "exponential",

        delay: 5000,
      },

      removeOnComplete: 50,

      removeOnFail: 100,
    }
  );
}

/* =========================================================
   RECEIPT JOB
========================================================= */

async function addReceiptJob(
  payload = {}
) {

  return receiptQueue.add(

    "generate-receipt",

    payload,

    {

      attempts: 2,

      removeOnComplete: 50,

      removeOnFail: 100,
    }
  );
}

/* =========================================================
   OCR JOB
========================================================= */

async function addOcrJob(
  payload = {}
) {

  return ocrQueue.add(

    "ocr-document",

    payload,

    {

      attempts: 2,

      removeOnComplete: 50,

      removeOnFail: 100,
    }
  );
}

/* =========================================================
   EMAIL WORKER
========================================================= */

const emailWorker =
  new Worker(

    QUEUES.EMAIL,

    async (job) => {

      return sendEmail(
        job.data
      );
    },

    { connection }
  );

/* =========================================================
   RECEIPT WORKER
========================================================= */

const receiptWorker =
  new Worker(

    QUEUES.RECEIPT,

    async (job) => {

      return createReceiptPdf(
        job.data
      );
    },

    { connection }
  );

/* =========================================================
   OCR WORKER
========================================================= */

const ocrWorker =
  new Worker(

    QUEUES.OCR,

    async (job) => {

      return smartParseDocument(
        job.data.file_path
      );
    },

    { connection }
  );

/* =========================================================
   STATS
========================================================= */

async function getQueueStats() {

  const [

    emailWaiting,

    emailActive,

    receiptWaiting,

    ocrWaiting,

  ] = await Promise.all([

    emailQueue.getWaitingCount(),

    emailQueue.getActiveCount(),

    receiptQueue.getWaitingCount(),

    ocrQueue.getWaitingCount(),
  ]);

  return {

    email: {

      waiting:
        emailWaiting,

      active:
        emailActive,
    },

    receipt: {

      waiting:
        receiptWaiting,
    },

    ocr: {

      waiting:
        ocrWaiting,
    },
  };
}

/* =========================================================
   CLEAN QUEUES
========================================================= */

async function cleanQueues() {

  await Promise.all([

    emailQueue.drain(),

    receiptQueue.drain(),

    ocrQueue.drain(),
  ]);

  return {

    success: true,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  QUEUES,

  connection,

  emailQueue,

  receiptQueue,

  ocrQueue,

  addEmailJob,

  addReceiptJob,

  addOcrJob,

  getQueueStats,

  cleanQueues,
};