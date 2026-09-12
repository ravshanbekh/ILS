import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { homeworkApi } from '@/api';
import {
  Loader2,
  BookOpen,
  Link2,
  CalendarDays,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  MessageSquare,
} from 'lucide-react';

interface HomeworkRow {
  assignmentId: string;
  title: string;
  description: string | null;
  contentType: string;
  content: string;
  lessonItemTitle: string;
  note: string | null;
  groupName: string;
  lessonNumber: number | null;
  topic: string | null;
  assignedDate: string;
  grade: 'toliq' | 'qisman' | 'bajarmagan' | 'kelmadi' | null;
  score: number | null;
  comment: string | null;
  gradedAt: string | null;
}

const GRADE_LABEL: Record<string, string> = {
  toliq: "To'liq bajarilgan",
  qisman: 'Qisman bajarilgan',
  bajarmagan: 'Bajarilmagan',
  kelmadi: 'Darsga kelmagan',
};

function GradeBadge({ grade, score }: { grade: string | null; score: number | null }) {
  if (!grade) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border text-blue-400 bg-blue-500/10 border-blue-500/20">
        <Clock className="w-3 h-3" /> Baholanmagan
      </span>
    );
  }
  const style =
    grade === 'toliq'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : grade === 'qisman'
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : grade === 'bajarmagan'
      ? 'text-red-400 bg-red-500/10 border-red-500/20'
      : 'text-zinc-400 bg-zinc-500/10 border-zinc-700';
  const Icon = grade === 'toliq' ? CheckCircle2 : grade === 'qisman' ? MinusCircle : XCircle;

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border ${style}`}>
      <Icon className="w-3 h-3" />
      {GRADE_LABEL[grade]}
      {score !== null && <span className="opacity-80">· {score} ball</span>}
    </span>
  );
}

/** Vazifa mazmuni — havola bo'lsa bosiladigan, matn bo'lsa o'qiladigan */
function HomeworkContent({ row }: { row: HomeworkRow }) {
  if (row.contentType === 'link') {
    return (
      <a
        href={row.content}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm break-all"
      >
        <Link2 className="w-3.5 h-3.5 shrink-0" />
        {row.content}
      </a>
    );
  }
  return <p className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{row.content}</p>;
}

export default function HomeworkPage() {
  const [current, setCurrent] = useState<HomeworkRow | null>(null);
  const [history, setHistory] = useState<HomeworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await homeworkApi.getMine();
        setCurrent(res.data.data.current);
        setHistory(res.data.data.history || []);
      } catch (e: any) {
        setError(
          e?.response?.data?.error?.message || e?.response?.data?.message || 'Ma\'lumotni olishda xatolik'
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Joriy vazifa tarixda ham bor — takrorlanmasligi uchun ajratamiz
  const past = history.filter((h) => h.assignmentId !== current?.assignmentId);

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header title="Uyga vazifalar" subtitle="Joriy vazifa va barcha oldingi vazifalar baholari bilan" />

      <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
            <BookOpen className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">Hali uyga vazifa berilmagan</p>
            <p className="text-zinc-600 text-xs mt-1">
              O'qituvchi dars oxirida vazifa bergach shu yerda ko'rinadi
            </p>
          </div>
        ) : (
          <>
            {/* Joriy vazifa */}
            {current && (
              <section>
                <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-wide mb-2">
                  Bajarish kerak
                </h2>
                <div className="bg-zinc-900 border border-blue-500/30 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-white font-bold">{current.title}</h3>
                      <p className="text-zinc-500 text-xs mt-1">
                        {current.lessonNumber !== null && `${current.lessonNumber}-dars`}
                        {current.topic && ` · ${current.topic}`}
                        {` · ${current.assignedDate}`}
                      </p>
                    </div>
                    <GradeBadge grade={current.grade} score={current.score} />
                  </div>

                  {current.description && (
                    <p className="text-zinc-400 text-sm mb-3">{current.description}</p>
                  )}

                  <div className="bg-[#0f0f11] border border-zinc-800 rounded-lg p-3.5">
                    <HomeworkContent row={current} />
                  </div>

                  {current.note && (
                    <div className="mt-3 flex gap-2 text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        <span className="font-semibold">O'qituvchi izohi:</span> {current.note}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Tarix */}
            {past.length > 0 && (
              <section>
                <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-wide mb-2">
                  Oldingi vazifalar ({past.length})
                </h2>
                <div className="space-y-3">
                  {past.map((row) => (
                    <div key={row.assignmentId} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <h3 className="text-white font-semibold text-sm">{row.title}</h3>
                          <p className="text-zinc-500 text-xs mt-0.5 flex items-center gap-1 flex-wrap">
                            <CalendarDays className="w-3 h-3" />
                            {row.lessonNumber !== null && `${row.lessonNumber}-dars`}
                            {row.topic && ` · ${row.topic}`}
                            {` · ${row.assignedDate}`}
                          </p>
                        </div>
                        <GradeBadge grade={row.grade} score={row.score} />
                      </div>

                      <div className="bg-[#0f0f11] border border-zinc-800 rounded-lg p-3 mt-2">
                        <HomeworkContent row={row} />
                      </div>

                      {row.comment && (
                        <p className="text-zinc-400 text-xs mt-2">
                          <span className="text-zinc-500">O'qituvchi izohi:</span> {row.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
