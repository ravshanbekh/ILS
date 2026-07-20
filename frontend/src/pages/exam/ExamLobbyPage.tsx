import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examApi } from '../../api';

type Stage = 'lookup' | 'login' | 'test' | 'video' | 'done';

interface ExamInfo {
  id: string;
  title: string;
  accessCode: string;
  status: string;
  expiresAt: string;
  testCount: number;
  maxTestScore: number;
  maxAiScore: number;
  maxProjectScore: number;
  step2Name: string;
  step3Name: string;
  step2Type: string;
  step3Type: string;
  step2Desc: string;
  step3Desc: string;
  createdBy: { fullName: string };
  category?: { name: string };
}

interface Question {
  id: string;
  question: string;
  imageUrl?: string;
  options: string[];
  correct: number;
  order: number;
}

export default function ExamLobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>('lookup');
  const [examInfo, setExamInfo] = useState<ExamInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  // Exam session
  const [participantId, setParticipantId] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [student, setStudent] = useState<{ id: string; fullName: string } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  // Test answers
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [testDone, setTestDone] = useState(false);
  const [testResult, setTestResult] = useState<{ correct: number; total: number; testScore: number } | null>(null);

  // Video
  const [aiVideoUrl, setAiVideoUrl] = useState('');
  const [projectVideoUrl, setProjectVideoUrl] = useState('');
  const [step2Content, setStep2Content] = useState('');
  const [step3Content, setStep3Content] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Lookup exam on load
  useEffect(() => {
    if (code) lookupExam();
  }, [code]);

  // Timer
  useEffect(() => {
    if (stage !== 'test' || testDone) return;
    const totalTime = 30 * 60; // 30 daqiqa test uchun
    setTimeLeft(totalTime);
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); handleTimeOut(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [stage]);

  async function lookupExam() {
    setLoading(true); setError('');
    try {
      const res = await examApi.getByCode(code!);
      setExamInfo(res.data.data);
      setStage('login');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Imtihon topilmadi');
    } finally { setLoading(false); }
  }

  async function startExam() {
    if (!login || !password) return;
    setLoading(true); setError('');
    try {
      const res = await examApi.startExam(code!, { login, password });
      const { participant, questions: qs, sessionToken: token, student: st } = res.data.data;
      setParticipantId(participant.id);
      setSessionToken(token);
      setStudent(st);
      setQuestions(qs);
      setStage('test');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Xatolik yuz berdi');
    } finally { setLoading(false); }
  }

  function selectAnswer(questionId: string, optionIdx: number) {
    if (testDone) return;
    setAnswers(a => ({ ...a, [questionId]: optionIdx }));
    // Auto-next after short delay
    if (currentQ < questions.length - 1) {
      setTimeout(() => setCurrentQ(q => q + 1), 400);
    }
  }

  async function submitTest() {
    setLoading(true);
    try {
      const answerArr = questions.map(q => {
        const optIdx = answers[q.id];
        return {
          questionId: q.id,
          selectedOption: optIdx ?? -1,
          selectedText: optIdx !== undefined ? q.options[optIdx] : null,
        };
      });
      const res = await examApi.submitTest(code!, { participantId, sessionToken, answers: answerArr });
      setTestResult(res.data.data);
      setTestDone(true);
      setStage('video');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Xatolik');
    } finally { setLoading(false); }
  }

  async function handleTimeOut() {
    setTestDone(true);
    await submitTest();
  }

  async function submitVideos() {
    const s2Type = examInfo?.step2Type || 'link';
    const s3Type = examInfo?.step3Type || 'link';
    const s2Val = s2Type === 'link' ? aiVideoUrl : step2Content;
    const s3Val = s3Type === 'link' ? projectVideoUrl : step3Content;
    if (!s2Val || !s3Val) return;
    setSubmitting(true);
    try {
      await examApi.submitVideos(code!, {
        participantId,
        sessionToken,
        ...(s2Type === 'link' ? { aiVideoUrl } : { step2Content }),
        ...(s3Type === 'link' ? { projectVideoUrl } : { step3Content }),
      });
      setStage('done');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Xatolik');
    } finally { setSubmitting(false); }
  }

  const formatTime = (sec: number) => `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`;
  const progress = questions.length > 0 ? (currentQ / questions.length) * 100 : 0;
  const answered = Object.keys(answers).length;

  // ── Render stages ──────────────────────────────────────────────────────────

  if (loading && stage === 'lookup') return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="text-white text-lg animate-pulse">Imtihon qidirilmoqda...</div>
    </div>
  );

  if (stage === 'done') return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-[#09090b] to-blue-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-7xl mb-6 animate-bounce">🎉</div>
        <h1 className="text-3xl font-bold text-white mb-2">Imtihon topshirildi!</h1>
        <p className="text-zinc-400 mb-6">O'qituvchi videolaringizni tekshirib, ball qo'yadi.</p>
        {testResult && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 mb-6 text-left space-y-3">
            <div className="flex justify-between">
              <span className="text-zinc-400">Test natijasi:</span>
              <span className="text-white font-bold">{testResult.correct}/{testResult.total} to'g'ri</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Test bali:</span>
              <span className="text-blue-400 font-bold">{testResult.testScore}/40</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">AI video & Loyiha:</span>
              <span className="text-zinc-500">Tekshirilmoqda...</span>
            </div>
          </div>
        )}
        <p className="text-zinc-500 text-sm">Siz sahifani yopishingiz mumkin.</p>
      </div>
    </div>
  );

  if (stage === 'video') {
    const s2Type = examInfo?.step2Type || 'link';
    const s3Type = examInfo?.step3Type || 'link';
    const s2Val = s2Type === 'link' ? aiVideoUrl : step2Content;
    const s3Val = s3Type === 'link' ? projectVideoUrl : step3Content;
    const canSubmit = !submitting && !!s2Val.trim() && !!s3Val.trim();

    return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-[#09090b] to-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {testResult && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6 text-center">
            <div className="text-3xl font-bold text-emerald-400">{testResult.testScore}/40</div>
            <div className="text-sm text-emerald-300">{testResult.correct}/{testResult.total} to'g'ri javob</div>
          </div>
        )}

        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-1">📋 Topshiriqlar</h2>
          <p className="text-zinc-400 text-sm mb-6">Har bir bosqich uchun topshiring</p>

          {/* Stage 2: Dynamic */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 bg-purple-500 rounded-full text-white text-xs flex items-center justify-center font-bold">2</span>
              <label className="text-white font-medium">{examInfo?.step2Name || 'AI video linki'}</label>
              <span className="ml-auto text-xs text-zinc-400">max 20 ball</span>
            </div>
            {examInfo?.step2Desc && (
              <p className="text-zinc-400 text-xs mb-2 pl-8 italic">{examInfo.step2Desc}</p>
            )}
            {s2Type === 'link' ? (
              <>
                <input
                  type="url"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-purple-500 outline-none transition"
                  placeholder="https://..."
                  value={aiVideoUrl}
                  onChange={e => setAiVideoUrl(e.target.value)}
                />
                {aiVideoUrl && (
                  <a href={aiVideoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:underline mt-1 inline-block">
                    ▶ Tekshirish
                  </a>
                )}
              </>
            ) : (
              <textarea
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-purple-500 outline-none transition resize-none font-mono"
                placeholder={s2Type === 'code' ? '// Kodingizni bu yerga yozing...' : 'Javobingizni bu yerga yozing...'}
                rows={6}
                value={step2Content}
                onChange={e => setStep2Content(e.target.value)}
              />
            )}
          </div>

          {/* Stage 3: Dynamic */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 bg-emerald-500 rounded-full text-white text-xs flex items-center justify-center font-bold">3</span>
              <label className="text-white font-medium">{examInfo?.step3Name || 'Loyiha linki'}</label>
              <span className="ml-auto text-xs text-zinc-400">max 40 ball</span>
            </div>
            {examInfo?.step3Desc && (
              <p className="text-zinc-400 text-xs mb-2 pl-8 italic">{examInfo.step3Desc}</p>
            )}
            {s3Type === 'link' ? (
              <>
                <input
                  type="url"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-500 outline-none transition"
                  placeholder="https://..."
                  value={projectVideoUrl}
                  onChange={e => setProjectVideoUrl(e.target.value)}
                />
                {projectVideoUrl && (
                  <a href={projectVideoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline mt-1 inline-block">
                    ▶ Tekshirish
                  </a>
                )}
              </>
            ) : (
              <textarea
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-500 outline-none transition resize-none font-mono"
                placeholder={s3Type === 'code' ? '// Kodingizni bu yerga yozing...' : 'Javobingizni bu yerga yozing...'}
                rows={6}
                value={step3Content}
                onChange={e => setStep3Content(e.target.value)}
              />
            )}
          </div>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <button
            onClick={submitVideos}
            disabled={!canSubmit}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Yuklanmoqda...' : '✓ Imtihonni yakunlash'}
          </button>
        </div>
      </div>
    </div>
  );
  }


  if (stage === 'test' && questions.length > 0) {
    const q = questions[currentQ];
    const COLORS = [
      'from-red-600 to-red-500 hover:from-red-500 hover:to-red-400',
      'from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400',
      'from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400',
      'from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400',
    ];
    const SHAPES = ['▲', '◆', '●', '■'];
    const timerPct = (timeLeft / (30 * 60)) * 100;

    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-[#0c0c1e] to-[#09090b] flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-sm">{student?.fullName}</span>
            <span className="text-zinc-400 text-xs">•</span>
            <span className="text-zinc-400 text-xs">{examInfo?.title}</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-mono font-bold text-sm ${timeLeft < 120 ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-zinc-800 text-white'}`}>
            ⏱ {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-zinc-800">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Question counter */}
        <div className="text-center pt-6 pb-2">
          <div className="text-zinc-400 text-sm">{currentQ + 1} / {questions.length}</div>
          <div className="flex justify-center gap-1 mt-2">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQ(i)}
                className={`w-2 h-2 rounded-full transition ${i === currentQ ? 'bg-white scale-125' : answers[questions[i].id] !== undefined ? 'bg-emerald-400' : 'bg-zinc-600'}`}
              />
            ))}
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
          <div className="w-full max-w-2xl">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 mb-4 text-center min-h-[100px] flex flex-col items-center justify-center gap-4">
              <p className="text-white text-xl font-semibold leading-relaxed">{q.question}</p>
              {q.imageUrl && (
                <img src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${q.imageUrl}`} alt="Savol rasmi" className="max-h-60 rounded-xl object-contain shadow-lg" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {q.options.map((opt, i) => {
                const isSelected = answers[q.id] === i;
                return (
                  <button
                    key={i}
                    onClick={() => selectAnswer(q.id, i)}
                    className={`bg-gradient-to-br ${COLORS[i]} text-white rounded-2xl p-4 flex items-center gap-3 font-medium text-left transition-all duration-150 active:scale-95 shadow-lg ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent scale-[1.02]' : ''}`}
                  >
                    <span className="text-2xl opacity-80">{SHAPES[i]}</span>
                    <span className="text-sm leading-tight">{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-4 items-center">
              <button
                onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
                disabled={currentQ === 0}
                className="px-4 py-2 bg-zinc-800 text-white rounded-lg disabled:opacity-30 hover:bg-zinc-700 transition"
              >← Oldingi</button>

              <div className="text-zinc-400 text-xs">{answered}/{questions.length} javob berildi</div>

              {currentQ === questions.length - 1 ? (
                <button
                  onClick={submitTest}
                  disabled={loading}
                  className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-lg hover:from-emerald-500 hover:to-teal-500 transition shadow-lg"
                >Topshirish ✓</button>
              ) : (
                <button
                  onClick={() => setCurrentQ(q => Math.min(questions.length - 1, q + 1))}
                  className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition"
                >Keyingi →</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login stage
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-[#09090b] to-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Exam card */}
        {examInfo && (
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 mb-4 shadow-xl">
            <div className="text-blue-100 text-sm mb-1 font-medium">
              {examInfo.category?.name ?? 'Imtihon'} • {examInfo.createdBy.fullName}
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">{examInfo.title}</h1>
            <div className="flex gap-4 text-sm">
              <div className="text-blue-100">
                <span className="text-white font-bold">{examInfo.testCount}</span> test
              </div>
              <div className="text-blue-100">
                <span className="text-white font-bold">100</span> max ball
              </div>
              <div className="text-blue-100">
                ⏰ 2 soat
              </div>
            </div>
            {examInfo.status === 'active' && (
              <div className="mt-3 text-xs text-blue-200">
                Tugash vaqti: {new Date(examInfo.expiresAt).toLocaleTimeString('uz-UZ')}
              </div>
            )}
          </div>
        )}

        {/* Login form */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-1">Kirish</h2>
          <p className="text-zinc-400 text-sm mb-5">Tizimdan login va parolingizni kiriting</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          <input
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white mb-3 focus:border-blue-500 outline-none transition"
            placeholder="Login"
            value={login}
            onChange={e => setLogin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startExam()}
            autoFocus
          />
          <input
            type="password"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white mb-5 focus:border-blue-500 outline-none transition"
            placeholder="Parol"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startExam()}
          />

          {examInfo?.status === 'draft' ? (
            <div className="text-amber-400 text-sm text-center py-2">
              ⏳ Imtihon hali boshlanmagan. O'qituvchi faollashtirishi kerak.
            </div>
          ) : (
            <button
              onClick={startExam}
              disabled={loading || !login || !password}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Tekshirilmoqda...' : 'Imtihonni boshlash →'}
            </button>
          )}

          {/* 3 stage info */}
          <div className="mt-5 space-y-3">
            {[
              { n: 1, label: `Test — ${examInfo?.testCount ?? 20} ta savol`, pts: '40 ball', color: 'text-blue-400', border: 'border-blue-500/20', desc: `${examInfo?.testCount ?? 20} ta savolga javob bering. Har savolga 1 urinish.` },
              { n: 2, label: examInfo?.step2Name || 'AI video linki', pts: '20 ball', color: 'text-purple-400', border: 'border-purple-500/20', desc: examInfo?.step2Desc || (examInfo?.step2Type === 'code' ? "Kodingizni to'g'ridan-to'g'ri yozing." : examInfo?.step2Type === 'text' ? "Matn javob yozing." : "Havola (link) kiriting.") },
              { n: 3, label: examInfo?.step3Name || 'Loyiha linki', pts: '40 ball', color: 'text-emerald-400', border: 'border-emerald-500/20', desc: examInfo?.step3Desc || (examInfo?.step3Type === 'code' ? "Kodingizni to'g'ridan-to'g'ri yozing." : examInfo?.step3Type === 'text' ? "Matn javob yozing." : "Havola (link) kiriting.") },
            ].map(s => (
              <div key={s.n} className={`bg-zinc-800/50 border ${s.border} rounded-lg p-2.5`}>
                <div className="flex items-center gap-3 text-sm">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-zinc-800 ${s.color}`}>{s.n}</span>
                  <span className="text-white flex-1 font-medium">{s.label}</span>
                  <span className={`font-bold ${s.color} text-xs`}>{s.pts}</span>
                </div>
                <p className="text-zinc-500 text-xs mt-1 pl-8">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
