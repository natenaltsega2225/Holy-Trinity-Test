// //frontend\src\hooks\useAuth.jsx

// import React, {
//   createContext,
//   useContext,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
//   useCallback,
// } from "react";

// import api, {
//   clearAuthStorage,
//   getAccessToken,
//   setAccessToken,
// } from "../components/api";

// const AuthContext = createContext(null);

// export function landingForRole(role) {
//   const r = String(role || "").toLowerCase();

//   if (r === "super_admin") return "/dash/admin";
//   if (r === "admin") return "/dash/admin";
//   if (r === "finance") return "/dash/finance";
//   if (r === "reconciliation") return "/dash/reconciliation";

//   return "/dash/membership";
// }

// function readStoredUser() {
//   try {
//     return JSON.parse(localStorage.getItem("ht_user") || "null");
//   } catch {
//     return null;
//   }
// }

// function saveStoredUser(user) {
//   try {
//     if (user) localStorage.setItem("ht_user", JSON.stringify(user));
//     else localStorage.removeItem("ht_user");
//   } catch {}
// }

// export function AuthProvider({ children }) {
//   const [token, setTokenState] = useState(() => getAccessToken());
//   const [user, setUserState] = useState(() => readStoredUser());
//   const [booting, setBooting] = useState(true);

//   const didBoot = useRef(false);

//   const setToken = useCallback((value) => {
//     const next = value || "";
//     setTokenState(next);
//     setAccessToken(next);
//   }, []);

//   const setUser = useCallback((value) => {
//     const next = value || null;
//     setUserState(next);
//     saveStoredUser(next);
//   }, []);

//   const clearAuth = useCallback(() => {
//     clearAuthStorage();
//     setTokenState("");
//     setUserState(null);
//     saveStoredUser(null);
//   }, []);

//   const logout = useCallback(async () => {
//     try {
//       await api.post("/auth/logout", {});
//     } catch {}

//     clearAuth();
//   }, [clearAuth]);

//   const refreshSession = useCallback(
//     async ({ silent = true } = {}) => {
//       if (!silent) setBooting(true);

//       try {
//         const { data } = await api.post("/auth/refresh", {});

//         if (data?.token) setToken(data.token);
//         else setToken("");

//         if (data?.user) setUser(data.user);
//         else setUser(null);

//         return data;
//       } catch (err) {
//         clearAuth();
//         throw err;
//       } finally {
//         if (!silent) setBooting(false);
//       }
//     },
//     [clearAuth, setToken, setUser]
//   );

//   const isAuthed = Boolean(token && user);

//   const hasRole = useCallback(
//     (...roles) => {
//       const current = String(user?.role || "").toLowerCase();

//       if (current === "super_admin") return true;

//       return roles.map((r) => String(r).toLowerCase()).includes(current);
//     },
//     [user]
//   );

//   const isMember = String(user?.role || "").toLowerCase() === "member";
//   const isFinance = hasRole("finance", "admin", "super_admin");
//   const mustChangePassword = Number(user?.must_change_password || 0) === 1;

//   useEffect(() => {
//     if (didBoot.current) return;
//     didBoot.current = true;

//     let alive = true;

//     async function boot() {
//       const storedToken = getAccessToken();
//       const storedUser = readStoredUser();

//       if (!storedToken) {
//         if (alive) {
//           clearAuth();
//           setBooting(false);
//         }
//         return;
//       }

//       if (storedToken && storedUser) {
//         if (alive) {
//           setTokenState(storedToken);
//           setUserState(storedUser);
//           setBooting(false);
//         }

//         try {
//           const { data } = await api.post("/auth/refresh", {});
//           if (!alive) return;

//           if (data?.token) setToken(data.token);
//           if (data?.user) setUser(data.user);
//         } catch {
//           if (!alive) return;
//           clearAuth();
//         }

//         return;
//       }

//       try {
//         setBooting(true);

//         const { data } = await api.post("/auth/refresh", {});
//         if (!alive) return;

//         if (data?.token) setToken(data.token);
//         else setToken("");

//         if (data?.user) setUser(data.user);
//         else setUser(null);
//       } catch {
//         if (!alive) return;
//         clearAuth();
//       } finally {
//         if (alive) setBooting(false);
//       }
//     }

//     boot();

//     return () => {
//       alive = false;
//     };
//   }, [clearAuth, setToken, setUser]);

//   const value = useMemo(
//     () => ({
//       token,
//       user,
//       booting,
//       isAuthed,
//       isMember,
//       isFinance,
//       mustChangePassword,

//       memberId: user?.member_id || null,
//       memberNo: user?.member_no || null,
//       username: user?.username || null,
//       role: user?.role || null,

//       hasRole,
//       setToken,
//       setUser,
//       refreshSession,
//       logout,
//       clearAuth,
//     }),
//     [
//       token,
//       user,
//       booting,
//       isAuthed,
//       isMember,
//       isFinance,
//       mustChangePassword,
//       hasRole,
//       setToken,
//       setUser,
//       refreshSession,
//       logout,
//       clearAuth,
//     ]
//   );

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// }

// export function useAuth() {
//   return useContext(AuthContext);
// }

// frontend/src/hooks/useAuth.jsx

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import api, {
  clearAuthStorage,
  getAccessToken,
  setAccessToken,
} from "../components/api";

const AuthContext = createContext(null);

export function landingForRole(role) {
  const r = String(role || "").toLowerCase();

  if (r === "super_admin") return "/dash/admin";
  if (r === "admin") return "/dash/admin";
  if (r === "finance") return "/dash/finance";
  if (r === "reconciliation") return "/dash/reconciliation";

  return "/dash/membership";
}

function readStoredUser() {
  try {
    return JSON.parse(
      localStorage.getItem("ht_user") || "null"
    );
  } catch {
    return null;
  }
}

function saveStoredUser(user) {
  try {
    if (user) {
      localStorage.setItem(
        "ht_user",
        JSON.stringify(user)
      );
    } else {
      localStorage.removeItem("ht_user");
    }
  } catch {}
}

function isMfaPending() {
  try {
    return (
      localStorage.getItem("ht_mfa_required") === "1" &&
      Boolean(localStorage.getItem("ht_mfa_user_id"))
    );
  } catch {
    return false;
  }
}

function clearMfaPending() {
  try {
    localStorage.removeItem("ht_mfa_required");
    localStorage.removeItem("ht_mfa_user_id");
  } catch {}
}

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() =>
    getAccessToken()
  );

  const [user, setUserState] = useState(() =>
    readStoredUser()
  );

  const [booting, setBooting] = useState(true);

  const didBoot = useRef(false);

  const setToken = useCallback((value) => {
    const next = value || "";
    setTokenState(next);
    setAccessToken(next);
  }, []);

  const setUser = useCallback((value) => {
    const next = value || null;
    setUserState(next);
    saveStoredUser(next);
  }, []);

  const clearAuth = useCallback(() => {
    clearAuthStorage();
    clearMfaPending();
    setTokenState("");
    setUserState(null);
    saveStoredUser(null);
  }, []);

  const completeLogin = useCallback(
    ({ token: nextToken, user: nextUser }) => {
      clearMfaPending();

      if (nextToken) {
        setToken(nextToken);
      }

      if (nextUser) {
        setUser(nextUser);
      }

      return {
        token: nextToken || "",
        user: nextUser || null,
      };
    },
    [setToken, setUser]
  );

  const logout = useCallback(async () => {
    try {
      await api.post(
        "/auth/logout",
        {},
        {
          withCredentials: true,
        }
      );
    } catch {}

    clearAuth();
  }, [clearAuth]);

  const refreshSession = useCallback(
    async ({ silent = true } = {}) => {
      if (isMfaPending()) {
        clearAuthStorage();
        setTokenState("");
        setUserState(null);
        if (!silent) setBooting(false);
        return null;
      }

      if (!silent) setBooting(true);

      try {
        const { data } = await api.post(
          "/auth/refresh",
          {},
          {
            withCredentials: true,
          }
        );

        if (data?.token && data?.user) {
          completeLogin({
            token: data.token,
            user: data.user,
          });
        } else {
          clearAuth();
        }

        return data;
      } catch (err) {
        clearAuth();
        throw err;
      } finally {
        if (!silent) setBooting(false);
      }
    },
    [clearAuth, completeLogin]
  );

  const isAuthed = Boolean(token && user);

  const hasRole = useCallback(
    (...roles) => {
      const current = String(
        user?.role || ""
      ).toLowerCase();

      if (current === "super_admin") {
        return true;
      }

      return roles
        .map((r) =>
          String(r).toLowerCase()
        )
        .includes(current);
    },
    [user]
  );

  const isMember =
    String(user?.role || "").toLowerCase() === "member";

  const isFinance = hasRole(
    "finance",
    "admin",
    "super_admin"
  );

  const mustChangePassword =
    Number(user?.must_change_password || 0) === 1;

  useEffect(() => {
    if (didBoot.current) return;

    didBoot.current = true;

    let alive = true;

    async function boot() {
      if (isMfaPending()) {
        clearAuthStorage();

        if (alive) {
          setTokenState("");
          setUserState(null);
          setBooting(false);
        }

        return;
      }

      const storedToken = getAccessToken();
      const storedUser = readStoredUser();

      if (!storedToken) {
        if (alive) {
          clearAuth();
          setBooting(false);
        }

        return;
      }

      if (storedToken && storedUser) {
        if (alive) {
          setTokenState(storedToken);
          setUserState(storedUser);
          setBooting(false);
        }

        try {
          const { data } = await api.post(
            "/auth/refresh",
            {},
            {
              withCredentials: true,
            }
          );

          if (!alive) return;

          if (data?.token && data?.user) {
            completeLogin({
              token: data.token,
              user: data.user,
            });
          } else {
            clearAuth();
          }
        } catch {
          if (!alive) return;
          clearAuth();
        }

        return;
      }

      try {
        setBooting(true);

        const { data } = await api.post(
          "/auth/refresh",
          {},
          {
            withCredentials: true,
          }
        );

        if (!alive) return;

        if (data?.token && data?.user) {
          completeLogin({
            token: data.token,
            user: data.user,
          });
        } else {
          clearAuth();
        }
      } catch {
        if (!alive) return;
        clearAuth();
      } finally {
        if (alive) {
          setBooting(false);
        }
      }
    }

    boot();

    return () => {
      alive = false;
    };
  }, [clearAuth, completeLogin]);

  const value = useMemo(
    () => ({
      token,
      user,
      booting,
      isAuthed,
      isMember,
      isFinance,
      mustChangePassword,

      memberId: user?.member_id || null,
      memberNo: user?.member_no || null,
      username: user?.username || null,
      role: user?.role || null,

      hasRole,
      setToken,
      setUser,
      completeLogin,
      refreshSession,
      logout,
      clearAuth,
    }),
    [
      token,
      user,
      booting,
      isAuthed,
      isMember,
      isFinance,
      mustChangePassword,
      hasRole,
      setToken,
      setUser,
      completeLogin,
      refreshSession,
      logout,
      clearAuth,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}