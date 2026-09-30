import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Image as ImageIcon, Upload, Download, Link2,
  Settings, ListChecks, BarChart3, X, Check, AlertTriangle, Eye,
  ExternalLink, Play, Lock, CircleDashed, Pencil, FileSpreadsheet,
} from 'lucide-react';
import { quizTestsApi } from '../../api';
import {
  parseQuizTestFile, downloadTemplate, exportResults,
  type ParsedQuestion,
} from '@/utils/quizTestExcel';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

function errMsg(e: any, fallback: string): string {
  const err = e?.response?.data?.error;
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return fallback;
}

interface Question {
  id: string;
  type: 'closed' | 'open';
  text: string;
  imageUrl: string | null;
  options: string[] | null;
  correctIndexes: number[] | null;
  acceptedAnswers: string[] | null;
  caseSensitive: boolean;
  manualReview: boolean;
  points: number;
  order: number;
}

interface TestFull {
  id: string;
  title: string;
  description: string | null;
  code: string;
  status: 'draft' | 'active' | 'closed';
  durationMin: number;
  startsAt: string | null;
  expiresAt: string | null;
  closedCount: number | null;
  openCount: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  attemptsAllowed: number;
  requirePhone: boolean;
  showResult: boolean;
  showCorrectAnswers: boolean;
  passPercent: number | null;
  questions: Question[];
  closedTotal: number;
  openTotal: number;
  _count: { attempts: number };
}

type Tab = 'questions' | 'settings' | 'results';

export default function QuizTestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [test, setTest] = useState<TestFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('questions');
  const [copied, setCopied] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      const res = await quizTestsApi.getById(id);
      setTest(res.data.data);
    } catch (e: any) {
      alert(errMsg(e, 'Testni yuklab bo\'lmadi'));
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const shareUrl = test ? `${window.location.origin}/t/${test.code}` : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const changeStatus = async (status: 'draft' | 'active' | 'closed') => {
    if (!test) return;
    if (status === 'active' && test.questions.length === 0) {
      alert('Testda savol yo\'q — avval savol qo\'shing');
      return;
    }
    try {
      await quizTestsApi.update(test.id, { status });
      setTest({ ...test, status });
    } catch (e: any) {
      alert(errMsg(e, 'Holatni o\'zgartirib bo\'lmadi'));
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-64 rounded bg-zinc-800 animate-pulse" />
        <div className="mt-6 h-64 rounded-xl bg-zinc-800/50 animate-pulse" />
      </div>
    );
  }
  if (!test) return null;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100"
      >
        <ArrowLeft className="w-4 h-4" /> Testlar ro'yxati
      </button>

      {/* Sarlavha va havola */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-zinc-50">{test.title}</h1>
            {test.description && (
              <p className="mt-1 text-sm text-zinc-400 line-clamp-2">{test.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(['draft', 'active', 'closed'] as const).map((s) => {
              const meta = {
                draft: { label: 'Qoralama', Icon: CircleDashed },
                active: { label: 'Faol', Icon: Play },
                closed: { label: 'Yopilgan', Icon: Lock },
              }[s];
              const on = test.status === s;
              return (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    on
                      ? s === 'active'
                        ? 'bg-emerald-600 text-white'
                        : s === 'closed'
                        ? 'bg-red-600 text-white'
                        : 'bg-zinc-700 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <meta.Icon className="w-3.5 h-3.5" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-indigo-900 px-3 py-2.5">
          <Link2 className="w-4 h-4 shrink-0 text-indigo-500" />
          <code className="flex-1 truncate text-sm font-mono text-indigo-400">{shareUrl}</code>
          <button
            onClick={copyLink}
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-indigo-400 hover:bg-indigo-900"
          >
            {copied ? 'Nusxalandi' : 'Nusxalash'}
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-zinc-900 p-1.5 text-indigo-400 hover:bg-indigo-900"
            title="Ochib ko'rish"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        {test.status !== 'active' && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            Test <b>Faol</b> holatida bo'lmasa, havola ochilmaydi
          </p>
        )}
      </div>

      {/* Tablar */}
      <div className="mt-5 flex gap-1 border-b border-zinc-800">
        {([
          ['questions', 'Savollar', ListChecks, test.questions.length],
          ['settings', 'Sozlamalar', Settings, null],
          ['results', 'Natijalar', BarChart3, test._count.attempts],
        ] as const).map(([key, label, Icon, badge]) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === key
                ? 'border-indigo-600 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {badge !== null && badge > 0 && (
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'questions' && <QuestionsTab test={test} reload={load} />}
        {tab === 'settings' && <SettingsTab test={test} reload={load} />}
        {tab === 'results' && <ResultsTab test={test} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SAVOLLAR
// ═══════════════════════════════════════════════════════════════════════════

function QuestionsTab({ test, reload }: { test: TestFull; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDelete = async (q: Question) => {
    if (!confirm('Savol o\'chirilsinmi?')) return;
    try {
      await quizTestsApi.deleteQuestion(test.id, q.id);
      reload();
    } catch (e: any) {
      alert(errMsg(e, 'O\'chirishda xatolik'));
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Savol qo'shish
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800/50"
        >
          <Upload className="w-4 h-4" /> Excel'dan yuklash
        </button>
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800/50"
        >
          <Download className="w-4 h-4" /> Namuna fayl
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setImporting(true);
            (window as any).__quizImportFile = f;
            e.target.value = '';
          }}
        />

        <div className="ml-auto flex gap-3 text-sm text-zinc-400">
          <span>Yopiq: <b className="text-zinc-200">{test.closedTotal}</b></span>
          <span>Ochiq: <b className="text-zinc-200">{test.openTotal}</b></span>
        </div>
      </div>

      {test.questions.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-800 py-14 text-center">
          <ListChecks className="mx-auto h-10 w-10 text-zinc-600" />
          <p className="mt-3 font-medium text-zinc-200">Savollar hali qo'shilmagan</p>
          <p className="mt-1 text-sm text-zinc-500">
            Qo'lda kiriting yoki Excel fayldan yuklang
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {test.questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        q.type === 'open'
                          ? 'bg-amber-900 text-amber-400'
                          : 'bg-sky-500/15 text-sky-400'
                      }`}
                    >
                      {q.type === 'open' ? 'Ochiq' : 'Yopiq'}
                    </span>
                    <span className="text-xs text-zinc-500">{q.points} ball</span>
                    {q.manualReview && (
                      <span className="rounded bg-violet-900 px-1.5 py-0.5 text-xs text-violet-400">
                        qo'lda baholanadi
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-100">{q.text}</p>

                  {q.imageUrl && (
                    <img
                      src={`${API_BASE}${q.imageUrl}`}
                      alt=""
                      className="mt-2 max-h-44 rounded-lg border border-zinc-800 object-contain"
                    />
                  )}

                  {q.type === 'closed' && q.options && (
                    <ul className="mt-2 space-y-1">
                      {q.options.map((o, oi) => {
                        const ok = (q.correctIndexes ?? []).includes(oi);
                        return (
                          <li
                            key={oi}
                            className={`flex items-start gap-2 rounded px-2 py-1 text-sm ${
                              ok ? 'bg-emerald-900 text-emerald-400' : 'text-zinc-300'
                            }`}
                          >
                            {ok ? (
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
                            )}
                            <span>{o}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {q.type === 'open' && (
                    <div className="mt-2 text-sm">
                      {q.acceptedAnswers && q.acceptedAnswers.length > 0 ? (
                        <p className="text-zinc-300">
                          <span className="text-zinc-500">Qabul qilinadi: </span>
                          {q.acceptedAnswers.join(' / ')}
                        </p>
                      ) : (
                        <p className="text-violet-400">
                          Javob namunasi yo'q — mentor qo'lda baholaydi
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setEditing(q)}
                    className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                    title="Tahrirlash"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(q)}
                    className="rounded p-1.5 text-zinc-500 hover:bg-red-900 hover:text-red-400"
                    title="O'chirish"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(adding || editing) && (
        <QuestionModal
          testId={test.id}
          question={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            reload();
          }}
        />
      )}

      {importing && (
        <ImportModal
          testId={test.id}
          file={(window as any).__quizImportFile}
          onClose={() => setImporting(false)}
          onDone={() => {
            setImporting(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

// ── Savol qo'shish / tahrirlash ─────────────────────────────────────────────

function QuestionModal({
  testId,
  question,
  onClose,
  onSaved,
}: {
  testId: string;
  question: Question | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!question;
  const [type, setType] = useState<'closed' | 'open'>(question?.type ?? 'closed');
  const [text, setText] = useState(question?.text ?? '');
  const [options, setOptions] = useState<string[]>(
    question?.options ?? ['', '', '', '']
  );
  const [correct, setCorrect] = useState<number[]>(question?.correctIndexes ?? []);
  const [accepted, setAccepted] = useState<string>(
    (question?.acceptedAnswers ?? []).join('\n')
  );
  const [caseSensitive, setCaseSensitive] = useState(question?.caseSensitive ?? false);
  const [manualReview, setManualReview] = useState(question?.manualReview ?? false);
  const [points, setPoints] = useState(question?.points ?? 1);
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleCorrect = (i: number) => {
    setCorrect((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort()));
  };

  const submit = async () => {
    if (!text.trim()) return alert('Savol matnini yozing');

    const form = new FormData();
    form.append('type', type);
    form.append('text', text.trim());
    form.append('points', String(points));
    form.append('caseSensitive', String(caseSensitive));
    form.append('manualReview', String(manualReview));

    if (type === 'closed') {
      const clean = options.map((o) => o.trim()).filter(Boolean);
      if (clean.length < 2) return alert('Kamida 2 ta variant kerak');
      // Bo'sh variantlar olib tashlangach indekslar suriladi — qayta hisoblaymiz
      const mapped = correct
        .map((ci) => options[ci]?.trim())
        .filter(Boolean)
        .map((val) => clean.indexOf(val!))
        .filter((i) => i >= 0);
      if (mapped.length === 0) return alert('To\'g\'ri javobni belgilang');
      form.append('options', JSON.stringify(clean));
      form.append('correctIndexes', JSON.stringify([...new Set(mapped)].sort()));
    } else {
      const list = accepted
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean);
      form.append('acceptedAnswers', JSON.stringify(list));
      if (list.length === 0) form.set('manualReview', 'true');
    }

    if (image) form.append('image', image);
    if (removeImage) form.append('removeImage', 'true');

    setSaving(true);
    try {
      if (isEdit) await quizTestsApi.updateQuestion(testId, question!.id, form);
      else await quizTestsApi.addQuestion(testId, form);
      onSaved();
    } catch (e: any) {
      alert(errMsg(e, 'Saqlashda xatolik'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="my-8 w-full max-w-2xl rounded-xl bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="font-semibold text-zinc-50">
            {isEdit ? 'Savolni tahrirlash' : 'Yangi savol'}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Tur */}
          <div className="flex gap-2">
            {(['closed', 'open'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 rounded-lg border px-4 py-3 text-left transition ${
                  type === t
                    ? 'border-indigo-500 bg-indigo-900'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="text-sm font-semibold text-zinc-100">
                  {t === 'closed' ? 'Yopiq savol' : 'Ochiq savol'}
                </div>
                <div className="mt-0.5 text-xs text-zinc-400">
                  {t === 'closed'
                    ? 'Variantlardan tanlaydi'
                    : 'Javobni o\'zi yozadi'}
                </div>
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-200">
              Savol matni <span className="text-red-500">*</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-zinc-800 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/25"
            />
          </div>

          {/* Rasm */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-200">Rasm</label>
            {question?.imageUrl && !removeImage && !image && (
              <div className="mb-2 flex items-center gap-2">
                <img
                  src={`${API_BASE}${question.imageUrl}`}
                  alt=""
                  className="h-20 rounded border border-zinc-800 object-contain"
                />
                <button
                  onClick={() => setRemoveImage(true)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Rasmni olib tashlash
                </button>
              </div>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800/50">
              <ImageIcon className="w-4 h-4" />
              {image ? image.name : 'Rasm tanlash (5 MB gacha)'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  setImage(e.target.files?.[0] ?? null);
                  setRemoveImage(false);
                }}
              />
            </label>
          </div>

          {/* Yopiq savol variantlari */}
          {type === 'closed' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                Variantlar — to'g'risini belgilang
              </label>
              <div className="space-y-2">
                {options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCorrect(i)}
                      title="To'g'ri javob"
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
                        correct.includes(i)
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-zinc-800 text-zinc-600 hover:border-emerald-500/40'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <input
                      value={o}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = e.target.value;
                        setOptions(next);
                      }}
                      placeholder={`Variant ${i + 1}`}
                      className="flex-1 rounded-lg border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => {
                          setOptions(options.filter((_, x) => x !== i));
                          setCorrect(correct.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)));
                        }}
                        className="rounded p-1.5 text-zinc-600 hover:bg-red-900 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {options.length < 6 && (
                <button
                  onClick={() => setOptions([...options, ''])}
                  className="mt-2 text-sm text-indigo-400 hover:underline"
                >
                  + Variant qo'shish
                </button>
              )}
              <p className="mt-2 text-xs text-zinc-500">
                Bir nechta to'g'ri javob bo'lishi mumkin. Ishtirokchi HAMMASINI to'g'ri
                belgilasagina ball oladi.
              </p>
            </div>
          )}

          {/* Ochiq savol */}
          {type === 'open' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-200">
                  Qabul qilinadigan javoblar — har biri yangi qatorda
                </label>
                <textarea
                  value={accepted}
                  onChange={(e) => setAccepted(e.target.value)}
                  rows={4}
                  placeholder={'Toshkent\ntoshkent shahri'}
                  className="w-full resize-none rounded-lg border border-zinc-800 px-3 py-2.5 font-mono text-sm outline-none focus:border-indigo-400"
                />
                <p className="mt-1.5 text-xs text-zinc-500">
                  Bo'sh qoldirsangiz, javobni siz qo'lda baholaysiz
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                  className="rounded border-zinc-700"
                />
                Katta-kichik harf farqlansin
              </label>

              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={manualReview}
                  onChange={(e) => setManualReview(e.target.checked)}
                  className="rounded border-zinc-700"
                />
                Javob to'g'ri bo'lsa ham qo'lda tekshiraman
              </label>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-200">Ball</label>
            <input
              type="number"
              min={1}
              value={points}
              onChange={(e) => setPoints(Math.max(1, Number(e.target.value)))}
              className="w-24 rounded-lg border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
            Bekor qilish
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Excel import ────────────────────────────────────────────────────────────

function ImportModal({
  testId,
  file,
  onClose,
  onDone,
}: {
  testId: string;
  file: File | undefined;
  onClose: () => void;
  onDone: () => void;
}) {
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  const [skipped, setSkipped] = useState<{ row: number; reason: string }[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) {
      setError('Fayl tanlanmadi');
      return;
    }
    parseQuizTestFile(file)
      .then((r) => {
        setParsed(r.questions);
        setSkipped(r.skipped);
      })
      .catch(() => setError('Faylni o\'qib bo\'lmadi. Format .xlsx yoki .csv bo\'lsin'));
  }, [file]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await quizTestsApi.bulkAddQuestions(testId, parsed);
      const { added, skipped: srvSkipped } = res.data.data;
      alert(
        `${added} ta savol qo'shildi` +
          (srvSkipped?.length ? `\n${srvSkipped.length} ta qator o'tkazib yuborildi` : '')
      );
      onDone();
    } catch (e: any) {
      alert(errMsg(e, 'Yuklashda xatolik'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="my-8 w-full max-w-3xl rounded-xl bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="inline-flex items-center gap-2 font-semibold text-zinc-50">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            Excel'dan yuklash
          </h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-4 text-sm">
                <span className="rounded-lg bg-emerald-900 px-3 py-1.5 text-emerald-400">
                  O'qildi: <b>{parsed.length}</b>
                </span>
                {skipped.length > 0 && (
                  <span className="rounded-lg bg-amber-900 px-3 py-1.5 text-amber-400">
                    O'tkazib yuborildi: <b>{skipped.length}</b>
                  </span>
                )}
              </div>

              {skipped.length > 0 && (
                <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-900 p-3">
                  <p className="mb-1 text-sm font-medium text-amber-400">
                    Quyidagi qatorlar qabul qilinmadi:
                  </p>
                  <ul className="space-y-0.5 text-xs text-amber-400">
                    {skipped.slice(0, 10).map((s, i) => (
                      <li key={i}>{s.row}-qator — {s.reason}</li>
                    ))}
                    {skipped.length > 10 && <li>... va yana {skipped.length - 10} ta</li>}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                {parsed.map((q, i) => (
                  <div key={i} className="rounded-lg border border-zinc-800 p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          q.type === 'open'
                            ? 'bg-amber-900 text-amber-400'
                            : 'bg-sky-500/15 text-sky-400'
                        }`}
                      >
                        {q.type === 'open' ? 'Ochiq' : 'Yopiq'}
                      </span>
                      <span className="text-xs text-zinc-500">{q.points} ball</span>
                      {q.warning && (
                        <span className="text-xs text-violet-400">{q.warning}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-100">{q.text}</p>
                    {q.options && (
                      <p className="mt-1 text-xs text-zinc-400">
                        {q.options.map((o, oi) => (
                          <span
                            key={oi}
                            className={
                              (q.correctIndexes ?? []).includes(oi)
                                ? 'font-semibold text-emerald-400'
                                : ''
                            }
                          >
                            {o}
                            {oi < q.options!.length - 1 ? ' · ' : ''}
                          </span>
                        ))}
                      </p>
                    )}
                    {q.acceptedAnswers && q.acceptedAnswers.length > 0 && (
                      <p className="mt-1 text-xs text-zinc-400">
                        Javob: {q.acceptedAnswers.join(' / ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
            Bekor qilish
          </button>
          <button
            onClick={save}
            disabled={saving || parsed.length === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Yuklanmoqda...' : `${parsed.length} ta savolni qo'shish`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SOZLAMALAR
// ═══════════════════════════════════════════════════════════════════════════

function SettingsTab({ test, reload }: { test: TestFull; reload: () => void }) {
  const [form, setForm] = useState({
    title: test.title,
    description: test.description ?? '',
    durationMin: test.durationMin,
    startsAt: test.startsAt ? test.startsAt.slice(0, 16) : '',
    expiresAt: test.expiresAt ? test.expiresAt.slice(0, 16) : '',
    closedCount: test.closedCount ?? '',
    openCount: test.openCount ?? '',
    shuffleQuestions: test.shuffleQuestions,
    shuffleOptions: test.shuffleOptions,
    attemptsAllowed: test.attemptsAllowed,
    requirePhone: test.requirePhone,
    showResult: test.showResult,
    showCorrectAnswers: test.showCorrectAnswers,
    passPercent: test.passPercent ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await quizTestsApi.update(test.id, {
        ...form,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
        closedCount: form.closedCount === '' ? null : Number(form.closedCount),
        openCount: form.openCount === '' ? null : Number(form.openCount),
        passPercent: form.passPercent === '' ? null : Number(form.passPercent),
      });
      setSavedAt(Date.now());
      reload();
    } catch (e: any) {
      alert(errMsg(e, 'Saqlashda xatolik'));
    } finally {
      setSaving(false);
    }
  };

  const shownClosed =
    form.closedCount === '' ? test.closedTotal : Math.min(Number(form.closedCount), test.closedTotal);
  const shownOpen =
    form.openCount === '' ? test.openTotal : Math.min(Number(form.openCount), test.openTotal);

  return (
    <div className="space-y-5">
      {/* Asosiy */}
      <Section title="Asosiy">
        <Field label="Test nomi">
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className="w-full rounded-lg border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </Field>
        <Field label="Shartlar va ko'rsatmalar" hint="Ishtirokchi test boshlashdan oldin ko'radi">
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </Field>
      </Section>

      {/* Vaqt */}
      <Section title="Vaqt">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Davomiyligi (daqiqa)">
            <input
              type="number"
              min={1}
              value={form.durationMin}
              onChange={(e) => set('durationMin', Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </Field>
          <Field label="Boshlanish" hint="bo'sh = darhol">
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => set('startsAt', e.target.value)}
              className="w-full rounded-lg border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </Field>
          <Field label="Tugash" hint="bo'sh = cheksiz">
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => set('expiresAt', e.target.value)}
              className="w-full rounded-lg border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </Field>
        </div>
      </Section>

      {/* Savol tanlash */}
      <Section
        title="Nechta savol berilsin"
        note="Bo'sh qoldirsangiz, o'sha turdagi hamma savol beriladi. Son yozsangiz, bankdan tasodifiy tanlanadi — har ishtirokchida boshqacha variant chiqadi."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Yopiq savol (bankda ${test.closedTotal} ta)`}>
            <input
              type="number"
              min={0}
              max={test.closedTotal}
              value={form.closedCount}
              onChange={(e) => set('closedCount', e.target.value)}
              placeholder="hammasi"
              className="w-full rounded-lg border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </Field>
          <Field label={`Ochiq savol (bankda ${test.openTotal} ta)`}>
            <input
              type="number"
              min={0}
              max={test.openTotal}
              value={form.openCount}
              onChange={(e) => set('openCount', e.target.value)}
              placeholder="hammasi"
              className="w-full rounded-lg border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </Field>
        </div>

        <div className="mt-3 rounded-lg bg-indigo-900 px-3 py-2 text-sm text-indigo-400">
          Har ishtirokchiga <b>{shownClosed + shownOpen}</b> ta savol beriladi
          {shownClosed + shownOpen > 0 && (
            <> ({shownClosed} yopiq, {shownOpen} ochiq)</>
          )}
        </div>

        <div className="mt-3 space-y-2">
          <Toggle
            checked={form.shuffleQuestions}
            onChange={(v) => set('shuffleQuestions', v)}
            label="Savollar tartibi aralashtirilsin"
          />
          <Toggle
            checked={form.shuffleOptions}
            onChange={(v) => set('shuffleOptions', v)}
            label="Variantlar tartibi aralashtirilsin"
          />
        </div>
      </Section>

      {/* Ishtirokchi */}
      <Section title="Ishtirokchi">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Necha marta ishlashi mumkin">
            <input
              type="number"
              min={1}
              value={form.attemptsAllowed}
              onChange={(e) => set('attemptsAllowed', Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </Field>
          <Field label="O'tish foizi" hint="bo'sh = o'tdi/yiqildi ko'rsatilmaydi">
            <input
              type="number"
              min={0}
              max={100}
              value={form.passPercent}
              onChange={(e) => set('passPercent', e.target.value)}
              placeholder="masalan 60"
              className="w-full rounded-lg border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </Field>
        </div>
        <div className="mt-3">
          <Toggle
            checked={form.requirePhone}
            onChange={(v) => set('requirePhone', v)}
            label="Telefon raqam ham so'ralsin"
          />
        </div>
      </Section>

      {/* Natija */}
      <Section title="Natija ko'rsatish">
        <div className="space-y-2">
          <Toggle
            checked={form.showResult}
            onChange={(v) => set('showResult', v)}
            label="Ishtirokchi o'z ballini ko'rsin"
          />
          <Toggle
            checked={form.showCorrectAnswers}
            onChange={(v) => set('showCorrectAnswers', v)}
            label="To'g'ri javoblar ham ko'rsatilsin"
            disabled={!form.showResult}
            hint="Test qayta ishlatiladigan bo'lsa, buni yoqmang"
          />
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Saqlanmoqda...' : 'Sozlamalarni saqlash'}
        </button>
        {savedAt && Date.now() - savedAt < 3000 && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
            <Check className="w-4 h-4" /> Saqlandi
          </span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="font-semibold text-zinc-50">{title}</h3>
      {note && <p className="mt-1 text-sm text-zinc-400">{note}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-200">
        {label}
        {hint && <span className="ml-1.5 font-normal text-zinc-500">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-2.5 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-zinc-700"
      />
      <span>
        <span className="text-sm text-zinc-200">{label}</span>
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  NATIJALAR
// ═══════════════════════════════════════════════════════════════════════════

interface Attempt {
  id: string;
  fullName: string;
  phone: string | null;
  attemptNumber: number;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  correctCount: number | null;
  passed: boolean | null;
  needsReview: boolean;
}

function ResultsTab({ test }: { test: TestFull }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await quizTestsApi.getResults(test.id);
      setAttempts(res.data.data.attempts);
      setStats(res.data.data.stats);
    } catch (e: any) {
      alert(errMsg(e, 'Natijalarni yuklab bo\'lmadi'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test.id]);

  const remove = async (a: Attempt) => {
    if (!confirm(`${a.fullName} natijasi o'chirilsinmi?`)) return;
    try {
      await quizTestsApi.deleteAttempt(test.id, a.id);
      setAttempts((p) => p.filter((x) => x.id !== a.id));
    } catch (e: any) {
      alert(errMsg(e, 'O\'chirishda xatolik'));
    }
  };

  if (loading) return <div className="h-40 rounded-xl bg-zinc-800/50 animate-pulse" />;

  if (attempts.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-zinc-800 py-14 text-center">
        <BarChart3 className="mx-auto h-10 w-10 text-zinc-600" />
        <p className="mt-3 font-medium text-zinc-200">Hali hech kim ishlamagan</p>
        <p className="mt-1 text-sm text-zinc-500">
          Havolani tarqating — natijalar shu yerda paydo bo'ladi
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Statistika */}
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Jami" value={stats?.total ?? 0} />
        <Stat label="Yakunlagan" value={stats?.submitted ?? 0} />
        <Stat label="O'rtacha" value={stats?.avgPercent === null ? '—' : `${stats?.avgPercent}%`} />
        <Stat
          label="Tekshirish kerak"
          value={stats?.needsReview ?? 0}
          warn={(stats?.needsReview ?? 0) > 0}
        />
      </div>

      <div className="mb-3 flex justify-end">
        <button
          onClick={() => exportResults(test.title, attempts)}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800/50"
        >
          <Download className="w-4 h-4" /> Excel'ga yuklash
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/50 text-left text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-4 py-3">Ishtirokchi</th>
              <th className="px-4 py-3">Ball</th>
              <th className="px-4 py-3">Foiz</th>
              <th className="px-4 py-3">Holat</th>
              <th className="px-4 py-3">Topshirdi</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {attempts.map((a) => (
              <tr key={a.id} className="hover:bg-zinc-800/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-100">{a.fullName}</div>
                  <div className="text-xs text-zinc-500">
                    {a.phone && <span>{a.phone} · </span>}
                    {a.attemptNumber}-urinish
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-200">
                  {a.score ?? '—'}
                  {a.maxScore !== null && <span className="text-zinc-500"> / {a.maxScore}</span>}
                </td>
                <td className="px-4 py-3">
                  {a.percent === null ? (
                    '—'
                  ) : (
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        a.passed === true
                          ? 'bg-emerald-900 text-emerald-400'
                          : a.passed === false
                          ? 'bg-red-900 text-red-400'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {a.percent}%
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {a.status === 'in_progress' ? (
                    <span className="text-amber-400">Jarayonda</span>
                  ) : a.needsReview ? (
                    <span className="inline-flex items-center gap-1 text-violet-400">
                      <AlertTriangle className="w-3.5 h-3.5" /> Tekshirish kerak
                    </span>
                  ) : (
                    <span className="text-zinc-400">Yakunlangan</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {a.submittedAt ? new Date(a.submittedAt).toLocaleString('uz-UZ') : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setOpen(a.id)}
                      className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-indigo-400"
                      title="Javoblarni ko'rish"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(a)}
                      className="rounded p-1.5 text-zinc-500 hover:bg-red-900 hover:text-red-400"
                      title="O'chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <AttemptModal
          testId={test.id}
          attemptId={open}
          onClose={() => setOpen(null)}
          onReviewed={load}
        />
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: any; warn?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        warn ? 'border-violet-500/40 bg-violet-900' : 'border-zinc-800 bg-zinc-900'
      }`}
    >
      <div className="text-xs text-zinc-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${warn ? 'text-violet-400' : 'text-zinc-50'}`}>
        {value}
      </div>
    </div>
  );
}

// ── Bitta urinish tafsiloti ─────────────────────────────────────────────────

function AttemptModal({
  testId,
  attemptId,
  onClose,
  onReviewed,
}: {
  testId: string;
  attemptId: string;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await quizTestsApi.getAttempt(testId, attemptId);
      setData(res.data.data);
    } catch (e: any) {
      alert(errMsg(e, 'Yuklab bo\'lmadi'));
      onClose();
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const review = async (answerId: string, isCorrect: boolean) => {
    setBusy(answerId);
    try {
      await quizTestsApi.reviewAnswer(testId, answerId, { isCorrect });
      await load();
      onReviewed();
    } catch (e: any) {
      alert(errMsg(e, 'Baholashda xatolik'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="my-8 w-full max-w-3xl rounded-xl bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="font-semibold text-zinc-50">
              {data?.attempt?.fullName ?? 'Yuklanmoqda...'}
            </h2>
            {data?.attempt && (
              <p className="text-sm text-zinc-400">
                {data.attempt.score ?? 0} / {data.attempt.maxScore ?? 0} ball
                {data.attempt.percent !== null && ` · ${data.attempt.percent}%`}
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-3 overflow-y-auto p-5">
          {!data ? (
            <div className="h-32 rounded-lg bg-zinc-800/50 animate-pulse" />
          ) : (
            data.items.map((item: any, i: number) => {
              const q = item.question;
              const a = item.answer;
              if (!q) return null;
              const correctIdx: number[] = q.correctIndexes ?? [];
              const given: number[] = a?.selected ?? [];

              return (
                <div
                  key={q.id}
                  className={`rounded-lg border p-4 ${
                    a?.needsReview
                      ? 'border-violet-500/40 bg-violet-900'
                      : a?.isCorrect
                      ? 'border-emerald-500/40 bg-emerald-900'
                      : 'border-red-500/40 bg-red-900'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-semibold text-zinc-400">{i + 1}.</span>
                    <p className="flex-1 text-sm font-medium text-zinc-100">{q.text}</p>
                    <span className="text-xs text-zinc-400">
                      {a?.points ?? 0}/{q.points}
                    </span>
                  </div>

                  {q.type === 'closed' && q.options && (
                    <ul className="mt-2 space-y-1 pl-6">
                      {(q.options as string[]).map((o, oi) => {
                        const isCorrect = correctIdx.includes(oi);
                        const isGiven = given.includes(oi);
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

                  {q.type === 'open' && (
                    <div className="mt-2 pl-6">
                      <p className="text-sm text-zinc-100">
                        <span className="text-zinc-500">Javobi: </span>
                        {a?.textAnswer || <i className="text-zinc-500">bo'sh</i>}
                      </p>
                      {q.acceptedAnswers && (q.acceptedAnswers as string[]).length > 0 && (
                        <p className="mt-1 text-xs text-zinc-400">
                          Kutilgan: {(q.acceptedAnswers as string[]).join(' / ')}
                        </p>
                      )}

                      {a?.needsReview && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => review(a.id, true)}
                            disabled={busy === a.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            <Check className="w-3.5 h-3.5" /> To'g'ri
                          </button>
                          <button
                            onClick={() => review(a.id, false)}
                            disabled={busy === a.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            <X className="w-3.5 h-3.5" /> Noto'g'ri
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
