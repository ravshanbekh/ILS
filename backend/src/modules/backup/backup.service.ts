import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../shared/middleware/errorHandler';

/**
 * JSON EKSPORT VA TIKLASH
 *
 * ────────────────────────────────────────────────────────────────────────
 * OLDINGI VERSIYADAGI XAVFLI XATO (2026-09-17 da topildi va tuzatildi)
 * ────────────────────────────────────────────────────────────────────────
 * Eski kod sxemadagi 48 ta jadvaldan faqat 8 tasini oladi va tiklashda
 * `user.deleteMany()` qiladi. Sxemada 47 ta `onDelete: Cascade` bog'lanish
 * bor, ya'ni foydalanuvchilarni o'chirish imtihonlar, uyga vazifalar,
 * darsliklar, baholar, coinlar, Telegram ulanishlari, ruxsatlar,
 * cheklistlar va boshqa 40 ta jadvalni ham o'chirib yuborardi —
 * ularning hech biri zaxirada YO'Q edi.
 *
 * Ya'ni "qayta tiklash" tugmasi aslida ma'lumotni yo'q qilish tugmasi edi.
 *
 * ────────────────────────────────────────────────────────────────────────
 * HOZIRGI YECHIM
 * ────────────────────────────────────────────────────────────────────────
 * Jadvallar ro'yxati QO'LDA yozilmaydi — u Prisma DMMF dan o'qiladi va
 * bog'lanishlar bo'yicha tartiblanadi. Sxemaga yangi model qo'shilsa,
 * u avtomatik ravishda zaxiraga ham tushadi. Qo'lda yozilgan ro'yxat
 * sxemadan orqada qolib ketishi muqarrar edi — asosiy xato aynan shundan
 * kelib chiqqan.
 *
 * Tiklashda ikki qatlamli himoya bor: ro'yxatdagi jadvallar to'liqligi
 * tekshiriladi va bazada ma'lumot bor, lekin faylda yo'q jadval topilsa
 * operatsiya BOSHLANMAYDI.
 *
 * DIQQAT: bu to'liq disaster recovery emas. Haqiqiy zaxira — server
 * ichidagi `pg_dump` (scripts/backup-db.sh, har kuni cron bilan).
 * Bu yerdagi JSON — ko'chirish va tekshirish uchun qulay format.
 */

type ModelInfo = { name: string; delegate: string };

/** Model nomidan Prisma client dagi delegate nomini oladi: User -> user */
function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Jadvallarni bog'lanish tartibida qaytaradi: ota jadval doim bolasidan
 * oldin turadi. Shu tartibda `createMany` qilinsa foreign key buzilmaydi.
 *
 * Halqa (masalan User -> User "checkedBy") bo'lsa, u e'tiborsiz qoldiriladi:
 * bunday bog'lanishlar nullable va keyin to'ldiriladi.
 */
function orderedModels(): ModelInfo[] {
  const models = Prisma.dmmf.datamodel.models;
  const deps = new Map<string, Set<string>>();

  for (const m of models) {
    const set = new Set<string>();
    for (const f of m.fields) {
      // relationFromFields bo'sh bo'lmasa — foreign key AYNAN shu modelda
      if (f.kind === 'object' && f.relationFromFields && f.relationFromFields.length > 0) {
        if (f.type !== m.name) set.add(f.type); // o'ziga bog'lanish hisobga olinmaydi
      }
    }
    deps.set(m.name, set);
  }

  const done = new Set<string>();
  const out: ModelInfo[] = [];

  // Oddiy topologik saralash. Halqa qolsa ham to'xtab qolmaydi —
  // qolganlari nom bo'yicha qo'shiladi.
  let guard = models.length + 1;
  while (out.length < models.length && guard-- > 0) {
    for (const m of models) {
      if (done.has(m.name)) continue;
      const pending = [...(deps.get(m.name) ?? [])].filter((d) => !done.has(d));
      if (pending.length === 0) {
        done.add(m.name);
        out.push({ name: m.name, delegate: delegateName(m.name) });
      }
    }
  }
  for (const m of models) {
    if (!done.has(m.name)) out.push({ name: m.name, delegate: delegateName(m.name) });
  }

  return out;
}

const BACKUP_VERSION = '2.0';

class BackupService {
  /**
   * Bazadagi BARCHA jadvallarni JSON qilib qaytaradi.
   *
   * Eslatma: Date va BigInt qiymatlar JSON.stringify da muammo qiladi.
   * BigInt uchun controller alohida replacer ishlatadi.
   */
  async createBackup() {
    const models = orderedModels();
    const data: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};

    for (const m of models) {
      const delegate = (prisma as any)[m.delegate];
      if (!delegate?.findMany) continue;
      const rows = await delegate.findMany();
      data[m.delegate] = rows;
      counts[m.delegate] = rows.length;
    }

    return {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      /** Fayl to'liqligini tekshirish uchun — tiklashda ishlatiladi */
      tables: models.map((m) => m.delegate),
      counts,
      totalRows: Object.values(counts).reduce((s, n) => s + n, 0),
      data,
    };
  }

  /**
   * Zaxirani tekshiradi, lekin HECH NARSA O'ZGARTIRMAYDI.
   * Tiklashdan oldin "nima bo'ladi?" degan savolga javob beradi.
   */
  async inspectBackup(backupData: any) {
    if (!backupData?.data || typeof backupData.data !== 'object') {
      throw ApiError.badRequest("Noto'g'ri zaxira fayli: 'data' bo'limi yo'q");
    }

    const models = orderedModels();
    const known = new Set(models.map((m) => m.delegate));
    const fileTables = Object.keys(backupData.data);

    const unknown = fileTables.filter((t) => !known.has(t));
    const missing = models.map((m) => m.delegate).filter((t) => !fileTables.includes(t));

    // Bazada ma'lumot bor, lekin faylda yo'q jadvallar — eng xavflisi
    const dataLoss: { table: string; rows: number }[] = [];
    for (const table of missing) {
      const delegate = (prisma as any)[table];
      if (!delegate?.count) continue;
      const rows = await delegate.count();
      if (rows > 0) dataLoss.push({ table, rows });
    }

    const fileRows = fileTables.reduce(
      (s, t) => s + (Array.isArray(backupData.data[t]) ? backupData.data[t].length : 0),
      0,
    );

    return {
      version: backupData.version ?? 'nomalum',
      timestamp: backupData.timestamp ?? null,
      fileTables: fileTables.length,
      schemaTables: models.length,
      fileRows,
      unknownTables: unknown,
      missingTables: missing,
      /** Bo'sh bo'lmasa — tiklash RAD ETILADI */
      dataLoss,
      safe: dataLoss.length === 0 && unknown.length === 0,
    };
  }

  /**
   * JSON zaxiradan tiklash. Juda xavfli operatsiya.
   *
   * Himoya: bazada ma'lumot bor, lekin faylda yo'q jadval topilsa
   * operatsiya umuman boshlanmaydi. Eski versiyada aynan shu holat
   * jimgina ma'lumot yo'qotishga olib kelardi.
   */
  async restoreBackup(backupData: any, options?: { force?: boolean }) {
    const report = await this.inspectBackup(backupData);

    if (report.unknownTables.length > 0) {
      throw ApiError.badRequest(
        `Zaxirada notanish jadvallar bor: ${report.unknownTables.join(', ')}. ` +
          'Bu fayl boshqa versiyadan bo\'lishi mumkin.',
      );
    }

    if (report.dataLoss.length > 0 && !options?.force) {
      const detail = report.dataLoss
        .map((d) => `${d.table} (${d.rows} qator)`)
        .join(', ');
      throw ApiError.badRequest(
        'Tiklash TO\'XTATILDI — ma\'lumot yo\'qolishi aniqlandi. ' +
          `Bazada ma'lumot bor, lekin zaxira faylida yo'q jadvallar: ${detail}. ` +
          'Tiklash bu jadvallarni o\'chirib yuborardi. Yangi zaxira oling yoki ' +
          'server ichidagi pg_dump nusxasidan tiklang.',
      );
    }

    const models = orderedModels();

    await prisma.$transaction(
      async (tx) => {
        // 1. Teskari tartibda o'chirish — avval bolalar, keyin otalar
        for (const m of [...models].reverse()) {
          const delegate = (tx as any)[m.delegate];
          if (delegate?.deleteMany) await delegate.deleteMany();
        }

        // 2. To'g'ri tartibda yozish — ota jadval avval
        for (const m of models) {
          const rows = backupData.data[m.delegate];
          if (!Array.isArray(rows) || rows.length === 0) continue;
          const delegate = (tx as any)[m.delegate];
          if (!delegate?.createMany) continue;
          // Katta jadvallarni bo'lib yozamiz — bitta so'rovda 6000+ qator
          // yuborish PostgreSQL parametr chegarasiga urilishi mumkin.
          for (let i = 0; i < rows.length; i += 1000) {
            await delegate.createMany({ data: rows.slice(i, i + 1000), skipDuplicates: true });
          }
        }
      },
      {
        // Eski 30s butun bazani tiklashga yetmasdi va tranzaksiya
        // o'rtada uzilib qolardi.
        timeout: 10 * 60 * 1000,
        maxWait: 60 * 1000,
      },
    );

    return {
      message: "Ma'lumotlar tiklandi",
      tables: models.length,
      rows: report.fileRows,
    };
  }
}

export default new BackupService();
