import type { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

const colorStyles = {
  blue: 'bg-blue-500/10 text-blue-500',
  green: 'bg-emerald-500/10 text-emerald-500',
  purple: 'bg-purple-500/10 text-purple-500',
  orange: 'bg-amber-500/10 text-amber-500',
  red: 'bg-red-500/10 text-red-500',
};

export default function StatsCard({ title, value, icon, trend, color = 'blue' }: StatsCardProps) {
  return (
    <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-5 shadow-sm transition-all hover:border-zinc-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
          {trend && (
            <p className="text-xs text-emerald-500 mt-2 font-medium">
              {trend}
            </p>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${colorStyles[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
