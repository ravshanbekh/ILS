import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard, GraduationCap, LogOut, X, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeftOpen,
  Video, BookOpen, ClipboardCheck, Trophy, BarChart3, ClipboardList, Snowflake, Phone, Star, Trash2,
  Gift, Package, Coins
} from 'lucide-react';
import { ADMIN_GROUPS, TEACHER_GROUPS, STUDENT_GROUPS } from './CategorySubHeader';
import type { NavCategoryGroup } from './CategorySubHeader';

const studentLinks = [
  { to: '/student/my-normatives', icon: Video, label: "Qoidalar va Ko'rsatmalar" },
  { to: '/student/normatives', icon: BookOpen, label: 'Normativlar' },
  { to: '/student/history', icon: ClipboardCheck, label: 'Topshiriqlarim' },
  { to: '/student/ranking', icon: Trophy, label: 'Reyting' },
  { to: '/student/shop', icon: Gift, label: "Do'kon" },
];

const VIEWER_ROLES = [
  'filial_rahbari', 'assistant', 'moliya_rahbari', 'kassir',
  'administrator', 'nazoratchi', 'hr_rahbari', 'sotuv_operatori', 'farrosh',
  'robototexnika_ustoz', 'call_operatori',
] as const;

type ViewerRole = typeof VIEWER_ROLES[number];

const VIEWER_ROLE_LABELS: Record<ViewerRole, string> = {
  filial_rahbari: 'Filial Rahbari',
  assistant: 'Assistant',
  moliya_rahbari: 'Moliya Rahbari',
  kassir: 'Kassir',
  administrator: 'Administrator',
  nazoratchi: 'Nazoratchi (Inspektor)',
  hr_rahbari: 'HR Menejeri',
  sotuv_operatori: 'Sotuv Menejeri',
  farrosh: 'Farrosh',
  robototexnika_ustoz: 'Robototexnika Ustoz',
  call_operatori: 'Call Operatori',
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  /** Desktopda yig'ilgan (faqat ikonkalar) holat */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ isOpen, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Yig'ilgan ko'rinish faqat desktopda — mobilda sidebar overlay sifatida to'liq ochiladi
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const isCollapsed = collapsed && isDesktop;

  const isViewer = user?.role && VIEWER_ROLES.includes(user.role as ViewerRole);

  const rawGroups: NavCategoryGroup[] = user?.role === 'admin'
    ? ADMIN_GROUPS
    : user?.role === 'teacher'
    ? TEACHER_GROUPS
    : user?.role === 'student'
    ? STUDENT_GROUPS
    : [];

  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';

  const groups = rawGroups.map(group => ({
    ...group,
    items: isDemo ? group.items.filter(item => !item.to.includes('checklist')) : group.items
  })).filter(group => group.items.length > 0);

  const nazoratchiLinks = user?.role === 'nazoratchi' ? [
    { to: `/viewer/nazoratchi/checklist-stats`, icon: BarChart3, label: 'Cheklist Hisobot' },
    { to: `/viewer/nazoratchi/checklist-manage`, icon: ClipboardList, label: 'Cheklist Boshqaruv' },
  ] : [];

  const viewerLinks = isViewer && user?.role !== 'nazoratchi' ? [
    ...(['filial_rahbari', 'administrator', 'sotuv_operatori', 'kassir', 'moliya_rahbari', 'assistant', 'call_operatori'].includes(user!.role) ? [
      { to: `/viewer/${user!.role}/users`, icon: GraduationCap, label: "O'quvchilar" },
      { to: `/viewer/${user!.role}/rankings`, icon: Trophy, label: "O'quvchilar reytingi" },
    ] : []),
    ...(['filial_rahbari', 'administrator', 'sotuv_operatori', 'kassir'].includes(user!.role) ? [
      { to: `/viewer/${user!.role}/frozen-students`, icon: Snowflake, label: 'Muzlatilganlar' }
    ] : []),
    ...(['filial_rahbari', 'administrator', 'sotuv_operatori', 'call_operatori'].includes(user!.role) ? [
      { to: `/viewer/${user!.role}/monitoring`, icon: Phone, label: 'Monitoring' }
    ] : []),
    ...(['filial_rahbari', 'hr_rahbari'].includes(user!.role) ? [
      { to: `/viewer/${user!.role}/teacher-rating`, icon: Star, label: "O'qituvchi reytingi" }
    ] : []),
    ...(['filial_rahbari', 'administrator'].includes(user!.role) ? [
      { to: `/viewer/${user!.role}/trash`, icon: Trash2, label: 'Korzinka (Savat)' }
    ] : []),
    ...(['filial_rahbari', 'administrator', 'kassir'].includes(user!.role) ? [
      { to: `/viewer/${user!.role}/shop-orders`, icon: Package, label: "Do'kon buyurtmalari" },
      { to: `/viewer/${user!.role}/coin-oversight`, icon: Coins, label: 'Coin nazorati' },
    ] : []),
  ] : [];

  const flatLinks = user?.role === 'student'
    ? studentLinks
    : user?.role === 'nazoratchi'
    ? nazoratchiLinks
    : viewerLinks;

  const dashboardRoute = user?.role === 'admin'
    ? '/admin'
    : user?.role === 'teacher'
    ? '/teacher'
    : user?.role === 'student'
    ? '/student'
    : user?.role === 'nazoratchi'
    ? '/viewer/nazoratchi'
    : `/viewer/${user?.role || ''}`;

  // Automatically expand group containing active route
  useEffect(() => {
    if (groups.length > 0) {
      const activeGroup = groups.find(group =>
        group.items.some(item => location.pathname.startsWith(item.to))
      );
      if (activeGroup) {
        setOpenGroups(prev => ({ ...prev, [activeGroup.id]: true }));
      }
    }
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = () => {
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

      <aside className={`fixed left-0 top-0 h-screen bg-[#18181b] border-r border-zinc-800 flex flex-col z-50 shrink-0 transition-all duration-300 ease-in-out lg:translate-x-0 w-64 ${isCollapsed ? 'lg:w-16' : 'lg:w-64'} ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className={`h-16 flex items-center justify-between border-b border-zinc-800 shrink-0 ${isCollapsed ? 'lg:px-0 lg:justify-center px-6' : 'px-6'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-900/30 shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className={`flex flex-col ${isCollapsed ? 'lg:hidden' : ''}`}>
              <h1 className="text-lg font-bold text-white tracking-tight leading-none mb-0.5">ILS</h1>
              <p className="text-[10px] text-zinc-400 font-medium leading-none">IT Live Score</p>
            </div>
          </div>
          {/* Yig'ish/yozish tugmasi — faqat desktopda */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title={isCollapsed ? "Menyuni ochish" : "Menyuni yig'ish"}
              className={`hidden lg:flex p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ${isCollapsed ? 'lg:hidden' : ''}`}
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          )}
          {/* Close button - mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Yig'ilgan holatda ochish tugmasi — logo ostida alohida qator */}
        {isCollapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title="Menyuni ochish"
            className="hidden lg:flex items-center justify-center py-2 border-b border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors shrink-0"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        )}

        {/* Navigation */}
        {/* Yig'ilganda overflow-visible — aks holda o'ng tomondagi flyout kesiladi
            (bu holatda faqat bo'lim ikonkalari bo'lgani uchun scroll kerak emas) */}
        <nav className={`flex-1 py-4 space-y-1.5 custom-scrollbar ${
          isCollapsed ? 'px-2 overflow-visible' : 'px-3 overflow-y-auto'
        }`}>
          {/* Main Dashboard Link */}
          <NavLink
            to={dashboardRoute}
            end
            onClick={handleNavClick}
            title={isCollapsed ? 'Dashboard' : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isCollapsed ? 'justify-center px-2' : 'px-3'
              } ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-900/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`
            }
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Dashboard</span>}
          </NavLink>

          {/* Grouped Accordions for Admin / Teacher */}
          {groups.length > 0 ? (
            groups.map(group => {
              const GroupIcon = group.icon;
              const isGroupActive = group.items.some(item => location.pathname.startsWith(item.to));
              const isExpanded = openGroups[group.id] ?? isGroupActive;

              // Yig'ilgan holat: faqat bo'lim ikonkasi, ustiga olib borilsa
              // o'ng tomonda ichki sahifalar ro'yxati chiqadi
              if (isCollapsed) {
                return (
                  <div key={group.id} className="relative group/flyout pt-1">
                    <button
                      type="button"
                      onClick={onToggleCollapse}
                      title={group.label}
                      className={`w-full flex items-center justify-center px-2 py-2.5 rounded-xl transition-all duration-200 ${
                        isGroupActive
                          ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                      }`}
                    >
                      <GroupIcon className="w-5 h-5 shrink-0" />
                    </button>

                    {/* Flyout */}
                    <div className="absolute left-full top-0 ml-2 z-50 hidden group-hover/flyout:block">
                      <div className="min-w-[190px] bg-[#18181b] border border-zinc-700 rounded-xl shadow-2xl shadow-black/50 p-1.5">
                        <p className="px-2.5 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                          {group.label}
                        </p>
                        {group.items.map(item => {
                          const ItemIcon = item.icon;
                          const isSubActive = location.pathname.startsWith(item.to);
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              onClick={handleNavClick}
                              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                                isSubActive
                                  ? 'bg-zinc-800 text-white font-semibold'
                                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                              }`}
                            >
                              <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={group.id} className="space-y-1 pt-1">
                  {/* Group Header Button */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 select-none ${
                      isGroupActive
                        ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <GroupIcon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{group.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-mono">
                        {group.items.length}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                    </div>
                  </button>

                  {/* Sub-items */}
                  {isExpanded && (
                    <div className="pl-3 space-y-0.5 border-l-2 border-zinc-800/80 ml-3.5 my-1">
                      {group.items.map(item => {
                        const ItemIcon = item.icon;
                        const isSubActive = location.pathname.startsWith(item.to);
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={handleNavClick}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                              isSubActive
                                ? 'bg-zinc-800 text-white font-semibold border-l-2 border-blue-500 -ml-[2px] pl-[10px]'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                            }`}
                          >
                            <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            /* Student / Viewer Flat links */
            flatLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={handleNavClick}
                title={isCollapsed ? link.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isCollapsed ? 'justify-center px-2' : 'px-3'
                  } ${
                    isActive
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`
                }
              >
                <link.icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>{link.label}</span>}
              </NavLink>
            ))
          )}
        </nav>

        {/* User profile & Logout */}
        <div className={`border-t border-zinc-800 shrink-0 ${isCollapsed ? 'p-2' : 'p-4'}`}>
          <div className={`flex items-center gap-3 mb-4 ${isCollapsed ? 'justify-center' : 'px-2'}`}>
            <div
              className="w-9 h-9 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center font-bold text-sm border border-blue-500/20 shrink-0"
              title={isCollapsed ? user?.fullName : undefined}
            >
              {user?.fullName?.charAt(0) || '?'}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.fullName}</p>
                <p className="text-xs text-zinc-500 capitalize">
                  {isViewer && user?.role
                    ? VIEWER_ROLE_LABELS[user.role as ViewerRole]
                    : user?.role === 'admin' ? 'Admin'
                    : user?.role === 'teacher' ? "O'qituvchi"
                    : "O'quvchi"}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            title={isCollapsed ? 'Tizimdan chiqish' : undefined}
            className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 border border-transparent hover:border-red-500/20 ${
              isCollapsed ? 'px-2' : 'px-4'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && 'Tizimdan chiqish'}
          </button>
        </div>
      </aside>
    </>
  );
}
