import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/stores/authStore';
import { monitoringApi } from '@/api';
import {
  Phone, Brain, RefreshCw, Copy, Loader2, ChevronRight,
  AlertTriangle, X, Clock, Users, Plus, Trash2, Check,
  MessageSquare, History
} from 'lucide-react';

// ─── KONSTANTLAR ──────────────────────────────────────────────────────────────

const MOOD_CONFIG = {
  yaxshi:        { emoji: '😊', label: 'Yaxshi',         bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  oddiy:         { emoji: '😐', label: 'Oddiy',          bg: 'bg-zinc-600/20',    border: 'border-zinc-500/30',    text: 'text-zinc-400',    dot: 'bg-zinc-400'    },
  yomon:         { emoji: '😟', label: 'Yomon',          bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400',     dot: 'bg-red-500'     },
  javob_bermadi: { emoji: '📵', label: 'Javob bermadi',  bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   dot: 'bg-amber-500'   },
};

const STATUS_COLORS = {
  green: { dot: 'bg-emerald-500', label: 'Yaqinda',    text: 'text-emerald-400' },
  yellow:{ dot: 'bg-amber-500',  label: 'Bir hafta',   text: 'text-amber-400'  },
  red:   { dot: 'bg-red-500',    label: 'Uzoq vaqt',   text: 'text-red-400'    },
  gray:  { dot: 'bg-zinc-600',   label: 'Hali emas',   text: 'text-zinc-500'   },
};

const AVAILABLE_TAGS = [
  { key: 'ustoz_shikoyat',       label: "O'qituvchidan norozi",     color: 'text-red-400    border-red-500/30    bg-red-500/10'    },
  { key: 'tolov_muammo',         label: "To'lov muammosi",          color: 'text-amber-400  border-amber-500/30  bg-amber-500/10'  },
  { key: 'motivatsiya_past',     label: 'Motivatsiya past',         color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
  { key: 'qaytmoqchi',           label: 'Ketmoqchi',                color: 'text-rose-400   border-rose-500/30   bg-rose-500/10'   },
  { key: 'vaqt_noqulay',         label: 'Vaqt noqulay',             color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
  { key: 'dastur_murakkab',      label: 'Dastur murakkab',          color: 'text-blue-400   border-blue-500/30   bg-blue-500/10'   },
  { key: 'juda_hursand',         label: 'Juda hursand',             color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'},
  { key: 'tavsiya_qildi',        label: "Do'stlarini olib keladi",  color: 'text-teal-400   border-teal-500/30   bg-teal-500/10'   },
  { key: 'kasal',                label: 'Kasal / sog\'liq muammo',  color: 'text-pink-400   border-pink-500/30   bg-pink-500/10'   },
  { key: 'moliyaviy_qiyinchilik',label: 'Moliyaviy qiyinchilik',    color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
];

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function timeSince(d: string | Date) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Bugun';
  if (days === 1) return 'Kecha';
  return `${days} kun oldin`;
}

// ─── ASOSIY KOMPONENT ──────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const { user } = useAuthStore();

  // ── Holat ──
  const [groups, setGroups]                   = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading]     = useState(true);
  const [selectedGroup, setSelectedGroup]     = useState<any | null>(null);
  const [dashboard, setDashboard]             = useState<any | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [groupSearch, setGroupSearch]         = useState('');

  // ── Fikr qo'shish modal ──
  const [showNoteModal, setShowNoteModal]     = useState(false);
  const [noteStudent, setNoteStudent]         = useState<any | null>(null);
  const [activeCalls, setActiveCalls]         = useState<any[]>([]);
  const [selectedCallId, setSelectedCallId]   = useState('');
  const [noteForm, setNoteForm]               = useState({ mood: '', note: '', tags: [] as string[] });
  const [noteSaving, setNoteSaving]           = useState(false);

  // ── Timeline modal ──
  const [showTimeline, setShowTimeline]       = useState(false);
  const [timelineStudent, setTimelineStudent] = useState<any | null>(null);
  const [timelineData, setTimelineData]       = useState<any | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // ── AI tahlil ──
  const [showAI, setShowAI]                   = useState(false);
  const [aiLoading, setAiLoading]             = useState(false);
  const [aiResult, setAiResult]               = useState('');
  const [aiError, setAiError]                 = useState('');

  // ─── Guruhlarni yuklash ─────────────────────────────────────────────────────

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const res = await monitoringApi.getGroups();
      setGroups(res.data.data || []);
    } catch { setGroups([]); }
    finally { setGroupsLoading(false); }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // ─── Guruh tanlash ─────────────────────────────────────────────────────────

  const handleSelectGroup = async (group: any) => {
    setSelectedGroup(group);
    setDashboard(null);
    setAiResult('');
    setAiError('');
    setShowAI(false);
    setDashboardLoading(true);
    try {
      const res = await monitoringApi.getGroupDashboard(group.id);
      setDashboard(res.data.data);
    } catch { setDashboard(null); }
    finally { setDashboardLoading(false); }
  };

  // ─── Fikr qo'shish ─────────────────────────────────────────────────────────

  const handleOpenNoteModal = async (student: any) => {
    setNoteStudent(student);
    setNoteForm({ mood: '', note: '', tags: [] });
    setShowNoteModal(true);

    // Bugungi yoki mavjud call'ni topish / yangi yaratish
    if (selectedGroup) {
      try {
        const res = await monitoringApi.getGroupCalls(selectedGroup.id, { limit: 1 });
        const calls = res.data.data?.calls || [];
        const today = new Date().toDateString();
        const todayCall = calls.find((c: any) => new Date(c.callDate).toDateString() === today);
        if (todayCall) {
          setSelectedCallId(todayCall.id);
          setActiveCalls([todayCall]);
        } else {
          // Yangi call yaratish
          const newCall = await monitoringApi.createCall({ groupId: selectedGroup.id });
          setSelectedCallId(newCall.data.data.id);
          setActiveCalls([newCall.data.data]);
        }
      } catch { setSelectedCallId(''); }
    }
  };

  const toggleTag = (tag: string) => {
    setNoteForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
    }));
  };

  const handleSaveNote = async () => {
    if (!selectedCallId || !noteForm.mood || !noteForm.note.trim()) return;
    setNoteSaving(true);
    try {
      await monitoringApi.addNote(selectedCallId, {
        studentId: noteStudent.id,
        mood: noteForm.mood,
        note: noteForm.note.trim(),
        tags: noteForm.tags,
      });
      setShowNoteModal(false);
      // Dashboard'ni yangilash
      if (selectedGroup) {
        const res = await monitoringApi.getGroupDashboard(selectedGroup.id);
        setDashboard(res.data.data);
      }
      await loadGroups();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally { setNoteSaving(false); }
  };

  // ─── Timeline ──────────────────────────────────────────────────────────────

  const handleOpenTimeline = async (student: any) => {
    setTimelineStudent(student);
    setTimelineData(null);
    setShowTimeline(true);
    setTimelineLoading(true);
    try {
      const res = await monitoringApi.getStudentTimeline(student.id);
      setTimelineData(res.data.data);
    } catch { setTimelineData(null); }
    finally { setTimelineLoading(false); }
  };

  // ─── AI Tahlil ─────────────────────────────────────────────────────────────

  const handleAiAnalyze = async () => {
    if (!selectedGroup) return;
    setAiLoading(true);
    setAiError('');
    setAiResult('');
    try {
      const res = await monitoringApi.analyzeGroup(selectedGroup.id);
      setAiResult(res.data.data?.analysis || '');
    } catch (e: any) {
      const err = e?.response?.data?.error;
      if (err === 'API_KEY_NOT_SET') setAiError('api_key');
      else if (err === 'NO_DATA') setAiError('no_data');
      else setAiError('connection');
    } finally { setAiLoading(false); }
  };

  // ─── Filtrlangan guruhlar ───────────────────────────────────────────────────

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
    (g.teacher?.fullName || '').toLowerCase().includes(groupSearch.toLowerCase())
  );

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div>
      <Header
        title="📞 Monitoring"
        subtitle="Guruhlar bo'yicha o'quvchilar bilan doimiy aloqa va AI tahlil"
      />

      <div className="p-4 max-w-[1600px] mx-auto">
        <div className="flex gap-4 h-[calc(100vh-140px)]">

          {/* ══ CHAP PANEL: GURUHLAR ══════════════════════════════════════ */}
          <div className="w-72 shrink-0 flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {/* Sarlavha */}
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> Guruhlar
              </h2>
              <input
                placeholder="Qidirish..."
                value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-xs focus:border-blue-500 outline-none placeholder:text-zinc-600"
              />
            </div>

            {/* Guruhlar ro'yxati */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50">
              {groupsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
              ) : filteredGroups.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm">Guruh topilmadi</div>
              ) : (
                filteredGroups.map(g => {
                  const sc = STATUS_COLORS[g.statusColor as keyof typeof STATUS_COLORS] || STATUS_COLORS.gray;
                  const isSelected = selectedGroup?.id === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => handleSelectGroup(g)}
                      className={`w-full text-left px-4 py-3 transition-all ${isSelected ? 'bg-blue-600/10 border-l-2 border-blue-500' : 'hover:bg-zinc-800/50 border-l-2 border-transparent'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-zinc-200'}`}>{g.name}</span>
                        <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span>{g.teacher?.fullName || 'Ustoz yo\'q'}</span>
                        <span>·</span>
                        <span>{g.studentsCount} ta</span>
                      </div>
                      <div className={`text-xs mt-1 flex items-center gap-1 ${sc.text}`}>
                        <Clock className="w-3 h-3" />
                        {g.lastCallDate ? timeSince(g.lastCallDate) : 'Hali qo\'ng\'iroq yo\'q'}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ══ O'RTA PANEL: O'QUVCHILAR ══════════════════════════════════ */}
          <div className="flex-1 flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden min-w-0">
            {!selectedGroup ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                <Phone className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Guruh tanlang</p>
                <p className="text-sm mt-1 opacity-70">Chap paneldan guruhni tanlang</p>
              </div>
            ) : (
              <>
                {/* Guruh sarlavhasi */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-white font-bold">{selectedGroup.name}</h2>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {dashboard?.group?.teacher?.fullName && `O'qituvchi: ${dashboard.group.teacher.fullName} · `}
                      {dashboard?.students?.length || 0} ta o'quvchi
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Mood stats */}
                    {dashboard && (
                      <div className="flex items-center gap-1.5 bg-zinc-800/50 rounded-xl px-3 py-1.5">
                        {Object.entries(MOOD_CONFIG).map(([key, cfg]) => (
                          <span key={key} className="text-xs flex items-center gap-1">
                            <span>{cfg.emoji}</span>
                            <span className="text-zinc-400">{(dashboard.moodStats as any)[key] || 0}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setShowAI(!showAI)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                        showAI
                          ? 'bg-violet-600 text-white border-violet-500'
                          : 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20'
                      }`}
                    >
                      <Brain className="w-3.5 h-3.5" />
                      AI Tahlil
                    </button>
                  </div>
                </div>

                {/* AI tahlil paneli */}
                {showAI && (
                  <div className="border-b border-zinc-800 bg-violet-950/20 p-4 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-violet-300 font-semibold text-sm flex items-center gap-2">
                        <Brain className="w-4 h-4" /> AI Tahlil — {selectedGroup.name}
                      </h3>
                      <div className="flex gap-2">
                        {aiResult && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(aiResult); }}
                            className="flex items-center gap-1 px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg text-xs transition-colors"
                          >
                            <Copy className="w-3 h-3" /> Nusxalash
                          </button>
                        )}
                        <button
                          onClick={handleAiAnalyze}
                          disabled={aiLoading}
                          className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          {aiResult ? 'Qayta' : 'Tahlil qilish'}
                        </button>
                      </div>
                    </div>

                    {aiLoading && (
                      <div className="flex items-center gap-3 py-4 justify-center">
                        <div className="w-6 h-6 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
                        <span className="text-zinc-400 text-sm">AI tahlil qilmoqda...</span>
                      </div>
                    )}

                    {aiError && !aiLoading && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                        <div className="text-sm">
                          {aiError === 'api_key' && <p className="text-amber-300">AI API key sozlanmagan. Admin sozlamalaridan kiriting.</p>}
                          {aiError === 'no_data' && <p className="text-amber-300">Bu guruh uchun monitoring ma'lumotlari hali yo'q.</p>}
                          {aiError === 'connection' && <p className="text-amber-300">AI bilan bog'lanib bo'lmadi. Qayta urining.</p>}
                        </div>
                      </div>
                    )}

                    {aiResult && !aiLoading && (
                      <div
                        className="bg-zinc-950 rounded-xl p-4 text-zinc-200 text-xs leading-relaxed whitespace-pre-wrap border border-zinc-800"
                        style={{ maxHeight: '280px', overflowY: 'scroll' }}
                      >
                        {aiResult}
                      </div>
                    )}

                    {!aiResult && !aiLoading && !aiError && (
                      <p className="text-zinc-600 text-xs text-center py-2">
                        "Tahlil qilish" tugmasini bosing — AI oxirgi monitoring ma'lumotlarini o'qib xulosa beradi
                      </p>
                    )}
                  </div>
                )}

                {/* O'quvchilar ro'yxati */}
                <div className="flex-1 overflow-y-auto">
                  {dashboardLoading ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
                  ) : !dashboard || dashboard.students.length === 0 ? (
                    <div className="text-center py-16 text-zinc-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>O'quvchilar topilmadi</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800/50">
                      {dashboard.students.map((s: any) => {
                        const mood = s.lastNote?.mood;
                        const cfg = mood ? MOOD_CONFIG[mood as keyof typeof MOOD_CONFIG] : null;
                        return (
                          <div key={s.id} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-800/20 transition-colors group">
                            {/* Mood dot */}
                            <div className="mt-1">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${cfg ? cfg.bg + ' border ' + cfg.border : 'bg-zinc-800 border border-zinc-700'}`}>
                                {cfg ? cfg.emoji : '—'}
                              </div>
                            </div>

                            {/* Ma'lumot */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-white font-medium text-sm">{s.fullName}</p>
                                {cfg && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                                    {cfg.label}
                                  </span>
                                )}
                              </div>
                              {s.lastNote ? (
                                <>
                                  <p className="text-zinc-400 text-xs mt-0.5 line-clamp-1">{s.lastNote.note}</p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {s.lastNote.tags?.slice(0, 3).map((t: string) => {
                                      const tCfg = AVAILABLE_TAGS.find(x => x.key === t);
                                      return (
                                        <span key={t} className="text-xs px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
                                          {tCfg?.label || t}
                                        </span>
                                      );
                                    })}
                                    <span className="text-zinc-600 text-xs">{s.lastNote.callDate ? timeSince(s.lastNote.callDate) : ''}</span>
                                  </div>
                                </>
                              ) : (
                                <p className="text-zinc-600 text-xs mt-0.5 italic">Hali fikr yozilmagan</p>
                              )}
                            </div>

                            {/* Tugmalar */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleOpenTimeline(s)}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-blue-500/20 text-zinc-400 hover:text-blue-400 transition-colors"
                                title="Tarix"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenNoteModal(s)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Fikr
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══ FIKR QO'SHISH MODALI ══════════════════════════════════════════════ */}
      {showNoteModal && noteStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-lg border border-zinc-700 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div>
                <h2 className="text-white font-bold">Fikr qo'shish</h2>
                <p className="text-zinc-500 text-sm">{noteStudent.fullName}</p>
              </div>
              <button onClick={() => setShowNoteModal(false)} className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Mood tanlash */}
              <div>
                <label className="text-zinc-400 text-xs block mb-3">Holat tanlang *</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(MOOD_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setNoteForm(f => ({ ...f, mood: key }))}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        noteForm.mood === key
                          ? `${cfg.bg} ${cfg.border} ${cfg.text} border-2`
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      <span className="text-2xl">{cfg.emoji}</span>
                      <span className="font-medium text-sm">{cfg.label}</span>
                      {noteForm.mood === key && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Izoh */}
              <div>
                <label className="text-zinc-400 text-xs block mb-2">Izoh *</label>
                <textarea
                  placeholder="O'quvchi haqida qisqacha fikr yozing..."
                  value={noteForm.note}
                  onChange={e => setNoteForm(f => ({ ...f, note: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:border-blue-500 outline-none resize-none placeholder:text-zinc-600"
                />
              </div>

              {/* Teglar */}
              <div>
                <label className="text-zinc-400 text-xs block mb-2">Teglar (ixtiyoriy)</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TAGS.map(t => {
                    const selected = noteForm.tags.includes(t.key);
                    const [tc, bc, bg] = t.color.split(/\s+/);
                    return (
                      <button
                        key={t.key}
                        onClick={() => toggleTag(t.key)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                          selected ? `${bg} ${tc} ${bc} border-2` : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        {selected && <span className="mr-1">✓</span>}
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-zinc-800 flex gap-3">
              <button onClick={() => setShowNoteModal(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium transition-colors">
                Bekor
              </button>
              <button
                onClick={handleSaveNote}
                disabled={noteSaving || !noteForm.mood || !noteForm.note.trim()}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {noteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TIMELINE MODALI ═══════════════════════════════════════════════════ */}
      {showTimeline && timelineStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-xl border border-zinc-700 shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-gradient-to-r from-blue-950/20 to-zinc-900">
              <div>
                <h2 className="text-white font-bold">{timelineStudent.fullName}</h2>
                <p className="text-zinc-500 text-sm">Monitoring tarixi</p>
              </div>
              <button onClick={() => setShowTimeline(false)} className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-5">
              {timelineLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
              ) : !timelineData || timelineData.totalNotes === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Hali monitoring yozuvi yo'q</p>
                </div>
              ) : (
                <>
                  {/* Mood stats */}
                  <div className="grid grid-cols-4 gap-2 mb-5">
                    {Object.entries(MOOD_CONFIG).map(([key, cfg]) => (
                      <div key={key} className={`rounded-xl p-3 text-center border ${cfg.bg} ${cfg.border}`}>
                        <div className="text-xl">{cfg.emoji}</div>
                        <div className={`text-xl font-bold ${cfg.text}`}>{(timelineData.moodStats as any)[key] || 0}</div>
                        <div className={`text-xs ${cfg.text} opacity-70`}>{cfg.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Timeline yozuvlari */}
                  <div className="space-y-3">
                    {timelineData.notes.map((n: any, i: number) => {
                      const cfg = MOOD_CONFIG[n.mood as keyof typeof MOOD_CONFIG];
                      return (
                        <div key={n.id || i} className={`rounded-xl p-4 border ${cfg?.bg || 'bg-zinc-800'} ${cfg?.border || 'border-zinc-700'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{cfg?.emoji}</span>
                              <span className={`text-sm font-semibold ${cfg?.text}`}>{n.moodLabel}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-zinc-400 text-xs">{n.group?.name}</p>
                              <p className="text-zinc-600 text-xs">{formatDate(n.callDate)}</p>
                            </div>
                          </div>
                          <p className="text-zinc-200 text-sm">{n.note}</p>
                          {n.tagLabels && n.tagLabels.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {n.tagLabels.map((tl: string, ti: number) => (
                                <span key={ti} className="text-xs px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 border border-zinc-700">
                                  {tl}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-zinc-600 text-xs mt-2">{n.calledBy?.fullName && `Qo'ng'iroq qildi: ${n.calledBy.fullName}`}</p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
