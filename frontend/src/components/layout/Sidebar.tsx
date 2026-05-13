import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard, Users, FolderOpen, BookOpen, ClipboardCheck,
  BarChart3, Trophy, Download, LogOut, GraduationCap, Video, Settings, X,
} from 'lucide-react';

const adminLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Foydalanuvchilar' },
  { to: '/admin/groups', icon: FolderOpen, label: 'Guruhlar' },
  { to: '/admin/normatives', icon: BookOpen, label: 'Normativlar' },
  { to: '/admin/submissions', icon: ClipboardCheck, label: 'Topshiriqlar' },
  { to: '/admin/stats', icon: BarChart3, label: 'Statistika' },
  { to: '/admin/rankings', icon: Trophy, label: 'Reyting' },
  { to: '/admin/export', icon: Download, label: 'Eksport' },
  { to: '/admin/settings', icon: Settings, label: 'Sozlamalar' },
];

const teacherLinks = [
  { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/teacher/users', icon: Users, label: 'O\'quvchilar' },
  { to: '/teacher/groups', icon: FolderOpen, label: 'Guruhlarim' },
  { to: '/teacher/normatives', icon: BookOpen, label: 'Normativlar' },
  { to: '/teacher/pending', icon: ClipboardCheck, label: 'Tekshirish' },
  { to: '/teacher/rankings', icon: Trophy, label: 'Reyting' },
  { to: '/teacher/export', icon: Download, label: 'Eksport' },
];

const studentLinks = [
  { to: '/student', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/student/my-normatives', icon: Video, label: "Qoidalar va Ko'rsatmalar" },
  { to: '/student/normatives', icon: BookOpen, label: 'Normativlar' },
  { to: '/student/history', icon: ClipboardCheck, label: 'Topshiriqlarim' },
  { to: '/student/ranking', icon: Trophy, label: 'Reyting' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const links = user?.role === 'admin'
    ? adminLinks
    : user?.role === 'teacher'
    ? teacherLinks
    : studentLinks;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = () => {
    // Close sidebar on mobile when a link is clicked
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed left-0 top-0 h-screen w-64 bg-[#18181b] border-r border-zinc-800 flex flex-col z-50 shrink-0 transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-white tracking-tight leading-none mb-0.5">ILS</h1>
              <p className="text-[10px] text-zinc-400 font-medium leading-none">IT Live Score</p>
            </div>
          </div>
          {/* Close button - mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/admin' || link.to === '/teacher' || link.to === '/student'}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`
              }
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-zinc-800 shrink-0">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-9 h-9 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center font-bold text-sm border border-blue-500/20">
              {user?.fullName?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.fullName}</p>
              <p className="text-xs text-zinc-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 border border-transparent hover:border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            Tizimdan chiqish
          </button>
        </div>
      </aside>
    </>
  );
}
