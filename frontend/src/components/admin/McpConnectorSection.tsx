import { useEffect, useState } from 'react';
import { Copy, Check, Loader2, Trash2, ShieldCheck, Eye, PencilLine, RefreshCw, AlertCircle } from 'lucide-react';
import { mcpApi, type McpConnection } from '@/api';

/**
 * Sozlamalar → Claude (MCP).
 * Claude (claude.ai) connector'ini ulash yo'riqnomasi, server manzili va
 * faol ulanishlar (uzish bilan). Backend: src/mcp/connections.routes.ts
 */

const EXAMPLES_READ = [
  'Bugungi umumiy holat qanday? Qaysi guruhlarda muammo bor?',
  'Frontend guruhlarida normativlarni eng sust bajarayotgan 10 o\'quvchini top va sababini tahlil qil',
  'Ustozlar normativlarni o\'rtacha qancha vaqtda tekshirayapti? Reyting tuz',
  'Kechikkan demo day va imtihonlar ro\'yxatini ustoz bo\'yicha guruhla',
];
const EXAMPLES_WRITE = [
  'FN-12 guruhini oching: ustozi Aliyev, 2026-11-01 dan 6 oy, juft kunlar',
  'Shu o\'quvchini FN-07 dan FN-09 ga o\'tkaz',
  'BE-03 guruhiga 21–25 normativlarni biriktir',
];

// uz-UZ lokali brauzerlarda "2026 M10 12" ko'rinishini beradi — qo'lda formatlaymiz
const fmt = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function errMsg(e: any, fallback: string) {
  const err = e?.response?.data?.error;
  return typeof err === 'string' ? err : err?.message ?? fallback;
}

export default function McpConnectorSection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await mcpApi.getConnections();
      setServerUrl(res.data.data.serverUrl);
      setEnabled(res.data.data.enabled);
      setConnections(res.data.data.connections);
    } catch (e) {
      setError(errMsg(e, 'Ma\'lumotni yuklab bo\'lmadi'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(serverUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = serverUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const revoke = async (c: McpConnection) => {
    if (!confirm(`${c.user.fullName} — "${c.clientName}" ulanishini uzasizmi? Claude qayta ulanish uchun login so'raydi.`)) return;
    setBusy(c.id);
    try {
      await mcpApi.revoke(c.id);
      setConnections((p) => p.filter((x) => x.id !== c.id));
    } catch (e) {
      alert(errMsg(e, 'Uzib bo\'lmadi'));
    } finally {
      setBusy(null);
    }
  };

  const revokeAll = async () => {
    if (!confirm('Barcha Claude ulanishlarini uzasizmi? Har bir ulanish qayta login talab qiladi.')) return;
    setBusy('all');
    try {
      await mcpApi.revokeAll();
      setConnections([]);
    } catch (e) {
      alert(errMsg(e, 'Uzib bo\'lmadi'));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {!enabled && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Connector serverda o'chirilgan (MCP_ENABLED=false). Ulanish ishlamaydi.
        </div>
      )}

      {/* Server manzili */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Connector manzili (Remote MCP server URL)</label>
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5">
          <code className="flex-1 truncate text-sm font-mono text-zinc-200">{serverUrl}</code>
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Nusxalandi' : 'Nusxalash'}
          </button>
        </div>
      </div>

      {/* Yo'riqnoma */}
      <ol className="space-y-2.5 text-sm text-zinc-300">
        {[
          <>claude.ai da <b className="text-white">Settings → Connectors</b> ga kiring (Pro tarif yetarli).</>,
          <><b className="text-white">Add custom connector</b>: nomi <b className="text-white">IT Live Score</b>, URL — yuqoridagi manzil. Advanced settings'ga tegmang.</>,
          <><b className="text-white">Connect</b> ni bosing → IT Live Score sahifasi ochiladi → admin login/parol → huquqni tanlang.</>,
          <>Chatda pastdagi <b className="text-white">“Search and tools”</b> menyusidan IT Live Score'ni yoqing va savol bering.</>,
        ].map((t, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-xs font-bold text-indigo-400 border border-indigo-500/20">
              {i + 1}
            </span>
            <span className="pt-0.5 leading-relaxed">{t}</span>
          </li>
        ))}
      </ol>

      {/* Imkoniyatlar */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <Eye className="w-4 h-4 text-emerald-400" /> O'qish va tahlil
          </div>
          <p className="mb-2 text-xs text-zinc-500">Guruh, o'quvchi, ustoz hisobotlari, normativlar, bosqichlar, imtihonlar, audit, SQL tahlil</p>
          <ul className="space-y-1.5 text-xs text-zinc-300">
            {EXAMPLES_READ.map((e) => (
              <li key={e} className="rounded-lg bg-zinc-900 px-2.5 py-1.5">“{e}”</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <PencilLine className="w-4 h-4 text-amber-400" /> Boshqarish
          </div>
          <p className="mb-2 text-xs text-zinc-500">Ulanishda “O'qish va boshqarish” tanlansa. Har amal audit jurnaliga yoziladi.</p>
          <ul className="space-y-1.5 text-xs text-zinc-300">
            {EXAMPLES_WRITE.map((e) => (
              <li key={e} className="rounded-lg bg-zinc-900 px-2.5 py-1.5">“{e}”</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Faol ulanishlar */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Faol ulanishlar ({connections.length})</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
              title="Yangilash"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {connections.length > 1 && (
              <button
                onClick={revokeAll}
                disabled={busy === 'all'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                {busy === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Hammasini uzish
              </button>
            )}
          </div>
        </div>

        {connections.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
            Hozircha hech kim ulanmagan.
          </p>
        ) : (
          <ul className="space-y-2">
            {connections.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{c.clientName}</span>
                    {c.redirectHost && <span className="text-xs text-zinc-500">{c.redirectHost}</span>}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        c.canWrite
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      {c.canWrite ? 'O\'qish + boshqarish' : 'Faqat o\'qish'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {c.user.fullName} ({c.user.login}) · ulangan: {fmt(c.connectedAt)} · oxirgi faollik: {fmt(c.lastUsedAt)}
                  </div>
                </div>
                <button
                  onClick={() => revoke(c)}
                  disabled={busy === c.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-zinc-700 disabled:opacity-50"
                >
                  {busy === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Uzish
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs leading-relaxed text-zinc-400">
        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
        <span>
          Faqat administrator ulay oladi; parol Claude'ga berilmaydi (OAuth). Admin parolini almashtirsangiz yoki uni
          nofaol qilsangiz, uning barcha Claude ulanishlari darhol to'xtaydi. Claude'ga yuborilgan ma'lumotlar Anthropic
          serverlarida qayta ishlanadi — o'quvchilarning shaxsiy ma'lumotlarini kerakidan ortiq so'ramang.
        </span>
      </div>
    </div>
  );
}
