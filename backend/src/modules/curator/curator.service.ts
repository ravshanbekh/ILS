/**
 * Kurator (demo-mentor) moduli.
 *
 * Oqim:
 *   1. Kurator yangi bola bilan 20 daqiqalik demo dars o'tadi va uni shu yerning
 *      o'zida ILS'ga qo'shadi (guruhsiz) — CuratorStudent yoziladi.
 *   2. Administrator bolani asosiy guruhga qo'shadi (mavjud guruh oynalari orqali).
 *   3. 2 oy davomida kurator o'z dasturi (24 mashg'ulot) bo'yicha shug'ullanadi:
 *      o'quvchi kuratorning ochiq vaqtiga o'z profilidan yoziladi (30 daqiqalik
 *      oraliq, 8 kishigacha), kurator "keldi/kelmadi" belgilaydi va o'tilgan
 *      mashg'ulot avtomatik dasturdagi joyiga yoziladi.
 *   4. Kurator har bir bolaning asosiy darslari (davomat, uy vazifasi, faollik)
 *      va normativlari qanday ketayotganini bitta joyda ko'radi.
 *
 * Kirish qoidasi (IDOR'dan himoya):
 *   - kurator — faqat O'Z o'quvchilari, o'z jadvali;
 *   - admin yoki `curator_oversight` ruxsati — hammasi;
 *   - o'quvchi — faqat o'zi va o'z kuratorining jadvali.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';
import { hasPermission } from '../../shared/middleware/permission.middleware';
import permissionsService from '../permissions/permissions.service';
import usersService from '../users/users.service';
import logger from '../../shared/utils/logger';
import {
  CURATOR_ALLOWED_MINUTES,
  CURATOR_MAX_PER_SLOT,
  CURATOR_PROGRAM_MONTHS,
  CURATOR_SESSION_MINUTES,
  CURATOR_SLOT_MINUTES,
  addMonthsUtc,
  formatCuratorSlot,
  isAllowedStartMinute,
  isClosedDay,
  isPastCuratorSlot,
  parseDateOnly,
  programTimeline,
  toDateOnlyString,
  todayInCenter,
} from '../../shared/constants/curator';
import programSeed from './curator-program.seed.json';

export interface Actor {
  userId: string;
  role: string;
}

type Homework = 'bajardi' | 'qisman' | 'bajarmadi';

/** O'qish oson, adashtiradigan belgilarsiz (0/O, 1/l/I yo'q) parol */
export function tempPassword(len = 8) {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(len), (b) => abc[b % abc.length]).join('');
}

const requireDate = (value: string, what = 'Sana'): Date => {
  const d = parseDateOnly(value);
  if (!d) throw ApiError.badRequest(`${what} noto'g'ri — YYYY-MM-DD ko'rinishida bo'lishi kerak`);
  return d;
};

// ════════════════════════════════════════════════════════════════════════
//  KIRISH
// ════════════════════════════════════════════════════════════════════════

export async function canOversee(actor: Actor): Promise<boolean> {
  return actor.role === 'admin' || (await hasPermission(actor, 'curator_oversight'));
}

/** Kurator yoki nazoratchi — aks holda 403 */
export async function assertCuratorOrOversee(actor: Actor): Promise<'own' | 'all'> {
  if (actor.role === 'kurator') return 'own';
  if (await canOversee(actor)) return 'all';
  throw ApiError.forbidden("Bu bo'lim faqat kuratorlar va kuratorlar nazorati ruxsati borlar uchun");
}

/**
 * Jadval bilan ishlaganda kimning jadvali: kurator — har doim o'ziniki
 * (boshqa curatorId yuborsa ham), nazoratchi — tanlangan kuratorniki.
 */
async function resolveCuratorId(actor: Actor, curatorId?: string): Promise<string> {
  if (actor.role === 'kurator') return actor.userId;
  if (!(await canOversee(actor))) throw ApiError.forbidden("Ruxsatingiz yo'q");
  if (!curatorId) throw ApiError.badRequest('Kuratorni tanlang');
  const c = await prisma.user.findFirst({ where: { id: curatorId, role: 'kurator' }, select: { id: true } });
  if (!c) throw ApiError.notFound('Kurator topilmadi');
  return c.id;
}

async function loadEnrollmentFor(actor: Actor, enrollmentId: string) {
  const cs = await prisma.curatorStudent.findUnique({ where: { id: enrollmentId } });
  if (!cs) throw ApiError.notFound("O'quvchi topilmadi");
  if (cs.curatorId !== actor.userId && !(await canOversee(actor))) {
    throw ApiError.forbidden("Bu o'quvchi sizga biriktirilmagan");
  }
  return cs;
}

async function loadSlotFor(actor: Actor, slotId: string) {
  const slot = await prisma.curatorSlot.findUnique({ where: { id: slotId } });
  if (!slot) throw ApiError.notFound('Vaqt topilmadi');
  if (slot.curatorId !== actor.userId && !(await canOversee(actor))) {
    throw ApiError.forbidden('Bu vaqt sizniki emas');
  }
  return slot;
}

/** Muddati o'tgan faol yozuvlarni "tugadi" ga o'tkazadi (arzon, har o'qishda) */
async function closeExpired() {
  const today = parseDateOnly(todayInCenter())!;
  await prisma.curatorStudent.updateMany({ where: { status: 'faol', endDate: { lt: today } }, data: { status: 'tugadi' } });
}

// ════════════════════════════════════════════════════════════════════════
//  DASTUR — gibrid model (2026-11-24): har hafta 2 ta "wow" + 1 ta chempionat
// ════════════════════════════════════════════════════════════════════════

/** Joriy seed versiyasi — content.seed ga yoziladi */
const SEED_VERSION = 'v2';

interface SeedLesson {
  n: number;
  code: string;
  week: number;
  weekTitle: string;
  kind: 'A' | 'C' | 'Z';
  title: string;
  goal?: string | null;
  content: Record<string, unknown>;
}

const seedRows = () =>
  (programSeed as SeedLesson[]).map((s) => ({
    n: s.n,
    code: s.code,
    week: s.week,
    weekTitle: s.weekTitle,
    kind: s.kind,
    title: s.title,
    goal: s.goal ?? null,
    content: s.content as any,
  }));

/**
 * Dastur "Demo-mentor qo'llanmasi"dan (gibrid model: 16 ta wow 1–16, 8 ta
 * chempionat C1–C8, 8 ta zaxira Z1–Z8) to'ldiriladi:
 *   - jadval bo'sh bo'lsa — bir marta;
 *   - eski (v1, 24 mashg'ulot) seed hali TEGILMAGAN bo'lsa (hech biri tahrirlanmagan,
 *     belgi yoki jadvalga bog'lanmagan) — yangisiga almashtiriladi.
 * Admin tahrirlagan yoki ishlatilayotgan dastur hech qachon qayta yozilmaydi.
 */
export async function ensureProgram(): Promise<number> {
  const existing = await prisma.curatorLesson.findMany({ select: { id: true, content: true, createdAt: true, updatedAt: true } });
  if (existing.length > 0) {
    const isOldSeed = existing.every((l) => (l.content as any)?.seed !== SEED_VERSION);
    if (!isOldSeed) return 0;
    const edited = existing.some((l) => l.updatedAt.getTime() - l.createdAt.getTime() > 1000);
    const [used, slots] = await Promise.all([prisma.curatorProgress.count(), prisma.curatorSlot.count({ where: { lessonId: { not: null } } })]);
    if (edited || used > 0 || slots > 0) return 0;
    await prisma.$transaction([prisma.curatorLesson.deleteMany({}), prisma.curatorLesson.createMany({ data: seedRows() })]);
    logger.info(`Kurator dasturi gibrid modelga (${SEED_VERSION}) yangilandi: ${existing.length} → ${seedRows().length}`);
    return seedRows().length;
  }
  const r = await prisma.curatorLesson.createMany({ data: seedRows(), skipDuplicates: true });
  logger.info(`Kurator dasturi to'ldirildi: ${r.count} ta element`);
  return r.count;
}

/** 2 oylik progressga kiradigan elementlar — wow va chempionat (zaxira kirmaydi) */
async function activeLessons() {
  return prisma.curatorLesson.findMany({ where: { isActive: true, kind: { not: 'Z' } }, orderBy: { n: 'asc' } });
}

const lessonShape = (l: { id: string; n: number; code: string | null; week: number; weekTitle: string; kind: string; title: string; goal: string | null; content: any; isActive: boolean }) => ({
  id: l.id,
  n: l.n,
  code: l.code ?? String(l.n),
  week: l.week,
  weekTitle: l.weekTitle,
  kind: l.kind,
  title: l.title,
  goal: l.goal,
  content: l.content ?? {},
  isActive: l.isActive,
});

export async function listProgram(includeInactive: boolean) {
  await ensureProgram();
  const lessons = await prisma.curatorLesson.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { n: 'asc' },
  });
  return {
    sessionMinutes: CURATOR_SESSION_MINUTES,
    months: CURATOR_PROGRAM_MONTHS,
    lessons: lessons.map(lessonShape),
  };
}

export interface LessonInput {
  n?: number;
  code?: string;
  week?: number;
  weekTitle?: string;
  kind?: 'A' | 'C' | 'Z';
  title?: string;
  goal?: string | null;
  content?: Record<string, unknown>;
  isActive?: boolean;
}

export async function saveLesson(id: string | null, data: LessonInput) {
  if (data.n !== undefined) {
    const clash = await prisma.curatorLesson.findFirst({ where: { n: data.n, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
    if (clash) throw ApiError.conflict(`${data.n}-raqamli mashg'ulot allaqachon bor`);
  }
  if (id) {
    const exists = await prisma.curatorLesson.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw ApiError.notFound("Mashg'ulot topilmadi");
    return lessonShape(await prisma.curatorLesson.update({ where: { id }, data: data as any }));
  }
  if (!data.n || !data.week || !data.weekTitle || !data.title) {
    throw ApiError.badRequest("Raqam, hafta, hafta mavzusi va nom majburiy");
  }
  return lessonShape(await prisma.curatorLesson.create({ data: data as any }));
}

// ════════════════════════════════════════════════════════════════════════
//  ASOSIY GURUHDAGI HOLAT (davomat, uy vazifasi, normativlar)
// ════════════════════════════════════════════════════════════════════════

interface MainStats {
  groups: { id: string; name: string; teacherName: string | null; joinedAt: string }[];
  lessons: { total: number; attended: number; absent: number; attendancePct: number | null; avgHomework: number | null; avgActivity: number | null };
  normatives: { assigned: number; g: number; b: number; r: number; p: number; donePct: number | null };
}

/** Bir nechta o'quvchi uchun asosiy guruhdagi holat — bir necha so'rovda */
async function mainStatsFor(studentIds: string[]): Promise<Map<string, MainStats>> {
  const out = new Map<string, MainStats>();
  if (!studentIds.length) return out;

  const links = await prisma.groupStudent.findMany({
    where: { studentId: { in: studentIds }, group: { isActive: true } },
    select: {
      studentId: true,
      joinedAt: true,
      group: { select: { id: true, name: true, teacher: { select: { fullName: true } } } },
    },
    orderBy: { joinedAt: 'asc' },
  });
  const groupIds = [...new Set(links.map((l) => l.group.id))];

  const [sessions, grades, groupNorms, subs] = await Promise.all([
    groupIds.length
      ? prisma.lessonSession.findMany({ where: { groupId: { in: groupIds } }, select: { id: true, groupId: true, date: true } })
      : Promise.resolve([] as { id: string; groupId: string; date: Date }[]),
    // Guruhsiz o'quvchilarda baho bo'lmaydi — so'rov umuman yuborilmaydi
    groupIds.length
      ? prisma.lessonGrade.findMany({
          where: { studentId: { in: studentIds }, session: { groupId: { in: groupIds } } },
          select: { studentId: true, sessionId: true, homework: true, homeworkScore: true, activityScore: true },
        })
      : Promise.resolve([] as { studentId: string; sessionId: string; homework: string | null; homeworkScore: number | null; activityScore: number | null }[]),
    groupIds.length
      ? prisma.groupNormative.findMany({ where: { groupId: { in: groupIds } }, select: { groupId: true, normativeId: true } })
      : Promise.resolve([] as { groupId: string; normativeId: string }[]),
    prisma.submission.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, normativeId: true, status: true, result: true },
    }),
  ]);

  for (const sid of studentIds) {
    const myLinks = links.filter((l) => l.studentId === sid);
    const myGroupIds = new Set(myLinks.map((l) => l.group.id));
    // Faqat o'quvchi guruhga qo'shilgandan keyingi darslar hisoblanadi
    const joined = new Map(myLinks.map((l) => [l.group.id, toDateOnlyString(l.joinedAt)]));
    const mySessions = sessions.filter((s) => myGroupIds.has(s.groupId) && toDateOnlyString(s.date) >= (joined.get(s.groupId) ?? ''));
    const sessionIds = new Set(mySessions.map((s) => s.id));
    const myGrades = grades.filter((g) => g.studentId === sid && sessionIds.has(g.sessionId));
    const absent = myGrades.filter((g) => g.homework === 'kelmadi').length;
    const present = myGrades.filter((g) => g.homework !== 'kelmadi');
    const hw = present.filter((g) => g.homeworkScore !== null).map((g) => g.homeworkScore as number);
    const act = present.filter((g) => g.activityScore !== null).map((g) => g.activityScore as number);
    const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);

    const assigned = new Set(groupNorms.filter((n) => myGroupIds.has(n.groupId)).map((n) => n.normativeId));
    const cnt = { g: 0, b: 0, r: 0, p: 0 };
    for (const s of subs) {
      if (s.studentId !== sid || !assigned.has(s.normativeId)) continue;
      if (s.status === 'pending' || !s.result) cnt.p++;
      else if (s.result === 'green') cnt.g++;
      else if (s.result === 'blue') cnt.b++;
      else cnt.r++;
    }
    const graded = myGrades.length;
    out.set(sid, {
      groups: myLinks.map((l) => ({ id: l.group.id, name: l.group.name, teacherName: l.group.teacher?.fullName ?? null, joinedAt: toDateOnlyString(l.joinedAt) })),
      lessons: {
        total: mySessions.length,
        attended: present.length,
        absent,
        attendancePct: graded ? Math.round((present.length / graded) * 100) : null,
        avgHomework: avg(hw),
        avgActivity: avg(act),
      },
      normatives: {
        assigned: assigned.size,
        ...cnt,
        donePct: assigned.size ? Math.round(((cnt.g + cnt.b) / assigned.size) * 100) : null,
      },
    });
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════
//  O'QUVCHILAR
// ════════════════════════════════════════════════════════════════════════

function progressSummary(
  lessons: { id: string; n: number; code: string | null; title: string; week: number; weekTitle: string }[],
  progress: { lessonId: string; attended: boolean; date: Date }[],
) {
  const done = new Set(progress.filter((p) => p.attended).map((p) => p.lessonId));
  const missed = progress.filter((p) => !p.attended && !done.has(p.lessonId)).length;
  const next = lessons.find((l) => !done.has(l.id)) ?? null;
  const last = [...progress].filter((p) => p.attended).sort((a, b) => +b.date - +a.date)[0];
  return {
    done: lessons.filter((l) => done.has(l.id)).length,
    missed,
    total: lessons.length,
    next: next ? { id: next.id, n: next.n, code: next.code ?? String(next.n), title: next.title, week: next.week, weekTitle: next.weekTitle } : null,
    lastDate: last ? toDateOnlyString(last.date) : null,
  };
}

export interface ListFilters {
  curatorId?: string;
  status?: 'faol' | 'tugadi' | 'toxtatildi' | 'all';
  search?: string;
  ungrouped?: boolean;
}

export async function listStudents(actor: Actor, f: ListFilters) {
  const scope = await assertCuratorOrOversee(actor);
  await closeExpired();
  await ensureProgram();

  const where: any = {};
  if (scope === 'own') where.curatorId = actor.userId;
  else if (f.curatorId) where.curatorId = f.curatorId;
  if (f.status && f.status !== 'all') where.status = f.status;
  if (f.search) {
    where.student = {
      OR: [
        { fullName: { contains: f.search, mode: 'insensitive' } },
        { login: { contains: f.search, mode: 'insensitive' } },
      ],
    };
  }

  const [rows, lessons] = await Promise.all([
    prisma.curatorStudent.findMany({
      where,
      orderBy: [{ status: 'asc' }, { demoDate: 'desc' }],
      include: {
        student: { select: { id: true, fullName: true, login: true, isActive: true, accessBlockedAt: true } },
        curator: { select: { id: true, fullName: true } },
        progress: { select: { lessonId: true, attended: true, date: true } },
      },
    }),
    activeLessons(),
  ]);

  const studentIds = rows.map((r) => r.studentId);
  const [main, upcoming] = await Promise.all([
    mainStatsFor(studentIds),
    prisma.curatorBooking.findMany({
      where: { studentId: { in: studentIds }, status: 'band', slot: { date: { gte: parseDateOnly(todayInCenter())! } } },
      include: { slot: { select: { date: true, startMinute: true, curatorId: true } } },
      orderBy: [{ slot: { date: 'asc' } }, { slot: { startMinute: 'asc' } }],
    }),
  ]);

  const items = rows
    .map((r) => {
      const m = main.get(r.studentId)!;
      // Bugun allaqachon boshlangan vaqt "keyingi" emas
      const next = upcoming.find(
        (b) => b.studentId === r.studentId && b.slot.curatorId === r.curatorId && !isPastCuratorSlot(toDateOnlyString(b.slot.date), b.slot.startMinute),
      );
      return {
        id: r.id,
        status: r.status,
        demoDate: toDateOnlyString(r.demoDate),
        endDate: toDateOnlyString(r.endDate),
        demoNote: r.demoNote,
        timeline: programTimeline(r.demoDate, r.endDate, lessons.length),
        student: {
          id: r.student.id,
          fullName: r.student.fullName,
          login: r.student.login,
          isActive: r.student.isActive,
          accessBlocked: !!r.student.accessBlockedAt,
        },
        curator: r.curator,
        progress: progressSummary(lessons, r.progress),
        main: m,
        nextBooking: next ? { date: toDateOnlyString(next.slot.date), time: formatCuratorSlot(next.slot.startMinute) } : null,
      };
    })
    .filter((x) => (f.ungrouped ? x.main.groups.length === 0 : true));

  return { scope, totalLessons: lessons.length, items };
}

/** Kurator ostidagi o'quvchining to'liq kartasi */
export async function getStudentDetail(actor: Actor, enrollmentId: string) {
  await assertCuratorOrOversee(actor);
  await closeExpired();
  const cs = await loadEnrollmentFor(actor, enrollmentId);

  const [student, curator, lessons, progress, main, bookings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: cs.studentId },
      select: { id: true, fullName: true, login: true, isActive: true, accessBlockedAt: true, createdAt: true },
    }),
    prisma.user.findUnique({ where: { id: cs.curatorId }, select: { id: true, fullName: true } }),
    activeLessons(),
    prisma.curatorProgress.findMany({ where: { curatorStudentId: cs.id }, orderBy: { date: 'asc' } }),
    mainStatsFor([cs.studentId]),
    prisma.curatorBooking.findMany({
      where: { studentId: cs.studentId, slot: { curatorId: cs.curatorId } },
      include: { slot: { select: { date: true, startMinute: true, lesson: { select: { n: true, code: true, title: true } } } } },
      orderBy: [{ slot: { date: 'desc' } }, { slot: { startMinute: 'desc' } }],
      take: 30,
    }),
  ]);
  if (!student) throw ApiError.notFound("O'quvchi topilmadi");

  // Asosiy guruh: oxirgi 15 dars va normativlar ro'yxati (isbot havolasi bilan)
  const m = main.get(cs.studentId)!;
  const groupIds = m.groups.map((g) => g.id);
  const joined = new Map(m.groups.map((g) => [g.id, g.joinedAt]));
  const [sessions, groupNorms, subs] = await Promise.all([
    groupIds.length
      ? prisma.lessonSession.findMany({
          where: { groupId: { in: groupIds } },
          orderBy: { date: 'desc' },
          take: 60,
          select: {
            id: true,
            groupId: true,
            date: true,
            topic: true,
            status: true,
            grades: {
              where: { studentId: cs.studentId },
              select: { homework: true, homeworkScore: true, activityScore: true, comment: true },
            },
          },
        })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.groupNormative.findMany({
          where: { groupId: { in: groupIds } },
          select: { normative: { select: { id: true, taskNumber: true, title: true } } },
        })
      : Promise.resolve([]),
    prisma.submission.findMany({
      where: { studentId: cs.studentId },
      select: { normativeId: true, status: true, result: true, score: true, youtubeUrl: true, submittedAt: true },
    }),
  ]);
  const subByNorm = new Map(subs.map((s) => [s.normativeId, s]));
  const normSeen = new Set<string>();
  const normatives = groupNorms
    .map((g) => g.normative)
    .filter((n) => (normSeen.has(n.id) ? false : (normSeen.add(n.id), true)))
    .sort((a, b) => a.taskNumber - b.taskNumber)
    .map((n) => {
      const s = subByNorm.get(n.id);
      const code = !s ? null : s.status === 'pending' || !s.result ? 'p' : s.result === 'green' ? 'g' : s.result === 'blue' ? 'b' : 'r';
      return {
        id: n.id,
        taskNumber: n.taskNumber,
        title: n.title,
        code,
        score: s?.score ?? null,
        url: s && /^https?:\/\/\S+$/i.test(s.youtubeUrl) ? s.youtubeUrl : null,
        date: s ? s.submittedAt.toISOString() : null,
      };
    });

  const progByLesson = new Map(progress.map((p) => [p.lessonId, p]));
  return {
    id: cs.id,
    status: cs.status,
    demoDate: toDateOnlyString(cs.demoDate),
    endDate: toDateOnlyString(cs.endDate),
    demoNote: cs.demoNote,
    timeline: programTimeline(cs.demoDate, cs.endDate, lessons.length),
    canEdit: cs.curatorId === actor.userId || (await canOversee(actor)),
    student: { ...student, accessBlocked: !!student.accessBlockedAt },
    curator,
    progress: progressSummary(lessons, progress),
    program: lessons.map((l) => {
      const p = progByLesson.get(l.id);
      return {
        lessonId: l.id,
        n: l.n,
        code: l.code ?? String(l.n),
        week: l.week,
        weekTitle: l.weekTitle,
        kind: l.kind,
        title: l.title,
        state: !p ? 'kutilmoqda' : p.attended ? 'otildi' : 'kelmadi',
        progressId: p?.id ?? null,
        date: p ? toDateOnlyString(p.date) : null,
        homework: p?.homework ?? null,
        note: p?.note ?? null,
      };
    }),
    main: {
      ...m,
      recentLessons: sessions
        .filter((s) => toDateOnlyString(s.date) >= (joined.get(s.groupId) ?? ''))
        .slice(0, 15)
        .map((s) => {
          const g = s.grades[0];
          return {
            id: s.id,
            date: toDateOnlyString(s.date),
            groupName: m.groups.find((x) => x.id === s.groupId)?.name ?? '',
            topic: s.topic,
            attended: g ? g.homework !== 'kelmadi' : null,
            homework: g?.homework ?? null,
            homeworkScore: g?.homeworkScore ?? null,
            activityScore: g?.activityScore ?? null,
            comment: g?.comment ?? null,
          };
        }),
      normativeList: normatives,
    },
    bookings: bookings.map((b) => ({
      id: b.id,
      date: toDateOnlyString(b.slot.date),
      time: formatCuratorSlot(b.slot.startMinute),
      status: b.status,
      lesson: b.slot.lesson,
    })),
  };
}

/** Yangi o'quvchi uchun bo'sh login taklifi: student + 4 raqam */
export async function suggestLogin(): Promise<{ login: string; password: string }> {
  for (let i = 0; i < 30; i++) {
    const login = `student${1000 + crypto.randomInt(9000)}`;
    const taken = await prisma.user.findUnique({ where: { login }, select: { id: true } });
    if (!taken) return { login, password: tempPassword() };
  }
  return { login: `student${Date.now().toString().slice(-6)}`, password: tempPassword() };
}

export interface CreateStudentInput {
  fullName: string;
  login: string;
  password: string;
  demoDate: string;
  demoNote?: string | null;
  curatorId?: string;
}

/**
 * Demo darsdan keyin bolani ILS'ga qo'shish: o'quvchi akkaunti (guruhsiz) +
 * kurator yozuvi bitta tranzaksiyada — yarim yaratilgan akkaunt qolmaydi.
 */
export async function createStudent(actor: Actor, data: CreateStudentInput) {
  const scope = await assertCuratorOrOversee(actor);
  const curatorId = scope === 'own' ? actor.userId : await resolveCuratorId(actor, data.curatorId);
  const demoDate = requireDate(data.demoDate, 'Demo sanasi');
  if (toDateOnlyString(demoDate) > todayInCenter()) throw ApiError.badRequest("Demo sanasi kelajakda bo'lishi mumkin emas");

  const login = data.login.trim();
  const exists = await prisma.user.findUnique({ where: { login }, select: { id: true } });
  if (exists) throw ApiError.conflict(`"${login}" login band — boshqasini tanlang`);
  const passwordHash = await bcrypt.hash(data.password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { fullName: data.fullName.trim(), login, passwordHash, role: 'student' },
      select: { id: true, fullName: true, login: true },
    });
    const cs = await tx.curatorStudent.create({
      data: {
        curatorId,
        studentId: user.id,
        demoDate,
        endDate: addMonthsUtc(demoDate, CURATOR_PROGRAM_MONTHS),
        demoNote: data.demoNote?.trim() || null,
        createdById: actor.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: 'CREATE_USER',
        targetType: 'user',
        targetId: user.id,
        details: { role: 'student', login, via: 'curator', curatorId },
      },
    });
    return { user, cs };
  });
  await permissionsService.grantRoleDefaults(result.user.id, 'student');
  logger.info(`Kurator o'quvchi qo'shdi: ${login} (kurator ${curatorId})`);

  return {
    id: result.cs.id,
    student: result.user,
    // Parol faqat shu javobda bir marta qaytadi — kurator bolaga beradi
    credentials: { login, password: data.password },
  };
}

/** Mavjud o'quvchini kuratorga biriktirish (faqat nazoratchi) */
export async function assignExisting(actor: Actor, data: { studentId: string; curatorId: string; demoDate: string; demoNote?: string | null }) {
  if (!(await canOversee(actor))) throw ApiError.forbidden("Kuratorlar nazorati ruxsati kerak");
  const curatorId = await resolveCuratorId(actor, data.curatorId);
  const demoDate = requireDate(data.demoDate, 'Demo sanasi');
  const student = await prisma.user.findFirst({ where: { id: data.studentId, role: 'student' }, select: { id: true } });
  if (!student) throw ApiError.notFound("O'quvchi topilmadi");
  const existing = await prisma.curatorStudent.findUnique({ where: { studentId: student.id }, select: { id: true } });
  if (existing) throw ApiError.conflict("Bu o'quvchining kuratori allaqachon bor — kartasidan kuratorni almashtiring");
  const cs = await prisma.curatorStudent.create({
    data: {
      curatorId,
      studentId: student.id,
      demoDate,
      endDate: addMonthsUtc(demoDate, CURATOR_PROGRAM_MONTHS),
      demoNote: data.demoNote?.trim() || null,
      createdById: actor.userId,
    },
  });
  return { id: cs.id };
}

/** Kuratori yo'q o'quvchilarni qidirish (biriktirish oynasi uchun) */
export async function searchUnassigned(actor: Actor, search: string) {
  if (!(await canOversee(actor))) throw ApiError.forbidden("Kuratorlar nazorati ruxsati kerak");
  const q = search.trim();
  if (q.length < 2) return [];
  const rows = await prisma.user.findMany({
    where: {
      role: 'student',
      isActive: true,
      curatorEnrollment: null,
      OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { login: { contains: q, mode: 'insensitive' } }],
    },
    select: {
      id: true,
      fullName: true,
      login: true,
      createdAt: true,
      groupStudents: { select: { group: { select: { name: true } } }, take: 2 },
    },
    take: 15,
    orderBy: { fullName: 'asc' },
  });
  return rows.map((r) => ({ id: r.id, fullName: r.fullName, login: r.login, groups: r.groupStudents.map((g) => g.group.name) }));
}

export async function updateEnrollment(
  actor: Actor,
  id: string,
  data: { status?: 'faol' | 'tugadi' | 'toxtatildi'; demoNote?: string | null; demoDate?: string; curatorId?: string },
) {
  const cs = await loadEnrollmentFor(actor, id);
  const patch: any = {};
  if (data.status) patch.status = data.status;
  if (data.demoNote !== undefined) patch.demoNote = data.demoNote?.trim() || null;
  if (data.demoDate) {
    const d = requireDate(data.demoDate, 'Demo sanasi');
    patch.demoDate = d;
    patch.endDate = addMonthsUtc(d, CURATOR_PROGRAM_MONTHS);
    // Muddat uzaygan bo'lsa va "tugadi" avtomatik qo'yilgan bo'lsa — qayta faol
    if (!data.status && cs.status === 'tugadi' && toDateOnlyString(patch.endDate) >= todayInCenter()) patch.status = 'faol';
  }
  if (data.curatorId && data.curatorId !== cs.curatorId) {
    if (!(await canOversee(actor))) throw ApiError.forbidden("Kuratorni faqat nazoratchi almashtira oladi");
    patch.curatorId = await resolveCuratorId(actor, data.curatorId);
  }
  await prisma.curatorStudent.update({ where: { id }, data: patch });
  return { success: true };
}

/** Dasturdagi mashg'ulotni qo'lda belgilash (jadvalsiz o'tilgan bo'lsa ham) */
export async function recordProgress(
  actor: Actor,
  enrollmentId: string,
  data: { lessonId: string; attended: boolean; homework?: Homework | null; note?: string | null; date: string },
) {
  const cs = await loadEnrollmentFor(actor, enrollmentId);
  const date = requireDate(data.date);
  if (toDateOnlyString(date) > todayInCenter()) throw ApiError.badRequest("Kelajakdagi sanani belgilab bo'lmaydi");
  const lesson = await prisma.curatorLesson.findUnique({ where: { id: data.lessonId }, select: { id: true } });
  if (!lesson) throw ApiError.notFound("Mashg'ulot topilmadi");
  const row = await prisma.curatorProgress.upsert({
    where: { curatorStudentId_lessonId: { curatorStudentId: cs.id, lessonId: lesson.id } },
    create: {
      curatorStudentId: cs.id,
      lessonId: lesson.id,
      attended: data.attended,
      homework: data.homework ?? null,
      note: data.note?.trim() || null,
      date,
      markedById: actor.userId,
    },
    update: {
      attended: data.attended,
      homework: data.homework ?? null,
      note: data.note?.trim() || null,
      date,
      markedById: actor.userId,
    },
  });
  return { id: row.id };
}

export async function deleteProgress(actor: Actor, progressId: string) {
  const p = await prisma.curatorProgress.findUnique({ where: { id: progressId }, select: { id: true, curatorStudentId: true } });
  if (!p) throw ApiError.notFound('Yozuv topilmadi');
  await loadEnrollmentFor(actor, p.curatorStudentId);
  await prisma.curatorProgress.delete({ where: { id: p.id } });
  return { success: true };
}

// ════════════════════════════════════════════════════════════════════════
//  KURATORLAR RO'YXATI (nazorat)
// ════════════════════════════════════════════════════════════════════════

export async function listCurators(actor: Actor) {
  const scope = await assertCuratorOrOversee(actor);
  await closeExpired();
  const today = parseDateOnly(todayInCenter())!;
  const weekEnd = new Date(today);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const curators = await prisma.user.findMany({
    where: { role: 'kurator', ...(scope === 'own' ? { id: actor.userId } : { isActive: true }) },
    select: { id: true, fullName: true, login: true, avatarUrl: true },
    orderBy: { fullName: 'asc' },
  });
  const ids = curators.map((c) => c.id);
  const [byStatus, slots, ungrouped] = await Promise.all([
    prisma.curatorStudent.groupBy({ by: ['curatorId', 'status'], where: { curatorId: { in: ids } }, _count: { _all: true } }),
    prisma.curatorSlot.groupBy({ by: ['curatorId'], where: { curatorId: { in: ids }, date: { gte: today, lt: weekEnd } }, _count: { _all: true } }),
    prisma.curatorStudent.groupBy({
      by: ['curatorId'],
      where: { curatorId: { in: ids }, status: 'faol', student: { groupStudents: { none: {} } } },
      _count: { _all: true },
    }),
  ]);
  return curators.map((c) => {
    const n = (s: string) => byStatus.find((x) => x.curatorId === c.id && x.status === s)?._count._all ?? 0;
    return {
      ...c,
      active: n('faol'),
      finished: n('tugadi'),
      stopped: n('toxtatildi'),
      ungrouped: ungrouped.find((x) => x.curatorId === c.id)?._count._all ?? 0,
      slotsThisWeek: slots.find((x) => x.curatorId === c.id)?._count._all ?? 0,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════
//  JADVAL (kurator vaqtlari)
// ════════════════════════════════════════════════════════════════════════

const slotInclude = {
  lesson: { select: { id: true, n: true, code: true, title: true } },
  bookings: {
    orderBy: { createdAt: 'asc' as const },
    include: { student: { select: { id: true, fullName: true } } },
  },
};

function slotShape(s: any) {
  const active = s.bookings.filter((b: any) => b.status !== 'bekor');
  const dateStr = toDateOnlyString(s.date);
  return {
    id: s.id,
    date: dateStr,
    startMinute: s.startMinute,
    time: formatCuratorSlot(s.startMinute),
    capacity: s.capacity,
    booked: active.length,
    free: Math.max(0, s.capacity - active.length),
    isOpen: s.isOpen,
    isPast: isPastCuratorSlot(dateStr, s.startMinute),
    note: s.note,
    lesson: s.lesson,
    students: active.map((b: any) => ({ bookingId: b.id, studentId: b.student.id, fullName: b.student.fullName, status: b.status })),
  };
}

export async function getDay(actor: Actor, dateStr: string, curatorIdParam?: string) {
  const curatorId = await resolveCuratorId(actor, curatorIdParam);
  const date = requireDate(dateStr);
  const slots = await prisma.curatorSlot.findMany({ where: { curatorId, date }, orderBy: { startMinute: 'asc' }, include: slotInclude });
  return {
    date: dateStr,
    curatorId,
    isClosedDay: isClosedDay(date),
    allowedMinutes: CURATOR_ALLOWED_MINUTES,
    slotMinutes: CURATOR_SLOT_MINUTES,
    sessionMinutes: CURATOR_SESSION_MINUTES,
    maxCapacity: CURATOR_MAX_PER_SLOT,
    slots: slots.map(slotShape),
  };
}

export async function getWeek(actor: Actor, fromStr: string, curatorIdParam?: string) {
  const curatorId = await resolveCuratorId(actor, curatorIdParam);
  const from = requireDate(fromStr);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 7);
  const slots = await prisma.curatorSlot.findMany({
    where: { curatorId, date: { gte: from, lt: to } },
    orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
    include: slotInclude,
  });
  return slots.map(slotShape);
}

/**
 * Bir kunning ochiq vaqtlarini birdaniga belgilash. Ro'yxatda yo'q, lekin
 * ilgari ochilgan vaqtlar: yozilgan bo'lsa — yopiladi, bo'sh bo'lsa — o'chadi.
 */
export async function setDay(
  actor: Actor,
  data: { date: string; minutes: number[]; capacity?: number; lessonId?: string | null; curatorId?: string },
) {
  const curatorId = await resolveCuratorId(actor, data.curatorId);
  const date = requireDate(data.date);
  if (isClosedDay(date)) throw ApiError.badRequest("Yakshanba — dam olish kuni");
  const minutes = [...new Set(data.minutes)].sort((a, b) => a - b);
  for (const m of minutes) {
    if (!isAllowedStartMinute(m)) throw ApiError.badRequest(`${formatCuratorSlot(m)} — ish vaqtidan tashqarida (08:00–20:00, 30 daqiqalik qadam)`);
    if (isPastCuratorSlot(data.date, m)) throw ApiError.badRequest(`${formatCuratorSlot(m)} allaqachon o'tib ketgan`);
  }
  const capacity = data.capacity ?? CURATOR_MAX_PER_SLOT;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > CURATOR_MAX_PER_SLOT) {
    throw ApiError.badRequest(`Bitta vaqtga 1 dan ${CURATOR_MAX_PER_SLOT} tagacha o'quvchi`);
  }
  if (data.lessonId) {
    const l = await prisma.curatorLesson.findUnique({ where: { id: data.lessonId }, select: { id: true } });
    if (!l) throw ApiError.notFound("Mashg'ulot topilmadi");
  }

  const existing = await prisma.curatorSlot.findMany({
    where: { curatorId, date },
    include: { bookings: { where: { status: { not: 'bekor' } }, select: { id: true } } },
  });
  const byMinute = new Map(existing.map((s) => [s.startMinute, s]));
  await prisma.$transaction(async (tx) => {
    for (const m of minutes) {
      const found = byMinute.get(m);
      if (found) {
        if (found.bookings.length > capacity) {
          throw ApiError.badRequest(`${formatCuratorSlot(m)} ga ${found.bookings.length} kishi yozilgan — sig'imni undan kam qilib bo'lmaydi`);
        }
        await tx.curatorSlot.update({
          where: { id: found.id },
          data: { isOpen: true, capacity, ...(data.lessonId !== undefined ? { lessonId: data.lessonId } : {}) },
        });
      } else {
        await tx.curatorSlot.create({ data: { curatorId, date, startMinute: m, capacity, lessonId: data.lessonId ?? null } });
      }
    }
    for (const s of existing) {
      if (minutes.includes(s.startMinute)) continue;
      if (isPastCuratorSlot(data.date, s.startMinute)) continue; // o'tgan vaqt — tarix, tegmaymiz
      const hasAny = await tx.curatorBooking.count({ where: { slotId: s.id } });
      if (hasAny > 0) await tx.curatorSlot.update({ where: { id: s.id }, data: { isOpen: false } });
      else await tx.curatorSlot.delete({ where: { id: s.id } });
    }
  });
  return getDay(actor, data.date, curatorId);
}

export async function updateSlot(
  actor: Actor,
  slotId: string,
  data: { isOpen?: boolean; capacity?: number; lessonId?: string | null; note?: string | null },
) {
  const slot = await loadSlotFor(actor, slotId);
  const patch: any = {};
  if (data.isOpen !== undefined) patch.isOpen = data.isOpen;
  if (data.note !== undefined) patch.note = data.note?.trim() || null;
  if (data.capacity !== undefined) {
    if (!Number.isInteger(data.capacity) || data.capacity < 1 || data.capacity > CURATOR_MAX_PER_SLOT) {
      throw ApiError.badRequest(`Bitta vaqtga 1 dan ${CURATOR_MAX_PER_SLOT} tagacha o'quvchi`);
    }
    const taken = await prisma.curatorBooking.count({ where: { slotId, status: { not: 'bekor' } } });
    if (taken > data.capacity) throw ApiError.badRequest(`Bu vaqtga ${taken} kishi yozilgan — sig'imni undan kam qilib bo'lmaydi`);
    patch.capacity = data.capacity;
  }
  if (data.lessonId !== undefined) {
    if (data.lessonId) {
      const l = await prisma.curatorLesson.findUnique({ where: { id: data.lessonId }, select: { id: true } });
      if (!l) throw ApiError.notFound("Mashg'ulot topilmadi");
    }
    patch.lessonId = data.lessonId;
  }
  await prisma.curatorSlot.update({ where: { id: slot.id }, data: patch });
  return { success: true };
}

export async function deleteSlot(actor: Actor, slotId: string) {
  const slot = await loadSlotFor(actor, slotId);
  const taken = await prisma.curatorBooking.count({ where: { slotId: slot.id } });
  if (taken > 0) throw ApiError.badRequest("Bu vaqtga o'quvchi yozilgan — o'chirib bo'lmaydi, faqat yopish mumkin");
  await prisma.curatorSlot.delete({ where: { id: slot.id } });
  return { success: true };
}

/**
 * Yozilishning umumiy qoidalari — o'quvchi o'zi yozilganda ham, kurator uni
 * qo'shganda ham bir xil. Sig'im Serializable tranzaksiya ichida tekshiriladi:
 * ikki bola bir paytda oxirgi joyni bossa, 9-chi yozilib qolmaydi.
 */
async function bookInternal(slotId: string, studentId: string, byStaff: boolean) {
  const slot = await prisma.curatorSlot.findUnique({ where: { id: slotId } });
  if (!slot) throw ApiError.notFound('Vaqt topilmadi');
  const dateStr = toDateOnlyString(slot.date);
  if (!slot.isOpen && !byStaff) throw ApiError.badRequest('Bu vaqt yopilgan');
  if (isPastCuratorSlot(dateStr, slot.startMinute)) throw ApiError.badRequest("Bu vaqt o'tib ketgan — keyingisini tanlang");

  const cs = await prisma.curatorStudent.findUnique({ where: { studentId } });
  if (!cs || cs.curatorId !== slot.curatorId) {
    throw ApiError.forbidden(byStaff ? "Bu o'quvchi shu kuratorga biriktirilmagan" : "Siz faqat o'z kuratoringiz vaqtiga yozila olasiz");
  }
  if (cs.status !== 'faol') throw ApiError.badRequest("Kuratorlik muddati tugagan — yozilib bo'lmaydi");

  const booking = await prisma.$transaction(
    async (tx) => {
      const sameDay = await tx.curatorBooking.findFirst({
        where: { studentId, status: { not: 'bekor' }, slot: { date: slot.date, curatorId: slot.curatorId } },
        include: { slot: true },
      });
      if (sameDay) {
        if (sameDay.slotId === slotId) throw ApiError.badRequest('Allaqachon shu vaqtga yozilgan');
        throw ApiError.badRequest(`Bir kunda bitta vaqtga yoziladi — ${formatCuratorSlot(sameDay.slot.startMinute)} ga yozilgan, avval uni bekor qiling`);
      }
      const taken = await tx.curatorBooking.count({ where: { slotId, status: { not: 'bekor' } } });
      if (taken >= slot.capacity) throw ApiError.badRequest("Bu vaqt to'lib qoldi — boshqasini tanlang");
      const old = await tx.curatorBooking.findUnique({ where: { slotId_studentId: { slotId, studentId } } });
      return old
        ? tx.curatorBooking.update({ where: { id: old.id }, data: { status: 'band', cancelledAt: null, createdAt: new Date() } })
        : tx.curatorBooking.create({ data: { slotId, studentId } });
    },
    { isolationLevel: 'Serializable' },
  );
  return { id: booking.id, date: dateStr, time: formatCuratorSlot(slot.startMinute) };
}

/** Kurator o'z o'quvchisini vaqtga o'zi qo'shadi (bola o'zi yozilmagan bo'lsa) */
export async function addToSlot(actor: Actor, slotId: string, studentId: string) {
  await loadSlotFor(actor, slotId);
  return bookInternal(slotId, studentId, true);
}

/** Kurator "keldi/kelmadi" belgilaydi — vaqtga mashg'ulot biriktirilgan bo'lsa, dasturga yoziladi */
export async function markAttendance(actor: Actor, bookingId: string, status: 'keldi' | 'kelmadi') {
  const b = await prisma.curatorBooking.findUnique({ where: { id: bookingId }, include: { slot: true } });
  if (!b) throw ApiError.notFound('Yozuv topilmadi');
  await loadSlotFor(actor, b.slotId);
  if (b.status === 'bekor') throw ApiError.badRequest('Bekor qilingan yozuv');
  const dateStr = toDateOnlyString(b.slot.date);
  if (dateStr > todayInCenter()) throw ApiError.badRequest("Hali bo'lmagan mashg'ulotni belgilab bo'lmaydi");

  await prisma.curatorBooking.update({ where: { id: b.id }, data: { status } });

  let progressLesson: string | null = null;
  if (b.slot.lessonId) {
    const cs = await prisma.curatorStudent.findUnique({ where: { studentId: b.studentId } });
    if (cs && cs.curatorId === b.slot.curatorId) {
      const key = { curatorStudentId_lessonId: { curatorStudentId: cs.id, lessonId: b.slot.lessonId } };
      const existing = await prisma.curatorProgress.findUnique({ where: key });
      // Boshqa kuni allaqachon "o'tildi" bo'lgan mashg'ulotni "kelmadi" bosib o'chirib yubormaymiz
      const keep = existing && existing.attended && existing.slotId !== b.slotId && status === 'kelmadi';
      if (!keep) {
        await prisma.curatorProgress.upsert({
          where: key,
          create: { curatorStudentId: cs.id, lessonId: b.slot.lessonId, attended: status === 'keldi', date: b.slot.date, slotId: b.slotId, markedById: actor.userId },
          update: { attended: status === 'keldi', date: b.slot.date, slotId: b.slotId, markedById: actor.userId },
        });
        progressLesson = b.slot.lessonId;
      }
    }
  }
  return { success: true, progressLesson };
}

// ════════════════════════════════════════════════════════════════════════
//  O'QUVCHI TOMONI
// ════════════════════════════════════════════════════════════════════════

export async function studentMe(studentId: string) {
  await closeExpired();
  const cs = await prisma.curatorStudent.findUnique({
    where: { studentId },
    include: {
      curator: { select: { id: true, fullName: true, avatarUrl: true, bio: true } },
      progress: { select: { lessonId: true, attended: true, date: true, homework: true } },
    },
  });
  if (!cs) return { enrollment: null };
  const lessons = await activeLessons();
  const done = new Map(cs.progress.map((p) => [p.lessonId, p]));
  const bookings = await prisma.curatorBooking.findMany({
    where: { studentId, slot: { curatorId: cs.curatorId } },
    include: { slot: { select: { date: true, startMinute: true, lesson: { select: { n: true, code: true, title: true } } } } },
    orderBy: [{ slot: { date: 'desc' } }, { slot: { startMinute: 'desc' } }],
    take: 20,
  });
  return {
    enrollment: {
      id: cs.id,
      status: cs.status,
      demoDate: toDateOnlyString(cs.demoDate),
      endDate: toDateOnlyString(cs.endDate),
      timeline: programTimeline(cs.demoDate, cs.endDate, lessons.length),
      curator: cs.curator,
      progress: progressSummary(lessons, cs.progress),
      program: lessons.map((l) => {
        const p = done.get(l.id);
        return {
          n: l.n,
          code: l.code ?? String(l.n),
          week: l.week,
          weekTitle: l.weekTitle,
          kind: l.kind,
          title: l.title,
          goal: l.goal,
          state: !p ? 'kutilmoqda' : p.attended ? 'otildi' : 'kelmadi',
          date: p ? toDateOnlyString(p.date) : null,
        };
      }),
      bookings: bookings.map((b) => {
        const dateStr = toDateOnlyString(b.slot.date);
        return {
          id: b.id,
          date: dateStr,
          time: formatCuratorSlot(b.slot.startMinute),
          status: b.status,
          lesson: b.slot.lesson,
          canCancel: b.status === 'band' && !isPastCuratorSlot(dateStr, b.slot.startMinute),
        };
      }),
    },
  };
}

/** O'quvchi o'z kuratorining kelayotgan 7 kunlik ochiq vaqtlarini ko'radi */
export async function studentAvailable(studentId: string, fromStr?: string) {
  const cs = await prisma.curatorStudent.findUnique({ where: { studentId } });
  if (!cs) return { slots: [], reason: 'Sizga kurator biriktirilmagan' };
  const from = fromStr ? requireDate(fromStr) : parseDateOnly(todayInCenter())!;
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 7);
  const slots = await prisma.curatorSlot.findMany({
    where: { curatorId: cs.curatorId, date: { gte: from, lt: to } },
    orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
    include: {
      lesson: { select: { n: true, code: true, title: true } },
      bookings: { where: { status: { not: 'bekor' } }, select: { id: true, studentId: true, status: true } },
    },
  });
  const bookedDays = new Set(
    slots.filter((s) => s.bookings.some((b) => b.studentId === studentId)).map((s) => toDateOnlyString(s.date)),
  );
  return {
    reason: cs.status !== 'faol' ? 'Kuratorlik muddati tugagan' : null,
    slots: slots
      .filter((s) => s.isOpen || s.bookings.some((b) => b.studentId === studentId))
      .map((s) => {
        const dateStr = toDateOnlyString(s.date);
        const mine = s.bookings.find((b) => b.studentId === studentId);
        const free = Math.max(0, s.capacity - s.bookings.length);
        const past = isPastCuratorSlot(dateStr, s.startMinute);
        let reason: string | null = null;
        if (!mine) {
          if (cs.status !== 'faol') reason = 'Muddat tugagan';
          else if (past) reason = "Vaqt o'tgan";
          else if (free === 0) reason = "To'lgan";
          else if (bookedDays.has(dateStr)) reason = 'Shu kuni yozilgansiz';
        }
        return {
          slotId: s.id,
          date: dateStr,
          time: formatCuratorSlot(s.startMinute),
          capacity: s.capacity,
          booked: s.bookings.length,
          free,
          lesson: s.lesson,
          isMine: !!mine,
          myBookingId: mine?.id ?? null,
          myStatus: mine?.status ?? null,
          isPast: past,
          canBook: !mine && !reason,
          reason,
        };
      }),
  };
}

export async function studentBook(studentId: string, slotId: string) {
  return bookInternal(slotId, studentId, false);
}

/** Bekor qilish: o'quvchi — o'zinikini (boshlanmasdan oldin), kurator — o'z vaqtidagini, nazoratchi — hammasini */
export async function cancelBooking(actor: Actor, bookingId: string) {
  const b = await prisma.curatorBooking.findUnique({ where: { id: bookingId }, include: { slot: true } });
  if (!b) throw ApiError.notFound('Yozuv topilmadi');
  const isOwner = actor.role === 'student' && b.studentId === actor.userId;
  const isStaff = actor.role !== 'student' && (b.slot.curatorId === actor.userId || (await canOversee(actor)));
  if (!isOwner && !isStaff) throw ApiError.forbidden('Bu yozuv sizniki emas');
  if (b.status === 'bekor') return { success: true };
  if (isOwner && isPastCuratorSlot(toDateOnlyString(b.slot.date), b.slot.startMinute)) {
    throw ApiError.badRequest("Boshlanib ketgan vaqtni bekor qilib bo'lmaydi");
  }
  await prisma.curatorBooking.update({ where: { id: b.id }, data: { status: 'bekor', cancelledAt: new Date() } });
  return { success: true };
}

// ════════════════════════════════════════════════════════════════════════
//  XODIM KO'RADIGAN QISQA KARTA (o'quvchi profilida)
// ════════════════════════════════════════════════════════════════════════

/**
 * O'quvchi profilidagi "Kurator" kartasi. Ko'ra oladi: admin, nazoratchi,
 * o'sha bolaning kuratori, o'sha bolaning o'qituvchisi va "O'quvchi profilini
 * ko'rish" ruxsati borlar.
 */
export async function summaryForStudent(actor: Actor, studentId: string) {
  const cs = await prisma.curatorStudent.findUnique({
    where: { studentId },
    include: {
      curator: { select: { id: true, fullName: true } },
      progress: { select: { lessonId: true, attended: true, date: true } },
    },
  });
  const allowed =
    actor.role === 'admin' ||
    (cs && cs.curatorId === actor.userId) ||
    (actor.role === 'teacher' && (await usersService.isStudentOfTeacher(studentId, actor.userId))) ||
    (await canOversee(actor)) ||
    (await hasPermission(actor, 'view_student_profile'));
  if (!allowed) throw ApiError.forbidden("Ruxsatingiz yo'q");
  if (!cs) return null;
  const lessons = await activeLessons();
  return {
    id: cs.id,
    status: cs.status,
    demoDate: toDateOnlyString(cs.demoDate),
    endDate: toDateOnlyString(cs.endDate),
    curator: cs.curator,
    timeline: programTimeline(cs.demoDate, cs.endDate, lessons.length),
    progress: progressSummary(lessons, cs.progress),
  };
}
