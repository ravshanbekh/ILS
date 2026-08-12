import type { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

const colorStyles = {
  blue: 'bg-[#EFF6FF] text-[#2563EB]',
  purple: 'bg-[#F3E8FF] text-[#7C3AED]',
  green: 'bg-[#ECFDF5] text-[#059669]',
  orange: 'bg-[#FFF7E0] text-[#D97706]',
  red: 'bg-[#FFF1F2] text-[#E5484D]',
};

export default function StatsCard({ title, value, icon, trend, color = 'blue' }: StatsCardProps) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-[#64748B] mb-2">{title}</p>
          <p className="text-3xl font-extrabold text-[#0F172A] tracking-tight">{value}</p>
          {trend && (
            <p className="text-xs text-[#059669] mt-2 font-medium">
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3.5 rounded-2xl flex items-center justify-center ${colorStyles[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
