/**
 * Foundation normativlarini 2026 yangi tahririga o'tkazish (bir martalik, idempotent).
 *
 * Manba: foundation-2026.seed.json (E:\normativlar-2026 quruvchisidan, 35 ta; 2-normativ 50+ WPM).
 *
 * Nima qiladi:
 *   1. "Foundation 2026" yo'nalishida yangi normativlarni yaratadi (borlari qayta yaratilmaydi);
 *   2. eskisi bilan BIR XIL normativlar (Demo day 1 va 2) qayta yaratilmaydi: eski yozuv
 *      va uning natijalari saqlanadi, u yangi yo'nalishga o'tadi va yangi raqam oladi;
 *   3. qolgan eski "Foundation" normativlarini ARXIVLAYDI (archivedAt) — o'chirilmaydi,
 *      natijalari va ballari saqlanadi, o'quvchida "eski normativlar" bo'limida xira turadi;
 *   4. tanlangan guruhlarga yangi to'plamni biriktiradi (eski biriktirishlar tegilmaydi).
 *
 * Qaysi guruh "Foundation guruhi": unga eski Foundation normativi biriktirilgan va boshqa
 * yo'nalish (Frontend va h.k.) normativi biriktirilmagan. Admin oldindan ko'rib, tanlovni
 * o'zgartira oladi. Hech qanday xabar yuborilmaydi.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import seed from './foundation-2026.seed.json';

type SeedItem = (typeof seed.normatives)[number];
const MARK_KEY = 'foundation_2026_migration';

async function loadState() {
  const [oldCat, newCat] = await Promise.all([
    prisma.category.findFirst({ where: { name: { equals: seed.oldCategory, mode: 'insensitive' } }, select: { id: true, name: true } }),
    prisma.category.findFirst({ where: { name: seed.category }, select: { id: true, name: true } }),
  ]);
  const normSelect = {
    id: true,
    taskNumber: true,
    title: true,
    isActive: true,
    archivedAt: true,
    _count: { select: { submissions: true } },
  } satisfies Prisma.NormativeSelect;
  const [oldNorms, newNorms, mark] = await Promise.all([
    oldCat ? prisma.normative.findMany({ where: { categoryId: oldCat.id }, select: normSelect, orderBy: { taskNumber: 'asc' } }) : [],
    newCat ? prisma.normative.findMany({ where: { categoryId: newCat.id }, select: normSelect, orderBy: { taskNumber: 'asc' } }) : [],
    prisma.appSetting.findUnique({ where: { key: MARK_KEY } }),
  ]);

  const newNums = new Set(newNorms.filter((n) => n.isActive).map((n) => n.taskNumber));
  // Eskisi bilan bir xil: eski yozuv hali eski yo'nalishda turgan bo'lsa — ko'chiriladi
  const keep = seed.normatives
    .filter((s) => s.keepOld != null && !newNums.has(s.taskNumber))
    .map((s) => ({ seed: s, old: oldNorms.find((o) => o.taskNumber === s.keepOld && o.isActive && !o.archivedAt) ?? null }));
  const keepIds = new Set(keep.filter((k) => k.old).map((k) => k.old!.id));
  const create: SeedItem[] = seed.normatives.filter(
    (s) => !newNums.has(s.taskNumber) && !(s.keepOld != null && keep.some((k) => k.seed.taskNumber === s.taskNumber && k.old))
  );
  const archive = oldNorms.filter((o) => o.isActive && !o.archivedAt && !keepIds.has(o.id));

  // Guruhlar: faol, bitirmagan
  const groups = await prisma.group.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      teacher: { select: { id: true, fullName: true } },
      _count: { select: { groupStudents: { where: { student: { isActive: true, role: 'student' } } } } },
      groupNormatives: { select: { normativeId: true, normative: { select: { categoryId: true, category: { select: { name: true } } } } } },
    },
  });
  const groupRows = groups.map((g) => {
    const oldCount = oldCat ? g.groupNormatives.filter((x) => x.normative.categoryId === oldCat.id).length : 0;
    const newCount = newCat ? g.groupNormatives.filter((x) => x.normative.categoryId === newCat.id).length : 0;
    const other = [
      ...new Set(
        g.groupNormatives
          .filter((x) => x.normative.categoryId !== oldCat?.id && x.normative.categoryId !== newCat?.id)
          .map((x) => x.normative.category?.name ?? "Yo'nalishsiz")
      ),
    ];
    const suggested = oldCount > 0 && other.length === 0;
    const reason =
      oldCount === 0 && newCount === 0
        ? "Foundation normativi biriktirilmagan"
        : other.length
          ? `Boshqa yo'nalish ham bor: ${other.join(', ')}`
          : oldCount > 0
            ? 'Foundation guruhi'
            : "Yangi to'plam allaqachon biriktirilgan";
    return {
      id: g.id,
      name: g.name,
      teacher: g.teacher,
      students: g._count.groupStudents,
      oldCount,
      newCount,
      otherCategories: other,
      suggested,
      reason,
    };
  });

  return { oldCat, newCat, oldNorms, newNorms, keep, create, archive, groupRows, mark };
}

/** Oldindan ko'rish — bazaga hech narsa yozmaydi */
export async function planFoundation2026() {
  const st = await loadState();
  return {
    version: seed.version,
    category: seed.category,
    oldCategory: st.oldCat?.name ?? null,
    applied: st.mark ? (st.mark.value as Record<string, unknown>) : null,
    create: st.create.map((s) => ({ taskNumber: s.taskNumber, title: s.title, code: s.code, hasImage: !!s.url })),
    keep: st.keep.map((k) => ({
      taskNumber: k.seed.taskNumber,
      title: k.seed.title,
      old: k.old ? { id: k.old.id, taskNumber: k.old.taskNumber, title: k.old.title, submissions: k.old._count.submissions } : null,
    })),
    archive: st.archive.map((o) => ({ id: o.id, taskNumber: o.taskNumber, title: o.title, submissions: o._count.submissions })),
    alreadyInNew: st.newNorms.filter((n) => n.isActive).length,
    groups: st.groupRows,
    warnings: [
      ...(!st.oldCat ? [`"${seed.oldCategory}" yo'nalishi topilmadi — eski normativlar arxivlanmaydi`] : []),
      ...st.keep.filter((k) => !k.old).map((k) => `Eski №${k.seed.keepOld} topilmadi — №${k.seed.taskNumber} yangidan yaratiladi`),
    ],
  };
}

/** Qo'llash: bitta tranzaksiyada. Qayta bosilsa — faqat yetishmagani bajariladi. */
export async function applyFoundation2026(actorId: string, groupIds: string[]) {
  const st = await loadState();
  const valid = new Set(st.groupRows.map((g) => g.id));
  const bad = groupIds.filter((id) => !valid.has(id));
  if (bad.length) throw ApiError.badRequest(`${bad.length} ta guruh topilmadi yoki faol emas`);

  // Yangidan yaratiladiganlar orasida "keepOld" bo'lib, eskisi topilmaganlari ham bor
  const toCreate = st.create.concat(st.keep.filter((k) => !k.old).map((k) => k.seed)).filter(
    (s, i, arr) => arr.findIndex((x) => x.taskNumber === s.taskNumber) === i
  );

  const result = await prisma.$transaction(
    async (tx) => {
      const cat = await tx.category.upsert({ where: { name: seed.category }, update: {}, create: { name: seed.category }, select: { id: true } });
      if (toCreate.length) {
        await tx.normative.createMany({
          data: toCreate.map((s) => ({
            taskNumber: s.taskNumber,
            title: s.title,
            description: s.description,
            timeLimit: s.timeLimit,
            maxScore: s.maxScore,
            url: s.url,
            isActive: true,
            categoryId: cat.id,
          })),
        });
      }
      // Bir xillari: eski yozuv (id, natijalar) saqlanadi — faqat yangi yo'nalish va raqam
      for (const k of st.keep) {
        if (!k.old) continue;
        await tx.normative.update({ where: { id: k.old.id }, data: { categoryId: cat.id, taskNumber: k.seed.taskNumber } });
      }
      const now = new Date();
      const archived = st.archive.length
        ? (await tx.normative.updateMany({ where: { id: { in: st.archive.map((a) => a.id) }, archivedAt: null }, data: { archivedAt: now } })).count
        : 0;

      const setIds = (await tx.normative.findMany({ where: { categoryId: cat.id, isActive: true, archivedAt: null }, select: { id: true } })).map((n) => n.id);
      let assigned = 0;
      if (groupIds.length && setIds.length) {
        assigned = (
          await tx.groupNormative.createMany({
            data: groupIds.flatMap((groupId) => setIds.map((normativeId) => ({ groupId, normativeId }))),
            skipDuplicates: true,
          })
        ).count;
      }

      const summary = {
        appliedAt: now.toISOString(),
        appliedById: actorId,
        created: toCreate.length,
        kept: st.keep.filter((k) => k.old).length,
        archived,
        groups: groupIds.length,
        assigned,
      };
      await tx.appSetting.upsert({
        where: { key: MARK_KEY },
        create: { key: MARK_KEY, value: summary, updatedById: actorId },
        update: { value: summary, updatedById: actorId },
      });
      await tx.auditLog.create({
        data: { userId: actorId, action: 'FOUNDATION_2026_MIGRATION', targetType: 'normative', details: { ...summary, groupIds } },
      });
      return summary;
    },
    { timeout: 60_000 }
  );
  return result;
}
