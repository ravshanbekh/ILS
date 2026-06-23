import { Bell } from 'lucide-react';
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
                      // Color based on type
                      const typeConfig: Record<string, { dot: string; bg: string }> = {
                        ai_alert: { dot: 'bg-violet-500', bg: 'bg-violet-500/5' },
                        warning: { dot: 'bg-amber-500', bg: 'bg-amber-500/5' },
                        success: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/5' },
                        info: { dot: 'bg-blue-500', bg: 'bg-blue-500/5' },
                      };
                      const tc = notif.type && typeConfig[notif.type] ? typeConfig[notif.type] : { dot: 'bg-blue-500', bg: 'bg-blue-500/5' };

                      return (
                        <div
                          key={notif.id}
                          className={`p-4 transition-colors ${notif.isRead ? 'opacity-75 hover:bg-zinc-800/30' : `${tc.bg} hover:bg-zinc-800/20`}`}
                        >
                          <div className="flex gap-3">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${notif.isRead ? 'bg-transparent' : tc.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${notif.isRead ? 'text-zinc-300' : 'text-white font-medium'} leading-snug`}>
                                {notif.message}
                              </p>
                              <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">
                                {new Date(notif.createdAt).toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          {!notif.isRead && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="mt-2 ml-5 text-xs font-medium text-blue-500 hover:text-blue-400"
                            >
                              O'qildi deb belgilash
                            </button>
                          )}
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
    </header>
  );
}
