export type Theme = "light" | "dark";

const STORAGE_KEY = "scoach.theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function toggleTheme(current: Theme): Theme {
  const next: Theme = current === "light" ? "dark" : "light";
  setStoredTheme(next);
  applyTheme(next);
  return next;
}
