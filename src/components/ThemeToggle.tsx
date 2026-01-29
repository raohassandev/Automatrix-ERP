"use client";

import { useEffect, useState } from "react";

const themes = ["light", "dark"] as const;
type Theme = (typeof themes)[number];

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("automatrix-theme");
    if (stored === "dark") return "dark";
    return "light";
  });

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem("automatrix-theme", theme);
  }, [theme]);

  const nextTheme: Theme = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      className="rounded-md border px-3 py-1 text-sm"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} theme`}
    >
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}
