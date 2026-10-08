import { z } from 'zod';

/**
 * Normativlarni JSON orqali eksport / import qilish — sof mantiq.
 *
 * Bu faylda bazaga murojaat YO'Q: reja (nima yaratiladi, nima yangilanadi,
 * qayerda xato) mavjud ma'lumotlar asosida hisoblanadi. Shuning uchun:
 *  - "oldindan ko'rish" (dryRun) va haqiqiy import AYNAN bir xil rejani
 *    ishlatadi — ko'rsatilgan narsa bilan yozilgan narsa farq qilmaydi;
 *  - bazasiz test qilinadi.
 *
 * Xavfsizlik qoidalari:
 *  - import hech narsani O'CHIRMAYDI — faylda yo'q normativlar tegilmaydi;
 *  - bitta xato bo'lsa ham hech narsa yozilmaydi (hammasi yoki hech narsa);
 *  - fayldagi noma'lum maydonlar (createdAt, submissions...) e'tiborsiz.
 */

export const EXPORT_FORMAT = 'ils-normatives';
export const EXPORT_VERSION = 1;
export const MAX_IMPORT_ITEMS = 2000;

export interface DbNormative {
  id: string;
  taskNumber: number;
  title: string;
  description: string | null;
  timeLimit: number | null;
  url: string | null;
  maxScore: number;
  isActive: boolean;
  categoryId: string | null;
}

export interface DbCategory {
  id: string;
  name: string;
}

/** Eksport faylidagi bitta yozuv */
export interface ExportedNormative {
  id: string;
  taskNumber: number;
  title: string;
  description: string | null;
  timeLimit: number | null;
  url: string | null;
  maxScore: number;
  isActive: boolean;
  categoryId: string | null;
  category: string | null;
}

export function buildExport(normatives: DbNormative[], categories: DbCategory[], exportedAt = new Date()) {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const items: ExportedNormative[] = normatives.map((n) => ({
    id: n.id,
    taskNumber: n.taskNumber,
    title: n.title,
    description: n.description,
    timeLimit: n.timeLimit,
    url: n.url,
    maxScore: n.maxScore,
    isActive: n.isActive,
    categoryId: n.categoryId,
    category: n.categoryId ? catName.get(n.categoryId) ?? null : null,
  }));
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    count: items.length,
    normatives: items,
  };
}

// Bo'sh satr = qiymat yo'q (Excel/qo'lda tahrirlangan fayllarda ko'p uchraydi)
const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const itemSchema = z.object({
  id: z.preprocess(emptyToNull, z.string().uuid("id UUID bo'lishi kerak").nullable().optional()),
  taskNumber: z.number({ invalid_type_error: "taskNumber son bo'lishi kerak", required_error: 'taskNumber majburiy' })
    .int("taskNumber butun son bo'lishi kerak").positive("taskNumber musbat bo'lishi kerak"),
  title: z.string({ required_error: 'title majburiy', invalid_type_error: "title matn bo'lishi kerak" })
    .trim().min(1, "title bo'sh bo'lmasin").max(255, 'title 255 belgidan oshmasin'),
  description: z.preprocess(emptyToNull, z.string().nullable().optional()),
  timeLimit: z.number({ invalid_type_error: "timeLimit son (soniya) bo'lishi kerak" })
    .int().positive("timeLimit musbat bo'lishi kerak").nullable().optional(),
  url: z.preprocess(emptyToNull, z.string().url("url noto'g'ri formatda").nullable().optional()),
  maxScore: z.number({ invalid_type_error: "maxScore son bo'lishi kerak" })
    .int().positive("maxScore musbat bo'lishi kerak").optional(),
  isActive: z.boolean({ invalid_type_error: "isActive true/false bo'lishi kerak" }).optional(),
  category: z.preprocess(emptyToNull, z.string().trim().max(100, "category nomi 100 belgidan oshmasin").nullable().optional()),
  categoryId: z.preprocess(emptyToNull, z.string().uuid("categoryId UUID bo'lishi kerak").nullable().optional()),
});

type ImportItem = z.infer<typeof itemSchema>;

/** Taqqoslanadigan / yoziladigan maydonlar */
const FIELDS = ['taskNumber', 'title', 'description', 'timeLimit', 'url', 'maxScore', 'isActive', 'categoryId'] as const;
type Field = (typeof FIELDS)[number];

export const FIELD_LABELS: Record<Field, string> = {
  taskNumber: 'raqam',
  title: 'nomi',
  description: 'tavsif',
  timeLimit: 'vaqt',
  url: 'havola',
  maxScore: 'maks. ball',
  isActive: 'faolligi',
  categoryId: "yo'nalish",
};

export interface PlanError {
  index: number; // fayldagi tartib raqami (1 dan)
  taskNumber?: number;
  title?: string;
  message: string;
}

export interface PlannedData {
  taskNumber: number;
  title: string;
  description: string | null;
  timeLimit: number | null;
  url: string | null;
  maxScore: number;
  isActive: boolean;
  /** Mavjud yo'nalish id'si yoki yaratiladigan yangi yo'nalish nomi */
  categoryId: string | null;
  newCategoryName: string | null;
}

export interface PlannedUpdate {
  id: string;
  taskNumber: number;
  title: string;
  changes: Field[];
  data: Partial<Record<Field, unknown>> & { newCategoryName?: string | null };
}

export interface ImportPlan {
  total: number;
  create: PlannedData[];
  update: PlannedUpdate[];
  unchanged: number;
  newCategories: string[];
  errors: PlanError[];
}

/** Fayl ichidan normativlar ro'yxatini ajratadi: { normatives: [...] } yoki [...] */
export function extractItems(body: unknown): { items: unknown[] } | { error: string } {
  if (Array.isArray(body)) return { items: body };
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (b.format !== undefined && b.format !== EXPORT_FORMAT) {
      return { error: `Bu fayl normativlar eksporti emas (format: "${String(b.format)}")` };
    }
    if (Array.isArray(b.normatives)) return { items: b.normatives };
  }
  return { error: "Fayl tuzilishi noto'g'ri: { \"normatives\": [...] } yoki [...] kutilgan" };
}

const norm = (s: string) => s.trim().toLowerCase();

export function planImport(rawItems: unknown[], db: DbNormative[], categories: DbCategory[]): ImportPlan {
  const plan: ImportPlan = { total: rawItems.length, create: [], update: [], unchanged: 0, newCategories: [], errors: [] };

  if (rawItems.length === 0) {
    plan.errors.push({ index: 0, message: "Faylda birorta ham normativ yo'q" });
    return plan;
  }
  if (rawItems.length > MAX_IMPORT_ITEMS) {
    plan.errors.push({ index: 0, message: `Bir martada ${MAX_IMPORT_ITEMS} tadan ko'p normativ import qilib bo'lmaydi` });
    return plan;
  }

  const byId = new Map(db.map((n) => [n.id, n]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const catByName = new Map(categories.map((c) => [norm(c.name), c]));
  const newCats = new Map<string, string>(); // norm(name) -> asl yozilishi

  // Yo'nalish + raqam bo'yicha mavjudlar (id ko'rsatilmagan yozuvlar uchun)
  const keyOf = (taskNumber: number, catKey: string | null) => `${catKey ?? '-'}#${taskNumber}`;
  const byKey = new Map<string, DbNormative[]>();
  for (const n of db) {
    const k = keyOf(n.taskNumber, n.categoryId);
    byKey.set(k, [...(byKey.get(k) ?? []), n]);
  }

  const touchedIds = new Set<string>();
  const createKeys = new Set<string>();

  rawItems.forEach((raw, i) => {
    const index = i + 1;
    const parsed = itemSchema.safeParse(raw);
    if (!parsed.success) {
      const r = (raw ?? {}) as Record<string, unknown>;
      plan.errors.push({
        index,
        taskNumber: typeof r.taskNumber === 'number' ? r.taskNumber : undefined,
        title: typeof r.title === 'string' ? r.title : undefined,
        message: parsed.error.issues.map((x) => x.message).join('; '),
      });
      return;
    }
    const it: ImportItem = parsed.data;
    const fail = (message: string) => plan.errors.push({ index, taskNumber: it.taskNumber, title: it.title, message });

    // ── Yo'nalishni aniqlash: id -> nom -> yangi ──
    let categoryId: string | null = null;
    let newCategoryName: string | null = null;
    if (it.categoryId && catById.has(it.categoryId)) {
      categoryId = it.categoryId;
    } else if (it.category) {
      const found = catByName.get(norm(it.category));
      if (found) categoryId = found.id;
      else {
        newCategoryName = newCats.get(norm(it.category)) ?? it.category.trim();
        newCats.set(norm(it.category), newCategoryName);
      }
    } else if (it.categoryId) {
      return fail(`categoryId (${it.categoryId}) bu tizimda yo'q va yo'nalish nomi (category) berilmagan`);
    }
    const catKey = categoryId ?? (newCategoryName ? `new:${norm(newCategoryName)}` : null);

    // ── Mavjud normativni topish: id -> (yo'nalish + raqam) ──
    let target: DbNormative | undefined = it.id ? byId.get(it.id) : undefined;
    if (!target && !newCategoryName) {
      const matches = byKey.get(keyOf(it.taskNumber, categoryId)) ?? [];
      if (matches.length > 1) {
        return fail(`Bu yo'nalishda ${it.taskNumber}-raqamli normativ ${matches.length} ta — qaysi biri ekanini aniqlash uchun "id" ko'rsating`);
      }
      target = matches[0];
    }

    if (target) {
      if (touchedIds.has(target.id)) return fail('Shu normativ faylda ikki marta uchradi');
      touchedIds.add(target.id);

      const next: Record<Field, unknown> = {
        taskNumber: it.taskNumber,
        title: it.title,
        description: it.description === undefined ? target.description : it.description,
        timeLimit: it.timeLimit === undefined ? target.timeLimit : it.timeLimit,
        url: it.url === undefined ? target.url : it.url,
        maxScore: it.maxScore ?? target.maxScore,
        isActive: it.isActive ?? target.isActive,
        categoryId:
          newCategoryName || categoryId || it.category !== undefined || it.categoryId !== undefined
            ? categoryId
            : target.categoryId,
      };
      const changes = FIELDS.filter((f) => (f === 'categoryId' && newCategoryName) || next[f] !== (target as any)[f]);
      if (changes.length === 0) {
        plan.unchanged++;
        return;
      }
      const data: PlannedUpdate['data'] = {};
      for (const f of changes) data[f] = next[f];
      if (newCategoryName) data.newCategoryName = newCategoryName;
      plan.update.push({ id: target.id, taskNumber: it.taskNumber, title: it.title, changes, data });
      return;
    }

    const ck = keyOf(it.taskNumber, catKey);
    if (createKeys.has(ck)) return fail(`Faylda bir yo'nalishda ${it.taskNumber}-raqamli yangi normativ ikki marta uchradi`);
    createKeys.add(ck);
    plan.create.push({
      taskNumber: it.taskNumber,
      title: it.title,
      description: it.description ?? null,
      timeLimit: it.timeLimit ?? null,
      url: it.url ?? null,
      maxScore: it.maxScore ?? 40,
      isActive: it.isActive ?? true,
      categoryId,
      newCategoryName,
    });
  });

  plan.newCategories = [...newCats.values()];
  return plan;
}
