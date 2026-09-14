import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import PageIntro, { EducationBanner } from '@/components/dashboard/PageIntro';
import StatCard from '@/components/dashboard/StatCard';
import type { StatCardState } from '@/components/dashboard/StatCard';
import { statsApi } from '@/api';

/**
 * Admin Dashboard — design/it-live-score/references/{light,dark}.png asosida.
 *
 * Kompozitsiya: intro + o'ng banner → 4 ta KPI → 3 ta kengroq KPI.
 *
 * Trend foizlari va mini-grafik HAQIQIY ma'lumotdan quriladi:
 * `/api/statistics/overview` `previous` (o'tgan oy oxiridagi holat) va
 * `series` (so'nggi 10 haftalik kumulyativ qator) qaytaradi. Referensdagi
 * "+12%" kabi sonlar hech qayerda kodga yozilmagan.
 *
 * Eski ma'lumot qaytaradigan backend bilan ham ishlaydi: `previous`/`series`
 * bo'lmasa karta "Taqqoslash mavjud emas" va bo'sh grafik ko'rsatadi.
 */
export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [state, setState] = useState<StatCardState>('loading');

  const load = useCallback(() => {
    setState('loading');
    statsApi
      .getOverview()
      .then((res) => {
        setStats(res.data.data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  useEffect(load, [load]);

  /**
   * @param key  API dagi maydon nomi — joriy qiymat, `previous` va `series`
   *             uchayla shu kalit bilan olinadi, shuning uchun ular
   *             bir-biriga mos kelishi kafolatlanadi.
   */
  const card = (
    title: string,
    key: string,
    illustration: Parameters<typeof StatCard>[0]['illustration'],
    extra: Partial<Parameters<typeof StatCard>[0]> = {},
  ) => (
    <StatCard
      title={title}
      value={stats?.[key] ?? null}
      previousValue={stats?.previous?.[key] ?? null}
      series={stats?.series?.[key] ?? null}
      illustration={illustration}
      state={state}
      onRetry={load}
      errorMessage="Statistika yuklanmadi"
      {...extra}
    />
  );

  return (
    <div>
      <Header showSearch />

      <div className="mx-auto w-full max-w-[1920px] p-4 sm:p-5 lg:p-6">
        <PageIntro
          title="Admin Dashboard"
          subtitle="iTLive Score platformasi bo'yicha umumiy statistika va faollik ko'rsatkichlari"
          banner={<EducationBanner />}
        />

        {/* 12 ustunli grid: birinchi qator 4×span-3, ikkinchi qator 3×span-4 */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
          <div className="xl:col-span-3">{card("O'quvchilar", 'totalStudents', 'student')}</div>
          <div className="xl:col-span-3">{card("O'qituvchilar", 'totalTeachers', 'teacher')}</div>
          <div className="xl:col-span-3">{card('Guruhlar', 'totalGroups', 'groups')}</div>
          <div className="xl:col-span-3">{card('Normativlar', 'totalNormatives', 'standards')}</div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
          <div className="xl:col-span-4">
            {card('Jami topshiriqlar', 'totalSubmissions', 'assignments', { size: 'wide' })}
          </div>
          <div className="xl:col-span-4">
            {card('Tekshirilgan', 'checkedSubmissions', 'checked', { size: 'wide' })}
          </div>
          <div className="xl:col-span-4">
            {/* Navbat qisqargani YAXSHI natija — shuning uchun lower-is-better */}
            {card('Kutilmoqda', 'pendingSubmissions', 'pending', {
              size: 'wide',
              polarity: 'lower-is-better',
            })}
          </div>
        </div>

        {/* Natijalar taqsimoti */}
        {stats?.resultDistribution?.length > 0 && (
          <section
            className="mt-4 rounded-2xl border p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h2 className="mb-4 text-lg font-semibold">Natijalar taqsimoti</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {stats.resultDistribution.map((r: any) => {
                const tone =
                  r.result === 'green'
                    ? { bg: 'var(--success-bg)', fg: 'var(--success-fg)', label: "A'lo (Yashil)" }
                    : r.result === 'blue'
                    ? { bg: 'var(--info-bg)', fg: 'var(--info-fg)', label: "Yaxshi (Ko'k)" }
                    : { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)', label: 'Qoniqarsiz (Qizil)' };
                return (
                  <div
                    key={r.result}
                    className="rounded-2xl border p-5 text-center"
                    style={{ background: tone.bg, borderColor: 'var(--border)' }}
                  >
                    <p className="tabular text-3xl font-bold" style={{ color: tone.fg }}>
                      {r.count}
                    </p>
                    <p className="mt-1 text-xs font-semibold" style={{ color: tone.fg }}>
                      {tone.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
