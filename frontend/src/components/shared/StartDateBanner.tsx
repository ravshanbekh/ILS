/**
 * O'qituvchi paneli: "guruh boshlanish sanasi kiritilmagan" bildirishnomasi.
 *
 * Har sahifa tepasida turadi va YOPILMAYDI — sana kiritilgach o'zi yo'qoladi
 * (Promptokrat talabi, 2026-11-24). Sana shu yerning o'zida kiritiladi:
 * o'qituvchi o'z guruhiga bir marta kiritadi, keyin o'zgartirish — administrator.
 * Sana normativ deadline rejasi va demo day/imtihon jadvali uchun kerak.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarX2, Check, GraduationCap, Loader2 } from 'lucide-react';
import { apiErrorText, groupsApi } from '@/api';
import DateInput from '@/components/shared/DateInput';
import { useAuthStore } from '@/stores/authStore';

type Missing = { id: string; name: string };
const SHOW = 3;

export default function StartDateBanner() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<Missing[]>([]);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [all, setAll] = useState(false);
  // "Guruh bitirgan" — tasdiqlash so'raladigan guruh
  const [grad, setGrad] = useState<Missing | null>(null);

  useEffect(() => {
    if (user?.role !== 'teacher') return;
    let alive = true;
    groupsApi
      .startDateMissing()
      .then((r) => alive && setItems(r.data.data || []))
      .catch(() => {
        /* jim: banner ikkinchi darajali */
      });
    return () => {
      alive = false;
    };
  }, [user?.role, user?.id]);

  if (user?.role !== 'teacher' || items.length === 0) return null;

  const save = async (g: Missing) => {
    const d = dates[g.id];
    if (!d) return;
    setSaving(g.id);
    setErr('');
    try {
      await groupsApi.setStartDate(g.id, d);
      setItems((p) => p.filter((x) => x.id !== g.id));
    } catch (e) {
      setErr(apiErrorText(e));
    } finally {
      setSaving(null);
    }
  };

  // Guruh kursni tugatgan bo'lsa — sana so'ralmaydi: guruh "bitirgan" arxiviga o'tadi
  const graduate = async (g: Missing) => {
    setSaving(g.id);
    setErr('');
    try {
      await groupsApi.graduate(g.id);
      setItems((p) => p.filter((x) => x.id !== g.id));
      setGrad(null);
    } catch (e) {
      setErr(apiErrorText(e));
      setGrad(null);
    } finally {
      setSaving(null);
    }
  };

  const shown = all ? items : items.slice(0, SHOW);
  return (
    <div className="mx-4 mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 sm:mx-6" role="alert">
      <div className="flex items-start gap-3">
        <CalendarX2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-amber-200">
            {items.length === 1 ? 'Guruh boshlanish sanasi kiritilmagan' : `${items.length} ta guruhning boshlanish sanasi kiritilmagan`}
          </div>
          <p className="text-xs text-amber-200/70">
            Normativ deadline'lari va demo day/imtihon jadvali shu sanadan hisoblanadi. Guruh qachon boshlanganini kiriting (yoki kursni tugatgan
            bo'lsa — "Guruh bitirgan") — bu bildirishnoma shungacha turadi.
          </p>
          <div className="mt-2 space-y-2">
            {shown.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center gap-2">
                <Link to={`/teacher/groups/${g.id}`} className="min-w-[120px] text-sm font-medium text-white hover:underline">
                  {g.name}
                </Link>
                <div className="w-44">
                  <DateInput
                    value={dates[g.id] ?? ''}
                    onChange={(e) => setDates((p) => ({ ...p, [g.id]: e.target.value }))}
                    aria-label={`${g.name} boshlanish sanasi`}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100"
                  />
                </div>
                <button
                  type="button"
                  disabled={!dates[g.id] || saving === g.id}
                  onClick={() => save(g)}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
                >
                  {saving === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Saqlash
                </button>
                <button
                  type="button"
                  disabled={saving === g.id}
                  onClick={() => setGrad(g)}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-500/10 disabled:opacity-40"
                  title="Guruh kursni tugatgan bo'lsa — bitirganlar arxiviga o'tadi"
                >
                  <GraduationCap className="h-4 w-4" /> Guruh bitirgan
                </button>
              </div>
            ))}
          </div>
          {items.length > SHOW && (
            <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs text-amber-300 hover:underline">
              {all ? "Kamroq ko'rsatish" : `Yana ${items.length - SHOW} ta guruh`}
            </button>
          )}
          {err && <div className="mt-2 text-xs text-red-300">{err}</div>}
        </div>
      </div>

      {grad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Guruh bitirganini tasdiqlash">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-2 font-bold text-white">
              <GraduationCap className="h-5 w-5 text-amber-400" /> {grad.name} — guruh bitirdimi?
            </div>
            <p className="mt-2 text-sm text-zinc-300">
              Guruh "bitirgan guruhlar" arxiviga o'tadi: faol ro'yxatlar, reyting, deadline va jadvaldan chiqadi. O'quvchilarning natijalari
              saqlanadi. Xato bo'lsa administrator arxivdan qaytaradi.
            </p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setGrad(null)} className="flex-1 rounded-lg border border-zinc-800 py-2.5 text-sm text-zinc-300">
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={saving === grad.id}
                onClick={() => graduate(grad)}
                className="flex-1 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"
              >
                Ha, bitirdi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
