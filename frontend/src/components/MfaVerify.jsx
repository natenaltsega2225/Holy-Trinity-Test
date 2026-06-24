// src/components/MfaVerify.jsx

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "./api";
import { useAuth } from "../hooks/useAuth";

function getDashboardRoute(role) {
  switch (String(role || "").toLowerCase()) {
    case "super_admin":
    case "admin":
      return "/dash/admin";

    case "finance":
      return "/dash/finance";

    case "reconciliation":
      return "/dash/reconciliation";

    case "member":
    default:
      return "/dash/membership";
  }
}

export default function MfaVerify() {
  const navigate = useNavigate();
  const location = useLocation();
const auth = useAuth();
  const [code, setCode] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

const [userId, setUserId] = useState(null);

const [mfaSetupRequired, setMfaSetupRequired] =
  useState(false);

const [qrCode, setQrCode] =
  useState("");

const [secret, setSecret] =
  useState("");

const [setupLoading, setSetupLoading] =
  useState(true);


 useEffect(() => {
let mounted = true;



async function initialize() {
  const routeUserId =
    location.state?.userId ||
    localStorage.getItem("ht_mfa_user_id");

  if (!routeUserId) {
    navigate("/login", {
      replace: true,
    });
    return;
  }

  const numericUserId = Number(routeUserId);

  if (
    !numericUserId ||
    Number.isNaN(numericUserId)
  ) {
    navigate("/login", {
      replace: true,
    });
    return;
  }

  if (!mounted) return;

  setUserId(numericUserId);

  try {
    setSetupLoading(true);
    setError("");

    const { data } = await api.get(
      `/auth/mfa/status/${numericUserId}`,
      {
        headers: {
          "Cache-Control": "no-cache",
        },
      }
    );

    if (!mounted) return;

    const mfaEnabled =
      Boolean(data?.mfa_enabled);

    const hasSecret =
      Boolean(data?.has_mfa_secret);

    if (mfaEnabled) {
      setMfaSetupRequired(false);
      setQrCode("");
      setSecret("");
      return;
    }

    /*
    ==========================================
    MFA enrollment mode

    Important:
    Always use POST /auth/mfa/setup here.
    Backend createMfaSetup() should reuse the
    existing secret if one already exists.
    It should NOT generate a new secret unless
    mfa_secret is NULL.
    ==========================================
    */

    const setupResponse = await api.post(
      "/auth/mfa/setup",
      {
        user_id: numericUserId,
        userId: numericUserId,
      },
      {
        headers: {
          "Cache-Control": "no-cache",
        },
      }
    );

    if (!mounted) return;

    setMfaSetupRequired(true);

    setQrCode(
      setupResponse?.data?.qr_code || ""
    );

    setSecret(
      setupResponse?.data?.secret || ""
    );

    if (
      !setupResponse?.data?.qr_code &&
      !setupResponse?.data?.secret &&
      !hasSecret
    ) {
      setError(
        "MFA setup could not generate a QR code. Please contact support."
      );
    }
  } catch (err) {
    console.error("MFA INIT ERROR", err);

    if (!mounted) return;

    setError(
      err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Unable to initialize MFA."
    );
  } finally {
    if (mounted) {
      setSetupLoading(false);
    }
  }
}
 
initialize();

return () => {
mounted = false;
};
}, [location, navigate]);



 async function handleSubmit(e) {
  e.preventDefault();

  setError("");

  if (!userId) {
    setError("MFA session expired.");
    return;
  }

  if (!code || code.trim().length !== 6) {
    setError(
      "Enter a valid 6-digit authentication code."
    );
    return;
  }

  try {
    setLoading(true);

    let response;

    /*
    ==========================================
    FIRST TIME MFA ENROLLMENT
    ==========================================
    */
    if (mfaSetupRequired) {
      response = await api.post(
        "/auth/mfa/enable",
        {
          userId: Number(userId),
          token: code.trim(),
        },
        {
          withCredentials: true,
        }
      );

      if (!response?.data?.ok) {
        throw new Error(
          "Failed to enable MFA."
        );
      }

      setError("");

      alert(
        "MFA successfully enabled. Please login again."
      );

      localStorage.removeItem(
        "ht_mfa_required"
      );

      localStorage.removeItem(
        "ht_mfa_user_id"
      );

      navigate("/login", {
        replace: true,
      });

      return;
    }

console.log(
  "MFA VERIFY",
  {
    userId,
    token: code.trim(),
    setupMode:
      mfaSetupRequired,
  }
);
    /*
    ==========================================
    NORMAL MFA LOGIN
    ==========================================
    */

    response = await api.post(
      "/auth/mfa/verify",
      {
        user_id: Number(userId),
    userId: Number(userId),
    token: code.trim(),
      },
      {
        withCredentials: true,
      }
    );

    const data = response.data;

    if (!data?.token || !data?.user) {
      throw new Error(
        "Invalid MFA verification response."
      );
    }

    

  /*
==========================================
COMPLETE LOGIN
==========================================
*/

auth.setToken(data.token);
auth.setUser(data.user);

localStorage.removeItem(
  "ht_mfa_required"
);

localStorage.removeItem(
  "ht_mfa_user_id"
);

navigate(
  getDashboardRoute(data.user.role),
  {
    replace: true,
  }
);
  } catch (err) {
    console.error(
      "MFA ERROR",
      err
    );

    setError(
      err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Authentication failed."
    );
  } finally {
    setLoading(false);
  }
}


  function handleBackToLogin() {
    localStorage.removeItem(
      "ht_mfa_required"
    );

    localStorage.removeItem(
      "ht_mfa_user_id"
    );

    navigate("/login", {
      replace: true,
    });
  }

/*
==========================================
LOADING SCREEN
==========================================
*/
if (setupLoading) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: 18,
        fontWeight: 600,
      }}
    >
      Loading MFA Setup...
    </div>
  );
}

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#ffffff",
          borderRadius: 16,
          padding: 32,
          boxShadow:
            "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Multi-Factor Authentication
          </h1>

          <p
            style={{
              color: "#64748b",
              marginTop: 10,
            }}
          >
            Enter the 6-digit code from your
            Authenticator App.
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}
{mfaSetupRequired && (
  <div
    style={{
      marginBottom: 24,
      textAlign: "center",
    }}
  >
    <h3>
      Scan QR Code
    </h3>

    <p>
      Open Google Authenticator,
      Microsoft Authenticator,
      or Authy and scan
      this QR code.
    </p>

    {qrCode && (
      <img
        src={qrCode}
        alt="MFA QR"
        style={{
          width: 220,
          height: 220,
          marginBottom: 12,
        }}
      />
    )}

    <div
  style={{
    fontSize: 12,
    wordBreak: "break-all",
    color: "#64748b",
  }}
>
  Recovery Secret:
  <br />
  {secret}
</div>

<p
  style={{
    fontSize: 12,
    color: "#ef4444",
    marginTop: 8,
    lineHeight: 1.5,
  }}
>
  Store this secret securely.
  It can be used to recover MFA
  if your phone is lost, reset,
  or replaced.
</p>
  </div>
)}
        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Authentication Code
          </label>

          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            value={code}
            onChange={(e) =>
              setCode(
                e.target.value.replace(
                  /\D/g,
                  ""
                )
              )
            }
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 10,
              border:
                "1px solid #cbd5e1",
              fontSize: 18,
              letterSpacing: 4,
              textAlign: "center",
              marginBottom: 20,
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              border: "none",
              borderRadius: 10,
              padding: 14,
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {loading
  ? "Processing..."
  : mfaSetupRequired
  ? "Enable MFA"
  : "Verify Authentication"}
          </button>

          <button
            type="button"
            onClick={handleBackToLogin}
            style={{
              width: "100%",
              marginTop: 12,
              border:
                "1px solid #cbd5e1",
              borderRadius: 10,
              padding: 14,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
    
   
  );


}