import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { lessonSessionsApi } from '@/api';
import { AlarmClock, Loader2, Unlock, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

interface UngradedItem {
  groupId: string;
  groupName: string;
  teacherId?: string;
  teacherName?: string;
}

interface Report {
  date: string;
  notOpened: UngradedItem[];
  notFinalized: UngradedItem[];
  notConfigured: UngradedItem[];
}

export default function LessonControlPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await lessonSessionsApi.adminUngraded();
      setReport(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUnlock = async (groupId: string, groupName: string) => {
    const note = window.prompt(`"${groupName}" guruhiga ruxsat berish sababi (majburiy):`);
    if (!note || !note.trim()) return;
    setUnlockingId(groupId);
    try {
      await lessonSessionsApi.adminUnlock(groupId, note.trim());
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setUnlockingId(null);
    }
  };

  const hasProblems = report && (report.notOpened.length > 0 || report.notFinalized.length > 0);

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Header title="Dars nazorati" subtitle="Bugun qaysi guruhlar baholanmadi" />

      <div className="p-8 max-w-5xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : !report ? null : !hasProblems && report.notConfigured.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-zinc-300 font-medium">Bugun barcha guruhlar baholandi.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {report.notOpened.length > 0 && (
              <section>
                <h3 className="text-red-400 font-bold text-sm mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Ochilmagan guruhlar ({report.notOpened.length})
                </h3>
                <div className="space-y-2">
                  {report.notOpened.map((g) => (
                    <div key={g.groupId} className="flex items-center justify-between bg-[#18181b] border border-red-500/20 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-white font-medium text-sm">{g.groupName}</p>
                        <p className="text-zinc-500 text-xs">{g.teacherName}</p>
                      </div>
                      <button
                        onClick={() => handleUnlock(g.groupId, g.groupName)}
                        disabled={unlockingId === g.groupId}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Ruxsat berish
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {report.notFinalized.length > 0 && (
              <section>
                <h3 className="text-amber-400 font-bold text-sm mb-3 flex items-center gap-2">
                  <AlarmClock className="w-4 h-4" />
                  Vaqt tugab avto-yopilgan ({report.notFinalized.length})
                </h3>
                <div className="space-y-2">
                  {report.notFinalized.map((g) => (
                    <div key={g.groupId} className="flex items-center justify-between bg-[#18181b] border border-amber-500/20 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-white font-medium text-sm">{g.groupName}</p>
                        <p className="text-zinc-500 text-xs">{g.teacherName}</p>
                      </div>
                      <button
                        onClick={() => handleUnlock(g.groupId, g.groupName)}
                        disabled={unlockingId === g.groupId}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Qayta ochish
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {report.notConfigured.length > 0 && (
              <section>
                <h3 className="text-zinc-400 font-bold text-sm mb-3 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Dars kuni belgilanmagan guruhlar ({report.notConfigured.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {report.notConfigured.map((g) => (
                    <span key={g.groupId} className="bg-[#18181b] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300">
                      {g.groupName}
                    </span>
                  ))}
                </div>
                <p className="text-zinc-600 text-xs mt-2">Guruh sahifasida "Dars kuni" (juft/toq/har kuni) belgilang.</p>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
