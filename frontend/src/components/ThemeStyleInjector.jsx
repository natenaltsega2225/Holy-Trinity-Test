import { useEffect } from "react";

function safeColor(value, fallback) {
  const v = String(value || "").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : fallback;
}

export default function ThemeStyleInjector({ settings }) {
  useEffect(() => {
    const root = document.documentElement;

    const primary = safeColor(settings?.branding?.primaryColor, "#2563eb");
    const secondary = safeColor(settings?.branding?.secondaryColor, "#0f172a");
    const accent = safeColor(settings?.branding?.accentColor, "#f59e0b");

    root.style.setProperty("--ht-primary", primary);
    root.style.setProperty("--ht-secondary", secondary);
    root.style.setProperty("--ht-accent", accent);

    return () => {
      root.style.removeProperty("--ht-primary");
      root.style.removeProperty("--ht-secondary");
      root.style.removeProperty("--ht-accent");
    };
  }, [settings]);

  return null;
}