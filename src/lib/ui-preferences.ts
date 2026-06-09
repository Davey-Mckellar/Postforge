import { lsKey } from "@/lib/storage";

const KEY = lsKey("ui_prefs_v1");

export type UiPreferences = {
  /** Multiplier for root font size (0.85–1.35). */
  fontScale: number;
  /** Shell palette: dark (default), OLED black, or light gray. */
  appearance: "dark" | "oled" | "light";
  /** User opted in to Notification API prompts / toasts that can use system notifications. */
  notificationsEnabled: boolean;
};

const DEFAULTS: UiPreferences = {
  fontScale: 1,
  appearance: "dark",
  notificationsEnabled: false,
};

function clampScale(n: number): number {
  if (!Number.isFinite(n)) return DEFAULTS.fontScale;
  return Math.min(1.35, Math.max(0.85, Math.round(n * 100) / 100));
}

export function loadUiPreferences(): UiPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<UiPreferences>;
    const legacy = p as { theme?: string };
    let appearance: UiPreferences["appearance"] = "dark";
    if (p.appearance === "light" || p.appearance === "oled") appearance = p.appearance;
    else if (legacy.theme === "light") appearance = "light";

    return {
      fontScale: clampScale(typeof p.fontScale === "number" ? p.fontScale : DEFAULTS.fontScale),
      appearance,
      notificationsEnabled: Boolean(p.notificationsEnabled),
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveUiPreferences(next: UiPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    KEY,
    JSON.stringify({
      ...next,
      fontScale: clampScale(next.fontScale),
    }),
  );
}

/** Apply CSS variables + html classes (call on load and after save). */
export function applyUiPreferences(p: UiPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--bbgpt-font-scale", String(p.fontScale));
  root.dataset.bbgptAppearance = p.appearance;
  root.classList.toggle("bbgpt-appearance-light", p.appearance === "light");
  root.classList.toggle("bbgpt-appearance-oled", p.appearance === "oled");
}

/** Outer app root background (fills viewport). */
export function appRootBgClass(appearance: UiPreferences["appearance"]): string {
  if (appearance === "light") return "bg-zinc-100";
  if (appearance === "oled") return "bg-black";
  return "bg-zinc-950";
}

/** Header strip classes (stacked on small screens, row from md). */
export function headerShellClass(appearance: UiPreferences["appearance"]): string {
  const layout =
    "flex flex-col gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3";
  if (appearance === "light") {
    return `${layout} border-b border-zinc-200 bg-white/95 text-zinc-900 shadow-sm backdrop-blur`;
  }
  if (appearance === "oled") {
    return `${layout} border-b border-zinc-800 bg-black/70 backdrop-blur`;
  }
  return `${layout} border-b border-zinc-900 bg-zinc-950/60 backdrop-blur`;
}

/** Sub-banner (streaming / errors) row. */
export function subBannerClass(appearance: UiPreferences["appearance"]): string {
  if (appearance === "light") {
    return "flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-200/60 px-4 py-2";
  }
  if (appearance === "oled") {
    return "flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/40 px-4 py-2";
  }
  return "flex items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-900/40 px-4 py-2";
}

/** Main chat column (inside Sidebar row): mood gradient or light neutral. */
export function mainChatShellClass(appearance: UiPreferences["appearance"], moodShellClass: string): string {
  const base =
    "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[background,box-shadow] duration-700";
  if (appearance === "light") {
    return `${base} bg-zinc-100 ring-1 ring-zinc-200/40`;
  }
  return `${base} ${moodShellClass}`;
}

export function footerShellClass(appearance: UiPreferences["appearance"]): string {
  if (appearance === "light") {
    return "shrink-0 border-t border-zinc-200 bg-zinc-50 px-3 py-1.5 text-center text-[10px] text-zinc-600";
  }
  if (appearance === "oled") {
    return "shrink-0 border-t border-zinc-800 bg-black px-3 py-1.5 text-center text-[10px] text-zinc-500";
  }
  return "shrink-0 border-t border-zinc-900/80 px-3 py-1.5 text-center text-[10px] text-zinc-600";
}

export async function tryEnableDesktopNotifications(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}
