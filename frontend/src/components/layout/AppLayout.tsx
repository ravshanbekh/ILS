import { Outlet } from 'react-router-dom';
import { useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { TopbarContext } from './topbarContext';
import type { TopbarState } from './topbarContext';
import CategorySubHeader from './CategorySubHeader';
import MilestoneWarningBanner from '../shared/MilestoneWarningBanner';
import { useAuthStore } from '../../stores/authStore';

export default function AppLayout() {
  const role = useAuthStore((st) => st.user?.role);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Yig'ilgan holat brauzerda eslab qolinadi
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

  // Sahifalar <Header /> orqali shu yerga sarlavha uzatadi (topbarContext.tsx)
  const [topbar, setTopbar] = useState<TopbarState>({});
  const topbarCtx = useMemo(() => ({ setTopbar }), []);

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
      <main className={`flex-1 flex flex-col min-w-0 overflow-y-auto h-screen bg-zinc-950 transition-[margin] duration-300 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
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
        {role && ['admin', 'administrator', 'teacher', 'filial_rahbari', 'nazoratchi'].includes(role) && (
          <MilestoneWarningBanner />
        )}

        <div className="flex-1 w-full max-w-7xl mx-auto">
          <TopbarContext.Provider value={topbarCtx}>
            <Outlet />
          </TopbarContext.Provider>
        </div>
      </main>
    </div>
  );
}
