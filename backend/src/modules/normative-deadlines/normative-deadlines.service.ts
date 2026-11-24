/**
 * Normativ deadline'lari — haftasiga N ta normativ, muddat + qo'shimcha muddat.
 *
 * Holat (AppSetting 'normative_deadlines'):
 *   - startDate yo'q          → tizim hali qurilmagan (faqat "ko'rib chiqish" ishlaydi);
 *   - enabled = true          → reja qurilgan, hamma ko'radi;
 *   - enabled = false + reja  → to'xtatilgan (pauza), hech kim ko'rmaydi.
 *
 * Reja (NormativeDeadline) guruhga biriktirilgan FAOL normativlardan
 * quriladi: taskNumber tartibida, har haftaga perWeek ta. Guruhga keyin
 * qo'shilgan normativ rejaning oxiriga (eng erta — keyingi hafta) qo'shiladi,
 * guruhdan olingan normativ rejadan ham olinadi (syncPlans).
 *
 * O'quvchi + normativ bo'yicha topshiriq olinadi (submission unique) — guruh
 * bo'yicha EMAS (memory: ils-group-scope-trap). Topshirilgan payt —
 * firstSubmittedAt (qayta topshirish uni o'zgartirmaydi).
 *
 * Kim ko'radi: admin, normative_deadlines_all/_manage — hammasi; o'qituvchi —
 * o'z guruhlari; o'quvchi — faqat o'zi (/me). Boshqarish — faqat _manage (admin).
 */
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { hasPermission } from '../../shared/middleware/permission.middleware';
import logger from '../../shared/utils/logger';
import * as R from './deadline.rules';

type Actor = { userId: string; role: string };

const SETTING_KEY = 'normative_deadlines';

export interface DeadlineConfig {
  enabled: boolean;
  /** Reja boshlangan hafta (dushanba, 'YYYY-MM-DD'); null — hali qurilmagan */
  startDate: string | null;
  perWeek: number;
  graceDays: number;
  startedAt: string | null;
  startedById: string | null;
  pausedAt: string | null;
}

export const DEFAULT_CONFIG: DeadlineConfig = {
  enabled: false,
  startDate: null,
  perWeek: 2,
  graceDays: 2,
  startedAt: null,
  startedById: null,
  pausedAt: null,
};

export async function getConfig(): Promise<DeadlineConfig> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  const v = (row?.value ?? {}) as Partial<DeadlineConfig>;
  return { ...DEFAULT_CONFIG, ...v };
}

async function saveConfig(cfg: DeadlineConfig, actorId: string) {
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: cfg as unknown as Prisma.InputJsonValue, updatedById: actorId },
    update: { value: cfg as unknown as Prisma.InputJsonValue, updatedById: actorId },
  });
}

async function audit(actorId: string, action: string, details: Record<string, unknown>, targetId?: string) {
  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action,
      targetType: targetId ? 'group' : 'normative_deadlines',
      targetId: targetId ?? null,
      details: details as Prisma.InputJsonValue,
    },
  });
}

// ─── Kirish ────────────────────────────────────────────────────────────

export const canManage = (actor: Actor) => hasPermission(actor, 'normative_deadlines_manage');

export async function scopeOf(actor: Actor): Promise<'all' | { teacherId: string }> {
  if (actor.role === 'student') throw ApiError.forbidden("Bu bo'lim xodimlar uchun");
  if (
    actor.role === 'admin' ||
    (await hasPermission(actor, 'normative_deadlines_all')) ||
    (await canManage(actor))
  ) {
    return 'all';
  }
  if (actor.role === 'teacher') return { teacherId: actor.userId };
  throw ApiError.forbidden("Normativ deadline'larini ko'rish uchun ruxsatingiz yo'q");
}

async function assertManage(actor: Actor) {
  if (!(await canManage(actor))) {
    throw ApiError.forbidden("Deadline tizimini boshqarish uchun \"Normativ deadline'larini boshqarish\" ruxsati kerak");
  }
}

// ─── Reja qurish / sinxronlash ─────────────────────────────────────────

type PlanNorm = { id: string; taskNumber: number; title: string };
const byTask = (a: PlanNorm, b: PlanNorm) => a.taskNumber - b.taskNumber || a.title.localeCompare(b.title, 'uz');

const maxDate = (...ds: (Date | null | undefined)[]) =>
  ds.filter((d): d is Date => !!d).reduce((a, b) => (b > a ? b : a));

/**
 * Guruh rejasini biriktirilgan normativlar bilan tenglashtiradi.
 * initial = true — "start" paytidagi birinchi qurish: reja start haftasidan
 * (yoki guruh keyinroq boshlansa — o'sha haftadan) boshlanadi. Keyingi
 * sinxronlashlarda yangi band eng erta KEYINGI haftaga tushadi — o'quvchiga
 * hafta o'rtasida kutilmagan muddat chiqmasin.
 */
async function syncInternal(cfg: DeadlineConfig, now: Date, groupIds?: string[], initial = false) {
  if (!cfg.startDate) return { created: 0, removed: 0 };
  const groups = await prisma.group.findMany({
    where: { isActive: true, ...(groupIds ? { id: { in: groupIds } } : {}) },
    select: {
      id: true,
      startDate: true,
      groupNormatives: {
        where: { normative: { isActive: true } },
        select: { normative: { select: { id: true, taskNumber: true, title: true } } },
      },
    },
  });
  if (!groups.length) return { created: 0, removed: 0 };

  const rows = await prisma.normativeDeadline.findMany({
    where: { groupId: { in: groups.map((g) => g.id) } },
    select: { id: true, groupId: true, normativeId: true, weekStart: true, seq: true, excluded: true },
  });
  const rowsByGroup = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!rowsByGroup.has(r.groupId)) rowsByGroup.set(r.groupId, []);
    rowsByGroup.get(r.groupId)!.push(r);
  }

  const startMonday = R.utcDay(cfg.startDate);
  const nextMonday = R.addDays(R.mondayOf(R.centerToday(now)), 7);
  const toCreate: Prisma.NormativeDeadlineCreateManyInput[] = [];
  const toDelete: string[] = [];

  for (const g of groups) {
    const assigned = g.groupNormatives.map((x) => x.normative).sort(byTask);
    const assignedIds = new Set(assigned.map((n) => n.id));
    const existing = rowsByGroup.get(g.id) ?? [];
    for (const r of existing) if (!assignedIds.has(r.normativeId)) toDelete.push(r.id);
    const kept = existing.filter((r) => assignedIds.has(r.normativeId));
    const have = new Set(kept.map((r) => r.normativeId));
    const missing = assigned.filter((n) => !have.has(n.id));
    if (!missing.length) continue;

    const lastWeek = kept.length ? maxDate(...kept.map((r) => r.weekStart)) : null;
    let first = maxDate(startMonday, g.startDate ? R.mondayOf(g.startDate) : null, lastWeek);
    if (!initial) first = maxDate(first, nextMonday);

    const taken = new Map<string, number>();
    for (const r of kept) {
      if (r.excluded) continue;
      const k = R.dayStr(r.weekStart);
      taken.set(k, (taken.get(k) ?? 0) + 1);
    }
    const maxSeq = kept.reduce((m, r) => Math.max(m, r.seq), 0);
    R.layOut(missing, first, cfg.perWeek, taken).forEach((x, i) =>
      toCreate.push({ groupId: g.id, normativeId: x.item.id, weekStart: x.weekStart, seq: maxSeq + 1 + i })
    );
  }

  if (toDelete.length || toCreate.length) {
    await prisma.$transaction([
      prisma.normativeDeadline.deleteMany({ where: { id: { in: toDelete } } }),
      prisma.normativeDeadline.createMany({ data: toCreate, skipDuplicates: true }),
    ]);
  }
  return { created: toCreate.length, removed: toDelete.length };
}

let lastFullSync = 0;
/** Ko'rish so'rovlaridan oldin: to'liq sinxronlash ko'pi bilan daqiqada bir marta */
async function ensureSynced(cfg: DeadlineConfig, now: Date, groupId?: string) {
  if (!cfg.enabled) return;
  if (groupId) {
    await syncInternal(cfg, now, [groupId]);
    return;
  }
  if (Date.now() - lastFullSync < 60_000) return;
  lastFullSync = Date.now();
  await syncInternal(cfg, now);
}

/** Testlar uchun: keyingi so'rov to'liq sinxronlashni majburlasin */
export const resetSyncThrottle = () => {
  lastFullSync = 0;
};

// ─── Hisoblash ─────────────────────────────────────────────────────────

const GROUP_SELECT = {
  id: true,
  name: true,
  startDate: true,
  lessonDayType: true,
  lessonStartMinute: true,
  lessonEndMinute: true,
  teacher: { select: { id: true, fullName: true } },
} satisfies Prisma.GroupSelect;

type GroupRow = Prisma.GroupGetPayload<{ select: typeof GROUP_SELECT }>;

const scheduleOf = (g: GroupRow) => ({
  dayType: g.lessonDayType,
  start: R.minuteToHHMM(g.lessonStartMinute),
  end: R.minuteToHHMM(g.lessonEndMinute),
});

const warningsOf = (g: GroupRow, normCount: number) => {
  const w: string[] = [];
  if (!normCount) w.push("Guruhga faol normativ biriktirilmagan");
  if (!g.lessonDayType) w.push('Dars kunlari kiritilmagan — muddat yakshanba 23:59');
  else if (g.lessonStartMinute == null) w.push('Dars soati kiritilmagan — muddat oxirgi dars kuni 23:59');
  if (!g.teacher) w.push("Ustoz biriktirilmagan");
  return w;
};

type Sub = { submittedAt: Date; youtubeUrl: string; status: string; result: string | null };

async function loadSubs(studentIds: string[], normativeIds: string[]) {
  const map = new Map<string, Sub>();
  if (!studentIds.length || !normativeIds.length) return map;
  const subs = await prisma.submission.findMany({
    where: { studentId: { in: studentIds }, normativeId: { in: normativeIds } },
    select: { studentId: true, normativeId: true, firstSubmittedAt: true, submittedAt: true, youtubeUrl: true, status: true, result: true },
  });
  for (const s of subs) {
    map.set(`${s.studentId}:${s.normativeId}`, {
      submittedAt: s.firstSubmittedAt ?? s.submittedAt,
      youtubeUrl: s.youtubeUrl,
      status: s.status,
      result: s.result,
    });
  }
  return map;
}

const safeUrl = (u: string | null | undefined) => {
  const t = (u ?? '').trim();
  return /^https?:\/\/[^\s]+$/i.test(t) ? t : '';
};

type Counts = { due: number; done: number; graceDone: number; lateDone: number; open: number; grace: number; missed: number };
const emptyCounts = (): Counts => ({ due: 0, done: 0, graceDone: 0, lateDone: 0, open: 0, grace: 0, missed: 0 });
function addState(c: Counts, s: R.DeadlineState) {
  if (s === 'na') return;
  c.due++;
  if (s === 'done') c.done++;
  else if (s === 'grace_done') c.graceDone++;
  else if (s === 'late_done') c.lateDone++;
  else if (s === 'open') c.open++;
  else if (s === 'grace') c.grace++;
  else c.missed++;
}
const sumCounts = (a: Counts, b: Counts): Counts => ({
  due: a.due + b.due,
  done: a.done + b.done,
  graceDone: a.graceDone + b.graceDone,
  lateDone: a.lateDone + b.lateDone,
  open: a.open + b.open,
  grace: a.grace + b.grace,
  missed: a.missed + b.missed,
});

// ─── Ko'rinishlar ──────────────────────────────────────────────────────

/** Umumiy panel: tanlangan hafta + jami qizillar, guruhlar kesimida */
export async function overview(actor: Actor, weekParam?: string, now = new Date()) {
  const scope = await scopeOf(actor);
  const cfg = await getConfig();
  const manage = await canManage(actor);
  const base = { config: cfg, canManage: manage };
  if (!cfg.enabled) return { ...base, enabled: false as const };

  await ensureSynced(cfg, now);

  const thisWeek = R.mondayOf(R.centerToday(now));
  const week = weekParam ? R.mondayOf(R.utcDay(weekParam)) : thisWeek;

  const groups = await prisma.group.findMany({
    where: { isActive: true, ...(scope === 'all' ? {} : { teacherId: scope.teacherId }) },
    orderBy: { name: 'asc' },
    select: {
      ...GROUP_SELECT,
      groupStudents: {
        where: { student: { isActive: true, role: 'student' } },
        select: { joinedAt: true, studentId: true },
      },
    },
  });
  const ids = groups.map((g) => g.id);
  const rows = ids.length
    ? await prisma.normativeDeadline.findMany({
        where: { groupId: { in: ids }, excluded: false },
        orderBy: [{ weekStart: 'asc' }, { seq: 'asc' }],
        select: {
          id: true,
          groupId: true,
          weekStart: true,
          normative: { select: { id: true, taskNumber: true, title: true } },
        },
      })
    : [];
  const subs = await loadSubs(
    [...new Set(groups.flatMap((g) => g.groupStudents.map((s) => s.studentId)))],
    [...new Set(rows.map((r) => r.normative.id))]
  );

  let weekTotals = emptyCounts();
  let missedTotal = 0;
  const redStudents = new Set<string>();
  const weekStr = R.dayStr(week);

  const out = groups.map((g) => {
    const gRows = rows.filter((r) => r.groupId === g.id);
    const wk = emptyCounts();
    let missed = 0;
    const red = new Set<string>();
    const weekItems: { normativeId: string; taskNumber: number; title: string; dueAt: string; graceEnd: string }[] = [];
    for (const r of gRows) {
      const dueAt = R.dueAtFor(r.weekStart, g);
      const graceEnd = R.graceEndFor(dueAt, cfg.graceDays);
      const inWeek = R.dayStr(r.weekStart) === weekStr;
      if (inWeek) {
        weekItems.push({
          normativeId: r.normative.id,
          taskNumber: r.normative.taskNumber,
          title: r.normative.title,
          dueAt: dueAt.toISOString(),
          graceEnd: graceEnd.toISOString(),
        });
      }
      for (const s of g.groupStudents) {
        const sub = subs.get(`${s.studentId}:${r.normative.id}`);
        const st = R.stateOf({ dueAt, graceEnd, submittedAt: sub?.submittedAt ?? null, joinedAt: s.joinedAt, now });
        if (inWeek) addState(wk, st);
        if (st === 'missed') {
          missed++;
          red.add(s.studentId);
          redStudents.add(s.studentId);
        }
      }
    }
    weekTotals = sumCounts(weekTotals, wk);
    missedTotal += missed;
    const lastWeek = gRows.length ? gRows[gRows.length - 1].weekStart : null;
    return {
      id: g.id,
      name: g.name,
      teacher: g.teacher,
      schedule: scheduleOf(g),
      students: g.groupStudents.length,
      planItems: gRows.length,
      planEnd: lastWeek ? R.dayStr(lastWeek) : null,
      week: { ...wk, items: weekItems },
      missed,
      studentsWithMissed: red.size,
      warnings: warningsOf(g, gRows.length),
    };
  });

  return {
    ...base,
    enabled: true as const,
    now: now.toISOString(),
    week: { start: weekStr, end: R.dayStr(R.addDays(week, 6)), isCurrent: weekStr === R.dayStr(thisWeek) },
    totals: { week: weekTotals, missed: missedTotal, studentsWithMissed: redStudents.size },
    groups: out,
  };
}

/** Bitta guruh: haftalar × o'quvchilar matritsasi */
export async function groupDetail(actor: Actor, groupId: string, now = new Date()) {
  const scope = await scopeOf(actor);
  const cfg = await getConfig();
  const manage = await canManage(actor);
  const group = await prisma.group.findFirst({
    where: { id: groupId, isActive: true },
    select: {
      ...GROUP_SELECT,
      groupStudents: {
        where: { student: { isActive: true, role: 'student' } },
        orderBy: { student: { fullName: 'asc' } },
        select: { joinedAt: true, student: { select: { id: true, fullName: true, login: true } } },
      },
    },
  });
  // IDOR: o'qituvchi boshqa guruhni so'rasa — "topilmadi" (borligini ham oshkor qilmaymiz)
  if (!group || (scope !== 'all' && group.teacher?.id !== scope.teacherId)) throw ApiError.notFound('Guruh topilmadi');
  if (!cfg.enabled) return { config: cfg, canManage: manage, enabled: false as const, group: { id: group.id, name: group.name } };

  await ensureSynced(cfg, now, groupId);

  const rows = await prisma.normativeDeadline.findMany({
    where: { groupId },
    orderBy: [{ weekStart: 'asc' }, { seq: 'asc' }],
    select: {
      id: true,
      weekStart: true,
      seq: true,
      excluded: true,
      normative: { select: { id: true, taskNumber: true, title: true, category: { select: { name: true } } } },
    },
  });
  const students = group.groupStudents.map((s) => ({ ...s.student, joinedAt: s.joinedAt }));
  const subs = await loadSubs(
    students.map((s) => s.id),
    rows.map((r) => r.normative.id)
  );

  const weeks = new Map<string, { weekStart: string; dueAt: string; graceEnd: string; items: any[] }>();
  const rowTimes = new Map<string, { dueAt: Date; graceEnd: Date }>();
  for (const r of rows) {
    const dueAt = R.dueAtFor(r.weekStart, group);
    const graceEnd = R.graceEndFor(dueAt, cfg.graceDays);
    rowTimes.set(r.id, { dueAt, graceEnd });
    const k = R.dayStr(r.weekStart);
    if (!weeks.has(k)) weeks.set(k, { weekStart: k, dueAt: dueAt.toISOString(), graceEnd: graceEnd.toISOString(), items: [] });
    weeks.get(k)!.items.push({
      id: r.id,
      normativeId: r.normative.id,
      taskNumber: r.normative.taskNumber,
      title: r.normative.title,
      category: r.normative.category?.name ?? null,
      excluded: r.excluded,
      seq: r.seq,
    });
  }

  const studentRows = students.map((s) => {
    const counts = emptyCounts();
    const cells: Record<string, [R.DeadlineState, string | null, string]> = {};
    for (const r of rows) {
      if (r.excluded) continue;
      const t = rowTimes.get(r.id)!;
      const sub = subs.get(`${s.id}:${r.normative.id}`);
      const st = R.stateOf({ ...t, submittedAt: sub?.submittedAt ?? null, joinedAt: s.joinedAt, now });
      addState(counts, st);
      cells[r.id] = [st, sub ? sub.submittedAt.toISOString() : null, safeUrl(sub?.youtubeUrl)];
    }
    return { id: s.id, fullName: s.fullName, login: s.login, joinedAt: s.joinedAt.toISOString(), counts, cells };
  });

  return {
    config: cfg,
    canManage: manage,
    enabled: true as const,
    now: now.toISOString(),
    currentWeek: R.dayStr(R.mondayOf(R.centerToday(now))),
    group: { id: group.id, name: group.name, teacher: group.teacher, schedule: scheduleOf(group), warnings: warningsOf(group, rows.length) },
    weeks: [...weeks.values()],
    students: studentRows,
  };
}

/** O'quvchining o'zi: shu hafta, keyingi hafta va hal bo'lmagan o'tganlari */
export async function studentMe(studentId: string, now = new Date()) {
  const cfg = await getConfig();
  if (!cfg.enabled) return { enabled: false as const };

  const memberships = await prisma.groupStudent.findMany({
    where: { studentId, group: { isActive: true } },
    select: { joinedAt: true, group: { select: GROUP_SELECT } },
  });
  for (const m of memberships) await ensureSynced(cfg, now, m.group.id);

  const thisWeek = R.mondayOf(R.centerToday(now));
  const nextWeek = R.addDays(thisWeek, 7);
  const rows = memberships.length
    ? await prisma.normativeDeadline.findMany({
        where: { groupId: { in: memberships.map((m) => m.group.id) }, excluded: false, weekStart: { lte: nextWeek } },
        orderBy: [{ weekStart: 'asc' }, { seq: 'asc' }],
        select: { groupId: true, weekStart: true, normative: { select: { id: true, taskNumber: true, title: true, url: true } } },
      })
    : [];
  const subs = await loadSubs([studentId], rows.map((r) => r.normative.id));

  const items = [];
  const counts = emptyCounts();
  for (const r of rows) {
    const m = memberships.find((x) => x.group.id === r.groupId)!;
    const dueAt = R.dueAtFor(r.weekStart, m.group);
    const graceEnd = R.graceEndFor(dueAt, cfg.graceDays);
    const sub = subs.get(`${studentId}:${r.normative.id}`);
    const st = R.stateOf({ dueAt, graceEnd, submittedAt: sub?.submittedAt ?? null, joinedAt: m.joinedAt, now });
    if (st === 'na') continue;
    const ws = R.dayStr(r.weekStart);
    const when = ws === R.dayStr(thisWeek) ? 'this' : ws === R.dayStr(nextWeek) ? 'next' : 'past';
    // O'tgan haftalardan faqat hal bo'lmaganlari (qo'shimcha muddat / qizil) ko'rsatiladi
    if (when === 'past' && st !== 'grace' && st !== 'missed') continue;
    if (when !== 'next') addState(counts, st);
    items.push({
      groupId: r.groupId,
      groupName: m.group.name,
      normativeId: r.normative.id,
      taskNumber: r.normative.taskNumber,
      title: r.normative.title,
      url: safeUrl(r.normative.url),
      weekStart: ws,
      when,
      dueAt: dueAt.toISOString(),
      graceEnd: graceEnd.toISOString(),
      state: st,
    });
  }
  return { enabled: true as const, now: now.toISOString(), graceDays: cfg.graceDays, perWeek: cfg.perWeek, counts, items };
}

// ─── Boshqarish ────────────────────────────────────────────────────────

/** Start'dan oldin ko'rib chiqish: hech narsa yozilmaydi */
export async function preview(actor: Actor, startDate: string, perWeek: number, now = new Date()) {
  await assertManage(actor);
  const start = validateStartDate(startDate, now);
  const groups = await prisma.group.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      ...GROUP_SELECT,
      _count: { select: { groupStudents: { where: { student: { isActive: true, role: 'student' } } } } },
      groupNormatives: {
        where: { normative: { isActive: true } },
        select: { normative: { select: { id: true, taskNumber: true, title: true } } },
      },
    },
  });
  const rows = groups.map((g) => {
    const norms = g.groupNormatives.map((x) => x.normative).sort(byTask);
    const first = maxDate(start, g.startDate ? R.mondayOf(g.startDate) : null);
    const plan = R.layOut(norms, first, perWeek);
    const firstWeekItems = plan.filter((p) => R.dayStr(p.weekStart) === R.dayStr(first)).map((p) => p.item);
    return {
      id: g.id,
      name: g.name,
      teacher: g.teacher,
      schedule: scheduleOf(g),
      students: g._count.groupStudents,
      normatives: norms.length,
      weeks: Math.ceil(norms.length / perWeek),
      firstWeek: R.dayStr(first),
      firstDueAt: norms.length ? R.dueAtFor(first, g).toISOString() : null,
      lastWeek: plan.length ? R.dayStr(plan[plan.length - 1].weekStart) : null,
      firstWeekItems,
      warnings: warningsOf(g, norms.length),
    };
  });
  return {
    startDate: R.dayStr(start),
    perWeek,
    groups: rows,
    totals: {
      groups: rows.length,
      withPlan: rows.filter((r) => r.normatives > 0).length,
      students: rows.reduce((a, r) => a + r.students, 0),
      withWarnings: rows.filter((r) => r.warnings.length).length,
    },
  };
}

function validateStartDate(s: string, now: Date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw ApiError.badRequest("Sana YYYY-MM-DD ko'rinishida bo'lsin");
  const d = R.utcDay(s);
  if (Number.isNaN(d.getTime()) || R.dayStr(d) !== s) throw ApiError.badRequest("Sana noto'g'ri");
  if (d.getUTCDay() !== 1) throw ApiError.badRequest('Boshlanish sanasi dushanba bo\'lishi kerak (hafta boshi)');
  if (d < R.mondayOf(R.centerToday(now))) throw ApiError.badRequest("O'tgan haftadan boshlab bo'lmaydi");
  return d;
}

/** Hammaga start: reja quriladi va tizim yoqiladi. Pauzadan keyin — davom ettirish. */
export async function start(
  actor: Actor,
  input: { startDate: string; perWeek?: number; graceDays?: number },
  now = new Date()
) {
  await assertManage(actor);
  const cfg = await getConfig();
  if (cfg.enabled) throw ApiError.conflict('Tizim allaqachon ishlayapti');
  const hasPlan = (await prisma.normativeDeadline.count()) > 0;

  let next: DeadlineConfig;
  if (hasPlan && cfg.startDate) {
    // Pauzadan davom ettirish — reja o'zgarmaydi
    if (input.startDate !== cfg.startDate) {
      throw ApiError.badRequest(
        `Reja ${cfg.startDate} dan qurilgan. Boshqa sanadan boshlash uchun avval "Rejani tozalash" ni bosing`
      );
    }
    next = { ...cfg, enabled: true, pausedAt: null, graceDays: input.graceDays ?? cfg.graceDays };
  } else {
    validateStartDate(input.startDate, now);
    next = {
      ...cfg,
      enabled: true,
      startDate: input.startDate,
      perWeek: input.perWeek ?? cfg.perWeek,
      graceDays: input.graceDays ?? cfg.graceDays,
      startedAt: now.toISOString(),
      startedById: actor.userId,
      pausedAt: null,
    };
  }
  await saveConfig(next, actor.userId);
  const res = await syncInternal(next, now, undefined, !hasPlan);
  lastFullSync = Date.now();
  await audit(actor.userId, hasPlan ? 'NORMATIVE_DEADLINES_RESUME' : 'NORMATIVE_DEADLINES_START', {
    startDate: next.startDate,
    perWeek: next.perWeek,
    graceDays: next.graceDays,
    created: res.created,
  });
  logger.info(`Normative deadlines ${hasPlan ? 'resumed' : 'started'} by ${actor.userId}: ${res.created} items`);
  return { config: next, created: res.created };
}

export async function pause(actor: Actor, now = new Date()) {
  await assertManage(actor);
  const cfg = await getConfig();
  if (!cfg.enabled) throw ApiError.conflict('Tizim ishlamayapti');
  const next = { ...cfg, enabled: false, pausedAt: now.toISOString() };
  await saveConfig(next, actor.userId);
  await audit(actor.userId, 'NORMATIVE_DEADLINES_PAUSE', {});
  return { config: next };
}

/** Rejani butunlay tozalash (faqat to'xtatilgan holatda). Topshiriqlarga tegmaydi. */
export async function resetPlan(actor: Actor) {
  await assertManage(actor);
  const cfg = await getConfig();
  if (cfg.enabled) throw ApiError.conflict("Avval tizimni to'xtating");
  const { count } = await prisma.normativeDeadline.deleteMany({});
  const next = { ...DEFAULT_CONFIG, perWeek: cfg.perWeek, graceDays: cfg.graceDays };
  await saveConfig(next, actor.userId);
  await audit(actor.userId, 'NORMATIVE_DEADLINES_RESET', { removed: count });
  return { config: next, removed: count };
}

/** Sozlamalar: haftalik son (keyingi qurishlarga) va qo'shimcha kunlar (darhol) */
export async function updateConfig(actor: Actor, input: { perWeek?: number; graceDays?: number }) {
  await assertManage(actor);
  const cfg = await getConfig();
  const next = { ...cfg, ...(input.perWeek != null ? { perWeek: input.perWeek } : {}), ...(input.graceDays != null ? { graceDays: input.graceDays } : {}) };
  await saveConfig(next, actor.userId);
  await audit(actor.userId, 'NORMATIVE_DEADLINES_CONFIG', input);
  return { config: next };
}

/** Bandlarni boshqa haftaga ko'chirish yoki rejadan chiqarish/qaytarish */
export async function updateItems(
  actor: Actor,
  groupId: string,
  input: { ids: string[]; weekStart?: string; excluded?: boolean }
) {
  await assertManage(actor);
  const items = await prisma.normativeDeadline.findMany({ where: { id: { in: input.ids }, groupId }, select: { id: true } });
  if (items.length !== new Set(input.ids).size) throw ApiError.notFound('Reja bandi topilmadi');
  const data: Prisma.NormativeDeadlineUpdateManyMutationInput = {};
  if (input.weekStart) {
    const d = R.utcDay(input.weekStart);
    if (Number.isNaN(d.getTime()) || R.dayStr(d) !== input.weekStart || d.getUTCDay() !== 1) {
      throw ApiError.badRequest('Hafta boshi (dushanba) sanasini tanlang');
    }
    data.weekStart = d;
  }
  if (input.excluded !== undefined) data.excluded = input.excluded;
  const { count } = await prisma.normativeDeadline.updateMany({ where: { id: { in: input.ids }, groupId }, data });
  await audit(actor.userId, 'NORMATIVE_DEADLINES_EDIT', { ids: input.ids, weekStart: input.weekStart, excluded: input.excluded }, groupId);
  return { updated: count };
}

/** Guruh rejasini shu haftadan qayta joylash (rejadan chiqarilganlar joy egallamaydi) */
export async function rebuildGroup(actor: Actor, groupId: string, fromWeek: string) {
  await assertManage(actor);
  const cfg = await getConfig();
  const d = R.utcDay(fromWeek);
  if (Number.isNaN(d.getTime()) || R.dayStr(d) !== fromWeek || d.getUTCDay() !== 1) {
    throw ApiError.badRequest('Hafta boshi (dushanba) sanasini tanlang');
  }
  const group = await prisma.group.findFirst({ where: { id: groupId, isActive: true }, select: { id: true } });
  if (!group) throw ApiError.notFound('Guruh topilmadi');
  const rows = await prisma.normativeDeadline.findMany({
    where: { groupId, excluded: false },
    orderBy: [{ seq: 'asc' }],
    select: { id: true },
  });
  const plan = R.layOut(rows, d, cfg.perWeek);
  await prisma.$transaction(
    plan.map((p) => prisma.normativeDeadline.update({ where: { id: p.item.id }, data: { weekStart: p.weekStart } }))
  );
  await audit(actor.userId, 'NORMATIVE_DEADLINES_REBUILD', { fromWeek, items: plan.length }, groupId);
  return { updated: plan.length };
}
