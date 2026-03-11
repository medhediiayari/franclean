import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useEventStore } from '../../store/eventStore';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, formatTime } from '../../utils/helpers';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Filter,
} from 'lucide-react';

export default function MyHours() {
  const { user } = useAuthStore();
  const { records } = useAttendanceStore();
  const { events } = useEventStore();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  if (!user) return null;

  const myRecords = records
    .filter((r) => r.agentId === user.id)
    .filter((r) => filterStatus === 'all' || r.status === filterStatus)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalHoursValidated = records
    .filter((r) => r.agentId === user.id && r.status === 'valide')
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const totalHoursPending = records
    .filter((r) => r.agentId === user.id && r.status === 'en_attente')
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const totalHoursRefused = records
    .filter((r) => r.agentId === user.id && r.status === 'refuse')
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0);

  return (
    <div className="p-4 space-y-5 animate-fadeIn">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Mes Heures</h1>
        <p className="text-sm text-slate-500">Historique de vos pointages et heures</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3 text-center">
          <CheckCircle2 size={18} className="mx-auto text-emerald-500 mb-1" />
          <p className="text-lg font-bold text-emerald-700">{totalHoursValidated.toFixed(1)}h</p>
          <p className="text-xs text-emerald-600">Validées</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-3 text-center">
          <Clock size={18} className="mx-auto text-amber-500 mb-1" />
          <p className="text-lg font-bold text-amber-700">{totalHoursPending.toFixed(1)}h</p>
          <p className="text-xs text-amber-600">En attente</p>
        </div>
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-3 text-center">
          <XCircle size={18} className="mx-auto text-rose-500 mb-1" />
          <p className="text-lg font-bold text-rose-700">{totalHoursRefused.toFixed(1)}h</p>
          <p className="text-xs text-rose-600">Refusées</p>
        </div>
      </div>

      {/* Total */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
        <p className="text-sm text-slate-500">Total heures ce mois</p>
        <p className="text-3xl font-bold text-slate-900 mt-1">
          {(totalHoursValidated + totalHoursPending).toFixed(1)}h
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-slate-400" />
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: 'all', label: 'Tous' },
            { key: 'valide', label: 'Validé' },
            { key: 'en_attente', label: 'En attente' },
            { key: 'refuse', label: 'Refusé' },
            { key: 'suspect', label: 'Suspect' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterStatus === f.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Records list */}
      {myRecords.length > 0 ? (
        <div className="space-y-2">
          {myRecords.map((rec) => {
            const event = events.find((e) => e.id === rec.eventId);
            return (
              <div
                key={rec.id}
                className="bg-white rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {event?.title || 'Mission'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                      <Calendar size={12} />
                      {formatDate(rec.date)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      {rec.checkInTime && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {formatTime(rec.checkInTime)}
                        </span>
                      )}
                      {rec.checkOutTime && (
                        <>
                          <span className="text-slate-300">→</span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            {formatTime(rec.checkOutTime)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={rec.status} />
                    {rec.hoursWorked && (
                      <span className="text-sm font-bold text-primary-600">
                        {rec.hoursWorked.toFixed(1)}h
                      </span>
                    )}
                  </div>
                </div>

                {/* Suspect reasons */}
                {rec.isSuspect && rec.suspectReasons.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    {rec.suspectReasons.map((reason, i) => (
                      <p
                        key={i}
                        className="text-xs text-orange-500 flex items-center gap-1"
                      >
                        <AlertTriangle size={10} /> {reason}
                      </p>
                    ))}
                  </div>
                )}

                {/* Refusal reason */}
                {rec.status === 'refuse' && rec.refusalReason && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <p className="text-xs text-rose-500">
                      Motif : {rec.refusalReason}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Clock size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Aucun pointage enregistré</p>
        </div>
      )}
    </div>
  );
}
