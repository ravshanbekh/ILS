import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { botApi, groupsApi } from '@/api';
import { Users, Loader2, Send, Sparkles, CheckCircle2, XCircle } from 'lucide-react';

interface ParentRow {
  id: string;
  fullName: string;
  groupId: string | null;
  groupName: string | null;
  teacherName: string | null;
  linked: boolean;
  parentName: string | null;
  parentUsername: string | null;
}

const TEMPLATES: Record<string, string> = {
  rahmatnoma: "Assalomu alaykum! {ism} bu hafta juda yaxshi natija ko'rsatdi — sizni tabriklaymiz va farzandingiz bilan faxrlanamiz! 🎉",
  taklif: "Assalomu alaykum! {ism} ning natijalarini yanada yaxshilash uchun sizga bir nechta tavsiyamiz bor edi. Vaqt topib botdagi haftalik hisobotni ko'rib chiqishingizni so'raymiz.",
  sustlik: "Assalomu alaykum! So'nggi kunlarda {ism} ning uy vazifalarini bajarishida sustlik kuzatildi. Iltimos, farzandingiz bilan gaplashib, sababini bilib olsangiz — birgalikda yechim topamiz.",
};

export default function ParentsPage() {
  const [rows, setRows] = useState<ParentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [linkedCount, setLinkedCount] = useState(0);
  const [coveragePercent, setCoveragePercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);

  const [message, setMessage] = useState('');
  const [polishing, setPolishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ total: number; sent: number; failed: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [coverageRes, groupsRes] = await Promise.all([
        botApi.getParentCoverage(groupFilter ? { groupId: groupFilter } : undefined),
        groups.length ? Promise.resolve(null) : groupsApi.getAll(1, 200),
      ]);
      setRows(coverageRes.data.data.students);
      setTotal(coverageRes.data.data.total);
      setLinkedCount(coverageRes.data.data.linkedCount);
      setCoveragePercent(coverageRes.data.data.coveragePercent);
      if (groupsRes) setGroups(groupsRes.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupFilter]);

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
    const recipientCount = displayedRows.filter((r) => r.linked).length;
    const ok = window.confirm(`${recipientCount} ta ota-onaga xabar yuboriladi. Davom etasizmi?`);
    if (!ok) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await botApi.broadcastToParents({ groupId: groupFilter || undefined, message });
      setSendResult(res.data.data);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Yuborishda xatolik');
    } finally {
      setSending(false);
    }
  };

  const displayedRows = onlyUnlinked ? rows.filter((r) => !r.linked) : rows;

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Header title="Ota-onalar bazasi" subtitle="Kim ulangan, kim yo'q + ommaviy xabar" />

      <div className="p-8 max-w-6xl mx-auto space-y-8">
        {/* Coverage stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-zinc-400 font-medium mb-1">Jami o'quvchi</p>
              <p className="text-2xl font-bold text-white tracking-tight">{total}</p>
            </div>
          </div>
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-zinc-400 font-medium mb-1">Ota-ona ulangan</p>
              <p className="text-2xl font-bold text-white tracking-tight">{linkedCount}</p>
            </div>
          </div>
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <span className="text-amber-500 font-bold text-lg">%</span>
            </div>
            <div>
              <p className="text-sm text-zinc-400 font-medium mb-1">Qamrov</p>
              <p className="text-2xl font-bold text-white tracking-tight">{coveragePercent}%</p>
            </div>
          </div>
        </div>

        {/* Broadcast */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6">
          <h3 className="text-white font-bold text-sm mb-4">Bir tugmali xabar</h3>

          <div className="flex flex-wrap gap-2 mb-3">
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Barcha guruhlar</option>
              {groups.map((g: any) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            {Object.entries(TEMPLATES).map(([key, tpl]) => (
              <button
                key={key}
                onClick={() => setMessage(tpl)}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-zinc-800 text-zinc-300 hover:border-blue-600 hover:text-blue-400"
              >
                {key === 'rahmatnoma' ? '🙏 Rahmatnoma' : key === 'taklif' ? '💡 Taklif' : '⚠️ Sustlik'}
              </button>
            ))}
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
              {sending ? 'Yuborilmoqda...' : 'Yuborish'}
            </button>
          </div>

          {sendResult && (
            <div className="mt-3 text-sm text-zinc-300 bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2">
              ✅ {sendResult.sent} ta yetkazildi{sendResult.failed > 0 ? ` · ❌ ${sendResult.failed} ta xato` : ''} (jami {sendResult.total} ta ulangan ota-ona)
            </div>
          )}
        </div>

        {/* List */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-white font-bold text-sm">O'quvchilar</h3>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input type="checkbox" checked={onlyUnlinked} onChange={(e) => setOnlyUnlinked(e.target.checked)} />
              Faqat ulanmaganlar
            </label>
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
                  <th className="text-left px-5 py-3">O'qituvchi</th>
                  <th className="text-left px-5 py-3">Ota-ona</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-900">
                    <td className="px-5 py-3 text-white">{r.fullName}</td>
                    <td className="px-5 py-3 text-zinc-400">{r.groupName || '—'}</td>
                    <td className="px-5 py-3 text-zinc-400">{r.teacherName || '—'}</td>
                    <td className="px-5 py-3">
                      {r.linked ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {r.parentName || 'Ulangan'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-zinc-600 text-xs font-medium">
                          <XCircle className="w-3.5 h-3.5" /> Ulanmagan
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
