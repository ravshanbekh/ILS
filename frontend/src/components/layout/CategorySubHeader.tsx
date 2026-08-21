import { useLocation, NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  Users, FolderOpen, BookOpen, ClipboardCheck, BarChart3, Trophy,
  Snowflake, Star, Phone, ClipboardList, TrendingDown, Download,
  Settings, FileText, Zap, Video, Trash2, AlarmClock, Heart
} from 'lucide-react';

export interface SubNavItem {
  to: string;
  label: string;
  icon: any;
}

export interface NavCategoryGroup {
  id: string;
  label: string;
  icon: any;
  items: SubNavItem[];
}

export const ADMIN_GROUPS: NavCategoryGroup[] = [
  {
    id: 'users_groups',
    label: 'Jamoa',
    icon: Users,
    items: [
      { to: '/admin/users', label: 'Foydalanuvchilar', icon: Users },
      { to: '/admin/groups', label: 'Guruhlar', icon: FolderOpen },
      { to: '/admin/trash', label: 'Korzinka (Savat)', icon: Trash2 },
    ]
  },
  {
    id: 'education_exams',
    label: "Ta'lim",
    icon: BookOpen,
    items: [
      { to: '/admin/lessons', label: 'Darsliklar', icon: BookOpen },
      { to: '/admin/exams', label: 'Imtihonlar', icon: FileText },
      { to: '/admin/live-quiz', label: 'Live Quiz', icon: Zap },
    ]
  },
  {
    id: 'normatives_results',
    label: 'Normativlar',
    icon: ClipboardCheck,
    items: [
      { to: '/admin/normatives', label: 'Normativlar', icon: BookOpen },
      { to: '/admin/submissions', label: 'Topshiriqlar', icon: ClipboardCheck },
      { to: '/admin/stats', label: 'Statistika', icon: BarChart3 },
      { to: '/admin/rankings', label: "O'quvchilar reytingi", icon: Trophy },
    ]
  },
  {
    id: 'monitoring_analysis',
    label: 'Monitoring',
    icon: Phone,
    items: [
      { to: '/admin/lesson-control', label: 'Dars nazorati', icon: AlarmClock },
      { to: '/admin/parents', label: 'Ota-onalar bazasi', icon: Heart },
      { to: '/admin/frozen-students', label: 'Muzlatilganlar', icon: Snowflake },
      { to: '/admin/teacher-rating', label: "O'qituvchi reytingi", icon: Star },
      { to: '/admin/monitoring', label: 'Monitoring', icon: Phone },
      { to: '/admin/predictions', label: 'AI Prognozlar', icon: TrendingDown },
    ]
  },
  {
    id: 'checklist_system',
    label: 'Cheklistlar',
    icon: ClipboardList,
    items: [
      { to: '/admin/checklist-stats', label: 'Cheklist Hisobot', icon: BarChart3 },
      { to: '/admin/checklist-manage', label: 'Cheklist Boshqaruv', icon: ClipboardList },
    ]
  },
  {
    id: 'settings_backup',
    label: 'Sozlamalar',
    icon: Settings,
    items: [
      { to: '/admin/export', label: 'Eksport / Zaxira', icon: Download },
      { to: '/admin/settings', label: 'Sozlamalar', icon: Settings },
    ]
  }
];

export const TEACHER_GROUPS: NavCategoryGroup[] = [
  {
    id: 'users_groups',
    label: 'Jamoa',
    icon: Users,
    items: [
      { to: '/teacher/users', label: "O'quvchilar", icon: Users },
      { to: '/teacher/groups', label: 'Guruhlarim', icon: FolderOpen },
    ]
  },
  {
    id: 'education_exams',
    label: "Ta'lim",
    icon: BookOpen,
    items: [
      { to: '/teacher/lessons', label: 'Darsliklar', icon: BookOpen },
      { to: '/teacher/exams', label: 'Imtihonlar', icon: FileText },
      { to: '/teacher/live-quiz', label: 'Live Quiz', icon: Zap },
    ]
  },
  {
    id: 'normatives_results',
    label: 'Normativlar',
    icon: ClipboardCheck,
    items: [
      { to: '/teacher/normatives', label: 'Normativlar', icon: BookOpen },
      { to: '/teacher/pending', label: 'Tekshirish', icon: ClipboardCheck },
      { to: '/teacher/rankings', label: "O'quvchilar reytingi", icon: Trophy },
    ]
  },
  {
    id: 'settings_backup',
    label: 'Sozlamalar',
    icon: Settings,
    items: [
      { to: '/teacher/export', label: 'Eksport', icon: Download },
    ]
  }
];

export const STUDENT_GROUPS: NavCategoryGroup[] = [
  {
    id: 'normatives_student',
    label: 'Normativlar',
    icon: BookOpen,
    items: [
      { to: '/student/my-normatives', label: "Qoidalar va Ko'rsatmalar", icon: Video },
      { to: '/student/normatives', label: 'Normativlar', icon: BookOpen },
      { to: '/student/history', label: 'Topshiriqlarim', icon: ClipboardCheck },
      { to: '/student/ranking', label: 'Reyting', icon: Trophy },
    ]
  }
];

export default function CategorySubHeader() {
  const { user } = useAuthStore();
  const location = useLocation();

  const groups = user?.role === 'admin'
    ? ADMIN_GROUPS
    : user?.role === 'teacher'
    ? TEACHER_GROUPS
    : user?.role === 'student'
    ? STUDENT_GROUPS
    : [];
  if (groups.length === 0) return null;

  const activeGroup = groups.find(group =>
    group.items.some(item => location.pathname.startsWith(item.to))
  );

  if (!activeGroup || activeGroup.items.length <= 1) return null;

  return (
    <div className="w-full bg-[#121215] border-b border-zinc-800/80 px-4 py-2.5 sticky top-0 z-20 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 shrink-0">
          <activeGroup.icon className="w-4 h-4 text-blue-400" />
          <span className="hidden sm:inline">{activeGroup.label}:</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {activeGroup.items.map(item => {
            const isActive = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                    : 'bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}
