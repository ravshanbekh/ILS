/**
 * MCP o'qish (tahlil) amallari — `ils:read` huquqi bilan.
 *
 * Qoidalar:
 *  - Har ro'yxat sahifalanadi va qattiq yuqori chegaraga ega (Claude kontekstini
 *    va bazani himoya qiladi).
 *  - O'quvchi ballari guruh bo'yicha hisoblanganda submission.groupId EMAS,
 *    "guruhdagi o'quvchi × guruhga biriktirilgan normativ" ishlatiladi:
 *    groupId o'quvchi boshqa guruhga o'tkazilganda eskirib qoladi.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { McpActor, ok, toolError, tashkentNow, tashkentDay, parseDay, pct, McpUserError, fail } from '../context';
import { mcpConfig } from '../config';

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const DAY = 24 * 60 * 60 * 1000;

const uuid = (what: string) => z.string().uuid().describe(`${what} ID (UUID)`);
const limitArg = (def: number, max: number) =>
  z.number().int().min(1).max(max).default(def).describe(`Natijalar soni (1–${max})`);
const offsetArg = z.number().int().min(0).default(0).describe('Sahifalash uchun boshlang\'ich o\'rin');

const ROLES = [
  'admin', 'teacher', 'student', 'filial_rahbari', 'assistant', 'moliya_rahbari', 'kassir',
  'administrator', 'nazoratchi', 'hr_rahbari', 'sotuv_operatori', 'farrosh',
  'robototexnika_ustoz', 'call_operatori',
] as const;

/** Guruhdagi faol o'quvchilarning guruh normativlari bo'yicha natijasi */
async function groupStudentStats(groupId: string) {
  const [members, assigned] = await Promise.all([
    prisma.groupStudent.findMany({
      where: { groupId },
      select: {
        joinedAt: true,
        student: { select: { id: true, fullName: true, login: true, isActive: true } },
      },
      orderBy: { student: { fullName: 'asc' } },
    }),
    prisma.groupNormative.findMany({ where: { groupId }, select: { normativeId: true } }),
  ]);
  const studentIds = members.map((m) => m.student.id);
  const normativeIds = assigned.map((a) => a.normativeId);

  const subs =
    studentIds.length && normativeIds.length
      ? await prisma.submission.findMany({
          where: { studentId: { in: studentIds }, normativeId: { in: normativeIds } },
          select: { studentId: true, status: true, result: true, score: true },
        })
      : [];

  const byStudent = new Map<string, { green: number; blue: number; red: number; pending: number; score: number }>();
  for (const s of subs) {
    const st = byStudent.get(s.studentId) ?? { green: 0, blue: 0, red: 0, pending: 0, score: 0 };
    if (s.status === 'pending') st.pending++;
    else if (s.result) st[s.result]++;
    st.score += s.score;
    byStudent.set(s.studentId, st);
  }

  return {
    assignedNormatives: normativeIds.length,
    students: members.map((m) => {
      const st = byStudent.get(m.student.id) ?? { green: 0, blue: 0, red: 0, pending: 0, score: 0 };
      return {
        id: m.student.id,
        fullName: m.student.fullName,
        login: m.student.login,
        isActive: m.student.isActive,
        joinedAt: tashkentDay(m.joinedAt),
        normatives: {
          ...st,
          notSubmitted: Math.max(normativeIds.length - (st.green + st.blue + st.red + st.pending), 0),
          completionPct: pct(st.green, normativeIds.length),
        },
      };
    }),
  };
}

export function registerReadTools(server: McpServer, actor: McpActor) {
  // ── 0. Kim ulangan ──────────────────────────────────────────────────────────
  server.registerTool(
    'ils_whoami',
    {
      title: 'Ulanish haqida',
      description:
        'Kim nomidan ulanganini, qaysi huquqlar (ils:read / ils:write) berilganini va server vaqtini (Toshkent) qaytaradi. Suhbat boshida bir marta chaqirish foydali.',
      annotations: READ,
    },
    async () =>
      ok({
        system: 'IT Live Score (itlivescore.uz) — IT Live Academy o\'quv boshqaruv tizimi',
        user: { id: actor.userId, fullName: actor.fullName, role: actor.role },
        scopes: actor.scopes,
        canWrite: actor.scopes.includes(mcpConfig.scopes.write),
        client: actor.clientName ?? actor.clientId,
        serverTimeTashkent: tashkentNow(),
        hint:
          'Tahlil uchun avval ils_overview, keyin kerakli ro\'yxat/hisobot amallari. Murakkab kesimlar uchun ils_db_schema + ils_sql_query.',
      })
  );

  // ── 1. Umumiy holat ─────────────────────────────────────────────────────────
  server.registerTool(
    'ils_overview',
    {
      title: 'Umumiy holat (KPI)',
      description:
        'Tizimning hozirgi holati: faol guruh/o\'quvchi/ustozlar, guruhsiz o\'quvchilar, tekshirilmagan normativlar (va 3 kundan eskilari), so\'nggi 7/30 kun dinamikasi, kechikkan va yaqinlashayotgan bosqichlar (demo day/imtihon), shu oydagi muzlatishlar, yangi ota-ona murojaatlari, faol imtihonlar.',
      annotations: READ,
    },
    async () => {
      try {
        const now = new Date();
        const d3 = new Date(now.getTime() - 3 * DAY);
        const d7 = new Date(now.getTime() - 7 * DAY);
        const d30 = new Date(now.getTime() - 30 * DAY);
        const in14 = new Date(now.getTime() + 14 * DAY);
        const [y, m] = tashkentDay(now).split('-').map(Number);

        const [
          activeGroups, graduatedGroups, activeStudents, ungroupedStudents, activeTeachers, staff,
          pending, pendingOld, submitted7, checked7, results30,
          overdueMilestones, upcomingMilestones, freezesThisMonth, newAppeals, activeExams,
          sessions7,
        ] = await Promise.all([
          prisma.group.count({ where: { isActive: true } }),
          prisma.group.count({ where: { graduatedAt: { not: null } } }),
          prisma.user.count({ where: { role: 'student', isActive: true } }),
          prisma.user.count({ where: { role: 'student', isActive: true, groupStudents: { none: {} } } }),
          prisma.user.count({ where: { role: 'teacher', isActive: true } }),
          prisma.user.groupBy({ by: ['role'], where: { isActive: true, role: { notIn: ['student'] } }, _count: true }),
          prisma.submission.count({ where: { status: 'pending' } }),
          prisma.submission.count({ where: { status: 'pending', submittedAt: { lt: d3 } } }),
          prisma.submission.count({ where: { submittedAt: { gte: d7 } } }),
          prisma.submission.count({ where: { checkedAt: { gte: d7 } } }),
          prisma.submission.groupBy({ by: ['result'], where: { checkedAt: { gte: d30 } }, _count: true }),
          prisma.groupMilestone.count({ where: { status: 'kechikdi' } }),
          prisma.groupMilestone.count({ where: { heldAt: null, dueDate: { gte: now, lte: in14 } } }),
          prisma.studentFreeze.count({ where: { month: m, year: y } }),
          prisma.parentAppeal.count({ where: { status: 'yangi' } }),
          prisma.exam.count({ where: { status: 'active' } }),
          prisma.lessonSession.groupBy({ by: ['status'], where: { date: { gte: d7 } }, _count: true }),
        ]);

        return ok({
          generatedAt: tashkentNow(),
          groups: { active: activeGroups, graduated: graduatedGroups },
          people: {
            activeStudents,
            studentsWithoutGroup: ungroupedStudents,
            activeTeachers,
            staffByRole: Object.fromEntries(staff.map((s) => [s.role, s._count])),
          },
          normativeSubmissions: {
            pendingReview: pending,
            pendingOlderThan3Days: pendingOld,
            submittedLast7Days: submitted7,
            checkedLast7Days: checked7,
            resultsLast30Days: Object.fromEntries(results30.map((r) => [r.result ?? 'none', r._count])),
          },
          milestones: { overdue: overdueMilestones, dueNext14Days: upcomingMilestones },
          lessonSessionsLast7Days: Object.fromEntries(sessions7.map((s) => [s.status, s._count])),
          freezesThisMonth,
          newParentAppeals: newAppeals,
          activeExams,
        });
      } catch (e) {
        return toolError(e, 'ils_overview');
      }
    }
  );

  // ── 2. Guruhlar ro'yxati ────────────────────────────────────────────────────
  server.registerTool(
    'ils_list_groups',
    {
      title: 'Guruhlar ro\'yxati',
      description:
        'Guruhlar: nomi, ustozi, faol o\'quvchilar soni, biriktirilgan normativlar, tekshirilmagan topshiriqlar, jadval (boshlanish, davomiylik, dars kunlari) va eng yaqin ochiq bosqich. Filtr: nom, ustoz, holat.',
      inputSchema: {
        search: z.string().trim().max(100).optional().describe('Guruh nomidan qidirish'),
        teacherId: uuid('Ustoz').optional(),
        status: z.enum(['active', 'graduated', 'all']).default('active').describe('active — faol, graduated — bitirgan'),
        limit: limitArg(50, 200),
        offset: offsetArg,
      },
      annotations: READ,
    },
    async (args) => {
      try {
        const where: Prisma.GroupWhereInput = {};
        if (args.status === 'active') where.isActive = true;
        if (args.status === 'graduated') where.graduatedAt = { not: null };
        if (args.teacherId) where.teacherId = args.teacherId;
        if (args.search) where.name = { contains: args.search, mode: 'insensitive' };

        const [total, groups] = await Promise.all([
          prisma.group.count({ where }),
          prisma.group.findMany({
            where,
            orderBy: [{ name: 'asc' }],
            skip: args.offset,
            take: args.limit,
            select: {
              id: true, name: true, isActive: true, createdAt: true, graduatedAt: true,
              startDate: true, durationMonths: true, lessonDayType: true,
              teacher: { select: { id: true, fullName: true } },
              _count: { select: { groupNormatives: true } },
              groupStudents: { where: { student: { isActive: true } }, select: { studentId: true } },
            },
          }),
        ]);
        const ids = groups.map((g) => g.id);

        // Tekshirilmaganlar — guruh ustozining navbati (shu yerda groupId mos)
        const [pendingByGroup, nextMilestones] = await Promise.all([
          ids.length
            ? prisma.submission.groupBy({ by: ['groupId'], where: { groupId: { in: ids }, status: 'pending' }, _count: true })
            : Promise.resolve([] as { groupId: string | null; _count: number }[]),
          ids.length
            ? prisma.groupMilestone.findMany({
                where: { groupId: { in: ids }, heldAt: null },
                orderBy: { dueDate: 'asc' },
                select: { groupId: true, type: true, seq: true, dueDate: true, plannedDate: true, status: true },
              })
            : Promise.resolve([]),
        ]);
        const pendingMap = new Map(pendingByGroup.map((p) => [p.groupId, p._count]));
        const nextMap = new Map<string, (typeof nextMilestones)[number]>();
        for (const ms of nextMilestones) if (!nextMap.has(ms.groupId)) nextMap.set(ms.groupId, ms);

        return ok({
          total,
          offset: args.offset,
          returned: groups.length,
          groups: groups.map((g) => {
            const nm = nextMap.get(g.id);
            return {
              id: g.id,
              name: g.name,
              isActive: g.isActive,
              graduatedAt: g.graduatedAt ? tashkentDay(g.graduatedAt) : null,
              teacher: g.teacher,
              activeStudents: g.groupStudents.length,
              assignedNormatives: g._count.groupNormatives,
              pendingSubmissions: pendingMap.get(g.id) ?? 0,
              schedule: {
                startDate: g.startDate ? tashkentDay(g.startDate) : null,
                durationMonths: g.durationMonths,
                lessonDays: g.lessonDayType,
              },
              nextMilestone: nm
                ? {
                    type: nm.type,
                    seq: nm.seq,
                    dueDate: tashkentDay(nm.dueDate),
                    plannedDate: nm.plannedDate ? tashkentDay(nm.plannedDate) : null,
                    status: nm.status,
                  }
                : null,
              createdAt: tashkentDay(g.createdAt),
            };
          }),
        });
      } catch (e) {
        return toolError(e, 'ils_list_groups');
      }
    }
  );

  // ── 3. Guruh hisoboti ───────────────────────────────────────────────────────
  server.registerTool(
    'ils_group_report',
    {
      title: 'Guruh hisoboti',
      description:
        'Bitta guruh bo\'yicha to\'liq hisobot: har o\'quvchining normativ natijalari (yashil/ko\'k/qizil/kutilmoqda/topshirmagan, ball, bajarish %), so\'nggi N kundagi darslar va davomat/baholar, bosqichlar (demo day, imtihon) va imtihon natijalari. O\'zlashtirish, xavf ostidagi o\'quvchilar va ustoz ishini tahlil qilish uchun.',
      inputSchema: {
        groupId: uuid('Guruh'),
        days: z.number().int().min(7).max(365).default(30).describe('Darslar va baholar uchun oxirgi necha kun'),
      },
      annotations: READ,
    },
    async ({ groupId, days }) => {
      try {
        const group = await prisma.group.findUnique({
          where: { id: groupId },
          select: {
            id: true, name: true, isActive: true, createdAt: true, graduatedAt: true,
            startDate: true, durationMonths: true, lessonDayType: true, telegramChatTitle: true,
            teacher: { select: { id: true, fullName: true } },
          },
        });
        if (!group) return fail('Guruh topilmadi');

        const since = new Date(Date.now() - days * DAY);
        const [stats, sessions, milestones, exams] = await Promise.all([
          groupStudentStats(groupId),
          prisma.lessonSession.findMany({
            where: { groupId, date: { gte: since } },
            orderBy: { date: 'desc' },
            select: {
              id: true, date: true, status: true, topic: true,
              teacher: { select: { fullName: true } },
              grades: { select: { studentId: true, homework: true, homeworkScore: true, activityScore: true } },
            },
          }),
          prisma.groupMilestone.findMany({
            where: { groupId },
            orderBy: [{ type: 'asc' }, { seq: 'asc' }],
            select: { id: true, type: true, seq: true, dueDate: true, plannedDate: true, heldAt: true, status: true },
          }),
          prisma.examParticipant.findMany({
            where: { groupId },
            orderBy: { createdAt: 'desc' },
            take: 300,
            select: {
              studentId: true, status: true, totalScore: true, testScore: true, aiScore: true, projectScore: true,
              exam: { select: { id: true, title: true, startsAt: true } },
            },
          }),
        ]);

        // Har o'quvchi: davomat va o'rtacha baholar (oxirgi `days` kun)
        const attendance = new Map<string, { lessons: number; absent: number; hwSum: number; hwN: number; actSum: number; actN: number }>();
        for (const s of sessions) {
          for (const g of s.grades) {
            const a = attendance.get(g.studentId) ?? { lessons: 0, absent: 0, hwSum: 0, hwN: 0, actSum: 0, actN: 0 };
            a.lessons++;
            if (g.homework === 'kelmadi') a.absent++;
            if (g.homeworkScore != null) { a.hwSum += g.homeworkScore; a.hwN++; }
            if (g.activityScore != null) { a.actSum += g.activityScore; a.actN++; }
            attendance.set(g.studentId, a);
          }
        }
        const avg = (sum: number, n: number) => (n ? Math.round((sum / n) * 10) / 10 : null);

        const examMap = new Map<string, { title: string; date: string; participants: number; submitted: number; scores: number[] }>();
        for (const p of exams) {
          const e = examMap.get(p.exam.id) ?? {
            title: p.exam.title, date: tashkentDay(p.exam.startsAt), participants: 0, submitted: 0, scores: [],
          };
          e.participants++;
          if (p.status === 'submitted') e.submitted++;
          if (p.totalScore != null) e.scores.push(p.totalScore);
          examMap.set(p.exam.id, e);
        }

        return ok({
          group: {
            ...group,
            createdAt: tashkentDay(group.createdAt),
            graduatedAt: group.graduatedAt ? tashkentDay(group.graduatedAt) : null,
            startDate: group.startDate ? tashkentDay(group.startDate) : null,
          },
          assignedNormatives: stats.assignedNormatives,
          students: stats.students.map((s) => {
            const a = attendance.get(s.id);
            return {
              ...s,
              lessons: a
                ? {
                    graded: a.lessons,
                    absent: a.absent,
                    attendancePct: pct(a.lessons - a.absent, a.lessons),
                    avgHomeworkScore: avg(a.hwSum, a.hwN),
                    avgActivityScore: avg(a.actSum, a.actN),
                  }
                : null,
            };
          }),
          lessonSessions: {
            periodDays: days,
            count: sessions.length,
            byStatus: sessions.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }), {}),
            recent: sessions.slice(0, 15).map((s) => ({
              date: tashkentDay(s.date), status: s.status, topic: s.topic, teacher: s.teacher?.fullName ?? null,
              graded: s.grades.length,
            })),
          },
          milestones: milestones.map((m) => ({
            id: m.id, type: m.type, seq: m.seq, status: m.status,
            dueDate: tashkentDay(m.dueDate),
            plannedDate: m.plannedDate ? tashkentDay(m.plannedDate) : null,
            heldAt: m.heldAt ? tashkentDay(m.heldAt) : null,
          })),
          exams: [...examMap.entries()].map(([id, e]) => ({
            id, title: e.title, date: e.date, participants: e.participants, submitted: e.submitted,
            avgTotalScore: e.scores.length ? Math.round((e.scores.reduce((x, y) => x + y, 0) / e.scores.length) * 10) / 10 : null,
          })),
          note: 'Imtihon natijalari participant.groupId bo\'yicha (imtihon paytidagi guruh).',
        });
      } catch (e) {
        return toolError(e, 'ils_group_report');
      }
    }
  );

  // ── 4. Foydalanuvchilarni qidirish ──────────────────────────────────────────
  server.registerTool(
    'ils_find_users',
    {
      title: 'Foydalanuvchilarni qidirish',
      description:
        'O\'quvchi, ustoz va xodimlarni ism yoki login bo\'yicha qidiradi. Rol va faollik bo\'yicha filtr. O\'quvchilar uchun guruhlari, ustozlar uchun guruhlari soni qaytadi. Boshqa amallarga kerak bo\'ladigan ID shu yerdan olinadi.',
      inputSchema: {
        search: z.string().trim().max(100).optional().describe('Ism-familiya yoki login bo\'lagi'),
        role: z.enum(ROLES).optional(),
        isActive: z.boolean().optional().describe('Berilmasa — hammasi'),
        withoutGroup: z.boolean().optional().describe('true — faqat hech qaysi guruhda bo\'lmagan o\'quvchilar'),
        limit: limitArg(30, 200),
        offset: offsetArg,
      },
      annotations: READ,
    },
    async (args) => {
      try {
        const where: Prisma.UserWhereInput = {};
        if (args.role) where.role = args.role;
        if (args.isActive !== undefined) where.isActive = args.isActive;
        if (args.withoutGroup) where.groupStudents = { none: {} };
        if (args.search) {
          where.OR = [
            { fullName: { contains: args.search, mode: 'insensitive' } },
            { login: { contains: args.search, mode: 'insensitive' } },
          ];
        }
        const [total, users] = await Promise.all([
          prisma.user.count({ where }),
          prisma.user.findMany({
            where,
            orderBy: { fullName: 'asc' },
            skip: args.offset,
            take: args.limit,
            select: {
              id: true, fullName: true, login: true, role: true, isActive: true, filial: true, createdAt: true,
              groupStudents: { select: { group: { select: { id: true, name: true, isActive: true } } } },
              _count: { select: { teacherGroups: true } },
            },
          }),
        ]);
        return ok({
          total,
          offset: args.offset,
          returned: users.length,
          users: users.map((u) => ({
            id: u.id, fullName: u.fullName, login: u.login, role: u.role, isActive: u.isActive,
            filial: u.filial, createdAt: tashkentDay(u.createdAt),
            groups: u.role === 'student' ? u.groupStudents.map((g) => g.group) : undefined,
            teacherGroupCount: u.role !== 'student' ? u._count.teacherGroups : undefined,
          })),
        });
      } catch (e) {
        return toolError(e, 'ils_find_users');
      }
    }
  );

  // ── 5. O'quvchi hisoboti ────────────────────────────────────────────────────
  server.registerTool(
    'ils_student_report',
    {
      title: 'O\'quvchi hisoboti',
      description:
        'Bitta o\'quvchi bo\'yicha hamma narsa: guruhlari, har normativ natijasi (holat, rang, ball, kim/qachon tekshirgan), oxirgi N kundagi dars baholari va davomati, imtihonlar, coin balansi, muzlatishlar, ota-ona murojaatlari soni va reyting.',
      inputSchema: {
        studentId: uuid('O\'quvchi'),
        days: z.number().int().min(7).max(365).default(60).describe('Dars baholari uchun oxirgi necha kun'),
      },
      annotations: READ,
    },
    async ({ studentId, days }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: studentId },
          select: {
            id: true, fullName: true, login: true, role: true, isActive: true, filial: true, createdAt: true,
            groupStudents: {
              select: { joinedAt: true, group: { select: { id: true, name: true, isActive: true, teacher: { select: { fullName: true } } } } },
            },
          },
        });
        if (!user) return fail('Foydalanuvchi topilmadi');

        const since = new Date(Date.now() - days * DAY);
        const [subs, grades, exams, coins, freezes, appeals, ranking] = await Promise.all([
          prisma.submission.findMany({
            where: { studentId },
            orderBy: { submittedAt: 'desc' },
            select: {
              status: true, result: true, score: true, submittedAt: true, checkedAt: true, comment: true, canResubmit: true,
              normative: { select: { taskNumber: true, title: true, maxScore: true } },
              checkedBy: { select: { fullName: true } },
            },
          }),
          prisma.lessonGrade.findMany({
            where: { studentId, session: { date: { gte: since } } },
            orderBy: { session: { date: 'desc' } },
            select: {
              homework: true, homeworkScore: true, activityScore: true, comment: true,
              session: { select: { date: true, topic: true, group: { select: { name: true } } } },
            },
          }),
          prisma.examParticipant.findMany({
            where: { studentId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              status: true, attemptNumber: true, testScore: true, aiScore: true, projectScore: true, totalScore: true, submittedAt: true,
              exam: { select: { title: true, startsAt: true } },
            },
          }),
          prisma.coinTransaction.aggregate({ where: { studentId }, _sum: { amount: true } }),
          prisma.studentFreeze.findMany({
            where: { studentId },
            orderBy: { frozenAt: 'desc' },
            select: { month: true, year: true, reason: true, detailedNote: true, frozenAt: true },
          }),
          prisma.parentAppeal.groupBy({ by: ['status'], where: { studentId }, _count: true }),
          prisma.rankingCache.findMany({
            where: { studentId },
            select: { totalScore: true, completed: true, pending: true, rankInGroup: true, rankOverall: true, groupId: true },
          }),
        ]);

        const counted = grades.length;
        const absent = grades.filter((g) => g.homework === 'kelmadi').length;
        return ok({
          student: {
            ...user,
            createdAt: tashkentDay(user.createdAt),
            groupStudents: undefined,
            groups: user.groupStudents.map((g) => ({ ...g.group, teacher: g.group.teacher?.fullName ?? null, joinedAt: tashkentDay(g.joinedAt) })),
          },
          normatives: {
            total: subs.length,
            green: subs.filter((s) => s.result === 'green').length,
            blue: subs.filter((s) => s.result === 'blue').length,
            red: subs.filter((s) => s.result === 'red').length,
            pending: subs.filter((s) => s.status === 'pending').length,
            totalScore: subs.reduce((a, s) => a + s.score, 0),
            items: subs.map((s) => ({
              task: s.normative.taskNumber, title: s.normative.title, status: s.status, result: s.result,
              score: s.score, maxScore: s.normative.maxScore, submittedAt: tashkentDay(s.submittedAt),
              checkedAt: s.checkedAt ? tashkentDay(s.checkedAt) : null, checkedBy: s.checkedBy?.fullName ?? null,
              comment: s.comment, canResubmit: s.canResubmit,
            })),
          },
          lessons: {
            periodDays: days,
            graded: counted,
            absent,
            attendancePct: pct(counted - absent, counted),
            items: grades.slice(0, 40).map((g) => ({
              date: tashkentDay(g.session.date), group: g.session.group.name, topic: g.session.topic,
              homework: g.homework, homeworkScore: g.homeworkScore, activityScore: g.activityScore, comment: g.comment,
            })),
          },
          exams: exams.map((e) => ({ ...e, exam: e.exam.title, examDate: tashkentDay(e.exam.startsAt), submittedAt: e.submittedAt ? tashkentDay(e.submittedAt) : null })),
          coinBalance: coins._sum.amount ?? 0,
          freezes: freezes.map((f) => ({ ...f, frozenAt: tashkentDay(f.frozenAt) })),
          parentAppealsByStatus: Object.fromEntries(appeals.map((a) => [a.status, a._count])),
          ranking,
        });
      } catch (e) {
        return toolError(e, 'ils_student_report');
      }
    }
  );

  // ── 6. Ustoz hisoboti ───────────────────────────────────────────────────────
  server.registerTool(
    'ils_teacher_report',
    {
      title: 'Ustoz hisoboti',
      description:
        'Ustoz ish samaradorligi: guruhlari va o\'quvchilar soni, uning guruhlaridagi tekshirilmagan normativlar (eng eski kutish vaqti), davr ichida tekshirganlari va o\'rtacha tekshirish tezligi (soat), o\'tkazgan darslari holati, kechikkan bosqichlar, o\'quvchilar fikri (o\'rtacha reyting).',
      inputSchema: {
        teacherId: uuid('Ustoz'),
        days: z.number().int().min(7).max(365).default(30),
      },
      annotations: READ,
    },
    async ({ teacherId, days }) => {
      try {
        const teacher = await prisma.user.findUnique({
          where: { id: teacherId },
          select: { id: true, fullName: true, role: true, isActive: true, filial: true },
        });
        if (!teacher) return fail('Foydalanuvchi topilmadi');
        const since = new Date(Date.now() - days * DAY);

        const groups = await prisma.group.findMany({
          where: { teacherId, isActive: true },
          select: { id: true, name: true, groupStudents: { where: { student: { isActive: true } }, select: { studentId: true } } },
          orderBy: { name: 'asc' },
        });
        const groupIds = groups.map((g) => g.id);

        const [pending, oldestPending, checked, sessions, overdue, feedback] = await Promise.all([
          prisma.submission.count({ where: { status: 'pending', group: { teacherId } } }),
          prisma.submission.findFirst({
            where: { status: 'pending', group: { teacherId } },
            orderBy: { submittedAt: 'asc' },
            select: { submittedAt: true },
          }),
          prisma.submission.findMany({
            where: { checkedById: teacherId, checkedAt: { gte: since } },
            select: { submittedAt: true, checkedAt: true, result: true },
          }),
          prisma.lessonSession.groupBy({ by: ['status'], where: { teacherId, date: { gte: since } }, _count: true }),
          groupIds.length
            ? prisma.groupMilestone.count({ where: { groupId: { in: groupIds }, status: 'kechikdi' } })
            : Promise.resolve(0),
          prisma.studentFeedback.aggregate({ where: { teacherId, createdAt: { gte: since } }, _avg: { rating: true }, _count: true }),
        ]);

        const delays = checked
          .filter((c) => c.checkedAt)
          .map((c) => (c.checkedAt!.getTime() - c.submittedAt.getTime()) / 3_600_000)
          .sort((a, b) => a - b);
        const median = delays.length ? delays[Math.floor(delays.length / 2)] : null;

        return ok({
          teacher,
          periodDays: days,
          groups: groups.map((g) => ({ id: g.id, name: g.name, activeStudents: g.groupStudents.length })),
          totalActiveStudents: groups.reduce((a, g) => a + g.groupStudents.length, 0),
          review: {
            pendingInMyGroups: pending,
            oldestPendingSince: oldestPending ? tashkentDay(oldestPending.submittedAt) : null,
            checkedInPeriod: checked.length,
            results: checked.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.result ?? 'none']: (acc[c.result ?? 'none'] ?? 0) + 1 }), {}),
            avgCheckHours: delays.length ? Math.round((delays.reduce((a, b) => a + b, 0) / delays.length) * 10) / 10 : null,
            medianCheckHours: median != null ? Math.round(median * 10) / 10 : null,
          },
          lessonSessionsByStatus: Object.fromEntries(sessions.map((s) => [s.status, s._count])),
          overdueMilestonesInMyGroups: overdue,
          studentFeedback: {
            count: feedback._count,
            avgRating: feedback._avg.rating != null ? Math.round(feedback._avg.rating * 100) / 100 : null,
          },
        });
      } catch (e) {
        return toolError(e, 'ils_teacher_report');
      }
    }
  );

  // ── 7. Normativlar ──────────────────────────────────────────────────────────
  server.registerTool(
    'ils_list_normatives',
    {
      title: 'Normativlar va ularning statistikasi',
      description:
        'Normativlar (amaliy topshiriqlar) ro\'yxati: raqami, nomi, vaqt chegarasi (daq), maks ball, kategoriya, nechta guruhga biriktirilgan va natijalar taqsimoti (yashil/ko\'k/qizil/kutilmoqda, o\'rtacha ball). Qiyin yoki ishlamayotgan normativlarni topish uchun.',
      inputSchema: {
        search: z.string().trim().max(100).optional(),
        isActive: z.boolean().optional(),
        categoryId: uuid('Kategoriya').optional(),
        limit: limitArg(100, 300),
        offset: offsetArg,
      },
      annotations: READ,
    },
    async (args) => {
      try {
        const where: Prisma.NormativeWhereInput = {};
        if (args.isActive !== undefined) where.isActive = args.isActive;
        if (args.categoryId) where.categoryId = args.categoryId;
        if (args.search) where.title = { contains: args.search, mode: 'insensitive' };

        const [total, items] = await Promise.all([
          prisma.normative.count({ where }),
          prisma.normative.findMany({
            where,
            orderBy: { taskNumber: 'asc' },
            skip: args.offset,
            take: args.limit,
            select: {
              id: true, taskNumber: true, title: true, timeLimit: true, maxScore: true, isActive: true, url: true,
              category: { select: { id: true, name: true } },
              _count: { select: { groupNormatives: true } },
            },
          }),
        ]);
        const ids = items.map((n) => n.id);
        const dist = ids.length
          ? await prisma.submission.groupBy({
              by: ['normativeId', 'status', 'result'],
              where: { normativeId: { in: ids } },
              _count: true,
              _avg: { score: true },
            })
          : [];
        const statMap = new Map<string, Record<string, number>>();
        for (const d of dist) {
          const st = statMap.get(d.normativeId) ?? {};
          const k = d.status === 'pending' ? 'pending' : d.result ?? 'checked';
          st[k] = (st[k] ?? 0) + d._count;
          statMap.set(d.normativeId, st);
        }
        return ok({
          total,
          offset: args.offset,
          returned: items.length,
          normatives: items.map((n) => {
            const st = statMap.get(n.id) ?? {};
            const checked = (st.green ?? 0) + (st.blue ?? 0) + (st.red ?? 0);
            return {
              id: n.id, taskNumber: n.taskNumber, title: n.title, timeLimitMin: n.timeLimit, maxScore: n.maxScore,
              isActive: n.isActive, category: n.category, assignedGroups: n._count.groupNormatives,
              submissions: { ...st, greenPct: pct(st.green ?? 0, checked) },
            };
          }),
        });
      } catch (e) {
        return toolError(e, 'ils_list_normatives');
      }
    }
  );

  // ── 8. Topshiriqlar ─────────────────────────────────────────────────────────
  server.registerTool(
    'ils_list_submissions',
    {
      title: 'Normativ topshiriqlari',
      description:
        'Topshirilgan normativlar (video havolalari) ro\'yxati, filtrlar bilan: holat, natija rangi, guruh, normativ, o\'quvchi, sana oralig\'i. Tekshirish navbatini va natijalarni ko\'rish uchun.',
      inputSchema: {
        status: z.enum(['pending', 'checked']).optional(),
        result: z.enum(['green', 'blue', 'red']).optional(),
        groupId: uuid('Guruh').optional(),
        normativeId: uuid('Normativ').optional(),
        studentId: uuid('O\'quvchi').optional(),
        from: z.string().optional().describe('Topshirilgan sana dan (YYYY-MM-DD, Toshkent)'),
        to: z.string().optional().describe('Topshirilgan sana gacha (YYYY-MM-DD, shu kun ham kiradi)'),
        limit: limitArg(50, 200),
        offset: offsetArg,
      },
      annotations: READ,
    },
    async (args) => {
      try {
        const where: Prisma.SubmissionWhereInput = {};
        if (args.status) where.status = args.status;
        if (args.result) where.result = args.result;
        if (args.groupId) where.groupId = args.groupId;
        if (args.normativeId) where.normativeId = args.normativeId;
        if (args.studentId) where.studentId = args.studentId;
        const from = parseDay(args.from, 'from');
        const to = parseDay(args.to, 'to');
        if (from || to) where.submittedAt = { ...(from && { gte: from }), ...(to && { lt: new Date(to.getTime() + DAY) }) };

        const [total, items] = await Promise.all([
          prisma.submission.count({ where }),
          prisma.submission.findMany({
            where,
            orderBy: { submittedAt: 'desc' },
            skip: args.offset,
            take: args.limit,
            select: {
              id: true, status: true, result: true, score: true, youtubeUrl: true, comment: true,
              submittedAt: true, checkedAt: true, canResubmit: true,
              student: { select: { id: true, fullName: true } },
              normative: { select: { id: true, taskNumber: true, title: true } },
              group: { select: { id: true, name: true } },
              checkedBy: { select: { fullName: true } },
            },
          }),
        ]);
        return ok({
          total,
          offset: args.offset,
          returned: items.length,
          submissions: items.map((s) => ({
            ...s,
            submittedAt: s.submittedAt.toISOString(),
            checkedAt: s.checkedAt?.toISOString() ?? null,
            checkedBy: s.checkedBy?.fullName ?? null,
          })),
        });
      } catch (e) {
        return e instanceof McpUserError ? fail(e.message) : toolError(e, 'ils_list_submissions');
      }
    }
  );

  // ── 9. Bosqichlar ───────────────────────────────────────────────────────────
  server.registerTool(
    'ils_milestones',
    {
      title: 'Demo day va imtihon bosqichlari',
      description:
        'Guruhlar bo\'yicha demo day / imtihon bosqichlari: kechikkanlar, yaqin N kunda muddati keladiganlar yoki hammasi. Har biri guruh, ustoz, muddat, rejalashtirilgan sana va holat bilan.',
      inputSchema: {
        view: z.enum(['overdue', 'upcoming', 'all_open', 'all']).default('overdue'),
        days: z.number().int().min(1).max(180).default(14).describe('upcoming uchun: necha kun oldinga'),
        groupId: uuid('Guruh').optional(),
        limit: limitArg(100, 300),
      },
      annotations: READ,
    },
    async ({ view, days, groupId, limit }) => {
      try {
        const now = new Date();
        const where: Prisma.GroupMilestoneWhereInput = { ...(groupId && { groupId }) };
        if (view === 'overdue') where.status = 'kechikdi';
        if (view === 'upcoming') Object.assign(where, { heldAt: null, dueDate: { gte: now, lte: new Date(now.getTime() + days * DAY) } });
        if (view === 'all_open') where.heldAt = null;
        const items = await prisma.groupMilestone.findMany({
          where,
          orderBy: { dueDate: 'asc' },
          take: limit,
          select: {
            id: true, type: true, seq: true, dueDate: true, plannedDate: true, heldAt: true, status: true,
            group: { select: { id: true, name: true, teacher: { select: { id: true, fullName: true } } } },
          },
        });
        return ok({
          view,
          returned: items.length,
          milestones: items.map((m) => ({
            id: m.id, type: m.type, seq: m.seq, status: m.status,
            dueDate: tashkentDay(m.dueDate),
            plannedDate: m.plannedDate ? tashkentDay(m.plannedDate) : null,
            heldAt: m.heldAt ? tashkentDay(m.heldAt) : null,
            daysLate: m.status === 'kechikdi' ? Math.floor((now.getTime() - m.dueDate.getTime()) / DAY) : null,
            group: { id: m.group.id, name: m.group.name },
            teacher: m.group.teacher,
          })),
        });
      } catch (e) {
        return toolError(e, 'ils_milestones');
      }
    }
  );

  // ── 10. Imtihonlar ──────────────────────────────────────────────────────────
  server.registerTool(
    'ils_exams',
    {
      title: 'Imtihonlar',
      description:
        'Imtihonlar ro\'yxati: nomi, holati, vaqti, markaz (global) yoki guruh imtihoni, yaratgan, qatnashchilar, topshirganlar va o\'rtacha ball (test/AI/loyiha/jami).',
      inputSchema: {
        status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
        search: z.string().trim().max(100).optional(),
        limit: limitArg(30, 100),
        offset: offsetArg,
      },
      annotations: READ,
    },
    async (args) => {
      try {
        const where: Prisma.ExamWhereInput = {};
        if (args.status) where.status = args.status;
        if (args.search) where.title = { contains: args.search, mode: 'insensitive' };
        const [total, exams] = await Promise.all([
          prisma.exam.count({ where }),
          prisma.exam.findMany({
            where,
            orderBy: { startsAt: 'desc' },
            skip: args.offset,
            take: args.limit,
            select: {
              id: true, title: true, status: true, startsAt: true, expiresAt: true, isGlobal: true, testCount: true,
              maxTestScore: true, maxAiScore: true, maxProjectScore: true,
              createdBy: { select: { fullName: true } },
              examGroups: { select: { group: { select: { name: true } } } },
            },
          }),
        ]);
        const ids = exams.map((e) => e.id);
        const agg = ids.length
          ? await prisma.examParticipant.groupBy({
              by: ['examId', 'status'],
              where: { examId: { in: ids } },
              _count: true,
              _avg: { totalScore: true, testScore: true, aiScore: true, projectScore: true },
            })
          : [];
        const r1 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10);
        return ok({
          total,
          offset: args.offset,
          returned: exams.length,
          exams: exams.map((e) => {
            const rows = agg.filter((a) => a.examId === e.id);
            const sub = rows.find((r) => r.status === 'submitted');
            return {
              id: e.id, title: e.title, status: e.status, isGlobal: e.isGlobal,
              startsAt: e.startsAt.toISOString(), expiresAt: e.expiresAt.toISOString(),
              createdBy: e.createdBy?.fullName ?? null,
              groups: e.examGroups.map((g) => g.group.name),
              max: { test: e.maxTestScore, ai: e.maxAiScore, project: e.maxProjectScore },
              participants: rows.reduce((a, r) => a + r._count, 0),
              byStatus: Object.fromEntries(rows.map((r) => [r.status, r._count])),
              avgOfSubmitted: sub
                ? { total: r1(sub._avg.totalScore), test: r1(sub._avg.testScore), ai: r1(sub._avg.aiScore), project: r1(sub._avg.projectScore) }
                : null,
            };
          }),
        });
      } catch (e) {
        return toolError(e, 'ils_exams');
      }
    }
  );

  // ── 11. Audit jurnali ───────────────────────────────────────────────────────
  server.registerTool(
    'ils_audit_log',
    {
      title: 'Audit jurnali',
      description:
        'Kim, qachon, nima qilgani (guruh yaratish, o\'quvchi o\'tkazish, normativ o\'zgartirish, MCP orqali qilingan amallar — "mcp." bilan boshlanadi va h.k.). Filtr: amal nomi bo\'lagi, foydalanuvchi, sana.',
      inputSchema: {
        action: z.string().trim().max(100).optional().describe('Amal nomidan bo\'lak, masalan "group" yoki "mcp."'),
        userId: uuid('Bajargan foydalanuvchi').optional(),
        from: z.string().optional().describe('YYYY-MM-DD'),
        limit: limitArg(50, 200),
        offset: offsetArg,
      },
      annotations: READ,
    },
    async (args) => {
      try {
        const where: Prisma.AuditLogWhereInput = {};
        if (args.action) where.action = { contains: args.action, mode: 'insensitive' };
        if (args.userId) where.userId = args.userId;
        const from = parseDay(args.from, 'from');
        if (from) where.createdAt = { gte: from };
        const [total, logs] = await Promise.all([
          prisma.auditLog.count({ where }),
          prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: args.offset,
            take: args.limit,
            select: {
              action: true, targetType: true, targetId: true, details: true, createdAt: true,
              user: { select: { id: true, fullName: true, role: true } },
            },
          }),
        ]);
        return ok({ total, offset: args.offset, returned: logs.length, logs: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })) });
      } catch (e) {
        return e instanceof McpUserError ? fail(e.message) : toolError(e, 'ils_audit_log');
      }
    }
  );
}
