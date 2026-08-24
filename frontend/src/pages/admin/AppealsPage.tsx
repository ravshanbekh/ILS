import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { appealsApi } from '@/api';
import { downloadBlob } from '@/utils';
import { MessageSquare, Loader2, Download, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface Appeal {
  id: string;
  type: 'shikoyat' | 'taklif' | 'etiroz' | 'minnatdorchilik';
  message: string;
  aiReply: string | null;
  aiCategory: string | null;
  aiUrgency: number | null;
  status: 'yangi' | 'korib_chiqilmoqda' | 'hal_qilindi';
  adminReply: string | null;
  createdAt: string;
  student: { fullName: string };
  group: { name: string } | null;
  teacher: { fullName: string } | null;
}

const TYPE_LABELS: Record<string, string> = {
  shikoyat: '⚠️ Shikoyat',
  taklif: '💡 Taklif',
  etiroz: "❗ E'tiroz",
  minnatdorchilik: '🙏 Minnatdorchilik',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  yangi: { label: 'Yangi', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  korib_chiqilmoqda: { label: "Ko'rib chiqilmoqda", color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  hal_qilindi: { label: 'Hal qilindi', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
};

export default function AppealsPage() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Appeal | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const toIsoStart = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
  const toIsoEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined);

  const load = async () => {
    setLoading(true);
    try {
      const res = await appealsApi.getAll({
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        from: toIsoStart(fromDate),
        to: toIsoEnd(toDate),
      });
      setAppeals(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, fromDate, toDate]);

  const setPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setFromDate(from.toISOString().slice(0, 10));
    setToDate(to.toISOString().slice(0, 10));
  };

  const clearDates = () => {
    setFromDate('');
    setToDate('');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await appealsApi.exportExcel({ from: toIsoStart(fromDate), to: toIsoEnd(toDate) });
      downloadBlob(res.data, `murojaatlar_${fromDate || 'hammasi'}_${toDate || Date.now()}.xlsx`);
    } catch {
      alert('Eksport qilishda xatolik');
    } finally {
      setExporting(false);
    }
  };

  const openReply = (appeal: Appeal) => {
    setSelected(appeal);
    setReplyText(appeal.adminReply || '');
  };

  const handleSendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await appealsApi.reply(selected.id, replyText.trim());
      setSelected(null);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Javob yuborishda xatolik');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Header title="Murojaatlar" subtitle="Ota-onalardan kelgan shikoyat, taklif va e'tirozlar" />

      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-[#18181b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">Barcha turlar</option>
            <option value="shikoyat">Shikoyat</option>
            <option value="taklif">Taklif</option>
            <option value="etiroz">E'tiroz</option>
            <option value="minnatdorchilik">Minnatdorchilik</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-[#18181b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">Barcha statuslar</option>
            <option value="yangi">Yangi</option>
            <option value="korib_chiqilmoqda">Ko'rib chiqilmoqda</option>
            <option value="hal_qilindi">Hal qilindi</option>
          </select>

          <div className="flex items-center gap-1.5">
            <button onClick={() => setPreset(0)} className="px-2.5 py-2 rounded-lg text-xs font-semibold border border-zinc-800 text-zinc-400 hover:text-white">Bugun</button>
            <button onClick={() => setPreset(7)} className="px-2.5 py-2 rounded-lg text-xs font-semibold border border-zinc-800 text-zinc-400 hover:text-white">Hafta</button>
            <button onClick={() => setPreset(30)} className="px-2.5 py-2 rounded-lg text-xs font-semibold border border-zinc-800 text-zinc-400 hover:text-white">Oy</button>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-[#18181b] border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-white" />
            <span className="text-zinc-600 text-xs">—</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-[#18181b] border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-white" />
            {(fromDate || toDate) && (
              <button onClick={clearDates} className="text-zinc-500 hover:text-white text-xs px-1.5">✕</button>
            )}
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="ml-auto bg-[#18181b] hover:bg-zinc-800 text-zinc-300 px-4 py-2 rounded-lg text-sm font-medium border border-zinc-800 flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Yuklanmoqda...' : 'XLSX eksport'}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : appeals.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400">Murojaatlar yo'q.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appeals.map((a) => (
              <div key={a.id} className="bg-[#18181b] border border-zinc-800 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <span className="text-white font-semibold text-sm">{TYPE_LABELS[a.type]}</span>
                    <span className="text-zinc-500 text-xs ml-2">
                      {a.student.fullName} · {a.group?.name || '—'} · {a.teacher?.fullName || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.aiUrgency && a.aiUrgency >= 4 && (
                      <span className="inline-flex items-center gap-1 text-red-400 text-xs font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" /> {a.aiUrgency}/5
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2 py-1 rounded-full border ${STATUS_LABELS[a.status].color}`}>
                      {STATUS_LABELS[a.status].label}
                    </span>
                  </div>
                </div>
                <p className="text-zinc-300 text-sm mb-2">{a.message}</p>
                {a.adminReply ? (
                  <div className="bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-emerald-300 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    {a.adminReply}
                  </div>
                ) : (
                  <button
                    onClick={() => openReply(a)}
                    className="text-blue-400 hover:text-blue-300 text-xs font-semibold flex items-center gap-1"
                  >
                    <Clock className="w-3.5 h-3.5" /> Javob yozish
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-zinc-800 rounded-2xl w-full max-w-lg p-6">
            <h3 className="text-white font-bold text-sm mb-3">Javob yozish — {selected.student.fullName}</h3>
            <p className="text-zinc-400 text-sm mb-3">{selected.message}</p>
            {selected.aiReply && (
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2 text-xs text-violet-300 mb-3">
                🤖 AI taklifi: {selected.aiReply}
                <button
                  onClick={() => setReplyText(selected.aiReply || '')}
                  className="block mt-1 text-violet-400 underline text-xs"
                >
                  Shu matndan foydalanish
                </button>
              </div>
            )}
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              className="w-full bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white">
                Bekor qilish
              </button>
              <button
                onClick={handleSendReply}
                disabled={sendingReply || !replyText.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {sendingReply ? 'Yuborilmoqda...' : 'Yuborish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
