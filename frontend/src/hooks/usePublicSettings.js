import { useEffect, useState } from "react";
import api from "../components/api";

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
    logoUrl: "",
    showPublicBanner: true,
    publicBannerText: "Serving faith, family, and community with excellence.",
  },
};

let cachedSettings = null;
let cachedAt = 0;
let inflightPromise = null;
const CACHE_TTL_MS = 60 * 1000;

function mergeSettings(data) {
  return {
    general: {
      ...FALLBACK_PUBLIC_SETTINGS.general,
      ...(data?.general || {}),
    },
    branding: {
      ...FALLBACK_PUBLIC_SETTINGS.branding,
      ...(data?.branding || {}),
    },
  };
}

async function fetchPublicSettings(force = false) {
  const now = Date.now();

  if (!force && cachedSettings && now - cachedAt < CACHE_TTL_MS) {
    return cachedSettings;
  }

  if (!force && inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = api
    .get("/settings/public")
    .then((res) => {
      const merged = mergeSettings(res?.data?.settings || {});
      cachedSettings = merged;
      cachedAt = Date.now();
      return merged;
    })
    .catch((err) => {
      console.error("Failed to load public settings:", err);
      const fallback = mergeSettings({});
      cachedSettings = fallback;
      cachedAt = Date.now();
      return fallback;
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

export default function usePublicSettings() {
  const [settings, setSettings] = useState(
    cachedSettings || FALLBACK_PUBLIC_SETTINGS
  );
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    let mounted = true;

    fetchPublicSettings().then((next) => {
      if (!mounted) return;
      setSettings(next);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return {
    settings,
    loading,
    refresh: async () => {
      setLoading(true);
      const next = await fetchPublicSettings(true);
      setSettings(next);
      setLoading(false);
      return next;
    },
  };
}