/**
 * "Kurator" kartasi — o'quvchi profilida (xodim ko'rinishi) va o'quvchining
 * o'z bosh sahifasida. Kuratori bo'lmasa yoki ko'rishga ruxsat bo'lmasa —
 * hech narsa chizilmaydi (sahifa avvalgidek qoladi).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, HeartHandshake } from 'lucide-react';
import { curatorApi, type CuratorProgressSummary, type CuratorStatus, type CuratorTimeline } from '@/api';
import { ProgramProgress, StatusBadge, TimelineBar, shortDate } from '@/pages/curator/curatorCommon';

interface Data {
  status: CuratorStatus;
  demoDate: string;
  endDate: string;
  curatorName: string;
  timeline: CuratorTimeline;
  progress: CuratorProgressSummary;
  enrollmentId: string;
}

/** studentId berilsa — xodim ko'rinishi (/curator/summary), aks holda o'quvchining o'zi (/curator/me) */
export default function CuratorSummaryCard({ studentId, detailHref }: { studentId?: string; detailHref?: (enrollmentId: string) => string | null }) {
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    const req = studentId
      ? curatorApi.summary(studentId).then((r) => {
          const s = r.data.data;
          return s ? { status: s.status, demoDate: s.demoDate, endDate: s.endDate, curatorName: s.curator.fullName, timeline: s.timeline, progress: s.progress, enrollmentId: s.id } : null;
        })
      : curatorApi.me().then((r) => {
          const e = r.data.data.enrollment;
          return e ? { status: e.status, demoDate: e.demoDate, endDate: e.endDate, curatorName: e.curator.fullName, timeline: e.timeline, progress: e.progress, enrollmentId: e.id } : null;
        });
    req.then((v) => alive && setD(v)).catch(() => alive && setD(null));
    return () => {
      alive = false;
    };
  }, [studentId]);

  if (!d) return null;
  const href = studentId ? detailHref?.(d.enrollmentId) ?? null : '/student/curator';

  const body = (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700">
      <div className="mb-3 flex items-center gap-2">
        <HeartHandshake className="h-4 w-4 text-sky-400" />
        <p className="text-sm font-semibold text-zinc-100">
          Kurator: <span className="text-sky-300">{d.curatorName}</span>
        </p>
        <StatusBadge status={d.status} />
        <span className="ml-auto text-xs text-zinc-500">
          {shortDate(d.demoDate)} → {shortDate(d.endDate)}
        </span>
        {href && <ChevronRight className="h-4 w-4 text-zinc-500" />}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TimelineBar t={d.timeline} />
        <ProgramProgress p={d.progress} t={d.timeline} />
      </div>
    </div>
  );
  return href ? <Link to={href}>{body}</Link> : body;
}
