import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePermissionStore } from '@/stores/permissionStore';
import {
  LayoutDashboard, GraduationCap, LogOut, X, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeftOpen,
  Video, BookOpen, ClipboardCheck, Trophy, BarChart3, ClipboardList, Snowflake, Phone, Star, Trash2,
  Gift, Package, Coins
, CalendarClock, UserCircle} from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';
import NavIcon from '@/components/brand/NavIcon';
import { ADMIN_GROUPS, TEACHER_GROUPS, STUDENT_GROUPS } from './CategorySubHeader';
import type { NavCategoryGroup } from './CategorySubHeader';

const studentLinks = [
  { to: '/student/my-normatives', icon: Video, label: "Qoidalar va Ko'rsatmalar" },
  { to: '/student/normatives', icon: BookOpen, label: 'Normativlar' },
  { to: '/student/history', icon: ClipboardCheck, label: 'Topshiriqlarim' },
  { to: '/student/ranking', icon: Trophy, label: 'Reyting' },
  { to: '/student/shop', icon: Gift, label: "Do'kon" },
  { to: '/student/homework', icon: BookOpen, label: 'Uyga vazifalar' },
  { to: '/student/results', icon: Trophy, label: 'Natijalarim' },
  { to: '/student/support-hours', icon: CalendarClock, label: 'Yordamchi ustoz' },
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

/**
 * Route'dan ikonka kalitini oladi: oxirgi bo'lak.
 *   /admin/users            -> users
 *   /viewer/kassir/users    -> users
 * Bitta sahifa rolga qarab turli yo'lda bo'ladi, ikonka esa bitta.
 */
function iconKey(to: string): string {
  const parts = to.split('?')[0].split('/').filter(Boolean);
  return parts[parts.length - 1] || 'dashboard';
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

  // Gamifikatsiya bo'limlari qo'lda beriladigan ruxsatga bog'liq
  const can = usePermissionStore((s) => s.can);
  const canShopOrders = can('shop_orders');
  const canShopManage = can('shop_manage');
  const canCoinOversight = can('coin_oversight');
  const canSupportOversight = can('support_oversight');

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
    // Gamifikatsiya — rolga emas, qo'lda berilgan RUXSATGA qarab ko'rinadi.
    // (Ilgari rol ro'yxati bo'yicha ko'rsatilardi va ba'zi rollarda havola
    // ko'rinib, bosilganda server rad etardi.)
    ...(canShopOrders
      ? [{ to: `/viewer/${user!.role}/shop-orders`, icon: Package, label: "Do'kon buyurtmalari" }]
      : []),
    ...(canShopManage
      ? [{ to: `/viewer/${user!.role}/shop-items`, icon: Gift, label: "Do'kon boshqaruvi" }]
      : []),
    ...(canCoinOversight
      ? [{ to: `/viewer/${user!.role}/coin-oversight`, icon: Coins, label: 'Coin nazorati' }]
      : []),
    // Assistent o'z qabul soatlarini boshqaradi
    ...(['assistant', 'robototexnika_ustoz'].includes(user!.role)
      ? [{ to: `/viewer/${user!.role}/my-support-hours`, icon: CalendarClock, label: 'Qabul soatlarim' }]
      : []),
    // Kartochkasi o'quvchiga ko'rinadigan rollar o'z profilini to'ldiradi
    ...(['assistant', 'robototexnika_ustoz'].includes(user!.role)
      ? [{ to: `/viewer/${user!.role}/profile`, icon: UserCircle, label: 'Mening profilim' }]
      : []),
    // Nazorat — qo'lda beriladigan ruxsat
    ...(canSupportOversight
      ? [{ to: `/viewer/${user!.role}/support-hours`, icon: ClipboardList, label: 'Assistent soatlari' }]
      : []),
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

      <aside className={`fixed left-0 top-0 h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col z-50 shrink-0 transition-all duration-300 ease-in-out lg:translate-x-0 w-64 ${isCollapsed ? 'lg:w-16' : 'lg:w-64'} ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className={`h-16 flex items-center justify-between border-b border-zinc-800 shrink-0 ${isCollapsed ? 'lg:px-0 lg:justify-center px-6' : 'px-6'}`}>
          {/* Logo lockup — DESIGN-GUIDE 3-bo'lim: wordmark, ostida "Score".
              Yig'ilgan holatda faqat ixcham belgi qoladi. */}
          {isCollapsed ? (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold"
              style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              title="IT Live Score"
            >
              iT
            </span>
          ) : (
            <BrandLogo width={128} />
          )}
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
        <nav className={`flex-1 py-4 space-y-2 custom-scrollbar ${
          isCollapsed ? 'px-2 overflow-visible' : 'px-3 overflow-y-auto'
        }`}>
          {/* Main Dashboard Link */}
          <NavLink
            to={dashboardRoute}
            end
            onClick={handleNavClick}
            title={isCollapsed ? 'Dashboard' : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl border py-3 text-sm font-semibold transition-colors ${
                isCollapsed ? 'justify-center px-2' : 'px-3'
              } ${isActive ? '' : 'border-transparent'}`
            }
            style={({ isActive }) =>
              isActive
                ? {
                    background: 'var(--nav-active-bg)',
                    borderColor: 'var(--primary)',
                    color: 'var(--nav-active-fg)',
                  }
                : { color: 'var(--muted-foreground)' }
            }
          >
            <NavIcon name="dashboard" fallback={LayoutDashboard} size={22} />
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
                      <div className="min-w-[190px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50 p-1.5">
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
                              <NavIcon name={iconKey(item.to)} fallback={ItemIcon} size={18} />
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
                /* Bo'lim — mockupdagidek alohida panel kartochka */
                <div
                  key={group.id}
                  className="overflow-hidden rounded-2xl border"
                  style={{ background: 'var(--surface-soft)', borderColor: 'var(--border)' }}
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isExpanded}
                    className="flex w-full select-none items-center justify-between gap-2 px-3 py-3 text-left text-sm font-semibold transition-colors"
                    style={{ color: isGroupActive ? 'var(--nav-active-fg)' : 'var(--foreground)' }}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <NavIcon name={`group-${group.id}`} fallback={GroupIcon} size={22} />
                      <span className="truncate">{group.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span
                        className="tabular rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{ background: 'var(--trend-up-bg)', color: 'var(--trend-up-fg)' }}
                      >
                        {group.items.length}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                      ) : (
                        <ChevronRight className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                      )}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-2 pb-2">
                      {group.items.map(item => {
                        const ItemIcon = item.icon;
                        const isSubActive = location.pathname.startsWith(item.to);
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={handleNavClick}
                            aria-current={isSubActive ? 'page' : undefined}
                            className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors"
                            style={
                              isSubActive
                                ? { background: 'var(--nav-active-bg)', color: 'var(--nav-active-fg)', fontWeight: 600 }
                                : { color: 'var(--muted-foreground)' }
                            }
                          >
                            <NavIcon name={iconKey(item.to)} fallback={ItemIcon} size={18} />
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
                  `flex items-center gap-3 rounded-2xl border py-3 text-sm font-medium transition-colors ${
                    isCollapsed ? 'justify-center px-2' : 'px-3'
                  } ${isActive ? 'font-semibold' : 'border-transparent'}`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        background: 'var(--nav-active-bg)',
                        borderColor: 'var(--primary)',
                        color: 'var(--nav-active-fg)',
                      }
                    : { color: 'var(--muted-foreground)' }
                }
              >
                <NavIcon name={iconKey(link.to)} fallback={link.icon} size={22} />
                {!isCollapsed && <span>{link.label}</span>}
              </NavLink>
            ))
          )}
        </nav>

        {/* Foydalanuvchi va chiqish */}
        <div
          className={`shrink-0 border-t ${isCollapsed ? 'p-2' : 'p-3'}`}
          style={{ borderColor: 'var(--border)' }}
        >
          <div className={`mb-3 flex items-center gap-3 ${isCollapsed ? 'justify-center' : 'px-1'}`}>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              title={isCollapsed ? user?.fullName : undefined}
            >
              {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user?.fullName}</p>
                <p className="truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>
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
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-opacity hover:opacity-80 ${
              isCollapsed ? 'px-2' : 'px-4'
            }`}
            style={{ background: 'var(--danger-bg)', color: 'var(--danger-fg)' }}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!isCollapsed && 'Tizimdan chiqish'}
          </button>
        </div>
      </aside>
    </>
  );
}
