/**
 * Filiallar ro'yxati.
 *
 * Ataylab alohida jadval qilinmadi — hozircha ikkita filial bor va ular
 * kamdan-kam o'zgaradi. Yangi filial qo'shish = shu ro'yxatga bitta qator
 * (baza migratsiyasi kerak emas).
 *
 * `key` bazada saqlanadi, `label` ekranda ko'rinadi. Enum emas, chunki enum
 * qo'shish har safar migratsiya talab qilardi.
 */
export const FILIALS = [
  { key: 'sayxun', label: 'Sayxun' },
  { key: 'stomatologiya', label: 'Stomatologiya' },
] as const;

export type FilialKey = (typeof FILIALS)[number]['key'];

export const FILIAL_KEYS: string[] = FILIALS.map((f) => f.key);

/** Bazadagi kalitdan ekranda ko'rinadigan nomni oladi */
export function filialLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return FILIALS.find((f) => f.key === key)?.label ?? null;
}

/** Kalit haqiqiy filialmi? */
export function isValidFilial(key: unknown): key is FilialKey {
  return typeof key === 'string' && FILIAL_KEYS.includes(key);
}
