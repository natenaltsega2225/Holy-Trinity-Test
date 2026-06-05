//frontend\src\context\PublicSettingsContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "../components/api";
import ThemeStyleInjector from "../components/ThemeStyleInjector";

const FALLBACK_PUBLIC_SETTINGS = {
  general: {
    churchName: "Holy Trinity EOTC",
    supportEmail: "holytrinityeotctn@gmail.com",
    contactPhone: "(615) 554-0638",
    address: "2558 Couchville Pike, Nashville, TN 37217",
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=2558+Couchville+Pike+Nashville+TN+37217",
  },
  branding: {
    footerText:
      "© 2024 Holy Trinity Ethiopian Orthodox Tewahedo Church. All rights reserved.",
    logoUrl: "/src/assets/images/church logo.jpeg",
    showPublicBanner: true,
    publicBannerText: "Serving faith, family, and community with excellence.",
    loginWelcomeText: "Welcome back to the Holy Trinity EOTC admin portal.",
    primaryColor: "#2563eb",
    secondaryColor: "#0f172a",
    accentColor: "#f59e0b",
  },
};

const defaultContextValue = {
  settings: FALLBACK_PUBLIC_SETTINGS,
  loading: false,
  error: "",
  refreshSettings: async () => FALLBACK_PUBLIC_SETTINGS,
  applyLocalSettings: () => {},
};

const PublicSettingsContext = createContext(defaultContextValue);

function mergePublicSettings(base, incoming) {
  return {
    general: {
      ...base.general,
      ...(incoming?.general || {}),
    },
    branding: {
      ...base.branding,
      ...(incoming?.branding || {}),
    },
  };
}

export function PublicSettingsProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK_PUBLIC_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const inflightRef = useRef(null);

  const refreshSettings = useCallback(async () => {
    if (inflightRef.current) return inflightRef.current;

    const request = (async () => {
      try {
        setLoading(true);
        setError("");

        const { data } = await api.get("/settings/public");
        const merged = mergePublicSettings(
          FALLBACK_PUBLIC_SETTINGS,
          data?.settings || {}
        );

        setSettings(merged);
        return merged;
      } catch (err) {
        console.error("Failed to load public settings:", err);
        setError(
          err?.response?.data?.error || "Failed to load public settings."
        );
        setSettings((prev) => mergePublicSettings(FALLBACK_PUBLIC_SETTINGS, prev));
        return FALLBACK_PUBLIC_SETTINGS;
      } finally {
        setLoading(false);
        inflightRef.current = null;
      }
    })();

    inflightRef.current = request;
    return request;
  }, []);

  const applyLocalSettings = useCallback((partial) => {
    setSettings((prev) => mergePublicSettings(prev, partial || {}));
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      refreshSettings,
      applyLocalSettings,
    }),
    [settings, loading, error, refreshSettings, applyLocalSettings]
  );

  return (
    <PublicSettingsContext.Provider value={value}>
      <ThemeStyleInjector settings={settings} />
      {children}
    </PublicSettingsContext.Provider>
  );
}

export function usePublicSettings() {
  return useContext(PublicSettingsContext);
}