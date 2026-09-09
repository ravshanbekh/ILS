import { useEffect, useRef, useState } from 'react';
import Header from '@/components/layout/Header';
import { usersApi, authApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { Loader2, Camera, Save, Check, AlertCircle, Building2, User as UserIcon } from 'lucide-react';

interface Filial {
  key: string;
  label: string;
}

/** Rasm URL manzilini to'liq holga keltiradi (backend nisbiy yo'l qaytaradi) */
function avatarSrc(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : url;
}

export default function MyProfilePage() {
  const { user, setUser } = useAuthStore();

  const [filials, setFilials] = useState<Filial[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [filial, setFilial] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, filialsRes] = await Promise.all([authApi.getMe(), usersApi.getFilials()]);
      const me = meRes.data.data;
      setAvatarUrl(me.avatarUrl || null);
      setBio(me.bio || '');
      setFilial(me.filial || '');
      setFilials(filialsRes.data.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Ma\'lumotni olishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pickPhoto = () => fileRef.current?.click();

  const onPhotoChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await usersApi.uploadMyAvatar(file);
      const url = res.data.data.avatarUrl;
      setAvatarUrl(url);
      // Sidebar/Header dagi rasm ham darrov yangilanishi uchun
      if (user) setUser({ ...user, avatarUrl: url });
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Rasm yuklanmadi');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await usersApi.updateMyCardProfile({ bio: bio.trim() || null, filial: filial || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const src = avatarSrc(avatarUrl);
  const initials = (user?.fullName || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Header title="Mening profilim" subtitle="O'quvchilar sizni shu ma'lumotlar bilan ko'radi" />

      <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-5">
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-zinc-300 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <p>
            Bu ma'lumotlar o'quvchining <span className="text-white font-semibold">yozilish sahifasida</span>{' '}
            kartochka bo'lib chiqadi. Rasm va qisqa ma'lumot bo'lsa, o'quvchi kimga
            yozilayotganini biladi.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Rasm */}
            <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-5">
              <h3 className="text-white font-bold text-sm mb-4">Profil rasmi</h3>
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  {src ? (
                    <img
                      src={src}
                      alt={user?.fullName || ''}
                      className="w-24 h-24 rounded-2xl object-cover border border-zinc-700"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-[#0f0f11] border border-zinc-800 flex items-center justify-center text-2xl font-bold text-zinc-600">
                      {initials}
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <button
                    onClick={pickPhoto}
                    disabled={uploading}
                    className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    {src ? 'Rasmni almashtirish' : 'Rasm yuklash'}
                  </button>
                  <p className="text-zinc-500 text-xs mt-2">JPG, PNG yoki WEBP · 3 MB gacha</p>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={onPhotoChosen}
                  className="hidden"
                />
              </div>
            </div>

            {/* Ma'lumot va filial */}
            <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-5 space-y-5">
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 mb-2">
                  <Building2 className="w-3.5 h-3.5" /> Filial
                </label>
                <select
                  value={filial}
                  onChange={(e) => setFilial(e.target.value)}
                  className="w-full bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white"
                >
                  <option value="">— tanlanmagan —</option>
                  {filials.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <p className="text-zinc-600 text-[11px] mt-1.5">
                  O'quvchi qaysi filialga borishini bilishi uchun kerak
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 mb-2">
                  <UserIcon className="w-3.5 h-3.5" /> Qisqa ma'lumot
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 300))}
                  rows={4}
                  placeholder="Masalan: Python va algoritmlar bo'yicha yordam beraman. Normativlarni tushunmagan bo'lsangiz keling."
                  className="w-full bg-[#0f0f11] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white resize-none"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-zinc-600 text-[11px]">Nima bo'yicha yordam berishingizni yozing</p>
                  <span className="text-zinc-600 text-[11px] tabular-nums">{bio.length}/300</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={save}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Saqlash
                </button>
                {saved && (
                  <span className="text-emerald-400 text-sm flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Saqlandi
                  </span>
                )}
              </div>
            </div>

            {/* Ko'rinish namunasi */}
            <div>
              <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wide mb-2">
                O'quvchi shunday ko'radi
              </h3>
              <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-4 max-w-[260px]">
                {src ? (
                  <img src={src} alt="" className="w-full aspect-square rounded-lg object-cover mb-3" />
                ) : (
                  <div className="w-full aspect-square rounded-lg bg-[#0f0f11] border border-zinc-800 flex items-center justify-center text-3xl font-bold text-zinc-700 mb-3">
                    {initials}
                  </div>
                )}
                <p className="text-white font-semibold text-sm">{user?.fullName}</p>
                {filial && (
                  <p className="text-zinc-500 text-xs flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3" />
                    {filials.find((f) => f.key === filial)?.label}
                  </p>
                )}
                <p className="text-zinc-400 text-xs mt-2 line-clamp-3">
                  {bio || <span className="text-zinc-600">Ma'lumot yozilmagan</span>}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
