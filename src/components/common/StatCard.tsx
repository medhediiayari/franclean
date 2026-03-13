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

export default function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconBg = 'bg-primary-50',
  iconColor = 'text-primary-600',
  alert,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card hover:shadow-card-hover transition-shadow">
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
      <p className="text-sm text-slate-500 mt-1">
        {label}
        {subtitle && <span className="text-slate-400"> {subtitle}</span>}
      </p>
    </div>
  );
}
