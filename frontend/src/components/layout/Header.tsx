import { Bell, Sun, Moon, X, Info, Clock, AlertTriangle, Brain, TrendingDown, Search } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useState, useEffect } from 'react';
import { notificationsApi } from '@/api';
import { socket } from '@/utils/socket';
import { applyTheme, resolveTheme, setPreference, watchSystemTheme } from '@/theme/theme';
import type { ResolvedTheme } from '@/theme/theme';

/** Avatar yonida ko'rsatiladigan rol nomlari. */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  teacher: "O'qituvchi",
  student: "O'quvchi",
  filial_rahbari: 'Filial rahbari',
  moliya_rahbari: 'Moliya rahbari',
  hr_rahbari: 'HR menejeri',
  sotuv_operatori: 'Sotuv menejeri',
  call_operatori: 'Call operatori',
  kassir: 'Kassir',
  administrator: 'Administrator',
  nazoratchi: 'Nazoratchi',
  assistant: 'Assistent',
  robototexnika_ustoz: 'Robototexnika ustozi',
  farrosh: 'Farrosh',
};

interface HeaderProps {
  /** Sahifa nomi. Dashboardda berilmaydi — u yerda sarlavha PageIntro ichida. */
  title?: string;
  subtitle?: string;
  /**
   * Referens topbardagi qidiruv maydoni (DESIGN-GUIDE 7-bo'lim).
   * Hozircha global qidiruv endpointi yo'q, shuning uchun u FAQAT
   * so'ralgan sahifada ko'rsatiladi va yozilgan so'rov `onSearch` orqali
   * sahifaga uzatiladi — ishlamaydigan dekorativ input bo'lmasligi uchun.
   */
  showSearch?: boolean;
  searchValue?: string;
  onSearch?: (value: string) => void;
}

export default function Header({ title, subtitle, showSearch, searchValue, onSearch }: HeaderProps) {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  const handleNotifClick = async (notif: any) => {
    setSelectedNotif(notif);
    setShowModal(true);
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
  };

  // Theme — yagona manba src/theme/theme.ts. Bu yerda faqat tez toggle bor;
  // to'liq Light/Dark/System tanlovi Sozlamalar sahifasida.
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Foydalanuvchi 'system' ni tanlagan bo'lsa OS o'zgarishiga ergashamiz
  useEffect(() => watchSystemTheme(setTheme), []);

  const toggleTheme = () => {
    setTheme(setPreference(resolveTheme() === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    fetchNotifications();

    const handleNewNotification = () => {
      fetchNotifications();
    };

    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await notificationsApi.getAll();
      setNotifications(res.data.data.notifications);
      setUnreadCount(res.data.data.unreadCount);
    } catch (err) {
      console.error(err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      fetchNotifications();
      setIsOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header
      className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4 sm:px-6 lg:h-[86px]"
      style={{ background: 'var(--header)', borderColor: 'var(--border)' }}
    >
      {showSearch ? (
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="ils-global-search">Qidirish</label>
          <div className="relative w-full max-w-[520px]">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
              style={{ color: 'var(--muted-foreground)' }}
              aria-hidden="true"
            />
            <input
              id="ils-global-search"
              type="search"
              value={searchValue ?? ''}
              onChange={(e) => onSearch?.(e.target.value)}
              placeholder="Qidirish..."
              disabled={!onSearch}
              className="h-11 w-full rounded-full pl-12 pr-4 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 lg:h-[50px]"
              style={{ background: 'var(--surface-muted)', borderColor: 'transparent' }}
            />
          </div>
        </div>
      ) : (
        <div className="min-w-0">
          {title && <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>}
          {subtitle && (
            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-4 sm:gap-5">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-zinc-800/20 hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
          title={theme === 'light' ? 'Tungi rejim' : 'Kungi rejim'}
        >
          {theme === 'light' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
        </button>

        <div className="relative">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`relative transition-colors ${isOpen ? 'text-blue-500' : 'text-zinc-400 hover:text-white'}`}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-zinc-950">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {isOpen && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setIsOpen(false)}
              />
              <div className="absolute right-0 mt-3 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[400px]">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900 shrink-0">
                  <h3 className="font-bold text-white text-sm">Xabarnomalar</h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors"
                    >
                      Barchasini o'qish
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto flex-1 divide-y divide-zinc-800/50 bg-zinc-950">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 text-xs">
                      Xabarnomalar yo'q
                    </div>
                  ) : (
                    notifications.map((notif: any) => {
                      const getIcon = () => {
                        const t = notif.type || '';
                        if (t.includes('unchecked')) return <Clock className="w-4 h-4 text-amber-500" />;
                        if (t.includes('inactive')) return <AlertTriangle className="w-4 h-4 text-red-500" />;
                        if (t.includes('lagging') || t.includes('rating')) return <TrendingDown className="w-4 h-4 text-orange-500" />;
                        return <Info className="w-4 h-4 text-blue-500" />;
                      };

                      return (
                        <div
                          key={notif.id}
                          onClick={() => handleNotifClick(notif)}
                          className={`p-4 transition-colors cursor-pointer border-b border-zinc-800/50 flex gap-3 items-start hover:bg-zinc-800/30 ${notif.isRead ? 'opacity-70' : 'bg-blue-500/5'}`}
                        >
                          <div className="shrink-0 mt-0.5">{getIcon()}</div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs ${notif.isRead ? 'text-zinc-400' : 'text-white font-semibold'} leading-snug truncate`}>
                              {notif.title}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-1">
                              {new Date(notif.createdAt).toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 border-l pl-4 sm:pl-5" style={{ borderColor: 'var(--border)' }}>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight">{user?.fullName}</p>
            {user?.role && (
              <p className="text-xs leading-tight" style={{ color: 'var(--muted-foreground)' }}>
                {ROLE_LABELS[user.role] ?? user.role}
              </p>
            )}
          </div>
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold lg:h-12 lg:w-12"
            style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
          >
            {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
          </div>
        </div>
      </div>

      {/* Notification Detail Modal */}
      {showModal && selectedNotif && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-violet-400" />
                <h3 className="text-white font-bold text-sm">Xabarnoma Tafsilotlari</h3>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 max-h-[70vh]">
              <div>
                <h4 className="text-white font-bold text-base leading-snug">{selectedNotif.title}</h4>
                <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">
                  {new Date(selectedNotif.createdAt).toLocaleString('uz-UZ', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <div className="h-px bg-zinc-800" />

              <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/80">
                {selectedNotif.body}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900 flex justify-end shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
