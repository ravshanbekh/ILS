import prisma from '../../config/database';
import fs from 'fs';
import path from 'path';
import { generateText, getAISettings } from '../../shared/utils/ai';

class NotificationEngine {
  // Har 6 soatda ishga tushadi (cron yoki server startup)
  async runChecks() {
    try {
      await this.checkUncheckedSubmissions();
      await this.checkLaggingStudents();
      await this.checkLongInactivity();
      await this.checkTeacherRankings();
    } catch (err) {
      console.error('NotificationEngine runChecks error:', err);
    }
  }

  // Helper: Barcha faol adminlarni olish
  private async getAdmins() {
    return prisma.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true }
    });
  }

  // 1. O'qituvchi 48+ soat tekshirmagan topshiriqlar
  private async checkUncheckedSubmissions() {
    const threshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    const unchecked = await prisma.submission.findMany({
      where: { status: 'pending', submittedAt: { lt: threshold } },
      include: { group: { include: { teacher: true } }, student: true },
    });

    const admins = await this.getAdmins();

    // Guruh -> teacher mapping
    const teacherNotifs: Record<string, { count: number; students: string[]; teacherName: string; groupName: string }> = {};
    unchecked.forEach(sub => {
      if (!sub.group || !sub.group.teacherId) return;
      const tid = sub.group.teacherId;
      if (!teacherNotifs[tid]) {
        teacherNotifs[tid] = {
          count: 0,
          students: [],
          teacherName: sub.group.teacher?.fullName || 'Noma\'lum',
          groupName: sub.group.name
        };
      }
      teacherNotifs[tid].count++;
      if (!teacherNotifs[tid].students.includes(sub.student.fullName)) {
        teacherNotifs[tid].students.push(sub.student.fullName);
      }
    });

    for (const [teacherId, data] of Object.entries(teacherNotifs)) {
      // Teacher uchun tekshirish
      const existingTeacherNotif = await prisma.notification.findFirst({
        where: {
          userId: teacherId,
          type: 'unchecked_submissions',
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      });

      const body = `${data.count} ta topshiriq 48+ soat tekshirilmagan. O'quvchilar: ${data.students.slice(0, 3).join(', ')}${data.students.length > 3 ? ` va yana ${data.students.length - 3} ta` : ''}`;
      
      if (!existingTeacherNotif) {
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

      // Admin uchun tekshirish va yaratish
      if (admins.length > 0) {
        const existingAdminNotif = await prisma.notification.findFirst({
          where: {
            userId: admins[0].id,
            type: 'unchecked_submissions_admin',
            body: { contains: data.teacherName },
            createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        });

        if (!existingAdminNotif) {
          const adminBody = `O'qituvchi ${data.teacherName} ning ${data.groupName} guruhida ${data.count} ta topshiriq 48+ soatdan buyon tekshirilmagan.`;
          const adminAdvice = await this.generateAIAdvice('unchecked_submissions_admin', `${adminBody} Ushbu holatni hal qilish va o'qituvchi bilan ishlash bo'yicha ma'muriy yechim bering.`);

          for (const admin of admins) {
            await prisma.notification.create({
              data: {
                userId: admin.id,
                type: 'unchecked_submissions_admin',
                title: `⏰ Tekshirish kechikdi: ${data.teacherName}`,
                body: adminBody + (adminAdvice ? `\n💡 Admin uchun yechim: ${adminAdvice}` : ''),
              }
            });
          }
        }
      }
    }
  }

  // 2. O'quvchi 2+ hafta topshiriq topshirmagan
  private async checkLongInactivity() {
    const threshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    
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

    const admins = await this.getAdmins();

    for (const student of inactive) {
      for (const gs of student.groupStudents) {
        if (!gs.group.teacherId) continue;
        
        // Teacher notification
        const existingTeacherNotif = await prisma.notification.findFirst({
          where: {
            userId: gs.group.teacherId,
            type: 'student_inactive',
            body: { contains: student.fullName },
            createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        });

        const body = `${student.fullName} 2+ hafta topshiriq topshirmagan. O'quvchi bilan bog'lanish tavsiya etiladi.`;

        if (!existingTeacherNotif) {
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

        // Admin notification
        if (admins.length > 0) {
          const teacherName = gs.group.teacher?.fullName || 'Noma\'lum';
          const existingAdminNotif = await prisma.notification.findFirst({
            where: {
              userId: admins[0].id,
              type: 'student_inactive_admin',
              body: { contains: student.fullName },
              createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }
          });

          if (!existingAdminNotif) {
            const adminBody = `${gs.group.name} guruhidagi o'quvchi ${student.fullName} (O'qituvchisi: ${teacherName}) 2+ haftadan beri topshiriq topshirmagan.`;
            const adminAdvice = await this.generateAIAdvice('student_inactive_admin', `${adminBody} Ushbu faolsiz o'quvchini darsga qaytarish va motivatsiyasini oshirish uchun ma'muriy tavsiya bering.`);

            for (const admin of admins) {
              await prisma.notification.create({
                data: {
                  userId: admin.id,
                  type: 'student_inactive_admin',
                  title: `⚠️ Faolsiz o'quvchi: ${student.fullName}`,
                  body: adminBody + (adminAdvice ? `\n💡 Admin uchun tavsiya: ${adminAdvice}` : ''),
                }
              });
            }
          }
        }
      }
    }
  }

  // 3. Ortda qolayotgan o'quvchi (guruhda o'rtachadan 50%+ past ball)
  private async checkLaggingStudents() {
    const groups = await prisma.group.findMany({
      where: { isActive: true },
      include: { teacher: true, groupStudents: { include: { student: true } } }
    });

    const admins = await this.getAdmins();

    for (const group of groups) {
      if (!group.teacherId || group.groupStudents.length < 5) continue;
      
      const studentScores = await Promise.all(
        group.groupStudents.map(async gs => {
          const total = await prisma.submission.aggregate({
            where: { studentId: gs.studentId, groupId: group.id },
            _sum: { score: true }
          });
          return { id: gs.studentId, name: gs.student.fullName, score: total._sum.score || 0 };
        })
      );

      const sorted = studentScores.sort((a, b) => a.score - b.score);
      const avg = sorted.reduce((s, x) => s + x.score, 0) / sorted.length;
      const laggards = sorted.filter(s => s.score < avg * 0.5).slice(0, 3);

      if (laggards.length === 0) continue;

      // Teacher notification
      const existingTeacherNotif = await prisma.notification.findFirst({
        where: {
          userId: group.teacherId,
          type: 'lagging_students',
          createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      });

      const body = `${group.name}: ${laggards.map(l => l.name).join(', ')} — guruh o'rtachasidan 50%+ past ballga ega.`;

      if (!existingTeacherNotif) {
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

      // Admin notification
      if (admins.length > 0) {
        const existingAdminNotif = await prisma.notification.findFirst({
          where: {
            userId: admins[0].id,
            type: 'lagging_students_admin',
            body: { contains: group.name },
            createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        });

        if (!existingAdminNotif) {
          const teacherName = group.teacher?.fullName || 'Noma\'lum';
          const adminBody = `${group.name} guruhida (O'qituvchi: ${teacherName}) ortda qolayotgan o'quvchilar aniqlandi: ${laggards.map(l => `${l.name} (${l.score} ball)`).join(', ')}. Guruh o'rtacha balli: ${Math.round(avg)} ball.`;
          const adminAdvice = await this.generateAIAdvice('lagging_students_admin', `${adminBody} Ushbu ortda qolgan o'quvchilarning natijalarini ko'tarish bo'yicha ma'muriy maslahat bering.`);

          for (const admin of admins) {
            await prisma.notification.create({
              data: {
                userId: admin.id,
                type: 'lagging_students_admin',
                title: `📉 Ortda qolayotganlar: ${group.name}`,
                body: adminBody + (adminAdvice ? `\n💡 Admin uchun tavsiya: ${adminAdvice}` : ''),
              }
            });
          }
        }
      }
    }
  }

  // 4. O'qituvchilar reytingini tekshirish (Adminlar uchun)
  private async checkTeacherRankings() {
    const teachers = await prisma.user.findMany({
      where: { role: 'teacher', isActive: true },
    });

    const admins = await this.getAdmins();
    if (admins.length === 0) return;

    for (const teacher of teachers) {
      const groups = await prisma.group.findMany({
        where: { teacherId: teacher.id, isActive: true },
      });
      const groupIds = groups.map(g => g.id);
      if (groupIds.length === 0) continue;

      const submissions = await prisma.submission.findMany({
        where: { groupId: { in: groupIds }, status: 'checked' },
        select: { result: true, score: true }
      });

      const checkedCount = submissions.length;
      if (checkedCount < 5) continue; // Faqat etarlicha ma'lumot bo'lsa

      const green = submissions.filter((s) => s.result === 'green').length;
      const red = submissions.filter((s) => s.result === 'red').length;
      const greenRate = green / checkedCount;

      // Agar green topshiriqlar ulushi 40% dan past bo'lsa yoki qizillar 30% dan ko'p bo'lsa
      if (greenRate < 0.4 || (red / checkedCount) > 0.3) {
        const existing = await prisma.notification.findFirst({
          where: {
            userId: admins[0].id,
            type: 'low_teacher_rating',
            body: { contains: teacher.fullName },
            createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        });
        if (existing) continue;

        const body = `O'qituvchi ${teacher.fullName} ning umumiy guruh natijalari past: Tekshirilgan ${checkedCount} ta topshiriqdan 🟢 A'lo: ${green} ta (${Math.round(greenRate * 100)}%), 🔴 Qoniqarsiz: ${red} ta (${Math.round((red / checkedCount) * 100)}%).`;
        const advice = await this.generateAIAdvice('low_teacher_rating', `${body} Ushbu o'qituvchining metodologiyasini yaxshilash va unga yordam berish bo'yicha ma'muriyat uchun chora-tadbirlar rejasini bering.`);

        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              type: 'low_teacher_rating',
              title: `📉 O'qituvchi reytingi past: ${teacher.fullName}`,
              body: body + (advice ? `\n💡 Admin uchun tavsiya: ${advice}` : ''),
            }
          });
        }
      }
    }
  }

  // AI bilan qisqa maslahat generatsiya qilish (har bir notification uchun)
  async generateAIAdvice(notificationType: string, context: string): Promise<string> {
    const { apiKey } = getAISettings();
    if (!apiKey) return '';
    
    try {
      const prompt = `Sen EdTech tizimlarida 10 yillik tajribali ta'lim maslahatchisisan.
Vaziyat: ${context}
Qisqa yechim yoki maslahat ber. AYNAN 2-3 gapdan iborat bo'lsin va markdown (*, **, #) belgilaridan aslo foydalanma.
O'zbek tilida.`;

      return await generateText(prompt, 256);
    } catch {
      return '';
    }
  }
}

export const notificationEngine = new NotificationEngine();
