import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { permissionsApi } from '@/api';
import { Loader2, Search, ShieldCheck, Check, Save, Users as UsersIcon } from 'lucide-react';

interface PermissionMeta {
  key: string;
  label: string;
  description: string;
  category: string;
}

interface PermissionUser {
  id: string;
  fullName: string;
  login: string;
  role: string;
  permissions: string[];
}

const ROLE_LABELS: Record<string, string> = {
  teacher: "O'qituvchi",
  filial_rahbari: 'Filial Rahbari',
  assistant: 'Assistant',
  moliya_rahbari: 'Moliya Rahbari',
  kassir: 'Kassir',
  administrator: 'Administrator',
  nazoratchi: 'Nazoratchi',
  hr_rahbari: 'HR Menejeri',
  sotuv_operatori: 'Sotuv Menejeri',
  call_operatori: 'Call Operatori',
  robototexnika_ustoz: 'Robototexnika Ustoz',
  farrosh: 'Farrosh',
};

export default function PermissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedUserId = searchParams.get('user');

  const [catalog, setCatalog] = useState<PermissionMeta[]>([]);
  const [users, setUsers] = useState<PermissionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(preselectedUserId);

  // Tanlangan odamning tahrirlanayotgan (hali saqlanmagan) ruxsatlari
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [catalogRes, usersRes] = await Promise.all([
        permissionsApi.getCatalog(),
        permissionsApi.getUsers(),
      ]);
      setCatalog(catalogRes.data.data);
      setUsers(usersRes.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selected = users.find((u) => u.id === selectedId) || null;

  // Odam almashganda draftni uning haqiqiy ruxsatlaridan boshlab qo'yamiz
  useEffect(() => {
    if (selected) setDraft(new Set(selected.permissions));
    else setDraft(new Set());
    setSavedAt(null);
  }, [selectedId, users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.fullName.toLowerCase().includes(q) || u.login.toLowerCase().includes(q)
    );
  }, [users, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionMeta[]>();
    catalog.forEach((p) => {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    });
    return [...map.entries()];
  }, [catalog]);

  const isDirty = useMemo(() => {
    if (!selected) return false;
    const current = new Set(selected.permissions);
    if (current.size !== draft.size) return true;
    for (const p of draft) if (!current.has(p)) return true;
    return false;
  }, [selected, draft]);

  const toggle = (key: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await permissionsApi.setUserPermissions(selected.id, [...draft]);
      const updated = res.data.data as string[];
      setUsers((prev) =>
        prev.map((u) => (u.id === selected.id ? { ...u, permissions: updated } : u))
      );
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || e?.response?.data?.message || 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const selectUser = (id: string) => {
    setSelectedId(id);
    setSearchParams(id ? { user: id } : {});
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Header title="Ruxsatlar" subtitle="Har bir xodimga alohida huquq berish va olib qo'yish" />

      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-5 flex items-start gap-2.5 text-sm text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3.5 py-3">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Admin har doim to'liq huquqli — u ro'yxatda ko'rinmaydi. Bu yerda faqat qolgan
            xodimlarga qo'shimcha huquq berasiz yoki olib qo'yasiz. O'zgarish darhol kuchga kiradi.
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
            {/* Chap: odamlar ro'yxati */}
            <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden flex flex-col max-h-[70vh]">
              <div className="p-3 border-b border-zinc-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ism yoki login..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0f0f11] border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 divide-y divide-zinc-900">
                {filteredUsers.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-8">Hech kim topilmadi</p>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => selectUser(u.id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        selectedId === u.id ? 'bg-blue-600/15 border-l-2 border-blue-500' : 'hover:bg-zinc-800/40 border-l-2 border-transparent'
                      }`}
                    >
                      <p className="text-white text-sm font-medium truncate">{u.fullName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-zinc-500 text-xs">{ROLE_LABELS[u.role] || u.role}</span>
                        {u.permissions.length > 0 && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {u.permissions.length} ruxsat
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* O'ng: ruxsat tugmachalari */}
            <div className="bg-[#18181b] border border-zinc-800 rounded-xl">
              {!selected ? (
                <div className="text-center py-20 text-zinc-500">
                  <UsersIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  Chap tomondan xodimni tanlang
                </div>
              ) : (
                <>
                  <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-white font-bold">{selected.fullName}</h3>
                      <p className="text-zinc-500 text-xs font-mono">
                        {selected.login} · {ROLE_LABELS[selected.role] || selected.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {savedAt && (
                        <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Saqlandi
                        </span>
                      )}
                      <button
                        onClick={handleSave}
                        disabled={!isDirty || saving}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {grouped.map(([category, items]) => (
                      <div key={category}>
                        <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-wider mb-3">
                          {category}
                        </p>
                        <div className="space-y-2">
                          {items.map((p) => {
                            const on = draft.has(p.key);
                            return (
                              <button
                                key={p.key}
                                onClick={() => toggle(p.key)}
                                className={`w-full flex items-start justify-between gap-4 text-left px-4 py-3 rounded-xl border transition-colors ${
                                  on
                                    ? 'bg-emerald-500/10 border-emerald-500/30'
                                    : 'bg-[#0f0f11] border-zinc-800 hover:border-zinc-700'
                                }`}
                              >
                                <div>
                                  <p className={`text-sm font-semibold ${on ? 'text-emerald-300' : 'text-zinc-300'}`}>
                                    {p.label}
                                  </p>
                                  <p className="text-zinc-500 text-xs mt-0.5">{p.description}</p>
                                </div>
                                {/* Toggle */}
                                <span
                                  className={`mt-0.5 w-10 h-6 rounded-full shrink-0 relative transition-colors ${
                                    on ? 'bg-emerald-500' : 'bg-zinc-700'
                                  }`}
                                >
                                  <span
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                                      on ? 'left-5' : 'left-1'
                                    }`}
                                  />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
