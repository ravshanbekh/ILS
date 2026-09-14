import PageIntro, { EducationBanner } from '@/components/dashboard/PageIntro';
import StatCard from '@/components/dashboard/StatCard';
import BrandLogo from '@/components/brand/BrandLogo';
import { applyTheme, resolveTheme } from '@/theme/theme';

/**
 * DIZAYN QABUL SAHIFASI — faqat dev rejimida (App.tsx da `import.meta.env.DEV`
 * bilan o'ralgan, production bundlega kirmaydi).
 *
 * Maqsad: design/it-live-score/references/{light,dark}.png bilan yonma-yon
 * solishtirish. Bu yerdagi sonlar QO'LLANMANING reference demo jadvalidan
 * (DESIGN-GUIDE 7-bo'lim) olingan FIXTURE — ular hech qachon API'ga
 * yozilmaydi va haqiqiy dashboard ularni ishlatmaydi.
 */

const FIXTURE = [
  { title: "O'quvchilar", value: 623, previous: 556, illustration: 'student' },
  { title: "O'qituvchilar", value: 14, previous: 13, illustration: 'teacher' },
  { title: 'Guruhlar', value: 49, previous: 41, illustration: 'groups' },
  { title: 'Normativlar', value: 43, previous: 45, illustration: 'standards' },
] as const;

const FIXTURE_WIDE = [
  { title: 'Jami topshiriqlar', value: 6404, previous: 5521, illustration: 'assignments' },
  { title: 'Tekshirilgan', value: 6314, previous: 5539, illustration: 'checked' },
  { title: 'Kutilmoqda', value: 90, previous: 125, illustration: 'pending', lower: true },
] as const;

const SERIES = [4, 6, 5, 9, 12, 16, 19, 24, 28, 33].map((v, i) => ({
  date: `${i + 1}-hafta`,
  value: v,
}));

export default function DesignPreviewPage() {
  const theme = resolveTheme();

  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)', minHeight: '100dvh' }}>
      <div
        className="flex flex-wrap items-center gap-4 border-b px-6 py-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <BrandLogo width={128} />
        <span className="ml-auto text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Dizayn qabul sahifasi · faqat dev
        </span>
        <button
          type="button"
          onClick={() => applyTheme(resolveTheme() === 'light' ? 'dark' : 'light')}
          className="min-h-11 rounded-xl px-4 font-semibold"
          style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
        >
          {theme === 'light' ? 'Dark' : 'Light'} rejimga
        </button>
      </div>

      <div className="mx-auto w-full max-w-[1920px] p-4 sm:p-5 lg:p-6">
        <PageIntro
          title="Admin Dashboard"
          subtitle="iTLive Score platformasi bo'yicha umumiy statistika va faollik ko'rsatkichlari"
          banner={<EducationBanner />}
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
          {FIXTURE.map((f) => (
            <div key={f.title} className="xl:col-span-3">
              <StatCard
                title={f.title}
                value={f.value}
                previousValue={f.previous}
                illustration={f.illustration}
                series={SERIES}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
          {FIXTURE_WIDE.map((f) => (
            <div key={f.title} className="xl:col-span-4">
              <StatCard
                title={f.title}
                value={f.value}
                previousValue={f.previous}
                illustration={f.illustration}
                series={SERIES}
                size="wide"
                polarity={'lower' in f && f.lower ? 'lower-is-better' : 'higher-is-better'}
              />
            </div>
          ))}
        </div>

        {/* Holatlar matritsasi — DESIGN-GUIDE 8-bo'lim */}
        <h2 className="mt-8 mb-3 text-xl font-semibold">Karta holatlari</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Yuklanmoqda" value={null} illustration="student" state="loading" />
          <StatCard title="Bo'sh" value={null} illustration="groups" state="empty" />
          <StatCard
            title="Xato"
            value={null}
            illustration="pending"
            state="error"
            errorMessage="Server javob bermadi"
            onRetry={() => {}}
          />
          <StatCard
            title="Taqqoslashsiz"
            value={623}
            previousValue={null}
            illustration="teacher"
            series={null}
          />
        </div>
      </div>
    </div>
  );
}
