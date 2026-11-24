/**
 * O'quvchi bosh sahifasi: shu haftaning normativ muddatlari, qo'shimcha muddat
 * va qizillar, keyingi hafta. Tizim yoqilmagan yoki band yo'q bo'lsa — ko'rinmaydi.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, ChevronRight } from 'lucide-react';
import { deadlinesApi, type StudentDeadlineItem, type StudentDeadlines } from '@/api';
import { STATE_META, dueLabel, leftLabel } from '@/pages/deadlines/deadlineCommon';

export default function StudentDeadlinesCard() {
  const [d, setD] = useState<StudentDeadlines | null>(null);
  useEffect(() => {
    deadlinesApi
      .me()
      .then((r) => setD(r.data.data))
      .catch(() => setD(null));
  }, []);
  if (!d || !d.enabled || d.items.length === 0) return null;

  const urgent = d.items.filter((i) => i.state === 'grace' || i.state === 'missed');
  const thisWeek = d.items.filter((i) => i.when === 'this' && i.state !== 'grace' && i.state !== 'missed');
  const next = d.items.filter((i) => i.when === 'next');
  const done = thisWeek.filter((i) => i.state === 'done' || i.state === 'grace_done' || i.state === 'late_done').length;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <AlarmClock className="h-5 w-5 text-amber-400" /> Normativ muddatlari
        </h2>
        <Link to="/student/normatives" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
          Topshirish <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Haftasiga {d.perWeek} ta normativ, muddat — har yakshanba 23:59 gacha. Ulgurmasangiz {d.graceDays} kun qo'shimcha imkon bor, undan keyin qizil bo'ladi.
      </p>

      {urgent.length > 0 && (
        <div className="mt-4 space-y-2">
          {urgent.map((i) => (
            <Row key={`${i.groupId}:${i.normativeId}`} i={i} now={d.now} />
          ))}
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Bu hafta {thisWeek.length > 0 && <span className="normal-case tracking-normal text-zinc-400">— {done}/{thisWeek.length} topshirildi</span>}
        </div>
        {thisWeek.length === 0 ? (
          <div className="text-sm text-zinc-500">Bu haftaga normativ yo'q</div>
        ) : (
          <div className="space-y-2">
            {thisWeek.map((i) => (
              <Row key={`${i.groupId}:${i.normativeId}`} i={i} now={d.now} />
            ))}
          </div>
        )}
      </div>

      {next.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-zinc-500">Keyingi hafta</div>
          {next.map((i) => (
            <div key={`${i.groupId}:${i.normativeId}`} className="text-sm text-zinc-400">
              <span className="ils-nm-num font-mono text-xs">#{i.taskNumber}</span> {i.title}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Row({ i, now }: { i: StudentDeadlineItem; now: string }) {
  const m = STATE_META[i.state];
  const hint =
    i.state === 'open'
      ? `Muddat: ${dueLabel(i.dueAt)} · ${leftLabel(i.dueAt, now)} qoldi`
      : i.state === 'grace'
        ? `Muddat o'tdi! Qo'shimcha muddat: ${dueLabel(i.graceEnd)} gacha · ${leftLabel(i.graceEnd, now)} qoldi`
        : i.state === 'missed'
          ? 'Muddat va qo\'shimcha muddat o\'tdi — baribir topshiring'
          : m.label;
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${i.state === 'missed' ? 'ils-nd-missed' : i.state === 'grace' ? 'ils-nd-grace' : 'bg-zinc-950/60'}`}>
      <span className={`inline-flex h-7 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold ${i.state === 'missed' || i.state === 'grace' ? '' : m.cls}`}>{m.short}</span>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-medium ${i.state === 'missed' ? '' : 'text-zinc-100'}`}>
          <span className="font-mono text-xs opacity-80">#{i.taskNumber}</span> {i.title}
        </div>
        <div className={`text-xs ${i.state === 'missed' || i.state === 'grace' ? 'opacity-90' : 'text-zinc-500'}`}>{hint}</div>
      </div>
    </div>
  );
}
