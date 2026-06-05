//frontend\src\utils\date.js
/* =========================================================
   ENTERPRISE DATE HELPERS
========================================================= */

/* =========================================================
   SAFE DATE
========================================================= */

function safeDate(value) {

  if (!value) {
    return null;
  }

  const d =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(
    d.getTime()
  )
    ? null
    : d;
}

/* =========================================================
   PAD
========================================================= */

function pad(value) {

  return String(value)
    .padStart(2, "0");
}

/* =========================================================
   MM/DD/YYYY
========================================================= */

export function formatDateUS(
  value
) {

  const d =
    safeDate(value);

  if (!d) {
    return "--";
  }

  const mm =
    pad(
      d.getMonth() + 1
    );

  const dd =
    pad(
      d.getDate()
    );

  const yyyy =
    d.getFullYear();

  return `${mm}/${dd}/${yyyy}`;
}

/* =========================================================
   MM/DD/YYYY HH:MM AM/PM
========================================================= */

export function formatDateTimeUS(
  value
) {

  const d =
    safeDate(value);

  if (!d) {
    return "--";
  }

  const date =
    formatDateUS(d);

  const time =
    d.toLocaleTimeString(
      "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );

  return `${date} ${time}`;
}

/* =========================================================
   MYSQL DATE
========================================================= */

export function mysqlDate(
  value = new Date()
) {

  const d =
    safeDate(value);

  if (!d) {
    return null;
  }

  return (
    `${d.getFullYear()}-` +
    `${pad(d.getMonth() + 1)}-` +
    `${pad(d.getDate())}`
  );
}

/* =========================================================
   MYSQL DATETIME
========================================================= */

export function mysqlDateTime(
  value = new Date()
) {

  const d =
    safeDate(value);

  if (!d) {
    return null;
  }

  return (
    `${d.getFullYear()}-` +
    `${pad(d.getMonth() + 1)}-` +
    `${pad(d.getDate())} ` +
    `${pad(d.getHours())}:` +
    `${pad(d.getMinutes())}:` +
    `${pad(d.getSeconds())}`
  );
}

/* =========================================================
   RELATIVE LABEL
========================================================= */

export function relativeDate(
  value
) {

  const d =
    safeDate(value);

  if (!d) {
    return "--";
  }

  const now =
    new Date();

  const diff =
    now.getTime() -
    d.getTime();

  const minutes =
    Math.floor(
      diff / 60000
    );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days =
    Math.floor(
      hours / 24
    );

  if (days < 30) {
    return `${days} day ago`;
  }

  return formatDateUS(d);
}

/* =========================================================
   EXPORT DEFAULT
========================================================= */

export default {

  formatDateUS,

  formatDateTimeUS,

  mysqlDate,

  mysqlDateTime,

  relativeDate,
};