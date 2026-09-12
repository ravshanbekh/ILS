import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { examApi, homeworkApi } from '@/api';
import {
  Loader2,
  Trophy,
  BookOpen,
  PlayCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface ActiveExam {
  id: string;
  title: string;
  description: string | null;
  expiresAt: string;
  testCount: number;
  myStatus: string | null;
  canEnter: boolean;
}

interface ExamResult {
  participantId: string;
  title: string;
  attemptNumber: number;
  submittedAt: string | null;
  testScore: number | null;
  correctCount: number | null;
  testCount: number;
  maxTestScore: number;
  step2Name: string;
  aiScore: number | null;
  maxAiScore: number;
  aiComment: string | null;
  step3Name: string;
  projectScore: number | null;
  maxProjectScore: number;
  projectComment: string | null;
  totalScore: number | null;
  maxTotal: number;
}

interface HomeworkRow {
  assignmentId: string;
  title: string;
  lessonNumber: number | null;
  topic: string | null;
  assignedDate: string;
  grade: string | null;
  score: number | null;
  comment: string | null;
}

const HW_LABEL: Record<string, string> = {
  toliq: "To'liq",
  qisman: 'Qisman',
  bajarmagan: 'Bajarmagan',
  kelmadi: 'Kelmagan',
};

function hwStyle(grade: string | null) {
  if (!grade) return { cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20', Icon: Clock, text: 'Kutilmoqda' };
  if (grade === 'toliq') return { cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2, text: HW_LABEL[grade] };
  if (grade === 'qisman') return { cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20', Icon: MinusCircle, text: HW_LABEL[grade] };
  if (grade === 'bajarmagan') return { cls: 'text-red-400 bg-red-500/10 border-red-500/20', Icon: XCircle, text: HW_LABEL[grade] };
  return { cls: 'text-zinc-400 bg-zinc-500/10 border-zinc-700', Icon: XCircle, text: HW_LABEL[grade] };
}

/** Ball chizig'i — nechtadan nechta olingani ko'rinib tursin */
function ScoreBar({ score, max, label }: { score: number | null; max: number; label: string }) {
  const pct = score !== null && max > 0 ? Math.round((score / max) * 100) : 0;
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-white font-semibold tabular-nums">
          {score ?? '—'} <span className="text-zinc-600">/ {max}</span>
        </span>
      </div>
      <div className="h-1.5 bg-[#0f0f11] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState<ActiveExam[]>([]);
  const [exams, setExams] = useState<ExamResult[]>([]);
  const [homework, setHomework] = useState<HomeworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entering, setEntering] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, r, h] = await Promise.allSettled([
          examApi.getMyActive(),
          examApi.getMyResults(),
          homeworkApi.getMine(),
        ]);
        if (a.status === 'fulfilled') setActive(a.value.data.data || []);
        if (r.status === 'fulfilled') setExams(r.value.data.data || []);
        if (h.status === 'fulfilled') setHomework(h.value.data.data.history || []);
      } catch (e: any) {
        setError(e?.response?.data?.error?.message || 'Ma\'lumotni olishda xatolik');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const enterExam = async (exam: ActiveExam) => {
    setEntering(exam.id);
    setError(null);
    try {
      const res = await examApi.enter(exam.id);
      navigate(`/exam/${res.data.data.accessCode}`);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Imtihonga kirib bo\'lmadi');
      setEntering(null);
    }
  };

  const gradedHw = homework.filter((h) => h.grade !== null);
  const avgHw =
    gradedHw.length > 0
      ? (gradedHw.reduce((s, h) => s + (h.score ?? 0), 0) / gradedHw.length).toFixed(1)
      : null;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header title="Natijalarim" subtitle="Imtihon ballari va uyga vazifa baholari" />

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
        ) : (
          <>
            {/* Hozir topshirish mumkin bo'lgan imtihon */}
            {active.length > 0 && (
              <section>
                <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-wide mb-2">
                  Hozir topshirish mumkin
                </h2>
                <div className="space-y-3">
                  {active.map((ex) => (
                    <div key={ex.id} className="bg-zinc-900 border border-emerald-500/30 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-white font-bold">{ex.title}</h3>
                          {ex.description && (
                            <p className="text-zinc-400 text-sm mt-1">{ex.description}</p>
                          )}
                          <p className="text-zinc-500 text-xs mt-1.5">
                            {ex.testCount} ta test · tugash vaqti:{' '}
                            {new Date(ex.expiresAt).toLocaleString('uz-UZ', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        {ex.canEnter ? (
                          <button
                            onClick={() => enterExam(ex)}
                            disabled={entering === ex.id}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shrink-0"
                          >
                            {entering === ex.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <PlayCircle className="w-4 h-4" />
                            )}
                            {ex.myStatus === 'in_progress' ? 'Davom etish' : 'Kirish'}
                          </button>
                        ) : (
                          <span className="text-zinc-500 text-xs shrink-0 px-3 py-2">Topshirilgan</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Imtihon natijalari */}
            <section>
              <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Imtihon natijalari
              </h2>
              {exams.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                  <FileText className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">Hali imtihon topshirmagansiz</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {exams.map((r) => (
                    <div key={r.participantId} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <h3 className="text-white font-bold text-sm">{r.title}</h3>
                          <p className="text-zinc-500 text-xs mt-0.5">
                            {r.attemptNumber > 1 && `${r.attemptNumber}-urinish · `}
                            {r.submittedAt
                              ? new Date(r.submittedAt).toLocaleDateString('uz-UZ')
                              : 'sana yo\'q'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold text-white tabular-nums leading-none">
                            {r.totalScore ?? '—'}
                          </p>
                          <p className="text-zinc-600 text-[11px] mt-0.5">/ {r.maxTotal} ball</p>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <ScoreBar
                          score={r.testScore}
                          max={r.maxTestScore}
                          label={`Test${r.correctCount !== null ? ` (${r.correctCount}/${r.testCount} to'g'ri)` : ''}`}
                        />
                        <ScoreBar score={r.aiScore} max={r.maxAiScore} label={r.step2Name} />
                        <ScoreBar score={r.projectScore} max={r.maxProjectScore} label={r.step3Name} />
                      </div>

                      {(r.aiComment || r.projectComment) && (
                        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-1.5">
                          {r.aiComment && (
                            <p className="text-zinc-400 text-xs">
                              <span className="text-zinc-500">{r.step2Name}:</span> {r.aiComment}
                            </p>
                          )}
                          {r.projectComment && (
                            <p className="text-zinc-400 text-xs">
                              <span className="text-zinc-500">{r.step3Name}:</span> {r.projectComment}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Uyga vazifa baholari */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> Uyga vazifa baholari
                </h2>
                {avgHw && (
                  <span className="text-zinc-500 text-xs">
                    O'rtacha: <span className="text-white font-semibold">{avgHw}</span> / 5
                  </span>
                )}
              </div>

              {homework.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                  <BookOpen className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">Hali uyga vazifa berilmagan</p>
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-900">
                  {homework.map((h) => {
                    const st = hwStyle(h.grade);
                    return (
                      <div key={h.assignmentId} className="px-5 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{h.title}</p>
                          <p className="text-zinc-500 text-xs mt-0.5">
                            {h.lessonNumber !== null && `${h.lessonNumber}-dars`}
                            {h.topic && ` · ${h.topic}`}
                            {` · ${h.assignedDate}`}
                          </p>
                          {h.comment && <p className="text-zinc-400 text-xs mt-1">{h.comment}</p>}
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border shrink-0 ${st.cls}`}
                        >
                          <st.Icon className="w-3 h-3" />
                          {st.text}
                          {h.score !== null && <span className="opacity-80">· {h.score}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {active.length === 0 && exams.length === 0 && homework.length === 0 && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-zinc-300 flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <p>
                  Bu yerda imtihon natijalaringiz va uyga vazifa baholaringiz to'planadi.
                  O'qituvchi imtihonni guruhingizga biriktirsa, shu yerda ko'rinadi.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
