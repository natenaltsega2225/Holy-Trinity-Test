// backend/services/domains/cache/cacheService.js
"use strict";

/* =========================================================
   SIMPLE MEMORY CACHE
========================================================= */

const cacheStore =
  new Map();

/* =========================================================
   HELPERS
========================================================= */

function now() {

  return Date.now();
}

function buildCacheItem({

  value,

  ttlSeconds,
}) {

  return {

    value,

    expires_at:

      ttlSeconds > 0

        ? now() +
          ttlSeconds * 1000

        : null,
  };
}

function isExpired(
  item
) {

  if (
    !item
  ) {

    return true;
  }

  if (
    item.expires_at === null
  ) {

    return false;
  }

  return now() >
    item.expires_at;
}

/* =========================================================
   SET
========================================================= */

async function setCache(

  key,

  value,

  ttlSeconds = 300
) {

  cacheStore.set(

    String(key),

    buildCacheItem({

      value,

      ttlSeconds,
    })
  );

  return true;
}

/* =========================================================
   GET
========================================================= */

async function getCache(
  key
) {

  const item =
    cacheStore.get(
      String(key)
    );

  if (
    !item
  ) {

    return null;
  }

  if (
    isExpired(item)
  ) {

    cacheStore.delete(
      String(key)
    );

    return null;
  }

  return item.value;
}

/* =========================================================
   DELETE
========================================================= */

async function deleteCache(
  key
) {

  return cacheStore.delete(
    String(key)
  );
}

/* =========================================================
   CLEAR ALL
========================================================= */

async function clearCache() {

  cacheStore.clear();

  return true;
}

/* =========================================================
   REMEMBER
========================================================= */

async function remember(

  key,

  ttlSeconds,

  callback
) {

  const cached =
    await getCache(
      key
    );

  if (
    cached !== null
  ) {

    return cached;
  }

  const fresh =
    await callback();

  await setCache(

    key,

    fresh,

    ttlSeconds
  );

  return fresh;
}

/* =========================================================
   INVALIDATE PREFIX
========================================================= */

async function invalidatePrefix(
  prefix
) {

  let deleted = 0;

  for (const key of cacheStore.keys()) {

    if (
      key.startsWith(prefix)
    ) {

      cacheStore.delete(
        key
      );

      deleted++;
    }
  }

  return {

    success: true,

    deleted,
  };
}

/* =========================================================
   CACHE KEYS
========================================================= */

const CACHE_KEYS = {

  DASHBOARD:
    "dashboard:",

  ANALYTICS:
    "analytics:",

  MEMBERS:
    "members:",

  FINANCE:
    "finance:",

  EVENTS:
    "events:",

  SETTINGS:
    "settings:",
};

/* =========================================================
   DASHBOARD CACHE
========================================================= */

async function rememberDashboard(

  role,

  callback,

  ttlSeconds = 120
) {

  return remember(

    `${CACHE_KEYS.DASHBOARD}${role}`,

    ttlSeconds,

    callback
  );
}

/* =========================================================
   ANALYTICS CACHE
========================================================= */

async function rememberAnalytics(

  key,

  callback,

  ttlSeconds = 300
) {

  return remember(

    `${CACHE_KEYS.ANALYTICS}${key}`,

    ttlSeconds,

    callback
  );
}

/* =========================================================
   MEMBER CACHE
========================================================= */

async function rememberMember(

  memberId,

  callback,

  ttlSeconds = 180
) {

  return remember(

    `${CACHE_KEYS.MEMBERS}${memberId}`,

    ttlSeconds,

    callback
  );
}

/* =========================================================
   CACHE STATS
========================================================= */

async function getCacheStats() {

  let expired = 0;

  let active = 0;

  for (const item of cacheStore.values()) {

    if (
      isExpired(item)
    ) {

      expired++;

    } else {

      active++;
    }
  }

  return {

    total_keys:
      cacheStore.size,

    active,

    expired,
  };
}

/* =========================================================
   CLEANUP
========================================================= */

async function cleanupExpiredCache() {

  let deleted = 0;

  for (const [

    key,

    item,

  ] of cacheStore.entries()) {

    if (
      isExpired(item)
    ) {

      cacheStore.delete(
        key
      );

      deleted++;
    }
  }

  return {

    success: true,

    deleted,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  CACHE_KEYS,

  setCache,

  getCache,

  deleteCache,

  clearCache,

  remember,

  invalidatePrefix,

  rememberDashboard,

  rememberAnalytics,

  rememberMember,

  getCacheStats,

  cleanupExpiredCache,
};