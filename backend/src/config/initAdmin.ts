import prisma from './database';
import bcrypt from 'bcryptjs';
import { env } from './env';
import logger from '../shared/utils/logger';

/**
 * Server birinchi ishga tushganda INITIAL_ADMIN_* env o'zgaruvchilari
 * orqali admin hisobini avtomatik yaratadi.
 * Agar admin allaqachon mavjud bo'lsa — hech narsa qilmaydi.
 */
export async function initAdmin() {
  const { INITIAL_ADMIN_LOGIN, INITIAL_ADMIN_PASSWORD, INITIAL_ADMIN_FULLNAME } = env;

  // Agar env da admin login/password ko'rsatilmagan bo'lsa, o'tkazib yuboramiz
  if (!INITIAL_ADMIN_LOGIN || !INITIAL_ADMIN_PASSWORD) {
    return;
  }

  try {
    // Bu login bilan foydalanuvchi allaqachon bormi?
    const existing = await prisma.user.findUnique({
      where: { login: INITIAL_ADMIN_LOGIN },
    });

    if (existing) {
      logger.info(`👤 Admin hisob mavjud: ${INITIAL_ADMIN_LOGIN}`);
      return;
    }

    // Yangi admin yaratish
    const passwordHash = await bcrypt.hash(INITIAL_ADMIN_PASSWORD, 12);

    await prisma.user.create({
      data: {
        fullName: INITIAL_ADMIN_FULLNAME,
        login: INITIAL_ADMIN_LOGIN,
        passwordHash,
        role: 'admin',
      },
    });

    logger.info(`✅ Boshlang'ich admin yaratildi: ${INITIAL_ADMIN_LOGIN}`);
  } catch (error) {
    logger.error('❌ Admin yaratishda xatolik:', error);
  }
}
