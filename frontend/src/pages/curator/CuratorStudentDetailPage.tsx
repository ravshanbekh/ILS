/**
 * Kurator o'quvchisining to'liq kartasi:
 *   - 2 oylik muddat va kurator dasturi xaritasi (8 hafta × 3 mashg'ulot) — bosib belgilanadi;
 *   - asosiy guruh: so'nggi darslar (davomat, uy vazifasi, faollik) va normativlar (isbot videosi bilan);
 *   - kurator vaqtlariga yozilishlar tarixi.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, ExternalLink, Loader2, Pencil, Save, Trash2, UserCheck, UserX } from 'lucide-react';
import Header from '@/components/layout/Header';
import DateInput from '@/components/shared/DateInput';
import { apiErrorText, curatorApi, type CuratorHomework, type CuratorListItem, type CuratorStatus, type CuratorStudentDetail } from '@/api';
import {
  HOMEWORK_LABEL,
  LESSON_STATE,
  Modal,
  ProgramProgress,
  STATUS_META,
  StatusBadge,
  TimelineBar,
  inputCls,
  pctTone,
  shortDate,
  todayLocal,
  useCuratorBase,
} from './curatorCommon';

type ProgramItem = CuratorStudentDetail['program'][number];

const NORM_CODE: Record<'g' | 'b' | 'r' | 'p', { mark: string; label: string; cls: string }> = {
  g: { mark: '✔', label: "qo'lladi", cls: 'ils-nm-g' },
  b: { mark: '✔', label: 'biladi', cls: 'ils-nm-b' },
  r: { mark: '✘', label: 'bilmaydi', cls: 'ils-nm-r' },
  p: { mark: '⏳', label: 'tekshirilmoqda', cls: 'ils-nm-p' },
};

const BOOKING_LABEL: Record<string, { label: string; cls: string }> = {
  band: { label: 'yozilgan', cls: 'text-sky-400' },
  keldi: { label: 'keldi', cls: 'text-emerald-400' },
  kelmadi: { label: 'kelmadi', cls: 'text-red-400' },
  bekor: { label: 'bekor qilingan', cls: 'text-zinc-500' },
};

export default function CuratorStudentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const base = useCuratorBase();
  const [d, setD] = useState<CuratorStudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<ProgramItem | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await curatorApi.student(id);
      setD(r.data.data);
      setError(null);
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const weeks = useMemo(() => {
    const m = new Map<number, { title: string; items: ProgramItem[] }>();
    for (const l of d?.program ?? []) {
      if (!m.has(l.week)) m.set(l.week, { title: l.weekTitle, items: [] });
      m.get(l.week)!.items.push(l);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [d]);

  if (loading && !d) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }
  if (!d) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error ?? 'Topilmadi'}</div>
      </div>
    );
  }

  const m = d.main;
  return (
    <div className="min-h-screen bg-zinc-950">
      <Header title={d.student.fullName} subtitle={`Kurator: ${d.curator?.fullName ?? '—'} · demo ${shortDate(d.demoDate)} → ${shortDate(d.endDate)}`} />
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => navigate(`${base}/curators`)} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> O'quvchilar
          </button>
          <span className="flex-1" />
          <StatusBadge status={d.status} />
          {d.student.accessBlocked && <span className="rounded-full border border-red-500/30 px-2 py-0.5 text-[11px] text-red-400">kirish yopiq</span>}
          {d.canEdit && (
            <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:text-white">
              <Pencil className="h-3.5 w-3.5" /> Tahrirlash
            </button>
          )}
        </div>

        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">2 oylik muddat</p>
            <TimelineBar t={d.timeline} />
            <p className="mt-2 text-xs text-zinc-500">
              Login: <span className="font-mono text-zinc-300">{d.student.login}</span>
            </p>
            {d.demoNote && <p className="mt-2 rounded-lg bg-zinc-950/60 px-2.5 py-1.5 text-xs text-zinc-300">{d.demoNote}</p>}
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Kurator dasturi</p>
            <ProgramProgress p={d.progress} t={d.timeline} />
            <p className="mt-2 text-xs text-zinc-500">
              Reja bo'yicha bugungacha ~{d.timeline.expectedLessons} ta mashg'ulot · oxirgisi {shortDate(d.progress.lastDate)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Asosiy guruh</p>
            {m.groups.length === 0 ? (
              <p className="text-sm font-semibold text-red-400">Hali guruhga qo'shilmagan — administratorga ayting</p>
            ) : (
              <>
                {m.groups.map((g) => (
                  <p key={g.id} className="text-sm text-zinc-100">
                    {g.name} <span className="text-xs text-zinc-500">· {g.teacherName ?? 'ustozsiz'} · {shortDate(g.joinedAt)} dan</span>
                  </p>
                ))}
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Davomat" value={m.lessons.attendancePct != null ? `${m.lessons.attendancePct}%` : '—'} tone={pctTone(m.lessons.attendancePct)} sub={`${m.lessons.attended}/${m.lessons.attended + m.lessons.absent}`} />
                  <Stat label="Uy vazifa" value={m.lessons.avgHomework ?? '—'} sub="5 dan" />
                  <Stat label="Normativ" value={m.normatives.donePct != null ? `${m.normatives.donePct}%` : '—'} tone={pctTone(m.normatives.donePct)} sub={`${m.normatives.g + m.normatives.b}/${m.normatives.assigned}`} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Dastur xaritasi */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
            <h3 className="text-sm font-bold text-white">2 oylik dastur — qaysi haftada, qaysi mashg'ulotda</h3>
            <div className="flex gap-3 text-[11px] text-zinc-400">
              {(['otildi', 'kelmadi', 'kutilmoqda'] as const).map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${LESSON_STATE[k].dot}`} /> {LESSON_STATE[k].label}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {weeks.map(([w, wk]) => {
              const current = d.progress.next?.week === w;
              return (
                <div key={w} className={`rounded-lg border p-3 ${current ? 'border-sky-500/50 bg-sky-500/5' : 'border-zinc-800'}`}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {w}-hafta {current && <span className="text-sky-400">· hozir</span>}
                    <span className="block normal-case tracking-normal text-zinc-300">{wk.title}</span>
                  </p>
                  <div className="space-y-1.5">
                    {wk.items.map((l) => (
                      <button
                        key={l.lessonId}
                        type="button"
                        disabled={!d.canEdit}
                        onClick={() => setMarking(l)}
                        className={`w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors enabled:hover:brightness-125 ${LESSON_STATE[l.state].cls} ${
                          d.progress.next?.id === l.lessonId ? 'ring-1 ring-sky-400' : ''
                        }`}
                        title={l.note ?? undefined}
                      >
                        <span className="font-semibold">
                          {l.n}. {l.title}
                        </span>
                        {l.kind === 'B' && <span className="ml-1 text-amber-400">★</span>}
                        {l.state !== 'kutilmoqda' && (
                          <span className="block text-[10px] opacity-80">
                            {shortDate(l.date)}
                            {l.homework && ` · vazifa: ${HOMEWORK_LABEL[l.homework]}`}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {d.canEdit && <p className="px-4 pb-3 text-[11px] text-zinc-500">Mashg'ulotni bosing — o'tildi / kelmadi, mini-vazifa natijasi va izohni belgilang. Jadvaldagi "keldi" belgisi bu yerga o'zi tushadi.</p>}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Asosiy darslar */}
          <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <h3 className="border-b border-zinc-800 px-4 py-3 text-sm font-bold text-white">Asosiy guruhdagi so'nggi darslar</h3>
            {m.recentLessons.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">Hali dars baholanmagan</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Sana</th>
                      <th className="px-2 py-2 font-medium">Mavzu</th>
                      <th className="px-2 py-2 text-center font-medium">Keldi</th>
                      <th className="px-2 py-2 text-center font-medium">Uy v.</th>
                      <th className="px-2 py-2 text-center font-medium">Faollik</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {m.recentLessons.map((l) => (
                      <tr key={l.id} title={l.comment ?? undefined}>
                        <td className="whitespace-nowrap px-4 py-2 text-zinc-300">{shortDate(l.date)}</td>
                        <td className="max-w-[180px] truncate px-2 py-2 text-zinc-400">{l.topic || '—'}</td>
                        <td className="px-2 py-2 text-center">
                          {l.attended === null ? <span className="text-zinc-600">—</span> : l.attended ? <span className="text-emerald-400">✔</span> : <span className="text-red-400">✘</span>}
                        </td>
                        <td className="px-2 py-2 text-center text-zinc-200">{l.homeworkScore ?? '—'}</td>
                        <td className="px-2 py-2 text-center text-zinc-200">{l.activityScore ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Normativlar */}
          <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <h3 className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 text-sm font-bold text-white">
              Normativlar
              <span className="text-xs font-normal text-zinc-500">
                ✔ {m.normatives.g} · <span className="text-sky-400">✔ {m.normatives.b}</span> · ✘ {m.normatives.r} · ⏳ {m.normatives.p}
              </span>
            </h3>
            {m.normativeList.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">Guruhga normativ biriktirilmagan</p>
            ) : (
              <ul className="max-h-80 divide-y divide-zinc-800 overflow-y-auto">
                {m.normativeList.map((n) => {
                  const meta = n.code ? NORM_CODE[n.code] : null;
                  const mark = (
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded font-bold ${meta?.cls ?? 'border border-zinc-800 text-zinc-600'}`}>{meta?.mark ?? ''}</span>
                  );
                  return (
                    <li key={n.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                      {n.url ? (
                        <a href={n.url} target="_blank" rel="noopener noreferrer" title="Isbot videosi" aria-label={`${n.title}: videoni ochish`}>
                          {mark}
                        </a>
                      ) : (
                        mark
                      )}
                      <span className="min-w-0 flex-1 truncate text-zinc-200">
                        <span className="text-zinc-500">{n.taskNumber}.</span> {n.title}
                      </span>
                      <span className="shrink-0 text-zinc-500">{meta ? meta.label : 'topshirmagan'}</span>
                      {n.url && (
                        <a href={n.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sky-400 hover:text-sky-300" aria-label="Video">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Yozilishlar */}
        <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          <h3 className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3 text-sm font-bold text-white">
            <CalendarClock className="h-4 w-4 text-zinc-400" /> Kurator vaqtlariga yozilishlar
          </h3>
          {d.bookings.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">Hali yozilmagan</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {d.bookings.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                  <span className="w-28 shrink-0 text-zinc-300">
                    {shortDate(b.date)}, {b.time.slice(0, 5)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-zinc-400">{b.lesson ? `${b.lesson.n}. ${b.lesson.title}` : "mashg'ulot belgilanmagan"}</span>
                  <span className={BOOKING_LABEL[b.status]?.cls}>{BOOKING_LABEL[b.status]?.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {marking && <MarkModal enrollmentId={d.id} item={marking} onClose={() => setMarking(null)} onSaved={load} />}
      {editing && <EditModal d={d} onClose={() => setEditing(false)} onSaved={load} />}
    </div>
  );
}

function Stat({ label, value, sub, tone = 'text-zinc-100' }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-zinc-950/50 px-2 py-1.5">
      <p className={`text-base font-bold ${tone}`}>{value}</p>
      <p className="text-[10px] text-zinc-500">
        {label}
        {sub && <span className="block text-zinc-600">{sub}</span>}
      </p>
    </div>
  );
}

function MarkModal({ enrollmentId, item, onClose, onSaved }: { enrollmentId: string; item: ProgramItem; onClose: () => void; onSaved: () => void }) {
  const [attended, setAttended] = useState(item.state !== 'kelmadi');
  const [homework, setHomework] = useState<CuratorHomework | ''>(item.homework ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [date, setDate] = useState(item.date ?? todayLocal());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await curatorApi.recordProgress(enrollmentId, { lessonId: item.lessonId, attended, homework: homework || null, note: note || null, date });
      onSaved();
      onClose();
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!item.progressId) return;
    setBusy(true);
    try {
      await curatorApi.deleteProgress(item.progressId);
      onSaved();
      onClose();
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`${item.n}. ${item.title}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-zinc-500">
          {item.week}-hafta · {item.weekTitle}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAttended(true)}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${attended ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-zinc-800 text-zinc-400'}`}
          >
            <UserCheck className="h-4 w-4" /> O'tildi (keldi)
          </button>
          <button
            type="button"
            onClick={() => setAttended(false)}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${!attended ? 'border-red-500/50 bg-red-500/15 text-red-300' : 'border-zinc-800 text-zinc-400'}`}
          >
            <UserX className="h-4 w-4" /> Kelmadi
          </button>
        </div>
        <label className="block text-xs text-zinc-400">
          Sana
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} max={todayLocal()} className={`${inputCls} mt-1`} aria-label="Mashg'ulot sanasi" />
        </label>
        <label className="block text-xs text-zinc-400">
          O'tgan safargi mini-vazifa
          <select value={homework} onChange={(e) => setHomework(e.target.value as CuratorHomework | '')} className={`${inputCls} mt-1`}>
            <option value="">— belgilanmagan —</option>
            <option value="bajardi">Bajardi</option>
            <option value="qisman">Qisman</option>
            <option value="bajarmadi">Bajarmadi</option>
          </select>
        </label>
        <label className="block text-xs text-zinc-400">
          Izoh
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={`${inputCls} mt-1 resize-none`} placeholder="Nima yasadi, nimada qiynaldi..." />
        </label>
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {item.progressId ? (
            <button type="button" onClick={remove} disabled={busy} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
              <Trash2 className="h-3.5 w-3.5" /> Belgini olib tashlash
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={save} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Saqlash
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditModal({ d, onClose, onSaved }: { d: CuratorStudentDetail; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<CuratorStatus>(d.status);
  const [demoDate, setDemoDate] = useState(d.demoDate);
  const [demoNote, setDemoNote] = useState(d.demoNote ?? '');
  const [curatorId, setCuratorId] = useState(d.curator?.id ?? '');
  const [curators, setCurators] = useState<CuratorListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    curatorApi.curators().then((r) => setCurators(r.data.data)).catch(() => {});
  }, []);
  const canChangeCurator = curators.length > 1;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await curatorApi.updateStudent(d.id, {
        ...(status !== d.status ? { status } : {}),
        ...(demoDate !== d.demoDate ? { demoDate } : {}),
        ...((demoNote || null) !== d.demoNote ? { demoNote: demoNote || null } : {}),
        ...(canChangeCurator && curatorId && curatorId !== d.curator?.id ? { curatorId } : {}),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Kuratorlik ma'lumotlari" onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-xs text-zinc-400">
          Holat
          <select value={status} onChange={(e) => setStatus(e.target.value as CuratorStatus)} className={`${inputCls} mt-1`}>
            {(Object.keys(STATUS_META) as CuratorStatus[]).map((k) => (
              <option key={k} value={k}>
                {STATUS_META[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-zinc-400">
          Demo dars sanasi (2 oy shu kundan hisoblanadi)
          <DateInput value={demoDate} onChange={(e) => setDemoDate(e.target.value)} max={todayLocal()} className={`${inputCls} mt-1`} aria-label="Demo dars sanasi" />
        </label>
        {canChangeCurator && (
          <label className="block text-xs text-zinc-400">
            Kurator
            <select value={curatorId} onChange={(e) => setCuratorId(e.target.value)} className={`${inputCls} mt-1`}>
              {curators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-xs text-zinc-400">
          Demo haqida izoh
          <textarea value={demoNote} onChange={(e) => setDemoNote(e.target.value)} maxLength={500} rows={3} className={`${inputCls} mt-1 resize-none`} />
        </label>
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:text-white">
            Bekor
          </button>
          <button type="button" onClick={save} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Saqlash
          </button>
        </div>
      </div>
    </Modal>
  );
}
