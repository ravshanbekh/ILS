/**
 * Normativ natijalari paneli — barcha mentorlar, guruhlar va o'quvchilar
 * bitta jadvalda (Excel'dagi guruh varag'ining hamma guruh uchun ko'rinishi).
 *
 *   ustunlar: mentor → qizil guruh ustuni → o'quvchilar (ismi vertikal)
 *   qatorlar: normativlar — N, nomi + vazifasi, vaqti, bajarish %
 *   katak:    ✔ qo'lladi (yashil) · ✔ biladi (ko'k) · ✘ bilmaydi ·
 *             ⏳ tekshirilmoqda · bo'sh — topshirmagan · kulrang — biriktirilmagan
 *
 * Ikki tomonga aylantiriladi; sarlavhalar va chap ustunlar qotib turadi.
 * ~30 000 katak bo'lishi mumkin — kataklar yengil (faqat matn + rang), izoh
 * esa har katakka emas, jadvalda BITTA suzuvchi oynacha (event delegation).
 * Backend: modules/normative-matrix.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Download, ExternalLink, Loader2, RefreshCw, Search, X } from 'lucide-react';
import Header from '@/components/layout/Header';
import { normativeMatrixApi, type MatrixData, type MatrixFiltersQuery, type MatrixGroup, type MatrixNormative, type MatrixCode } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { downloadBlob } from '@/utils';

type Status = 'active' | 'graduated' | 'all';
type Col =
  | { kind: 'group'; group: MatrixGroup; teacher: string }
  | { kind: 'student'; group: MatrixGroup; student: MatrixGroup['students'][number]; assigned: Set<string> };

/** Chap qotirilgan ustunlar. Tor ekranda (telefon) "Vaqti" va "Foiz" yashiriladi —
 *  aks holda qotirilgan qism butun ekranni egallardi (foiz izohda ko'rinadi). */
type Layout = { compact: boolean; w: { n: number; title: number; time: number; pct: number }; left: { n: number; title: number; time: number; pct: number }; total: number };
const layoutOf = (compact: boolean): Layout => {
  const w = compact ? { n: 32, title: 136, time: 0, pct: 0 } : { n: 40, title: 230, time: 60, pct: 64 };
  return { compact, w, left: { n: 0, title: w.n, time: w.n + w.title, pct: w.n + w.title + w.time }, total: w.n + w.title + w.time + w.pct };
};
function useCompact() {
  const q = '(max-width: 767px)';
  const [c, setC] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setC(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return c;
}
const STUDENT_W = 30;
const GROUP_W = 24;
const HEAD1 = 34;

// Ranglar index.css dagi .ils-nm-* klasslarida (light/dark uchun alohida):
// loyiha palitrasi blue-*/violet-* ni qayta belgilaydi, "biladi" esa ko'k bo'lishi shart
const CODE_META: Record<MatrixCode, { label: string; mark: string; cls: string }> = {
  g: { label: "qo'lladi", mark: '✔', cls: 'ils-nm-g' },
  b: { label: 'biladi', mark: '✔', cls: 'ils-nm-b' },
  r: { label: 'bilmaydi', mark: '✘', cls: 'ils-nm-r' },
  p: { label: 'tekshirilmoqda', mark: '⏳', cls: 'ils-nm-p text-[11px]' },
};

function errMsg(e: any, fallback: string) {
  const err = e?.response?.data?.error;
  return typeof err === 'string' ? err : err?.message ?? fallback;
}

const pctText = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
const pctTone = (v: number | null) =>
  v === null ? 'text-zinc-600' : v >= 0.8 ? 'text-emerald-400' : v >= 0.5 ? 'text-amber-400' : 'text-red-400';

export default function NormativeMatrixPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const compact = useCompact();
  const [opts, setOpts] = useState<Awaited<ReturnType<typeof normativeMatrixApi.options>>['data']['data'] | null>(null);
  const [filters, setFilters] = useState<{ teacherId: string; groupId: string; status: Status; categoryId: string }>({
    teacherId: '',
    groupId: '',
    status: 'active',
    categoryId: '',
  });
  const [search, setSearch] = useState('');
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const L = useMemo(() => layoutOf(compact), [compact]);

  const query = useMemo<MatrixFiltersQuery>(
    () => ({
      status: filters.status,
      ...(filters.teacherId && { teacherId: filters.teacherId }),
      ...(filters.groupId && { groupId: filters.groupId }),
      ...(filters.categoryId && { categoryId: filters.categoryId }),
    }),
    [filters]
  );

  useEffect(() => {
    normativeMatrixApi
      .options()
      .then((r) => setOpts(r.data.data))
      .catch((e) => setError(errMsg(e, 'Ma\'lumotni yuklab bo\'lmadi')));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    normativeMatrixApi
      .get(query)
      .then((r) => setData(r.data.data))
      .catch((e) => setError(errMsg(e, 'Jadvalni yuklab bo\'lmadi')))
      .finally(() => setLoading(false));
  }, [query]);
  useEffect(load, [load]);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const r = await normativeMatrixApi.excel(query);
      downloadBlob(r.data, `normativ-natijalari-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      setError(errMsg(e, 'Excel yuklab bo\'lmadi'));
    } finally {
      setExporting(false);
    }
  };

  // Ustunlar (qidiruv bo'yicha o'quvchilar filtrlanadi; bo'sh guruh/mentor yashiriladi)
  const { teachers, cols } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const teachersOut: { name: string; span: number }[] = [];
    const colsOut: Col[] = [];
    for (const t of data?.teachers ?? []) {
      let span = 0;
      for (const g of t.groups) {
        const students = q ? g.students.filter((s) => s.fullName.toLowerCase().includes(q) || s.login.toLowerCase().includes(q)) : g.students;
        if (q && !students.length) continue;
        const assigned = new Set(g.normativeIds);
        colsOut.push({ kind: 'group', group: g, teacher: t.fullName });
        for (const s of students) colsOut.push({ kind: 'student', group: g, student: s, assigned });
        span += 1 + students.length;
      }
      if (span) teachersOut.push({ name: t.fullName, span });
    }
    return { teachers: teachersOut, cols: colsOut };
  }, [data, search]);

  // Foizlar: normativ bo'yicha va o'quvchi bo'yicha (qo'lladi + biladi) / biriktirilgan
  const stats = useMemo(() => {
    const byNorm = new Map<string, { assigned: number; g: number; b: number; r: number; p: number }>();
    const byStudent = new Map<string, number | null>();
    let assignedAll = 0;
    let doneAll = 0;
    if (!data) return { byNorm, byStudent, total: null as number | null, students: 0, groups: 0 };
    for (const n of data.normatives) byNorm.set(n.id, { assigned: 0, g: 0, b: 0, r: 0, p: 0 });
    let students = 0;
    let groups = 0;
    for (const c of cols) {
      if (c.kind === 'group') {
        groups++;
        continue;
      }
      students++;
      let a = 0;
      let d = 0;
      for (const n of data.normatives) {
        if (!c.assigned.has(n.id)) continue;
        const s = byNorm.get(n.id)!;
        s.assigned++;
        a++;
        const code = data.cells[c.student.id]?.[n.id]?.[0];
        if (code) s[code]++;
        if (code === 'g' || code === 'b') d++;
      }
      byStudent.set(`${c.group.id}:${c.student.id}`, a ? d / a : null);
      assignedAll += a;
      doneAll += d;
    }
    return { byNorm, byStudent, total: assignedAll ? doneAll / assignedAll : null, students, groups };
  }, [data, cols]);

  // ── Suzuvchi izoh (bitta) ──────────────────────────────────────────────────
  const [tip, setTip] = useState<{ x: number; y: number; text: string[] } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const onHover = (e: React.MouseEvent) => {
    const td = (e.target as HTMLElement).closest('td[data-c]') as HTMLElement | null;
    if (!td || !data) return setTip(null);
    const [ci, ni] = td.dataset.c!.split(':').map(Number);
    const c = cols[ci];
    const n = data.normatives[ni];
    if (!c || !n || c.kind !== 'student') return setTip(null);
    const cell = data.cells[c.student.id]?.[n.id];
    const state = !c.assigned.has(n.id)
      ? 'guruhga biriktirilmagan'
      : cell
        ? `${CODE_META[cell[0]].label}${cell[0] !== 'p' ? ` · ${cell[1]} / ${n.maxScore} ball` : ''}`
        : 'topshirmagan';
    const r = td.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top, text: [`${c.student.fullName} · ${c.group.name}`, `${n.taskNumber}. ${n.title}`, state] });
  };

  const goStudent = (id: string) => navigate(role === 'admin' ? `/admin/student/${id}` : role === 'teacher' ? `/teacher/student/${id}` : `/viewer/${role}/student/${id}`);
  // Guruh sahifasi faqat admin va o'qituvchida bor (viewer rollarida yo'q)
  const goGroup = role === 'admin' || role === 'teacher' ? (id: string) => navigate(`/${role}/groups/${id}`) : null;

  const groupsForSelect = (opts?.groups ?? []).filter(
    (g) => (!filters.teacherId || (filters.teacherId === 'none' ? !g.teacherId : g.teacherId === filters.teacherId)) &&
      (filters.status === 'all' || (filters.status === 'graduated' ? g.graduated : !g.graduated))
  );
  const sel = 'rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200';

  return (
    <div>
      <Header title="Normativ natijalari" subtitle="Barcha mentorlar, guruhlar va o'quvchilarning normativ natijalari bitta jadvalda" />
      <div className="space-y-3 p-4 sm:p-6">
        {/* Filtrlar */}
        <div className="flex flex-wrap items-center gap-2">
          {opts?.scope === 'all' && (
            <select
              value={filters.teacherId}
              onChange={(e) => setFilters((f) => ({ ...f, teacherId: e.target.value, groupId: '' }))}
              className={sel}
              aria-label="Mentor"
            >
              <option value="">Barcha mentorlar</option>
              {opts.teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
              {opts.hasUnassigned && <option value="none">Ustozsiz guruhlar</option>}
            </select>
          )}
          <select value={filters.groupId} onChange={(e) => setFilters((f) => ({ ...f, groupId: e.target.value }))} className={sel} aria-label="Guruh">
            <option value="">Barcha guruhlar</option>
            {groupsForSelect.map((g) => <option key={g.id} value={g.id}>{g.name}{g.graduated ? ' (tamomlagan)' : ''}</option>)}
          </select>
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Guruh holati">
            {([['active', 'Faol'], ['graduated', 'Tamomlagan'], ['all', 'Hammasi']] as const).map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={filters.status === k}
                onClick={() => setFilters((f) => ({ ...f, status: k, groupId: '' }))}
                className={`rounded-md px-3 py-1.5 ${filters.status === k ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}
              >
                {l}
              </button>
            ))}
          </div>
          {!!opts?.categories.length && (
            <select value={filters.categoryId} onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))} className={sel} aria-label="Yo'nalish">
              <option value="">Barcha yo'nalishlar</option>
              {opts.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="O'quvchi ismi yoki login"
              aria-label="O'quvchi qidirish"
              className="w-56 rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-8 pr-7 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200" aria-label="Tozalash">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={load} className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-zinc-100" title="Yangilash" aria-label="Yangilash">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={exportExcel}
              disabled={exporting || !data}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Excel
            </button>
          </div>
        </div>

        {/* Ko'rsatkichlar va izoh */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400">
          {data && (
            <span>
              <b className="text-zinc-100">{teachers.length}</b> mentor · <b className="text-zinc-100">{stats.groups}</b> guruh ·{' '}
              <b className="text-zinc-100">{stats.students}</b> o'quvchi · <b className="text-zinc-100">{data.normatives.length}</b> normativ · umumiy bajarish{' '}
              <b className={pctTone(stats.total)}>{pctText(stats.total)}</b>
            </span>
          )}
          <span className="flex flex-wrap items-center gap-3">
            {(['g', 'b', 'r', 'p'] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded font-bold ${CODE_META[k].cls}`}>{CODE_META[k].mark}</span>
                {CODE_META[k].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1"><span className="h-5 w-5 rounded border border-zinc-800" /> topshirmagan</span>
            <span className="inline-flex items-center gap-1"><span className="ils-na h-5 w-5 rounded" /> biriktirilmagan</span>
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Jadval */}
        {loading && !data ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : !data || !data.normatives.length || !cols.length ? (
          <p className="rounded-xl border border-dashed border-zinc-800 py-12 text-center text-sm text-zinc-500">
            {search ? 'Qidiruv bo\'yicha o\'quvchi topilmadi' : 'Bu filtrda guruh yoki biriktirilgan normativ yo\'q'}
          </p>
        ) : (
          <div
            ref={tableRef}
            className={`relative max-h-[calc(100vh-15rem)] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 ${loading ? 'opacity-60' : ''}`}
            onMouseOver={onHover}
            onMouseLeave={() => setTip(null)}
            onScroll={() => tip && setTip(null)}
          >
            {/* table-fixed SHART: aks holda brauzer ustunlarni qisqartiradi va qotirilgan
                ustunlarning left qiymatlari (qat'iy kenglikdan hisoblangan) mos kelmay,
                ular o'quvchi kataklari ustiga chiqib qoladi */}
            <table className="table-fixed border-separate border-spacing-0 text-sm" style={{ width: L.total + cols.reduce((s, c) => s + (c.kind === 'group' ? GROUP_W : STUDENT_W), 0) }}>
              <colgroup>
                <col style={{ width: L.w.n }} />
                <col style={{ width: L.w.title }} />
                {!L.compact && <col style={{ width: L.w.time }} />}
                {!L.compact && <col style={{ width: L.w.pct }} />}
                {cols.map((c, i) => <col key={i} style={{ width: c.kind === 'group' ? GROUP_W : STUDENT_W }} />)}
              </colgroup>
              <thead>
                <tr style={{ height: HEAD1 }}>
                  {([['N', 'n'], ['Normativ', 'title'], ['Vaqti', 'time'], ['Foiz', 'pct']] as const)
                    .filter(([, k]) => !L.compact || k === 'n' || k === 'title')
                    .map(([label, k]) => (
                    <th
                      key={k}
                      rowSpan={2}
                      className={`sticky top-0 z-30 border-b border-r border-zinc-700 bg-orange-700 px-2 align-bottom text-xs font-bold text-white ${k === 'title' ? 'text-left' : 'text-center'}`}
                      style={{ left: L.left[k], paddingBottom: 8 }}
                    >
                      {label}
                    </th>
                  ))}
                  {teachers.map((t, i) => (
                    <th key={i} colSpan={t.span} className="sticky top-0 z-20 border-b border-r border-zinc-700 bg-zinc-900 px-2 text-left text-sm font-bold text-zinc-100">
                      <span className="sticky inline-block whitespace-nowrap" style={{ left: L.total + 8 }}>{t.name}</span>
                    </th>
                  ))}
                </tr>
                <tr>
                  {cols.map((c, i) =>
                    c.kind === 'group' ? (
                      <th
                        key={i}
                        className={`sticky z-20 h-36 border-b border-r border-zinc-700 bg-red-600 p-0 align-bottom ${goGroup ? 'cursor-pointer hover:bg-red-500' : ''}`}
                        style={{ top: HEAD1 }}
                        onClick={goGroup ? () => goGroup(c.group.id) : undefined}
                        title={`${c.group.name} (${c.teacher})`}
                      >
                        <span className="ils-vertical mx-auto block py-2 text-xs font-bold text-white">{c.group.name}{c.group.graduated ? ' ✓' : ''}</span>
                      </th>
                    ) : (
                      <th
                        key={i}
                        className="sticky z-20 h-36 cursor-pointer border-b border-r border-zinc-800 bg-zinc-900 p-0 align-bottom hover:bg-zinc-800"
                        style={{ top: HEAD1 }}
                        onClick={() => goStudent(c.student.id)}
                        title={`${c.student.fullName} (${c.student.login})`}
                      >
                        <span className="ils-vertical mx-auto block max-h-32 overflow-hidden text-ellipsis whitespace-nowrap py-2 text-[11px] font-medium text-zinc-200">
                          {c.student.fullName}
                        </span>
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {data.normatives.map((n, ni) => (
                  <MatrixRow key={n.id} n={n} ni={ni} cols={cols} cells={data.cells} stat={stats.byNorm.get(n.id)!} L={L} />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colSpan={L.compact ? 2 : 4}
                    className="sticky bottom-0 left-0 z-20 border-r border-t border-zinc-700 bg-zinc-900 px-3 py-2 text-right text-xs font-semibold text-zinc-300"
                  >
                    O'quvchi bajargani
                  </td>
                  {cols.map((c, i) => {
                    if (c.kind === 'group') return <td key={i} className="sticky bottom-0 z-10 border-r border-t border-zinc-700 bg-red-600" />;
                    const v = stats.byStudent.get(`${c.group.id}:${c.student.id}`) ?? null;
                    return (
                      <td key={i} className={`sticky bottom-0 z-10 border-r border-t border-zinc-800 bg-zinc-900 p-0 text-center text-[10px] font-bold ${pctTone(v)}`}>
                        <span className="ils-vertical mx-auto block py-1">{pctText(v)}</span>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {tip && (
        <div
          className="pointer-events-none fixed z-[70] max-w-xs -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 shadow-xl"
          style={{ left: tip.x, top: tip.y - 6 }}
        >
          <div className="font-semibold text-zinc-100">{tip.text[0]}</div>
          <div className="text-zinc-400">{tip.text[1]}</div>
          <div className="mt-0.5 font-semibold text-orange-300">{tip.text[2]}</div>
        </div>
      )}
    </div>
  );
}

/** Bitta normativ qatori — memo: qidiruv/izoh o'zgarsa qayta chizilmasin */
const MatrixRow = memo(function MatrixRow({
  n,
  ni,
  cols,
  cells,
  stat,
  L,
}: {
  L: Layout;
  n: MatrixNormative;
  ni: number;
  cols: Col[];
  cells: MatrixData['cells'];
  stat: { assigned: number; g: number; b: number; r: number; p: number };
}) {
  const pct = stat.assigned ? (stat.g + stat.b) / stat.assigned : null;
  return (
    <tr className="group/row">
      <td className="sticky z-10 border-b border-r border-zinc-800 ils-nm-title ils-nm-num px-1 text-center text-xs font-bold" style={{ left: L.left.n }}>
        {n.taskNumber}
      </td>
      <td
        className="sticky z-10 border-b border-r border-zinc-800 ils-nm-title px-2 py-1.5 align-top"
        style={{ left: L.left.title }}
        title={L.compact ? `Bajarish: ${pctText(pct)}${n.timeLimit ? ` · ${n.timeLimit} daq` : ''}` : undefined}
      >
        <div className="flex items-start gap-1">
          <span className="line-clamp-2 text-xs font-semibold leading-snug text-zinc-100" title={n.description ? `${n.title}\n\n${n.description}` : n.title}>
            {n.title}
          </span>
          {n.url && (
            <a href={n.url} target="_blank" rel="noreferrer" className="mt-0.5 shrink-0 text-sky-400 hover:text-sky-300" title="Normativ havolasi" aria-label="Normativ havolasi">
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {n.category && <div className="mt-0.5 text-[10px] text-zinc-500">{n.category.name}</div>}
      </td>
      {!L.compact && (
        <td className="sticky z-10 border-b border-r border-zinc-800 ils-nm-time px-1 text-center text-[11px]" style={{ left: L.left.time }}>
          {n.timeLimit ? `${n.timeLimit} daq` : '—'}
        </td>
      )}
      {!L.compact && (
        <td
          className={`sticky z-10 border-b border-r border-zinc-700 ils-nm-time px-1 text-center text-xs font-bold ${pctTone(pct)}`}
          style={{ left: L.left.pct }}
          title={`Qo'lladi ${stat.g} · biladi ${stat.b} · bilmaydi ${stat.r} · tekshirilmoqda ${stat.p} · biriktirilgan ${stat.assigned}`}
        >
          {pctText(pct)}
        </td>
      )}
      {cols.map((c, ci) => {
        if (c.kind === 'group') return <td key={ci} className="border-b border-r border-red-700 bg-red-600" />;
        if (!c.assigned.has(n.id)) return <td key={ci} data-c={`${ci}:${ni}`} className="ils-na border-b border-r border-zinc-800" />;
        const cell = cells[c.student.id]?.[n.id];
        const meta = cell ? CODE_META[cell[0]] : null;
        return (
          <td key={ci} data-c={`${ci}:${ni}`} className={`h-8 border-b border-r border-zinc-800 p-0 text-center text-sm font-bold group-hover/row:bg-white/[0.03] ${meta?.cls ?? ''}`}>
            {meta?.mark}
          </td>
        );
      })}
    </tr>
  );
});
