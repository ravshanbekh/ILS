import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { eventFeedbackApi, groupsApi, usersApi } from '@/api';
import { PartyPopper, Loader2, Sparkles, Smile, Meh, Frown } from 'lucide-react';

interface FeedbackRow {
  id: string;
  satisfaction: 'mamnun' | 'oddiy' | 'norozi';
  comment: string | null;
  createdAt: string;
  event: { title: string; eventAt: string };
  student: { fullName: string };
  group: { name: string };
  teacher: { fullName: string } | null;
}

const SATISFACTION_LABEL: Record<string, { emoji: string; text: string; color: string }> = {
  mamnun: { emoji: '😊', text: "Ko'ngli to'ldi", color: 'text-emerald-400' },
  oddiy: { emoji: '😐', text: 'Oddiy', color: 'text-amber-400' },
  norozi: { emoji: '😞', text: 'Yoqmadi', color: 'text-red-400' },
};

export default function EventFeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [stats, setStats] = useState({ total: 0, mamnun: 0, oddiy: 0, norozi: 0 });
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');

  const [analysis, setAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  const filters = { groupId: groupFilter || undefined, teacherId: teacherFilter || undefined };

  const load = async () => {
    setLoading(true);
    try {
      const [feedbackRes, statsRes] = await Promise.all([
        eventFeedbackApi.getAll(filters),
        eventFeedbackApi.getStats(filters),
      ]);
      setRows(feedbackRes.data.data);
      setStats(statsRes.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const [groupsRes, teachersRes] = await Promise.all([
        groupsApi.getAll(1, 200),
        usersApi.getAll(1, 200, 'teacher'),
      ]);
      setGroups(groupsRes.data.data || []);
      setTeachers(teachersRes.data.data || []);
    })();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupFilter, teacherFilter]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeError('');
    setAnalysis('');
    try {
      const res = await eventFeedbackApi.aiAnalyze(filters);
      setAnalysis(res.data.data.analysis);
    } catch (e: any) {
      const err = e?.response?.data?.error;
      setAnalyzeError(err === 'API_KEY_NOT_SET' ? 'api_key' : err === 'NO_DATA' ? 'no_data' : 'connection');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Header title="Demo Day fikrlari" subtitle="Tadbirdan keyin ota-onalardan yig'ilgan fikr-mulohaza" />

      <div className="p-8 max-w-6xl mx-auto space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="bg-[#18181b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">Barcha guruhlar</option>
            {groups.map((g: any) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className="bg-[#18181b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">Barcha o'qituvchilar</option>
            {teachers.map((t: any) => (
              <option key={t.id} value={t.id}>{t.fullName}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <PartyPopper className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-zinc-400 font-medium mb-1">Jami fikr</p>
              <p className="text-2xl font-bold text-white tracking-tight">{stats.total}</p>
            </div>
          </div>
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Smile className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-zinc-400 font-medium mb-1">Ko'ngli to'lgan</p>
              <p className="text-2xl font-bold text-white tracking-tight">{stats.mamnun}</p>
            </div>
          </div>
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Meh className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-zinc-400 font-medium mb-1">Oddiy</p>
              <p className="text-2xl font-bold text-white tracking-tight">{stats.oddiy}</p>
            </div>
          </div>
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <Frown className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-zinc-400 font-medium mb-1">Yoqmagan</p>
              <p className="text-2xl font-bold text-white tracking-tight">{stats.norozi}</p>
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <div>
                <h3 className="text-white font-bold text-sm">AI Tahlil</h3>
                <p className="text-zinc-500 text-xs mt-0.5">Muammo, kamchilik va keyingi tadbirgacha tuzatish tavsiyalari</p>
              </div>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {analyzing ? 'Tahlil qilinmoqda...' : 'Tahlil qilish'}
            </button>
          </div>
          {analyzeError && (
            <div className="p-5 text-sm text-amber-400">
              {analyzeError === 'api_key' && 'AI sozlanmagan (Gemini/Groq API key yo\'q).'}
              {analyzeError === 'no_data' && 'Bu filtr bo\'yicha hozircha fikr-mulohaza yo\'q.'}
              {analyzeError === 'connection' && 'Tahlil qilishda xatolik yuz berdi.'}
            </div>
          )}
          {analysis && (
            <div className="p-6 text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap bg-[#09090b]/40">
              {analysis}
            </div>
          )}
        </div>

        {/* List */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h3 className="text-white font-bold text-sm">Barcha fikrlar</h3>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">Hozircha fikr-mulohaza yo'q.</div>
          ) : (
            <div className="divide-y divide-zinc-900">
              {rows.map((r) => {
                const s = SATISFACTION_LABEL[r.satisfaction];
                return (
                  <div key={r.id} className="p-5 flex items-start gap-4">
                    <span className="text-2xl">{s.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1 flex-wrap">
                        <span className={`font-semibold ${s.color}`}>{s.text}</span>
                        <span>·</span>
                        <span className="text-zinc-300 font-medium">{r.student.fullName}</span>
                        <span>·</span>
                        <span>{r.event.title}</span>
                        <span>·</span>
                        <span>{r.group.name}</span>
                        <span>·</span>
                        <span>{r.teacher?.fullName || '—'}</span>
                        <span>·</span>
                        <span>{new Date(r.createdAt).toLocaleDateString('uz-UZ')}</span>
                      </div>
                      {r.comment && <p className="text-zinc-300 text-sm">{r.comment}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
