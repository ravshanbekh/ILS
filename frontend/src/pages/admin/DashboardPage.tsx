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
 * DIQQAT — trend va mini-grafik hozir BO'SH holatda chiqadi.
 * `/api/statistics/overview` faqat joriy jami sonlarni qaytaradi; oldingi
 * davr qiymati ham, vaqt qatori ham yo'q. Referens rasmdagi "+12%" kabi
 * foizlarni kodga yozib qo'yish qo'llanma bo'yicha TAQIQLANGAN (soxta
 * ma'lumot), shuning uchun TrendBadge "Taqqoslash mavjud emas" deydi.
 * Backend `previousValue` va `series` qaytara boshlagan zahoti kartalar
 * o'zgarishsiz to'liq ishlaydi.
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

  const card = (
    title: string,
    value: number | undefined,
    illustration: Parameters<typeof StatCard>[0]['illustration'],
    extra: Partial<Parameters<typeof StatCard>[0]> = {},
  ) => (
    <StatCard
      title={title}
      value={value ?? null}
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
          <div className="xl:col-span-3">{card("O'quvchilar", stats?.totalStudents, 'student')}</div>
          <div className="xl:col-span-3">{card("O'qituvchilar", stats?.totalTeachers, 'teacher')}</div>
          <div className="xl:col-span-3">{card('Guruhlar', stats?.totalGroups, 'groups')}</div>
          <div className="xl:col-span-3">{card('Normativlar', stats?.totalNormatives, 'standards')}</div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
          <div className="xl:col-span-4">
            {card('Jami topshiriqlar', stats?.totalSubmissions, 'assignments', { size: 'wide' })}
          </div>
          <div className="xl:col-span-4">
            {card('Tekshirilgan', stats?.checkedSubmissions, 'checked', { size: 'wide' })}
          </div>
          <div className="xl:col-span-4">
            {/* Navbat qisqargani YAXSHI natija — shuning uchun lower-is-better */}
            {card('Kutilmoqda', stats?.pendingSubmissions, 'pending', {
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
