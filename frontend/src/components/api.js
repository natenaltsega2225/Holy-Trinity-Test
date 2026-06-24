


// // src/components/api.js
// import axios from "axios";

// /* =========================================================
//    BASE URL NORMALIZATION
//    - baseURL always ends with /api
//    - request URLs are cleaned so /api/api never happens
// ========================================================= */

// function normalizeBaseURL(rawValue) {
//   const raw = String(rawValue || "").trim();

//   if (!raw) {
//     return import.meta.env.DEV
//       ? "http://localhost:5000/api"
//       : `${window.location.origin}/api`;
//   }

//   const trimmed = raw.replace(/\/+$/, "");

//   return /\/api$/i.test(trimmed)
//     ? trimmed
//     : `${trimmed}/api`;
// }

// const baseURL = normalizeBaseURL(
//   import.meta.env.VITE_API_URL
// );

// let accessToken = "";

// /* =========================================================
//    TOKEN HELPERS
// ========================================================= */

// export function setAccessToken(token) {
//   accessToken = token || "";

//   try {
//     if (accessToken) {
//       localStorage.setItem("ht_token", accessToken);
//     } else {
//       localStorage.removeItem("ht_token");
//     }
//   } catch {}
// }

// export function getAccessToken() {
//   if (accessToken) return accessToken;

//   try {
//     accessToken = localStorage.getItem("ht_token") || "";
//   } catch {
//     accessToken = "";
//   }

//   return accessToken;
// }

// export function clearAuthStorage() {
//   accessToken = "";

//   try {
//     localStorage.removeItem("ht_token");
//     localStorage.removeItem("ht_user");
//   } catch {}
// }

// export function getBaseURL() {
//   return baseURL;
// }

// /* =========================================================
//    REQUEST URL NORMALIZER
//    Converts:
//    /api/finance/payments -> /finance/payments
//    api/finance/payments  -> /finance/payments
// ========================================================= */

// function normalizeRequestURL(url = "") {
//   if (!url) return url;

//   const value = String(url);

//   if (/^https?:\/\//i.test(value)) {
//     return value;
//   }

//   let cleaned = value.trim();

//   cleaned = cleaned.replace(/^\/+/, "/");

//   if (!cleaned.startsWith("/")) {
//     cleaned = `/${cleaned}`;
//   }

//   cleaned = cleaned.replace(/^\/api(?=\/)/i, "");

//   return cleaned || "/";
// }

// /* =========================================================
//    AXIOS INSTANCE
// ========================================================= */

// const api = axios.create({
//   baseURL,
//   timeout: 30000,
//   withCredentials: true,
// });

// /* =========================================================
//    REQUEST INTERCEPTOR
// ========================================================= */

// api.interceptors.request.use(
//   (config) => {
//     config.url = normalizeRequestURL(config.url);

//     const token = getAccessToken();

//     if (token) {
//       config.headers = config.headers || {};
//       config.headers.Authorization = `Bearer ${token}`;
//     }

//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// /* =========================================================
//    REFRESH TOKEN LOCK
// ========================================================= */

// let refreshPromise = null;

// async function refreshTokenOnce() {
//   if (!refreshPromise) {
//     refreshPromise = api
//       .post(
//         "/auth/refresh",
//         {},
//         {
//           withCredentials: true,
//         }
//       )
//       .then((res) => {
//         if (res?.data?.token) {
//           setAccessToken(res.data.token);
//         } else {
//           clearAuthStorage();
//           throw new Error(
//             "Refresh token response did not return a new access token."
//           );
//         }

//         if (res?.data?.user) {
//           try {
//             localStorage.setItem(
//               "ht_user",
//               JSON.stringify(res.data.user)
//             );
//           } catch {}
//         }

//         return res;
//       })
//       .catch((err) => {
//         clearAuthStorage();
//         throw err;
//       })
//       .finally(() => {
//         refreshPromise = null;
//       });
//   }

//   return refreshPromise;
// }

// /* =========================================================
//    RESPONSE INTERCEPTOR
// ========================================================= */

// api.interceptors.response.use(
//   (response) => response,

//   async (error) => {
//     const status = error?.response?.status;
//     const original = error?.config;

//     if (!original) {
//       return Promise.reject(error);
//     }

//     const url = String(original.url || "");

//     const isRefreshRequest = url.includes("/auth/refresh");
//     const isLoginRequest = url.includes("/auth/login");
//     const isRegisterRequest = url.includes("/auth/register");
//     const isLogoutRequest = url.includes("/auth/logout");

//     if (
//       isRefreshRequest ||
//       isLoginRequest ||
//       isRegisterRequest ||
//       isLogoutRequest
//     ) {
//       return Promise.reject(error);
//     }

//     if (status === 401 && !original._retry) {
//       original._retry = true;

//       try {
//         await refreshTokenOnce();

//         const nextToken = getAccessToken();

//         original.headers = original.headers || {};

//         if (nextToken) {
//           original.headers.Authorization = `Bearer ${nextToken}`;
//         }

//         original.url = normalizeRequestURL(original.url);

//         return api(original);
//       } catch {
//         clearAuthStorage();

//         if (
//           typeof window !== "undefined" &&
//           !window.location.pathname.includes("/login")
//         ) {
//           window.location.assign("/login");
//         }

//         return Promise.reject(error);
//       }
//     }

//     if (status === 401) {
//       clearAuthStorage();
//     }

//     return Promise.reject(error);
//   }
// );

// export default api;

// /* =========================================================
//    FILE URL HELPER
// ========================================================= */

// export function getFileURL(fileUrl = "") {
//   if (!fileUrl) return "";

//   if (/^https?:\/\//i.test(fileUrl)) {
//     return fileUrl;
//   }

//   const base = baseURL.replace(/\/api$/i, "");
//   const path = String(fileUrl).startsWith("/")
//     ? fileUrl
//     : `/${fileUrl}`;

//   return `${base}${path}`;
// }


// src/components/api.js

import axios from "axios";

/* =========================================================
   BASE URL
========================================================= */

function normalizeBaseURL(rawValue) {
  const raw = String(rawValue || "").trim();

  if (!raw) {
    return import.meta.env.DEV
      ? "http://localhost:5000/api"
      : `${window.location.origin}/api`;
  }

  const trimmed = raw.replace(/\/+$/, "");

  return /\/api$/i.test(trimmed)
    ? trimmed
    : `${trimmed}/api`;
}

const baseURL = normalizeBaseURL(
  import.meta.env.VITE_API_URL
);

let accessToken = "";

/* =========================================================
   TOKEN HELPERS
========================================================= */

export function setAccessToken(token) {
  accessToken = token || "";

  try {
    if (accessToken) {
      localStorage.setItem("ht_token", accessToken);
    } else {
      localStorage.removeItem("ht_token");
    }
  } catch {}
}

export function getAccessToken() {
  if (accessToken) return accessToken;

  try {
    accessToken =
      localStorage.getItem("ht_token") || "";
  } catch {
    accessToken = "";
  }

  return accessToken;
}

export function clearAuthStorage() {
  accessToken = "";

  try {
    localStorage.removeItem("ht_token");
    localStorage.removeItem("ht_user");
    localStorage.removeItem("ht_mfa_user_id");
    localStorage.removeItem("ht_mfa_required");
  } catch {}
}

export function getBaseURL() {
  return baseURL;
}

/* =========================================================
   REQUEST URL NORMALIZER
========================================================= */

function normalizeRequestURL(url = "") {
  if (!url) return url;

  const value = String(url).trim();

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  let cleaned = value.replace(/^\/+/, "/");

  if (!cleaned.startsWith("/")) {
    cleaned = `/${cleaned}`;
  }

  cleaned = cleaned.replace(/^\/api(?=\/)/i, "");

  return cleaned || "/";
}

/* =========================================================
   AXIOS INSTANCE
========================================================= */

const api = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

/* =========================================================
   REQUEST INTERCEPTOR
========================================================= */

api.interceptors.request.use(
  (config) => {
    config.url = normalizeRequestURL(config.url);

    const token = getAccessToken();

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* =========================================================
   REFRESH TOKEN LOCK
========================================================= */

let refreshPromise = null;

async function refreshTokenOnce() {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh", {}, {
        withCredentials: true,
      })
      .then((res) => {
        const token = res?.data?.token;

        if (!token) {
          clearAuthStorage();
          throw new Error(
            "Refresh token response did not return access token."
          );
        }

        setAccessToken(token);

        if (res?.data?.user) {
          localStorage.setItem(
            "ht_user",
            JSON.stringify(res.data.user)
          );
        }

        return res;
      })
      .catch((err) => {
        clearAuthStorage();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

/* =========================================================
   RESPONSE INTERCEPTOR
========================================================= */

api.interceptors.response.use(
  (response) => {
    const data = response?.data || {};

    if (data?.mfa_required) {
      try {
        localStorage.setItem(
          "ht_mfa_required",
          "1"
        );

        if (data.user_id) {
          localStorage.setItem(
            "ht_mfa_user_id",
            String(data.user_id)
          );
        }
      } catch {}
    }

    return response;
  },

  async (error) => {
    const status = error?.response?.status;
    const original = error?.config;

    if (!original) {
      return Promise.reject(error);
    }

    const url = String(original.url || "");

    const authSkip =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/logout") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/mfa/verify") ||
      url.includes("/auth/mfa/setup") ||
      url.includes("/auth/mfa/enable");

    if (authSkip) {
      return Promise.reject(error);
    }

    if (status === 401 && !original._retry) {
      original._retry = true;

      try {
        await refreshTokenOnce();

        const nextToken = getAccessToken();

        original.headers = original.headers || {};

        if (nextToken) {
          original.headers.Authorization = `Bearer ${nextToken}`;
        }

        original.url = normalizeRequestURL(original.url);

        return api(original);
      } catch {
        clearAuthStorage();

        if (
          typeof window !== "undefined" &&
          !window.location.pathname.includes("/login")
        ) {
          window.location.assign("/login");
        }

        return Promise.reject(error);
      }
    }

    if (status === 401) {
      clearAuthStorage();
    }

    return Promise.reject(error);
  }
);

export default api;

/* =========================================================
   LOGOUT HELPER
========================================================= */

export async function logout() {
  try {
    await api.post("/auth/logout", {}, {
      withCredentials: true,
    });
  } catch {
  } finally {
    clearAuthStorage();
  }
}

/* =========================================================
   FILE URL HELPER
========================================================= */

export function getFileURL(fileUrl = "") {
  if (!fileUrl) return "";

  if (/^https?:\/\//i.test(fileUrl)) {
    return fileUrl;
  }

  const base = baseURL.replace(/\/api$/i, "");
  const path = String(fileUrl).startsWith("/")
    ? fileUrl
    : `/${fileUrl}`;

  return `${base}${path}`;
}

