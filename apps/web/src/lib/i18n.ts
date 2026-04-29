export type Direction = "ltr" | "rtl";
export type UiLang = "en" | "he" | "ar";

const DIR_KEY = "scoach.dir";
const LANG_KEY = "scoach.lang";

const RTL_LANGS = new Set<UiLang>(["he", "ar"]);

export function dirForLang(lang: UiLang): Direction {
  return RTL_LANGS.has(lang) ? "rtl" : "ltr";
}

export function getStoredLang(): UiLang {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANG_KEY);
  if (stored === "en" || stored === "he" || stored === "ar") return stored;
  return "en";
}

export function setStoredLang(lang: UiLang): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANG_KEY, lang);
  setStoredDirection(dirForLang(lang));
}

export function getStoredDirection(): Direction {
  if (typeof window === "undefined") return "ltr";
  const stored = window.localStorage.getItem(DIR_KEY);
  if (stored === "ltr" || stored === "rtl") return stored;
  return dirForLang(getStoredLang());
}

export function setStoredDirection(dir: Direction): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DIR_KEY, dir);
}

export function applyDirection(dir: Direction): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.lang = dir === "rtl" ? "he" : "en";
}
