import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePermissionStore } from '@/stores/permissionStore';
import {
  LayoutDashboard, GraduationCap, X, ChevronRight,
  PanelLeftClose, PanelLeftOpen,
  Video, BookOpen, ClipboardCheck, Trophy, BarChart3, ClipboardList, Snowflake, Phone, Star, Trash2,
  Gift, Package, Coins
, CalendarClock, UserCircle} from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';
import { getNavGroups } from './CategorySubHeader';
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


interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  /** Desktopda yig'ilgan (faqat ikonkalar) holat */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ isOpen, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user } = useAuthStore();
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
  // `can` funksiyasi hech qachon o'zgarmaydi — faqat unga obuna bo'linsa,
  // ruxsatlar serverdan kelganda menyu qayta chizilmasdi va ruxsatli
  // bandlar (do'kon, coin, vazifa bankasi) boshqa sahifaga o'tilgandagina
  // paydo bo'lardi. Ro'yxatning o'ziga obuna bo'lamiz.
  usePermissionStore((s) => s.permissions);
  const canShopOrders = can('shop_orders');
  const canShopManage = can('shop_manage');
  const canCoinOversight = can('coin_oversight');
  const canSupportOversight = can('support_oversight');
  const canHomeworkManage = can('homework_manage');

  // Rol guruhlari + ruxsatga qarab qo'shiladigan bandlar (CategorySubHeader
  // bilan bitta manba — getNavGroups)
  const rawGroups: NavCategoryGroup[] = getNavGroups(user?.role, can);

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
    // Ta'lim — "Uyga vazifa bankasini boshqarish" ruxsati berilganlarga
    // (masalan assistent darsliklarga vazifa yozadi)
    ...(canHomeworkManage
      ? [{ to: `/viewer/${user!.role}/homework-bank`, icon: BookOpen, label: 'Uyga vazifa bankasi' }]
      : []),
    // Nazorat — qo'lda beriladigan ruxsat
    ...(canSupportOversight
      ? [
          { to: `/viewer/${user!.role}/support-hours`, icon: ClipboardList, label: 'Assistent soatlari' },
          { to: `/viewer/${user!.role}/support-stats`, icon: Trophy, label: 'Assistentlar reytingi' },
        ]
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

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  // ── Surib yopish (mobil) ────────────────────────────────────────────────
  // iPhone'dagidek: ochiq menyuni barmoq bilan chapga surasiz, menyu barmoq
  // ortidan ergashadi, fon esa shunga yarasha ochiladi. Qo'yib yuborilganda
  // yo'l uzunligi yoki tezligiga qarab yopiladi yoki joyiga qaytadi.
  // Holat ref'da — har piksel uchun React render qilinmaydi, to'g'ridan-to'g'ri
  // style yoziladi (60 fps).
  const asideRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number; y: number; dx: number;
    lastX: number; lastT: number; v: number;
    decided: boolean; active: boolean;
  } | null>(null);

  const resetDragStyles = () => {
    const aside = asideRef.current;
    const backdrop = backdropRef.current;
    if (aside) { aside.style.transition = ''; aside.style.translate = ''; }
    if (backdrop) { backdrop.style.transition = ''; backdrop.style.opacity = ''; }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isOpen || isDesktop || e.touches.length !== 1) return;
    const t = e.touches[0];
    drag.current = {
      x: t.clientX, y: t.clientY, dx: 0,
      lastX: t.clientX, lastT: performance.now(), v: 0,
      decided: false, active: false,
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current;
    const aside = asideRef.current;
    if (!d || !aside) return;
    const t = e.touches[0];
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;

    // Birinchi 8px — yo'nalishni aniqlash. Vertikal bo'lsa bu oddiy scroll,
    // aralashmaymiz; faqat chapga gorizontal harakat suriladi.
    if (!d.decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.decided = true;
      d.active = Math.abs(dx) > Math.abs(dy) && dx < 0;
      if (d.active) {
        aside.style.transition = 'none';
        if (backdropRef.current) backdropRef.current.style.transition = 'none';
      }
    }
    if (!d.active) return;

    const now = performance.now();
    d.v = (t.clientX - d.lastX) / Math.max(1, now - d.lastT); // px/ms
    d.lastX = t.clientX;
    d.lastT = now;
    d.dx = Math.min(0, dx);
    aside.style.translate = `${d.dx}px 0`;
    if (backdropRef.current) {
      backdropRef.current.style.opacity = String(Math.max(0, 1 + d.dx / aside.offsetWidth));
    }
  };

  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    const width = asideRef.current?.offsetWidth ?? 256;
    // Uchdan biridan ko'p surilgan yoki tez "otilgan" bo'lsa — yopiladi
    const shouldClose = d.dx < -width / 3 || d.v < -0.45;
    // Inline uslublar olib tashlanadi: element joriy nuqtadan klassdagi
    // holatga (ochiq yoki yopiq) o'sha iOS egri chizig'i bilan suzib boradi
    resetDragStyles();
    if (shouldClose) onClose?.();
  };

  return (
    <>
      {/* Mobile overlay — doim DOMda, opacity bilan. Ilgari shartli chizilardi:
          menyu ochilganda fon birdan qorayar, yopilganda esa menyu hali
          suzib ketayotganda fon allaqachon yo'qolardi. */}
      <div
        ref={backdropRef}
        className={`fixed inset-0 bg-black/60 z-40 lg:hidden transition-opacity duration-[var(--motion-drawer-ios)] ease-[var(--ease-ios)] ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={asideRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className={`fixed left-0 top-0 h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col z-50 shrink-0 touch-pan-y transition-all duration-[var(--motion-drawer-ios)] ease-[var(--ease-ios)] lg:duration-300 lg:translate-x-0 w-64 ${isCollapsed ? 'lg:w-16' : 'lg:w-64'} ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
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
                : { color: 'var(--foreground)' }
            }
          >
            <LayoutDashboard className="h-[22px] w-[22px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
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
                              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                isSubActive
                                  ? 'bg-zinc-800 text-white'
                                  : 'text-zinc-100 hover:bg-zinc-800/60'
                              }`}
                            >
                              <ItemIcon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
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
                    className="flex w-full select-none items-center justify-between gap-2 px-3 py-3 text-left text-[15px] font-bold transition-colors"
                    style={{ color: isGroupActive ? 'var(--nav-active-fg)' : 'var(--foreground)' }}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <GroupIcon className="h-[22px] w-[22px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
                      <span className="truncate">{group.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span
                        className="tabular rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{ background: 'var(--trend-up-bg)', color: 'var(--trend-up-fg)' }}
                      >
                        {group.items.length}
                      </span>
                      {/* Bitta strelka buriladi (ilgari ikki xil ikonka almashardi) */}
                      <ChevronRight
                        className={`h-4 w-4 transition-transform duration-300 ease-[var(--ease-ios-out)] ${isExpanded ? 'rotate-90' : ''}`}
                        style={{ color: 'var(--muted-foreground)' }}
                      />
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="ios-expand px-2 pb-2">
                      {group.items.map(item => {
                        const ItemIcon = item.icon;
                        const isSubActive = location.pathname.startsWith(item.to);
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={handleNavClick}
                            aria-current={isSubActive ? 'page' : undefined}
                            className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-semibold transition-colors"
                            style={
                              isSubActive
                                ? { background: 'var(--nav-active-bg)', color: 'var(--nav-active-fg)', fontWeight: 700 }
                                : { color: 'var(--foreground)' }
                            }
                          >
                            <ItemIcon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
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
                    : { color: 'var(--foreground)' }
                }
              >
                <link.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
                {!isCollapsed && <span>{link.label}</span>}
              </NavLink>
            ))
          )}
        </nav>


      </aside>
    </>
  );
}
