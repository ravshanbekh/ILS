import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import CategorySubHeader from './CategorySubHeader';
import MilestoneWarningBanner from '../shared/MilestoneWarningBanner';
import { useAuthStore } from '../../stores/authStore';
import { Menu } from 'lucide-react';

export default function AppLayout() {
  const role = useAuthStore((st) => st.user?.role);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Yig'ilgan holat brauzerda eslab qolinadi
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

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
        {/* Mobile top bar with hamburger */}
        <div className="lg:hidden sticky top-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-white">ILS</span>
        </div>

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
          <Outlet />
        </div>
      </main>
    </div>
  );
}
