/**
 * MCP boshqaruv amallari — 2-to'plam (`ils:write`).
 *
 * write.ts dagi kabi: har amal panel SERVISINI chaqiradi (biznes qoidalari,
 * bildirishnomalar, ichki audit bir xil), ustidan "mcp.<amal>" audit.
 *
 * Imtiyoz oshirishga qarshi qoida (hamma amallarda): MCP orqali admin
 * akkauntini yaratib, o'zgartirib, parolini tiklab yoki kimnidir admin
 * qilib bo'lmaydi — bu faqat panelda, inson qo'li bilan.
 */
import crypto from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import prisma from '../../config/database';
import groupsService from '../../modules/groups/groups.service';
import usersService from '../../modules/users/users.service';
import submissionsService from '../../modules/submissions/submissions.service';
import permissionsService from '../../modules/permissions/permissions.service';
import freezesService from '../../modules/freezes/freezes.service';
import appealsService from '../../modules/appeals/appeals.service';
import lessonSessionsService from '../../modules/lesson-sessions/lesson-sessions.service';
import shopService from '../../modules/shop/shop.service';
import trashService from '../../modules/trash/trash.service';
import milestonesService from '../../modules/milestones/milestones.service';
import { safeSendToParent } from '../../modules/bot/bot.notifications';
import { createUserSchema, updateUserSchema } from '../../modules/users/users.validation';
import { PERMISSIONS } from '../../shared/constants/permissions';
import { FILIAL_KEYS, isValidFilial } from '../../shared/constants/filials';
import { emitToUser } from '../../shared/utils/socket';
import { McpActor, McpUserError } from '../context';
import { guarded, SAFE_WRITE, DESTRUCTIVE, CONFIRM_NOTE } from './write';

const uuid = (what: string) => z.string().uuid().describe(`${what} ID (UUID)`);
const NON_ADMIN_ROLES = [
  'teacher', 'student', 'filial_rahbari', 'assistant', 'moliya_rahbari', 'kassir',
  'administrator', 'nazoratchi', 'hr_rahbari', 'sotuv_operatori', 'farrosh',
  'robototexnika_ustoz', 'call_operatori',
] as const;
const FREEZE_REASONS = [
  'moliyaviy', 'kochib_ketish', 'vaqtincha_toxtatgan', 'kasallik', 'kanikul', 'boshqa_fan', 'kurs_tugadi',
  'motivatsiya', 'ish_tadbir', 'universitet', 'shaxsiy', 'oqituvchidan_norozi', 'boshqa', 'sabab_korsatilmagan',
] as const;

/** O'qish oson, adashtiradigan belgilarsiz (0/O, 1/l/I yo'q) vaqtinchalik parol */
function tempPassword(len = 10) {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

async function assertNotAdminTarget(userId: string, actor: McpActor) {
  if (userId === actor.userId) throw new McpUserError('O\'z akkauntingizni MCP orqali o\'zgartirib bo\'lmaydi');
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!u) throw new McpUserError('Foydalanuvchi topilmadi');
  if (u.role === 'admin') throw new McpUserError('Administrator akkauntini MCP orqali o\'zgartirib bo\'lmaydi — panelda qiling');
  return u;
}

export function registerManageTools(server: McpServer, actor: McpActor) {
  // ── Normativ tekshirish ─────────────────────────────────────────────────────
  server.registerTool(
    'ils_check_submission',
    {
      title: 'Normativni baholash',
      description:
        'Topshirilgan normativni baholaydi yoki bahoni tuzatadi (yashil/ko\'k/qizil; ball maks ballga qarab avtomatik). O\'quvchiga bildirishnoma va OTA-ONAGA Telegram xabari ketadi.' + CONFIRM_NOTE,
      inputSchema: {
        submissionId: uuid('Topshiriq'),
        result: z.enum(['green', 'blue', 'red']),
        comment: z.string().max(1000).optional(),
      },
      annotations: { ...SAFE_WRITE, openWorldHint: true },
    },
    async ({ submissionId, result, comment }) =>
      guarded(actor, 'check_submission', { submissionId, result, comment }, { type: 'submission', id: submissionId }, async () => {
        const s = await submissionsService.check(submissionId, actor.userId!, { result, comment } as any);
        return { checked: true, submission: { id: s.id, student: s.student?.fullName, result: s.result, score: s.score } };
      })
  );

  server.registerTool(
    'ils_allow_resubmit',
    {
      title: 'Qayta topshirishga ruxsat',
      description: 'Ko\'k yoki qizil olgan normativni o\'quvchi qayta topshira oladigan qiladi.' + CONFIRM_NOTE,
      inputSchema: { submissionId: uuid('Topshiriq') },
      annotations: SAFE_WRITE,
    },
    async ({ submissionId }) =>
      guarded(actor, 'allow_resubmit', { submissionId }, { type: 'submission', id: submissionId }, async () => {
        await submissionsService.allowResubmit(submissionId, actor.userId!);
        return { done: true, submissionId };
      })
  );

  // ── Foydalanuvchilar ────────────────────────────────────────────────────────
  server.registerTool(
    'ils_create_user',
    {
      title: 'Foydalanuvchi yaratish',
      description:
        'O\'quvchi, ustoz yoki xodim akkauntini yaratadi (admin emas). Rolning standart ruxsatlari avtomatik beriladi. Parol berilmasa vaqtinchalik parol yaratiladi va BIR MARTA qaytariladi — foydalanuvchiga yetkazing va kirgach almashtirishni ayting. groupId berilsa o\'quvchi guruhga ham qo\'shiladi.' + CONFIRM_NOTE,
      inputSchema: {
        fullName: z.string().min(2).max(100),
        login: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.]+$/, 'Faqat harf, raqam, nuqta, _'),
        role: z.enum(NON_ADMIN_ROLES),
        password: z.string().min(6).max(100).optional().describe('Berilmasa — avtomatik vaqtinchalik parol'),
        groupId: uuid('Guruh (faqat o\'quvchi uchun)').optional(),
      },
      annotations: SAFE_WRITE,
    },
    async ({ password, groupId, ...rest }) =>
      guarded(actor, 'create_user', { ...rest, groupId, password: password ? '[berildi]' : '[avtomatik]' }, { type: 'user' }, async () => {
        if (groupId && rest.role !== 'student') throw new McpUserError('groupId faqat o\'quvchi uchun');
        const pwd = password ?? tempPassword();
        const user = await usersService.create(createUserSchema.parse({ ...rest, password: pwd }), actor.userId!);
        let group: string | null = null;
        if (groupId) {
          await groupsService.addStudent(groupId, user.id, actor.userId!);
          group = groupId;
        }
        return {
          created: true,
          user: { id: user.id, fullName: user.fullName, login: user.login, role: user.role },
          addedToGroup: group,
          temporaryPassword: password ? undefined : pwd,
          note: password ? undefined : 'Vaqtinchalik parol faqat shu javobda ko\'rinadi.',
        };
      })
  );

  server.registerTool(
    'ils_update_user',
    {
      title: 'Foydalanuvchini tahrirlash',
      description:
        'Ism, login, rol (admin emas) yoki filialni o\'zgartiradi. Rol o\'zgarsa yangi rolning standart ruxsatlari qo\'shiladi. Administratorlarga qo\'llanmaydi.' + CONFIRM_NOTE,
      inputSchema: {
        userId: uuid('Foydalanuvchi'),
        fullName: z.string().min(2).max(100).optional(),
        login: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.]+$/).optional(),
        role: z.enum(NON_ADMIN_ROLES).optional(),
        filial: z.string().max(50).nullable().optional().describe(`Filial kaliti: ${FILIAL_KEYS.join(', ')} yoki null`),
      },
      annotations: SAFE_WRITE,
    },
    async ({ userId, filial, ...rest }) =>
      guarded(actor, 'update_user', { userId, filial, ...rest }, { type: 'user', id: userId }, async () => {
        await assertNotAdminTarget(userId, actor);
        if (Object.keys(rest).length === 0 && filial === undefined) throw new McpUserError('O\'zgartiriladigan maydon berilmadi');
        if (filial !== undefined && filial !== null && !isValidFilial(filial)) {
          throw new McpUserError(`Noma'lum filial. Mumkin: ${FILIAL_KEYS.join(', ')}`);
        }
        let user: any = null;
        if (Object.keys(rest).length) user = await usersService.update(userId, updateUserSchema.parse(rest), actor.userId!);
        if (filial !== undefined) {
          user = await prisma.user.update({
            where: { id: userId },
            data: { filial },
            select: { id: true, fullName: true, login: true, role: true, filial: true },
          });
        }
        return { updated: true, user: { id: user.id, fullName: user.fullName, login: user.login, role: user.role, filial: user.filial } };
      })
  );

  server.registerTool(
    'ils_reset_password',
    {
      title: 'Parolni tiklash',
      description:
        'Foydalanuvchiga yangi vaqtinchalik parol beradi (admin emas). Uning barcha ochiq sessiyalari tugaydi. Parol BIR MARTA qaytariladi.' + CONFIRM_NOTE,
      inputSchema: { userId: uuid('Foydalanuvchi') },
      annotations: DESTRUCTIVE,
    },
    async ({ userId }) =>
      guarded(actor, 'reset_password', { userId }, { type: 'user', id: userId }, async () => {
        await assertNotAdminTarget(userId, actor);
        const pwd = tempPassword();
        const u = await usersService.update(userId, { password: pwd }, actor.userId!);
        return { done: true, user: { id: u.id, fullName: u.fullName, login: u.login }, temporaryPassword: pwd };
      })
  );

  server.registerTool(
    'ils_set_permissions',
    {
      title: 'Xodim ruxsatlarini belgilash',
      description:
        `Xodimning (admin va o'quvchi emas) qo'shimcha ruxsatlarini TO'LIQ ro'yxat bilan belgilaydi (ro'yxatda yo'qlari olib tashlanadi). Joriy ro'yxat: ils_get_permissions. Kalitlar: ${Object.keys(PERMISSIONS).join(', ')}.` + CONFIRM_NOTE,
      inputSchema: {
        userId: uuid('Xodim'),
        permissions: z.array(z.string().max(64)).max(60),
      },
      annotations: DESTRUCTIVE,
    },
    async ({ userId, permissions }) =>
      guarded(actor, 'set_permissions', { userId, permissions }, { type: 'user', id: userId }, async () => {
        await assertNotAdminTarget(userId, actor);
        const res = await permissionsService.setUserPermissions(userId, permissions, actor.userId!);
        return { done: true, result: res, now: await permissionsService.getUserPermissions(userId) };
      })
  );

  // ── Muzlatish ───────────────────────────────────────────────────────────────
  server.registerTool(
    'ils_freeze_student',
    {
      title: 'O\'quvchini muzlatish',
      description: 'O\'quvchini joriy oy uchun muzlatilganlar ro\'yxatiga qo\'shadi (sabab bilan; hisobot va ustoz reytingiga ta\'sir qiladi).' + CONFIRM_NOTE,
      inputSchema: {
        studentId: uuid('O\'quvchi'),
        reason: z.enum(FREEZE_REASONS),
        detailedNote: z.string().max(1000).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('O\'qishni boshlagan sana'),
      },
      annotations: SAFE_WRITE,
    },
    async (args) =>
      guarded(actor, 'freeze_student', args, { type: 'user', id: args.studentId }, async () => {
        const s = await prisma.user.findUnique({ where: { id: args.studentId }, select: { role: true } });
        if (!s || s.role !== 'student') throw new McpUserError('O\'quvchi topilmadi');
        const f = await freezesService.freezeStudent({ ...args, frozenById: actor.userId! });
        return { frozen: true, freeze: { id: f.id, month: f.month, year: f.year, reason: f.reason } };
      })
  );

  server.registerTool(
    'ils_unfreeze',
    {
      title: 'Muzlatishni bekor qilish',
      description: 'Muzlatish yozuvini o\'chiradi (ID — ils_student_report yoki SQL dan).' + CONFIRM_NOTE,
      inputSchema: { freezeId: uuid('Muzlatish yozuvi') },
      annotations: DESTRUCTIVE,
    },
    async ({ freezeId }) =>
      guarded(actor, 'unfreeze', { freezeId }, { type: 'freeze', id: freezeId }, async () => {
        const f = await prisma.studentFreeze.findUnique({ where: { id: freezeId } });
        if (!f) throw new McpUserError('Muzlatish topilmadi');
        await freezesService.unfreeze(freezeId);
        return { done: true, removed: { id: f.id, student: f.studentName, month: f.month, year: f.year } };
      })
  );

  // ── Ota-ona murojaatlari ────────────────────────────────────────────────────
  server.registerTool(
    'ils_reply_appeal',
    {
      title: 'Murojaatga javob berish',
      description:
        'Ota-ona murojaatiga javob yozadi, holatini "hal_qilindi" qiladi va javobni OTA-ONAGA Telegram orqali YUBORADI. Matnni foydalanuvchi bilan kelishib oling.' + CONFIRM_NOTE,
      inputSchema: { appealId: uuid('Murojaat'), reply: z.string().min(1).max(2000) },
      annotations: { ...SAFE_WRITE, openWorldHint: true },
    },
    async ({ appealId, reply }) =>
      guarded(actor, 'reply_appeal', { appealId, reply: reply.slice(0, 300) }, { type: 'appeal', id: appealId }, async () => {
        const appeal: any = await appealsService.reply(appealId, actor.userId!, reply);
        const chatId = appeal?.telegramLink?.chatId;
        let sent = false;
        if (chatId) {
          await safeSendToParent(chatId, `💬 *Murojaatingizga javob keldi*\n━━━━━━━━━━━━━━━━━━━━\n${reply}`);
          sent = true;
        }
        return { replied: true, sentToParent: sent, status: appeal.status };
      })
  );

  server.registerTool(
    'ils_set_appeal_status',
    {
      title: 'Murojaat holati',
      description: 'Murojaat holatini o\'zgartiradi (ota-onaga xabar ketmaydi).' + CONFIRM_NOTE,
      inputSchema: { appealId: uuid('Murojaat'), status: z.enum(['yangi', 'korib_chiqilmoqda', 'hal_qilindi']) },
      annotations: SAFE_WRITE,
    },
    async ({ appealId, status }) =>
      guarded(actor, 'set_appeal_status', { appealId, status }, { type: 'appeal', id: appealId }, async () => {
        await appealsService.getById(appealId);
        const a: any = await appealsService.updateStatus(appealId, status);
        return { updated: true, status: a.status };
      })
  );

  // ── Darslar ─────────────────────────────────────────────────────────────────
  server.registerTool(
    'ils_grade_lesson',
    {
      title: 'Dars bahosini qo\'yish / tuzatish',
      description:
        'Dars sessiyasida o\'quvchining uy vazifasi (toliq/qisman/bajarmagan/kelmadi yoki null — bekor), faollik (1–5 yoki null) bahosini qo\'yadi yoki tuzatadi; coinDelta berilsa coin qo\'shadi/ayiradi. Admin sifatida muddatdan keyin ham ishlaydi.' + CONFIRM_NOTE,
      inputSchema: {
        sessionId: uuid('Dars sessiyasi'),
        studentId: uuid('O\'quvchi'),
        homework: z.enum(['toliq', 'qisman', 'bajarmagan', 'kelmadi']).nullable().optional(),
        comment: z.string().max(500).optional(),
        activityScore: z.number().int().min(1).max(5).nullable().optional(),
        coinDelta: z.number().int().min(-1000).max(1000).optional(),
      },
      annotations: SAFE_WRITE,
    },
    async ({ sessionId, studentId, homework, comment, activityScore, coinDelta }) =>
      guarded(actor, 'grade_lesson', { sessionId, studentId, homework, activityScore, coinDelta }, { type: 'lesson_session', id: sessionId }, async () => {
        if (homework === undefined && activityScore === undefined && !coinDelta) {
          throw new McpUserError('homework, activityScore yoki coinDelta dan kamida bittasi kerak');
        }
        const done: string[] = [];
        if (homework !== undefined) {
          await lessonSessionsService.gradeHomework(sessionId, actor.userId!, true, studentId, homework as any, comment, true);
          done.push('homework');
        }
        if (activityScore !== undefined) {
          await lessonSessionsService.gradeActivity(sessionId, actor.userId!, true, studentId, activityScore, true);
          done.push('activity');
        }
        if (coinDelta) {
          await lessonSessionsService.gradeCoin(sessionId, actor.userId!, true, studentId, coinDelta);
          done.push('coin');
        }
        const g = await prisma.lessonGrade.findUnique({
          where: { sessionId_studentId: { sessionId, studentId } },
          select: { homework: true, homeworkScore: true, activityScore: true, coinAwarded: true, comment: true },
        });
        return { done, grade: g };
      })
  );

  server.registerTool(
    'ils_unlock_lesson',
    {
      title: 'Darsni baholash uchun ochish',
      description:
        'Guruhning shu kungi (yoki ko\'rsatilgan kungi) dars sessiyasini ustoz qayta baholay olishi uchun ochadi (admin "unlock"). Izoh majburiy.' + CONFIRM_NOTE,
      inputSchema: {
        groupId: uuid('Guruh'),
        note: z.string().min(3).max(500),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD, berilmasa bugun'),
      },
      annotations: SAFE_WRITE,
    },
    async ({ groupId, note, date }) =>
      guarded(actor, 'unlock_lesson', { groupId, note, date }, { type: 'group', id: groupId }, async () => {
        const s: any = await lessonSessionsService.adminUnlock(groupId, actor.userId!, note, date ? new Date(`${date}T12:00:00+05:00`) : undefined);
        return { unlocked: true, session: s ? { id: s.id, date: s.date, status: s.status, deadlineAt: s.deadlineAt } : null };
      })
  );

  // ── Guruh hayot sikli ───────────────────────────────────────────────────────
  server.registerTool(
    'ils_group_lifecycle',
    {
      title: 'Guruhni bitirish / arxivlash / tiklash',
      description:
        'graduate — kursni tamomladi (arxiv, savatga tushmaydi); ungraduate — bitiruvni bekor qilish; archive — guruhni nofaol qilish (savatga); restore — savatdan qaytarish. Hech narsa butunlay o\'chmaydi.' + CONFIRM_NOTE,
      inputSchema: { groupId: uuid('Guruh'), action: z.enum(['graduate', 'ungraduate', 'archive', 'restore']) },
      annotations: DESTRUCTIVE,
    },
    async ({ groupId, action }) =>
      guarded(actor, `group_${action}`, { groupId, action }, { type: 'group', id: groupId }, async () => {
        if (action === 'graduate') await groupsService.graduate(groupId, actor.userId!);
        if (action === 'ungraduate') await groupsService.ungraduate(groupId, actor.userId!);
        if (action === 'archive') await groupsService.delete(groupId, actor.userId!);
        if (action === 'restore') await trashService.restoreGroup(groupId, actor.userId!);
        const g = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true, name: true, isActive: true, graduatedAt: true } });
        return { done: true, group: g };
      })
  );

  server.registerTool(
    'ils_restore_user',
    {
      title: 'Foydalanuvchini savatdan tiklash',
      description: 'O\'chirilgan (nofaol) foydalanuvchini qayta faollashtiradi (savat qoidalari bilan).' + CONFIRM_NOTE,
      inputSchema: { userId: uuid('Foydalanuvchi') },
      annotations: SAFE_WRITE,
    },
    async ({ userId }) =>
      guarded(actor, 'restore_user', { userId }, { type: 'user', id: userId }, async () => {
        await trashService.restoreUser(userId, actor.userId!);
        return { restored: true, userId };
      })
  );

  // ── Bosqich sanasi ──────────────────────────────────────────────────────────
  server.registerTool(
    'ils_set_milestone_date',
    {
      title: 'Bosqich sanasini tanlash',
      description: 'Demo day / imtihon bosqichiga rejalashtirilgan sanani belgilaydi (nomzod sanalardan biri yoki kechikkan bo\'lsa yangi sana).' + CONFIRM_NOTE,
      inputSchema: { milestoneId: uuid('Bosqich'), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) },
      annotations: SAFE_WRITE,
    },
    async ({ milestoneId, date }) =>
      guarded(actor, 'set_milestone_date', { milestoneId, date }, { type: 'milestone', id: milestoneId }, async () => {
        const m: any = await milestonesService.pickDate(milestoneId, date);
        return { done: true, milestone: { id: m.id, plannedDate: m.plannedDate, status: m.status } };
      })
  );

  // ── Do'kon ──────────────────────────────────────────────────────────────────
  server.registerTool(
    'ils_shop_order',
    {
      title: 'Do\'kon buyurtmasi',
      description: 'Kutilayotgan buyurtmani "berildi" qiladi yoki bekor qiladi (bekor qilinsa coin qaytariladi).' + CONFIRM_NOTE,
      inputSchema: { orderId: uuid('Buyurtma'), action: z.enum(['fulfill', 'cancel']), note: z.string().max(300).optional() },
      annotations: SAFE_WRITE,
    },
    async ({ orderId, action, note }) =>
      guarded(actor, `shop_${action}`, { orderId, action, note }, { type: 'shop_order', id: orderId }, async () => {
        if (action === 'fulfill') await shopService.fulfillOrder(orderId, actor.userId!);
        else await shopService.cancelOrder(orderId, actor.userId!, note);
        const o = await prisma.shopOrder.findUnique({ where: { id: orderId }, select: { id: true, status: true } });
        return { done: true, order: o };
      })
  );

  // ── Bildirishnoma ───────────────────────────────────────────────────────────
  server.registerTool(
    'ils_send_notification',
    {
      title: 'Ichki bildirishnoma yuborish',
      description:
        'Panel ichidagi bildirishnoma (qo\'ng\'iroqcha) yuboradi: aniq foydalanuvchilarga, guruhning faol o\'quvchilariga yoki rol bo\'yicha. Telegram\'ga ketmaydi. Ko\'pi bilan 500 kishi.' + CONFIRM_NOTE,
      inputSchema: {
        title: z.string().min(1).max(120),
        body: z.string().max(1000).optional(),
        userIds: z.array(z.string().uuid()).max(500).optional(),
        groupId: uuid('Guruh (faol o\'quvchilari)').optional(),
        role: z.enum(NON_ADMIN_ROLES).optional().describe('Shu roldagi barcha faol foydalanuvchilar'),
      },
      annotations: { ...SAFE_WRITE, openWorldHint: true },
    },
    async ({ title, body, userIds, groupId, role }) =>
      guarded(actor, 'send_notification', { title, groupId, role, userCount: userIds?.length ?? 0 }, { type: 'notification' }, async () => {
        const targets = new Set<string>(userIds ?? []);
        if (groupId) {
          const gs = await prisma.groupStudent.findMany({ where: { groupId, student: { isActive: true } }, select: { studentId: true } });
          gs.forEach((g) => targets.add(g.studentId));
        }
        if (role) {
          const us = await prisma.user.findMany({ where: { role, isActive: true }, select: { id: true } });
          us.forEach((u) => targets.add(u.id));
        }
        if (targets.size === 0) throw new McpUserError('Qabul qiluvchi topilmadi (userIds, groupId yoki role bering)');
        if (targets.size > 500) throw new McpUserError(`Juda ko'p qabul qiluvchi (${targets.size}); 500 tagacha`);
        const valid = await prisma.user.findMany({ where: { id: { in: [...targets] }, isActive: true }, select: { id: true } });
        for (const u of valid) {
          const n = await prisma.notification.create({ data: { userId: u.id, type: 'admin_message', title, body: body ?? null } });
          emitToUser(u.id, 'new_notification', n);
        }
        return { sent: valid.length };
      })
  );
}
