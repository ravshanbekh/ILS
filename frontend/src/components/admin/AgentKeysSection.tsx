import { useEffect, useState } from 'react';
import { Bot, Check, Copy, KeyRound, Loader2, Plus, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { mcpApi, type McpAgentKey } from '@/api';

/**
 * Sozlamalar → Claude va AI agentlar → Tashqi AI agent (API kalit).
 * OAuth oqimini o'tay olmaydigan agentlar (o'z serveridagi bot, n8n, OpenAI,
 * LangChain…) uchun doimiy kalit. Kalit faqat yaratilganda bir marta
 * ko'rsatiladi. Backend: src/mcp/agentKeys.ts, connections.routes.ts;
 * hujjat: docs/agent-api.md
 */

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

const STATUS: Record<McpAgentKey['status'], [string, string]> = {
  active: ['faol', 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'],
  expired: ['muddati tugagan', 'border-zinc-700 bg-zinc-800 text-zinc-400'],
  revoked: ['bekor qilingan', 'border-zinc-700 bg-zinc-800 text-zinc-500'],
  owner_changed: ['egasi o\'zgargan — ishlamaydi', 'border-red-500/30 bg-red-500/10 text-red-400'],
};

function CopyButton({ text, label = 'Nusxalash' }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setOk(true);
        setTimeout(() => setOk(false), 1800);
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
    >
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {ok ? 'Nusxalandi' : label}
    </button>
  );
}

export default function AgentKeysSection() {
  const [keys, setKeys] = useState<McpAgentKey[]>([]);
  const [mcpUrl, setMcpUrl] = useState('');
  const [restUrl, setRestUrl] = useState('');
  const [expiryOptions, setExpiryOptions] = useState<number[]>([30, 90, 180, 365]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const [name, setName] = useState('');
  const [access, setAccess] = useState<'read' | 'write'>('write');
  const [expiry, setExpiry] = useState<string>('90');
  const [created, setCreated] = useState<(McpAgentKey & { key: string }) | null>(null);
  const [tab, setTab] = useState<'mcp' | 'rest' | 'openai'>('mcp');

  const load = async () => {
    setError(null);
    try {
      const r = await mcpApi.getAgentKeys();
      setKeys(r.data.data.keys);
      setMcpUrl(r.data.data.mcpUrl);
      setRestUrl(r.data.data.restUrl);
      setExpiryOptions(r.data.data.expiryOptions);
    } catch (e) {
      setError(errMsg(e, 'Kalitlarni yuklab bo\'lmadi'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const create = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy('create');
    setError(null);
    try {
      const r = await mcpApi.createAgentKey({ name: name.trim(), access, expiresInDays: expiry === 'never' ? null : Number(expiry) });
      setCreated(r.data.data);
      setTab('mcp');
      setName('');
      await load();
    } catch (e) {
      setError(errMsg(e, 'Kalit yaratib bo\'lmadi'));
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (k: McpAgentKey) => {
    if (!confirm(`"${k.name}" kalitini bekor qilasizmi? Shu kalit bilan ishlayotgan agent darhol to'xtaydi.`)) return;
    setBusy(k.id);
    try {
      await mcpApi.revokeAgentKey(k.id);
      if (created?.id === k.id) setCreated(null);
      await load();
    } catch (e) {
      alert(errMsg(e, 'Bekor qilib bo\'lmadi'));
    } finally {
      setBusy(null);
    }
  };

  const active = keys.filter((k) => k.status === 'active');
  const visible = showAll ? keys : active;
  const key = created?.key ?? 'ils_ak_…';
  const snippets: Record<typeof tab, string> = {
    mcp: JSON.stringify(
      { mcpServers: { 'it-live-score': { type: 'http', url: mcpUrl, headers: { Authorization: `Bearer ${key}` } } } },
      null,
      2
    ),
    rest: [
      `# Amallar ro'yxati (nomi + JSON Schema)`,
      `curl -H "Authorization: Bearer ${key}" ${restUrl}/tools`,
      ``,
      `# Amalni bajarish (body = argumentlar)`,
      `curl -X POST -H "Authorization: Bearer ${key}" -H "Content-Type: application/json" \\`,
      `     -d '{"search":"FN"}' ${restUrl}/tools/ils_list_groups`,
    ].join('\n'),
    openai: [
      `# OpenAI function calling uchun tayyor "tools" massivi:`,
      `curl -H "Authorization: Bearer ${key}" "${restUrl}/tools?format=openai"`,
      ``,
      `# OpenAPI 3.1 (ChatGPT Actions, Make, Postman):`,
      `curl -H "Authorization: Bearer ${key}" ${restUrl}/openapi.json`,
    ].join('\n'),
  };

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10">
          <Bot className="h-5 w-5 text-sky-400" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Tashqi AI agent (API kalit)</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
            Login sahifasidan o'ta olmaydigan agentlar uchun: o'z serveridagi bot, n8n, OpenAI / Claude API, LangChain. Agent shu
            kalit bilan <b className="text-zinc-200">MCP</b> ({mcpUrl || '/mcp'}) yoki oddiy <b className="text-zinc-200">REST</b>{' '}
            ({restUrl || '/api/agent/v1'}) orqali ulanadi. Amallar, cheklovlar va audit Claude connector bilan bir xil. Agent kalitni
            yaratgan admin nomidan ishlaydi.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Yangi kalit */}
      <form onSubmit={create} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 100))}
          placeholder="Agent nomi, masalan: Sotuv bot (n8n)"
          aria-label="Agent nomi"
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Huquq">
          {(
            [
              ['read', 'Faqat o\'qish'],
              ['write', 'O\'qish + boshqarish'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={access === v}
              onClick={() => setAccess(v)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 ${access === v ? (v === 'write' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300') : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <select value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label="Muddat" className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
          {expiryOptions.map((d) => (
            <option key={d} value={String(d)}>{d} kun</option>
          ))}
          <option value="never">Muddatsiz</option>
        </select>
        <button
          type="submit"
          disabled={busy === 'create' || name.trim().length < 2}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Kalit yaratish
        </button>
      </form>

      {/* Yangi kalit — faqat hozir ko'rinadi */}
      {created && (
        <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2 text-xs text-amber-300">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>"{created.name}"</b> kaliti. U <b>faqat hozir</b> ko'rinadi, qayta ochib bo'lmaydi. Agent sozlamasiga joylang va
              hech kimga chatda yubormang. Bu kalit admin huquqi bilan ishlaydi.
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
            <code className="min-w-0 flex-1 break-all font-mono text-sm text-zinc-100">{created.key}</code>
            <CopyButton text={created.key} />
          </div>
          <div>
            <div className="mb-1.5 flex gap-1 text-xs">
              {(
                [
                  ['mcp', 'MCP mijoz'],
                  ['rest', 'REST (curl)'],
                  ['openai', 'OpenAI / OpenAPI'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTab(v)}
                  className={`rounded-md px-2.5 py-1 font-semibold ${tab === v ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {l}
                </button>
              ))}
              <span className="ml-auto self-center">
                <CopyButton text={snippets[tab]} label="Namunani nusxalash" />
              </span>
            </div>
            <pre className="max-h-56 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-300">{snippets[tab]}</pre>
          </div>
          <button type="button" onClick={() => setCreated(null)} className="text-xs font-semibold text-zinc-400 hover:text-zinc-200">
            Saqladim, yashirish
          </button>
        </div>
      )}

      {/* Kalitlar */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Faol kalitlar: {active.length}</span>
            {keys.length > active.length && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="font-semibold hover:text-zinc-300">
                {showAll ? 'Faqat faollar' : `Hammasini ko'rsatish (${keys.length})`}
              </button>
            )}
          </div>
          {visible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-center text-xs text-zinc-500">Hali kalit yaratilmagan.</p>
          ) : (
            <ul className="space-y-2">
              {visible.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
                  <KeyRound className="h-4 w-4 shrink-0 text-zinc-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{k.name}</span>
                      <code className="text-[11px] text-zinc-500">{k.prefix}…</code>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${k.canWrite ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}>
                        {k.canWrite ? 'O\'qish + boshqarish' : 'Faqat o\'qish'}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS[k.status][1]}`}>{STATUS[k.status][0]}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {k.owner.fullName} · yaratilgan: {fmt(k.createdAt)} · muddati: {k.expiresAt ? fmt(k.expiresAt) : 'muddatsiz'} · oxirgi
                      foydalanish: {fmt(k.lastUsedAt)}
                      {k.lastUsedIp ? ` (${k.lastUsedIp})` : ''}
                    </div>
                  </div>
                  {k.status !== 'revoked' && (
                    <button
                      type="button"
                      onClick={() => revoke(k)}
                      disabled={busy === k.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-zinc-700 disabled:opacity-50"
                    >
                      {busy === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Bekor qilish
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
