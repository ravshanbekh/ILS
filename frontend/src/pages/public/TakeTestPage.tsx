import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Clock, FileQuestion, User, Phone, AlertTriangle, CheckCircle2,
  XCircle, Loader2, ChevronLeft, ChevronRight, Send, Award, Timer,
} from 'lucide-react';
import {
  publicTestApi, testErrMsg,
  type PublicTestInfo, type PublicQuestion,
} from '../../api/publicTest';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

/** Urinish tokeni — sahifa yangilansa, test davom etsin. */
const tokenKey = (code: string) => `quiz-test-token:${code}`;

type Phase = 'loading' | 'intro' | 'running' | 'result' | 'error';

export default function TakeTestPage() {
  const { code = '' } = useParams<{ code: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [info, setInfo] = useState<PublicTestInfo | null>(null);

  // ── Kirish ──
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [starting, setStarting] = useState(false);

  // ── Test ──
  const [token, setToken] = useState('');
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, { selected?: number[]; textAnswer?: string }>>({});
  const [current, setCurrent] = useState(0);
  const [deadline, setDeadline] = useState<number>(0);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // ── Natija ──
  const [result, setResult] = useState<any>(null);

  const submittedRef = useRef(false);

  // ── Testni yuklash ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await publicTestApi.getTest(code);
        if (!alive) return;
        const data: PublicTestInfo = res.data.data;
        setInfo(data);

        // Tugallanmagan urinish bormi
        const saved = localStorage.getItem(tokenKey(code));
        if (saved) {
          try {
            const r = await publicTestApi.resume(saved);
            if (!alive) return;
            applyAttempt(r.data.data);
            setPhase('running');
            return;
          } catch (e: any) {
            // Yakunlangan bo'lsa natijani ko'rsatamiz
            if (e?.response?.status === 409 || e?.response?.status === 410) {
              try {
                const rr = await publicTestApi.getResult(saved);
                if (!alive) return;
                setResult(rr.data.data);
                setPhase('result');
                return;
              } catch {
                /* natija ham yo'q — oddiy kirishga tushamiz */
              }
            }
            localStorage.removeItem(tokenKey(code));
          }
        }

        setPhase('intro');
      } catch (e: any) {
        if (!alive) return;
        setError(testErrMsg(e, 'Test topilmadi'));
        setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const applyAttempt = (payload: any) => {
    setToken(payload.attempt.token);
    localStorage.setItem(tokenKey(code), payload.attempt.token);
    setQuestions(payload.questions);
    setDeadline(new Date(payload.attempt.deadlineAt).getTime());

    const restored: Record<string, any> = {};
    (payload.savedAnswers ?? []).forEach((a: any) => {
      restored[a.questionId] = {
        selected: a.selected ?? undefined,
        textAnswer: a.textAnswer ?? undefined,
      };
    });
    setAnswers(restored);
  };

  // ── Taymer ──
  useEffect(() => {
    if (phase !== 'running' || !deadline) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !submittedRef.current) {
        submittedRef.current = true;
        doSubmit(true);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deadline]);

  // ── Boshlash ──
  const start = async () => {
    if (fullName.trim().length < 3) {
      alert('Ism-familiyangizni to\'liq yozing');
      return;
    }
    if (info?.requirePhone && phone.trim().length < 7) {
      alert('Telefon raqamingizni yozing');
      return;
    }
    setStarting(true);
    try {
      const res = await publicTestApi.start(code, {
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
      });
      applyAttempt(res.data.data);
      submittedRef.current = false;
      setPhase('running');
    } catch (e: any) {
      alert(testErrMsg(e, 'Testni boshlab bo\'lmadi'));
      setStarting(false);
    }
  };

  // ── Javob saqlash ──
  const saveAnswer = useCallback(
    async (questionId: string, value: { selected?: number[]; textAnswer?: string }) => {
      setSaving((p) => ({ ...p, [questionId]: true }));
      try {
        await publicTestApi.saveAnswer(token, { questionId, ...value });
      } catch (e: any) {
        if (e?.response?.status === 410) {
          // vaqt tugadi
          if (!submittedRef.current) {
            submittedRef.current = true;
            doSubmit(true);
          }
        }
      } finally {
        setSaving((p) => ({ ...p, [questionId]: false }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token]
  );

  const pickOption = (q: PublicQuestion, index: number) => {
    // Bitta to'g'ri javobli savolda ham ko'p tanlashga ruxsat beramiz —
    // mentor bir nechta to'g'ri javob qo'ygan bo'lishi mumkin.
    const prev = answers[q.id]?.selected ?? [];
    const next = prev.includes(index)
      ? prev.filter((i) => i !== index)
      : [...prev, index].sort((a, b) => a - b);
    setAnswers((p) => ({ ...p, [q.id]: { selected: next } }));
    saveAnswer(q.id, { selected: next });
  };

  // Ochiq javob — yozishni to'xtatgandan keyin saqlaymiz
  const textTimers = useRef<Record<string, any>>({});
  const typeAnswer = (q: PublicQuestion, value: string) => {
    setAnswers((p) => ({ ...p, [q.id]: { textAnswer: value } }));
    clearTimeout(textTimers.current[q.id]);
    textTimers.current[q.id] = setTimeout(() => {
      saveAnswer(q.id, { textAnswer: value });
    }, 700);
  };

  // ── Yakunlash ──
  const doSubmit = async (auto = false) => {
    if (submitting) return;
    if (!auto) {
      const unanswered = questions.filter((q) => {
        const a = answers[q.id];
        if (!a) return true;
        if (q.type === 'open') return !a.textAnswer?.trim();
        return !a.selected || a.selected.length === 0;
      });
      const msg = unanswered.length
        ? `${unanswered.length} ta savolga javob bermadingiz. Baribir yakunlansinmi?`
        : 'Testni yakunlaysizmi?';
      if (!confirm(msg)) return;
    }

    setSubmitting(true);
    try {
      // Yozilayotgan ochiq javoblar yo'qolmasin
      Object.values(textTimers.current).forEach(clearTimeout);
      await Promise.all(
        questions
          .filter((q) => q.type === 'open' && answers[q.id]?.textAnswer)
          .map((q) =>
            publicTestApi
              .saveAnswer(token, { questionId: q.id, textAnswer: answers[q.id].textAnswer })
              .catch(() => {})
          )
      );

      const res = await publicTestApi.submit(token);
      setResult(res.data.data);
      setPhase('result');
      localStorage.removeItem(tokenKey(code));
    } catch (e: any) {
      alert(testErrMsg(e, 'Yakunlashda xatolik'));
      setSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  KO'RINISH
  // ═══════════════════════════════════════════════════════════════════════

  if (phase === 'loading') {
    return (
      <Shell>
        <div className="flex flex-col items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="mt-3 text-sm text-zinc-400">Yuklanmoqda...</p>
        </div>
      </Shell>
    );
  }

  if (phase === 'error') {
    return (
      <Shell>
        <div className="py-12 text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-400" />
          <h1 className="mt-4 text-xl font-bold text-zinc-50">Test ochilmadi</h1>
          <p className="mt-2 text-zinc-400">{error}</p>
        </div>
      </Shell>
    );
  }

  // ── Kirish ekrani ──
  if (phase === 'intro' && info) {
    return (
      <Shell>
        <div className="py-6">
          <h1 className="text-2xl font-bold text-zinc-50">{info.title}</h1>
          {info.createdBy && (
            <p className="mt-1 text-sm text-zinc-400">{info.createdBy.fullName}</p>
          )}

          {info.blocked ? (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-900 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="font-medium text-amber-400">Hozir ishlab bo'lmaydi</p>
                <p className="mt-0.5 text-sm text-amber-400">{info.blocked}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <InfoBox Icon={FileQuestion} label="Savollar" value={`${info.questionCount} ta`} />
                <InfoBox Icon={Clock} label="Vaqt" value={`${info.durationMin} daq`} />
                {info.passPercent !== null && (
                  <InfoBox Icon={Award} label="O'tish" value={`${info.passPercent}%`} />
                )}
              </div>

              {(info.closedShown > 0 || info.openShown > 0) && (
                <p className="mt-2 text-xs text-zinc-500">
                  {info.closedShown > 0 && `${info.closedShown} ta variantli`}
                  {info.closedShown > 0 && info.openShown > 0 && ' · '}
                  {info.openShown > 0 && `${info.openShown} ta ochiq savol`}
                </p>
              )}

              {info.description && (
                <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-800/50 p-4">
                  <p className="mb-1.5 text-sm font-semibold text-zinc-200">Shartlar</p>
                  <p className="whitespace-pre-wrap text-sm text-zinc-300">{info.description}</p>
                </div>
              )}

              <div className="mt-6 space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                    Ism va familiyangiz <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      autoFocus
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && start()}
                      placeholder="Masalan: Alisher Karimov"
                      className="w-full rounded-lg border border-zinc-800 py-3 pl-9 pr-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/25"
                    />
                  </div>
                </div>

                {info.requirePhone && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                      Telefon raqam <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && start()}
                        placeholder="+998 90 123 45 67"
                        className="w-full rounded-lg border border-zinc-800 py-3 pl-9 pr-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/25"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={start}
                disabled={starting}
                className="mt-5 w-full rounded-xl bg-indigo-600 py-3.5 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {starting ? 'Boshlanmoqda...' : 'Testni boshlash'}
              </button>

              <p className="mt-3 text-center text-xs text-zinc-500">
                Boshlaganingizdan so'ng taymer ishga tushadi va to'xtamaydi
              </p>
            </>
          )}
        </div>
      </Shell>
    );
  }

  // ── Test jarayoni ──
  if (phase === 'running') {
    const q = questions[current];
    const answered = questions.filter((qq) => {
      const a = answers[qq.id];
      if (!a) return false;
      if (qq.type === 'open') return !!a.textAnswer?.trim();
      return !!a.selected?.length;
    }).length;

    const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    const low = remaining < 60;

    return (
      <Shell wide>
        {/* Yuqori panel */}
        <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-100">{info?.title}</p>
              <p className="text-xs text-zinc-400">
                {answered} / {questions.length} javob berildi
              </p>
            </div>
            <div
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm font-bold ${
                low ? 'animate-pulse bg-red-900 text-red-400' : 'bg-zinc-800 text-zinc-200'
              }`}
            >
              <Timer className="h-4 w-4" />
              {mm}:{ss}
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${(answered / Math.max(1, questions.length)) * 100}%` }}
            />
          </div>
        </div>

        {/* Savol raqamlari */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {questions.map((qq, i) => {
            const a = answers[qq.id];
            const done = qq.type === 'open' ? !!a?.textAnswer?.trim() : !!a?.selected?.length;
            return (
              <button
                key={qq.id}
                onClick={() => setCurrent(i)}
                className={`h-8 w-8 rounded-lg text-xs font-semibold transition ${
                  i === current
                    ? 'bg-indigo-600 text-white'
                    : done
                    ? 'bg-emerald-900 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Savol */}
        {q && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>{current + 1}-savol</span>
              <span>·</span>
              <span>{q.points} ball</span>
              <span>·</span>
              <span>{q.type === 'open' ? 'javobni yozing' : 'variantni tanlang'}</span>
              {saving[q.id] && (
                <span className="ml-auto inline-flex items-center gap-1 text-indigo-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> saqlanmoqda
                </span>
              )}
            </div>

            <p className="mt-2 whitespace-pre-wrap text-lg font-medium text-zinc-50">{q.text}</p>

            {q.imageUrl && (
              <img
                src={`${API_BASE}${q.imageUrl}`}
                alt=""
                className="mt-3 max-h-80 w-full rounded-lg border border-zinc-800 object-contain"
              />
            )}

            {q.type === 'closed' && q.options && (
              <div className="mt-4 space-y-2">
                {q.options.map((o, i) => {
                  const on = answers[q.id]?.selected?.includes(i) ?? false;
                  return (
                    <button
                      key={i}
                      onClick={() => pickOption(q, i)}
                      className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                        on
                          ? 'border-indigo-500 bg-indigo-900'
                          : 'border-zinc-800 hover:border-indigo-500/40 hover:bg-zinc-800/50'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-xs font-bold ${
                          on
                            ? 'border-indigo-500 bg-indigo-500 text-white'
                            : 'border-zinc-700 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span className="text-zinc-100">{o}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === 'open' && (
              <textarea
                value={answers[q.id]?.textAnswer ?? ''}
                onChange={(e) => typeAnswer(q, e.target.value)}
                rows={5}
                placeholder="Javobingizni shu yerga yozing"
                className="mt-4 w-full resize-none rounded-xl border-2 border-zinc-800 px-4 py-3 outline-none focus:border-indigo-400"
              />
            )}
          </div>
        )}

        {/* Navigatsiya */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800/50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Oldingi
          </button>

          {current < questions.length - 1 ? (
            <button
              onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
            >
              Keyingi <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => doSubmit(false)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Yuborilmoqda...' : 'Testni yakunlash'}
            </button>
          )}
        </div>

        {current < questions.length - 1 && (
          <button
            onClick={() => doSubmit(false)}
            disabled={submitting}
            className="mt-3 w-full rounded-lg border border-emerald-500/40 bg-emerald-900 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-900 disabled:opacity-60"
          >
            Testni hozir yakunlash
          </button>
        )}
      </Shell>
    );
  }

  // ── Natija ──
  if (phase === 'result' && result) {
    return (
      <Shell>
        <div className="py-8 text-center">
          {result.hidden ? (
            <>
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
              <h1 className="mt-4 text-2xl font-bold text-zinc-50">Javoblaringiz qabul qilindi</h1>
              <p className="mt-2 text-zinc-400">
                Natija mentor tomonidan ko'rib chiqiladi
              </p>
            </>
          ) : (
            <>
              <div
                className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full ${
                  result.passed === true
                    ? 'bg-emerald-900'
                    : result.passed === false
                    ? 'bg-red-900'
                    : 'bg-indigo-900'
                }`}
              >
                <span
                  className={`text-3xl font-bold ${
                    result.passed === true
                      ? 'text-emerald-400'
                      : result.passed === false
                      ? 'text-red-400'
                      : 'text-indigo-400'
                  }`}
                >
                  {result.percent}%
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-bold text-zinc-50">
                {result.passed === true
                  ? 'Tabriklaymiz!'
                  : result.passed === false
                  ? "Natija yetarli emas"
                  : 'Test yakunlandi'}
              </h1>

              <p className="mt-2 text-zinc-300">
                {result.score} / {result.maxScore} ball
                {result.correctCount !== null && (
                  <> · {result.correctCount} ta to'g'ri javob</>
                )}
              </p>

              {result.needsReview && (
                <div className="mx-auto mt-4 max-w-sm rounded-xl border border-violet-500/40 bg-violet-900 p-3 text-sm text-violet-400">
                  Ochiq savollaringiz mentor tomonidan tekshiriladi — yakuniy ball
                  o'zgarishi mumkin
                </div>
              )}

              {result.review && (
                <div className="mt-8 space-y-3 text-left">
                  <h2 className="font-semibold text-zinc-100">Javoblaringiz</h2>
                  {result.review.map((r: any, i: number) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-4 ${
                        r.needsReview
                          ? 'border-violet-500/40 bg-violet-900'
                          : r.isCorrect
                          ? 'border-emerald-500/40 bg-emerald-900'
                          : 'border-red-500/40 bg-red-900'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-zinc-400">{i + 1}.</span>
                        <p className="flex-1 text-sm font-medium text-zinc-100">{r.text}</p>
                        <span className="text-xs text-zinc-400">
                          {r.points}/{r.maxPoints}
                        </span>
                      </div>

                      {r.type === 'closed' && r.options && (
                        <ul className="mt-2 space-y-1 pl-6">
                          {(r.options as string[]).map((o, oi) => {
                            const isCorrect = (r.correctIndexes ?? []).includes(oi);
                            const isGiven = (r.given?.selected ?? []).includes(oi);
                            return (
                              <li
                                key={oi}
                                className={`text-sm ${
                                  isCorrect
                                    ? 'font-semibold text-emerald-400'
                                    : isGiven
                                    ? 'text-red-400 line-through'
                                    : 'text-zinc-400'
                                }`}
                              >
                                {isGiven ? '▸ ' : '   '}
                                {o}
                                {isCorrect && ' ✓'}
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {r.type === 'open' && (
                        <div className="mt-2 pl-6 text-sm">
                          <p className="text-zinc-100">
                            <span className="text-zinc-500">Siz: </span>
                            {r.given?.textAnswer || <i className="text-zinc-500">bo'sh</i>}
                          </p>
                          {r.acceptedAnswers && (r.acceptedAnswers as string[]).length > 0 && (
                            <p className="mt-0.5 text-zinc-400">
                              <span className="text-zinc-500">Kutilgan: </span>
                              {(r.acceptedAnswers as string[]).join(' / ')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <p className="mt-8 text-sm text-zinc-500">
            {result.fullName} · {result.testTitle}
          </p>
        </div>
      </Shell>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-zinc-800/50">
      <div className={`mx-auto px-4 py-6 sm:px-6 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="rounded-2xl bg-zinc-900 p-5 shadow-sm sm:p-7">{children}</div>
      </div>
    </div>
  );
}

function InfoBox({
  Icon,
  label,
  value,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-800/50 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-zinc-500" />
      <div className="mt-1 text-xs text-zinc-400">{label}</div>
      <div className="font-semibold text-zinc-100">{value}</div>
    </div>
  );
}
