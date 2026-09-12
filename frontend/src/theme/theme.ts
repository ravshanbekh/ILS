/**
 * IT Live Score — theme boshqaruvi.
 *
 * Preference: 'light' | 'dark' | 'system'
 * Resolved:   'light' | 'dark'  (DOMga faqat shu ikkitasi yoziladi)
 *
 * DOM shartnomasi: <html data-theme="light|dark">.
 * Ilgari `.light` classi ishlatilardi; endi tokenlar `[data-theme]` orqali
 * bog'langan (src/index.css 2/3-bo'lim).
 *
 * Diqqat: bu modul window'ga faqat funksiya CHAQIRILGANDA murojaat qiladi,
 * import paytida emas — SSR/test muhitida xato bermasligi uchun.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const DEFAULT_PREFERENCE: ThemePreference = 'dark';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** localStorage bloklangan bo'lsa ham ilova ishlashda davom etadi. */
function safeRead(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeWrite(value: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* private rejim yoki cookie bloki — sessiya ichida ishlashda davom etadi */
  }
}

export function getPreference(): ThemePreference {
  const raw = safeRead();
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return DEFAULT_PREFERENCE;
}

export function getSystemTheme(): ResolvedTheme {
  if (!isBrowser() || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function resolveTheme(preference: ThemePreference = getPreference()): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

/** data-theme atributini yozadi. Preferenceni saqlamaydi. */
export function applyTheme(resolved: ResolvedTheme): void {
  if (!isBrowser()) return;
  document.documentElement.setAttribute('data-theme', resolved);
  // Eski `.light` classidan qutulamiz (oldingi versiyadan qolgan bo'lishi mumkin)
  document.documentElement.classList.remove('light');
}

/** Preferenceni saqlaydi va darhol qo'llaydi. */
export function setPreference(preference: ThemePreference): ResolvedTheme {
  safeWrite(preference);
  const resolved = resolveTheme(preference);
  applyTheme(resolved);
  return resolved;
}

/**
 * Tizim rejimi tanlangan bo'lsa OS o'zgarishini kuzatadi.
 * Tozalash funksiyasini qaytaradi.
 */
export function watchSystemTheme(onChange: (resolved: ResolvedTheme) => void): () => void {
  if (!isBrowser() || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const handler = () => {
    if (getPreference() !== 'system') return;
    const resolved = getSystemTheme();
    applyTheme(resolved);
    onChange(resolved);
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

/** Ilova yuklanganda bir marta chaqiriladi (index.html scripti bilan bir xil natija). */
export function initTheme(): ResolvedTheme {
  const resolved = resolveTheme();
  applyTheme(resolved);
  return resolved;
}
