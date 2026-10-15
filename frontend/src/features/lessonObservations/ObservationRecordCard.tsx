import { useState } from 'react';
import { ChevronDown, Clock3, Users } from 'lucide-react';
import type { ObservationRecord } from './types';
import { observationTime } from './types';

export default function ObservationRecordCard({ record, showTeacher = true }: { record: ObservationRecord; showTeacher?: boolean }) {
  const [open, setOpen] = useState(false);
  const sections = Array.from(new Set(record.scores.map(score => score.sectionId)));

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-4 text-left transition hover:bg-zinc-800/40 sm:px-5">
        <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 font-black text-blue-300">
          {record.totalScore}<span className="ml-0.5 self-end pb-2 text-[10px] font-medium text-zinc-500">/95</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{showTeacher ? record.teacherName : record.topic}</p>
          <p className="truncate text-xs text-zinc-400">{showTeacher ? `${record.groupName} · ${record.topic}` : record.groupName}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{observationTime(record.createdAt)}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{record.studentsPresent}/{record.studentsEnrolled}</span>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-zinc-800 px-4 py-5 sm:px-5">
          <p className="text-xs text-zinc-400">Forma № {record.id.slice(0, 8).toUpperCase()} · Kuzatuvchi: <span className="font-medium text-zinc-200">{record.observerName}</span></p>
          {sections.map(sectionId => {
            const scores = record.scores.filter(score => score.sectionId === sectionId);
            return (
              <section key={sectionId}>
                <div className="mb-2 flex items-center justify-between rounded-md bg-slate-950 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
                  <span>{scores[0].sectionTitle}</span>
                  <span>{scores.reduce((sum, item) => sum + item.score, 0)} / {scores.length * 5}</span>
                </div>
                <div className="divide-y divide-zinc-800/80 text-sm">
                  {scores.map(score => (
                    <div key={score.id} className="flex items-start justify-between gap-3 py-2 text-zinc-300">
                      <span>{score.label}</span><strong className="shrink-0 text-white">{score.score} / 5</strong>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          <div className="grid gap-3 sm:grid-cols-2">
            {record.childrenAnswer && <Note label="Bolalar javobi" value={record.childrenAnswer} />}
            <Note label="Kuchli tomonlari" value={record.strengths} />
            <Note label="Yaxshilash kerak" value={record.improvements} />
          </div>
        </div>
      )}
    </article>
  );
}

function Note({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
    <p className="whitespace-pre-wrap text-sm text-zinc-200">{value}</p>
  </div>;
}
