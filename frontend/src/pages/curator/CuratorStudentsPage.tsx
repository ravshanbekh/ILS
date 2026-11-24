/**
 * Kuratorning o'quvchilari — kurator uchun bosh sahifa, nazoratchi uchun
 * barcha kuratorlar kesimi. Har bir bola: 2 oylik muddat, dastur bo'yicha
 * joyi (rejaga nisbatan), asosiy guruhi va u yerdagi davomat/normativlar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Check, Copy, KeyRound, Link2, Loader2, Plus, RefreshCw, Search, UserPlus, Users } from 'lucide-react';
import Header from '@/components/layout/Header';
import DateInput from '@/components/shared/DateInput';
import { apiErrorText, curatorApi, type CuratorListItem, type CuratorStatus, type CuratorStudentRow } from '@/api';
import { Modal, ProgramProgress, StatusBadge, TimelineBar, inputCls, pctTone, shortDate, todayLocal, useCuratorBase } from './curatorCommon';

const STATUS_TABS: { key: CuratorStatus | 'all'; label: string }[] = [
  { key: 'faol', label: 'Faol' },
  { key: 'tugadi', label: '2 oy tugagan' },
  { key: 'toxtatildi', label: "To'xtatilgan" },
  { key: 'all', label: 'Hammasi' },
];

export default function CuratorStudentsPage() {
  const navigate = useNavigate();
  const base = useCuratorBase();
  const [status, setStatus] = useState<CuratorStatus | 'all'>('faol');
  const [curatorId, setCuratorId] = useState('');
  const [ungrouped, setUngrouped] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<CuratorStudentRow[]>([]);
  const [scope, setScope] = useState<'own' | 'all'>('own');
  const [curators, setCurators] = useState<CuratorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await curatorApi.students({ status, curatorId: curatorId || undefined, ungrouped: ungrouped ? '1' : undefined });
      setItems(res.data.data.items);
      setScope(res.data.data.scope);
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setLoading(false);
    }
  }, [status, curatorId, ungrouped]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    curatorApi.curators().then((r) => setCurators(r.data.data)).catch(() => {});
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((x) => x.student.fullName.toLowerCase().includes(q) || x.student.login.toLowerCase().includes(q)) : items;
  }, [items, search]);

  const stats = useMemo(() => {
    const active = items.filter((x) => x.status === 'faol');
    const lagging = active.filter((x) => x.timeline.expectedLessons - x.progress.done >= 2).length;
    const noGroup = items.filter((x) => x.main.groups.length === 0).length;
    return { total: items.length, lagging, noGroup };
  }, [items]);

  const me = curators.length === 1 && scope === 'own' ? curators[0] : null;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header
        title={scope === 'all' ? "Kuratorlar va o'quvchilari" : "Mening o'quvchilarim"}
        subtitle="Demo darsdan keyingi 2 oy: kurator dasturi va asosiy darslar bir joyda"
      />
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        {/* Nazoratchi uchun kuratorlar kesimi */}
        {scope === 'all' && curators.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCuratorId('')}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${!curatorId ? 'border-blue-600 bg-blue-600/15 text-white' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'}`}
            >
              <span className="block text-sm font-bold">Barcha kuratorlar</span>
              <span>{curators.reduce((s, c) => s + c.active, 0)} faol o'quvchi</span>
            </button>
            {curators.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCuratorId(c.id === curatorId ? '' : c.id)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${curatorId === c.id ? 'border-blue-600 bg-blue-600/15 text-white' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'}`}
              >
                <span className="block text-sm font-bold">{c.fullName}</span>
                <span>
                  {c.active} faol{c.ungrouped > 0 && <span className="text-amber-400"> · {c.ungrouped} guruhsiz</span>} · {c.slotsThisWeek} vaqt/hafta
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatus(t.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${status === t.key ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
            <input type="checkbox" checked={ungrouped} onChange={(e) => setUngrouped(e.target.checked)} />
            Faqat guruhsizlar
          </label>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ism yoki login"
              aria-label="O'quvchi qidirish"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
          <button type="button" onClick={load} className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-zinc-100" title="Yangilash" aria-label="Yangilash">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => navigate(`${base}/curator-schedule`)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:text-white"
          >
            <CalendarClock className="h-4 w-4" /> Jadval
          </button>
          {scope === 'all' && (
            <button
              type="button"
              onClick={() => setShowAssign(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:text-white"
            >
              <Link2 className="h-4 w-4" /> Mavjud o'quvchini biriktirish
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" /> Demo'dan keyin qo'shish
          </button>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
          <span>
            <b className="text-zinc-100">{stats.total}</b> o'quvchi
          </span>
          {stats.lagging > 0 && (
            <span className="text-amber-400">
              <b>{stats.lagging}</b> tasi dasturdan orqada
            </span>
          )}
          {stats.noGroup > 0 && (
            <span className="text-red-400">
              <b>{stats.noGroup}</b> tasi hali asosiy guruhga qo'shilmagan
            </span>
          )}
          {me && <span>Bu hafta {me.slotsThisWeek} ta vaqt ochilgan</span>}
        </div>

        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>}

        {loading && !items.length ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 py-14 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
            <p className="text-sm text-zinc-400">Hali o'quvchi yo'q</p>
            <p className="mt-1 text-xs text-zinc-500">Demo darsdan keyin bolani "Demo'dan keyin qo'shish" tugmasi bilan ILS'ga kiriting</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => navigate(`${base}/curators/${x.id}`)}
                className="group flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left transition-colors hover:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-100 group-hover:text-white">{x.student.fullName}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {x.student.login} · demo {shortDate(x.demoDate)}
                      {scope === 'all' && <> · {x.curator.fullName}</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={x.status} />
                    {x.student.accessBlocked && <span className="text-[10px] text-red-400">kirish yopiq</span>}
                  </div>
                </div>

                <TimelineBar t={x.timeline} />
                <ProgramProgress p={x.progress} t={x.timeline} />

                <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs">
                  {x.main.groups.length === 0 ? (
                    <p className="font-semibold text-red-400">Asosiy guruhga hali qo'shilmagan</p>
                  ) : (
                    <>
                      <p className="truncate text-zinc-300">
                        <span className="text-zinc-500">Asosiy guruh:</span> {x.main.groups.map((g) => g.name).join(', ')}
                        {x.main.groups[0]?.teacherName && <span className="text-zinc-500"> · {x.main.groups[0].teacherName}</span>}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-zinc-400">
                        <span>
                          Davomat <b className={pctTone(x.main.lessons.attendancePct)}>{x.main.lessons.attendancePct ?? '—'}{x.main.lessons.attendancePct != null && '%'}</b>
                          <span className="text-zinc-600"> ({x.main.lessons.attended}/{x.main.lessons.attended + x.main.lessons.absent})</span>
                        </span>
                        <span>
                          Uy vazifa <b className="text-zinc-200">{x.main.lessons.avgHomework ?? '—'}</b>
                        </span>
                        <span>
                          Normativ <b className={pctTone(x.main.normatives.donePct)}>{x.main.normatives.donePct ?? '—'}{x.main.normatives.donePct != null && '%'}</b>
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {x.nextBooking && (
                  <p className="text-xs text-sky-400">
                    <CalendarClock className="mr-1 inline h-3.5 w-3.5" />
                    Keyingi mashg'ulot: {shortDate(x.nextBooking.date)}, {x.nextBooking.time}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateStudentModal
          scope={scope}
          curators={curators}
          defaultCuratorId={curatorId}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
      {showAssign && <AssignModal curators={curators} defaultCuratorId={curatorId} onClose={() => setShowAssign(false)} onDone={load} />}
    </div>
  );
}

/** Demo darsdan keyin bolani ILS'ga qo'shish — guruhsiz, kuratorga biriktirilgan holda */
function CreateStudentModal({
  scope,
  curators,
  defaultCuratorId,
  onClose,
  onCreated,
}: {
  scope: 'own' | 'all';
  curators: CuratorListItem[];
  defaultCuratorId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [demoDate, setDemoDate] = useState(todayLocal());
  const [demoNote, setDemoNote] = useState('');
  const [curatorId, setCuratorId] = useState(defaultCuratorId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ fullName: string; login: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const suggest = useCallback(async () => {
    try {
      const r = await curatorApi.suggestLogin();
      setLogin(r.data.data.login);
      setPassword(r.data.data.password);
    } catch {
      /* qo'lda kiritiladi */
    }
  }, []);
  useEffect(() => {
    suggest();
  }, [suggest]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await curatorApi.createStudent({
        fullName,
        login,
        password,
        demoDate,
        demoNote: demoNote || null,
        ...(scope === 'all' ? { curatorId } : {}),
      });
      setDone({ fullName: r.data.data.student.fullName, ...r.data.data.credentials });
      onCreated();
    } catch (err) {
      setError(apiErrorText(err));
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!done) return;
    const text = `ILS (itlivescore.uz)\nO'quvchi: ${done.fullName}\nLogin: ${done.login}\nParol: ${done.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* brauzer ruxsat bermadi */
    }
  };

  if (done) {
    return (
      <Modal title="O'quvchi qo'shildi" onClose={onClose}>
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="font-semibold text-emerald-300">{done.fullName} ILS'ga kiritildi</p>
            <p className="mt-1 text-xs text-zinc-400">Endi administrator uni asosiy guruhga qo'shadi. Siz 2 oy davomida uni shu bo'limda kuzatasiz.</p>
          </div>
          <div className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm">
            <p>
              <span className="text-zinc-500">Login:</span> <b className="text-zinc-100">{done.login}</b>
            </p>
            <p>
              <span className="text-zinc-500">Parol:</span> <b className="text-zinc-100">{done.password}</b>
            </p>
          </div>
          <p className="flex items-start gap-2 text-xs text-amber-400">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
            Parol faqat hozir ko'rsatiladi — bolaga (yoki ota-onasiga) bering. Keyin faqat administrator yangilay oladi.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:text-white">
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} {copied ? 'Nusxalandi' : 'Nusxalash'}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Tayyor
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Demo'dan keyin o'quvchini qo'shish" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-zinc-300">
          Bola guruhsiz qo'shiladi va sizga biriktiriladi. 2 oylik kuzatuv demo kunidan boshlanadi.
        </p>
        {scope === 'all' && (
          <label className="block text-xs text-zinc-400">
            Kurator
            <select required value={curatorId} onChange={(e) => setCuratorId(e.target.value)} className={`${inputCls} mt-1`}>
              <option value="">— tanlang —</option>
              {curators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-xs text-zinc-400">
          Ism-familiya
          <input required minLength={2} maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Masalan: Karimov Jasur" className={`${inputCls} mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-zinc-400">
            Login
            <input required pattern="[a-zA-Z0-9_.]{3,50}" value={login} onChange={(e) => setLogin(e.target.value)} className={`${inputCls} mt-1 font-mono`} />
          </label>
          <label className="block text-xs text-zinc-400">
            Parol
            <input required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} mt-1 font-mono`} />
          </label>
        </div>
        <button type="button" onClick={suggest} className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300">
          <RefreshCw className="h-3 w-3" /> Boshqa login va parol
        </button>
        <label className="block text-xs text-zinc-400">
          Demo dars sanasi
          <DateInput value={demoDate} onChange={(e) => setDemoDate(e.target.value)} max={todayLocal()} className={`${inputCls} mt-1`} aria-label="Demo dars sanasi" />
        </label>
        <label className="block text-xs text-zinc-400">
          Demo haqida izoh (ixtiyoriy)
          <textarea
            value={demoNote}
            onChange={(e) => setDemoNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Yoshi, nimaga qiziqadi, demoda nima yoqdi..."
            className={`${inputCls} mt-1 resize-none`}
          />
        </label>
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:text-white">
            Bekor
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} ILS'ga qo'shish
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Ilgari yaratilgan o'quvchini kuratorga biriktirish (faqat nazoratchi) */
function AssignModal({ curators, defaultCuratorId, onClose, onDone }: { curators: CuratorListItem[]; defaultCuratorId: string; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ id: string; fullName: string; login: string; groups: string[] }[]>([]);
  const [picked, setPicked] = useState<{ id: string; fullName: string } | null>(null);
  const [curatorId, setCuratorId] = useState(defaultCuratorId);
  const [demoDate, setDemoDate] = useState(todayLocal());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setFound([]);
      return;
    }
    const t = setTimeout(() => {
      curatorApi.unassigned(q).then((r) => setFound(r.data.data)).catch((e) => setError(apiErrorText(e)));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const submit = async () => {
    if (!picked || !curatorId) return;
    setSaving(true);
    setError(null);
    try {
      await curatorApi.assign({ studentId: picked.id, curatorId, demoDate });
      onDone();
      onClose();
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Mavjud o'quvchini kuratorga biriktirish" onClose={onClose}>
      <div className="space-y-3">
        {picked ? (
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
            <span className="text-zinc-100">{picked.fullName}</span>
            <button type="button" onClick={() => setPicked(null)} className="text-xs text-zinc-400 hover:text-white">
              almashtirish
            </button>
          </div>
        ) : (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="O'quvchi ismi yoki login (kamida 2 harf)" className={inputCls} aria-label="O'quvchi qidirish" autoFocus />
            <div className="max-h-56 divide-y divide-zinc-800 overflow-y-auto rounded-lg border border-zinc-800">
              {found.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-zinc-500">{q.trim().length < 2 ? 'Qidiring' : "Kuratori yo'q o'quvchi topilmadi"}</p>
              ) : (
                found.map((s) => (
                  <button key={s.id} type="button" onClick={() => setPicked(s)} className="block w-full px-3 py-2 text-left hover:bg-white/[0.03]">
                    <span className="text-sm text-zinc-100">{s.fullName}</span>
                    <span className="block text-xs text-zinc-500">
                      {s.login} · {s.groups.length ? s.groups.join(', ') : 'guruhsiz'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
        <label className="block text-xs text-zinc-400">
          Kurator
          <select value={curatorId} onChange={(e) => setCuratorId(e.target.value)} className={`${inputCls} mt-1`}>
            <option value="">— tanlang —</option>
            {curators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-zinc-400">
          Demo dars sanasi (2 oy shu kundan)
          <DateInput value={demoDate} onChange={(e) => setDemoDate(e.target.value)} className={`${inputCls} mt-1`} aria-label="Demo dars sanasi" />
        </label>
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:text-white">
            Bekor
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!picked || !curatorId || saving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Biriktirish
          </button>
        </div>
      </div>
    </Modal>
  );
}
