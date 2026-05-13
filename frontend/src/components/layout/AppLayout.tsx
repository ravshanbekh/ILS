import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#09090b] text-zinc-50 w-full overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen lg:ml-64 bg-[#09090b]">
        {/* Mobile top bar with hamburger */}
        <div className="lg:hidden sticky top-0 z-30 bg-[#09090b]/95 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-white">ILS</span>
        </div>
        <div className="flex-1 w-full max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
