import { useAuthStore } from '@/stores/authStore';
import { ShieldAlert, Clock } from 'lucide-react';
import ChecklistPage from './ChecklistPage';

const ROLE_LABELS: Record<string, string> = {
  filial_rahbari: 'Filial Rahbari',
  assistant: 'Assistant',
  moliya_rahbari: 'Moliya Rahbari',
  kassir: 'Kassir',
  administrator: 'Administrator',
  nazoratchi: 'Nazoratchi (Inspektor)',
  hr_rahbari: 'HR Menejeri',
  sotuv_operatori: 'Sotuv Menejeri',
  farrosh: 'Farrosh',
};

// Checklist bor rollar
const CHECKLIST_ROLES = [
  'filial_rahbari',
  'robototexnika_ustoz',
  'assistant',
  'moliya_rahbari',
  'sotuv_operatori',
  'kassir',
  'call_operatori',
  'farrosh',
  'nazoratchi',
  'hr_rahbari',
];

export default function ViewerDashboardPage() {
  const { user } = useAuthStore();
  const roleLabel = user?.role ? (ROLE_LABELS[user.role] ?? user.role) : "Noma'lum";

  // Agar rolning checklisty bo'lsa, uni ko'rsat
  if (user?.role && CHECKLIST_ROLES.includes(user.role)) {
    return <ChecklistPage />;
  }

  // Boshqa rollar — kutish sahifasi
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 px-4">
      {/* Role badge */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
          <ShieldAlert className="w-10 h-10 text-blue-500" />
        </div>
        <div className="text-center">
          <p className="text-zinc-400 text-sm mb-1">Sizning lavozimingiz</p>
          <h1 className="text-2xl font-bold text-white">{roleLabel}</h1>
        </div>
      </div>

      {/* Info card */}
      <div className="w-full max-w-md bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Ruxsatlar sozlanmoqda</p>
            <p className="text-zinc-400 text-xs mt-0.5">
              Sizning lavozimingiz uchun sahifalar va imkoniyatlar tez orada belgilanadi.
            </p>
          </div>
        </div>

        <div className="border-t border-zinc-700/50 pt-4">
          <p className="text-zinc-500 text-xs text-center">
            Savollar bo'lsa, tizim administratoriga murojaat qiling.
          </p>
        </div>
      </div>

      {/* User info */}
      <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center font-bold text-sm border border-blue-500/20">
          {user?.fullName?.charAt(0) ?? '?'}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{user?.fullName}</p>
          <p className="text-xs text-zinc-500">{user?.login}</p>
        </div>
      </div>
    </div>
  );
}
