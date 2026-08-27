import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/layout/Header';
import { rankingsApi, botApi, groupsApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { Loader2, Send, Sparkles, CheckCircle2, XCircle, TrendingDown, TrendingUp, Minus, HelpCircle } from 'lucide-react';

type StudentCategory = 'past' | 'ortacha' | 'yuqori' | 'malumot_yoq';

interface CategoryRow {
  id: string;
  fullName: string;
  groupId: string | null;
  groupName: string | null;
  teacherName: string | null;
  percent: number | null;
  category: StudentCategory;
  parentLinked: boolean;
}

const CATEGORY_META: Record<StudentCategory, { label: string; color: string; icon: any }> = {
  yuqori: { label: 'Yuqori', color: 'emerald', icon: TrendingUp },
  ortacha: { label: "O'rtacha", color: 'amber', icon: Minus },
  past: { label: 'Past', color: 'red', icon: TrendingDown },
  malumot_yoq: { label: "Ma'lumot yo'q", color: 'zinc', icon: HelpCircle },
};

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' },
  zinc: { bg: 'bg-zinc-500/10', border: 'border-zinc-700', text: 'text-zinc-400' },
};

export default function StudentCategoriesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [counts, setCounts] = useState<Record<StudentCategory, number>>({ past: 0, ortacha: 0, yuqori: 0, malumot_yoq: 0 });
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<StudentCategory | 'all'>('all');

  const [message, setMessage] = useState('');
  const [polishing, setPolishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ total: number; sent: number; failed: number } | null>(null);
  const [sendCategory, setSendCategory] = useState<StudentCategory>('past');

  const load = async () => {
    setLoading(true);
    try {
      const [catRes, groupsRes] = await Promise.all([
        rankingsApi.getCategories(groupFilter ? { groupId: groupFilter } : undefined),
        groups.length ? Promise.resolve(null) : groupsApi.getAll(1, 200),
      ]);
      setRows(catRes.data.data.students);
      setCounts(catRes.data.data.counts);
      if (groupsRes) setGroups(groupsRes.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupFilter]);

  const displayedRows = useMemo(
    () => (activeCategory === 'all' ? rows : rows.filter((r) => r.category === activeCategory)),
    [rows, activeCategory]
  );

  const handlePolish = async () => {
    if (!message.trim()) return;
    setPolishing(true);
    try {
      const res = await botApi.aiPolishBroadcast(message);
      setMessage(res.data.data.polished);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'AI jilolashda xatolik');
    } finally {
      setPolishing(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    const recipientCount = rows.filter((r) => r.category === sendCategory && r.parentLinked).length;
    const ok = window.confirm(
      `"${CATEGORY_META[sendCategory].label}" kategoriyasidagi ${recipientCount} ta ulangan ota-onaga xabar yuboriladi. Davom etasizmi?`
    );
    if (!ok) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await botApi.broadcastToParents({
        groupId: groupFilter || undefined,
        category: sendCategory,
        message,
      });
      setSendResult(res.data.data);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Yuborishda xatolik');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Header
        title="Natija kategoriyalari"
        subtitle={isAdmin ? "Barcha o'quvchilar — past/o'rtacha/yuqori natija bo'yicha" : "Sizning o'quvchilaringiz — past/o'rtacha/yuqori natija bo'yicha"}
      />

      <div className="p-8 max-w-6xl mx-auto space-y-8">
        {/* Guruh filtri */}
        <div className="flex flex-wrap gap-2">
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="bg-[#18181b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">{isAdmin ? 'Barcha guruhlar' : 'Guruhlarim (barchasi)'}</option>
            {groups.map((g: any) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* Kategoriya kartalar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(Object.keys(CATEGORY_META) as StudentCategory[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const colors = COLOR_CLASSES[meta.color];
            const Icon = meta.icon;
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(active ? 'all' : cat)}
                className={`text-left bg-[#18181b] border rounded-xl p-5 flex items-center gap-4 transition-colors ${
                  active ? `${colors.border} ring-1 ring-inset ${colors.border}` : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className={`w-11 h-11 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 font-medium mb-1">{meta.label}</p>
                  <p className="text-xl font-bold text-white tracking-tight">{counts[cat]}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bir tugmali xabar — faqat admin */}
        {isAdmin && (
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
            <h3 className="text-white font-bold text-sm mb-4">Kategoriya bo'yicha bir tugmali xabar</h3>

            <div className="flex flex-wrap gap-2 mb-3">
              {(Object.keys(CATEGORY_META) as StudentCategory[])
                .filter((c) => c !== 'malumot_yoq')
                .map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const colors = COLOR_CLASSES[meta.color];
                  const active = sendCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSendCategory(cat)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                        active ? `${colors.border} ${colors.text} ${colors.bg}` : 'border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      {meta.label} ({counts[cat]})
                    </button>
                  );
                })}
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Xabar matnini yozing... {ism} — farzand ismi avtomatik qo'yiladi."
              rows={4}
              className="w-full bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 resize-none"
            />

            <div className="flex items-center justify-between mt-3">
              <button
                onClick={handlePolish}
                disabled={polishing || !message.trim()}
                className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 text-xs font-semibold disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {polishing ? 'Jilolanmoqda...' : 'AI bilan jilolash'}
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Yuborilmoqda...' : `"${CATEGORY_META[sendCategory].label}"ga yuborish`}
              </button>
            </div>

            {sendResult && (
              <div className="mt-3 text-sm text-zinc-300 bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2">
                ✅ {sendResult.sent} ta yetkazildi{sendResult.failed > 0 ? ` · ❌ ${sendResult.failed} ta xato` : ''} (jami {sendResult.total} ta ulangan ota-ona)
              </div>
            )}
          </div>
        )}

        {/* Ro'yxat */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-white font-bold text-sm">
              O'quvchilar {activeCategory !== 'all' && `— ${CATEGORY_META[activeCategory].label}`}
            </h3>
            <span className="text-xs text-zinc-500">{displayedRows.length} ta</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                  <th className="text-left px-5 py-3">O'quvchi</th>
                  <th className="text-left px-5 py-3">Guruh</th>
                  {isAdmin && <th className="text-left px-5 py-3">O'qituvchi</th>}
                  <th className="text-left px-5 py-3">Natija</th>
                  <th className="text-left px-5 py-3">Kategoriya</th>
                  <th className="text-left px-5 py-3">Ota-ona</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((r) => {
                  const meta = CATEGORY_META[r.category];
                  const colors = COLOR_CLASSES[meta.color];
                  return (
                    <tr key={r.id} className="border-b border-zinc-900">
                      <td className="px-5 py-3 text-white">{r.fullName}</td>
                      <td className="px-5 py-3 text-zinc-400">{r.groupName || '—'}</td>
                      {isAdmin && <td className="px-5 py-3 text-zinc-400">{r.teacherName || '—'}</td>}
                      <td className="px-5 py-3 text-zinc-300">{r.percent !== null ? `${r.percent}%` : '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md border ${colors.bg} ${colors.border} ${colors.text}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {r.parentLinked ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Ulangan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-zinc-600 text-xs font-medium">
                            <XCircle className="w-3.5 h-3.5" /> Ulanmagan
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
