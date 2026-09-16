import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, UserCircle, Settings, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

/**
 * Yuqori o'ng burchakdagi akkaunt menyusi.
 *
 * Ilgari "Tizimdan chiqish" va profil bloki sidebar'ning pastida turardi.
 * Endi ular shu yerga ko'chdi va BARCHA rollar uchun bir xil ishlaydi.
 *
 * Yangi band qo'shish: pastdagi `items` ro'yxatiga bitta qator qo'shiladi.
 * `show` sharti bo'lsa, band faqat mos rolda ko'rinadi.
 *
 * Ochiqlik: aria-haspopup/aria-expanded, Escape yopadi, tashqariga
 * bosilsa yopiladi, yopilganda fokus tugmaga qaytadi, bandlar orasida
 * strelka bilan yurish mumkin.
 */

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

/** Rolga qarab profil sahifasining yo'li. Student uchun sahifa yo'q. */
function profileRoute(role?: string): string | null {
  if (!role) return null;
  if (role === 'admin') return '/admin/profile';
  if (role === 'teacher') return '/teacher/profile';
  if (role === 'student') return null;
  return `/viewer/${role}/profile`;
}

interface MenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
}

export default function UserMenu() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Tashqariga bosilsa va Escape bosilsa yopiladi
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const profile = profileRoute(user.role);

  const items: MenuItem[] = [
    ...(profile
      ? [{ key: 'profile', label: 'Mening profilim', icon: UserCircle, to: profile }]
      : []),
    ...(user.role === 'admin'
      ? [{ key: 'settings', label: 'Sozlamalar', icon: Settings, to: '/admin/settings' }]
      : []),
    {
      key: 'logout',
      label: 'Tizimdan chiqish',
      icon: LogOut,
      danger: true,
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  const close = () => setOpen(false);

  /** Strelka bilan bandlar orasida yurish */
  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const nodes = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (nodes.length === 0) return;
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % nodes.length : (i - 1 + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  const itemClass =
    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors';

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 transition-colors"
        style={open ? { background: 'var(--surface-hover)' } : undefined}
      >
        <span className="sr-only">Akkaunt menyusi</span>
        <span className="hidden text-right sm:block">
          <span className="block text-sm font-semibold leading-tight">{user.fullName}</span>
          <span className="block text-xs leading-tight" style={{ color: 'var(--muted-foreground)' }}>
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </span>
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold lg:h-12 lg:w-12"
          style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
        >
          {user.fullName?.charAt(0)?.toUpperCase() || '?'}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--muted-foreground)' }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Akkaunt"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border p-2"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-popover)',
          }}
        >
          {/* Kim ekanini eslatuvchi sarlavha — mobilda tugmada ism ko'rinmaydi */}
          <div className="border-b px-3 pb-3 pt-1" style={{ borderColor: 'var(--border)' }}>
            <p className="truncate text-sm font-bold">{user.fullName}</p>
            <p className="truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {ROLE_LABELS[user.role] ?? user.role}
            </p>
          </div>

          <div className="pt-2">
            {items.map((item) => {
              const Icon = item.icon;
              const tone = item.danger
                ? { color: 'var(--danger-fg)' }
                : { color: 'var(--foreground)' };

              if (item.to) {
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    role="menuitem"
                    onClick={close}
                    className={itemClass}
                    style={tone}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              }

              return (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    item.onClick?.();
                  }}
                  className={itemClass}
                  style={tone}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
