import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import fs from 'fs';
import path from 'path';
import { generateText, getAISettings } from '../../shared/utils/ai';

const router = Router();
router.use(authenticate);

const ROLE_GUIDES: Record<string, string> = {
  admin: `Admin imkoniyatlari:
- Dashboard: umumiy statistika ko'rish
- Foydalanuvchilar: o'qituvchi, o'quvchi, operator qo'shish/tahrirlash
- Guruhlar: yangi guruh ochish, o'quvchi qo'shish, normativ biriktirish
- Normativlar: yangi normativ yaratish, tahrirlash
- Topshiriqlar: pending topshiriqlarni ko'rish
- Muzlatilganlar: o'quvchilarni muzlatish, AI tahlil qilish
- Monitoring: guruhlar bo'yicha qo'ng'iroq qilish, AI tahlil
- Checklist: kunlik vazifalar ro'yxati
- Reyting: o'quvchilar va o'qituvchilar reytingi
- Sozlamalar: API key, tutorial videolar, profil xavfsizligi
- Eksport: ma'lumotlarni Excel'ga yuklash`,

  teacher: `O'qituvchi imkoniyatlari:
- Dashboard: o'z guruhlari statistikasi
- Guruhlar: o'z guruhlarini ko'rish va boshqarish
- Topshiriqlar: o'quvchilar topshiriqlarini tekshirish (🟢🔵🔴)
- O'quvchi profili: har bir o'quvchini alohida ko'rish, AI tahlil va AI Script suhbat scripti
- Checklist: kunlik vazifalar
- Normativlar: guruhga biriktirilgan normativlarni ko'rish`,

  student: `O'quvchi imkoniyatlari:
- Dashboard: o'z ballaringiz va darajangizni ko'rish, yutuqlar (nishonlar) va AI tahlil
- Normativlar: berilgan vazifalarni ko'rish va YouTube link topshirish
- Reyting: guruh va umumiy reytingdagi o'rningiz
- Tarix: barcha topshiriqlar tarixi`,

  call_operatori: `Call Operator imkoniyatlari:
- Muzlatilganlar: ketib qolgan o'quvchilar ro'yxati
- AI Script: har bir o'quvchi uchun AI tomonidan yozilgan gaplashish scripti
- Monitoring: qo'ng'iroq natijalari va izohlar`,
};

// POST /api/chatbot/ask
router.post('/ask', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'message majburiy' });
    }

    const userRole = req.user!.role;

    const { apiKey } = getAISettings();

    if (!apiKey) {
      return res.json({ success: true, data: { reply: 'Tizimda sun\'iy intellekt sozlanmagan. Adminga murojaat qiling.' } });
    }

    const roleGuide = ROLE_GUIDES[userRole] || ROLE_GUIDES['student'];

    const prompt = `Sen "ILS — IT Live Score" platformasining yordamchi botisan.
Foydalanuvchi roli: ${userRole}

Bu platformaning imkoniyatlari:
${roleGuide}

QOIDALAR:
1. FAQAT shu platforma haqida javob ber
2. Boshqa temadagi savollarga: "Kechirasiz, men faqat ILS platformasi haqida yordam bera olaman 😊" de
3. Javob qisqa bo'lsin — 3-5 gap
4. O'zbek tilida javob ber
5. Samimiy va do'stona ohangda bo'l
6. Javobda markdown (*, **, #) belgilaridan mutlaqo foydalanma.

Foydalanuvchi savoli: ${message}`;

    try {
      const reply = await generateText(prompt, 1024);
      res.json({ success: true, data: { reply } });
    } catch (err) {
      console.error('Chatbot error:', err);
      return res.json({ success: true, data: { reply: 'Kechirasiz, hozirgi vaqtda yordamchi bot bilan bog\'lanishda xatolik yuz berdi.' } });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
