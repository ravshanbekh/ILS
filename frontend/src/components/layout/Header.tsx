import { Bell, Sun, Moon, X, AlertCircle, Info, Clock, AlertTriangle, Brain, TrendingDown } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useState, useEffect } from 'react';
import { notificationsApi } from '@/api';
import { socket } from '@/utils/socket';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
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

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
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
    <header className="h-16 border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur flex items-center justify-between px-8 sticky top-0 z-30 shrink-0">
      <div>
        <h2 className="text-lg font-semibold text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-5">
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
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#09090b]">
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
              <div className="absolute right-0 mt-3 w-80 bg-[#18181b] border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[400px]">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-[#18181b] shrink-0">
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

                <div className="overflow-y-auto flex-1 divide-y divide-zinc-800/50 bg-[#09090b]">
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

        <div className="flex items-center gap-3 pl-5 border-l border-zinc-800">
          <span className="text-sm font-medium text-zinc-300 hidden sm:block">{user?.fullName}</span>
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            {user?.fullName?.charAt(0) || '?'}
          </div>
        </div>
      </div>

      {/* Notification Detail Modal */}
      {showModal && selectedNotif && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#18181b] border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#18181b] shrink-0">
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
            <div className="px-6 py-4 border-t border-zinc-800 bg-[#18181b] flex justify-end shrink-0">
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
