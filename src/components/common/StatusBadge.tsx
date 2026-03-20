import type { EventStatus, AttendanceStatus } from '../../types';

type StatusType = EventStatus | AttendanceStatus | string;

const statusConfig: Record<string, { label: string; className: string; dot?: string }> = {
  planifie: { label: 'Planifié', className: 'bg-blue-50 text-blue-700 ring-blue-500/20', dot: 'bg-blue-400' },
  en_cours: { label: 'En cours', className: 'bg-amber-50 text-amber-700 ring-amber-500/20', dot: 'bg-amber-400' },
  termine: { label: 'Terminé', className: 'bg-emerald-50 text-emerald-700 ring-emerald-500/20', dot: 'bg-emerald-400' },
  a_reattribuer: { label: 'À réattribuer', className: 'bg-rose-50 text-rose-700 ring-rose-500/20', dot: 'bg-rose-400' },
  annule: { label: 'Annulé', className: 'bg-slate-50 text-slate-500 ring-slate-500/20', dot: 'bg-slate-400' },
  en_attente: { label: 'En attente', className: 'bg-amber-50 text-amber-700 ring-amber-500/20', dot: 'bg-amber-400' },
  valide: { label: 'Validé', className: 'bg-emerald-50 text-emerald-700 ring-emerald-500/20', dot: 'bg-emerald-400' },
  refuse: { label: 'Refusé', className: 'bg-rose-50 text-rose-700 ring-rose-500/20', dot: 'bg-rose-400' },
  suspect: { label: 'Suspect', className: 'bg-orange-50 text-orange-700 ring-orange-500/20', dot: 'bg-orange-400' },
  accepted: { label: 'Accepté', className: 'bg-emerald-50 text-emerald-700 ring-emerald-500/20', dot: 'bg-emerald-400' },
  refused: { label: 'Refusé', className: 'bg-rose-50 text-rose-700 ring-rose-500/20', dot: 'bg-rose-400' },
  pending: { label: 'En attente', className: 'bg-amber-50 text-amber-700 ring-amber-500/20', dot: 'bg-amber-400' },
  complete: { label: 'Complète', className: 'bg-emerald-50 text-emerald-700 ring-emerald-500/20', dot: 'bg-emerald-400' },
  partielle: { label: 'Partielle', className: 'bg-amber-50 text-amber-700 ring-amber-500/20', dot: 'bg-amber-400' },
};

interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: 'bg-slate-50 text-slate-600 ring-slate-500/20',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset font-bold ${
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      } ${config.className}`}
    >
      {config.dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      )}
      {config.label}
    </span>
  );
}
