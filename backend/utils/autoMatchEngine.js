//backend\utils\autoMatchEngine.js
"use strict";

function toCents(value) {
  const n = Number(value || 0);
  return Math.round(n * 100);
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
  const da = parseDate(a);
  const db = parseDate(b);

  if (!da || !db) return Number.POSITIVE_INFINITY;

  return Math.abs(da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24);
}

function getReference(row) {
  return normalizeText(
    row?.reference ||
      row?.reference_no ||
      row?.stripe_payment_intent_id ||
      row?.stripe_checkout_session_id ||
      row?.stripe_charge_id ||
      row?.payment_number ||
      row?.stripe_id ||
      ""
  );
}

function referenceMatches(a, b) {
  const ra = getReference(a);
  const rb = getReference(b);

  if (!ra || !rb) return false;

  return ra === rb || ra.includes(rb) || rb.includes(ra);
}

function amountMatches(a, b) {
  return toCents(a?.amount) === toCents(b?.amount);
}

function scorePair(sourceA, sourceB) {
  let score = 0;
  const reasons = [];

  if (amountMatches(sourceA, sourceB)) {
    score += 55;
    reasons.push("amount");
  }

  const dayDiff = daysBetween(
    sourceA.date || sourceA.created_at || sourceA.received_at || sourceA.paid_at,
    sourceB.date || sourceB.created_at || sourceB.received_at || sourceB.paid_at
  );

  if (dayDiff === 0) {
    score += 25;
    reasons.push("same_day");
  } else if (dayDiff <= 1) {
    score += 18;
    reasons.push("date_1_day");
  } else if (dayDiff <= 3) {
    score += 10;
    reasons.push("date_3_days");
  }

  if (referenceMatches(sourceA, sourceB)) {
    score += 30;
    reasons.push("reference");
  }

  const leftName = normalizeText(sourceA.full_name || sourceA.name || sourceA.customer_name);
  const rightName = normalizeText(sourceB.full_name || sourceB.name || sourceB.customer_name);

  if (leftName && rightName && leftName === rightName) {
    score += 10;
    reasons.push("name");
  }

  return {
    score: Math.min(score, 100),
    reasons,
  };
}

function rightKey(row) {
  return (
    row.id ??
    row.stripe_id ??
    `${getReference(row)}-${toCents(row.amount)}-${row.date || row.created_at}`
  );
}

function autoMatch(leftRows = [], rightRows = [], minScore = 70) {
  const usedRightIds = new Set();
  const matches = [];
  const unmatchedLeft = [];

  for (const left of leftRows) {
    let best = null;
    let bestScore = -1;
    let bestReasons = [];

    for (const right of rightRows) {
      const key = rightKey(right);
      if (usedRightIds.has(key)) continue;

      const result = scorePair(left, right);

      if (result.score > bestScore) {
        best = right;
        bestScore = result.score;
        bestReasons = result.reasons;
      }
    }

    if (best && bestScore >= minScore) {
      usedRightIds.add(rightKey(best));
      matches.push({
        left,
        right: best,
        score: bestScore,
        reasons: bestReasons,
      });
    } else {
      unmatchedLeft.push(left);
    }
  }

  const unmatchedRight = rightRows.filter((row) => !usedRightIds.has(rightKey(row)));

  return {
    matches,
    unmatchedLeft,
    unmatchedRight,
  };
}

module.exports = {
  toCents,
  normalizeText,
  parseDate,
  daysBetween,
  referenceMatches,
  amountMatches,
  scorePair,
  autoMatch,
};