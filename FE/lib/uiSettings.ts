export type AppTheme = "dark" | "light";
export type AccentColor = "default" | "teal" | "violet" | "amber";
export type OptimizerPreferencePromptFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "never";

export interface UiSettings {
  theme: AppTheme;
  accent: AccentColor;
  optimizerPreferencePromptFrequency: OptimizerPreferencePromptFrequency;
}

export const UI_COOKIE_NAME = "clarus_ui";
export const UI_SETTINGS_EVENT = "clarus:ui-settings-changed";

export const DEFAULT_UI_SETTINGS: UiSettings = {
  theme: "dark",
  accent: "default",
  optimizerPreferencePromptFrequency: "weekly"
};

function toTheme(value: unknown): AppTheme {
  return value === "light" ? "light" : "dark";
}

const VALID_ACCENTS: AccentColor[] = ["default", "teal", "violet", "amber"];

function toAccent(value: unknown): AccentColor {
  return VALID_ACCENTS.includes(value as AccentColor) ? (value as AccentColor) : "default";
}

const VALID_OPTIMIZER_FREQUENCIES: OptimizerPreferencePromptFrequency[] = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "never"
];

function toOptimizerFrequency(value: unknown): OptimizerPreferencePromptFrequency {
  return VALID_OPTIMIZER_FREQUENCIES.includes(value as OptimizerPreferencePromptFrequency)
    ? (value as OptimizerPreferencePromptFrequency)
    : "weekly";
}

function sanitizeUiSettings(value: unknown): UiSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_UI_SETTINGS;
  }

  const source = value as Partial<UiSettings>;
  return {
    theme: toTheme(source.theme),
    accent: toAccent(source.accent),
    optimizerPreferencePromptFrequency: toOptimizerFrequency(source.optimizerPreferencePromptFrequency)
  };
}

export function readUiSettings(): UiSettings {
  if (typeof document === "undefined") {
    return DEFAULT_UI_SETTINGS;
  }

  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${UI_COOKIE_NAME}=`));

    if (!match) {
      return DEFAULT_UI_SETTINGS;
    }

    const value = decodeURIComponent(match.slice(UI_COOKIE_NAME.length + 1));
    return sanitizeUiSettings(JSON.parse(value));
  } catch {
    return DEFAULT_UI_SETTINGS;
  }
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

  root.classList.remove("accent-teal", "accent-violet", "accent-amber");
  if (settings.accent !== "default") {
    root.classList.add(`accent-${settings.accent}`);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UI_SETTINGS_EVENT, { detail: settings }));
  }
}

export function loadAndApplyUiSettings(): UiSettings {
  const settings = readUiSettings();
  applyUiSettings(settings);
  return settings;
}
