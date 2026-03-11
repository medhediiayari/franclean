import type { EventStatus, AttendanceStatus } from '../../types';

type StatusType = EventStatus | AttendanceStatus | string;

const statusConfig: Record<string, { label: string; className: string }> = {
  planifie: { label: 'Planifié', className: 'bg-blue-100 text-blue-700 ring-blue-600/20' },
  en_cours: { label: 'En cours', className: 'bg-amber-100 text-amber-700 ring-amber-600/20' },
  termine: { label: 'Terminé', className: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20' },
  a_reattribuer: { label: 'À réattribuer', className: 'bg-rose-100 text-rose-700 ring-rose-600/20' },
  annule: { label: 'Annulé', className: 'bg-slate-100 text-slate-500 ring-slate-600/20' },
  en_attente: { label: 'En attente', className: 'bg-amber-100 text-amber-700 ring-amber-600/20' },
  valide: { label: 'Validé', className: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20' },
  refuse: { label: 'Refusé', className: 'bg-rose-100 text-rose-700 ring-rose-600/20' },
  suspect: { label: 'Suspect', className: 'bg-orange-100 text-orange-700 ring-orange-600/20' },
  accepted: { label: 'Accepté', className: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20' },
  refused: { label: 'Refusé', className: 'bg-rose-100 text-rose-700 ring-rose-600/20' },
  pending: { label: 'En attente', className: 'bg-amber-100 text-amber-700 ring-amber-600/20' },
  complete: { label: 'Complète', className: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20' },
  partielle: { label: 'Partielle', className: 'bg-amber-100 text-amber-700 ring-amber-600/20' },
};

interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: 'bg-slate-100 text-slate-600 ring-slate-600/20',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full ring-1 ring-inset font-medium ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      } ${config.className}`}
    >
      {config.label}
    </span>
  );
}
