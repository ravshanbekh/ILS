import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { TopbarContext } from './topbarContext';
import type { TopbarState } from './topbarContext';
import CategorySubHeader from './CategorySubHeader';
import MilestoneWarningBanner from '../shared/MilestoneWarningBanner';
import { useAuthStore } from '../../stores/authStore';
import { usePermissionStore } from '../../stores/permissionStore';

export default function AppLayout() {
  const role = useAuthStore((st) => st.user?.role);
  const can = usePermissionStore((s) => s.can);
  usePermissionStore((s) => s.permissions); // ruxsatlar kelganda qayta chizilsin
  // Kechikish banneri: guruh mentori (o'z guruhlari), admin va nazorat
  // ruxsati borlar (hammasi). Rol ro'yxati o'rniga ruxsat — kimga
  // "Demo day va imtihon nazorati" berilsa, o'sha ko'radi.
  const showMilestoneBanner =
    !!role && (['admin', 'administrator', 'teacher'].includes(role) || can('milestone_oversight'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Yig'ilgan holat brauzerda eslab qolinadi
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

  // Sahifalar <Header /> orqali shu yerga sarlavha uzatadi (topbarContext.tsx)
  const [topbar, setTopbar] = useState<TopbarState>({});
  const topbarCtx = useMemo(() => ({ setTopbar }), []);

  // ── Sahifa o'tishi (native his) ─────────────────────────────────────────
  // Yangi sahifa birdan "almashinmaydi" — yumshoq ko'tarilib paydo bo'ladi
  // (iOS'dagi push o'tishining yengil varianti). Web Animations API bilan
  // va key ishlatilmasdan: sahifa qayta mount bo'lmaydi, holati saqlanadi.
  const location = useLocation();
  const navType = useNavigationType();
  const mainRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Yangi sahifaga o'tilganda tepadan boshlanadi (ilovadagidek). Ilgari
    // <main> scroll holatini saqlab qolardi va yangi sahifa avvalgisining
    // o'rtasidan ochilardi. "Orqaga" (POP) da tegilmaydi.
    if (navType !== 'POP') mainRef.current?.scrollTo({ top: 0 });

    const el = pageRef.current;
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const anim = el.animate(
      [
        { opacity: 0, translate: '0 10px' },
        { opacity: 1, translate: '0 0' },
      ],
      { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      localStorage.setItem('sidebarCollapsed', String(!prev));
      return !prev;
    });
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50 w-full overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />
      <main ref={mainRef} className={`flex-1 flex flex-col min-w-0 overflow-y-auto h-screen bg-zinc-950 transition-[margin] duration-300 ease-[var(--ease-ios)] ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        {/* Global topbar — HAR BIR sahifada bitta. Mavzu, bildirishnomalar va
            akkaunt menyusi shu yerda. Mobilda chap tomonida menyu tugmasi
            (ilgari alohida ikkinchi panel edi va ular bir-birini yopardi). */}
        <Topbar {...topbar} onMenuClick={() => setSidebarOpen(true)} />

        {/* Sub Navigation Bar for Category Switching */}
        <CategorySubHeader />

        {/* Kechikkan demo day / imtihon ogohlantirishi.
            Faqat nazorat qiladigan va bosqichga javobgar rollarga —
            o'quvchiga ko'rsatilsa ham bo'sh chiqardi, lekin har sahifada
            keraksiz so'rov yuborilardi. */}
        {showMilestoneBanner && (
          <MilestoneWarningBanner />
        )}

        <div ref={pageRef} className="flex-1 w-full max-w-7xl mx-auto">
          <TopbarContext.Provider value={topbarCtx}>
            <Outlet />
          </TopbarContext.Provider>
        </div>
      </main>
    </div>
  );
}
