import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { settingsApi, authApi } from '@/api';
import { Settings, PlayCircle, Save, Loader2, CheckCircle2, AlertCircle, Video, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [platformUrl, setPlatformUrl] = useState('');
  const [platformTitle, setPlatformTitle] = useState('');
  const [platformDesc, setPlatformDesc] = useState('');
  const [normativeUrl, setNormativeUrl] = useState('');
  const [normativeTitle, setNormativeTitle] = useState('');
  const [normativeDesc, setNormativeDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Profile security state
  const [newLogin, setNewLogin] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    settingsApi.getTutorialVideos()
      .then((res) => {
        const data = res.data.data;
        if (data?.platformRules) {
          setPlatformUrl(data.platformRules.youtubeUrl || '');
          setPlatformTitle(data.platformRules.title || '');
          setPlatformDesc(data.platformRules.description || '');
        }
        if (data?.normativeRules) {
          setNormativeUrl(data.normativeRules.youtubeUrl || '');
          setNormativeTitle(data.normativeRules.title || '');
          setNormativeDesc(data.normativeRules.description || '');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await settingsApi.updateTutorialVideos({
        platformRules: {
          youtubeUrl: platformUrl,
          title: platformTitle,
          description: platformDesc,
        },
        normativeRules: {
          youtubeUrl: normativeUrl,
          title: normativeTitle,
          description: normativeDesc,
        },
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error(error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleProfileSave = async () => {
    setProfileError('');
    if (!newLogin && !newPassword) {
      setProfileError('Yangi login yoki parol kiriting');
      return;
    }
    if (newPassword && !currentPassword) {
      setProfileError('Joriy parolni kiriting');
      return;
    }
    setProfileSaving(true);
    try {
      await authApi.updateProfile({
        login: newLogin || undefined,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      setProfileStatus('success');
      setNewLogin('');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setProfileStatus('idle'), 3000);
    } catch (err: any) {
      setProfileError(err.response?.data?.error?.message || 'Xatolik yuz berdi');
      setProfileStatus('error');
      setTimeout(() => setProfileStatus('idle'), 3000);
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Header title="Sozlamalar" subtitle="Platforma sozlamalari va tutorial videolar" />

      <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">

        {/* Tutorial Videos Section */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-lg">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Tutorial Videolar</h2>
              <p className="text-xs text-zinc-400">O'quvchilar uchun ko'rsatma videolar — YouTube havolalari</p>
            </div>
          </div>

          <div className="p-5 space-y-8">

            {/* Video 1: Platforma ishlatish qoidalari */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 text-sm font-bold border border-blue-500/20">
                  1
                </div>
                <h3 className="text-sm font-bold text-white">Platforma ishlatish qoidalari</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-11">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-zinc-500 mb-1.5 font-medium">YouTube URL</label>
                  <div className="relative">
                    <input
                      type="url"
                      value={platformUrl}
                      onChange={(e) => setPlatformUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                    />
                    <PlayCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Sarlavha</label>
                  <input
                    type="text"
                    value={platformTitle}
                    onChange={(e) => setPlatformTitle(e.target.value)}
                    placeholder="Platforma ishlatish qoidalari"
                    className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Tavsif</label>
                  <input
                    type="text"
                    value={platformDesc}
                    onChange={(e) => setPlatformDesc(e.target.value)}
                    placeholder="Qisqacha tavsif..."
                    className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-800/50"></div>

            {/* Video 2: Normativ qoidalari bajarish */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-sm font-bold border border-emerald-500/20">
                  2
                </div>
                <h3 className="text-sm font-bold text-white">Normativ qoidalari bajarish</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-11">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-zinc-500 mb-1.5 font-medium">YouTube URL</label>
                  <div className="relative">
                    <input
                      type="url"
                      value={normativeUrl}
                      onChange={(e) => setNormativeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-200"
                    />
                    <PlayCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Sarlavha</label>
                  <input
                    type="text"
                    value={normativeTitle}
                    onChange={(e) => setNormativeTitle(e.target.value)}
                    placeholder="Normativ qoidalari bajarish"
                    className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Tavsif</label>
                  <input
                    type="text"
                    value={normativeDesc}
                    onChange={(e) => setNormativeDesc(e.target.value)}
                    placeholder="Qisqacha tavsif..."
                    className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-200"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="p-5 border-t border-zinc-800 flex items-center justify-between bg-[#09090b]/30">
            <div>
              {saveStatus === 'success' && (
                <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  Muvaffaqiyatli saqlandi!
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Xatolik yuz berdi
                </div>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-blue-500/20"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      </div>

        {/* Profile Security Section */}
        <div className="bg-[#18181b] border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Xavfsizlik</h2>
              <p className="text-xs text-zinc-400">Login va parolingizni o'zgartiring</p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Current login info */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#09090b] border border-zinc-800">
              <User className="w-4 h-4 text-zinc-400" />
              <span className="text-sm text-zinc-400">Joriy login:</span>
              <span className="text-sm font-bold text-white font-mono">{user?.login}</span>
            </div>

            {/* New login */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Yangi login (ixtiyoriy)</label>
              <input
                type="text"
                value={newLogin}
                onChange={(e) => setNewLogin(e.target.value)}
                placeholder="Yangi login..."
                className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
              />
            </div>

            <div className="border-t border-zinc-800/50" />

            {/* Current password */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Joriy parol (parol o'zgartirish uchun kerak)</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Joriy parol..."
                  className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Yangi parol (ixtiyoriy)</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Yangi parol..."
                  className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {profileError && (
              <div className="flex items-center gap-2 text-red-500 text-sm font-medium p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {profileError}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-zinc-800 flex items-center justify-between bg-[#09090b]/30">
            <div>
              {profileStatus === 'success' && (
                <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Muvaffaqiyatli saqlandi!
                </div>
              )}
            </div>
            <button
              onClick={handleProfileSave}
              disabled={profileSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-violet-500/20"
            >
              {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {profileSaving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
