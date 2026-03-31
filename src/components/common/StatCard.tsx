import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  alert?: boolean;
}

// Map iconBg to a left border color for visual differentiation
const borderColorMap: Record<string, string> = {
  'bg-blue-50': 'border-l-blue-500',
  'bg-amber-50': 'border-l-amber-500',
  'bg-purple-50': 'border-l-purple-500',
  'bg-emerald-50': 'border-l-emerald-500',
  'bg-indigo-50': 'border-l-indigo-500',
  'bg-rose-50': 'border-l-rose-500',
  'bg-orange-50': 'border-l-orange-500',
  'bg-pink-50': 'border-l-pink-500',
  'bg-primary-50': 'border-l-primary-500',
};

export default function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconBg = 'bg-primary-50',
  iconColor = 'text-primary-600',
  alert,
}: StatCardProps) {
  const borderLeft = borderColorMap[iconBg] || 'border-l-primary-500';

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 border-l-[3px] ${borderLeft} p-5 shadow-card hover:shadow-card-hover transition-shadow ${alert ? 'ring-1 ring-amber-200/60 bg-amber-50/20' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
        {alert && (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
      <p className="text-sm text-slate-600 mt-1">
        {label}
        {subtitle && <span className="text-slate-500"> {subtitle}</span>}
      </p>
    </div>
  );
}
