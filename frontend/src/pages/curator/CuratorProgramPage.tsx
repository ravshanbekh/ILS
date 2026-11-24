/**
 * Kuratorning 2 oylik dasturi: 8 hafta × 3 mashg'ulot (A — asosiy, ★ — qo'shimcha).
 * Har mashg'ulotda maqsad, ilmiy fakt, daqiqama-daqiqa qadamlar, "wow" lahza,
 * natija (artefakt), mini-vazifa va vositalar. Tahrirlash — `curator_program` ruxsati.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Loader2, Pencil, Plus, Save } from 'lucide-react';
import Header from '@/components/layout/Header';
import { apiErrorText, curatorApi, type CuratorLesson } from '@/api';
import { KindBadge, Modal, inputCls, lessonLabel } from './curatorCommon';

export default function CuratorProgramPage() {
  const [lessons, setLessons] = useState<CuratorLesson[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [minutes, setMinutes] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<CuratorLesson | 'new' | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const first = await curatorApi.program();
      const edit = first.data.data.canEdit;
      const r = edit ? await curatorApi.program(true) : first;
      setLessons(r.data.data.lessons);
      setCanEdit(edit);
      setMinutes(r.data.data.sessionMinutes);
      setError(null);
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const weeks = useMemo(() => {
    const m = new Map<number, { title: string; items: CuratorLesson[] }>();
    for (const l of lessons) {
      if (!m.has(l.week)) m.set(l.week, { title: l.weekTitle, items: [] });
      m.get(l.week)!.items.push(l);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [lessons]);

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header
        title="Kurator dasturi — 2 oy"
        subtitle={`Har hafta 2 ta wow mashg'ulot (mini-guruh) + 1 ta chempionat (butun oqim): ${lessons.filter((l) => l.isActive && l.kind === 'A').length} wow · ${lessons.filter((l) => l.isActive && l.kind === 'C').length} chempionat · ${lessons.filter((l) => l.isActive && l.kind === 'Z').length} zaxira · har biri ${minutes} daqiqa`}
      />
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        {canEdit && (
          <div className="flex justify-end">
            <button type="button" onClick={() => setEditing('new')} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Mashg'ulot qo'shish
            </button>
          </div>
        )}
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : (
          weeks.map(([w, wk]) => (
            <section key={w} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <h3 className="border-b border-zinc-800 px-4 py-3 text-sm font-bold text-white">
                <span className="text-zinc-500">{w}-hafta ·</span> {wk.title}
              </h3>
              <div className="divide-y divide-zinc-800">
                {wk.items.map((l) => {
                  const isOpen = open === l.id;
                  const c = l.content ?? {};
                  return (
                    <div key={l.id} className={l.isActive ? '' : 'opacity-50'}>
                      <button type="button" onClick={() => setOpen(isOpen ? null : l.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02]" aria-expanded={isOpen}>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-200">{l.code ?? l.n}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-zinc-100">
                            {l.title} <KindBadge kind={l.kind} />
                            {!l.isActive && <span className="ml-1 text-xs font-normal text-zinc-500">(o'chirilgan)</span>}
                          </span>
                          {l.goal && <span className="block truncate text-xs text-zinc-500">{l.goal}</span>}
                        </span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="space-y-3 px-4 pb-4 pl-14 text-sm text-zinc-300">
                          {c.prep && c.prep.length > 0 && (
                            <Block title="Tayyorgarlik">
                              <ul className="list-disc space-y-0.5 pl-4">
                                {c.prep.map((x, i) => (
                                  <li key={i}>{x}</li>
                                ))}
                              </ul>
                            </Block>
                          )}
                          {c.fact && <Block title="Bilasanmi? (fakt)">{c.fact}</Block>}
                          {c.steps && c.steps.length > 0 && (
                            <Block title="Amaliyot">
                              <ol className="list-decimal space-y-1 pl-4">
                                {c.steps.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ol>
                            </Block>
                          )}
                          {c.wow && <Block title="Wow lahza">{c.wow}</Block>}
                          {c.artifact && <Block title="Natija (portfolio)">{c.artifact}</Block>}
                          {c.homework && <Block title="Mini-vazifa">{c.homework}</Block>}
                          {c.tools && c.tools.length > 0 && (
                            <Block title="Vositalar">
                              <div className="flex flex-wrap gap-2">
                                {c.tools.map((t) => (
                                  <a key={t.url} href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-2 py-1 text-xs text-sky-400 hover:text-sky-300">
                                    {t.name} <ExternalLink className="h-3 w-3" />
                                  </a>
                                ))}
                              </div>
                            </Block>
                          )}
                          {c.fallback && <Block title="Zaxira (sayt ishlamasa)">{c.fallback}</Block>}
                          {canEdit && (
                            <button type="button" onClick={() => setEditing(l)} className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:text-white">
                              <Pencil className="h-3.5 w-3.5" /> Tahrirlash
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
      {editing && (
        <LessonEditor
          lesson={editing === 'new' ? null : editing}
          nextN={Math.max(0, ...lessons.map((l) => l.n)) + 1}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

function LessonEditor({ lesson, nextN, onClose, onSaved }: { lesson: CuratorLesson | null; nextN: number; onClose: () => void; onSaved: () => void }) {
  const c = lesson?.content ?? {};
  const [f, setF] = useState({
    n: lesson?.n ?? nextN,
    code: lesson?.code ?? '',
    week: lesson?.week ?? 8,
    weekTitle: lesson?.weekTitle ?? '',
    kind: (lesson?.kind as 'A' | 'C' | 'Z') ?? 'A',
    title: lesson?.title ?? '',
    goal: lesson?.goal ?? '',
    fact: c.fact ?? '',
    steps: (c.steps ?? []).join('\n'),
    prep: (c.prep ?? []).join('\n'),
    wow: c.wow ?? '',
    artifact: c.artifact ?? '',
    homework: c.homework ?? '',
    tools: (c.tools ?? []).map((t) => `${t.name} | ${t.url}`).join('\n'),
    fallback: c.fallback ?? '',
    isActive: lesson?.isActive ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const tools = f.tools
        .split('\n')
        .map((line) => line.split('|').map((x) => x.trim()))
        .filter(([name, url]) => name && url)
        .map(([name, url]) => ({ name, url }));
      const payload = {
        n: f.n,
        ...(f.code.trim() ? { code: f.code.trim() } : {}),
        week: f.week,
        weekTitle: f.weekTitle,
        kind: f.kind,
        title: f.title,
        goal: f.goal || null,
        isActive: f.isActive,
        content: {
          fact: f.fact || null,
          steps: f.steps.split('\n').map((s) => s.trim()).filter(Boolean),
          prep: f.prep.split('\n').map((s) => s.trim()).filter(Boolean),
          wow: f.wow || null,
          artifact: f.artifact || null,
          homework: f.homework || null,
          tools,
          fallback: f.fallback || null,
        },
      };
      if (lesson) await curatorApi.updateLesson(lesson.id, payload);
      else await curatorApi.createLesson(payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const area = (k: keyof typeof f, label: string, rows = 2, hint?: string) => (
    <label className="block text-xs text-zinc-400">
      {label}
      {hint && <span className="text-zinc-600"> — {hint}</span>}
      <textarea value={String(f[k])} onChange={set(k)} rows={rows} className={`${inputCls} mt-1 resize-y`} />
    </label>
  );

  return (
    <Modal title={lesson ? lessonLabel(lesson) : "Yangi mashg'ulot"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <label className="block text-xs text-zinc-400">
            Belgi
            <input value={f.code} onChange={set('code')} maxLength={8} placeholder="C3" className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-xs text-zinc-400">
            Tartib
            <input type="number" min={1} value={f.n} onChange={set('n')} className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-xs text-zinc-400">
            Hafta
            <input type="number" min={1} max={20} value={f.week} onChange={set('week')} className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-xs text-zinc-400">
            Turi
            <select value={f.kind} onChange={set('kind')} className={`${inputCls} mt-1`}>
              <option value="A">Wow mashg'ulot</option>
              <option value="C">Chempionat</option>
              <option value="Z">Zaxira</option>
            </select>
          </label>
        </div>
        <label className="block text-xs text-zinc-400">
          Hafta mavzusi
          <input value={f.weekTitle} onChange={set('weekTitle')} className={`${inputCls} mt-1`} />
        </label>
        <label className="block text-xs text-zinc-400">
          Nomi
          <input value={f.title} onChange={set('title')} className={`${inputCls} mt-1`} />
        </label>
        {area('goal', 'Maqsad')}
        {area('fact', 'Ilmiy fakt')}
        {area('prep', 'Tayyorgarlik', 3, 'har qator — bitta band')}
        {area('steps', 'Amaliyot qadamlari', 5, 'har qator — bitta qadam')}
        {area('wow', 'Wow lahza')}
        {area('artifact', 'Natija (portfolio)')}
        {area('homework', 'Mini-vazifa')}
        {area('tools', 'Vositalar', 2, 'har qatorda "Nomi | https://havola"')}
        {area('fallback', 'Zaxira varianti')}
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={f.isActive} onChange={(e) => setF((p) => ({ ...p, isActive: e.target.checked }))} />
          Faol (dasturda ko'rinadi)
        </label>
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:text-white">
            Bekor
          </button>
          <button type="button" onClick={save} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Saqlash
          </button>
        </div>
      </div>
    </Modal>
  );
}
