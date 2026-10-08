import { useRef, useState } from 'react';
import { Download, Upload, X, AlertTriangle, CheckCircle2, FolderPlus, Loader2 } from 'lucide-react';
import { normativesApi } from '@/api';
import { downloadBlob } from '@/utils';

/**
 * Normativlarni JSON orqali eksport / import qilish — faqat admin.
 *
 * Import ikki qadam:
 *  1) fayl tanlanadi -> server REJANI qaytaradi (dryRun, hech narsa yozilmaydi):
 *     nechtasi yangi, qaysilari yangilanadi (qaysi maydonlari), qancha
 *     o'zgarishsiz, qayerda xato;
 *  2) admin tasdiqlasa — bitta tranzaksiyada yoziladi. Xato bo'lsa tugma
 *     yopiq: "hammasi yoki hech narsa".
 * Faylda yo'q normativlar O'CHIRILMAYDI.
 */

interface Summary {
  total: number;
  createCount: number;
  updateCount: number;
  unchanged: number;
  newCategories: string[];
  errorCount: number;
  errors: { index: number; taskNumber?: number; title?: string; message: string }[];
  create: { taskNumber: number; title: string; newCategory: string | null }[];
  update: { id: string; taskNumber: number; title: string; changes: string[] }[];
}

const errText = (e: any, fallback: string) =>
  e?.response?.data?.error?.message || e?.response?.data?.error || e?.response?.data?.message || fallback;

export default function NormativesJsonTransfer({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [fileName, setFileName] = useState('');
  const [payload, setPayload] = useState<unknown>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Summary | null>(null);

  const reset = () => {
    setPayload(null);
    setSummary(null);
    setError('');
    setDone(null);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const res = await normativesApi.exportJson();
      const date = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `normativlar-${date}.json`);
    } catch (e: any) {
      alert(errText(e, "Eksport qilib bo'lmadi"));
    } finally {
      setExporting(false);
    }
  };

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    setChecking(true);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        setError("Fayl JSON emas yoki buzilgan — eksport qilingan .json faylni tanlang");
        return;
      }
      setPayload(parsed);
      const res = await normativesApi.importJson(parsed, true);
      setSummary(res.data.data);
    } catch (e: any) {
      setError(errText(e, "Faylni tekshirib bo'lmadi"));
    } finally {
      setChecking(false);
    }
  };

  const apply = async () => {
    if (!payload) return;
    setApplying(true);
    setError('');
    try {
      const res = await normativesApi.importJson(payload, false);
      setDone(res.data.data);
      setSummary(null);
      onImported();
    } catch (e: any) {
      // 400 — server rejani qayta hisoblaganda xato chiqdi (baza o'zgargan bo'lishi mumkin)
      if (e?.response?.data?.data) setSummary(e.response.data.data);
      setError(errText(e, "Import qilib bo'lmadi — hech narsa yozilmadi"));
    } finally {
      setApplying(false);
    }
  };

  const open = checking || !!summary || !!error || !!done;
  const nothingToDo = !!summary && summary.createCount === 0 && summary.updateCount === 0;
  const canApply = !!summary && summary.errorCount === 0 && !nothingToDo && !applying;

  return (
    <>
      <button
        onClick={doExport}
        disabled={exporting}
        title="Barcha normativlarni .json faylga yuklab olish"
        className="w-full sm:w-auto bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Eksport (JSON)
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={checking || applying}
        title=".json fayldan normativlarni qo'shish / yangilash"
        className="w-full sm:w-auto bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
      >
        <Upload className="w-4 h-4" />
        Import (JSON)
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="min-w-0">
                <h3 className="text-white font-bold">Normativlarni import qilish</h3>
                {fileName && <p className="text-xs text-zinc-500 truncate">{fileName}</p>}
              </div>
              <button
                onClick={reset}
                disabled={applying}
                aria-label="Yopish"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {checking && (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Fayl tekshirilmoqda...
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {done && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Import bajarildi: {done.createCount} ta yangi qo'shildi, {done.updateCount} ta yangilandi,{' '}
                    {done.unchanged} ta o'zgarishsiz qoldi
                    {done.newCategories.length > 0 && `, ${done.newCategories.length} ta yangi yo'nalish yaratildi`}.
                  </span>
                </div>
              )}

              {summary && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'Yangi', value: summary.createCount, cls: 'text-emerald-400' },
                      { label: 'Yangilanadi', value: summary.updateCount, cls: 'text-sky-400' },
                      { label: "O'zgarishsiz", value: summary.unchanged, cls: 'text-zinc-300' },
                      { label: 'Xato', value: summary.errorCount, cls: summary.errorCount ? 'text-red-400' : 'text-zinc-300' },
                    ].map((c) => (
                      <div key={c.label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">{c.label}</p>
                        <p className={`text-2xl font-bold tabular-nums ${c.cls}`}>{c.value}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-zinc-500">
                    Faylda {summary.total} ta normativ. Faylda yo'q normativlar o'chirilmaydi — import faqat
                    qo'shadi va yangilaydi.
                  </p>

                  {summary.newCategories.length > 0 && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                      <FolderPlus className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>Yangi yo'nalish yaratiladi: {summary.newCategories.join(', ')}</span>
                    </div>
                  )}

                  {summary.errorCount > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-red-400 mb-2">
                        Xatolar — tuzatmaguncha import qilinmaydi
                      </p>
                      <ul className="space-y-1.5">
                        {summary.errors.map((e, i) => (
                          <li key={i} className="text-xs rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2 text-zinc-300">
                            <span className="text-red-400 font-semibold">{e.index ? `${e.index}-yozuv` : 'Fayl'}</span>
                            {e.taskNumber != null && <span className="text-zinc-500"> · №{e.taskNumber}</span>}
                            {e.title && <span className="text-zinc-400"> · {e.title}</span>}
                            <div className="mt-0.5 text-zinc-400">{e.message}</div>
                          </li>
                        ))}
                      </ul>
                      {summary.errorCount > summary.errors.length && (
                        <p className="mt-1 text-xs text-zinc-500">
                          ...va yana {summary.errorCount - summary.errors.length} ta xato
                        </p>
                      )}
                    </div>
                  )}

                  {summary.update.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-white mb-2">Yangilanadigan normativlar</p>
                      <ul className="space-y-1">
                        {summary.update.map((u) => (
                          <li key={u.id} className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-300">
                            <span className="text-zinc-500 tabular-nums">№{u.taskNumber}</span>
                            <span className="font-medium">{u.title}</span>
                            {u.changes.map((c) => (
                              <span key={c} className="rounded-md bg-sky-500/10 border border-sky-500/25 px-1.5 py-0.5 text-sky-400">
                                {c}
                              </span>
                            ))}
                          </li>
                        ))}
                      </ul>
                      {summary.updateCount > summary.update.length && (
                        <p className="mt-1 text-xs text-zinc-500">...va yana {summary.updateCount - summary.update.length} ta</p>
                      )}
                    </div>
                  )}

                  {summary.create.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-white mb-2">Qo'shiladigan normativlar</p>
                      <ul className="space-y-1">
                        {summary.create.map((c, i) => (
                          <li key={i} className="text-xs text-zinc-300">
                            <span className="text-zinc-500 tabular-nums">№{c.taskNumber}</span>{' '}
                            <span className="font-medium">{c.title}</span>
                            {c.newCategory && <span className="text-amber-400"> · {c.newCategory}</span>}
                          </li>
                        ))}
                      </ul>
                      {summary.createCount > summary.create.length && (
                        <p className="mt-1 text-xs text-zinc-500">...va yana {summary.createCount - summary.create.length} ta</p>
                      )}
                    </div>
                  )}

                  {nothingToDo && summary.errorCount === 0 && (
                    <p className="text-sm text-zinc-400">Hech narsa o'zgarmaydi — fayldagi normativlar tizimdagi bilan bir xil.</p>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
              <button
                onClick={reset}
                disabled={applying}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-800"
              >
                {done ? 'Yopish' : 'Bekor qilish'}
              </button>
              {!done && (
                <button
                  onClick={apply}
                  disabled={!canApply}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {applying && <Loader2 className="w-4 h-4 animate-spin" />}
                  Import qilish
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
