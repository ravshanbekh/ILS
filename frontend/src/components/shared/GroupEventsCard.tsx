import { useEffect, useState } from 'react';
import { groupEventsApi } from '@/api';
import { PartyPopper, Plus, Trash2, Users, Loader2 } from 'lucide-react';

interface EventRow {
  id: string;
  title: string;
  eventAt: string;
  place: string | null;
  invitedAt: string | null;
  _count: { rsvps: number };
}

interface Props {
  groupId: string;
}

export default function GroupEventsCard({ groupId }: Props) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('Demo Day');
  const [eventAt, setEventAt] = useState('');
  const [place, setPlace] = useState('');
  const [saving, setSaving] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, { boraman: number; yoq: number; aniqEmas: number; total: number }>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await groupEventsApi.getByGroup(groupId);
      setEvents(res.data.data);
      const entries = await Promise.all(
        res.data.data.map(async (e: EventRow) => {
          const s = await groupEventsApi.getRsvpSummary(e.id);
          return [e.id, s.data.data] as const;
        })
      );
      setSummaries(Object.fromEntries(entries));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const handleCreate = async () => {
    if (!title.trim() || !eventAt) return;
    setSaving(true);
    try {
      await groupEventsApi.create({
        groupId,
        title: title.trim(),
        eventAt: new Date(eventAt).toISOString(),
        place: place.trim() || undefined,
      });
      setShowForm(false);
      setPlace('');
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || e?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tadbirni o'chirishni tasdiqlaysizmi?")) return;
    await groupEventsApi.delete(id);
    await load();
  };

  return (
    <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden mb-8">
      <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PartyPopper className="w-5 h-5 text-pink-400" />
          <div>
            <h3 className="text-white font-bold text-sm">Demo Day</h3>
            <p className="text-zinc-500 text-xs mt-0.5">Tadbir yaratish — ota-onalarga avtomatik taklifnoma va eslatma ketadi</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-pink-600 hover:bg-pink-700 text-white flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Yangi tadbir
        </button>
      </div>

      {showForm && (
        <div className="p-5 border-b border-zinc-800 bg-[#0f0f11] flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-zinc-500 text-xs block mb-1">Nomi</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-[#18181b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white w-40" />
          </div>
          <div>
            <label className="text-zinc-500 text-xs block mb-1">Sana va vaqt</label>
            <input type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} className="bg-[#18181b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-zinc-500 text-xs block mb-1">Manzil</label>
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Ixtiyoriy" className="bg-[#18181b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white w-40" />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !title.trim() || !eventAt}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : 'Yaratish'}
          </button>
        </div>
      )}

      <div className="p-5">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-blue-500 animate-spin" /></div>
        ) : events.length === 0 ? (
          <p className="text-zinc-500 text-sm">Hozircha tadbir yo'q.</p>
        ) : (
          <div className="space-y-2">
            {events.map((e) => {
              const s = summaries[e.id];
              return (
                <div key={e.id} className="flex items-center justify-between bg-[#0f0f11] border border-zinc-800 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{e.title}</p>
                    <p className="text-zinc-500 text-xs">
                      {new Date(e.eventAt).toLocaleString('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' })}
                      {e.place ? ` · ${e.place}` : ''}
                      {!e.invitedAt && ' · taklifnoma tez orada yuboriladi'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {s && (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                        <Users className="w-3.5 h-3.5" /> ✅ {s.boraman} · ❌ {s.yoq} · 🤔 {s.aniqEmas}
                      </span>
                    )}
                    <button onClick={() => handleDelete(e.id)} className="text-zinc-600 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
