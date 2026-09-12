import { useEffect, useState } from 'react';
import { homeworkApi, lessonSessionsApi } from '@/api';
import {
  BookOpen,
  Loader2,
  Check,
  Link2,
  FileText,
  X,
  AlertCircle,
  PlayCircle,
  Search,
  ChevronDown,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';

/**
 * Guruh sahifasidagi "Bugungi uyga vazifa" kartasi.
 *
 * Ilgari vazifa biriktirish faqat baholash oynasi ichida edi va o'qituvchi
 * uni topolmasdi. Endi guruh sahifasining o'zida ko'rinadi.
 *
 * Vazifa dars sessiyasiga bog'lanadi (chunki baho keyingi darsda aynan shu
 * vazifaga qo'yiladi), shuning uchun dars boshlanmagan bo'lsa buni ochiq
 * aytamiz va boshlash tugmasini beramiz.
 */

interface HomeworkItem {
  id: string;
  title: string;
  description: string | null;
  contentType: string;
  content: string;
}

interface LessonGroup {
  itemId: string;
  itemTitle: string;
  folderName: string;
  items: HomeworkItem[];
}

interface Course {
  id: string;
  name: string;
  count: number;
  lessons: LessonGroup[];
}

interface AssignOptions {
  sessionId: string;
  groupName: string;
  lessonNumber: number;
  topic: string | null;
  date: string;
  current: { assignmentId: string; homeworkId: string; title: string; note: string | null } | null;
  /** Faqat o'qituvchiga dostup berilgan kurslar */
  courses: Course[];
  lessons: LessonGroup[];
}

interface Props {
  groupId: string;
  /** Dars boshlanmagan bo'lsa baholash oynasini ochish uchun */
  onStartLesson?: () => void;
}

export default function HomeworkAssignCard({ groupId, onStartLesson }: Props) {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [isLessonDay, setIsLessonDay] = useState(true);
  const [opts, setOpts] = useState<AssignOptions | null>(null);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [openCourse, setOpenCourse] = useState<string | null>(null);

  /**
   * Qidiruv bo'yicha filtr. Bo'sh bo'lsa hamma kurs qaytadi (yopiq holatda),
   * matn kiritilsa faqat mos vazifalar qoladi va kurslar avtomatik ochiladi.
   */
  const visibleCourses = (() => {
    const q = search.trim().toLowerCase();
    if (!opts) return [];
    if (!q) return opts.courses;

    return opts.courses
      .map((c) => ({
        ...c,
        lessons: c.lessons
          .map((l) => ({
            ...l,
            items: l.items.filter(
              (hw) =>
                hw.title.toLowerCase().includes(q) ||
                (hw.description || '').toLowerCase().includes(q) ||
                l.itemTitle.toLowerCase().includes(q)
            ),
          }))
          .filter((l) => l.items.length > 0),
      }))
      .filter((c) => c.lessons.length > 0);
  })();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const today = await lessonSessionsApi.getToday(groupId);
      setIsLessonDay(today.data.data.isLessonDay);
      const session = today.data.data.session;

      if (!session) {
        setHasSession(false);
        setOpts(null);
        return;
      }
      setHasSession(true);
      const res = await homeworkApi.getAssignOptions(session.id);
      setOpts(res.data.data);
      setNote(res.data.data?.current?.note || '');
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const assign = async (homeworkId: string) => {
    if (!opts) return;
    setBusy(true);
    setError('');
    try {
      await homeworkApi.assign(opts.sessionId, homeworkId, note.trim() || undefined);
      setPicking(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Vazifa biriktirilmadi');
    } finally {
      setBusy(false);
    }
  };

  const unassign = async () => {
    if (!opts) return;
    setBusy(true);
    try {
      await homeworkApi.unassign(opts.sessionId);
      setPicking(false);
      await load();
    } catch {
      setError("Vazifani olib tashlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-white font-bold">Bugungi uyga vazifa</h3>
            <p className="text-zinc-500 text-sm">
              {opts
                ? `${opts.lessonNumber}-dars${opts.topic ? ` · ${opts.topic}` : ''} — keyingi darsda shu vazifani baholaysiz`
                : 'Bugun bergan vazifangizni keyingi darsda baholaysiz'}
            </p>
          </div>
        </div>

        {hasSession && !picking && (
          <button
            onClick={() => setPicking(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shrink-0"
          >
            {opts?.current ? "O'zgartirish" : 'Vazifa biriktirish'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
        </div>
      ) : !hasSession ? (
        /* Dars boshlanmagan — vazifa dars sessiyasiga bog'lanadi */
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-amber-200/90 text-sm">
              {isLessonDay
                ? "Uyga vazifa berish uchun avval bugungi darsni boshlang — vazifa o'sha darsga biriktiriladi va keyingi darsda aynan shu vazifa baholanadi."
                : 'Bugun bu guruhda dars kuni emas. Uyga vazifa dars kuni beriladi.'}
            </p>
            {isLessonDay && onStartLesson && (
              <button
                onClick={onStartLesson}
                className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <PlayCircle className="w-4 h-4" />
                Darsni boshlash
              </button>
            )}
          </div>
        </div>
      ) : picking ? (
        /* Vazifa tanlash — kurslar bo'yicha, qidiruv bilan */
        <div className="space-y-3">
          {(opts?.courses.length ?? 0) === 0 ? (
            <p className="text-amber-300/90 text-sm bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2.5">
              Sizga dostup berilgan kurslarda uyga vazifa topilmadi. Administrator
              darsliklarga vazifa qo'shishi yoki sizga kursga dostup berishi kerak.
            </p>
          ) : (
            <>
              {/* Qidiruv — 200+ vazifa orasidan tez topish uchun */}
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Vazifa yoki dars nomi bo'yicha qidirish..."
                  className="w-full bg-[#0f0f11] border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white"
                />
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {visibleCourses.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-6">
                    "{search}" bo'yicha hech narsa topilmadi
                  </p>
                ) : (
                  visibleCourses.map((course) => {
                    const isOpen = search.trim() !== '' || openCourse === course.id;
                    return (
                      <div key={course.id} className="border border-zinc-800 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setOpenCourse(isOpen && !search ? null : course.id)}
                          className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#0f0f11] hover:bg-white/[0.02] text-left"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                            )}
                            <FolderOpen className="w-4 h-4 text-blue-400 shrink-0" />
                            <span className="text-white text-sm font-semibold truncate">{course.name}</span>
                          </span>
                          <span className="text-zinc-500 text-xs shrink-0">
                            {course.lessons.reduce((n, l) => n + l.items.length, 0)} ta vazifa
                          </span>
                        </button>

                        {isOpen && (
                          <div className="p-2.5 space-y-2.5 border-t border-zinc-800">
                            {course.lessons.map((lesson) => (
                              <div key={lesson.itemId}>
                                <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1.5">
                                  {lesson.itemTitle}
                                </p>
                                <div className="space-y-1.5">
                                  {lesson.items.map((hw) => {
                                    const active = opts!.current?.homeworkId === hw.id;
                                    return (
                                      <button
                                        key={hw.id}
                                        disabled={busy}
                                        onClick={() => assign(hw.id)}
                                        className={`w-full text-left rounded-lg border px-3.5 py-2.5 transition-colors disabled:opacity-50 ${
                                          active
                                            ? 'bg-blue-600/15 border-blue-600 text-white'
                                            : 'bg-[#0f0f11] border-zinc-800 text-zinc-300 hover:border-blue-600'
                                        }`}
                                      >
                                        <span className="text-sm font-medium flex items-center gap-2">
                                          {hw.contentType === 'link' ? (
                                            <Link2 className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
                                          ) : (
                                            <FileText className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
                                          )}
                                          {hw.title}
                                        </span>
                                        {hw.description && (
                                          <span className="text-zinc-500 text-xs block mt-0.5 ml-5.5">
                                            {hw.description}
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                placeholder="Qo'shimcha izoh (ixtiyoriy) — masalan: faqat 1-5 misollar"
                className="w-full bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white"
              />
            </>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={() => setPicking(false)}
              className="text-zinc-400 hover:text-white text-sm"
            >
              Yopish
            </button>
            {opts?.current && (
              <button
                onClick={unassign}
                disabled={busy}
                className="text-red-400 hover:text-red-300 text-sm disabled:opacity-50"
              >
                Vazifani olib tashlash
              </button>
            )}
          </div>
        </div>
      ) : opts?.current ? (
        /* Biriktirilgan vazifa */
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-emerald-300 font-medium flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            {opts.current.title}
          </p>
          {opts.current.note && (
            <p className="text-zinc-400 text-sm mt-1.5 pl-6">Izoh: {opts.current.note}</p>
          )}
          <p className="text-zinc-500 text-xs mt-2 pl-6">
            O'quvchilar buni profilidagi "Uyga vazifalar" bo'limida ko'radi
          </p>
        </div>
      ) : (
        /* Hali tanlanmagan */
        <div className="bg-[#0f0f11] border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-3">
          <p className="text-zinc-500 text-sm flex items-center gap-2">
            <X className="w-4 h-4 shrink-0" />
            Bugungi darsga hali vazifa biriktirilmagan
          </p>
        </div>
      )}
    </div>
  );
}
