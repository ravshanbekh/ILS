import prisma from '../../config/database';
import fs from 'fs';
import path from 'path';

class NotificationEngine {
  private getSettings(): { apiKey: string; model: string } {
    const settingsPath = path.join(__dirname, '../../../data/settings.json');
    let apiKey = '';
    let model = 'gemini-2.5-flash';
    try {
      if (fs.existsSync(settingsPath)) {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        const s = JSON.parse(raw);
        apiKey = s.geminiApiKey || '';
        model = s.geminiModel || 'gemini-2.5-flash';
      }
    } catch {}
    return { apiKey, model };
  }

  // Har 6 soatda ishga tushadi (cron yoki server startup)
  async runChecks() {
    try {
      await this.checkUncheckedSubmissions();
      await this.checkLaggingStudents();
      await this.checkLongInactivity();
    } catch (err) {
      console.error('NotificationEngine runChecks error:', err);
    }
  }

  // 1. O'qituvchi 48+ soat tekshirmagan topshiriqlar
  private async checkUncheckedSubmissions() {
    const threshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    const unchecked = await prisma.submission.findMany({
      where: { status: 'pending', submittedAt: { lt: threshold } },
      include: { group: { include: { teacher: true } }, student: true },
    });

    // Guruh -> teacher mapping
    const teacherNotifs: Record<string, { count: number; students: string[] }> = {};
    unchecked.forEach(sub => {
      const tid = sub.group?.teacherId;
      if (!tid) return;
      if (!teacherNotifs[tid]) teacherNotifs[tid] = { count: 0, students: [] };
      teacherNotifs[tid].count++;
      if (!teacherNotifs[tid].students.includes(sub.student.fullName)) {
        teacherNotifs[tid].students.push(sub.student.fullName);
      }
    });

    for (const [teacherId, data] of Object.entries(teacherNotifs)) {
      // Duplikat tekshirish — oxirgi 24 soatda shu turdagi xabar bormi
      const existing = await prisma.notification.findFirst({
        where: {
          userId: teacherId,
          type: 'unchecked_submissions',
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      });
      if (existing) continue;

      const body = `${data.count} ta topshiriq 48+ soat tekshirilmagan. O'quvchilar: ${data.students.slice(0, 3).join(', ')}${data.students.length > 3 ? ` va yana ${data.students.length - 3} ta` : ''}`;
      const advice = await this.generateAIAdvice('unchecked_submissions', body);

      await prisma.notification.create({
        data: {
          userId: teacherId,
          type: 'unchecked_submissions',
          title: '⏰ Tekshirilmagan topshiriqlar',
          body: body + (advice ? `\n💡 Maslahat: ${advice}` : ''),
        }
      });
    }
  }

  // 2. O'quvchi 2+ hafta topshiriq topshirmagan
  private async checkLongInactivity() {
    const threshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    
    // Faol o'quvchilar — oxirgi topshirig'i 2 haftadan oldin
    const students = await prisma.user.findMany({
      where: { role: 'student', isActive: true },
      include: {
        submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
        groupStudents: { include: { group: { include: { teacher: true } } } }
      }
    });

    const inactive = students.filter(s => {
      const last = s.submissions[0]?.submittedAt;
      return !last || new Date(last) < threshold;
    });

    // Har bir o'qituvchiga o'z guruhidagi inaktiv o'quvchilar haqida
    for (const student of inactive) {
      for (const gs of student.groupStudents) {
        if (!gs.group.teacherId) continue;
        
        const existing = await prisma.notification.findFirst({
          where: {
            userId: gs.group.teacherId,
            type: 'student_inactive',
            body: { contains: student.fullName },
            createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        });
        if (existing) continue;

        const body = `${student.fullName} 2+ hafta topshiriq topshirmagan. Bog'lanish tavsiya etiladi.`;
        const advice = await this.generateAIAdvice('student_inactive', body);

        await prisma.notification.create({
          data: {
            userId: gs.group.teacherId,
            type: 'student_inactive',
            title: '⚠️ Faolsiz o\'quvchi',
            body: body + (advice ? `\n💡 Maslahat: ${advice}` : ''),
          }
        });
      }
    }
  }

  // 3. Ortda qolayotgan o'quvchi (guruhda eng past 20%)
  private async checkLaggingStudents() {
    const groups = await prisma.group.findMany({
      where: { isActive: true },
      include: { teacher: true, groupStudents: { include: { student: true } } }
    });

    for (const group of groups) {
      if (!group.teacherId || group.groupStudents.length < 5) continue;
      
      // Har bir o'quvchining jami balli
      const studentScores = await Promise.all(
        group.groupStudents.map(async gs => {
          const total = await prisma.submission.aggregate({
            where: { studentId: gs.studentId, groupId: group.id },
            _sum: { score: true }
          });
          return { name: gs.student.fullName, score: total._sum.score || 0 };
        })
      );

      const sorted = studentScores.sort((a, b) => a.score - b.score);
      const avg = sorted.reduce((s, x) => s + x.score, 0) / sorted.length;
      const laggards = sorted.filter(s => s.score < avg * 0.5).slice(0, 3);

      if (laggards.length === 0) continue;

      const existing = await prisma.notification.findFirst({
        where: {
          userId: group.teacherId,
          type: 'lagging_students',
          createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      });
      if (existing) continue;

      const body = `${group.name}: ${laggards.map(l => l.name).join(', ')} — guruh o'rtachasidan 50%+ past.`;
      const advice = await this.generateAIAdvice('lagging_students', body);

      await prisma.notification.create({
        data: {
          userId: group.teacherId,
          type: 'lagging_students',
          title: '📉 Ortda qolayotgan o\'quvchilar',
          body: body + (advice ? `\n💡 Maslahat: ${advice}` : ''),
        }
      });
    }
  }

  // AI bilan qisqa maslahat generatsiya qilish (har bir notification uchun)
  async generateAIAdvice(notificationType: string, context: string): Promise<string> {
    const { apiKey, model } = this.getSettings();
    if (!apiKey) return '';
    
    try {
      const prompt = `Sen tajribali ta'lim maslahatchiisan.
Vaziyat: ${context}
Qisqa maslahat ber — AYNAN 2-3 gapdan iborat bo'lsin va markdown (*, **, #) belgilaridan foydalanma. Eng muhim qadamni ayt.
O'zbek tilida.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 256 },
          }),
        }
      );

      if (!response.ok) return '';
      const data: any = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/##+ /g, '').replace(/`/g, '').trim();
    } catch {
      return '';
    }
  }
}

export const notificationEngine = new NotificationEngine();
