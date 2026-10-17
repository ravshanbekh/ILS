import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { lessonObservationsApi } from '@/api';
import type { ObservationRecord, ObservationSection, ObservationTeacher } from './types';

interface Props {
  teachers: ObservationTeacher[];
  sections: ObservationSection[];
  maxScore: number;
  observerId: string;
  observerName: string;
  onSaved: (record: ObservationRecord) => void;
}

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-[#ff3218] focus:ring-2 focus:ring-[#ff3218]/15';

interface ObservationDraft {
  teacherId: string;
  groupId: string;
  groupName: string;
  topic: string;
  enrolled: string;
  present: string;
  ratings: Record<string, number>;
  childrenAnswer: string;
  strengths: string;
  improvements: string;
}

const emptyDraft = (): ObservationDraft => ({
  teacherId: '', groupId: '', groupName: '', topic: '', enrolled: '', present: '',
  ratings: {}, childrenAnswer: '', strengths: '', improvements: '',
});
const draftKey = (observerId: string) => `lesson-observation-draft:v1:${observerId}`;

function readDraft(observerId: string, teachers: ObservationTeacher[], sections: ObservationSection[]): ObservationDraft {
  if (!observerId) return emptyDraft();
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey(observerId)) || 'null') as Record<string, unknown> | null;
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return emptyDraft();
    const text = (key: string, max: number) => typeof saved[key] === 'string' ? saved[key].slice(0, max) : '';
    const teacherId = text('teacherId', 100);
    const teacher = teachers.find(item => item.id === teacherId);
    const groupId = text('groupId', 100);
    const allowedCriteria = new Set(sections.flatMap(section => section.items.map(item => item.id)));
    const savedRatings = saved.ratings && typeof saved.ratings === 'object' && !Array.isArray(saved.ratings)
      ? saved.ratings as Record<string, unknown> : {};
    const ratings = Object.fromEntries(Object.entries(savedRatings).filter(([id, score]) =>
      allowedCriteria.has(id) && Number.isInteger(score) && Number(score) >= 1 && Number(score) <= 5)) as Record<string, number>;
    return {
      teacherId: teacher ? teacherId : '',
      groupId: teacher?.teacherGroups.some(group => group.id === groupId) ? groupId : '',
      groupName: text('groupName', 100), topic: text('topic', 200),
      enrolled: text('enrolled', 4), present: text('present', 4), ratings,
      childrenAnswer: text('childrenAnswer', 2000), strengths: text('strengths', 2000),
      improvements: text('improvements', 2000),
    };
  } catch { return emptyDraft(); }
}

function hasDraftContent(draft: ObservationDraft) {
  return Boolean(draft.teacherId || draft.groupName || draft.topic || draft.enrolled || draft.present ||
    Object.keys(draft.ratings).length || draft.childrenAnswer || draft.strengths || draft.improvements);
}

export default function ObservationForm({ teachers, sections, maxScore, observerId, observerName, onSaved }: Props) {
  const [draft, setDraft] = useState(() => readDraft(observerId, teachers, sections));
  const [draftStorageError, setDraftStorageError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { teacherId, groupId, groupName, topic, enrolled, present, ratings, childrenAnswer, strengths, improvements } = draft;
  const started = hasDraftContent(draft);

  const writeDraft = (next: ObservationDraft) => {
    if (!observerId) return;
    try {
      if (hasDraftContent(next)) localStorage.setItem(draftKey(observerId), JSON.stringify(next));
      else localStorage.removeItem(draftKey(observerId));
      setDraftStorageError(false);
    } catch { setDraftStorageError(true); }
  };
  const updateDraft = (patch: Partial<ObservationDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    writeDraft(next);
  };

  const teacher = teachers.find(item => item.id === teacherId);
  const criteriaCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  const ratedCount = Object.keys(ratings).length;
  const total = Object.values(ratings).reduce((sum, score) => sum + score, 0);
  const groups = useMemo(() => teacher?.teacherGroups ?? [], [teacher]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (ratedCount !== criteriaCount) {
      setError(`Barcha ${criteriaCount} mezonga ball qo‘ying (${ratedCount} tasi to‘ldirilgan).`);
      return;
    }
    if (Number(present) > Number(enrolled)) {
      setError("Kelganlar soni ro'yxatdagidan oshmasin.");
      return;
    }
    setSaving(true);
    try {
      const response = await lessonObservationsApi.create({
        teacherId, ...(groupId ? { groupId } : {}), groupName: groupName.trim(), topic: topic.trim(),
        studentsEnrolled: Number(enrolled), studentsPresent: Number(present),
        childrenAnswer: childrenAnswer.trim(), strengths: strengths.trim(), improvements: improvements.trim(), ratings,
      });
      const next = emptyDraft();
      setDraft(next);
      writeDraft(next);
      onSaved(response.data.data as ObservationRecord);
    } catch (e: unknown) {
      const responseError = e as { response?: { data?: { error?: { message?: string } } } };
      setError(responseError.response?.data?.error?.message || 'Bahoni saqlab bo‘lmadi. Qayta urinib ko‘ring.');
    } finally { setSaving(false); }
  };

  const skip = () => {
    if (!window.confirm('Bu baholash qoralamasini o‘tkazib yuborib, kiritilgan ma’lumotlarni o‘chirasizmi?')) return;
    const next = emptyDraft();
    setDraft(next);
    writeDraft(next);
    setError('');
  };

  return (
    <form onSubmit={save} className="overflow-hidden rounded-2xl border border-zinc-700 bg-white text-slate-950 shadow-2xl">
      <div className="p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-slate-900">
              <span className="h-3 w-3 rounded-[2px] bg-[#ff3218]" /> IT LIVE ACADEMY · O‘QUV BO‘LIMI
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Darsni kuzatish formasi</h2>
          </div>
          <div className="text-left text-xs text-slate-600 sm:text-right">
            <p className="mb-2 font-black tracking-wider text-slate-950">FORMA № AVTOMATIK</p>
            <p className="font-bold text-slate-950">1 — yomon · 3 — o‘rtacha · 5 — a’lo</p>
            <p className="mt-1">Baho va vaqt saqlanganda avtomatik qayd etiladi</p>
          </div>
        </div>
        <div className="my-5 h-[3px] bg-slate-950" />

        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Ustoz">
            <select required value={teacherId} onChange={event => updateDraft({ teacherId: event.target.value, groupId: '', groupName: '' })} className={inputClass}>
              <option value="">Ustozni tanlang</option>
              {teachers.map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}
            </select>
          </Field>
          <Field label="Kurs / guruh">
            {groups.length > 0 && <select value={groupId} onChange={event => {
              const id = event.target.value;
              updateDraft({ groupId: id, groupName: groups.find(group => group.id === id)?.name ?? '' });
            }} className={inputClass} disabled={!teacherId}>
              <option value="">Boshqa guruh / qo‘lda yozish</option>
              {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>}
            {!groupId && <input required value={groupName} onChange={event => updateDraft({ groupName: event.target.value })} placeholder="Guruh nomi" maxLength={100}
              className={`${inputClass} ${groups.length > 0 ? 'mt-2' : ''}`} />}
            {groupId && <p className="mt-2 text-xs font-medium text-slate-600">{groupName}</p>}
          </Field>
          <Field label="Sana va vaqt">
            <div className={`${inputClass} bg-slate-50 text-slate-500`}>Saqlanganda avtomatik</div>
          </Field>
          <Field label="Kuzatuvchi">
            <div className={`${inputClass} bg-slate-50 text-slate-700`}>{observerName}</div>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Dars mavzusi">
              <input required value={topic} onChange={event => updateDraft({ topic: event.target.value })} maxLength={200} placeholder="Bugungi mavzu" className={inputClass} />
            </Field>
          </div>
          <Field label="O‘quvchilar: ro‘yxatda">
            <input required type="number" min="0" max="1000" value={enrolled} onChange={event => updateDraft({ enrolled: event.target.value })} className={inputClass} />
          </Field>
          <Field label="O‘quvchilar: keldi">
            <input required type="number" min="0" max="1000" value={present} onChange={event => updateDraft({ present: event.target.value })} className={inputClass} />
          </Field>
        </div>

        <div className="mt-7 space-y-5">
          {sections.map((section, index) => {
            const subtotal = section.items.reduce((sum, item) => sum + (ratings[item.id] ?? 0), 0);
            return <section key={section.id} aria-label={section.title}>
              <div className="flex items-center justify-between gap-2 bg-[#0f1b2e] px-3 py-2 text-xs font-bold uppercase tracking-wider text-white sm:px-4">
                <span>{index + 1} · {section.title}</span><span className="shrink-0 tabular-nums">{subtotal} / {section.items.length * 5}</span>
              </div>
              <div className="divide-y divide-slate-200">
                {section.items.map(item => <div key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                  <p className="text-sm font-medium leading-snug text-slate-900">{item.label}</p>
                  <div role="group" aria-label={`${item.label} uchun ball`} className="flex shrink-0 gap-2">
                    {[1, 2, 3, 4, 5].map(score => <button key={score} type="button" aria-label={`${score} ball`} aria-pressed={ratings[item.id] === score}
                      title={ratings[item.id] === score ? 'Bahoni bekor qilish' : `${score} ball qo‘yish`}
                      onClick={() => {
                        const next = { ...ratings };
                        if (next[item.id] === score) delete next[item.id];
                        else next[item.id] = score;
                        updateDraft({ ratings: next });
                      }}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff3218] ${ratings[item.id] === score ? 'border-[#ff3218] bg-[#ff3218] text-white' : 'border-slate-800 bg-white text-slate-950 hover:border-[#ff3218] hover:text-[#ff3218]'}`}>
                      {score}
                    </button>)}
                  </div>
                </div>)}
              </div>
            </section>;
          })}
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <Field label="Bolalar javobi · “Bugun nima qilding?”">
            <textarea value={childrenAnswer} onChange={event => updateDraft({ childrenAnswer: event.target.value })} maxLength={2000} rows={3} className={inputClass} placeholder="O‘quvchilar qanday javob berdi?" />
          </Field>
          <Field label="Kuchli tomonlari · 2 ta">
            <textarea required value={strengths} onChange={event => updateDraft({ strengths: event.target.value })} maxLength={2000} rows={3} className={inputClass} placeholder="Ikki kuchli jihatni yozing" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Yaxshilash kerak · 1–2 ta aniq qadam va muddat">
              <textarea required value={improvements} onChange={event => updateDraft({ improvements: event.target.value })} maxLength={2000} rows={3} className={inputClass} placeholder="Nima o‘zgaradi va qachongacha?" />
            </Field>
          </div>
        </div>

        {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-8">
        <div>
          <p className="text-lg font-black tabular-nums">{total} / {maxScore} ball</p>
          <p className="text-xs text-slate-500">{ratedCount} / {criteriaCount} mezon baholandi</p>
          {started && <p role="status" className={`mt-1 text-xs ${draftStorageError ? 'text-red-700' : 'text-emerald-700'}`}>
            {draftStorageError ? 'Qoralamani saqlab bo‘lmadi. Brauzer xotirasini tekshiring.' : 'Qoralama shu brauzerda avtomatik saqlanadi.'}
          </p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {started && <button type="button" onClick={skip} disabled={saving} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60">
            Baholashni o‘tkazib yuborish
          </button>}
          <button type="submit" disabled={saving || teachers.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-[#ff3218] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e52a12] disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? 'Saqlanmoqda...' : 'Bahoni saqlash'}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block">
    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-800">{label}</span>
    {children}
  </label>;
}
