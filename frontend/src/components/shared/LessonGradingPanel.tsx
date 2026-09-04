import { useEffect, useRef, useState } from 'react';
import { X, Play, CheckCircle2, Clock, Users, Lock, AlertTriangle, Coins } from 'lucide-react';
import { lessonSessionsApi } from '@/api';

type HomeworkGrade = 'toliq' | 'qisman' | 'bajarmagan' | 'kelmadi';

interface GradeRow {
  id: string;
  studentId: string;
  homework: HomeworkGrade | null;
  homeworkScore: number | null;
  activityScore: number | null;
  coinAwarded: number | null;
  student: { id: string; fullName: string; avatarUrl?: string | null };
}

interface Session {
  id: string;
  status: 'ochiq' | 'yakunlandi' | 'avto_yopildi';
  startedAt: string;
  deadlineAt: string;
  grades: GradeRow[];
  group: { id: string; name: string };
}

interface Props {
  groupId: string;
  groupName: string;
  onClose: () => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LessonGradingPanel({ groupId, groupName, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isLessonDay, setIsLessonDay] = useState(true);
  const [lessonDayType, setLessonDayType] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [step, setStep] = useState<'homework' | 'activity' | 'coin'>('homework');
  const [coinDrafts, setCoinDrafts] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await lessonSessionsApi.getToday(groupId);
      setIsLessonDay(res.data.data.isLessonDay);
      setLessonDayType(res.data.data.lessonDayType);
      setSession(res.data.data.session);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleStart = async () => {
    setStarting(true);
    setError('');
    try {
      const res = await lessonSessionsApi.start(groupId);
      setSession(res.data.data);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || "Darsni boshlab bo'lmadi");
    } finally {
      setStarting(false);
    }
  };

  const setLocalGrade = (studentId: string, patch: Partial<GradeRow>) => {
    setSession((prev) =>
      prev
        ? { ...prev, grades: prev.grades.map((g) => (g.studentId === studentId ? { ...g, ...patch } : g)) }
        : prev
    );
  };

  const handleHomework = async (studentId: string, homework: HomeworkGrade) => {
    if (!session || busyRef.current.has(studentId)) return;
    busyRef.current.add(studentId);
    const scoreMap: Record<HomeworkGrade, number | null> = { toliq: 5, qisman: 3, bajarmagan: 0, kelmadi: null };
    setLocalGrade(studentId, { homework, homeworkScore: scoreMap[homework] });
    try {
      await lessonSessionsApi.gradeHomework(session.id, studentId, homework);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Baholashda xatolik — qayta urinib ko'ring");
      load();
    } finally {
      busyRef.current.delete(studentId);
    }
  };

  const handleActivity = async (studentId: string, activityScore: number) => {
    if (!session || busyRef.current.has(studentId)) return;
    busyRef.current.add(studentId);
    setLocalGrade(studentId, { activityScore });
    try {
      await lessonSessionsApi.gradeActivity(session.id, studentId, activityScore);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Baholashda xatolik — qayta urinib ko'ring");
      load();
    } finally {
      busyRef.current.delete(studentId);
    }
  };

  const handleCoin = async (studentId: string, amount: number) => {
    if (!session || busyRef.current.has(studentId) || Number.isNaN(amount) || amount < 0) return;
    busyRef.current.add(studentId);
    setLocalGrade(studentId, { coinAwarded: amount });
    try {
      await lessonSessionsApi.gradeCoin(session.id, studentId, amount);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || "Coin berishda xatolik — qayta urinib ko'ring");
      load();
    } finally {
      busyRef.current.delete(studentId);
    }
  };

  const handleFinalize = async () => {
    if (!session) return;
    const ungraded = session.grades.filter((g) => !g.homework).length;
    if (ungraded > 0) {
      const ok = window.confirm(
        `${ungraded} ta o'quvchi hali baholanmagan. Yakunlasangiz ular avtomatik 0 ball oladi. Davom etasizmi?`
      );
      if (!ok) return;
    }
    setFinalizing(true);
    setError('');
    try {
      const res = await lessonSessionsApi.finalize(session.id);
      setSession(res.data.data);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Yakunlashda xatolik");
    } finally {
      setFinalizing(false);
    }
  };

  const gradedHomeworkCount = session?.grades.filter((g) => g.homework).length || 0;
  const gradedActivityCount = session?.grades.filter((g) => g.activityScore !== null).length || 0;
  const total = session?.grades.length || 0;
  const deadlineMs = session ? new Date(session.deadlineAt).getTime() - now : 0;
  const isExpiredLocally = session?.status === 'ochiq' && deadlineMs <= 0;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#18181b] border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-white font-bold text-lg">Baholash — {groupName}</h2>
            {session?.status === 'ochiq' && !isExpiredLocally && (
              <div className="flex items-center gap-1.5 text-amber-400 text-sm mt-1 font-medium">
                <Clock className="w-4 h-4" />
                Qolgan vaqt: {formatCountdown(deadlineMs)}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="text-zinc-400 text-center py-12">Yuklanmoqda...</div>
          ) : error && !session ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <p className="text-zinc-300">{error}</p>
            </div>
          ) : !session ? (
            <div className="text-center py-10">
              <Users className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
              {isLessonDay ? (
                <>
                  <p className="text-zinc-300 mb-1">Bugungi dars uchun baholash boshlanmagan.</p>
                  <p className="text-zinc-500 text-sm mb-6">
                    Boshlagach 2 soat vaqt beriladi.
                  </p>
                  <button
                    onClick={handleStart}
                    disabled={starting}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto disabled:opacity-50"
                  >
                    <Play className="w-5 h-5" />
                    {starting ? 'Boshlanmoqda...' : 'Baholashni boshlash'}
                  </button>
                  {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
                </>
              ) : (
                <>
                  <p className="text-zinc-300 mb-1">Bugun bu guruhda dars kuni emas.</p>
                  <p className="text-zinc-500 text-sm">
                    {lessonDayType
                      ? `Guruh: ${lessonDayType === 'juft' ? 'juft kunlar' : lessonDayType === 'toq' ? 'toq kunlar' : 'har kuni'}`
                      : "Dars kuni belgilanmagan — administratordan so'rang."}
                  </p>
                </>
              )}
            </div>
          ) : session.status === 'avto_yopildi' ? (
            <div className="text-center py-12">
              <Lock className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-zinc-300 mb-1">Bu darsning baholash vaqti (2:00) tugab, avtomatik yopilgan.</p>
              <p className="text-zinc-500 text-sm">Qayta ochish uchun administratordan (Ravshan) ruxsat so'rang.</p>
            </div>
          ) : (
            <>
              {/* Step switch */}
              <div className="flex gap-2 mb-5">
                <button
                  onClick={() => setStep('homework')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    step === 'homework'
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-transparent border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  1. Uy vazifasi ({gradedHomeworkCount}/{total})
                </button>
                <button
                  onClick={() => setStep('activity')}
                  disabled={session.status !== 'ochiq'}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-40 ${
                    step === 'activity'
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-transparent border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  2. Faollik ({gradedActivityCount}/{total})
                </button>
                <button
                  onClick={() => setStep('coin')}
                  disabled={session.status !== 'ochiq'}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-40 ${
                    step === 'coin'
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-transparent border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  3. 🪙 Coin
                </button>
              </div>

              {error && (
                <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* Roster */}
              <div className="space-y-2">
                {session.grades.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-3 bg-[#0f0f11] border border-zinc-800 rounded-xl px-4 py-3"
                  >
                    <span className="text-white text-sm font-medium truncate">{g.student.fullName}</span>

                    {step === 'homework' ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          disabled={session.status !== 'ochiq'}
                          onClick={() => handleHomework(g.studentId, 'toliq')}
                          className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 ${
                            g.homework === 'toliq'
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-zinc-700 text-zinc-400 hover:border-emerald-600 hover:text-emerald-400'
                          }`}
                        >
                          ✅ 5
                        </button>
                        <button
                          disabled={session.status !== 'ochiq'}
                          onClick={() => handleHomework(g.studentId, 'qisman')}
                          className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 ${
                            g.homework === 'qisman'
                              ? 'bg-amber-600 border-amber-600 text-white'
                              : 'border-zinc-700 text-zinc-400 hover:border-amber-600 hover:text-amber-400'
                          }`}
                        >
                          🟡 3
                        </button>
                        <button
                          disabled={session.status !== 'ochiq'}
                          onClick={() => handleHomework(g.studentId, 'bajarmagan')}
                          className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 ${
                            g.homework === 'bajarmagan'
                              ? 'bg-red-600 border-red-600 text-white'
                              : 'border-zinc-700 text-zinc-400 hover:border-red-600 hover:text-red-400'
                          }`}
                        >
                          ❌ 0
                        </button>
                        <button
                          disabled={session.status !== 'ochiq'}
                          onClick={() => handleHomework(g.studentId, 'kelmadi')}
                          className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 ${
                            g.homework === 'kelmadi'
                              ? 'bg-zinc-600 border-zinc-500 text-white'
                              : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                          }`}
                        >
                          🚫
                        </button>
                      </div>
                    ) : step === 'activity' ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            disabled={session.status !== 'ochiq'}
                            onClick={() => handleActivity(g.studentId, n)}
                            className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 ${
                              g.activityScore === n
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-zinc-700 text-zinc-400 hover:border-blue-600 hover:text-blue-400'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min={0}
                          max={1000}
                          disabled={session.status !== 'ochiq'}
                          placeholder={String(g.coinAwarded ?? 0)}
                          value={coinDrafts[g.studentId] ?? ''}
                          onChange={(e) => setCoinDrafts((prev) => ({ ...prev, [g.studentId]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          onBlur={() => {
                            const raw = coinDrafts[g.studentId];
                            if (raw === undefined || raw === '') return;
                            const n = parseInt(raw, 10);
                            if (!Number.isNaN(n)) handleCoin(g.studentId, n);
                            setCoinDrafts((prev) => {
                              const next = { ...prev };
                              delete next[g.studentId];
                              return next;
                            });
                          }}
                          className="w-20 px-2.5 py-2 rounded-lg text-sm font-bold border border-zinc-700 bg-transparent text-white text-center disabled:opacity-40 focus:outline-none focus:border-amber-500"
                        />
                        {(g.coinAwarded ?? 0) > 0 && <span className="text-amber-400 text-xs font-bold">🪙</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {session && session.status === 'ochiq' && (
          <div className="px-6 py-4 border-t border-zinc-800 flex justify-end">
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              {finalizing ? 'Yakunlanmoqda...' : 'Yakunlash'}
            </button>
          </div>
        )}
        {session && session.status === 'yakunlandi' && (
          <div className="px-6 py-4 border-t border-zinc-800 text-center text-sm text-emerald-400 font-medium">
            ✅ Bu dars yakunlangan. Ota-onalarga 1 soatdan so'ng xabar ketadi.
          </div>
        )}
      </div>
    </div>
  );
}
