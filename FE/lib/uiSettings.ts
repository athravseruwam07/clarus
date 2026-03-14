export type AppTheme = "dark" | "light";

export interface UiSettings {
  theme: AppTheme;
}

export const UI_SETTINGS_STORAGE_KEY = "clarus.ui.settings.v1";
export const UI_SETTINGS_EVENT = "clarus:ui-settings-changed";

export const DEFAULT_UI_SETTINGS: UiSettings = {
  theme: "dark"
};

function toTheme(value: unknown): AppTheme {
  return value === "light" ? "light" : "dark";
}

function sanitizeUiSettings(value: unknown): UiSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_UI_SETTINGS;
  }

  const source = value as Partial<UiSettings>;
  return { theme: toTheme(source.theme) };
}

export function readUiSettings(): UiSettings {
  if (typeof window === "undefined") {
    return DEFAULT_UI_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_UI_SETTINGS;
    }

    return sanitizeUiSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_UI_SETTINGS;
  }
}

export function writeUiSettings(settings: UiSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(UI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function applyUiSettings(settings: UiSettings): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.remove("reduce-motion", "high-contrast", "minimal-effects");
  root.classList.toggle("light", settings.theme === "light");
  root.classList.toggle("dark", settings.theme === "dark");
  root.style.colorScheme = settings.theme;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UI_SETTINGS_EVENT, { detail: settings }));
  }
}

export function loadAndApplyUiSettings(): UiSettings {
  const settings = readUiSettings();
  applyUiSettings(settings);
  return settings;
}
