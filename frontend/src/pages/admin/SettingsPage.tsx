import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { settingsApi, authApi } from '@/api';
import {
  Settings, PlayCircle, Save, Loader2, CheckCircle2, AlertCircle,
  Video, Lock, User, Eye, EyeOff, Brain, ChevronDown
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

// ─── Accordion wrapper ───────────────────────────────────────────────────────
interface AccordionProps {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  openId: string | null;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

function AccordionSection({ id, icon, iconBg, title, subtitle, badge, openId, onToggle, children }: AccordionProps) {
  const isOpen = openId === id;
  return (
    <div className={`bg-[#18181b] border rounded-2xl overflow-hidden transition-all duration-200 ${isOpen ? 'border-zinc-600' : 'border-zinc-800'}`}>
      <button
        onClick={() => onToggle(id)}
        className="w-full p-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shadow-lg shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
        <ChevronDown
          className={`w-5 h-5 text-zinc-500 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="border-t border-zinc-800">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Input bileşeni ──────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}

const inputCls = (accent = 'blue') =>
  `w-full bg-[#09090b] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-${accent}-500/50 focus:border-${accent}-500 transition-all duration-200`;

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuthStore();

  // Tutorial video state
  const [platformUrl, setPlatformUrl] = useState('');
  const [platformTitle, setPlatformTitle] = useState('');
  const [platformDesc, setPlatformDesc] = useState('');
  const [normativeUrl, setNormativeUrl] = useState('');
  const [normativeTitle, setNormativeTitle] = useState('');
  const [normativeDesc, setNormativeDesc] = useState('');
  const [obsUrl, setObsUrl] = useState('');
  const [obsTitle, setObsTitle] = useState('');
  const [obsDesc, setObsDesc] = useState('');
  const [ytChannelUrl, setYtChannelUrl] = useState('');
  const [ytChannelTitle, setYtChannelTitle] = useState('');
  const [ytChannelDesc, setYtChannelDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Security state
  const [newLogin, setNewLogin] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [profileError, setProfileError] = useState('');

  // AI state
  const [aiProvider, setAiProvider] = useState<'gemini' | 'groq'>('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('');
  const [geminiStatus, setGeminiStatus] = useState<any>(null);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqModel, setGroqModel] = useState('');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaveStatus, setAiSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [centerContext, setCenterContext] = useState('');

  // Accordion — faqat bitta ochiq
  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggleSection = (id: string) => setOpenSection(prev => prev === id ? null : id);

  useEffect(() => {
    settingsApi.getTutorialVideos()
      .then((res) => {
        const data = res.data.data;
        if (data?.platformRules) { setPlatformUrl(data.platformRules.youtubeUrl || ''); setPlatformTitle(data.platformRules.title || ''); setPlatformDesc(data.platformRules.description || ''); }
        if (data?.normativeRules) { setNormativeUrl(data.normativeRules.youtubeUrl || ''); setNormativeTitle(data.normativeRules.title || ''); setNormativeDesc(data.normativeRules.description || ''); }
        if (data?.obsStudio) { setObsUrl(data.obsStudio.youtubeUrl || ''); setObsTitle(data.obsStudio.title || ''); setObsDesc(data.obsStudio.description || ''); }
        if (data?.youtubeChannel) { setYtChannelUrl(data.youtubeChannel.youtubeUrl || ''); setYtChannelTitle(data.youtubeChannel.title || ''); setYtChannelDesc(data.youtubeChannel.description || ''); }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    settingsApi.getGeminiStatus()
      .then(res => {
        const data = res.data.data;
        setGeminiStatus(data);
        setGeminiModel(data?.model || 'gemini-2.5-flash');
        setGroqModel(data?.groqModel || 'llama-3.3-70b-versatile');
        setAiProvider(data?.aiProvider || 'gemini');
        setCenterContext(data?.centerContext || '');
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaveStatus('idle');
    try {
      await settingsApi.updateTutorialVideos({
        platformRules: { youtubeUrl: platformUrl, title: platformTitle, description: platformDesc },
        normativeRules: { youtubeUrl: normativeUrl, title: normativeTitle, description: normativeDesc },
        obsStudio: { youtubeUrl: obsUrl, title: obsTitle, description: obsDesc },
        youtubeChannel: { youtubeUrl: ytChannelUrl, title: ytChannelTitle, description: ytChannelDesc },
      });
      setSaveStatus('success'); setTimeout(() => setSaveStatus('idle'), 3000);
    } catch { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 3000); }
    finally { setSaving(false); }
  };

  const handleProfileSave = async () => {
    setProfileError('');
    if (!newLogin && !newPassword) { setProfileError('Yangi login yoki parol kiriting'); return; }
    if (newPassword && !currentPassword) { setProfileError('Joriy parolni kiriting'); return; }
    setProfileSaving(true);
    try {
      await authApi.updateProfile({ login: newLogin || undefined, currentPassword: currentPassword || undefined, newPassword: newPassword || undefined });
      setProfileStatus('success'); setNewLogin(''); setCurrentPassword(''); setNewPassword('');
      setTimeout(() => setProfileStatus('idle'), 3000);
    } catch (err: any) {
      setProfileError(err.response?.data?.error?.message || 'Xatolik yuz berdi');
      setProfileStatus('error'); setTimeout(() => setProfileStatus('idle'), 3000);
    } finally { setProfileSaving(false); }
  };

  const handleAiSave = async () => {
    setAiSaving(true); setAiSaveStatus('idle');
    try {
      const res = await settingsApi.updateGemini({ apiKey: geminiApiKey || undefined, model: geminiModel || undefined, groqApiKey: groqApiKey || undefined, groqModel: groqModel || undefined, aiProvider, centerContext } as any);
      setGeminiStatus(res.data.data); setAiSaveStatus('success');
      setGeminiApiKey(''); setGroqApiKey('');
      setTimeout(() => setAiSaveStatus('idle'), 3000);
    } catch { setAiSaveStatus('error'); setTimeout(() => setAiSaveStatus('idle'), 3000); }
    finally { setAiSaving(false); }
  };

  const handleAiTest = async () => {
    setAiTesting(true); setAiTestResult(null);
    try {
      const res = await settingsApi.testGemini();
      setAiTestResult(res.data.data);
    } catch (e: any) {
      setAiTestResult({ success: false, message: e.response?.data?.message || 'Xatolik yuz berdi' });
    } finally { setAiTesting(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 text-primary-500 animate-spin" /></div>;
  }

  // ─── AI badge ───
  const isAiConnected = aiProvider === 'groq' ? geminiStatus?.isGroqConfigured : geminiStatus?.isConfigured;
  const aiBadge = (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isAiConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
      {isAiConnected ? '● Ulangan' : '● Ulanmagan'}
    </span>
  );

  return (
    <div>
      <Header title="Sozlamalar" subtitle="Platforma sozlamalari va konfiguratsiya" />

      <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-3">

        {/* ── 1. Tutorial Videolar ── */}
        <AccordionSection
          id="videos"
          icon={<Video className="w-5 h-5 text-white" />}
          iconBg="bg-gradient-to-br from-red-500 to-pink-600"
          title="Tutorial Videolar"
          subtitle="O'quvchilar uchun ko'rsatma videolar — YouTube havolalari"
          openId={openSection}
          onToggle={toggleSection}
        >
          <div className="p-5 space-y-7">
            {[
              { num: 1, label: 'Platforma ishlatish qoidalari', color: 'blue', url: platformUrl, setUrl: setPlatformUrl, title: platformTitle, setTitle: setPlatformTitle, desc: platformDesc, setDesc: setPlatformDesc },
              { num: 2, label: 'Normativ qoidalari bajarish', color: 'emerald', url: normativeUrl, setUrl: setNormativeUrl, title: normativeTitle, setTitle: setNormativeTitle, desc: normativeDesc, setDesc: setNormativeDesc },
              { num: 3, label: 'OBS Studio o\'rnatish va sozlash', color: 'purple', url: obsUrl, setUrl: setObsUrl, title: obsTitle, setTitle: setObsTitle, desc: obsDesc, setDesc: setObsDesc },
              { num: 4, label: 'YouTube kanal ochish va video joylash', color: 'red', url: ytChannelUrl, setUrl: setYtChannelUrl, title: ytChannelTitle, setTitle: setYtChannelTitle, desc: ytChannelDesc, setDesc: setYtChannelDesc },
            ].map(({ num, label, color, url, setUrl, title, setTitle, desc, setDesc }) => (
              <div key={num} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg bg-${color}-500/10 flex items-center justify-center text-${color}-500 text-xs font-bold border border-${color}-500/20 shrink-0`}>{num}</div>
                  <h3 className="text-sm font-semibold text-white">{label}</h3>
                </div>
                <div className="pl-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 relative">
                    <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className={inputCls(color)} />
                    <PlayCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                  </div>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Sarlavha..." className={inputCls(color)} />
                  <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Tavsif..." className={inputCls(color)} />
                </div>
                {num < 4 && <div className="border-t border-zinc-800/50 pl-10" />}
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-between bg-[#09090b]/40">
            <div>
              {saveStatus === 'success' && <span className="flex items-center gap-1.5 text-emerald-500 text-sm"><CheckCircle2 className="w-4 h-4" />Saqlandi!</span>}
              {saveStatus === 'error' && <span className="flex items-center gap-1.5 text-red-500 text-sm"><AlertCircle className="w-4 h-4" />Xatolik!</span>}
            </div>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-pink-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-red-500/20">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </AccordionSection>

        {/* ── 2. AI Sozlamalari ── */}
        <AccordionSection
          id="ai"
          icon={<Brain className="w-5 h-5 text-white" />}
          iconBg="bg-gradient-to-br from-indigo-500 to-cyan-600"
          title="AI Sozlamalari"
          subtitle="Sun'iy intellekt uchun API Key va model sozlamalari"
          badge={aiBadge}
          openId={openSection}
          onToggle={toggleSection}
        >
          <div className="p-5 space-y-5">
            <Field label="AI Provayderi">
              <select value={aiProvider} onChange={e => setAiProvider(e.target.value as 'gemini' | 'groq')} className={inputCls('indigo')}>
                <option value="gemini">Google Gemini API</option>
                <option value="groq">Groq Cloud API</option>
              </select>
            </Field>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#09090b] border border-zinc-800">
              <div className={`w-2.5 h-2.5 rounded-full ${isAiConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-sm text-zinc-400">Holat:</span>
              <span className={`text-sm font-bold ${isAiConnected ? 'text-emerald-500' : 'text-red-500'}`}>
                {aiProvider === 'groq' ? (geminiStatus?.isGroqConfigured ? 'Ulangan (Groq)' : 'Ulanmagan (Groq)') : (geminiStatus?.isConfigured ? 'Ulangan (Gemini)' : 'Ulanmagan (Gemini)')}
              </span>
            </div>

            {aiProvider === 'gemini' ? (
              <>
                <Field label="Gemini API Key (mavjudini o'zgartirish uchun)">
                  <input type="password" value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)} placeholder="AIzaSy..." className={inputCls('indigo')} />
                </Field>
                <Field label="Model">
                  <select value={geminiModel} onChange={e => setGeminiModel(e.target.value)} className={inputCls('indigo')}>
                    <option value="gemini-2.5-flash">gemini-2.5-flash (Tavsiya etiladi)</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash (Tezkor)</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash (Klassik)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (Kuchli)</option>
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field label="Groq API Key (mavjudini o'zgartirish uchun)">
                  <input type="password" value={groqApiKey} onChange={e => setGroqApiKey(e.target.value)} placeholder="gsk_..." className={inputCls('indigo')} />
                </Field>
                <Field label="Model">
                  <select value={groqModel} onChange={e => setGroqModel(e.target.value)} className={inputCls('indigo')}>
                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Tavsiya etiladi)</option>
                    <option value="llama3-70b-8192">llama3-70b-8192</option>
                    <option value="llama3-8b-8192">llama3-8b-8192 (Tezkor)</option>
                    <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                  </select>
                </Field>
              </>
            )}

            <Field label="O'quv markazi ma'lumotlari (AI uchun kontekst)">
              <textarea value={centerContext} onChange={e => setCenterContext(e.target.value)} placeholder="Bizning o'quv markazimiz haqida: kurslar, narxlar, afzalliklar..." rows={5} className={`${inputCls('indigo')} resize-y`} />
              <p className="text-xs text-zinc-600 mt-1">AI har bir o'quvchi uchun individual suhbat yozishda qo'shimcha kontekst sifatida ishlatadi.</p>
            </Field>

            {aiTestResult && (
              <div className={`p-3 rounded-xl text-sm font-medium flex items-start gap-2 ${aiTestResult.success ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                {aiTestResult.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                {aiTestResult.message}
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-between bg-[#09090b]/40">
            <div className="flex items-center gap-3">
              {aiSaveStatus === 'success' && <span className="flex items-center gap-1.5 text-emerald-500 text-sm"><CheckCircle2 className="w-4 h-4" />Saqlandi!</span>}
              {aiSaveStatus === 'error' && <span className="flex items-center gap-1.5 text-red-500 text-sm"><AlertCircle className="w-4 h-4" />Xatolik!</span>}
              <button onClick={handleAiTest} disabled={aiTesting} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors flex items-center gap-2 disabled:opacity-50">
                {aiTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                Test qilish
              </button>
            </div>
            <button onClick={handleAiSave} disabled={aiSaving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20">
              {aiSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {aiSaving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </AccordionSection>

        {/* ── 3. Xavfsizlik ── */}
        <AccordionSection
          id="security"
          icon={<Lock className="w-5 h-5 text-white" />}
          iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
          title="Xavfsizlik"
          subtitle="Login va parolingizni o'zgartiring"
          openId={openSection}
          onToggle={toggleSection}
        >
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#09090b] border border-zinc-800">
              <User className="w-4 h-4 text-zinc-400" />
              <span className="text-sm text-zinc-400">Joriy login:</span>
              <span className="text-sm font-bold text-white font-mono">{user?.login}</span>
            </div>

            <Field label="Yangi login (ixtiyoriy)">
              <input type="text" value={newLogin} onChange={e => setNewLogin(e.target.value)} placeholder="Yangi login..." className={inputCls('violet')} />
            </Field>

            <div className="border-t border-zinc-800/50" />

            <Field label="Joriy parol (parol o'zgartirish uchun majburiy)">
              <div className="relative">
                <input type={showCurrentPw ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Joriy parol..." className={`${inputCls('violet')} pr-11`} />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            <Field label="Yangi parol (ixtiyoriy)">
              <div className="relative">
                <input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Yangi parol..." className={`${inputCls('violet')} pr-11`} />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            {profileError && (
              <div className="flex items-center gap-2 text-red-500 text-sm p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 shrink-0" />{profileError}
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-between bg-[#09090b]/40">
            <div>
              {profileStatus === 'success' && <span className="flex items-center gap-1.5 text-emerald-500 text-sm"><CheckCircle2 className="w-4 h-4" />Muvaffaqiyatli saqlandi!</span>}
            </div>
            <button onClick={handleProfileSave} disabled={profileSaving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-violet-500/20">
              {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {profileSaving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </AccordionSection>

      </div>
    </div>
  );
}
